"""Integration tests for quote API endpoints (QUOT-01 through QUOT-05).

Tests exercise the full HTTP request/response cycle through the FastAPI app
with a mocked database. Covers: create quote, immutability check, list with
search/status/MSN filter, quote detail with snapshots, status update with
permission check.
"""
from __future__ import annotations

import pytest


async def _login(client, email: str, password: str) -> dict:
    """Helper: login and return cookies dict for subsequent requests."""
    resp = await client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return dict(resp.cookies)


def _make_quote_payload(
    client_name: str = "easyJet",
    client_code: str = "EZJ",
    msn: int = 3055,
) -> dict:
    """Build a valid SaveQuoteRequest payload for testing."""
    return {
        "client_name": client_name,
        "client_code": client_code,
        "dashboard_state": {
            "projectName": f"{client_code} Winter 2026",
            "exchangeRate": "0.8500",
            "marginPercent": "12.0",
        },
        "pricing_config_snapshot": {"insurance_usd": "45000.00"},
        "crew_config_snapshot": {"A320": {"pilot_salary_monthly": "12500.00"}},
        "costs_config_snapshot": {"doc_total_budget": "110000.00"},
        "msn_snapshots": [
            {
                "msn": msn,
                "aircraft_type": "A320",
                "aircraft_id": 1,
                "msn_input": {"mgh": 300, "cycleRatio": "1.0", "crewSets": 4},
                "breakdown": {
                    "aircraft_eur_per_bh": "520.83",
                    "total_cost_per_bh": "2500.00",
                },
                "monthly_pnl": {
                    "months": [
                        {"month": 1, "revenue": "855000.00", "cost": "750000.00"}
                    ]
                },
            }
        ],
    }


# ---- QUOT-01: Create Quote ----


@pytest.mark.asyncio
async def test_create_quote(async_client, test_admin_user):
    """POST /quotes with valid payload returns 201 + quote_number."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    payload = _make_quote_payload()
    response = await async_client.post("/quotes/", json=payload, cookies=cookies)
    assert response.status_code == 201, (
        f"Expected 201, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert "quote_number" in data
    assert data["quote_number"].startswith("EZJ-")
    assert data["client_name"] == "easyJet"
    assert data["status"] == "draft"


@pytest.mark.asyncio
async def test_quote_project_id_nullable(async_client, test_admin_user):
    """PROJ-03 foundation: a quote created without a project_id is valid.

    Migration 009 adds a nullable quotes.project_id FK. The save-flow wiring
    that populates it lands in Phase 7, so a quote created through the existing
    POST /quotes/ path carries no project linkage (project_id None/absent) and
    must still create successfully -- proving a project-less quote stays valid.
    """
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    payload = _make_quote_payload()
    response = await async_client.post("/quotes/", json=payload, cookies=cookies)
    assert response.status_code == 201, (
        f"Expected 201, got {response.status_code}: {response.text}"
    )
    data = response.json()
    # Null linkage is valid: the key is either absent or explicitly None.
    assert data.get("project_id") in (None,)


# ---- QUOT-02: Immutability ----


@pytest.mark.asyncio
async def test_quote_immutable(async_client, test_admin_user, test_quote):
    """Verify no PUT endpoint exists for updating quote snapshot columns.

    Attempting to PUT on /quotes/{id} should return 405 Method Not Allowed
    (since only PATCH /quotes/{id}/status is provided for status changes).
    """
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.put(
        "/quotes/1",
        json={"pricing_config_snapshot": {"modified": True}},
        cookies=cookies,
    )
    # No PUT endpoint should exist -- expect 405 Method Not Allowed
    assert response.status_code == 405, (
        f"Expected 405 for PUT on quote (immutability), got {response.status_code}"
    )


# ---- QUOT-03: List Quotes with Search ----


@pytest.mark.asyncio
async def test_list_quotes_filtered(async_client, test_admin_user, test_quote):
    """GET /quotes?search=EZJ returns filtered results matching client code."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/quotes/?search=EZJ", cookies=cookies)
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert isinstance(data, dict)
    assert "items" in data
    assert len(data["items"]) >= 1
    assert data["items"][0]["client_code"] == "EZJ"

    # Also test status filter returns it
    response_draft = await async_client.get(
        "/quotes/?status=draft", cookies=cookies
    )
    assert response_draft.status_code == 200
    draft_data = response_draft.json()
    assert len(draft_data["items"]) >= 1

    # Status=sent should return empty (test_quote is draft)
    response_sent = await async_client.get(
        "/quotes/?status=sent", cookies=cookies
    )
    assert response_sent.status_code == 200
    sent_data = response_sent.json()
    assert len(sent_data["items"]) == 0


