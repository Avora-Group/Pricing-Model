"""Integration tests for aircraft API endpoints (ACFT-02 through ACFT-04).

Tests verify the full HTTP request/response cycle through the FastAPI app
with a mocked database. Auth cookies are obtained by logging in through
the /auth/login endpoint.
"""
from __future__ import annotations

from decimal import Decimal

import pytest


async def _login(client, email: str, password: str) -> dict:
    """Helper: login and return cookies dict for subsequent requests."""
    resp = await client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return dict(resp.cookies)


async def test_list_aircraft(async_client, test_admin_user, test_aircraft_data):
    """GET /aircraft returns 200 with list of aircraft and their USD rates."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/aircraft", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    # Check first aircraft has expected fields
    first = data[0]
    assert "msn" in first
    assert "aircraft_type" in first
    assert "lease_rent_usd" in first
    # Rates are USD only; EUR is derived per quote in the pricing workspace
    assert "lease_rent_eur" not in first


async def test_search_aircraft_by_msn(async_client, test_admin_user, test_aircraft_data):
    """GET /aircraft?search=3055 returns only aircraft matching MSN."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/aircraft?search=3055", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["msn"] == 3055


async def test_search_aircraft_by_registration(async_client, test_admin_user, test_aircraft_data):
    """GET /aircraft?search=LZ returns aircraft with matching registration."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/aircraft?search=LZ", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["msn"] == 3378


async def test_get_aircraft_detail(async_client, test_admin_user, test_aircraft_data):
    """GET /aircraft/{msn} returns 200 with full detail including EPR matrix."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/aircraft/3055", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["msn"] == 3055
    assert "lease_rent_usd" in data
    assert "apu_rate_usd" in data
    assert "epr_escalation" in data
    # Rates are USD only; EUR is derived per quote in the pricing workspace
    assert not any(k.endswith("_eur") for k in data)
    # EPR matrix present
    assert "epr_matrix" in data
    assert isinstance(data["epr_matrix"], list)
    assert len(data["epr_matrix"]) >= 1


async def test_get_aircraft_not_found(async_client, test_admin_user):
    """GET /aircraft/9999 returns 404 for unknown MSN."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/aircraft/9999", cookies=cookies)
    assert response.status_code == 404
    assert response.json()["detail"] == "Aircraft not found"


async def test_update_rates_as_admin(async_client, test_admin_user, test_aircraft_data):
    """PUT /aircraft/{msn}/rates returns 200 with updated data (admin user)."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.put(
        "/aircraft/3055/rates",
        json={"lease_rent_usd": "200000.00"},
        cookies=cookies,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["msn"] == 3055
    # Updated value reflected
    assert Decimal(data["lease_rent_usd"]) == Decimal("200000.00")


async def test_update_rates_forbidden(async_client, test_regular_user, test_aircraft_data):
    """PUT /aircraft/{msn}/rates returns 403 for non-admin user."""
    cookies = await _login(async_client, "user@test.com", "userpass123")
    response = await async_client.put(
        "/aircraft/3055/rates",
        json={"lease_rent_usd": "200000.00"},
        cookies=cookies,
    )
    assert response.status_code == 403


async def test_update_rates_reflected(async_client, test_admin_user, test_aircraft_data):
    """After PUT, subsequent GET shows updated values."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    # Update
    await async_client.put(
        "/aircraft/3055/rates",
        json={"lease_rent_usd": "250000.00"},
        cookies=cookies,
    )
    # Fetch and verify
    response = await async_client.get("/aircraft/3055", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert Decimal(data["lease_rent_usd"]) == Decimal("250000.00")


async def test_seed_data_present(test_aircraft_data, db_store):
    """Fixture data contains expected structure: aircraft, rates, EPR rows."""
    assert "aircraft" in test_aircraft_data
    assert "rates" in test_aircraft_data
    assert "epr" in test_aircraft_data
    assert len(test_aircraft_data["aircraft"]) == 2
    assert len(test_aircraft_data["rates"]) == 2
    assert len(test_aircraft_data["epr"]) >= 2
    # Verify Decimal types in rates
    first_rate = test_aircraft_data["rates"][0]
    assert isinstance(first_rate["lease_rent_usd"], Decimal)
    # DB store also populated
    assert len(db_store["aircraft"]) == 2
    assert len(db_store["aircraft_rates"]) == 2
