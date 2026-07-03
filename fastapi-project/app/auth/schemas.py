from __future__ import annotations

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: str  # OAuth2PasswordRequestForm uses 'username' field
    password: str


class AzureLoginRequest(BaseModel):
    email: EmailStr
    full_name: str | None = None
    azure_id: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    full_name: str | None
    is_active: bool
    can_view_costs: bool = False
