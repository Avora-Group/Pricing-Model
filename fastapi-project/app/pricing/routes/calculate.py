"""Pricing calculation endpoint.

Endpoint:
- POST /calculate: Run P&L calculation for one or more MSNs
"""
from __future__ import annotations

from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user, user_can_view_costs
from app.db.database import get_db
from app.pricing.redaction import redact_calculate_response
from app.aircraft.repository import AircraftRepository
from app.pricing.repository import (
    CrewConfigRepository,
    PricingConfigRepository,
)
from app.pricing.schemas import (
    CalculateRequest,
    CalculateResponse,
    ComponentBreakdown as ComponentBreakdownSchema,
    MsnPnlResult,
)
from app.pricing.service import (
    AircraftCosts,
    CrewConfig,
    PricingConfig,
    calculate_pricing,
    calculate_project_pnl,
    interpolate_epr,
)


router = APIRouter()


@router.post("/calculate", response_model=CalculateResponse)
async def calculate(
    body: CalculateRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Run P&L calculation for one or more MSNs.

    For each MSN input:
    1. Fetch aircraft by MSN (with rates)
    2. Fetch EPR matrix for the aircraft
    3. Fetch current pricing config and crew config
    4. Interpolate EPR rate for the given cycle_ratio and environment
    5. Run the 7-component calculation
    6. Return per-MSN breakdown and aggregated total
    """
    aircraft_repo = AircraftRepository(db)
    pricing_repo = PricingConfigRepository(db)
    crew_repo = CrewConfigRepository(db)

    # Fetch pricing config once
    pricing_config_row = await pricing_repo.get_current()
    if not pricing_config_row:
        raise HTTPException(status_code=500, detail="No pricing config found")

    config = PricingConfig(
        exchange_rate=pricing_config_row["exchange_rate"],
        insurance_usd=pricing_config_row["insurance_usd"],
        doc_total_budget=pricing_config_row["doc_total_budget"],
        overhead_total_budget=pricing_config_row["overhead_total_budget"],
        other_cogs_monthly=pricing_config_row["other_cogs_monthly"],
        line_maintenance_monthly=pricing_config_row["line_maintenance_monthly"],
        base_maintenance_monthly=pricing_config_row["base_maintenance_monthly"],
        personnel_salary_monthly=pricing_config_row["personnel_salary_monthly"],
        c_check_monthly=pricing_config_row["c_check_monthly"],
        maintenance_training_monthly=pricing_config_row["maintenance_training_monthly"],
        spare_parts_rate=pricing_config_row["spare_parts_rate"],
        maintenance_per_diem=pricing_config_row["maintenance_per_diem"],
        average_active_fleet=pricing_config_row["average_active_fleet"],
    )

    msn_results = []

    for msn_input in body.msn_inputs:
        # Fetch aircraft with rates
        aircraft = await aircraft_repo.fetch_by_msn(msn_input.msn)
        if not aircraft:
            raise HTTPException(
                status_code=404,
                detail=f"Aircraft with MSN {msn_input.msn} not found",
            )

        # Fetch EPR matrix
        epr_rows = await aircraft_repo.fetch_epr_matrix(aircraft["id"])

        # Build EPR matrix tuples and interpolate
        rate_key = "benign_rate" if msn_input.environment == "benign" else "hot_rate"
        epr_tuples: list[tuple[Decimal, Decimal]] = [
            (row["cycle_ratio"], row[rate_key]) for row in epr_rows
        ]
        epr_tuples.sort(key=lambda x: x[0])

        # Interpolate EPR rate for the target cycle_ratio
        epr_rate = interpolate_epr(epr_tuples, msn_input.cycle_ratio) if epr_tuples else Decimal("0")

        # Get crew config for this aircraft type
        crew_config_row = await crew_repo.get_current(aircraft["aircraft_type"])
        if not crew_config_row:
            raise HTTPException(
                status_code=500,
                detail=f"No crew config for {aircraft['aircraft_type']}",
            )

        crew_cfg = CrewConfig(
            aircraft_type=aircraft["aircraft_type"],
            pilot_salary_monthly=crew_config_row["pilot_salary_monthly"],
            senior_attendant_salary_monthly=crew_config_row["senior_attendant_salary_monthly"],
            regular_attendant_salary_monthly=crew_config_row["regular_attendant_salary_monthly"],
            per_diem_rate=crew_config_row["per_diem_rate"],
            accommodation_monthly_budget=crew_config_row["accommodation_monthly_budget"],
            training_total_budget=crew_config_row["training_total_budget"],
            uniform_total_budget=crew_config_row["uniform_total_budget"],
        )

        # Build aircraft costs dataclass with interpolated EPR rate
        ac = AircraftCosts(
            lease_rent_usd=aircraft.get("lease_rent_usd", Decimal("0")) or Decimal("0"),
            six_year_check_usd=aircraft.get("six_year_check_usd", Decimal("0")) or Decimal("0"),
            twelve_year_check_usd=aircraft.get("twelve_year_check_usd", Decimal("0")) or Decimal("0"),
            ldg_usd=aircraft.get("ldg_usd", Decimal("0")) or Decimal("0"),
            apu_rate_usd=aircraft.get("apu_rate_usd", Decimal("0")) or Decimal("0"),
            llp1_rate_usd=aircraft.get("llp1_rate_usd", Decimal("0")) or Decimal("0"),
            llp2_rate_usd=aircraft.get("llp2_rate_usd", Decimal("0")) or Decimal("0"),
            epr_rate=epr_rate,
        )

        breakdown = calculate_pricing(
            mgh=msn_input.mgh,
            cycle_ratio=msn_input.cycle_ratio,
            environment=msn_input.environment,
            exchange_rate=body.exchange_rate,
            margin_percent=body.margin_percent,
            aircraft_type=aircraft["aircraft_type"],
            lease_type=msn_input.lease_type,
            crew_sets=msn_input.crew_sets,
            aircraft_costs=ac,
            epr_matrix=epr_tuples,
            pricing_config=config,
            crew_config=crew_cfg,
        )

        monthly_cost = breakdown.total_cost_per_bh * msn_input.mgh
        monthly_revenue = breakdown.final_rate_per_bh * msn_input.mgh
        monthly_pnl = monthly_revenue - monthly_cost

        # Convert service ComponentBreakdown to Pydantic schema
        breakdown_schema = ComponentBreakdownSchema(
            aircraft_eur_per_bh=breakdown.aircraft_eur_per_bh,
            crew_eur_per_bh=breakdown.crew_eur_per_bh,
            maintenance_eur_per_bh=breakdown.maintenance_eur_per_bh,
            insurance_eur_per_bh=breakdown.insurance_eur_per_bh,
            doc_eur_per_bh=breakdown.doc_eur_per_bh,
            other_cogs_eur_per_bh=breakdown.other_cogs_eur_per_bh,
            overhead_eur_per_bh=breakdown.overhead_eur_per_bh,
            total_cost_per_bh=breakdown.total_cost_per_bh,
            revenue_per_bh=breakdown.revenue_per_bh,
            margin_percent=breakdown.margin_percent,
            final_rate_per_bh=breakdown.final_rate_per_bh,
        )

        msn_results.append(
            MsnPnlResult(
                msn=msn_input.msn,
                aircraft_type=aircraft["aircraft_type"],
                breakdown=breakdown_schema,
                monthly_cost=monthly_cost,
                monthly_revenue=monthly_revenue,
                monthly_pnl=monthly_pnl,
            )
        )

    # Aggregate total if multiple MSNs
    total = None
    if len(msn_results) > 1:
        agg_input = [
            {
                "mgh": next(
                    inp.mgh for inp in body.msn_inputs if inp.msn == r.msn
                ),
                "monthly_cost": r.monthly_cost,
                "monthly_revenue": r.monthly_revenue,
                "monthly_pnl": r.monthly_pnl,
            }
            for r in msn_results
        ]
        agg = calculate_project_pnl(agg_input)
        if agg:
            total = ComponentBreakdownSchema(
                aircraft_eur_per_bh=Decimal("0"),
                crew_eur_per_bh=Decimal("0"),
                maintenance_eur_per_bh=Decimal("0"),
                insurance_eur_per_bh=Decimal("0"),
                doc_eur_per_bh=Decimal("0"),
                other_cogs_eur_per_bh=Decimal("0"),
                overhead_eur_per_bh=Decimal("0"),
                total_cost_per_bh=agg.get("weighted_avg_cost_per_bh", Decimal("0")),
                revenue_per_bh=agg.get("weighted_avg_rate_per_bh", Decimal("0")),
                margin_percent=body.margin_percent,
                final_rate_per_bh=agg.get("weighted_avg_rate_per_bh", Decimal("0")),
            )

    response = CalculateResponse(msn_results=msn_results, total=total)
    # Server-side naked-cost gate: strip cost/profit/margin for users without
    # permission. Revenue and the EUR/BH sell rate are preserved.
    payload = response.model_dump()
    payload = redact_calculate_response(payload, user_can_view_costs(current_user))
    return CalculateResponse(**payload)
