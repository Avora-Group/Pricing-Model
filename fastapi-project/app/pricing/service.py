"""Pure Python pricing calculation engine for all 7 ACMI components.

All arithmetic uses decimal.Decimal -- never float. Functions are pure
(no I/O, no side effects): they receive pre-fetched data and return results.

Components:
  A (Aircraft):   Fixed (lease, 6Y, 12Y, LDG) + usage-scaled MR (EPR*2 & APU per FH, LLP per FC)
  C (Crew):       Fixed salaries + variable per diems, by aircraft type and lease type
  M (Maintenance):Fixed (line, base, personnel, c-check, training) + variable (spares, per diem)
  I (Insurance):  Fixed USD amount converted to EUR
  DOC:            Total budget / average active fleet / MGH
  Other COGS:     Monthly amount / MGH
  Overhead:       Total budget / average active fleet / MGH

All arithmetic uses Decimal. All internal functions prefixed with _ (private).
Module-level CREW_COMPOSITION dict maps (aircraft_type, lease_type) to crew counts.

Exports:
  - calculate_pricing: Orchestrates all 7 components + margin calculation
  - calculate_project_pnl: Aggregates multiple MSN results into project totals
  - calculate_fixed_cost_coverage: Fixed-cost coverage for summer-covers-winter deals
  - interpolate_epr: EPR matrix interpolation with boundary clamping
  - AircraftCosts, PricingConfig, CrewConfig: Dataclasses for structured inputs
  - FixedCostCoverage: Per-category coverage cost result
  - CREW_COMPOSITION: Crew count lookup table
"""
from __future__ import annotations

import bisect
from dataclasses import dataclass
from decimal import Decimal


# ---------------------------------------------------------------------------
# Data Classes (internal calculation types -- not Pydantic)
# ---------------------------------------------------------------------------


@dataclass
class AircraftCosts:
    """Aircraft cost data fetched from DB (Phase 2 aircraft_rates table).

    Units:
      - lease_rent_usd, six_year_check_usd, twelve_year_check_usd, ldg_usd:
        fixed USD per month (landing gear is a fixed MR charge).
      - epr_rate: interpolated per-engine USD per flight hour (FH).
      - llp1_rate_usd / llp2_rate_usd: USD per flight cycle (FC), one rate per
        engine.
      - apu_rate_usd: USD per flight hour (FH).

    Allowance mode (e.g. MSN 5228): when included_fh / included_fc are set, the
    fixed MR (held in six_year_check_usd) already covers all variable MRs up to
    that many FH / FC per month. Only the excess is charged: excess FH at
    supp_epr_rate per engine, excess FC at supp_llp_per_fc_usd per engine. The
    normal EPR / LLP / APU usage rates are not applied in this mode.
    """
    lease_rent_usd: Decimal
    six_year_check_usd: Decimal
    twelve_year_check_usd: Decimal
    ldg_usd: Decimal
    apu_rate_usd: Decimal
    llp1_rate_usd: Decimal
    llp2_rate_usd: Decimal
    epr_rate: Decimal  # Already interpolated per-engine rate (USD per FH)
    included_fh: Decimal | None = None
    included_fc: Decimal | None = None
    supp_epr_rate: Decimal = Decimal("0")  # Interpolated supplemental USD per excess FH, per engine
    supp_llp_per_fc_usd: Decimal = Decimal("0")  # USD per excess FC, per engine


@dataclass
class PricingConfig:
    """Pricing configuration from the pricing_config table.

    Contains exchange rate, insurance, maintenance, DOC, overhead,
    and other COGS parameters.
    """
    exchange_rate: Decimal
    insurance_usd: Decimal
    doc_total_budget: Decimal
    overhead_total_budget: Decimal
    other_cogs_monthly: Decimal
    line_maintenance_monthly: Decimal
    base_maintenance_monthly: Decimal
    personnel_salary_monthly: Decimal
    c_check_monthly: Decimal
    maintenance_training_monthly: Decimal
    spare_parts_rate: Decimal
    maintenance_per_diem: Decimal
    average_active_fleet: Decimal


