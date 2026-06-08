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
    """Read a value from a JSONB dict trying camelCase and snake_case."""
    for key in keys:
        if key in msn_input and msn_input[key] not in (None, ""):
            return msn_input[key]
    return None


def _as_dict(value) -> dict:
    """Coerce a JSONB column (dict or str) to a dict."""
    if value is None:
        return {}
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return {}
    return value if isinstance(value, dict) else {}


def _period_months(msn_input: dict) -> int | None:
    """Derive contract length: explicit periodMonths, else periodStart->periodEnd."""
    explicit = _dec(_input_get(msn_input, "periodMonths", "period_months"))
    if explicit:
        return int(explicit)
    start = _input_get(msn_input, "periodStart", "period_start")
    end = _input_get(msn_input, "periodEnd", "period_end")
    if start and end:
        try:
            sy, sm = (int(x) for x in str(start).split("-")[:2])
            ey, em = (int(x) for x in str(end).split("-")[:2])
            months = (ey - sy) * 12 + (em - sm)
            return months if months > 0 else None
        except (ValueError, IndexError):
            return None
    return None


@router.get("/dashboard")
async def get_dashboard_metrics(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Company-wide dashboard: projects with financials, quote pipeline stats.

    A "project" on the dashboard is a client deal: quotes are grouped by
    client, and the most advanced quote (active > signed > sent) represents
    that client. This is driven straight from quotes, so every saved quote is
    accounted for regardless of any project linkage.
    """
    # Authoritative quote per client: most advanced status, then newest.
    quote_rows = await db.fetch(
        """
        SELECT DISTINCT ON (q.client_code)
               q.id, q.client_code, q.quote_number, q.client_name, q.status,
               q.total_eur_per_bh, q.margin_percent, q.created_at,
               u.email AS created_by_email
        FROM quotes q
        LEFT JOIN users u ON u.id = q.created_by
        ORDER BY q.client_code,
                 CASE q.status
                   WHEN 'active' THEN 0
                   WHEN 'signed' THEN 1
                   WHEN 'accepted' THEN 1
                   WHEN 'sent' THEN 2
                   WHEN 'draft' THEN 3
                   WHEN 'rejected' THEN 4
                   ELSE 5
                 END,
                 q.created_at DESC
        """
    )

    # Only deals worth tracking appear in the list: active, sent, signed.
    LISTED_STATUSES = {"sent", "signed", "active"}
    project_counts = {"sent": 0, "signed": 0, "active": 0}

    # Per-MSN snapshots for each authoritative quote (financials + utilization)
    quote_ids = [row["id"] for row in quote_rows]
    snapshots_by_quote: dict[int, list] = {}
    if quote_ids:
        snapshot_rows = await db.fetch(
            """
            SELECT quote_id, msn, aircraft_type, msn_input,
                   breakdown, monthly_pnl, monthly_cost, monthly_revenue
            FROM quote_msn_snapshots
            WHERE quote_id = ANY($1::int[])
            ORDER BY quote_id, msn
            """,
            quote_ids,
        )
        for row in snapshot_rows:
            snapshots_by_quote.setdefault(row["quote_id"], []).append(row)

    projects = []
    for quote in quote_rows:
        if quote is None:
            continue
        status = "signed" if quote["status"] == "accepted" else quote["status"]
        if status not in LISTED_STATUSES:
            continue  # hide draft / rejected
        project_counts[status] += 1
        snapshots = snapshots_by_quote.get(quote["id"], [])

        # Financial rollup from the authoritative quote's MSN snapshots.
        # Older quotes leave the monthly_cost/monthly_revenue columns NULL but
        # carry the values in the monthly_pnl / breakdown JSONB, so fall back.
        monthly_revenue = Decimal("0")
        monthly_cost = Decimal("0")
        period_months = 0
        rate_weighted_sum = Decimal("0")  # sum(rate * mgh) for MGH-weighted €/BH
        rate_weight = Decimal("0")
        msns = []
        has_financials = False
        for snap in snapshots:
            msn_input = _as_dict(snap["msn_input"])
            breakdown = _as_dict(snap["breakdown"])
            pnl = _as_dict(snap["monthly_pnl"])

            rev = snap["monthly_revenue"]
            if rev is None:
                rev = _dec(_input_get(pnl, "monthlyRevenue", "monthly_revenue"))
            cost = snap["monthly_cost"]
            if cost is None:
                cost = _dec(_input_get(pnl, "monthlyCost", "monthly_cost"))
            profit = _dec(_input_get(pnl, "monthlyPnl", "monthly_pnl"))
            if profit is None and rev is not None and cost is not None:
                profit = rev - cost

            if rev is not None or cost is not None:
                has_financials = True
            monthly_revenue += rev or Decimal("0")
            monthly_cost += cost or Decimal("0")

            snap_period = _period_months(msn_input)
            if snap_period:
                period_months = max(period_months, snap_period)

            mgh = _dec(_input_get(msn_input, "mgh"))
            rate = _dec(_input_get(breakdown, "finalRatePerBh", "revenuePerBh"))
            if rate is not None and mgh:
                rate_weighted_sum += rate * mgh
                rate_weight += mgh

            msns.append(
                {
                    "msn": snap["msn"],
                    "aircraft_type": snap["aircraft_type"],
                    "mgh": _s(mgh),
                    "cycle_ratio": _s(
                        _dec(_input_get(msn_input, "cycleRatio", "cycle_ratio"))
                    ),
                    "crew_sets": _s(
                        _dec(_input_get(msn_input, "crewSets", "crew_sets"))
                    ),
                    "environment": _input_get(msn_input, "environment"),
                    "lease_type": _input_get(msn_input, "leaseType", "lease_type"),
                    "eur_per_bh": _s(rate),
                    "period_months": _s(Decimal(snap_period)) if snap_period else None,
                    "monthly_revenue": _s(rev),
                    "monthly_cost": _s(cost),
                    "monthly_profit": _s(profit),
                }
            )

        monthly_profit = monthly_revenue - monthly_cost if has_financials else None
        period = period_months or 12
        total_revenue = monthly_revenue * period if has_financials else None
        total_profit = monthly_profit * period if monthly_profit is not None else None
        total_mgh = sum(
            (_dec(m["mgh"]) or Decimal("0")) for m in msns
        ) if msns else None

        # Project €/BH: the quote's headline rate, else MGH-weighted MSN average
        eur_per_bh = quote["total_eur_per_bh"]
        if eur_per_bh is None and rate_weight > 0:
            eur_per_bh = rate_weighted_sum / rate_weight

        projects.append(
            {
                # Stable per-client id for the row (the authoritative quote id)
                "id": quote["id"],
                # Project identity on the dashboard is the client from the quote
                "name": quote["client_name"] or quote["client_code"],
                "status": status,
                "created_at": quote["created_at"].isoformat()
                if quote["created_at"]
                else None,
                "created_by": quote["created_by_email"],
                "msn_count": len(msns),
                "total_mgh": _s(total_mgh),
                "period_months": period if has_financials else None,
                "monthly_revenue": _s(monthly_revenue if has_financials else None),
                "monthly_cost": _s(monthly_cost if has_financials else None),
                "monthly_profit": _s(monthly_profit),
                "total_revenue": _s(total_revenue),
                "total_profit": _s(total_profit),
                "margin_percent": _s(quote["margin_percent"]),
                "eur_per_bh": _s(eur_per_bh),
                "quote": {
                    "quote_number": quote["quote_number"],
                    "status": status,
                    "created_at": quote["created_at"].isoformat()
                    if quote["created_at"]
                    else None,
                },
                "msns": msns,
            }
        )

    # Group by status (active, then signed, then sent), newest first within each
    _rank = {"active": 0, "signed": 1, "sent": 2}
    projects.sort(key=lambda x: (x["created_at"] or ""), reverse=True)
    projects.sort(key=lambda x: _rank.get(x["status"], 3))

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
            "sent": project_counts["sent"],
            "signed": project_counts["signed"],
            "active": project_counts["active"],
            "total": sum(project_counts.values()),
        },
        "quote_counts": quote_counts,
        "averages": {
            "eur_per_bh": _s(avg_row["avg_eur_per_bh"]) if avg_row else None,
            "margin_percent": _s(avg_row["avg_margin"]) if avg_row else None,
        },
    }
