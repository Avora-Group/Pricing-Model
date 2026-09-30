# Phase 1: Foundation and Authentication - Research

**Researched:** 2026-03-04
**Domain:** FastAPI + Next.js 16 + PostgreSQL authentication scaffold, Tailwind 4 sidebar UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login experience:**
- AeroVista-style login page: centered card, dark background, minimal branding
- Specific error messages: "Email not found" vs "Wrong password" (not generic "invalid credentials")
- Admin resets passwords only — no self-service "forgot password" flow, no email service needed
- No self-signup — admin creates all user accounts

**App shell layout:**
- Collapsible sidebar: icon-only mode when collapsed, full labels when expanded — matching AeroVista pattern
- All 5 navigation pages from day one: Dashboard, Pricing, Quotes, Aircraft, Admin
- Unbuilt pages show placeholder/empty states (not hidden)
- Exact AeroVista directory structure: separate `fastapi-project/` and `nextjs-project/` directories

**Auth architecture:**
- PyJWT 2.11.0 for JWT tokens (not python-jose — unmaintained)
- pwdlib[argon2] 0.3.0 for password hashing (not passlib — broken on Python 3.13)
- JWT stored in httpOnly cookie (decided: httpOnly cookie, not localStorage — security-first)
- Two roles: admin and standard user

**Established patterns (from AeroVista reference):**
- BaseRepository for DB, services layer for business logic, Zustand for state, Tailwind for styling
- Raw SQL via asyncpg with connection pool manager (app/db/database.py pattern)
- Pydantic schemas for request/response validation
- App Router (Next.js 14) for frontend routing

### Claude's Discretion
- "Remember me" behavior (checkbox vs always-remember vs session expiry duration)
- Top bar design (user info, logout, breadcrumbs, theme toggle placement)
- Loading skeleton and empty state designs for placeholder pages
- Exact spacing, typography, and color palette within AeroVista style constraints
- Database migration approach (raw SQL files vs migration tool)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in with company email and password | FastAPI `/auth/login` endpoint with PyJWT + pwdlib, specific error messages per decision |
| AUTH-02 | User session persists across browser refresh (JWT) | httpOnly cookie with 7-day expiry; Next.js middleware reads cookie on every request |
| AUTH-03 | User can log out from any page | Server Action calls FastAPI `/auth/logout` which clears cookie; middleware redirects |
| AUTH-04 | Admin can create and manage user accounts (no self-signup) | FastAPI `/admin/users` CRUD endpoints gated behind `is_admin` role check |
| UI-01 | Application has sidebar navigation with pages: Dashboard, Pricing, Quotes, Aircraft, Admin | Collapsible sidebar component using Zustand for collapse state, Tailwind 4 styling |
| UI-05 | Application matches AeroVista visual style (Tailwind, Zustand, component patterns) | Tailwind 4 CSS-first config, Zustand store, dark background (gray-950) palette |
</phase_requirements>

---

## Summary

This phase scaffolds a greenfield ACMI platform consisting of two co-located directories: `fastapi-project/` (Python FastAPI backend) and `nextjs-project/` (Next.js 16 frontend). The existing `acmi-app/` directory is a throwaway prototype — it uses Next.js 16 with Tailwind 4 (already CSS-first with `@import "tailwindcss"`) and React 19, and serves as styling reference only. The new project must be built fresh at root level, not extending the prototype.

The backend uses PyJWT 2.11.0 (not python-jose) and pwdlib[argon2] 0.3.0 (not passlib) — both locked decisions addressing specific unmaintained-library risks on Python 3.13. The database layer uses asyncpg raw SQL with a connection pool managed through FastAPI's lifespan context manager and a BaseRepository pattern. Authentication tokens are stored in httpOnly cookies; the FastAPI backend sets them on login and the Next.js middleware validates them on every protected route request.