@dataclass
class CrewConfig:
    """Crew configuration from the crew_config table.

    Per aircraft_type (A320 vs A321) to handle different cabin crew compositions.
    """
    aircraft_type: str
    pilot_salary_monthly: Decimal
    senior_attendant_salary_monthly: Decimal
    regular_attendant_salary_monthly: Decimal
    per_diem_rate: Decimal
    accommodation_monthly_budget: Decimal
    training_total_budget: Decimal
    uniform_total_budget: Decimal


# ---------------------------------------------------------------------------
# Component Breakdown Result
# ---------------------------------------------------------------------------


@dataclass
class ComponentBreakdown:
    """Per-BH cost breakdown for all 7 ACMI components (EUR).

    This is the internal calculation result. The router layer converts
    this to the Pydantic schema for API responses.
    """
    aircraft_eur_per_bh: Decimal
    crew_eur_per_bh: Decimal
    maintenance_eur_per_bh: Decimal
    insurance_eur_per_bh: Decimal
    doc_eur_per_bh: Decimal
    other_cogs_eur_per_bh: Decimal
    overhead_eur_per_bh: Decimal
    total_cost_per_bh: Decimal
    revenue_per_bh: Decimal
    margin_percent: Decimal
    final_rate_per_bh: Decimal


@dataclass
class FixedCostCoverage:
    """Fixed-cost coverage amounts per category (absolute EUR over the coverage period).

    Coverage = coverage% x monthly fixed cost x coverage months, per category.
    Used for summer-covers-winter deals where the client covers a share of the
    fixed cost base for months outside the flying period. It is a term-level
    cost add-on: it does not alter per-BH rates or the final billing rate.
    """
    aircraft: Decimal
    crew: Decimal
    maintenance: Decimal
    insurance: Decimal
    doc: Decimal
    overhead: Decimal
    total: Decimal


# ---------------------------------------------------------------------------
# Crew Composition Lookup
# Source: Excel C sheet -- crew count by aircraft type and lease type
# ---------------------------------------------------------------------------

CREW_COMPOSITION: dict[tuple[str, str], dict[str, int]] = {
    # A320: 2 pilots, 1 senior, 3 regular cabin attendants (wet)
    ("A320", "wet"):   {"pilots": 2, "senior": 1, "regular": 3},
    ("A320", "damp"):  {"pilots": 2, "senior": 0, "regular": 0},
    ("A320", "moist"): {"pilots": 2, "senior": 1, "regular": 0},
    # A321: 2 pilots, 1 senior, 4 regular cabin attendants (wet)
    ("A321", "wet"):   {"pilots": 2, "senior": 1, "regular": 4},
    ("A321", "damp"):  {"pilots": 2, "senior": 0, "regular": 0},
    ("A321", "moist"): {"pilots": 2, "senior": 1, "regular": 0},
}


# ---------------------------------------------------------------------------
# EPR Interpolation
# Source: EPR matrix rows table (cycle_ratio -> rate)
# ---------------------------------------------------------------------------


