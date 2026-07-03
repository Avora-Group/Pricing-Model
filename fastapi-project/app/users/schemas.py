from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str | None = None
    role: Literal["admin", "user", "viewer"] = "user"
    full_name: str | None = None
    can_view_costs: bool = False


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    role: Literal["admin", "user", "viewer"] | None = None
    is_active: bool | None = None
    can_view_costs: bool | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str
