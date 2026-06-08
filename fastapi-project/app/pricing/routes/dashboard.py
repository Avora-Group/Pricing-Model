"""Dashboard metrics endpoint.

Company-wide, read-only view of the project pipeline. This endpoint returns
project identity, status, and pipeline counts only. Financials (revenue, cost,
profit, utilization) are computed in the Next.js layer with the same P&L engine
the P&L page uses, so the Dashboard, quote detail, and P&L page always agree.
"""
from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.db.database import get_db


router = APIRouter()

QUOTE_STATUSES = ("draft", "sent", "signed", "active", "completed", "rejected")
# Statuses that appear in the dashboard project list (completed deals are done
# and are intentionally excluded from the active pipeline view).
LISTED_STATUSES = ("sent", "signed", "active")


@router.get("/dashboard")
async def get_dashboard_metrics(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Company-wide dashboard: one project per client, status from its quote.

    A "project" is a client deal. Quotes are grouped by client; the most
    advanced active-pipeline quote (active > signed > sent) represents the
    client. Clients whose only deals are completed/draft/rejected are omitted.
    """
    # Authoritative quote per client: most advanced active-pipeline status, then
    # newest. Completed ranks below sent so a client with a live deal still
    # shows by that deal; a client with only completed deals falls out below.
    quote_rows = await db.fetch(
        """
        SELECT DISTINCT ON (q.client_code)
               q.id, q.client_code, q.quote_number, q.client_name, q.status,
               q.created_at,
               u.email AS created_by_email
        FROM quotes q
        LEFT JOIN users u ON u.id = q.created_by
        ORDER BY q.client_code,
                 CASE q.status
                   WHEN 'active' THEN 0
                   WHEN 'signed' THEN 1
                   WHEN 'accepted' THEN 1
                   WHEN 'sent' THEN 2
                   WHEN 'completed' THEN 3
                   WHEN 'draft' THEN 4
                   WHEN 'rejected' THEN 5
                   ELSE 6
                 END,
                 q.created_at DESC
        """
    )

    project_counts = {s: 0 for s in LISTED_STATUSES}
    projects = []
    for q in quote_rows:
        status = "signed" if q["status"] == "accepted" else q["status"]
        if status not in project_counts:
            continue  # hide draft / rejected
        project_counts[status] += 1
        projects.append(
            {
                # id is the authoritative quote id; the frontend fetches its
                # detail and computes financials with the P&L engine.
                "id": q["id"],
                "name": q["client_name"] or q["client_code"],
                "status": status,
                "created_at": q["created_at"].isoformat() if q["created_at"] else None,
                "created_by": q["created_by_email"],
                "quote": {
                    "quote_number": q["quote_number"],
                    "status": status,
                    "created_at": q["created_at"].isoformat() if q["created_at"] else None,
                },
            }
        )

    # Group by status, newest first within each
    _rank = {"active": 0, "signed": 1, "sent": 2}
    projects.sort(key=lambda x: (x["created_at"] or ""), reverse=True)
    projects.sort(key=lambda x: _rank.get(x["status"], 3))

    # Quote counts by status (legacy 'accepted' rows count as signed)
    quote_status_rows = await db.fetch(
        "SELECT status, COUNT(*) AS count FROM quotes GROUP BY status"
    )
    raw_counts: dict[str, int] = {}
    for row in quote_status_rows:
        raw_counts[row["status"]] = raw_counts.get(row["status"], 0) + row["count"]
    quote_counts = {s: raw_counts.get(s, 0) for s in QUOTE_STATUSES}
    quote_counts["signed"] += raw_counts.get("accepted", 0)
    quote_counts["total"] = sum(raw_counts.values())

    return {
        "projects": projects,
        "project_counts": {
            "sent": project_counts["sent"],
            "signed": project_counts["signed"],
            "active": project_counts["active"],
            "total": sum(project_counts.values()),
        },
        "quote_counts": quote_counts,
    }
