"""Aircraft API router with list, detail, and update endpoints.

All endpoints require authentication. Writes (POST/PUT) require editor role (admin or user).
Monetary values are returned in USD; the pricing workspace converts them to
EUR with each quote's own USD/EUR rate.
"""
from __future__ import annotations

from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.database import get_db
from app.auth.dependencies import get_current_user, require_editor, user_can_view_naked
from app.aircraft.repository import AircraftRepository
from app.aircraft.schemas import (
    AircraftDetailResponse,
    AircraftListResponse,
    CreateAircraftRequest,
    ImportAircraftRequest,
    UpdateAircraftRequest,
    UpdateEprMatrixRequest,
    UpdateRatesRequest,
)

router = APIRouter(prefix="/aircraft", tags=["aircraft"])


async def _detail_payload(repo: AircraftRepository, row: dict, user: dict) -> dict:
    """Full aircraft detail for a response: current EPR matrix always; naked
    rates and naked EPR only for users with naked access (stripped otherwise)."""
    data = dict(row)
    data["epr_matrix"] = [dict(r) for r in await repo.fetch_epr_matrix(row["id"], "current")]
    if user_can_view_naked(user) and data.get("has_naked_rates"):
        data["naked_epr_matrix"] = [dict(r) for r in await repo.fetch_epr_matrix(row["id"], "naked")]
    else:
        for key in [k for k in data if k.startswith("naked_")]:
            data.pop(key, None)
        data["has_naked_rates"] = False
        data["naked_epr_matrix"] = []
    return data


def _check_naked_write(fields: dict, user: dict) -> None:
    """Naked rates are visible (and writable) only with naked access."""
    if any(k.startswith("naked_") for k in fields) and not user_can_view_naked(user):
        raise HTTPException(status_code=403, detail="Naked rates require cost access")


@router.get("", response_model=list[AircraftListResponse])
async def list_aircraft(
    search: str | None = Query(None, description="Search by MSN or registration"),
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all aircraft with rates and EPR matrices, optionally filtered.

    Naked rates/EPR are attached only for cost-access users; for everyone else
    the naked_* fields are stripped server-side.
    """
    repo = AircraftRepository(db)
    rows = await repo.list_aircraft(search)
    aircraft_ids = [r["id"] for r in rows]
    epr_map = await repo.fetch_epr_matrices_for_ids(aircraft_ids, "current") if aircraft_ids else {}

    can_view = user_can_view_naked(current_user)
    naked_epr_map = (
        await repo.fetch_epr_matrices_for_ids(aircraft_ids, "naked")
        if aircraft_ids and can_view else {}
    )

    result = []
    for r in rows:
        data = dict(r)
        data["epr_matrix"] = [dict(e) for e in epr_map.get(r["id"], [])]
        if can_view and data.get("has_naked_rates"):
            data["naked_epr_matrix"] = [dict(e) for e in naked_epr_map.get(r["id"], [])]
        else:
            for key in [k for k in list(data) if k.startswith("naked_")]:
                data.pop(key, None)
            data["has_naked_rates"] = False
            data["naked_epr_matrix"] = []
        result.append(data)
    return result


@router.post("", response_model=AircraftDetailResponse, status_code=201)
async def create_aircraft(
    body: CreateAircraftRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Create a new aircraft with rates (admin or user).

    Creates the aircraft row and upserts all rate fields in one operation.
    Returns the full aircraft detail.
    """
    repo = AircraftRepository(db)

    # Check for duplicate MSN
    existing = await repo.fetch_by_msn(body.msn)
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Aircraft MSN {body.msn} already exists"
        )

    # Create the aircraft record
    aircraft = await repo.create_aircraft(
        msn=body.msn,
        aircraft_type=body.aircraft_type,
        registration=body.registration,
    )

    # Upsert rates (only non-None fields)
    rate_fields = {
        k: v
        for k, v in body.model_dump().items()
        if k not in ("msn", "aircraft_type", "registration") and v is not None
    }
    if rate_fields:
        await repo.upsert_rates(aircraft["id"], **rate_fields)

    # Re-fetch to get complete data
    full = await repo.fetch_by_msn(body.msn)
    return await _detail_payload(repo, full, current_user)