The frontend is a Next.js 16 App Router application using Tailwind CSS 4 (CSS-first configuration, already confirmed from the prototype's `globals.css` using `@import "tailwindcss"` and `@tailwindcss/postcss`). The collapsible sidebar uses Zustand for toggle state persistence, with icon-only vs full-label modes. All five navigation pages are present from day one with placeholder content for unbuilt sections.

**Primary recommendation:** Build `fastapi-project/` and `nextjs-project/` directories at project root. Use the `acmi-app/` prototype's color palette and Tailwind 4 setup as the visual reference, but do not modify or extend it. The httpOnly cookie flow (FastAPI sets cookie → Next.js middleware reads it → Server Actions call FastAPI API) is the correct auth architecture.

---

## Standard Stack

### Core — Backend (fastapi-project/)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.115.x | ASGI web framework | Production-grade, async-first, OpenAPI built-in |
| uvicorn[standard] | 0.32.x | ASGI server | Standard fastapi deployment server |
| asyncpg | 0.30.x | Async PostgreSQL driver | Fastest Python async PG driver; raw SQL pattern from AeroVista |
| PyJWT | 2.11.0 | JWT encode/decode | Locked decision: maintained, python-jose is unmaintained |
| pwdlib[argon2] | 0.3.0 | Password hashing | Locked decision: passlib broken on Python 3.13; Argon2 is IETF-recommended |
| pydantic | 2.x | Request/response schemas | FastAPI native; v2 is current standard |
| pydantic-settings | 2.x | ENV-based config | Standard for FastAPI config management |
| python-multipart | 0.0.x | Form data parsing | Required for OAuth2PasswordRequestForm |

### Core — Frontend (nextjs-project/)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | React framework (App Router) | Locked — existing prototype version |
| react | 19.2.3 | UI framework | Locked — existing prototype version |
| typescript | 5.x | Type safety | Standard for Next.js projects |
| tailwindcss | 4.x | CSS utility framework | Locked — CSS-first config, confirmed from prototype |
| @tailwindcss/postcss | 4.x | PostCSS integration | Locked — confirmed from prototype postcss.config.mjs |
| zustand | 5.x | Client state management | Locked — AeroVista pattern |
| jose | 5.x | JWT verification in Next.js middleware | Edge Runtime compatible (unlike jsonwebtoken); used in Next.js official docs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | latest | Icons for sidebar nav | Standard icon library for React, Tailwind-friendly |
| zod | 3.x | Runtime validation | Form validation on frontend; already in node_modules |
| server-only | latest | Prevents server modules leaking to client | Use on all DAL/session files |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyJWT 2.11.0 | python-jose | python-jose unmaintained — locked out |
| pwdlib[argon2] | passlib | passlib broken on Python 3.13 — locked out |
| asyncpg raw SQL | SQLAlchemy ORM | ORM loses query control; AeroVista uses raw SQL — locked out |
| httpOnly cookie | localStorage | httpOnly is more XSS-resistant; internal app with no CORS complexity |
| jose (Next.js) | jsonwebtoken | jsonwebtoken not Edge Runtime compatible; jose is official Next.js recommendation |

**Installation — Backend:**
```bash
pip install fastapi uvicorn[standard] asyncpg "pyjwt==2.11.0" "pwdlib[argon2]==0.3.0" pydantic pydantic-settings python-multipart
```

**Installation — Frontend (new nextjs-project/ created via CLI):**
```bash
npx create-next-app@16 nextjs-project --typescript --tailwind --app --src-dir --use-npm
npm install zustand jose lucide-react zod server-only
```

---

## Architecture Patterns

### Recommended Project Structure

```
acmi-platform/
├── fastapi-project/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, CORS, router includes
│   │   ├── config.py            # Pydantic settings (DATABASE_URL, JWT_SECRET, etc.)
│   │   ├── db/
│   │   │   └── database.py      # asyncpg pool creation, get_db dependency
│   │   ├── auth/
│   │   │   ├── router.py        # POST /auth/login, POST /auth/logout, GET /auth/me
│   │   │   ├── schemas.py       # LoginRequest, TokenResponse, UserResponse
│   │   │   ├── service.py       # authenticate_user(), create_access_token()
│   │   │   ├── dependencies.py  # get_current_user(), require_admin()
│   │   │   └── exceptions.py    # EmailNotFound, WrongPassword
│   │   └── users/
│   │       ├── router.py        # POST /admin/users, GET /admin/users, etc.
│   │       ├── schemas.py       # CreateUserRequest, UserResponse
│   │       ├── service.py       # UserService(BaseRepository)
│   │       └── repository.py    # UserRepository extends BaseRepository
│   ├── migrations/
│   │   └── 001_create_users.sql # Raw SQL migration files
│   ├── tests/
│   │   └── test_auth.py
│   └── requirements.txt
│
└── nextjs-project/
    ├── src/
    │   ├── app/
    │   │   ├── (auth)/
    │   │   │   └── login/
    │   │   │       └── page.tsx          # Login page
    │   │   ├── (dashboard)/
    │   │   │   ├── layout.tsx            # App shell layout with sidebar
    │   │   │   ├── dashboard/page.tsx
    │   │   │   ├── pricing/page.tsx      # Placeholder
    │   │   │   ├── quotes/page.tsx       # Placeholder
    │   │   │   ├── aircraft/page.tsx     # Placeholder
    │   │   │   └── admin/page.tsx
    │   │   ├── actions/
    │   │   │   └── auth.ts               # Server Actions: login(), logout()
    │   │   ├── layout.tsx
    │   │   └── globals.css
    │   ├── components/
    │   │   ├── sidebar/
    │   │   │   ├── Sidebar.tsx
    │   │   │   └── SidebarNav.tsx
    │   │   ├── layout/
    │   │   │   └── TopBar.tsx
    │   │   └── ui/
    │   │       └── PlaceholderPage.tsx
    │   ├── lib/
    │   │   ├── session.ts               # JWT encrypt/decrypt with jose (server-only)
    │   │   ├── dal.ts                   # verifySession(), getUser() (server-only)
    │   │   └── api.ts                   # Typed fetch wrapper for FastAPI calls
    │   ├── stores/
    │   │   └── sidebar-store.ts         # Zustand: sidebar collapsed/expanded state
    │   └── middleware.ts                # Redirect unauthenticated users to /login
    └── package.json
```

### Pattern 1: FastAPI asyncpg Connection Pool with Lifespan

**What:** Create asyncpg pool at startup via lifespan context manager, expose via dependency injection.
**When to use:** Every database operation in the application.

```python
# Source: FastAPI official docs + asyncpg official pattern
# fastapi-project/app/db/database.py

import asyncpg
from fastapi import Request

async def create_pool(database_url: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        dsn=database_url,
        min_size=2,
        max_size=10,
    )

async def get_db(request: Request) -> asyncpg.Connection:
    async with request.app.state.pool.acquire() as connection:
        yield connection
```

```python
# fastapi-project/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db.database import create_pool
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await create_pool(settings.database_url)
    yield
    await app.state.pool.close()

app = FastAPI(lifespan=lifespan)
```

### Pattern 2: BaseRepository Raw SQL Pattern

**What:** Abstract base class wrapping asyncpg connection for typed DB access.
**When to use:** All data access — UserRepository extends this.

```python
# Source: AeroVista reference pattern
# fastapi-project/app/db/base_repository.py

from typing import Any
import asyncpg

class BaseRepository:
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn

    async def fetch_one(self, query: str, *args) -> dict | None:
        row = await self.conn.fetchrow(query, *args)
        return dict(row) if row else None

    async def fetch_many(self, query: str, *args) -> list[dict]:
        rows = await self.conn.fetch(query, *args)
        return [dict(row) for row in rows]

    async def execute(self, query: str, *args) -> str:
        return await self.conn.execute(query, *args)
```

### Pattern 3: PyJWT Token Creation and Verification

**What:** Create signed JWT on login, verify on every protected request.
**When to use:** Login endpoint creates token; `get_current_user` dependency verifies it.

```python
# Source: FastAPI official docs (https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
# fastapi-project/app/auth/service.py

from datetime import datetime, timedelta, timezone
import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()  # Uses Argon2 by default

SECRET_KEY = settings.jwt_secret  # 32+ char random string
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def verify_password(plain: str, hashed: str) -> bool:
    return password_hash.verify(plain, hashed)

def hash_password(plain: str) -> str:
    return password_hash.hash(plain)
```

### Pattern 4: FastAPI httpOnly Cookie Set on Login

**What:** Login endpoint sets httpOnly cookie containing JWT; no token returned in body.
**When to use:** POST /auth/login success path.

```python
# Source: FastAPI docs + https://retz.dev/blog/jwt-and-cookie-auth-in-fastapi/
# fastapi-project/app/auth/router.py

from fastapi import APIRouter, Depends, Response
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: asyncpg.Connection = Depends(get_db),
):
    user_repo = UserRepository(db)
    user = await user_repo.fetch_by_email(form_data.username)

    if not user:
        raise HTTPException(status_code=401, detail="Email not found")

    if not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Wrong password")

    token = create_access_token(user["id"], user["role"])

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,         # HTTPS only (set False in dev)
        samesite="lax",
        max_age=7 * 24 * 3600,  # 7 days in seconds
        path="/",
    )
    return {"message": "Logged in"}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    return {"message": "Logged out"}
```

### Pattern 5: FastAPI get_current_user Dependency from Cookie

**What:** Extract JWT from cookie on every protected route via Depends().
**When to use:** All protected API endpoints.

```python
# fastapi-project/app/auth/dependencies.py

from fastapi import Cookie, Depends, HTTPException
from app.db.database import get_db
from app.auth.service import decode_access_token

async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(access_token)
    user_id = int(payload["sub"])
    user_repo = UserRepository(db)
    user = await user_repo.fetch_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

### Pattern 6: FastAPI CORS for Cross-Origin Cookie

**What:** CORS must explicitly allow credentials and list allowed origins (no wildcard with credentials).
**When to use:** FastAPI main.py setup — critical for dev (localhost:3000 → localhost:8000).

```python
# Source: https://fastapi.tiangolo.com/tutorial/cors/
# fastapi-project/app/main.py

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # NEVER use "*" with credentials
    allow_credentials=True,                   # Must be True for cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)
```

### Pattern 7: Next.js Session Management with jose (Edge Runtime)

**What:** Use `jose` library (not jsonwebtoken) for JWT operations in Next.js middleware (Edge Runtime).
**When to use:** Next.js `middleware.ts` and `lib/session.ts` for cookie-based session.

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication
// nextjs-project/src/lib/session.ts
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// NOTE: For this architecture, FastAPI is the source of truth for JWT.
// Next.js reads the cookie and optionally verifies it for client-side
// session data, or passes it to FastAPI API calls.
// The access_token cookie set by FastAPI is httpOnly — Next.js middleware
// can read it from req.cookies to check authentication status.

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  return token ? { token } : null
}
```

```typescript
// nextjs-project/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/pricing', '/quotes', '/aircraft', '/admin']
const publicRoutes = ['/login']

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtected = protectedRoutes.some(r => path.startsWith(r))
  const isPublic = publicRoutes.includes(path)

  const token = req.cookies.get('access_token')?.value

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublic && token) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

### Pattern 8: Next.js Server Action Login (calls FastAPI)

**What:** Login form posts to a Server Action that calls the FastAPI backend.
**When to use:** Login page form submission.

```typescript
// Source: Next.js official auth guide
// nextjs-project/src/app/actions/auth.ts
'use server'
import { redirect } from 'next/navigation'

export async function loginAction(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const res = await fetch('http://localhost:8000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // FastAPI OAuth2PasswordRequestForm expects form-encoded body
    body: new URLSearchParams({ username: email, password }),
    credentials: 'include',  // Needed to accept Set-Cookie header
  })

  if (!res.ok) {
    const data = await res.json()
    return { error: data.detail }  // "Email not found" or "Wrong password"
  }

  redirect('/dashboard')
}

