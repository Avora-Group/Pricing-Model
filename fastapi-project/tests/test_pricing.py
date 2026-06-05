"""Integration tests for pricing API endpoints (PRIC-01, CONF-01, CONF-02, CONF-03).

Tests verify the full HTTP request/response cycle through the FastAPI app
with a mocked database. Auth cookies are obtained by logging in through
the /auth/login endpoint.

Covers: calculation endpoint, config CRUD with versioning, crew config CRUD,
project management, and MSN input management.
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


# ---- Pricing Config Endpoints ----


async def test_get_pricing_config(
    async_client, test_admin_user, test_pricing_config
):
    """GET /pricing/config returns current pricing config with all fields."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/pricing/config", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 1
    assert data["is_current"] is True
    assert "exchange_rate" in data
    assert "insurance_usd" in data
    assert "average_active_fleet" in data


async def test_get_pricing_config_no_auth(async_client):
    """GET /pricing/config without auth returns 401."""
    response = await async_client.get("/pricing/config")
    assert response.status_code == 401


async def test_update_pricing_config_admin(
    async_client, test_admin_user, test_pricing_config
):
    """PUT /pricing/config with admin creates new version, returns version+1."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.put(
        "/pricing/config",
        json={"insurance_usd": "50000.00"},
        cookies=cookies,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 2
    assert data["is_current"] is True
    assert Decimal(data["insurance_usd"]) == Decimal("50000.00")


async def test_update_pricing_config_forbidden(
    async_client, test_regular_user, test_pricing_config
):
    """PUT /pricing/config without admin returns 403."""
    cookies = await _login(async_client, "user@test.com", "userpass123")
    response = await async_client.put(
        "/pricing/config",
        json={"insurance_usd": "50000.00"},
        cookies=cookies,
    )
    assert response.status_code == 403


async def test_config_versioning_preserves_old(
    async_client, test_admin_user, test_pricing_config
):
    """PUT /pricing/config preserves previous version (CONF-02, CONF-03).

    After creating version 2, version 1 must still be retrievable with
    its original values unchanged.
    """
    cookies = await _login(async_client, "admin@test.com", "adminpass123")

    # Get version 1 original values
    resp_v1 = await async_client.get("/pricing/config", cookies=cookies)
    v1_data = resp_v1.json()
    original_insurance = v1_data["insurance_usd"]
    v1_id = v1_data["id"]

    # Update to version 2 with different insurance
    await async_client.put(
        "/pricing/config",
        json={"insurance_usd": "99999.99"},
        cookies=cookies,
    )

    # Retrieve version 1 by id -- should have original values
    resp_old = await async_client.get(
        f"/pricing/config/{v1_id}", cookies=cookies
    )
    assert resp_old.status_code == 200
    old_data = resp_old.json()
    assert old_data["version"] == 1
    assert old_data["insurance_usd"] == original_insurance


async def test_get_config_version_by_id(
    async_client, test_admin_user, test_pricing_config
):
    """GET /pricing/config/{version_id} returns specific version."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/pricing/config/1", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["version"] == 1


# ---- Crew Config Endpoints ----


async def test_get_crew_config(
    async_client, test_admin_user, test_crew_config
):
    """GET /pricing/crew-config returns list of current crew configs (A320 + A321)."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.get("/pricing/crew-config", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    types = {item["aircraft_type"] for item in data}
    assert types == {"A320", "A321"}


async def test_update_crew_config_admin(
    async_client, test_admin_user, test_crew_config
):
    """PUT /pricing/crew-config with admin creates new crew config version."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.put(
        "/pricing/crew-config",
        json={
            "aircraft_type": "A320",
            "pilot_salary_monthly": "14000.00",
        },
        cookies=cookies,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 2
    assert Decimal(data["pilot_salary_monthly"]) == Decimal("14000.00")
    assert data["aircraft_type"] == "A320"


async def test_update_crew_config_forbidden(
    async_client, test_regular_user, test_crew_config
):
    """PUT /pricing/crew-config without admin returns 403."""
    cookies = await _login(async_client, "user@test.com", "userpass123")
    response = await async_client.put(
        "/pricing/crew-config",
        json={
            "aircraft_type": "A320",
            "pilot_salary_monthly": "14000.00",
        },
        cookies=cookies,
    )
    assert response.status_code == 403