def interpolate_epr(
    matrix: list[tuple[Decimal, Decimal]],
    target_cr: Decimal,
) -> Decimal:
    """Interpolate EPR rate from matrix for a given cycle ratio.

    Uses bisect for O(log n) lookup. Handles:
    - Exact match: return that row's rate
    - Between two rows: linear interpolation
    - Below minimum: clamp to first row's rate
    - Above maximum: clamp to last row's rate
    - Empty matrix: raise ValueError

    Args:
        matrix: List of (cycle_ratio, rate) tuples, sorted by cycle_ratio.
        target_cr: The target cycle ratio to look up.

    Returns:
        Interpolated EPR rate as Decimal.

    Raises:
        ValueError: If matrix is empty.
    """
    if not matrix:
        raise ValueError("EPR matrix is empty -- cannot interpolate")

    # Extract cycle ratios for bisect
    crs = [row[0] for row in matrix]

    # Single row: always return it
    if len(matrix) == 1:
        return matrix[0][1]

    # Clamp to boundaries
    if target_cr <= crs[0]:
        return matrix[0][1]
    if target_cr >= crs[-1]:
        return matrix[-1][1]

    # Find insertion point
    idx = bisect.bisect_left(crs, target_cr)

    # Exact match
    if idx < len(crs) and crs[idx] == target_cr:
        return matrix[idx][1]

    # Linear interpolation between matrix[idx-1] and matrix[idx]
    cr_low, rate_low = matrix[idx - 1]
    cr_high, rate_high = matrix[idx]
    fraction = (target_cr - cr_low) / (cr_high - cr_low)
    return rate_low + (rate_high - rate_low) * fraction


# ---------------------------------------------------------------------------
# Component Calculators
# ---------------------------------------------------------------------------


def _aircraft_variable_usd(
    aircraft_costs: AircraftCosts,
    fh: Decimal,
    fc: Decimal,
) -> Decimal:
    """Monthly variable MR (USD) for the given monthly FH and FC.

    Usage mode: EPR (x2 engines) and APU scale with FH; LLP1 + LLP2 (one rate
    per engine) scale with FC.
    Allowance mode: only the excess over the included FH / FC is charged, at
    the supplemental per-engine rates.
    """
    two = Decimal("2")
    if aircraft_costs.included_fh is not None or aircraft_costs.included_fc is not None:
        excess_fh = max(fh - (aircraft_costs.included_fh or Decimal("0")), Decimal("0"))
        excess_fc = max(fc - (aircraft_costs.included_fc or Decimal("0")), Decimal("0"))
        return (
            aircraft_costs.supp_epr_rate * two * excess_fh
            + aircraft_costs.supp_llp_per_fc_usd * two * excess_fc
        )
    return (
        aircraft_costs.epr_rate * two * fh
        + aircraft_costs.apu_rate_usd * fh
        + (aircraft_costs.llp1_rate_usd + aircraft_costs.llp2_rate_usd) * fc
    )


def _calc_aircraft(
    aircraft_costs: AircraftCosts,
    exchange_rate: Decimal,
    mgh: Decimal,
    cycle_ratio: Decimal,
) -> Decimal:
    """Calculate Aircraft (A) component: EUR per block hour.

    Fixed (monthly USD): lease rent + 6Y check + 12Y check + landing gear.
    Variable (scales with usage): EPR (per engine, x2) and APU per FH; LLP1 +
    LLP2 per FC. Monthly FH = MGH; monthly FC = MGH / cycle_ratio (the cycle
    ratio is FH:FC). See AircraftCosts for allowance-mode aircraft.

    Result = (fixed + variable) USD * exchange_rate / MGH.
    """
    fh = mgh
    fc = mgh / cycle_ratio if cycle_ratio > Decimal("0") else Decimal("0")
    fixed_usd = (
        aircraft_costs.lease_rent_usd
        + aircraft_costs.six_year_check_usd
        + aircraft_costs.twelve_year_check_usd
        + aircraft_costs.ldg_usd
    )
    total_usd = fixed_usd + _aircraft_variable_usd(aircraft_costs, fh, fc)
    return total_usd * exchange_rate / mgh


def _crew_fixed_monthly(
    aircraft_type: str,
    lease_type: str,
    crew_sets: float,
    crew_config: CrewConfig,
    average_active_fleet: Decimal,
) -> Decimal:
    """Monthly fixed crew cost (EUR): salaries * crew_sets + training + uniform per AC."""
    comp = CREW_COMPOSITION[(aircraft_type, lease_type)]
    crew_sets_d = Decimal(str(crew_sets))

    salary_cost = (
        crew_config.pilot_salary_monthly * Decimal(str(comp["pilots"]))
        + crew_config.senior_attendant_salary_monthly * Decimal(str(comp["senior"]))
        + crew_config.regular_attendant_salary_monthly * Decimal(str(comp["regular"]))
    ) * crew_sets_d

    training_per_ac = crew_config.training_total_budget / average_active_fleet
    uniform_per_ac = crew_config.uniform_total_budget / average_active_fleet
    return salary_cost + training_per_ac + uniform_per_ac