export async function logoutAction() {
  await fetch('http://localhost:8000/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
  redirect('/login')
}
```

### Pattern 9: Zustand Sidebar Store

**What:** Persist sidebar collapsed state in localStorage via Zustand persist middleware.
**When to use:** Sidebar component toggle; persists user preference across sessions.

```typescript
// Source: https://zustand.docs.pmnd.rs/guides/nextjs
// nextjs-project/src/stores/sidebar-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  isCollapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isCollapsed: false,
      toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
      setCollapsed: (v) => set({ isCollapsed: v }),
    }),
    { name: 'sidebar-state' }  // localStorage key
  )
)
```

### Pattern 10: Database Schema — Users Table

**What:** Minimal users table supporting email login, role-based access.
**When to use:** Wave 0 migration; foundational for all subsequent phases.

```sql
-- migrations/001_create_users.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    full_name   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### Anti-Patterns to Avoid

- **Using wildcard CORS with credentials:** `allow_origins=["*"]` with `allow_credentials=True` raises CORS error in browsers. Must use explicit origin list.
- **Storing JWT in localStorage instead of httpOnly cookie:** XSS can steal localStorage tokens. Decision is locked to httpOnly cookie.
- **Using python-jose:** Package is unmaintained; PyJWT is the locked alternative.
- **Using passlib:** Broken on Python 3.13; pwdlib[argon2] is the locked alternative.
- **Using jsonwebtoken in Next.js middleware:** Not Edge Runtime compatible. Use `jose` instead.
- **Auth checks only in Next.js middleware:** CVE-2025-29927 highlighted that middleware should not be the only auth check. Verify session in every Server Action and Route Handler too.
- **Specific error messages in production:** The decision to show "Email not found" vs "Wrong password" is an explicit user requirement for internal tool UX. This is acceptable because this is an invite-only internal tool (no enumeration risk from public).
- **Connecting to different host/port combines (localhost vs 127.0.0.1):** If FastAPI runs on `127.0.0.1:8000` but Next.js fetches from `localhost:8000`, cookies won't match domains. Use consistent `localhost` throughout.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt wrapper | pwdlib[argon2] | Argon2 timing-attack resistant; automatic rehashing on algorithm change |
| JWT signing/verification | Custom HMAC | PyJWT 2.11.0 (backend) + jose (Next.js middleware) | Edge cases in expiry, algorithm confusion attacks |
| Connection pool lifecycle | Manual asyncpg pool management | FastAPI lifespan + app.state.pool pattern | Handles startup failures, graceful shutdown cleanly |
| Cookie security attributes | Manual cookie headers | `response.set_cookie()` with httponly/secure/samesite | Easy to miss Secure or SameSite attributes |
| Route protection | Custom auth decorators | FastAPI `Depends(get_current_user)` | Clean, composable, testable |
| Middleware route matching | Custom path parsing | Next.js middleware + `config.matcher` | Edge Runtime optimization, proper prefix matching |
| Environment config | os.environ lookups | pydantic-settings `BaseSettings` | Type-safe, validated at startup, supports .env files |

