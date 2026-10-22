"""Company-default crew and cost assumptions (Crew / Costs pages).

One JSONB document per kind. New quotes start from these; each saved quote
keeps its own snapshot, so changing them never alters existing quotes.
"""
from __future__ import annotations

from typing import Any, Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user, require_editor
from app.db.database import get_db

router = APIRouter(prefix="/assumptions", tags=["assumptions"])

Kind = Literal["crew", "costs"]

# Top-level keys each document must carry (mirrors the frontend stores).
REQUIRED_KEYS: dict[str, set[str]] = {
    "crew": {"payroll", "otherCost", "training", "averageAC", "fdDays", "nfdDays"},
    "costs": {"maintPersonnel", "maintCosts", "insurance", "doc", "otherCogs", "overhead", "avgAc"},
}


class AssumptionSet(BaseModel):
    data: dict[str, Any]
    updated_at: str | None = None


class SaveAssumptionsRequest(BaseModel):
    data: dict[str, Any]


@router.get("", response_model=dict[str, AssumptionSet | None])
async def get_assumptions(
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Saved defaults by kind; null for a kind that was never saved."""
    rows = await db.fetch("SELECT kind, data, updated_at FROM assumption_sets")
    result: dict[str, AssumptionSet | None] = {"crew": None, "costs": None}
    for r in rows:
        result[r["kind"]] = AssumptionSet(data=r["data"], updated_at=r["updated_at"].isoformat())
    return result


@router.put("/{kind}", response_model=AssumptionSet)
async def save_assumptions(
    kind: Kind,
    body: SaveAssumptionsRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_editor),
):
    """Replace the saved defaults for one kind (admin or user)."""
    missing = REQUIRED_KEYS[kind] - body.data.keys()
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing fields: {', '.join(sorted(missing))}")
    row = await db.fetchrow(
        """
        INSERT INTO assumption_sets (kind, data, updated_at, updated_by)
        VALUES ($1, $2, NOW(), $3)
        ON CONFLICT (kind) DO UPDATE SET
            data = EXCLUDED.data, updated_at = NOW(), updated_by = EXCLUDED.updated_by
        RETURNING data, updated_at
        """,
        kind,
        body.data,
        current_user["id"],
    )
    return AssumptionSet(data=row["data"], updated_at=row["updated_at"].isoformat())
