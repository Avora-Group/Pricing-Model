"""Aircraft router registration.

Aircraft rates are served in USD only; EUR is derived in the pricing
workspace from each quote's own exchange rate.
"""
from __future__ import annotations


class TestRouterRegistration:
    """Tests for aircraft router being registered in the app."""

    def test_aircraft_routes_registered(self):
        """Aircraft list, detail, and update routes should be in the app."""
        from app.main import app

        route_paths = [r.path for r in app.routes]
        assert "/aircraft" in route_paths or "/aircraft/" in route_paths
        assert "/aircraft/{msn}" in route_paths
        assert "/aircraft/{msn}/rates" in route_paths
