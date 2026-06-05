---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Dashboard & Project Pipeline
status: defining-requirements
stopped_at: Milestone started
last_updated: "2026-06-05"
last_activity: 2026-06-05 — Milestone v2.0 started (Dashboard & Project Pipeline)
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05)

**Core value:** Accurate, repeatable ACMI pricing quotes that the sales team can generate, save, and retrieve — replacing manual spreadsheet-based pricing with a structured tool that produces consistent results.
**Current focus:** Milestone v2.0 — rename Dashboard to Calculation, build real Dashboard with project pipeline metrics (potential vs signed).

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-05 — Milestone v2.0 started

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 6min
- Total execution time: 1.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Foundation | 4/4 | 19min | 5min |
| 2 - Aircraft Master Data | 3/3 | 18min | 6min |
| 3 - Pricing Engine | 5/5 | 26min | 5min |
| 4 - Quote Persistence | 4/4 | 17min | 4min |
| 5 - Polish | 2/2 | 13min | 7min |

**Recent Trend:**
- Last 5 plans: 04-02 (3min), 04-03 (4min), 04-04 (5min), 05-01 (8min), 05-02 (5min)
- Trend: Consistent

*Updated after each plan completion*
| Phase 02 P01 | 7min | 2 tasks | 9 files |
| Phase 02 P02 | 3min | 2 tasks | 6 files |
| Phase 02 P03 | 8min | 3 tasks | 7 files |
| Phase 03 P01 | 5min | 2 tasks | 6 files |
| Phase 03 P02 | 9min | 2 tasks | 3 files |
| Phase 03 P03 | 8min | 1 task | 7 files |
| Phase 03 P04 | 4min | 2 tasks | 9 files |
| Phase 04 P02 | 3min | 2 tasks | 8 files |
| Phase 04 P01 | 5min | 2 tasks | 7 files |
| Phase 04 P03 | 4min | 2 tasks | 5 files |
| Phase 04 P04 | 5min | 3 tasks | 11 files |
| Phase 05 P01 | 8min | 2 tasks | 42 files |
| Phase 05 P02 | 5min | 3 tasks | 7 files |
| Phase 05 P02 | 5min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Match AeroVista stack exactly — FastAPI + Next.js 14 + PostgreSQL 15+ with asyncpg raw SQL
- [Init]: Use PyJWT 2.11.0 and pwdlib[argon2] 0.3.0 — python-jose and passlib are unmaintained
- [Init]: All monetary calculations use Python decimal.Decimal and PostgreSQL NUMERIC — never float
- [Init]: Quote immutability is a schema-level decision — store all seven component values and config FK at save time
- [01-01]: BaseRepository uses `from __future__ import annotations` for Python 3.9 dev compatibility while targeting 3.12+ in production
- [01-01]: CORS allows only settings.frontend_url origin with credentials for cookie-based auth
- [01-01]: Default config values in Settings class so app imports without .env file
- [01-03]: Used useActionState (React 19) instead of deprecated useFormState for login form
- [01-03]: Server Actions use API_URL (no NEXT_PUBLIC_ prefix) to keep backend URL server-only
- [01-03]: Root page redirects to /dashboard; middleware handles unauthenticated redirect to /login
- [01-03]: Auth route group (auth) isolates login page from future app shell layout
- [Phase 01-02]: Mock DB conftest: replaced real asyncpg pool fixtures with in-memory MockConnection to enable testing without PostgreSQL
- [Phase 01-02]: Added pydantic[email] and eval_type_backport for Python 3.9 compatibility with Pydantic EmailStr and union type syntax
- [01-04]: Server Actions must forward Set-Cookie from FastAPI to browser via Next.js cookies() API -- server-to-server fetch does not propagate cookies to the client
- [01-04]: logoutAction clears cookie directly via cookies().delete() instead of calling FastAPI -- simpler, avoids cookie propagation issue
- [01-04]: Sidebar hydration guard: useEffect + mounted state renders expanded on server, reads Zustand after mount
- [01-04]: Defense-in-depth: dashboard layout checks getSession() in addition to middleware route protection
- [02-01]: MockConnection _detect_table() routes by FROM/INTO clause, not substring, to handle JOIN queries correctly
- [02-01]: Seed script uses hardcoded data from Excel audit with optional Excel validation for mismatch detection
- [02-01]: Using 2026 EPR tables for MSNs 1932, 1960, 1503 (most current available data)
- [02-01]: NUMERIC(12,2) for dollar amounts, NUMERIC(10,4) for rates, NUMERIC(6,4) for escalation rates
- [02-02]: EUR fields added explicitly to Pydantic schemas for type-safe API contract rather than response_model=None
- [02-02]: apply_eur_conversion returns new dict, never mutates input -- safe for concurrent use
- [02-02]: Router uses Depends(get_current_user) for read, Depends(require_admin) for write endpoints
- [02-03]: Server Components fetch API with cookie forwarding (cookies() from next/headers) -- keeps API_URL server-only
- [02-03]: Admin detection via /auth/me fetch in Server Component, passed as isAdmin prop to client components
- [02-03]: All 4 cost sections visible at once (no tabs) -- research recommended for 11-aircraft dataset
- [02-03]: EPR matrix read-only in v1 -- admin editing deferred as discretion item
- [03-01]: Append-only config versioning uses is_current boolean flag with partial unique index (not temporal tables)
- [03-01]: crew_config per aircraft_type (A320/A321) to handle different cabin crew compositions
- [03-01]: pricing_projects stores separate crew_config_a320_id and crew_config_a321_id FKs for quote immutability
- [03-01]: crew_sets modeled as per-MSN input in project_msn_inputs (not global project setting)
- [03-02]: AircraftCosts dataclass takes pre-interpolated epr_rate -- caller responsibility to interpolate before constructing
- [03-02]: CREW_COMPOSITION uses dict values {pilots, senior, regular} instead of tuples for readability
- [03-02]: ComponentBreakdown is a local dataclass (not Pydantic) to keep service.py pure with zero external dependencies
- [03-02]: EPR matrix must be pre-filtered by environment (benign/hot) before passing to calculate_pricing
- [03-02]: Margin formula: final_rate = total_cost / (1 - margin_percent/100) -- industry-standard cost-plus margin
- [03-03]: Router interpolates EPR rate and passes pre-computed epr_rate to AircraftCosts dataclass, keeping service layer pure
- [03-03]: Project creation auto-attaches current pricing_config, crew_config_a320, and crew_config_a321 FKs via repository
- [03-04]: Pricing store is session-based (no persist middleware) -- pricing state resets between sessions
- [03-04]: All decimal values stored as strings in Zustand store to preserve precision from API
- [03-04]: Debounced calculation with 500ms delay via useEffect + useRef timer cleanup
- [03-04]: API response mapping from snake_case to camelCase at DashboardSummary boundary
- [04-02]: Excluded bhFhRatio and apuFhRatio from sensitivity parameters -- frontend-only values not in /pricing/calculate API request
- [04-02]: Sensitivity uses sequential calculatePnlAction calls (5 per run) to avoid API overload
- [04-02]: Base value for per-MSN parameters (mgh, cycleRatio, crewSets) uses average across all MSNs
- [Phase 04-01]: JSONB columns for config snapshots and monthly P&L -- normalized columns for search, JSONB for bulk snapshot data
- [Phase 04-01]: Quote number generation uses INSERT ON CONFLICT DO UPDATE RETURNING for atomic counter increment -- race-free
- [Phase 04-01]: DecimalEncoder converts Decimal to string (not float) in JSONB to preserve precision
- [Phase 04]: MSN filter uses PostgreSQL array containment operator (msn_list @> ARRAY) leveraging GIN index from migration 004
- [Phase 04]: PDF endpoint returns 501 stub with QUOT-06 deferred message -- ready for implementation once Excel summary file is received
- [Phase 04]: Status update permission: creator-or-admin check (current_user.id == quote.created_by OR role == admin)
- [Phase 04]: SaveQuoteDialog reads from all 3 stores synchronously via getState() -- Zustand stores are synchronous
- [Phase 04]: Fork behavior: loadFromQuote sets projectId=null so saving creates a new quote, preserving original immutability
- [Phase 05]: Light mode is DEFAULT (no prefix), dark mode uses dark: prefix -- Tailwind convention
- [Phase 05]: next-themes handles all theme persistence and system preference -- no Zustand store for theme
- [Phase 05]: ThemeToggle in sidebar footer -- always visible, follows user-preference-controls pattern
- [Phase 05-02]: Only MSN and Type sortable in AircraftTable -- rate columns excluded per user decision
- [Phase 05-02]: QuoteList sorts by Quote #, Client, Status, Created -- Rate and MSNs excluded
- [Phase 05-02]: Gunicorn with UvicornWorker for Railway production deployment (2 workers, 120s timeout)
- [Phase 05-02]: UI-04 (dashboard stats) explicitly dropped by user -- no implementation
- [Phase 05-02]: Only MSN and Type sortable in AircraftTable -- rate columns excluded per user decision

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3]: Excel workbook has not been reviewed. All Phase 3 estimates are provisional until a full workbook dependency audit is completed. Resolve by scheduling an audit session with the formula owner before Phase 3 planning begins.

## Session Continuity

Last session: 2026-03-10T11:07:20.937Z
Stopped at: Completed 05-02-PLAN.md
Resume file: None
