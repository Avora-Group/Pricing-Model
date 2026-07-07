"""Aircraft API router with list, detail, and update endpoints.

All endpoints require authentication. Writes (POST/PUT) require editor role (admin or user).
EUR conversion is applied to all responses returning monetary values.
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
    UpdateEprMatrixRequest,
    UpdateRatesRequest,
)
from app.aircraft.service import apply_eur_conversion

router = APIRouter(prefix="/aircraft", tags=["aircraft"])


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
        data = apply_eur_conversion(dict(r))
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
    Returns the full aircraft detail with EUR conversions.
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

    # Re-fetch to get complete data with EUR conversions
    full = await repo.fetch_by_msn(body.msn)
    epr_rows = await repo.fetch_epr_matrix(full["id"])
    data = apply_eur_conversion(dict(full))
    data["epr_matrix"] = [dict(r) for r in epr_rows]
    return data


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
    epr_rows = await repo.fetch_epr_matrix(aircraft["id"], "current")
    data = apply_eur_conversion(dict(aircraft))
    data["epr_matrix"] = [dict(r) for r in epr_rows]

    if user_can_view_naked(current_user) and data.get("has_naked_rates"):
        naked_epr = await repo.fetch_epr_matrix(aircraft["id"], "naked")
        data["naked_epr_matrix"] = [dict(r) for r in naked_epr]
    else:
        # Strip every naked_* field for users without cost access.
        for key in [k for k in data if k.startswith("naked_")]:
            data.pop(key, None)
        data["has_naked_rates"] = False
        data["naked_epr_matrix"] = []
    return data


@router.put("/{msn}/rates", response_model=AircraftDetailResponse)
async def update_rates(
    msn: int,
    body: UpdateRatesRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Update aircraft cost parameters (admin or user).

    Accepts partial updates — only non-None fields are written.
    Returns the full aircraft detail with updated values.
    """
    repo = AircraftRepository(db)
    aircraft = await repo.fetch_by_msn(msn)
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    await repo.update_rates(aircraft["id"], **fields)
    # Re-fetch to return updated data
    updated = await repo.fetch_by_msn(msn)
    epr_rows = await repo.fetch_epr_matrix(updated["id"])
    data = apply_eur_conversion(dict(updated))
    data["epr_matrix"] = [dict(r) for r in epr_rows]
    return data


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

    # Re-fetch and return
    updated = await repo.fetch_by_msn(msn)
    epr_rows = await repo.fetch_epr_matrix(updated["id"])
    data = apply_eur_conversion(dict(updated))
    data["epr_matrix"] = [dict(r) for r in epr_rows]
    return data
