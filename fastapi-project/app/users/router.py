from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.db.database import get_db
from app.auth.schemas import UserResponse
from app.auth.service import hash_password
from app.auth.dependencies import require_admin
from app.users.repository import UserRepository
from app.users.schemas import CreateUserRequest, UpdateUserRequest, ResetPasswordRequest

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Create a new user account (admin only)."""
    user_repo = UserRepository(db)

    # Check for duplicate email
    existing = await user_repo.fetch_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if body.password:
        # Password-based user
        hashed = hash_password(body.password)
        user = await user_repo.create_user(
            email=body.email,
            hashed_password=hashed,
            role=body.role,
            full_name=body.full_name,
            can_view_costs=body.can_view_costs,
        )
    else:
        # Azure SSO invite (no password)
        user = await user_repo.create_azure_user(
            email=body.email,
            azure_id=None,
            full_name=body.full_name,
            role=body.role,
            can_view_costs=body.can_view_costs,
        )
    return user


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """List all users (admin only)."""
    user_repo = UserRepository(db)
    return await user_repo.list_users()


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Get a single user by ID (admin only)."""
    user_repo = UserRepository(db)
    user = await user_repo.fetch_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Update a user's fields (admin only)."""
    user_repo = UserRepository(db)

    # Build fields dict from non-None values
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    user = await user_repo.update_user(user_id, **fields)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}/password", status_code=204)
async def reset_password(
    user_id: int,
    body: ResetPasswordRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Reset a user's password (admin only)."""
    user_repo = UserRepository(db)
    user = await user_repo.fetch_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    hashed = hash_password(body.new_password)
    await user_repo.update_user(user_id, hashed_password=hashed)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Deactivate a user (soft delete, admin only)."""
    user_repo = UserRepository(db)
    user = await user_repo.fetch_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await user_repo.deactivate_user(user_id)