**Key insight:** Auth is a cross-cutting concern where one missed edge case causes a security vulnerability. Use the established patterns and let the libraries handle the edge cases.

---

## Common Pitfalls

### Pitfall 1: CORS Credentials Wildcard Conflict
**What goes wrong:** FastAPI starts successfully, but login fails in browser with CORS error. `credentials: 'include'` in fetch requires explicit `allow_origins`, but developers often set `allow_origins=["*"]` first.
**Why it happens:** The wildcard and credentials=True combination is rejected by browsers per the CORS spec.
**How to avoid:** From the first line of CORS setup, use `allow_origins=["http://localhost:3000"]`. Add production domain before deployment.
**Warning signs:** Browser console shows `"The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'"`

### Pitfall 2: httpOnly Cookie Not Sent on Cross-Origin Fetch
**What goes wrong:** Login sets cookie, but subsequent API calls don't include it. Looks like user is always logged out.
**Why it happens:** `fetch()` does not send cookies by default on cross-origin requests. `credentials: 'include'` is required on every fetch call.
**How to avoid:** Create a typed API client wrapper (`lib/api.ts`) that always sets `credentials: 'include'` and the correct base URL.
**Warning signs:** Network tab shows no `Cookie` header on API requests after login.

### Pitfall 3: localhost vs 127.0.0.1 Cookie Domain Mismatch
**What goes wrong:** Backend sets cookie for `127.0.0.1` but frontend fetches `localhost` (or vice versa). Cookie is never sent.
**Why it happens:** Browser treats `localhost` and `127.0.0.1` as different domains for cookie purposes.
**How to avoid:** Standardize on `http://localhost:8000` everywhere — in FastAPI CORS origins, in Next.js fetch calls, in `.env.local`.
**Warning signs:** Cookie appears in DevTools under `127.0.0.1` but requests go to `localhost`.

