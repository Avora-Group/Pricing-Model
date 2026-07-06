from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel


class AircraftListResponse(BaseModel):
    """Aircraft summary for list views with fixed + variable rates (USD + EUR)."""

    id: int
    msn: int
    aircraft_type: str
    registration: str | None = None
    # Fixed monthly rates (USD)
    lease_rent_usd: Decimal | None = None
    six_year_check_usd: Decimal | None = None
    twelve_year_check_usd: Decimal | None = None
    ldg_usd: Decimal | None = None
    # Variable rates per engine (USD)
    apu_rate_usd: Decimal | None = None
    llp1_rate_usd: Decimal | None = None
    llp2_rate_usd: Decimal | None = None
    # EUR conversions (computed on read via apply_eur_conversion)
    lease_rent_eur: Decimal | None = None
    six_year_check_eur: Decimal | None = None
    twelve_year_check_eur: Decimal | None = None
    ldg_eur: Decimal | None = None
    apu_rate_eur: Decimal | None = None
    llp1_rate_eur: Decimal | None = None
    llp2_rate_eur: Decimal | None = None
    # EPR matrix
    epr_matrix: list[EprMatrixRow] = []


class EprMatrixRow(BaseModel):
    """Single EPR matrix row: cycle ratio mapped to benign/hot rates."""

    cycle_ratio: Decimal
    benign_rate: Decimal
    hot_rate: Decimal


class AircraftDetailResponse(BaseModel):
    """Full aircraft detail with all rates, escalation, and EPR matrix."""

    id: int
    msn: int
    aircraft_type: str
    registration: str | None = None
    # Fixed monthly rates (USD)
    lease_rent_usd: Decimal | None = None
    six_year_check_usd: Decimal | None = None
    twelve_year_check_usd: Decimal | None = None
    ldg_usd: Decimal | None = None
    # Variable rates per engine (USD)
    apu_rate_usd: Decimal | None = None
    llp1_rate_usd: Decimal | None = None
    llp2_rate_usd: Decimal | None = None
    # EUR conversions (computed on read via apply_eur_conversion)
    lease_rent_eur: Decimal | None = None
    six_year_check_eur: Decimal | None = None
    twelve_year_check_eur: Decimal | None = None
    ldg_eur: Decimal | None = None
    apu_rate_eur: Decimal | None = None
    llp1_rate_eur: Decimal | None = None
    llp2_rate_eur: Decimal | None = None
    # Escalation rates
    epr_escalation: Decimal | None = None
    llp_escalation: Decimal | None = None
    af_apu_escalation: Decimal | None = None
    # EPR matrix
    epr_matrix: list[EprMatrixRow] = []
    # --- Naked rates (only populated for cost-access users) ---
    has_naked_rates: bool = False
    naked_lease_rent_usd: Decimal | None = None
    naked_six_year_check_usd: Decimal | None = None
    naked_twelve_year_check_usd: Decimal | None = None
    naked_ldg_usd: Decimal | None = None
    naked_apu_rate_usd: Decimal | None = None
    naked_llp1_rate_usd: Decimal | None = None
    naked_llp2_rate_usd: Decimal | None = None
    naked_lease_rent_eur: Decimal | None = None
    naked_six_year_check_eur: Decimal | None = None
    naked_twelve_year_check_eur: Decimal | None = None
    naked_ldg_eur: Decimal | None = None
    naked_apu_rate_eur: Decimal | None = None
    naked_llp1_rate_eur: Decimal | None = None
    naked_llp2_rate_eur: Decimal | None = None
    naked_epr_escalation: Decimal | None = None
    naked_llp_escalation: Decimal | None = None
    naked_af_apu_escalation: Decimal | None = None
    naked_epr_matrix: list[EprMatrixRow] = []


class UpdateRatesRequest(BaseModel):
    """Partial update for aircraft cost parameters. All fields optional."""

    lease_rent_usd: Decimal | None = None
    six_year_check_usd: Decimal | None = None
    twelve_year_check_usd: Decimal | None = None
    ldg_usd: Decimal | None = None
    apu_rate_usd: Decimal | None = None
    llp1_rate_usd: Decimal | None = None
    llp2_rate_usd: Decimal | None = None
    epr_escalation: Decimal | None = None
    llp_escalation: Decimal | None = None
    af_apu_escalation: Decimal | None = None


class CreateAircraftRequest(BaseModel):
    """Request to create a new aircraft with all its rates."""

    msn: int
    aircraft_type: str = "A320"
    registration: str | None = None
    # All rate fields optional
    lease_rent_usd: Decimal | None = None
    six_year_check_usd: Decimal | None = None
    twelve_year_check_usd: Decimal | None = None
    ldg_usd: Decimal | None = None
    apu_rate_usd: Decimal | None = None
    llp1_rate_usd: Decimal | None = None
    llp2_rate_usd: Decimal | None = None
    epr_escalation: Decimal | None = None
    llp_escalation: Decimal | None = None
    af_apu_escalation: Decimal | None = None


class UpdateEprMatrixRequest(BaseModel):
    """Bulk replace EPR matrix for an aircraft."""

    rows: list[EprMatrixRow]
