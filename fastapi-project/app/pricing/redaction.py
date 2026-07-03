"""Naked-cost redaction helpers.

Server-side enforcement of the ``can_view_costs`` rule. When a user is not
permitted to see naked costs, the sensitive cost / profit / margin fields are
stripped (set to ``None``) from the serialized response before it leaves the
router. Price (the sell rate / revenue) is always preserved.

The single source of truth for *whether* a user may see costs lives in
``app.auth.dependencies.user_can_view_costs`` -- this module only decides
*which* fields are sensitive and nulls them when access is denied.
"""
from __future__ import annotations

from typing import Any


# Keys on a per-BH ComponentBreakdown that constitute the "naked cost" build-up,
# the total ACMI cost, and the margin. ``revenue_per_bh`` and
# ``final_rate_per_bh`` are the sell rate and stay visible to everyone.
BREAKDOWN_COST_KEYS = (
    "aircraft_eur_per_bh",
    "crew_eur_per_bh",
    "maintenance_eur_per_bh",
    "insurance_eur_per_bh",
    "doc_eur_per_bh",
    "other_cogs_eur_per_bh",
    "overhead_eur_per_bh",
    "total_cost_per_bh",
    "margin_percent",
)

# Per-MSN result cost/profit keys. ``monthly_revenue`` (revenue) is preserved.
MSN_RESULT_COST_KEYS = (
    "monthly_cost",
    "monthly_pnl",
)

# Quote MSN snapshot cost/profit keys (revenue preserved).
SNAPSHOT_COST_KEYS = (
    "monthly_cost",
    "monthly_pnl",
)


def _null_keys(obj: dict[str, Any] | None, keys: tuple[str, ...]) -> None:
    """Set each key present in ``obj`` to None (in place)."""
    if not isinstance(obj, dict):
        return
    for k in keys:
        if k in obj:
            obj[k] = None


def redact_component_breakdown(breakdown: dict[str, Any] | None) -> None:
    """Null the cost build-up + margin on a single ComponentBreakdown dict."""
    _null_keys(breakdown, BREAKDOWN_COST_KEYS)


def redact_calculate_response(payload: dict[str, Any], allowed: bool) -> dict[str, Any]:
    """Strip naked-cost fields from a serialized CalculateResponse.

    When ``allowed`` is True the payload is returned unchanged. Otherwise the
    per-component build-up, total ACMI cost, margin %, and per-MSN cost/profit
    are nulled. Revenue and the EUR/BH sell rate are preserved.
    """
    if allowed:
        return payload

    for result in payload.get("msn_results") or []:
        redact_component_breakdown(result.get("breakdown"))
        _null_keys(result, MSN_RESULT_COST_KEYS)

    redact_component_breakdown(payload.get("total"))
    return payload


def redact_quote_detail(payload: dict[str, Any], allowed: bool) -> dict[str, Any]:
    """Strip naked-cost fields from a serialized quote detail response.

    Removes the per-MSN breakdown build-up, monthly cost/profit, the config
    snapshots (which contain raw cost inputs), and the cost portion of the
    dashboard_state snapshot. The sell rate (total_eur_per_bh), revenue, and
    quote identity are preserved.
    """
    if allowed:
        return payload

    # Config snapshots carry the raw naked-cost inputs -- drop them entirely.
    for snap_key in ("pricing_config_snapshot", "crew_config_snapshot", "costs_config_snapshot"):
        if snap_key in payload:
            payload[snap_key] = None

    # margin_percent on the quote is a computed/target margin -> redact.
    if "margin_percent" in payload:
        payload["margin_percent"] = None

    # dashboard_state snapshot embeds cost figures used to recompute the P&L.
    if isinstance(payload.get("dashboard_state"), dict):
        payload["dashboard_state"] = _redact_dashboard_state(payload["dashboard_state"])

    for snap in payload.get("msn_snapshots") or []:
        if not isinstance(snap, dict):
            continue
        _null_keys(snap, SNAPSHOT_COST_KEYS)
        # breakdown / monthly_pnl JSONB carry the naked cost stack.
        if "breakdown" in snap:
            snap["breakdown"] = None
        if "monthly_pnl" in snap:
            snap["monthly_pnl"] = None
    return payload


def _redact_dashboard_state(state: dict[str, Any]) -> dict[str, Any]:
    """Null the cost/profit portions of a saved dashboard_state snapshot.

    Keeps sell-side inputs (exchange rate, ACMI rates, revenue) but nulls the
    computed cost/profit result objects so the P&L cannot be reconstructed.
    """
    # marginPercent is a cost/margin figure.
    if "marginPercent" in state:
        state["marginPercent"] = None

    # totalResult / msnResults hold computed cost + profit breakdowns.
    total_result = state.get("totalResult")
    if isinstance(total_result, dict):
        redact_component_breakdown(total_result)
        _null_keys(total_result, ("monthly_cost", "monthly_pnl", "monthlyCost", "monthlyPnl"))

    for r in state.get("msnResults") or []:
        if isinstance(r, dict):
            redact_component_breakdown(r.get("breakdown"))
            redact_component_breakdown(r)
            _null_keys(r, ("monthly_cost", "monthly_pnl", "monthlyCost", "monthlyPnl"))
    return state