# ---- Project Endpoints ----


async def test_create_project(
    async_client, test_admin_user, test_pricing_config, test_crew_config
):
    """POST /pricing/projects creates a new project with auto-assigned config versions."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.post(
        "/pricing/projects",
        json={"name": "Test Project"},
        cookies=cookies,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert "id" in data
    assert data["config_version_id"] is not None
    assert data["status"] == "potential"
    assert data["status_source"] == "manual"
    assert data["signed_at"] is None


async def test_list_projects(
    async_client, test_admin_user, test_pricing_config, test_crew_config
):
    """GET /pricing/projects lists user's projects."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")

    # Create a project first
    await async_client.post(
        "/pricing/projects",
        json={"name": "My Project"},
        cookies=cookies,
    )

    response = await async_client.get("/pricing/projects", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["name"] == "My Project"
    assert "status" in data[0]
    assert "status_source" in data[0]
    assert "signed_at" in data[0]


async def test_get_project_detail(
    async_client, test_admin_user, test_pricing_config, test_crew_config
):
    """GET /pricing/projects/{id} returns project with MSN inputs."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")

    # Create project
    resp = await async_client.post(
        "/pricing/projects",
        json={"name": "Detail Test"},
        cookies=cookies,
    )
    project_id = resp.json()["id"]

    response = await async_client.get(
        f"/pricing/projects/{project_id}", cookies=cookies
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == project_id
    assert data["name"] == "Detail Test"
    assert "msn_inputs" in data
    assert isinstance(data["msn_inputs"], list)
    assert data["status"] == "potential"
    assert data["status_source"] == "manual"
    assert data["signed_at"] is None


async def test_project_status_update(mock_db):
    """ProjectRepository.update_project round-trips status/provenance (PROJ-05)."""
    from datetime import datetime, timezone

    from app.pricing.repository import ProjectRepository

    repo = ProjectRepository(mock_db)

    # Seed a potential project via the repository create path.
    created = await repo.create_project(created_by=1, name="Status Test")
    assert created["status"] == "potential"
    assert created["status_source"] == "manual"
    assert created["signed_at"] is None

    signed_ts = datetime.now(timezone.utc)
    updated = await repo.update_project(
        created["id"],
        status="signed",
        status_source="automatic",
        signed_at=signed_ts,
    )
    assert updated["status"] == "signed"
    assert updated["status_source"] == "automatic"
    assert updated["signed_at"] is not None


# ---- MSN Input Endpoints ----


async def test_add_msn_input(
    async_client,
    test_admin_user,
    test_aircraft_data,
    test_pricing_config,
    test_crew_config,
):
    """POST /pricing/projects/{id}/msn adds MSN input to project."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")

    # Create project
    resp = await async_client.post(
        "/pricing/projects",
        json={"name": "MSN Test"},
        cookies=cookies,
    )
    project_id = resp.json()["id"]

    response = await async_client.post(
        f"/pricing/projects/{project_id}/msn",
        json={
            "aircraft_id": 1,
            "mgh": "350",
            "cycle_ratio": "1.0",
            "environment": "benign",
        },
        cookies=cookies,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == project_id
    assert data["aircraft_id"] == 1
    assert Decimal(data["mgh"]) == Decimal("350")


async def test_update_msn_input(
    async_client,
    test_admin_user,
    test_aircraft_data,
    test_pricing_config,
    test_crew_config,
):
    """PUT /pricing/projects/{id}/msn/{input_id} updates MSN input."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")

    # Create project + MSN input
    resp = await async_client.post(
        "/pricing/projects",
        json={"name": "Update Test"},
        cookies=cookies,
    )
    project_id = resp.json()["id"]

    msn_resp = await async_client.post(
        f"/pricing/projects/{project_id}/msn",
        json={
            "aircraft_id": 1,
            "mgh": "350",
            "cycle_ratio": "1.0",
            "environment": "benign",
        },
        cookies=cookies,
    )
    input_id = msn_resp.json()["id"]

    response = await async_client.put(
        f"/pricing/projects/{project_id}/msn/{input_id}",
        json={"mgh": "400"},
        cookies=cookies,
    )
    assert response.status_code == 200
    data = response.json()
    assert Decimal(data["mgh"]) == Decimal("400")


async def test_delete_msn_input(
    async_client,
    test_admin_user,
    test_aircraft_data,
    test_pricing_config,
    test_crew_config,
):
    """DELETE /pricing/projects/{id}/msn/{input_id} removes MSN input."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")

    # Create project + MSN input
    resp = await async_client.post(
        "/pricing/projects",
        json={"name": "Delete Test"},
        cookies=cookies,
    )
    project_id = resp.json()["id"]

    msn_resp = await async_client.post(
        f"/pricing/projects/{project_id}/msn",
        json={
            "aircraft_id": 1,
            "mgh": "350",
            "cycle_ratio": "1.0",
            "environment": "benign",
        },
        cookies=cookies,
    )
    input_id = msn_resp.json()["id"]

    response = await async_client.delete(
        f"/pricing/projects/{project_id}/msn/{input_id}",
        cookies=cookies,
    )
    assert response.status_code == 200

    # Verify deleted -- project detail should show 0 msn_inputs
    detail = await async_client.get(
        f"/pricing/projects/{project_id}", cookies=cookies
    )
    assert len(detail.json()["msn_inputs"]) == 0