### Pitfall 4: Next.js Middleware Alone is Not Sufficient for Auth
**What goes wrong:** A user exploits a bypass (e.g., direct API route access, Server Action calls) that skips middleware.
**Why it happens:** Next.js middleware is optimistic/fast-path; it doesn't re-run on every Server Action.
**How to avoid:** Call `verifySession()` (which reads the cookie and validates) inside every Server Action, Route Handler, and data-fetching function that returns protected data.
**Warning signs:** API routes return data without checking the cookie.

### Pitfall 5: Zustand Hydration Mismatch in Next.js App Router
**What goes wrong:** React hydration error: server renders with `isCollapsed: false`, client reads `true` from localStorage. White flash or console error.
**Why it happens:** `persist` middleware reads localStorage on the client, but Next.js SSR can't read it.
**How to avoid:** Use `useEffect` + local `hydrated` state before rendering collapsed state, OR use the `onRehydrateStorage` callback and render a skeleton until hydrated.
**Warning signs:** React console warning about hydration mismatch; sidebar flashes on load.

### Pitfall 6: Tailwind 4 Class Renames Breaking Old Patterns
**What goes wrong:** Copy-pasting Tailwind v3 code causes invisible broken styles.
**Why it happens:** Tailwind 4 renamed several utilities: `shadow` → `shadow-sm`, `shadow-sm` → `shadow-xs`, `ring` → `ring-3`, border default is now `currentColor` not `gray-200`.
**How to avoid:** The existing `acmi-app/` prototype already uses Tailwind 4 — use it as the reference for class names, not Stack Overflow answers from 2023.
**Warning signs:** Shadows/rings appear wrong; borders invisible.