def _calc_crew(
    aircraft_type: str,
    lease_type: str,
    crew_sets: float,
    crew_config: CrewConfig,
    mgh: Decimal,
    average_active_fleet: Decimal,
) -> Decimal:
    """Calculate Crew (C) component: EUR per block hour.

    Source: C sheet in Excel workbook.
    Formula:
      Fixed = (pilot_salary * pilots + senior_salary * senior + regular_salary * regular)
              * crew_sets + training_budget / fleet + uniform_budget / fleet
      Variable = per_diem_rate * total_crew_count * crew_sets + accommodation_budget / fleet
      Result = (Fixed + Variable) / MGH
    """
    comp = CREW_COMPOSITION[(aircraft_type, lease_type)]
    total_crew = comp["pilots"] + comp["senior"] + comp["regular"]
    crew_sets_d = Decimal(str(crew_sets))

    fixed = _crew_fixed_monthly(
        aircraft_type, lease_type, crew_sets, crew_config, average_active_fleet
    )

    # Variable costs
    per_diem_cost = crew_config.per_diem_rate * Decimal(str(total_crew)) * crew_sets_d
    accommodation_per_ac = crew_config.accommodation_monthly_budget / average_active_fleet
    variable = per_diem_cost + accommodation_per_ac

    return (fixed + variable) / mgh


def _maintenance_fixed_monthly(config: PricingConfig) -> Decimal:
    """Monthly fixed maintenance cost (EUR): line + base + personnel + c_check + training."""
    return (
        config.line_maintenance_monthly
        + config.base_maintenance_monthly
        + config.personnel_salary_monthly
        + config.c_check_monthly
        + config.maintenance_training_monthly
    )


def _calc_maintenance(
    mgh: Decimal,
    config: PricingConfig,
) -> Decimal:
    """Calculate Maintenance (M) component: EUR per block hour.

    Source: M/I/Overhead & Other COGS sheet.
    Formula:
      Fixed = line + base + personnel + c_check + training (all monthly)
      Variable = spare_parts_rate * MGH + maintenance_per_diem
      Result = (Fixed + Variable) / MGH
    """
    fixed = _maintenance_fixed_monthly(config)
    variable = config.spare_parts_rate * mgh + config.maintenance_per_diem
    return (fixed + variable) / mgh


def _calc_insurance(
    config: PricingConfig,
    exchange_rate: Decimal,
    mgh: Decimal,
) -> Decimal:
    """Calculate Insurance (I) component: EUR per block hour.

    Source: M/I/Overhead & Other COGS sheet.
    Formula: insurance_usd * exchange_rate / MGH
    """
    return config.insurance_usd * exchange_rate / mgh


def _calc_doc(
    config: PricingConfig,
    mgh: Decimal,
) -> Decimal:
    """Calculate DOC (Direct Operating Costs) component: EUR per block hour.

    Source: M/I/Overhead & Other COGS sheet.
    Formula: doc_total_budget / average_active_fleet / MGH
    """
    return config.doc_total_budget / config.average_active_fleet / mgh


def _calc_other_cogs(
    config: PricingConfig,
    mgh: Decimal,
) -> Decimal:
    """Calculate Other COGS component: EUR per block hour.

    Source: M/I/Overhead & Other COGS sheet.
    Formula: other_cogs_monthly / MGH
    """
    return config.other_cogs_monthly / mgh


