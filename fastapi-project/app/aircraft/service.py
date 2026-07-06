"""Aircraft service layer for EUR conversion and business logic.

Provides exchange-rate conversion applied at API response time.
Phase 2 uses a hardcoded default rate; Phase 3 will migrate to
a database-backed pricing_config table.
"""
from __future__ import annotations

from decimal import Decimal

# Default USD-to-EUR adjustable rate (from Excel cell C2).
# Phase 2 hardcoded; Phase 3 moves to pricing_config table.
DEFAULT_ADJ_RATE = Decimal("0.85")

# All USD fields that should have EUR companions (current + naked)
_USD_FIELDS = [
    "lease_rent_usd",
    "six_year_check_usd",
    "twelve_year_check_usd",
    "ldg_usd",
    "apu_rate_usd",
    "llp1_rate_usd",
    "llp2_rate_usd",
    "naked_lease_rent_usd",
    "naked_six_year_check_usd",
    "naked_twelve_year_check_usd",
    "naked_ldg_usd",
    "naked_apu_rate_usd",
    "naked_llp1_rate_usd",
    "naked_llp2_rate_usd",
]


def apply_eur_conversion(
    rates: dict, adj_rate: Decimal = DEFAULT_ADJ_RATE
) -> dict:
    """Add EUR equivalents to a rates dict.

    For each USD field present and non-None, compute the EUR value
    as ``value * adj_rate`` and add it with the ``_eur`` suffix
    (replacing ``_usd``).

    Returns a new dict with both USD and EUR fields; the original
    dict is not mutated.
    """
    result = dict(rates)
    for field in _USD_FIELDS:
        if field in result and result[field] is not None:
            eur_field = field.replace("_usd", "_eur")
            result[eur_field] = result[field] * adj_rate
    return result
