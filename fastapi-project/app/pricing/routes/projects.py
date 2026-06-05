"""Project and MSN input CRUD endpoints.

Endpoints:
- POST   /projects: Create pricing project
- GET    /projects: List user's projects
- GET    /projects/{id}: Get project with MSN inputs
- POST   /projects/{id}/msn: Add MSN input
- PUT    /projects/{id}/msn/{input_id}: Update MSN input
- DELETE /projects/{id}/msn/{input_id}: Remove MSN input
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user
from app.db.database import get_db
from app.pricing.repository import (
    CrewConfigRepository,
    PricingConfigRepository,
    ProjectRepository,
)
from app.pricing.schemas import (
    AddMsnInputRequest,
    CreateProjectRequest,
    MsnInputResponse,
    ProjectResponse,
    UpdateProjectStatusRequest,
)


router = APIRouter()


# ---- Project Endpoints ----


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    body: CreateProjectRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Create a new pricing project with auto-attached config version IDs."""
    pricing_repo = PricingConfigRepository(db)
    crew_repo = CrewConfigRepository(db)
    project_repo = ProjectRepository(db)

    # Auto-attach current config versions
    pricing_config = await pricing_repo.get_current()
    config_version_id = pricing_config["id"] if pricing_config else None

    crew_configs = await crew_repo.get_all_current()
    crew_config_a320_id = None
    crew_config_a321_id = None
    for cc in crew_configs:
        if cc["aircraft_type"] == "A320":
            crew_config_a320_id = cc["id"]
        elif cc["aircraft_type"] == "A321":
            crew_config_a321_id = cc["id"]

    project = await project_repo.create_project(
        created_by=current_user["id"],
        name=body.name,
        config_version_id=config_version_id,
        crew_config_a320_id=crew_config_a320_id,
        crew_config_a321_id=crew_config_a321_id,
    )

    return ProjectResponse(
        id=project["id"],
        name=project.get("name"),
        exchange_rate=project.get("exchange_rate", Decimal("0.85")),
        margin_percent=project.get("margin_percent", Decimal("0")),
        config_version_id=project.get("config_version_id"),
        status=project.get("status", "potential"),
        status_source=project.get("status_source", "manual"),
        signed_at=project.get("signed_at"),
        msn_inputs=[],
    )


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """List the current user's pricing projects."""
    project_repo = ProjectRepository(db)
    projects = await project_repo.list_projects(current_user["id"])

    result = []
    for p in projects:
        # Fetch MSN inputs for each project
        msn_inputs = await project_repo.get_msn_inputs(p["id"])
        result.append(
            ProjectResponse(
                id=p["id"],
                name=p.get("name"),
                exchange_rate=p.get("exchange_rate", Decimal("0.85")),
                margin_percent=p.get("margin_percent", Decimal("0")),
                config_version_id=p.get("config_version_id"),
                status=p.get("status", "potential"),
                status_source=p.get("status_source", "manual"),
                signed_at=p.get("signed_at"),
                msn_inputs=[MsnInputResponse(**mi) for mi in msn_inputs],
            )
        )
    return result


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Get a project with its MSN inputs."""
    project_repo = ProjectRepository(db)
    project = await project_repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    msn_inputs = await project_repo.get_msn_inputs(project_id)

    return ProjectResponse(
        id=project["id"],
        name=project.get("name"),
        exchange_rate=project.get("exchange_rate", Decimal("0.85")),
        margin_percent=project.get("margin_percent", Decimal("0")),
        config_version_id=project.get("config_version_id"),
        status=project.get("status", "potential"),
        status_source=project.get("status_source", "manual"),
        signed_at=project.get("signed_at"),
        msn_inputs=[MsnInputResponse(**mi) for mi in msn_inputs],
    )


@router.patch("/projects/{project_id}/status", response_model=ProjectResponse)
async def update_project_status(
    project_id: int,
    body: UpdateProjectStatusRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Manually set a project's pipeline status (potential / signed / active).

    Stamps status_source='manual'. signed_at is set on the first transition
    to 'signed' and preserved afterwards.
    """
    project_repo = ProjectRepository(db)
    project = await project_repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    fields: dict = {"status": body.status, "status_source": "manual"}
    if body.status == "signed" and not project.get("signed_at"):
        fields["signed_at"] = datetime.now(timezone.utc)

    updated = await project_repo.update_project(project_id, **fields)
    msn_inputs = await project_repo.get_msn_inputs(project_id)

    return ProjectResponse(
        id=updated["id"],
        name=updated.get("name"),
        exchange_rate=updated.get("exchange_rate", Decimal("0.85")),
        margin_percent=updated.get("margin_percent", Decimal("0")),
        config_version_id=updated.get("config_version_id"),
        status=updated.get("status", "potential"),
        status_source=updated.get("status_source", "manual"),
        signed_at=updated.get("signed_at"),
        msn_inputs=[MsnInputResponse(**mi) for mi in msn_inputs],
    )


# ---- MSN Input Endpoints ----


@router.post("/projects/{project_id}/msn", response_model=MsnInputResponse)
async def add_msn_input(
    project_id: int,
    body: AddMsnInputRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Add an MSN input to a pricing project."""
    project_repo = ProjectRepository(db)

    # Verify project exists
    project = await project_repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    msn_input = await project_repo.add_msn_input(
        project_id,
        aircraft_id=body.aircraft_id,
        mgh=body.mgh,
        cycle_ratio=body.cycle_ratio,
        environment=body.environment,
        period_months=body.period_months,
        lease_type=body.lease_type,
        crew_sets=body.crew_sets,
    )
    return msn_input


@router.put(
    "/projects/{project_id}/msn/{input_id}",
    response_model=MsnInputResponse,
)
async def update_msn_input(
    project_id: int,
    input_id: int,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update an MSN input within a project."""
    project_repo = ProjectRepository(db)

    updated = await project_repo.update_msn_input(input_id, **body)
    if not updated:
        raise HTTPException(status_code=404, detail="MSN input not found")
    return updated


@router.delete("/projects/{project_id}/msn/{input_id}")
async def delete_msn_input(
    project_id: int,
    input_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Remove an MSN input from a project."""
    project_repo = ProjectRepository(db)
    await project_repo.delete_msn_input(input_id)
    return {"status": "deleted"}