def _calc_overhead(
    config: PricingConfig,
    mgh: Decimal,
) -> Decimal:
    """Calculate Overhead component: EUR per block hour.

    Source: M/I/Overhead & Other COGS sheet.
    Formula: overhead_total_budget / average_active_fleet / MGH
    """
    return config.overhead_total_budget / config.average_active_fleet / mgh


# ---------------------------------------------------------------------------
# Main Calculation Orchestrator
# ---------------------------------------------------------------------------


def calculate_pricing(
    mgh: Decimal,
    cycle_ratio: Decimal,
    environment: str,
    lease_type: str,
    crew_sets: int,
    aircraft_type: str,
    aircraft_costs: AircraftCosts,
    epr_matrix: list[tuple[Decimal, Decimal]],
    pricing_config: PricingConfig,
    crew_config: CrewConfig,
    margin_percent: Decimal,
    exchange_rate: Decimal,
) -> ComponentBreakdown:
    """Orchestrate all 7 component calculations + margin for a single MSN.

    This is the primary entry point for the pricing engine. It takes all
    required inputs and returns a full ComponentBreakdown with per-BH costs,
    total cost, margin, and final billing rate.

    Args:
        mgh: Monthly Guaranteed Hours (block hours per month).
        cycle_ratio: Flight cycles per flight hour.
        environment: "benign" or "hot" -- selects EPR rate column.
        lease_type: "wet", "damp", or "moist" -- affects crew composition.
        crew_sets: Number of crew sets (typically 4-5).
        aircraft_type: "A320" or "A321" -- affects crew composition.
        aircraft_costs: Pre-fetched aircraft rate data from DB.
                        The epr_rate field should already be the interpolated
                        rate for the target cycle_ratio and environment.
        epr_matrix: EPR matrix rows as (cycle_ratio, rate) tuples.
                    The rate should already be selected for the correct environment.
        pricing_config: Current pricing config from DB.
        crew_config: Current crew config for the aircraft type from DB.
        margin_percent: Target profit margin as percentage (e.g., 10 for 10%).
        exchange_rate: USD/EUR exchange rate.

    Returns:
        ComponentBreakdown with all 7 per-BH costs, total, margin, and final rate.
    """
    # Calculate all 7 components
    aircraft = _calc_aircraft(aircraft_costs, exchange_rate, mgh, cycle_ratio)
    crew = _calc_crew(
        aircraft_type, lease_type, crew_sets, crew_config, mgh,
        pricing_config.average_active_fleet,
    )
    maintenance = _calc_maintenance(mgh, pricing_config)
    insurance = _calc_insurance(pricing_config, exchange_rate, mgh)
    doc = _calc_doc(pricing_config, mgh)
    other_cogs = _calc_other_cogs(pricing_config, mgh)
    overhead = _calc_overhead(pricing_config, mgh)

    # Total cost per block hour
    total_cost = aircraft + crew + maintenance + insurance + doc + other_cogs + overhead

    # Margin and final rate
    # Formula: final_rate = total_cost / (1 - margin_percent / 100)
    # When margin is 0, final_rate = total_cost
    if margin_percent > Decimal("0"):
        margin_fraction = margin_percent / Decimal("100")
        final_rate = total_cost / (Decimal("1") - margin_fraction)
    else:
        final_rate = total_cost

    # Revenue per BH = final billing rate
    revenue = final_rate

    return ComponentBreakdown(
        aircraft_eur_per_bh=aircraft,
        crew_eur_per_bh=crew,
        maintenance_eur_per_bh=maintenance,
        insurance_eur_per_bh=insurance,
        doc_eur_per_bh=doc,
        other_cogs_eur_per_bh=other_cogs,
        overhead_eur_per_bh=overhead,
        total_cost_per_bh=total_cost,
        revenue_per_bh=revenue,
        margin_percent=margin_percent,
        final_rate_per_bh=final_rate,
    )


# ---------------------------------------------------------------------------
# Fixed Cost Coverage
# ---------------------------------------------------------------------------


