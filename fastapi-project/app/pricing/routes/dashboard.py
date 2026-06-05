"""Dashboard metrics endpoint.

Company-wide, read-only aggregates over pricing projects and quotes.
All monetary aggregation happens in SQL / Decimal at NUMERIC precision;
Decimal values are serialized as strings to preserve precision (matching
the frontend convention of storing decimals as strings).
"""
from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation

import asyncpg
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.db.database import get_db


router = APIRouter()

QUOTE_STATUSES = ("draft", "sent", "signed", "active", "rejected")


def _s(value) -> str | None:
    """Serialize Decimal/None to string, preserving NUMERIC precision."""
    if value is None:
        return None
    return str(value)


def _dec(value) -> Decimal | None:
    """Best-effort Decimal from JSONB string/number values."""
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _input_get(msn_input: dict, *keys):
    """Read a value from the msn_input JSONB trying camelCase and snake_case."""
    for key in keys:
        if key in msn_input and msn_input[key] not in (None, ""):
            return msn_input[key]
    return None


@router.get("/dashboard")
async def get_dashboard_metrics(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Company-wide dashboard: projects with financials, quote pipeline stats."""
    # ---- Project counts by status ----
    status_rows = await db.fetch(
        "SELECT status, COUNT(*) AS count FROM pricing_projects GROUP BY status"
    )
    project_counts = {row["status"]: row["count"] for row in status_rows}

    # ---- Projects (company-wide) ----
    project_rows = await db.fetch(
        """
        SELECT p.id, p.name, p.status, p.status_source, p.signed_at,
               p.created_at, p.margin_percent,
               u.email AS created_by_email
        FROM pricing_projects p
        LEFT JOIN users u ON u.id = p.created_by
        ORDER BY p.created_at DESC
        """
    )

    # Authoritative quote per project: prefer signed/active deals, then newest
    quote_rows = await db.fetch(
        """
        SELECT DISTINCT ON (project_id)
               id, project_id, quote_number, client_name, status,
               total_eur_per_bh, margin_percent, created_at
        FROM quotes
        WHERE project_id IS NOT NULL
        ORDER BY project_id,
                 (status IN ('signed', 'active', 'accepted')) DESC,
                 created_at DESC
        """
    )
    latest_quote_by_project = {row["project_id"]: row for row in quote_rows}

    # Per-MSN snapshots for each authoritative quote (financials + utilization)
    quote_ids = [row["id"] for row in quote_rows]
    snapshots_by_quote: dict[int, list] = {}
    if quote_ids:
        snapshot_rows = await db.fetch(
            """
            SELECT quote_id, msn, aircraft_type, msn_input,
                   monthly_cost, monthly_revenue
            FROM quote_msn_snapshots
            WHERE quote_id = ANY($1::int[])
            ORDER BY quote_id, msn
            """,
            quote_ids,
        )
        for row in snapshot_rows:
            snapshots_by_quote.setdefault(row["quote_id"], []).append(row)

    projects = []
    for p in project_rows:
        quote = latest_quote_by_project.get(p["id"])
        snapshots = snapshots_by_quote.get(quote["id"], []) if quote else []

        # Financial rollup from the authoritative quote's MSN snapshots
        monthly_revenue = Decimal("0")
        monthly_cost = Decimal("0")
        period_months = 0
        msns = []
        has_financials = False
        for snap in snapshots:
            msn_input = snap["msn_input"] or {}
            if isinstance(msn_input, str):  # asyncpg may return JSONB as str
                try:
                    msn_input = json.loads(msn_input)
                except ValueError:
                    msn_input = {}

            rev = snap["monthly_revenue"]
            cost = snap["monthly_cost"]
            if rev is not None or cost is not None:
                has_financials = True
            monthly_revenue += rev or Decimal("0")
            monthly_cost += cost or Decimal("0")

            snap_period = _dec(_input_get(msn_input, "periodMonths", "period_months"))
            if snap_period:
                period_months = max(period_months, int(snap_period))

            msns.append(
                {
                    "msn": snap["msn"],
                    "aircraft_type": snap["aircraft_type"],
                    "mgh": _s(_dec(_input_get(msn_input, "mgh"))),
                    "cycle_ratio": _s(
                        _dec(_input_get(msn_input, "cycleRatio", "cycle_ratio"))
                    ),
                    "crew_sets": _s(
                        _dec(_input_get(msn_input, "crewSets", "crew_sets"))
                    ),
                    "environment": _input_get(msn_input, "environment"),
                    "lease_type": _input_get(msn_input, "leaseType", "lease_type"),
                    "period_months": _s(snap_period),
                    "monthly_revenue": _s(rev),
                    "monthly_cost": _s(cost),
                    "monthly_profit": _s(
                        (rev - cost) if rev is not None and cost is not None else None
                    ),
                }
            )

        monthly_profit = monthly_revenue - monthly_cost if has_financials else None
        period = period_months or 12
        total_revenue = monthly_revenue * period if has_financials else None
        total_profit = monthly_profit * period if monthly_profit is not None else None
        total_mgh = sum(
            (_dec(m["mgh"]) or Decimal("0")) for m in msns
        ) if msns else None

        projects.append(
            {
                "id": p["id"],
                # Project identity on the dashboard is the client from the quote
                "name": (quote["client_name"] if quote else None)
                or p["name"]
                or "Untitled Project",
                "status": p["status"],
                "status_source": p["status_source"],
                "signed_at": p["signed_at"].isoformat() if p["signed_at"] else None,
                "created_at": p["created_at"].isoformat() if p["created_at"] else None,
                "created_by": p["created_by_email"],
                "msn_count": len(msns),
                "total_mgh": _s(total_mgh),
                "period_months": period if has_financials else None,
                "monthly_revenue": _s(monthly_revenue if has_financials else None),
                "monthly_cost": _s(monthly_cost if has_financials else None),
                "monthly_profit": _s(monthly_profit),
                "total_revenue": _s(total_revenue),
                "total_profit": _s(total_profit),
                "margin_percent": _s(
                    (quote["margin_percent"] if quote else None) or p["margin_percent"]
                ),
                "eur_per_bh": _s(quote["total_eur_per_bh"]) if quote else None,
                "quote": (
                    {
                        "quote_number": quote["quote_number"],
                        "status": quote["status"],
                        "created_at": quote["created_at"].isoformat()
                        if quote["created_at"]
                        else None,
                    }
                    if quote
                    else None
                ),
                "msns": msns,
            }
        )

    # ---- Quote counts by status ('accepted' legacy rows count as signed) ----
    quote_status_rows = await db.fetch(
        "SELECT status, COUNT(*) AS count FROM quotes GROUP BY status"
    )
    raw_counts: dict[str, int] = {}
    for row in quote_status_rows:
        raw_counts[row["status"]] = raw_counts.get(row["status"], 0) + row["count"]
    quote_counts = {s: raw_counts.get(s, 0) for s in QUOTE_STATUSES}
    quote_counts["signed"] += raw_counts.get("accepted", 0)
    quote_counts["total"] = sum(raw_counts.values())

    # ---- Averages across quotes with a computed rate ----
    avg_row = await db.fetchrow(
        """
        SELECT AVG(total_eur_per_bh) AS avg_eur_per_bh,
               AVG(margin_percent) AS avg_margin
        FROM quotes
        WHERE total_eur_per_bh IS NOT NULL
        """
    )

    return {
        "projects": projects,
        "project_counts": {
            "potential": project_counts.get("potential", 0),
            "signed": project_counts.get("signed", 0),
            "active": project_counts.get("active", 0),
            "total": sum(project_counts.values()),
        },
        "quote_counts": quote_counts,
        "averages": {
            "eur_per_bh": _s(avg_row["avg_eur_per_bh"]) if avg_row else None,
            "margin_percent": _s(avg_row["avg_margin"]) if avg_row else None,
        },
    }
