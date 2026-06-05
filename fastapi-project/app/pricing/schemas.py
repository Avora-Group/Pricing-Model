"""Pydantic schemas for pricing engine inputs, configs, and calculation output.

All monetary and rate fields use Decimal type -- never float.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


# ---- Pricing Inputs ----

class PricingInputs(BaseModel):
    """Operational inputs for a single MSN pricing calculation."""

    msn: int
    mgh: Decimal                # Monthly Guaranteed Hours (block hours)
    cycle_ratio: Decimal        # Flight cycles per flight hour
    environment: str            # "benign" or "hot"
    period_months: int = 12     # Contract period in months
    lease_type: str = "wet"     # "wet", "damp", or "moist"
    crew_sets: float = 4         # Number of crew sets (supports decimals e.g. 3.5)


class CalculateRequest(BaseModel):
    """Request body for P&L calculation endpoint."""

    exchange_rate: Decimal
    margin_percent: Decimal = Decimal("0")
    msn_inputs: list[PricingInputs]


# ---- Component Breakdown ----

class ComponentBreakdown(BaseModel):
    """Per-BH cost breakdown for all 7 ACMI components (EUR)."""

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


# ---- MSN P&L Result ----

class MsnPnlResult(BaseModel):
    """Full P&L result for a single MSN."""

    msn: int
    aircraft_type: str
    breakdown: ComponentBreakdown
    monthly_cost: Decimal
    monthly_revenue: Decimal
    monthly_pnl: Decimal


class CalculateResponse(BaseModel):
    """Response body with per-MSN results and optional total."""

    msn_results: list[MsnPnlResult]
    total: ComponentBreakdown | None = None


# ---- Config Responses ----

class PricingConfigResponse(BaseModel):
    """Pricing config row mapped to Decimal types."""

    id: int
    version: int
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
    is_current: bool


class CrewConfigResponse(BaseModel):
    """Crew config row mapped to Decimal types."""

    id: int
    version: int
    aircraft_type: str
    pilot_salary_monthly: Decimal
    senior_attendant_salary_monthly: Decimal
    regular_attendant_salary_monthly: Decimal
    per_diem_rate: Decimal
    accommodation_monthly_budget: Decimal
    training_total_budget: Decimal
    uniform_total_budget: Decimal
    is_current: bool


# ---- Config Update Requests ----

class UpdatePricingConfigRequest(BaseModel):
    """Partial update for pricing config. All editable fields optional."""

    exchange_rate: Optional[Decimal] = None
    insurance_usd: Optional[Decimal] = None
    doc_total_budget: Optional[Decimal] = None
    overhead_total_budget: Optional[Decimal] = None
    other_cogs_monthly: Optional[Decimal] = None
    line_maintenance_monthly: Optional[Decimal] = None
    base_maintenance_monthly: Optional[Decimal] = None
    personnel_salary_monthly: Optional[Decimal] = None
    c_check_monthly: Optional[Decimal] = None
    maintenance_training_monthly: Optional[Decimal] = None
    spare_parts_rate: Optional[Decimal] = None
    maintenance_per_diem: Optional[Decimal] = None
    average_active_fleet: Optional[Decimal] = None


class UpdateCrewConfigRequest(BaseModel):
    """Partial update for crew config. aircraft_type required, rest optional."""

    aircraft_type: str
    pilot_salary_monthly: Optional[Decimal] = None
    senior_attendant_salary_monthly: Optional[Decimal] = None
    regular_attendant_salary_monthly: Optional[Decimal] = None
    per_diem_rate: Optional[Decimal] = None
    accommodation_monthly_budget: Optional[Decimal] = None
    training_total_budget: Optional[Decimal] = None
    uniform_total_budget: Optional[Decimal] = None


# ---- Project Schemas ----

class MsnInputResponse(BaseModel):
    """Single MSN input row within a project."""

    id: int
    project_id: int
    aircraft_id: int
    mgh: Decimal
    cycle_ratio: Decimal
    environment: str
    period_months: int
    lease_type: str
    crew_sets: float


class ProjectResponse(BaseModel):
    """Pricing project with its MSN inputs."""

    id: int
    name: str | None = None
    exchange_rate: Decimal
    margin_percent: Decimal
    config_version_id: int | None = None
    status: str = "potential"
    status_source: str = "manual"
    signed_at: datetime | None = None
    msn_inputs: list[MsnInputResponse] = []


class CreateProjectRequest(BaseModel):
    """Create a new pricing project."""

    name: str | None = None


PROJECT_STATUSES = ("potential", "signed", "active")


class UpdateProjectStatusRequest(BaseModel):
    """Manually set a project's pipeline status."""

    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in PROJECT_STATUSES:
            raise ValueError(f"status must be one of {PROJECT_STATUSES}")
        return v


class AddMsnInputRequest(BaseModel):
    """Add an MSN to a pricing project."""

    aircraft_id: int
    mgh: Decimal
    cycle_ratio: Decimal
    environment: str
    period_months: int = 12
    lease_type: str = "wet"
    crew_sets: float = 4