# ---- QUOT-03 (MSN filter): List Quotes by MSN ----


@pytest.mark.asyncio
async def test_list_quotes_by_msn(async_client, test_admin_user, test_quote):
    """GET /quotes?msn=3055 returns quotes containing that MSN.

    Validates the MSN filter using the GIN index on msn_list.
    test_quote has msn_list=[3055, 3378].
    """
    cookies = await _login(async_client, "admin@test.com", "adminpass123")

    # MSN 3055 is in the quote's msn_list
    response = await async_client.get("/quotes/?msn=3055", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    assert 3055 in data["items"][0]["msn_list"]

    # MSN 9999 is not in any quote
    response_empty = await async_client.get("/quotes/?msn=9999", cookies=cookies)
    assert response_empty.status_code == 200
    empty_data = response_empty.json()
    assert len(empty_data["items"]) == 0


# ---- QUOT-04: Get Quote Detail ----


@pytest.mark.asyncio
async def test_get_quote_detail(
    async_client, test_admin_user, test_quote, test_quote_msn_snapshot
):
    """GET /quotes/{id} returns full quote with msn_snapshots."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/quotes/1", cookies=cookies)
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data["quote_number"] == "EZJ-001"
    assert "pricing_config_snapshot" in data
    assert "crew_config_snapshot" in data
    assert "costs_config_snapshot" in data
    assert "dashboard_state" in data
    assert "msn_snapshots" in data
    assert len(data["msn_snapshots"]) >= 1
    assert data["msn_snapshots"][0]["msn"] == 3055


# ---- QUOT-05: Update Status ----


@pytest.mark.asyncio
async def test_update_status(async_client, test_admin_user, test_quote):
    """PATCH /quotes/{id}/status with valid status returns updated quote."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.patch(
        "/quotes/1/status",
        json={"status": "sent"},
        cookies=cookies,
    )
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data["status"] == "sent"


@pytest.mark.asyncio
async def test_update_status_unauthorized(
    async_client, test_admin_user, test_regular_user, test_quote
):
    """PATCH /quotes/{id}/status by non-creator non-admin gets 403.

    test_quote was created by admin (id=1). Regular user (id=2) should
    not be allowed to change the status.
    """
    cookies = await _login(async_client, "user@test.com", "userpass123")
    response = await async_client.patch(
        "/quotes/1/status",
        json={"status": "accepted"},
        cookies=cookies,
    )
    assert response.status_code == 403, (
        f"Expected 403 for non-creator status update, got {response.status_code}"
    )


# ---- QUOT-03 (additional): List by Status ----


@pytest.mark.asyncio
async def test_list_quotes_by_status(async_client, test_admin_user, test_quote):
    """GET /quotes?status=draft returns only draft quotes.

    Create a second quote and update it to 'sent', then verify
    filtering returns correct counts for each status.
    """
    cookies = await _login(async_client, "admin@test.com", "adminpass123")

    # test_quote is already draft. Create a second one and update to sent.
    payload = _make_quote_payload(client_name="Ryanair", client_code="RYR", msn=3378)
    create_resp = await async_client.post("/quotes/", json=payload, cookies=cookies)
    assert create_resp.status_code == 201
    new_id = create_resp.json()["id"]

    # Update the new quote's status to sent
    patch_resp = await async_client.patch(
        f"/quotes/{new_id}/status",
        json={"status": "sent"},
        cookies=cookies,
    )
    assert patch_resp.status_code == 200

    # Filter by draft -- should return 1 (the original test_quote)
    draft_resp = await async_client.get("/quotes/?status=draft", cookies=cookies)
    assert draft_resp.status_code == 200
    draft_data = draft_resp.json()
    assert len(draft_data["items"]) == 1
    assert draft_data["items"][0]["status"] == "draft"

    # Filter by sent -- should return 1 (the newly created quote)
    sent_resp = await async_client.get("/quotes/?status=sent", cookies=cookies)
    assert sent_resp.status_code == 200
    sent_data = sent_resp.json()
    assert len(sent_data["items"]) == 1
    assert sent_data["items"][0]["status"] == "sent"
