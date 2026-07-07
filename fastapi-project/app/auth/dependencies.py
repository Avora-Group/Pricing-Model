from __future__ import annotations

import asyncpg
from fastapi import Cookie, Depends, HTTPException

from app.db.database import get_db
from app.auth.service import decode_access_token
from app.users.repository import UserRepository


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Extract JWT from cookie, decode it, and return the user dict.

    Raises HTTPException(401) if:
    - No access_token cookie present
    - Token is invalid or expired
    - User ID from token not found in database
    - User account is deactivated
    """
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(access_token)
    user_id = int(payload["sub"])
    user_repo = UserRepository(db)
    user = await user_repo.fetch_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account deactivated")
    return user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures the current user has admin role.

    Raises HTTPException(403) if user is not an admin. Reserved for user
    management (the Admin tab).
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_editor(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency for write access to pricing data (admin or user roles).

    Users have the same rights as admins except user management (Admin tab) and
    implicit cost visibility. Viewers are read-only and are rejected with 403.
    """
    if current_user["role"] not in ("admin", "user"):
        raise HTTPException(status_code=403, detail="Edit access required")
    return current_user


def user_can_view_costs(user: dict) -> bool:
    """Base cost visibility — current-rate cost / margin / profit figures.

    Visible to admins and users; viewers are read-only and get cost/margin
    fields omitted from API responses (enforced server-side, never client-only).
    """
    return user.get("role") in ("admin", "user")


def user_can_view_naked(user: dict) -> bool:
    """Naked-rate access — the reduced 'naked' cost basis, its toggle, and any
    naked-derived figures.

    Admins implicitly; ``user`` role only when explicitly granted
    ``can_view_costs``. Viewers never get naked access. This is strictly
    narrower than base cost visibility.
    """
    role = user.get("role")
    if role == "admin":
        return True
    return role == "user" and bool(user.get("can_view_costs"))
