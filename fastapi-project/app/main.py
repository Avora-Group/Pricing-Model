import pathlib
import subprocess
import sys
import traceback
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import create_pool

print(f"[startup] Module loaded. DATABASE_URL host: {settings.database_url.split('@')[-1] if '@' in settings.database_url else 'no-auth-in-url'}", flush=True)


async def run_migrations(pool: asyncpg.Pool) -> None:
    """Run SQL migration files in order on startup.

    Uses a PostgreSQL advisory lock to prevent race conditions when
    multiple gunicorn workers start simultaneously.
    """
    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    if not migrations_dir.exists():
        print("[startup] No migrations directory found", flush=True)
        return

    async with pool.acquire() as conn:
        # Advisory lock prevents multiple workers from running migrations concurrently
        await conn.execute("SELECT pg_advisory_lock(1)")
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS _migrations (
                    filename TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)

            applied = {row["filename"] for row in await conn.fetch("SELECT filename FROM _migrations")}

            for sql_file in sorted(migrations_dir.glob("*.sql")):
                if sql_file.name not in applied:
                    print(f"[startup] Running migration: {sql_file.name}", flush=True)
                    sql = sql_file.read_text()
                    async with conn.transaction():
                        await conn.execute(sql)
                        await conn.execute("INSERT INTO _migrations (filename) VALUES ($1)", sql_file.name)
        finally:
            await conn.execute("SELECT pg_advisory_unlock(1)")

    print("[startup] Migrations complete", flush=True)


def run_seed_script() -> None:
    """Run the aircraft seed script if it exists (idempotent — uses upserts)."""
    seed_path = pathlib.Path(__file__).parent.parent / "scripts" / "seed_aircraft.py"
    if not seed_path.exists():
        return
    try:
        subprocess.run(
            [sys.executable, str(seed_path)],
            check=True,
            timeout=60,
        )
    except Exception as e:
        print(f"[startup] Seed script warning: {e}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: create DB pool on startup, close on shutdown."""
    app.state.pool = None
    try:
        print(f"[startup] Connecting to database...", flush=True)
        app.state.pool = await create_pool(settings.database_url)
        print("[startup] Database pool created", flush=True)
        await run_migrations(app.state.pool)
        run_seed_script()
        print("[startup] Ready", flush=True)
    except Exception as e:
        print(f"[startup] ERROR during startup: {e}", flush=True)
        traceback.print_exc()
    yield
    if app.state.pool:
        await app.state.pool.close()


app = FastAPI(
    title="ACMI Pricing Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration — explicit origin required when allow_credentials=True
# NEVER use allow_origins=["*"] with allow_credentials=True — browsers reject this
origins = [settings.frontend_url]
if settings.allowed_origins:
    origins.extend(o.strip() for o in settings.allowed_origins.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "db": "connected" if app.state.pool else "unavailable"}


# Router includes
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.aircraft.router import router as aircraft_router
from app.pricing.router import router as pricing_router
from app.quotes.router import router as quotes_router
from app.assumptions.router import router as assumptions_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(aircraft_router)
app.include_router(pricing_router)
app.include_router(quotes_router)
app.include_router(assumptions_router)
