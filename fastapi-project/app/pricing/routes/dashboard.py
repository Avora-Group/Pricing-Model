"""Dashboard metrics endpoint.

Company-wide, read-only aggregates over pricing projects and quotes.
All monetary aggregation happens in SQL at NUMERIC precision; Decimal
values are serialized as strings to preserve precision (matching the
frontend convention of storing decimals as strings).
"""
from __future__ import annotations

from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.db.database import get_db


router = APIRouter()


def _s(value) -> str | None:
    """Serialize Decimal/None to string, preserving NUMERIC precision."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value)
    return str(value)


@router.get("/dashboard")
async def get_dashboard_metrics(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Company-wide dashboard metrics: projects by status, quote stats."""
    # Project counts by status
    status_rows = await db.fetch(
        "SELECT status, COUNT(*) AS count FROM pricing_projects GROUP BY status"
    )
    project_counts = {row["status"]: row["count"] for row in status_rows}

    # All projects with MSN aggregates and creator (company-wide)
    project_rows = await db.fetch(
        """
        SELECT p.id, p.name, p.status, p.status_source, p.signed_at,
               p.created_at, p.updated_at, p.margin_percent,
               u.email AS created_by_email,
               COUNT(mi.id) AS msn_count,
               COALESCE(SUM(mi.mgh), 0) AS total_mgh,
               MAX(mi.period_months) AS period_months
        FROM pricing_projects p
        LEFT JOIN project_msn_inputs mi ON mi.project_id = p.id
        LEFT JOIN users u ON u.id = p.created_by
        GROUP BY p.id, u.email
        ORDER BY p.created_at DESC
        """
    )

    # Latest linked quote per project (authoritative value: latest accepted,
    # else latest of any status)
    quote_rows = await db.fetch(
        """
        SELECT DISTINCT ON (project_id)
               project_id, quote_number, client_name, status,
               total_eur_per_bh, created_at
        FROM quotes
        WHERE project_id IS NOT NULL
        ORDER BY project_id,
                 (status = 'accepted') DESC,
                 created_at DESC
        """
    )
    latest_quote_by_project = {row["project_id"]: row for row in quote_rows}

    projects = []
    for p in project_rows:
        quote = latest_quote_by_project.get(p["id"])
        # Contract value = EUR/BH x total MGH x period months (NUMERIC math)
        contract_value = None
        if quote and quote["total_eur_per_bh"] is not None and p["total_mgh"]:
            contract_value = (
                quote["total_eur_per_bh"]
                * p["total_mgh"]
                * Decimal(p["period_months"] or 12)
            )
        projects.append(
            {
                "id": p["id"],
                "name": p["name"],
                "status": p["status"],
                "status_source": p["status_source"],
                "signed_at": p["signed_at"].isoformat() if p["signed_at"] else None,
                "created_at": p["created_at"].isoformat() if p["created_at"] else None,
                "created_by": p["created_by_email"],
                "msn_count": p["msn_count"],
                "total_mgh": _s(p["total_mgh"]),
                "period_months": p["period_months"],
                "margin_percent": _s(p["margin_percent"]),
                "latest_quote": (
                    {
                        "quote_number": quote["quote_number"],
                        "client_name": quote["client_name"],
                        "status": quote["status"],
                        "total_eur_per_bh": _s(quote["total_eur_per_bh"]),
                    }
                    if quote
                    else None
                ),
                "contract_value": _s(contract_value),
            }
        )

    # Quote stats (all quotes, linked or not)
    quote_status_rows = await db.fetch(
        "SELECT status, COUNT(*) AS count FROM quotes GROUP BY status"
    )
    quote_counts = {row["status"]: row["count"] for row in quote_status_rows}

    # Average EUR/BH and margin across quotes that have a rate
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
        "quote_counts": {
            "draft": quote_counts.get("draft", 0),
            "sent": quote_counts.get("sent", 0),
            "accepted": quote_counts.get("accepted", 0),
            "rejected": quote_counts.get("rejected", 0),
            "total": sum(quote_counts.values()),
        },
        "averages": {
            "eur_per_bh": _s(avg_row["avg_eur_per_bh"]) if avg_row else None,
            "margin_percent": _s(avg_row["avg_margin"]) if avg_row else None,
        },
    }
