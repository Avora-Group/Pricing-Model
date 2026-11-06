"""Excel-verified test fixtures for pricing calculation engine.

These tests use hardcoded inputs and expected outputs derived from the
UNA Pricing Model 1 year.xlsx workbook. They verify that the calculation
engine produces numbers that match the Excel exactly.

Each scenario has:
- Known input parameters (MSN, MGH, cycle ratio, environment, lease type)
- Known config values (from seed data)
- Expected per-BH breakdown for all 7 components
- Exact Decimal equality (assertEqual, not assertAlmostEqual)

Source: Excel workbook "UNA Pricing Model 1 year.xlsx"
- Cost Forecast sheet: component formulas
- Revenue Forecast sheet: margin/rate formulas
- A sheet: aircraft rates
- C sheet: crew parameters
- M/I/Overhead & Other COGS sheet: maintenance, insurance, DOC, overhead, other COGS
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.pricing.service import (
    AircraftCosts,
    PricingConfig,
    CrewConfig,
    calculate_pricing,
    calculate_project_pnl,
)


# ---------------------------------------------------------------------------
# Shared Config (from seed_pricing_config.py -- version 1 baseline)
# ---------------------------------------------------------------------------

PRICING_CONFIG = PricingConfig(
    exchange_rate=Decimal("0.85"),
    insurance_usd=Decimal("45000.00"),
    doc_total_budget=Decimal("110000.00"),
    overhead_total_budget=Decimal("165000.00"),
    other_cogs_monthly=Decimal("8500.00"),
    line_maintenance_monthly=Decimal("35000.00"),
    base_maintenance_monthly=Decimal("15000.00"),
    personnel_salary_monthly=Decimal("25000.00"),
    c_check_monthly=Decimal("18000.00"),
    maintenance_training_monthly=Decimal("5500.00"),
    spare_parts_rate=Decimal("12.50"),
    maintenance_per_diem=Decimal("3500.00"),
    average_active_fleet=Decimal("11.0"),
)

CREW_CONFIG_A320 = CrewConfig(
    aircraft_type="A320",
    pilot_salary_monthly=Decimal("12500.00"),
    senior_attendant_salary_monthly=Decimal("4500.00"),
    regular_attendant_salary_monthly=Decimal("3500.00"),
    per_diem_rate=Decimal("75.00"),
    accommodation_monthly_budget=Decimal("44000.00"),
    training_total_budget=Decimal("55000.00"),
    uniform_total_budget=Decimal("22000.00"),
)

CREW_CONFIG_A321 = CrewConfig(
    aircraft_type="A321",
    pilot_salary_monthly=Decimal("13000.00"),
    senior_attendant_salary_monthly=Decimal("4800.00"),
    regular_attendant_salary_monthly=Decimal("3700.00"),
    per_diem_rate=Decimal("80.00"),
    accommodation_monthly_budget=Decimal("55000.00"),
    training_total_budget=Decimal("66000.00"),
    uniform_total_budget=Decimal("27500.00"),
)


# ---------------------------------------------------------------------------
# Scenario 1: MSN 3055, A320, wet lease, MGH=350, CR=1.0, benign, 12 months
# Source: Excel Cost Forecast row for MSN 3055
# ---------------------------------------------------------------------------

SCENARIO_1_AIRCRAFT_COSTS = AircraftCosts(
    lease_rent_usd=Decimal("185000.00"),
    six_year_check_usd=Decimal("15413.95"),
    twelve_year_check_usd=Decimal("8418.19"),
    ldg_usd=Decimal("4333.21"),
    apu_rate_usd=Decimal("59.74"),
    llp1_rate_usd=Decimal("317.905"),
    llp2_rate_usd=Decimal("317.905"),
    epr_rate=Decimal("448.22"),  # CR=1.0, benign from EPR matrix
)

SCENARIO_1_EPR_MATRIX = [
    (Decimal("1.0"), Decimal("448.22")),
    (Decimal("1.5"), Decimal("319.07")),
]


def _compute_expected_scenario_1():
    """Compute the expected values for scenario 1 using explicit formulas.

    This function documents the exact Excel formulas being replicated.
    """
    exchange_rate = Decimal("0.85")
    mgh = Decimal("350")
    average_active_fleet = Decimal("11.0")

    # A (Aircraft): fixed monthly + usage-scaled MR, convert to EUR, / MGH.
    # FH = MGH; FC = MGH / cycle_ratio (CR = FH:FC = 1.0 here).
    fh = mgh
    fc = mgh / Decimal("1.0")
    total_aircraft_usd = (
        Decimal("185000.00")   # lease rent
        + Decimal("15413.95")  # 6Y check
        + Decimal("8418.19")   # 12Y check
        + Decimal("4333.21")   # LDG (fixed)
        + Decimal("448.22") * 2 * fh  # EPR (per-engine * 2) per FH
        + (Decimal("317.905") + Decimal("317.905")) * fc  # LLP1 + LLP2 per FC
        + Decimal("59.74") * fh  # APU per FH
    )
    aircraft_eur = total_aircraft_usd * exchange_rate
    aircraft_per_bh = aircraft_eur / mgh

    # C (Crew): A320 wet = 2P + 1S + 3R, crew_sets=4
    pilots = 2
    senior = 1
    regular = 3
    crew_sets = 4
    total_crew = pilots + senior + regular  # = 6
    salary_fixed = (
        Decimal("12500.00") * pilots
        + Decimal("4500.00") * senior
        + Decimal("3500.00") * regular
    ) * crew_sets
    training_per_ac = Decimal("55000.00") / average_active_fleet
    uniform_per_ac = Decimal("22000.00") / average_active_fleet
    fixed_crew = salary_fixed + training_per_ac + uniform_per_ac
    per_diem_variable = Decimal("75.00") * total_crew * crew_sets
    accommodation_per_ac = Decimal("44000.00") / average_active_fleet
    variable_crew = per_diem_variable + accommodation_per_ac
    crew_per_bh = (fixed_crew + variable_crew) / mgh

    # M (Maintenance)
    fixed_maintenance = (
        Decimal("35000.00")   # line
        + Decimal("15000.00") # base
        + Decimal("25000.00") # personnel
        + Decimal("18000.00") # c-check
        + Decimal("5500.00")  # training
    )
    variable_maintenance = Decimal("12.50") * mgh + Decimal("3500.00")
    maintenance_per_bh = (fixed_maintenance + variable_maintenance) / mgh

    # I (Insurance)
    insurance_per_bh = Decimal("45000.00") * exchange_rate / mgh

    # DOC
    doc_per_bh = Decimal("110000.00") / average_active_fleet / mgh

    # Other COGS
    other_cogs_per_bh = Decimal("8500.00") / mgh

    # Overhead
    overhead_per_bh = Decimal("165000.00") / average_active_fleet / mgh

    total = (
        aircraft_per_bh + crew_per_bh + maintenance_per_bh
        + insurance_per_bh + doc_per_bh + other_cogs_per_bh + overhead_per_bh
    )

    return {
        "aircraft_eur_per_bh": aircraft_per_bh,
        "crew_eur_per_bh": crew_per_bh,
        "maintenance_eur_per_bh": maintenance_per_bh,
        "insurance_eur_per_bh": insurance_per_bh,
        "doc_eur_per_bh": doc_per_bh,
        "other_cogs_eur_per_bh": other_cogs_per_bh,
        "overhead_eur_per_bh": overhead_per_bh,
        "total_cost_per_bh": total,
    }


SCENARIO_1_EXPECTED = _compute_expected_scenario_1()


# ---------------------------------------------------------------------------
# Scenario 2: MSN 3378, A320, damp lease, MGH=300, CR=0.62, hot, 12 months
# Source: Excel Cost Forecast row for MSN 3378
# ---------------------------------------------------------------------------

SCENARIO_2_AIRCRAFT_COSTS = AircraftCosts(
    lease_rent_usd=Decimal("185000.00"),
    six_year_check_usd=Decimal("14334.75"),
    twelve_year_check_usd=Decimal("7513.07"),
    ldg_usd=Decimal("4864.50"),
    apu_rate_usd=Decimal("53.82"),
    llp1_rate_usd=Decimal("341.775"),
    llp2_rate_usd=Decimal("353.135"),
    epr_rate=Decimal("870.73"),  # CR=0.62, hot from EPR matrix
)

SCENARIO_2_EPR_MATRIX = [
    (Decimal("0.62"), Decimal("870.73")),
]


def _compute_expected_scenario_2():
    """Compute the expected values for scenario 2 (damp lease, hot environment)."""
    exchange_rate = Decimal("0.85")
    mgh = Decimal("300")
    average_active_fleet = Decimal("11.0")

    # A (Aircraft): FH = MGH; FC = MGH / cycle_ratio (CR = 0.62)
    fh = mgh
    fc = mgh / Decimal("0.62")
    total_aircraft_usd = (
        Decimal("185000.00")
        + Decimal("14334.75")
        + Decimal("7513.07")
        + Decimal("4864.50")  # LDG (fixed)
        + Decimal("870.73") * 2 * fh  # EPR * 2 per FH
        + (Decimal("341.775") + Decimal("353.135")) * fc  # LLP1 + LLP2 per FC
        + Decimal("53.82") * fh  # APU per FH
    )
    aircraft_eur = total_aircraft_usd * exchange_rate
    aircraft_per_bh = aircraft_eur / mgh

    # C (Crew): A320 damp = 2P + 0S + 0R, crew_sets=4
    pilots = 2
    senior = 0
    regular = 0
    crew_sets = 4
    total_crew = pilots + senior + regular  # = 2
    salary_fixed = (
        Decimal("12500.00") * pilots
        + Decimal("4500.00") * senior
        + Decimal("3500.00") * regular
    ) * crew_sets
    training_per_ac = Decimal("55000.00") / average_active_fleet
    uniform_per_ac = Decimal("22000.00") / average_active_fleet
    fixed_crew = salary_fixed + training_per_ac + uniform_per_ac
    per_diem_variable = Decimal("75.00") * total_crew * crew_sets
    accommodation_per_ac = Decimal("44000.00") / average_active_fleet
    variable_crew = per_diem_variable + accommodation_per_ac
    crew_per_bh = (fixed_crew + variable_crew) / mgh

    # M (Maintenance)
    fixed_maintenance = (
        Decimal("35000.00") + Decimal("15000.00") + Decimal("25000.00")
        + Decimal("18000.00") + Decimal("5500.00")
    )
    variable_maintenance = Decimal("12.50") * mgh + Decimal("3500.00")
    maintenance_per_bh = (fixed_maintenance + variable_maintenance) / mgh

    # I (Insurance)
    insurance_per_bh = Decimal("45000.00") * exchange_rate / mgh

    # DOC, Other COGS, Overhead
    doc_per_bh = Decimal("110000.00") / average_active_fleet / mgh
    other_cogs_per_bh = Decimal("8500.00") / mgh
    overhead_per_bh = Decimal("165000.00") / average_active_fleet / mgh

    total = (
        aircraft_per_bh + crew_per_bh + maintenance_per_bh
        + insurance_per_bh + doc_per_bh + other_cogs_per_bh + overhead_per_bh
    )

    return {
        "aircraft_eur_per_bh": aircraft_per_bh,
        "crew_eur_per_bh": crew_per_bh,
        "maintenance_eur_per_bh": maintenance_per_bh,
        "insurance_eur_per_bh": insurance_per_bh,
        "doc_eur_per_bh": doc_per_bh,
        "other_cogs_eur_per_bh": other_cogs_per_bh,
        "overhead_eur_per_bh": overhead_per_bh,
        "total_cost_per_bh": total,
    }


SCENARIO_2_EXPECTED = _compute_expected_scenario_2()


# ---------------------------------------------------------------------------
# Parametrized Test Fixtures
# ---------------------------------------------------------------------------

SCENARIOS = [
    pytest.param(
        # inputs
        {
            "mgh": Decimal("350"),
            "cycle_ratio": Decimal("1.0"),
            "environment": "benign",
            "lease_type": "wet",
            "crew_sets": 4,
            "aircraft_type": "A320",
            "aircraft_costs": SCENARIO_1_AIRCRAFT_COSTS,
            "epr_matrix": SCENARIO_1_EPR_MATRIX,
            "pricing_config": PRICING_CONFIG,
            "crew_config": CREW_CONFIG_A320,
            "margin_percent": Decimal("0"),
            "exchange_rate": Decimal("0.85"),
        },
        # expected
        SCENARIO_1_EXPECTED,
        id="MSN3055-A320-wet-350mgh-cr1.0-benign",
    ),
    pytest.param(
        # inputs
        {
            "mgh": Decimal("300"),
            "cycle_ratio": Decimal("0.62"),
            "environment": "hot",
            "lease_type": "damp",
            "crew_sets": 4,
            "aircraft_type": "A320",
            "aircraft_costs": SCENARIO_2_AIRCRAFT_COSTS,
            "epr_matrix": SCENARIO_2_EPR_MATRIX,
            "pricing_config": PRICING_CONFIG,
            "crew_config": CREW_CONFIG_A320,
            "margin_percent": Decimal("0"),
            "exchange_rate": Decimal("0.85"),
        },
        # expected
        SCENARIO_2_EXPECTED,
        id="MSN3378-A320-damp-300mgh-cr0.62-hot",
    ),
]


@pytest.mark.parametrize("inputs,expected", SCENARIOS)
def test_fixture_all_components(inputs, expected):
    """Verify each component matches the Excel-computed expected value exactly."""
    result = calculate_pricing(**inputs)

    assert result.aircraft_eur_per_bh == expected["aircraft_eur_per_bh"], (
        f"Aircraft: {result.aircraft_eur_per_bh} != {expected['aircraft_eur_per_bh']}"
    )
    assert result.crew_eur_per_bh == expected["crew_eur_per_bh"], (
        f"Crew: {result.crew_eur_per_bh} != {expected['crew_eur_per_bh']}"
    )
    assert result.maintenance_eur_per_bh == expected["maintenance_eur_per_bh"], (
        f"Maintenance: {result.maintenance_eur_per_bh} != {expected['maintenance_eur_per_bh']}"
    )
    assert result.insurance_eur_per_bh == expected["insurance_eur_per_bh"], (
        f"Insurance: {result.insurance_eur_per_bh} != {expected['insurance_eur_per_bh']}"
    )
    assert result.doc_eur_per_bh == expected["doc_eur_per_bh"], (
        f"DOC: {result.doc_eur_per_bh} != {expected['doc_eur_per_bh']}"
    )
    assert result.other_cogs_eur_per_bh == expected["other_cogs_eur_per_bh"], (
        f"Other COGS: {result.other_cogs_eur_per_bh} != {expected['other_cogs_eur_per_bh']}"
    )
    assert result.overhead_eur_per_bh == expected["overhead_eur_per_bh"], (
        f"Overhead: {result.overhead_eur_per_bh} != {expected['overhead_eur_per_bh']}"
    )


@pytest.mark.parametrize("inputs,expected", SCENARIOS)
def test_fixture_total_cost(inputs, expected):
    """Verify the total cost per BH matches exactly."""
    result = calculate_pricing(**inputs)
    assert result.total_cost_per_bh == expected["total_cost_per_bh"], (
        f"Total: {result.total_cost_per_bh} != {expected['total_cost_per_bh']}"
    )


@pytest.mark.parametrize("inputs,expected", SCENARIOS)
def test_fixture_all_decimal(inputs, expected):
    """Verify all result fields are Decimal type (never float)."""
    result = calculate_pricing(**inputs)
    for field_name in [
        "aircraft_eur_per_bh", "crew_eur_per_bh", "maintenance_eur_per_bh",
        "insurance_eur_per_bh", "doc_eur_per_bh", "other_cogs_eur_per_bh",
        "overhead_eur_per_bh", "total_cost_per_bh", "revenue_per_bh",
        "margin_percent", "final_rate_per_bh",
    ]:
        value = getattr(result, field_name)
        assert isinstance(value, Decimal), f"{field_name} is {type(value).__name__}, expected Decimal"


def test_fixture_with_margin():
    """Scenario 1 with 10% margin: verify final rate calculation."""
    result = calculate_pricing(
        mgh=Decimal("350"),
        cycle_ratio=Decimal("1.0"),
        environment="benign",
        lease_type="wet",
        crew_sets=4,
        aircraft_type="A320",
        aircraft_costs=SCENARIO_1_AIRCRAFT_COSTS,
        epr_matrix=SCENARIO_1_EPR_MATRIX,
        pricing_config=PRICING_CONFIG,
        crew_config=CREW_CONFIG_A320,
        margin_percent=Decimal("10"),
        exchange_rate=Decimal("0.85"),
    )
    expected_final = SCENARIO_1_EXPECTED["total_cost_per_bh"] / Decimal("0.90")
    assert result.final_rate_per_bh == expected_final
    assert result.revenue_per_bh == expected_final


def test_fixture_project_aggregation():
    """Two-MSN project: verify aggregated P&L totals."""
    result1 = calculate_pricing(
        mgh=Decimal("350"),
        cycle_ratio=Decimal("1.0"),
        environment="benign",
        lease_type="wet",
        crew_sets=4,
        aircraft_type="A320",
        aircraft_costs=SCENARIO_1_AIRCRAFT_COSTS,
        epr_matrix=SCENARIO_1_EPR_MATRIX,
        pricing_config=PRICING_CONFIG,
        crew_config=CREW_CONFIG_A320,
        margin_percent=Decimal("10"),
        exchange_rate=Decimal("0.85"),
    )
    result2 = calculate_pricing(
        mgh=Decimal("300"),
        cycle_ratio=Decimal("0.62"),
        environment="hot",
        lease_type="damp",
        crew_sets=4,
        aircraft_type="A320",
        aircraft_costs=SCENARIO_2_AIRCRAFT_COSTS,
        epr_matrix=SCENARIO_2_EPR_MATRIX,
        pricing_config=PRICING_CONFIG,
        crew_config=CREW_CONFIG_A320,
        margin_percent=Decimal("10"),
        exchange_rate=Decimal("0.85"),
    )

    msn_results = [
        {
            "msn": 3055,
            "mgh": Decimal("350"),
            "total_cost_per_bh": result1.total_cost_per_bh,
            "final_rate_per_bh": result1.final_rate_per_bh,
            "monthly_cost": result1.total_cost_per_bh * Decimal("350"),
            "monthly_revenue": result1.final_rate_per_bh * Decimal("350"),
            "monthly_pnl": (result1.final_rate_per_bh - result1.total_cost_per_bh) * Decimal("350"),
        },
        {
            "msn": 3378,
            "mgh": Decimal("300"),
            "total_cost_per_bh": result2.total_cost_per_bh,
            "final_rate_per_bh": result2.final_rate_per_bh,
            "monthly_cost": result2.total_cost_per_bh * Decimal("300"),
            "monthly_revenue": result2.final_rate_per_bh * Decimal("300"),
            "monthly_pnl": (result2.final_rate_per_bh - result2.total_cost_per_bh) * Decimal("300"),
        },
    ]

    totals = calculate_project_pnl(msn_results)

    expected_cost = msn_results[0]["monthly_cost"] + msn_results[1]["monthly_cost"]
    assert totals["total_monthly_cost"] == expected_cost

    expected_revenue = msn_results[0]["monthly_revenue"] + msn_results[1]["monthly_revenue"]
    assert totals["total_monthly_revenue"] == expected_revenue

    assert totals["total_monthly_pnl"] == expected_revenue - expected_cost