### Pitfall 7: Forgetting python-multipart for OAuth2 Form Login
**What goes wrong:** FastAPI returns 422 Unprocessable Entity on POST /auth/login with error about form data.
**Why it happens:** FastAPI's `OAuth2PasswordRequestForm` requires `python-multipart` to parse form-encoded bodies; it's not installed by default.
**How to avoid:** Include `python-multipart` in requirements.txt from the start.
**Warning signs:** 422 error with "Ensure this value has at least 1 characters" or similar Pydantic form error.

---

## Code Examples

Verified patterns from official sources:

### pwdlib Argon2 Password Hashing
```python
# Source: https://pypi.org/project/pwdlib/ (confirmed current version 0.3.0)
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()  # Argon2 by default

# Hash a new password:
hashed = password_hash.hash("user_plaintext_password")

# Verify a password:
is_valid = password_hash.verify("user_plaintext_password", hashed)  # True
```

### PyJWT Encode/Decode
```python
# Source: FastAPI official docs https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = "your-32-char-secret"
ALGORITHM = "HS256"

# Encode:
payload = {"sub": "42", "role": "admin", "exp": datetime.now(timezone.utc) + timedelta(days=7)}
token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# Decode:
try:
    data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
except jwt.ExpiredSignatureError:
    # Token expired
except jwt.InvalidTokenError:
    # Invalid signature or malformed
```

### Next.js Middleware Token Check
```typescript
// Source: https://nextjs.org/docs/app/guides/authentication
// middleware.ts — reads httpOnly cookie set by FastAPI backend
import { NextRequest, NextResponse } from 'next/server'

export default function middleware(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value
  const isProtected = req.nextUrl.pathname.startsWith('/dashboard')

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  return NextResponse.next()
}
```

### Tailwind 4 CSS-First Theme Setup (from existing acmi-app prototype)
```css
/* globals.css — already confirmed pattern from acmi-app/src/app/globals.css */
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: #030712;   /* gray-950 */
  color: #e5e7eb;        /* gray-200 */
}
```

