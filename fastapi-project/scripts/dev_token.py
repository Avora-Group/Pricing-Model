"""Local-dev helper: mint a signed access token for an existing user.

The app has no password login (Azure AD SSO only), which makes a local
instance impossible to log into without Azure env config. This script uses
the backend's own signer (JWT_SECRET) to mint the same cookie the Azure
callback would set. Paste the printed `document.cookie` line into the
browser console on http://localhost:3000/login, then navigate anywhere.

Usage (stack must be up):
    docker compose exec api python scripts/dev_token.py                 # admin@acmi.com
    docker compose exec api python scripts/dev_token.py user@email.com  # any seeded user
"""
from __future__ import annotations

import asyncio
import os
import sys

import asyncpg

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth.service import create_access_token  # noqa: E402


async def main() -> None:
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@acmi.com"
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT id, role, is_active FROM users WHERE email = $1", email
    )
    await conn.close()
    if row is None:
        print(f"No user with email {email!r} — check the users table.")
        sys.exit(1)
    if not row["is_active"]:
        print(f"User {email!r} is inactive — activate it first.")
        sys.exit(1)

    token = create_access_token(row["id"], row["role"])
    print(f"# Token for {email} (role: {row['role']})")
    print("# Paste into the browser console on http://localhost:3000/login :")
    print(f'document.cookie = "access_token={token}; path=/"; location.href = "/dashboard"')


if __name__ == "__main__":
    asyncio.run(main())
