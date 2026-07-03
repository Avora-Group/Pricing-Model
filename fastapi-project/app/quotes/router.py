"""Quote API endpoints: save, list, detail, status update, delete, PDF stub.

Endpoints:
- POST   /quotes: Save a new quote with full state snapshot
- GET    /quotes: List quotes with search, status, and MSN filters
- GET    /quotes/{quote_id}: Get full quote detail with MSN snapshots
- PATCH  /quotes/{quote_id}/status: Update quote status (creator or admin only)
- DELETE /quotes/{quote_id}: Delete a quote (admin only)
- GET    /quotes/{quote_id}/pdf: PDF export stub (501 -- BLOCKED pending QUOT-06)
"""
from __future__ import annotations

from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse

from app.auth.dependencies import get_current_user, require_admin, user_can_view_costs
from app.db.database import get_db
from app.pricing.redaction import redact_quote_detail
from app.quotes.repository import QuoteRepository
from app.quotes.schemas import (
    QuoteDetailResponse,
    QuoteListItem,
    MsnSnapshotResponse,
    SaveQuoteRequest,
    UpdateQuoteStatusRequest,
)


router = APIRouter(prefix="/quotes", tags=["quotes"])


# ---- Save Quote ----


@router.post("/", status_code=201)
async def save_quote(
    body: SaveQuoteRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Save a new quote with full state snapshot.

    Creates the quote record and all per-MSN snapshots atomically.
    Returns the generated quote_number and metadata.
    """
    repo = QuoteRepository(db)

    # Generate sequential quote number for client code
    quote_number = await repo.generate_quote_number(body.client_code)

    # Extract exchange_rate and margin_percent from dashboard_state
    exchange_rate = Decimal(str(body.dashboard_state.get("exchangeRate", "0.85")))
    margin_percent = Decimal(str(body.dashboard_state.get("marginPercent", "0")))

    # Extract total_eur_per_bh from dashboard_state if available
    total_eur_per_bh = None
    total_result = body.dashboard_state.get("totalResult")
    if total_result and isinstance(total_result, dict):
        rate = total_result.get("final_rate_per_bh") or total_result.get("finalRatePerBh")
        if rate is not None:
            total_eur_per_bh = Decimal(str(rate))

    # Extract msn_list from snapshots
    msn_list = [snap.msn for snap in body.msn_snapshots]

    # Extract period_start/period_end from msn_snapshots if available
    period_start = None
    period_end = None
    for snap in body.msn_snapshots:
        snap_start = snap.msn_input.get("periodStart")
        snap_end = snap.msn_input.get("periodEnd")
        if snap_start:
            if period_start is None or snap_start < period_start:
                period_start = snap_start
        if snap_end:
            if period_end is None or snap_end > period_end:
                period_end = snap_end

    # Create the quote record
    quote = await repo.create_quote(
        quote_number=quote_number,
        client_name=body.client_name,
        client_code=body.client_code,
        created_by=current_user["id"],
        exchange_rate=exchange_rate,
        margin_percent=margin_percent,
        total_eur_per_bh=total_eur_per_bh,
        msn_list=msn_list,
        period_start=period_start,
        period_end=period_end,
        pricing_config_snapshot=body.pricing_config_snapshot,
        crew_config_snapshot=body.crew_config_snapshot,
        costs_config_snapshot=body.costs_config_snapshot,
        dashboard_state=body.dashboard_state,
        project_id=body.project_id,
    )

    # Create per-MSN snapshots
    for snap in body.msn_snapshots:
        monthly_cost = None
        monthly_revenue = None
        # Extract monthly_cost / monthly_revenue from breakdown if available
        if snap.breakdown:
            mc = snap.breakdown.get("monthly_cost") or snap.breakdown.get("monthlyCost")
            mr = snap.breakdown.get("monthly_revenue") or snap.breakdown.get("monthlyRevenue")
            if mc is not None:
                monthly_cost = Decimal(str(mc))
            if mr is not None:
                monthly_revenue = Decimal(str(mr))

        await repo.create_msn_snapshot(
            quote_id=quote["id"],
            msn=snap.msn,
            aircraft_type=snap.aircraft_type,
            aircraft_id=snap.aircraft_id,
            msn_input=snap.msn_input,
            breakdown=snap.breakdown,
            monthly_pnl=snap.monthly_pnl,
            monthly_cost=monthly_cost,
            monthly_revenue=monthly_revenue,
        )

    return {
        "id": quote["id"],
        "quote_number": quote["quote_number"],
        "client_name": quote["client_name"],
        "status": quote["status"],
        "created_at": str(quote["created_at"]),
    }


@router.put("/{quote_id}")
async def update_quote(
    quote_id: int,
    body: SaveQuoteRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Edit an existing quote in place (replaces its inputs and snapshots).

    Keeps the quote_number, owner, status and created_at; updates client,
    metadata, config snapshots and re-creates the per-MSN snapshots. Only the
    creator or an admin may edit.
    """
    repo = QuoteRepository(db)
    existing = await repo.get_quote(quote_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Quote not found")
    if current_user["id"] != existing["created_by"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the creator or an admin can edit a quote")

    exchange_rate = Decimal(str(body.dashboard_state.get("exchangeRate", "0.85")))
    margin_percent = Decimal(str(body.dashboard_state.get("marginPercent", "0")))

    total_eur_per_bh = None
    total_result = body.dashboard_state.get("totalResult")
    if total_result and isinstance(total_result, dict):
        rate = total_result.get("final_rate_per_bh") or total_result.get("finalRatePerBh")
        if rate is not None:
            total_eur_per_bh = Decimal(str(rate))

    msn_list = [snap.msn for snap in body.msn_snapshots]
    period_start = None
    period_end = None
    for snap in body.msn_snapshots:
        snap_start = snap.msn_input.get("periodStart")
        snap_end = snap.msn_input.get("periodEnd")
        if snap_start and (period_start is None or snap_start < period_start):
            period_start = snap_start
        if snap_end and (period_end is None or snap_end > period_end):
            period_end = snap_end

    async with db.transaction():
        quote = await repo.update_quote(
            quote_id,
            client_name=body.client_name,
            client_code=body.client_code,
            exchange_rate=exchange_rate,
            margin_percent=margin_percent,
            total_eur_per_bh=total_eur_per_bh,
            msn_list=msn_list,
            period_start=period_start,
            period_end=period_end,
            pricing_config_snapshot=body.pricing_config_snapshot,
            crew_config_snapshot=body.crew_config_snapshot,
            costs_config_snapshot=body.costs_config_snapshot,
            dashboard_state=body.dashboard_state,
            project_id=body.project_id,
        )

        # Replace per-MSN snapshots
        await repo.delete_msn_snapshots(quote_id)
        for snap in body.msn_snapshots:
            monthly_cost = None
            monthly_revenue = None
            if snap.breakdown:
                mc = snap.breakdown.get("monthly_cost") or snap.breakdown.get("monthlyCost")
                mr = snap.breakdown.get("monthly_revenue") or snap.breakdown.get("monthlyRevenue")
                if mc is not None:
                    monthly_cost = Decimal(str(mc))
                if mr is not None:
                    monthly_revenue = Decimal(str(mr))
            await repo.create_msn_snapshot(
                quote_id=quote_id,
                msn=snap.msn,
                aircraft_type=snap.aircraft_type,
                aircraft_id=snap.aircraft_id,
                msn_input=snap.msn_input,
                breakdown=snap.breakdown,
                monthly_pnl=snap.monthly_pnl,
                monthly_cost=monthly_cost,
                monthly_revenue=monthly_revenue,
            )

    return {
        "id": quote["id"],
        "quote_number": quote["quote_number"],
        "client_name": quote["client_name"],
        "status": quote["status"],
        "created_at": str(quote["created_at"]),
    }


# ---- List Quotes ----


@router.get("/")
async def list_quotes(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    msn: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List quotes with optional search, status, and MSN filters.

    Supports pagination via limit/offset. MSN filter uses GIN index
    on msn_list column for efficient array containment checks.
    """
    repo = QuoteRepository(db)

    items = await repo.list_quotes(
        search=search, status=status, msn=msn, limit=limit, offset=offset
    )
    total = await repo.count_quotes(search=search, status=status, msn=msn)

    # Convert items to QuoteListItem format
    result_items = []
    for item in items:
        result_items.append(
            QuoteListItem(
                id=item["id"],
                quote_number=item["quote_number"],
                client_name=item["client_name"],
                client_code=item["client_code"],
                status=item["status"],
                exchange_rate=item["exchange_rate"],
                margin_percent=item["margin_percent"],
                total_eur_per_bh=item.get("total_eur_per_bh"),
                msn_list=item["msn_list"],
                created_at=str(item["created_at"]),
                created_by=item["created_by"],
            ).model_dump()
        )

    return {"items": result_items, "total": total}


# ---- Quote Detail ----


@router.get("/{quote_id}")
async def get_quote_detail(
    quote_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Get full quote detail including all JSONB snapshots and MSN data."""
    repo = QuoteRepository(db)

    quote = await repo.get_quote(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    snapshots = await repo.get_quote_msn_snapshots(quote_id)

    msn_snapshot_list = [
        MsnSnapshotResponse(
            id=s["id"],
            msn=s["msn"],
            aircraft_type=s["aircraft_type"],
            aircraft_id=s["aircraft_id"],
            msn_input=s["msn_input"],
            breakdown=s["breakdown"],
            monthly_pnl=s["monthly_pnl"],
            monthly_cost=s.get("monthly_cost"),
            monthly_revenue=s.get("monthly_revenue"),
        ).model_dump()
        for s in snapshots
    ]

    detail = QuoteDetailResponse(
        id=quote["id"],
        quote_number=quote["quote_number"],
        client_name=quote["client_name"],
        client_code=quote["client_code"],
        status=quote["status"],
        exchange_rate=quote["exchange_rate"],
        margin_percent=quote["margin_percent"],
        total_eur_per_bh=quote.get("total_eur_per_bh"),
        msn_list=quote["msn_list"],
        created_at=str(quote["created_at"]),
        created_by=quote["created_by"],
        pricing_config_snapshot=quote["pricing_config_snapshot"],
        crew_config_snapshot=quote["crew_config_snapshot"],
        costs_config_snapshot=quote["costs_config_snapshot"],
        dashboard_state=quote["dashboard_state"],
        msn_snapshots=msn_snapshot_list,
    )

    # Server-side naked-cost gate: strip cost/profit/margin + config snapshots
    # for users without permission. Sell rate + identity are preserved.
    return redact_quote_detail(detail.model_dump(), user_can_view_costs(current_user))


# ---- Update Status ----


@router.patch("/{quote_id}/status")
async def update_quote_status(
    quote_id: int,
    body: UpdateQuoteStatusRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update a quote's status. Only the creator or an admin can change status.

    Status transitions: draft -> sent -> accepted/rejected.
    Snapshot columns remain immutable -- only status can change.
    """
    repo = QuoteRepository(db)

    # Check ownership: only creator or admin can update status
    quote = await repo.get_quote(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if current_user["id"] != quote["created_by"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only the quote creator or an admin can change status",
        )

    updated = await repo.update_status(quote_id, body.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Quote not found")

    return {
        "id": updated["id"],
        "quote_number": updated["quote_number"],
        "status": updated["status"],
        "client_name": updated["client_name"],
    }


# ---- Delete Quote (Admin Only) ----


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(
    quote_id: int,
    current_user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a quote. Admin only.

    Removes the quote and all associated MSN snapshots (via CASCADE).
    Returns 204 No Content on success.
    """
    repo = QuoteRepository(db)

    existing = await repo.get_quote(quote_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Quote not found")

    await repo.delete_quote(quote_id)
    return Response(status_code=204)


# ---- PDF Export Stub ----


@router.get("/{quote_id}/pdf")
async def get_quote_pdf(
    quote_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """PDF export endpoint -- BLOCKED pending Excel summary template.

    TODO: BLOCKED: PDF generation requires Excel summary file and company
    branding assets. Implement with WeasyPrint once received. QUOT-06 is
    deferred -- not claimed by this plan.
    """
    return JSONResponse(
        status_code=501,
        content={
            "detail": "PDF export pending -- waiting for Excel summary template. "
            "QUOT-06 deferred to post-phase."
        },
    )
