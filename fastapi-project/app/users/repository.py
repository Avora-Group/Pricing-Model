from __future__ import annotations

from app.db.base_repository import BaseRepository


class UserRepository(BaseRepository):
    """Repository for users table operations."""

    async def fetch_by_email(self, email: str) -> dict | None:
        """Fetch an active user by email address (case-insensitive)."""
        return await self.fetch_one(
            "SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE", email
        )

    async def fetch_by_azure_id(self, azure_id: str) -> dict | None:
        """Fetch an active user by Azure AD object ID."""
        return await self.fetch_one(
            "SELECT * FROM users WHERE azure_id = $1 AND is_active = TRUE", azure_id
        )

    async def create_azure_user(
        self,
        email: str,
        azure_id: str | None,
        full_name: str | None = None,
        role: str = "user",
        can_view_costs: bool = False,
    ) -> dict:
        """Create a user authenticated via Azure AD (no password)."""
        return await self.fetch_one(
            """INSERT INTO users (email, hashed_password, azure_id, role, full_name, can_view_costs)
               VALUES ($1, NULL, $2, $3, $4, $5)
               RETURNING *""",
            email,
            azure_id,
            role,
            full_name,
            can_view_costs,
        )

    async def fetch_by_id(self, user_id: int) -> dict | None:
        """Fetch a user by primary key (regardless of active status)."""
        return await self.fetch_one(
            "SELECT * FROM users WHERE id = $1", user_id
        )

    async def create_user(
        self,
        email: str,
        hashed_password: str,
        role: str = "user",
        full_name: str | None = None,
        can_view_costs: bool = False,
    ) -> dict:
        """Insert a new user and return the full row."""
        return await self.fetch_one(
            """INSERT INTO users (email, hashed_password, role, full_name, can_view_costs)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *""",
            email,
            hashed_password,
            role,
            full_name,
            can_view_costs,
        )

    async def list_users(self) -> list[dict]:
        """Return all users ordered by creation date descending."""
        return await self.fetch_many(
            "SELECT * FROM users ORDER BY created_at DESC"
        )

    async def update_user(self, user_id: int, **fields) -> dict | None:
        """Update specified fields on a user. Always updates updated_at."""
        if not fields:
            return await self.fetch_by_id(user_id)

        # Build dynamic SET clause
        set_parts = []
        args = []
        for i, (key, value) in enumerate(fields.items(), start=1):
            set_parts.append(f"{key} = ${i}")
            args.append(value)

        # Always update updated_at
        set_parts.append(f"updated_at = NOW()")

        set_clause = ", ".join(set_parts)
        args.append(user_id)
        id_param = f"${len(args)}"

        return await self.fetch_one(
            f"UPDATE users SET {set_clause} WHERE id = {id_param} RETURNING *",
            *args,
        )

    async def deactivate_user(self, user_id: int) -> None:
        """Soft-delete a user by setting is_active=False."""
        await self.execute(
            "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
            user_id,
        )
