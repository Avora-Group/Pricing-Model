"""Pydantic schemas for quote persistence and retrieval.

All monetary fields use Decimal for precision. JSONB snapshot fields
are typed as dict since they store arbitrary nested structures from
the frontend stores.
"""
from __future__ import annotations

import re
from decimal import Decimal

from pydantic import BaseModel, field_validator


class MsnSnapshotInput(BaseModel):
    """Per-MSN snapshot data sent when saving a quote."""
    msn: int
    aircraft_type: str
    aircraft_id: int
    msn_input: dict
    breakdown: dict
    monthly_pnl: dict


class SaveQuoteRequest(BaseModel):
    """Request body for saving a new quote."""
    client_name: str
    client_code: str
    project_id: int | None = None
    dashboard_state: dict
    pricing_config_snapshot: dict
    crew_config_snapshot: dict
    costs_config_snapshot: dict
    msn_snapshots: list[MsnSnapshotInput]

    @field_validator("client_code")
    @classmethod
    def validate_client_code(cls, v: str) -> str:
        """Client code must be 2-4 uppercase letters."""
        v = v.strip().upper()
        if not re.match(r"^[A-Z]{2,4}$", v):
            raise ValueError("Client code must be 2-4 uppercase letters")
        return v


class MsnSnapshotResponse(BaseModel):
    """Per-MSN snapshot data returned from a saved quote."""
    id: int
    msn: int
    aircraft_type: str
    aircraft_id: int
    msn_input: dict
    breakdown: dict
    monthly_pnl: dict
    monthly_cost: Decimal | None = None
    monthly_revenue: Decimal | None = None


class QuoteListItem(BaseModel):
    """Quote summary for list views."""
    id: int
    quote_number: str
    client_name: str
    client_code: str
    status: str
    exchange_rate: Decimal
    margin_percent: Decimal
    total_eur_per_bh: Decimal | None = None
    msn_list: list[int]
    created_at: str
    created_by: int


class QuoteDetailResponse(QuoteListItem):
    """Full quote detail including all JSONB snapshots and MSN data."""
    pricing_config_snapshot: dict
    crew_config_snapshot: dict
    costs_config_snapshot: dict
    dashboard_state: dict
    msn_snapshots: list[MsnSnapshotResponse] = []


class UpdateQuoteStatusRequest(BaseModel):
    """Request body for updating a quote's status."""
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Status must be one of the allowed values."""
        allowed = {"draft", "sent", "signed", "active", "rejected"}
        v = v.strip().lower()
        if v == "accepted":  # legacy alias from v1
            v = "signed"
        if v not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return v