### Collapsible Sidebar Component Skeleton
```tsx
// nextjs-project/src/components/sidebar/Sidebar.tsx
'use client'
import { useSidebarStore } from '@/stores/sidebar-store'
import { LayoutDashboard, TrendingUp, FileText, Plane, Settings, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pricing',   label: 'Pricing',   icon: TrendingUp },
  { href: '/quotes',    label: 'Quotes',     icon: FileText },
  { href: '/aircraft',  label: 'Aircraft',   icon: Plane },
  { href: '/admin',     label: 'Admin',      icon: Settings },
]

export function Sidebar() {
  const { isCollapsed, toggle } = useSidebarStore()

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-gray-900 border-r border-gray-800 h-screen flex flex-col`}>
      <button onClick={toggle} className="p-4 text-gray-400 hover:text-white">
        <ChevronLeft className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
      </button>
      <nav className="flex-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 mb-1">
            <Icon size={20} className="shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| passlib for password hashing | pwdlib[argon2] | 2024 (Python 3.13 breakage) | Must use pwdlib — passlib import fails |
| python-jose for JWTs | PyJWT 2.11.0 | 2023-2024 (unmaintained) | Must use PyJWT — FastAPI docs updated |
| Tailwind v3 JS config | Tailwind v4 CSS-first (@theme) | Early 2025 | `tailwind.config.js` approach is legacy; new projects use CSS-first |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` | Tailwind v4 | Single import replaces three directives |
| `tailwindcss` PostCSS plugin | `@tailwindcss/postcss` | Tailwind v4 | Separate package, already in prototype |
| jsonwebtoken in Next.js | jose | 2023+ | Edge Runtime incompatibility; jose is now official recommendation |
| startup/shutdown events | FastAPI lifespan context manager | FastAPI 0.95+ | `@app.on_event("startup")` deprecated |
| `ring` (3px blue) | `ring-3` (explicit width) | Tailwind v4 | `ring` now means 1px; `ring-3` = old `ring` |

**Deprecated/outdated:**
- `passlib`: Cannot be installed on Python 3.13 — replaced by pwdlib
- `python-jose`: Last release 2022, unmaintained — replaced by PyJWT
- `@app.on_event("startup")`: Deprecated in FastAPI — use `lifespan` context manager
- Tailwind `tailwind.config.js` with `content` array: Still works via `@config` directive but not the canonical v4 approach

---

## Open Questions

1. **JWT Storage: FastAPI-issued token vs Next.js-issued session cookie**
   - What we know: The locked decision is httpOnly cookie. FastAPI sets it via `response.set_cookie()`. Next.js middleware reads it from `req.cookies`.
   - What's unclear: Whether to have FastAPI set the cookie directly (simplest), or proxy through Next.js Route Handlers/Server Actions that set a Next.js-managed session cookie. The FastAPI-sets-cookie approach is simpler and more direct.
   - Recommendation: FastAPI sets the `access_token` cookie directly on POST /auth/login. Next.js middleware reads it for route protection. Server Actions forward it to FastAPI API calls via `credentials: 'include'`.

2. **"Remember Me" Session Duration (Claude's Discretion)**
   - What we know: No user decision on this.
   - Recommendation: Use a single 7-day expiry with no "remember me" checkbox. Internal tool users expect to stay logged in. This keeps the implementation simple and avoids two token types.

3. **Database Migration Approach (Claude's Discretion)**
   - What we know: Raw SQL files are the pattern; no decision on tooling.
   - Recommendation: Plain numbered SQL files (`migrations/001_create_users.sql`) run manually or via a simple shell script. No Alembic for this phase — Alembic adds ORM coupling and this is raw SQL. Add proper migration tooling in Phase 2 if the team wants it.

4. **Secure Cookie in Development**
   - What we know: `secure=True` requires HTTPS, but dev runs on HTTP.
   - Recommendation: Use `settings.cookie_secure = settings.environment != "development"` to set `secure=False` in dev and `secure=True` in production. This is the standard approach.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + httpx (async test client for FastAPI) |
| Config file | `fastapi-project/pytest.ini` — Wave 0 gap |
| Quick run command | `pytest fastapi-project/tests/ -x -q` |
| Full suite command | `pytest fastapi-project/tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | POST /auth/login returns 200 + sets cookie on valid credentials | integration | `pytest fastapi-project/tests/test_auth.py::test_login_success -x` | ❌ Wave 0 |
| AUTH-01 | POST /auth/login returns 401 "Email not found" for unknown email | integration | `pytest fastapi-project/tests/test_auth.py::test_login_unknown_email -x` | ❌ Wave 0 |
| AUTH-01 | POST /auth/login returns 401 "Wrong password" for wrong password | integration | `pytest fastapi-project/tests/test_auth.py::test_login_wrong_password -x` | ❌ Wave 0 |
| AUTH-02 | GET /auth/me returns user when valid cookie present | integration | `pytest fastapi-project/tests/test_auth.py::test_get_me_with_valid_cookie -x` | ❌ Wave 0 |
| AUTH-02 | GET /auth/me returns 401 when no cookie present | integration | `pytest fastapi-project/tests/test_auth.py::test_get_me_no_cookie -x` | ❌ Wave 0 |
| AUTH-03 | POST /auth/logout clears cookie | integration | `pytest fastapi-project/tests/test_auth.py::test_logout_clears_cookie -x` | ❌ Wave 0 |
| AUTH-04 | POST /admin/users creates user when called by admin | integration | `pytest fastapi-project/tests/test_users.py::test_create_user_as_admin -x` | ❌ Wave 0 |
| AUTH-04 | POST /admin/users returns 403 when called by non-admin | integration | `pytest fastapi-project/tests/test_users.py::test_create_user_forbidden -x` | ❌ Wave 0 |
| UI-01 | Sidebar renders all 5 nav items | manual | Visual check in browser | N/A |
| UI-05 | Login page matches AeroVista dark card style | manual | Visual check in browser | N/A |

