# Local development

Hybrid setup: database + API in Docker, frontend natively (fast hot reload).

## 1. Backend stack

```bash
docker compose up --build
```

Brings up:

| Service | What | Port |
|---|---|---|
| `db` | Postgres 16 (`acmi_platform`, postgres/postgres) | 5432 |
| `api` | FastAPI (root `Dockerfile`) — runs its SQL migrations on startup | 8000 |
| `seed` | One-shot: seeds the 11-MSN fleet + pricing config, then exits | — |

Health check: <http://localhost:8000/health>

Data persists in the `pgdata` volume across restarts. `docker compose down -v` wipes it (next `up` re-migrates and re-seeds from scratch).

## 2. Frontend

```bash
cd nextjs-project
npm install        # first time only
npm run dev
```

<http://localhost:3000> — no `.env` needed: `API_URL` defaults to `http://localhost:8000`, and the auth middleware only decodes the JWT cookie (the backend signs and verifies it).

## 3. Logging in locally

The app authenticates via **Azure AD SSO only** — there is no password login, and Azure isn't configured for localhost. Instead, mint a signed dev token with the backend's own signer (stack must be up):

```bash
docker compose exec api python scripts/dev_token.py
```

It prints a `document.cookie = "access_token=…"` line. Open <http://localhost:3000/login>, paste that line into the browser devtools console, and you land on the dashboard as `admin@acmi.com` (admin, full cost visibility). Tokens are valid for days; repeat when expired. Pass an email argument for a different seeded user.

## Notes

- The production deployment (Railway) does not use `docker-compose.yml`; it builds the root `Dockerfile` per `railway.json`. The compose file is local-only.
- The API image bundles `app/`, `migrations/`, and `scripts/` — code changes in `fastapi-project/` need a `docker compose up --build` to take effect.
