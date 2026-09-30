# Phase 1: Foundation and Authentication - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure access to the application via company email login, project scaffold matching AeroVista architecture (fastapi-project/ + nextjs-project/), database schema foundation, and app shell with sidebar navigation showing all five pages. No pricing, aircraft data, or quote features — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Login experience
- AeroVista-style login page: centered card, dark background, minimal branding
- Specific error messages: "Email not found" vs "Wrong password" (not generic "invalid credentials")
- Admin resets passwords only — no self-service "forgot password" flow, no email service needed
- No self-signup — admin creates all user accounts

### App shell layout
- Collapsible sidebar: icon-only mode when collapsed, full labels when expanded — matching AeroVista pattern
- All 5 navigation pages from day one: Dashboard, Pricing, Quotes, Aircraft, Admin
- Unbuilt pages show placeholder/empty states (not hidden)
- Exact AeroVista directory structure: separate `fastapi-project/` and `nextjs-project/` directories

### Auth architecture
- PyJWT 2.11.0 for JWT tokens (not python-jose — unmaintained)
- pwdlib[argon2] 0.3.0 for password hashing (not passlib — broken on Python 3.13)
- JWT stored in httpOnly cookie or localStorage (decided in prior research)
- Two roles: admin and standard user

### Claude's Discretion
- "Remember me" behavior (checkbox vs always-remember vs session expiry duration)
- Top bar design (user info, logout, breadcrumbs, theme toggle placement)
- Loading skeleton and empty state designs for placeholder pages
- Exact spacing, typography, and color palette within AeroVista style constraints
- Database migration approach (raw SQL files vs migration tool)

</decisions>

<specifics>
## Specific Ideas

- "I want the same application as AeroVista" — the reference app's login page, sidebar, and overall feel are the target
- Company email login only — this is an internal tool for the sales/ops team, not a public-facing product
- The app is phase 1 of a larger financial platform — the scaffold needs to be solid enough to build pricing, quotes, aircraft data, and eventually financial reporting on top of it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- AeroVista reference app provides the pattern: BaseRepository for DB, services layer for business logic, Zustand for state, Tailwind for styling
- Raw SQL via asyncpg with connection pool manager (app/db/database.py pattern)
- Pydantic schemas for request/response validation
- App Router (Next.js 14) for frontend routing

### Integration Points
- Database schema established here will be extended by Phase 2 (aircraft), Phase 3 (pricing configs), Phase 4 (quotes)
- Auth middleware established here will protect all subsequent API routes
- Sidebar navigation established here will receive real pages as phases deliver them

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-authentication*
*Context gathered: 2026-03-04*