@router.get("/{msn}", response_model=AircraftDetailResponse)
async def get_aircraft(
    msn: int,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get aircraft detail with full rates and EPR matrix.

    Naked rates are only included for users with cost access; otherwise all
    ``naked_*`` fields are stripped server-side so they never reach the client.
    """
    repo = AircraftRepository(db)
    aircraft = await repo.fetch_by_msn(msn)
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    return await _detail_payload(repo, aircraft, current_user)


@router.patch("/{msn}", response_model=AircraftDetailResponse)
async def update_aircraft(
    msn: int,
    body: UpdateAircraftRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Update aircraft identity fields (admin or user).

    Supports registration (null or an empty string clears it) and is_active,
    the fleet on/off switch. Returns the full aircraft detail.
    """
    repo = AircraftRepository(db)
    aircraft = await repo.fetch_by_msn(msn)
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    fields: dict = {}
    if "registration" in body.model_fields_set:
        fields["registration"] = (body.registration or "").strip() or None
    if body.is_active is not None:
        fields["is_active"] = body.is_active
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    await repo.update_aircraft(aircraft["id"], **fields)
    updated = await repo.fetch_by_msn(msn)
    return await _detail_payload(repo, updated, current_user)


@router.put("/{msn}/rates", response_model=AircraftDetailResponse)
async def update_rates(
    msn: int,
    body: UpdateRatesRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Update aircraft cost parameters (admin or user).

    Accepts partial updates — only non-None fields are written. Naked fields
    need naked access and mark the aircraft as having naked rates.
    Returns the full aircraft detail with updated values.
    """
    repo = AircraftRepository(db)
    aircraft = await repo.fetch_by_msn(msn)
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    _check_naked_write(fields, current_user)
    if any(k.startswith("naked_") for k in fields):
        fields["has_naked_rates"] = True

    await repo.update_rates(aircraft["id"], **fields)
    updated = await repo.fetch_by_msn(msn)
    return await _detail_payload(repo, updated, current_user)


@router.put("/{msn}/epr-matrix", response_model=AircraftDetailResponse)
async def update_epr_matrix(
    msn: int,
    body: UpdateEprMatrixRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Bulk replace the EPR matrix for an aircraft (admin or user).

    Deletes all existing rows and inserts the provided set.
    Returns the full aircraft detail.
    """
    repo = AircraftRepository(db)
    aircraft = await repo.fetch_by_msn(msn)
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    # Validate: no duplicate cycle_ratios
    ratios = [r.cycle_ratio for r in body.rows]
    if len(ratios) != len(set(ratios)):
        raise HTTPException(
            status_code=400, detail="Duplicate cycle ratios not allowed"
        )

    # Replace the EPR matrix
    row_tuples = [
        (r.cycle_ratio, r.benign_rate, r.hot_rate) for r in body.rows
    ]
    await repo.bulk_replace_epr_matrix(aircraft["id"], row_tuples)

    updated = await repo.fetch_by_msn(msn)
    return await _detail_payload(repo, updated, current_user)


@router.post("/import")
async def import_aircraft(
    body: ImportAircraftRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Apply an Aircraft-tab Excel import in one transaction (admin or user).

    Every MSN must already exist; nothing is written if any item is invalid.
    Per item, only the fields present change, and a present EPR matrix replaces
    that basis' whole matrix. Naked fields/matrices need naked access.
    """
    repo = AircraftRepository(db)
    resolved = []
    for item in body.aircraft:
        aircraft = await repo.fetch_by_msn(item.msn)
        if not aircraft:
            raise HTTPException(status_code=404, detail=f"Aircraft MSN {item.msn} not found")
        fields = {k: v for k, v in item.rates.model_dump().items() if v is not None}
        naked_matrix = {"naked_epr_matrix": True} if item.naked_epr_matrix is not None else {}
        _check_naked_write({**fields, **naked_matrix}, current_user)
        for matrix in (item.epr_matrix, item.naked_epr_matrix):
            if matrix is not None:
                ratios = [r.cycle_ratio for r in matrix]
                if len(ratios) != len(set(ratios)):
                    raise HTTPException(
                        status_code=400,
                        detail=f"MSN {item.msn}: duplicate cycle ratios in EPR matrix",
                    )
        resolved.append((aircraft, item, fields))

    async with db.transaction():
        for aircraft, item, fields in resolved:
            if item.is_active is not None:
                await repo.update_aircraft(aircraft["id"], is_active=item.is_active)
            if any(k.startswith("naked_") for k in fields) or item.naked_epr_matrix is not None:
                fields["has_naked_rates"] = True
            if fields:
                await repo.upsert_rates(aircraft["id"], **fields)
            if item.epr_matrix is not None:
                await repo.bulk_replace_epr_matrix(
                    aircraft["id"], [(r.cycle_ratio, r.benign_rate, r.hot_rate) for r in item.epr_matrix]
                )
            if item.naked_epr_matrix is not None:
                await repo.bulk_replace_epr_matrix(
                    aircraft["id"],
                    [(r.cycle_ratio, r.benign_rate, r.hot_rate) for r in item.naked_epr_matrix],
                    "naked",
                )
    return {"updated": len(resolved)}