def calculate_fixed_cost_coverage(
    coverage_percent: Decimal,
    coverage_months: Decimal,
    aircraft_type: str,
    lease_type: str,
    crew_sets: float,
    aircraft_costs: AircraftCosts,
    pricing_config: PricingConfig,
    crew_config: CrewConfig,
    exchange_rate: Decimal,
) -> FixedCostCoverage:
    """Calculate fixed-cost coverage for a single MSN.

    coverage_cat = monthly_fixed_cat x (coverage_percent / 100) x coverage_months

    The monthly fixed cost per category mirrors each component's fixed share:
      Aircraft:    lease rent + 6Y/12Y checks + LDG (usage reserves are variable)
      Crew:        salaries x crew_sets + training/fleet + uniform/fleet
      Maintenance: line + base + personnel + c_check + training
      Insurance:   insurance_usd x exchange_rate
      DOC:         doc_total_budget / average_active_fleet
      Overhead:    overhead_total_budget / average_active_fleet
    """
    factor = (coverage_percent / Decimal("100")) * coverage_months

    aircraft_fixed = (
        aircraft_costs.lease_rent_usd
        + aircraft_costs.six_year_check_usd
        + aircraft_costs.twelve_year_check_usd
        + aircraft_costs.ldg_usd
    ) * exchange_rate
    crew_fixed = _crew_fixed_monthly(
        aircraft_type, lease_type, crew_sets, crew_config,
        pricing_config.average_active_fleet,
    )
    maintenance_fixed = _maintenance_fixed_monthly(pricing_config)
    insurance_fixed = pricing_config.insurance_usd * exchange_rate
    doc_fixed = pricing_config.doc_total_budget / pricing_config.average_active_fleet
    overhead_fixed = (
        pricing_config.overhead_total_budget / pricing_config.average_active_fleet
    )

    aircraft = aircraft_fixed * factor
    crew = crew_fixed * factor
    maintenance = maintenance_fixed * factor
    insurance = insurance_fixed * factor
    doc = doc_fixed * factor
    overhead = overhead_fixed * factor

    return FixedCostCoverage(
        aircraft=aircraft,
        crew=crew,
        maintenance=maintenance,
        insurance=insurance,
        doc=doc,
        overhead=overhead,
        total=aircraft + crew + maintenance + insurance + doc + overhead,
    )


# ---------------------------------------------------------------------------
# Multi-MSN Project Aggregation
# ---------------------------------------------------------------------------


def calculate_project_pnl(msn_results: list[dict]) -> dict:
    """Aggregate multiple MSN P&L results into project totals.

    Takes a list of per-MSN result dicts and computes:
    - Total monthly cost, revenue, and P&L across all MSNs
    - Weighted average per-BH rates (weighted by MGH)

    Args:
        msn_results: List of dicts, each containing:
            - mgh: Decimal (monthly guaranteed hours)
            - total_cost_per_bh: Decimal
            - final_rate_per_bh: Decimal
            - monthly_cost: Decimal
            - monthly_revenue: Decimal
            - monthly_pnl: Decimal

    Returns:
        Dict with aggregated totals and weighted averages.
    """
    total_monthly_cost = sum(r["monthly_cost"] for r in msn_results)
    total_monthly_revenue = sum(r["monthly_revenue"] for r in msn_results)
    total_monthly_pnl = total_monthly_revenue - total_monthly_cost
    total_mgh = sum(r["mgh"] for r in msn_results)

    weighted_avg_cost = total_monthly_cost / total_mgh if total_mgh else Decimal("0")
    weighted_avg_rate = total_monthly_revenue / total_mgh if total_mgh else Decimal("0")

    return {
        "total_monthly_cost": total_monthly_cost,
        "total_monthly_revenue": total_monthly_revenue,
        "total_monthly_pnl": total_monthly_pnl,
        "total_mgh": total_mgh,
        "weighted_avg_cost_per_bh": weighted_avg_cost,
        "weighted_avg_rate_per_bh": weighted_avg_rate,
    }