### Sampling Rate
- **Per task commit:** `pytest fastapi-project/tests/ -x -q`
- **Per wave merge:** `pytest fastapi-project/tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `fastapi-project/pytest.ini` — pytest configuration
- [ ] `fastapi-project/tests/__init__.py` — test package
- [ ] `fastapi-project/tests/conftest.py` — async test client fixture, test DB setup
- [ ] `fastapi-project/tests/test_auth.py` — covers AUTH-01, AUTH-02, AUTH-03
- [ ] `fastapi-project/tests/test_users.py` — covers AUTH-04
- [ ] Framework install: `pip install pytest pytest-asyncio httpx` — not yet in requirements.txt

---

## Sources

### Primary (HIGH confidence)
- FastAPI official security docs: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ — PyJWT + pwdlib pattern, confirmed current
- Next.js official auth guide: https://nextjs.org/docs/app/guides/authentication — httpOnly cookie session, middleware pattern, jose recommendation (last updated 2026-02-27)
- FastAPI official CORS docs: https://fastapi.tiangolo.com/tutorial/cors/ — credentials + explicit origins requirement
- Tailwind CSS v4 upgrade guide: https://tailwindcss.com/docs/upgrade-guide — PostCSS change, class renames, CSS-first config
- pwdlib PyPI page: https://pypi.org/project/pwdlib/ — confirmed version 0.3.0 (released October 25, 2025), Argon2 API

### Secondary (MEDIUM confidence)
- FastAPI lifespan + asyncpg pool: https://github.com/fastapi/fastapi/discussions/9520 — community-verified pattern with official FastAPI devs
- FastAPI httpOnly cookie auth: https://retz.dev/blog/jwt-and-cookie-auth-in-fastapi/ — practical implementation matching official pattern
- Zustand official Next.js guide: https://zustand.docs.pmnd.rs/guides/nextjs — hydration handling
- FastAPI best practices structure: https://github.com/zhanymkanov/fastapi-best-practices — domain-driven directory layout

### Tertiary (LOW confidence)
- AeroVista reference app patterns (BaseRepository, services layer): mentioned in project context but repo not directly inspected — using documented description from CONTEXT.md

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via PyPI and official docs; versions confirmed
- Architecture: HIGH — patterns directly from FastAPI and Next.js official documentation
- Pitfalls: HIGH — CORS/cookie issues verified from official specs and GitHub discussions
- Tailwind 4 patterns: HIGH — confirmed from existing acmi-app prototype which already uses Tailwind 4

**Research date:** 2026-03-04
**Valid until:** 2026-06-04 (90 days — stable stack with locked library versions)
