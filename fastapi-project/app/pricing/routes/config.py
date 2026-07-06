"""Pricing and crew configuration CRUD endpoints.

Endpoints:
- GET  /config: Get current pricing config
- GET  /config/{version_id}: Get specific config version
- PUT  /config: Create new config version (admin only)
- GET  /crew-config: Get all current crew configs
- PUT  /crew-config: Create new crew config version (admin only)
"""
from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user, require_editor
from app.db.database import get_db
from app.pricing.repository import (
    CrewConfigRepository,
    PricingConfigRepository,
)
from app.pricing.schemas import (
    CrewConfigResponse,
    PricingConfigResponse,
    UpdateCrewConfigRequest,
    UpdatePricingConfigRequest,
)


router = APIRouter()


# ---- Pricing Config Endpoints ----


@router.get("/config", response_model=PricingConfigResponse)
async def get_pricing_config(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Get the current (active) pricing configuration."""
    repo = PricingConfigRepository(db)
    config = await repo.get_current()
    if not config:
        raise HTTPException(status_code=404, detail="No pricing config found")
    return config


@router.get("/config/{version_id}", response_model=PricingConfigResponse)
async def get_pricing_config_version(
    version_id: int,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Get a specific pricing config version by id."""
    repo = PricingConfigRepository(db)
    config = await repo.get_version(version_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config version not found")
    return config


@router.put("/config", response_model=PricingConfigResponse)
async def update_pricing_config(
    body: UpdatePricingConfigRequest,
    editor_user: dict = Depends(require_editor),
    db: asyncpg.Connection = Depends(get_db),
):
    """Create a new pricing config version (admin only, append-only)."""
    repo = PricingConfigRepository(db)
    fields = body.model_dump(exclude_none=True)
    new_config = await repo.create_version(created_by=editor_user["id"], **fields)
    return new_config


# ---- Crew Config Endpoints ----


@router.get("/crew-config", response_model=list[CrewConfigResponse])
async def get_crew_config(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Get all current crew configs (A320 + A321)."""
    repo = CrewConfigRepository(db)
    configs = await repo.get_all_current()
    return configs


@router.put("/crew-config", response_model=CrewConfigResponse)
async def update_crew_config(
    body: UpdateCrewConfigRequest,
    editor_user: dict = Depends(require_editor),
    db: asyncpg.Connection = Depends(get_db),
):
    """Create a new crew config version for an aircraft type (admin only)."""
    repo = CrewConfigRepository(db)
    fields = body.model_dump(exclude_none=True)
    aircraft_type = fields.pop("aircraft_type")
    new_config = await repo.create_version(
        aircraft_type=aircraft_type,
        created_by=editor_user["id"],
        **fields,
    )
    return new_config