# ---- Calculate Endpoint ----


async def test_calculate_pricing(
    async_client,
    test_admin_user,
    test_aircraft_data,
    test_pricing_config,
    test_crew_config,
):
    """POST /pricing/calculate with valid inputs returns 200 with results."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.post(
        "/pricing/calculate",
        json={
            "exchange_rate": "0.85",
            "margin_percent": "10",
            "msn_inputs": [
                {
                    "msn": 3055,
                    "mgh": "350",
                    "cycle_ratio": "1.0",
                    "environment": "benign",
                    "period_months": 12,
                    "lease_type": "wet",
                    "crew_sets": 4,
                }
            ],
        },
        cookies=cookies,
    )
    assert response.status_code == 200
    data = response.json()
    assert "msn_results" in data
    assert len(data["msn_results"]) == 1
    result = data["msn_results"][0]
    assert result["msn"] == 3055
    assert result["aircraft_type"] == "A320"
    assert "breakdown" in result
    breakdown = result["breakdown"]
    # All 7 components present
    assert "aircraft_eur_per_bh" in breakdown
    assert "crew_eur_per_bh" in breakdown
    assert "maintenance_eur_per_bh" in breakdown
    assert "insurance_eur_per_bh" in breakdown
    assert "doc_eur_per_bh" in breakdown
    assert "other_cogs_eur_per_bh" in breakdown
    assert "overhead_eur_per_bh" in breakdown
    assert "total_cost_per_bh" in breakdown
    assert "final_rate_per_bh" in breakdown
    # Values are positive
    assert Decimal(breakdown["total_cost_per_bh"]) > 0
    assert Decimal(breakdown["final_rate_per_bh"]) > Decimal(
        breakdown["total_cost_per_bh"]
    )  # Margin makes final_rate > cost


async def test_calculate_pricing_invalid_msn(
    async_client,
    test_admin_user,
    test_aircraft_data,
    test_pricing_config,
    test_crew_config,
):
    """POST /pricing/calculate with invalid MSN returns 404."""
    cookies = await _login(async_client, "admin@test.com", "adminpass123")
    response = await async_client.post(
        "/pricing/calculate",
        json={
            "exchange_rate": "0.85",
            "msn_inputs": [
                {
                    "msn": 9999,
                    "mgh": "350",
                    "cycle_ratio": "1.0",
                    "environment": "benign",
                }
            ],
        },
        cookies=cookies,
    )
    assert response.status_code == 404


async def test_calculate_pricing_no_auth(async_client):
    """POST /pricing/calculate without auth returns 401."""
    response = await async_client.post(
        "/pricing/calculate",
        json={
            "exchange_rate": "0.85",
            "msn_inputs": [
                {
                    "msn": 3055,
                    "mgh": "350",
                    "cycle_ratio": "1.0",
                    "environment": "benign",
                }
            ],
        },
    )
    assert response.status_code == 401
