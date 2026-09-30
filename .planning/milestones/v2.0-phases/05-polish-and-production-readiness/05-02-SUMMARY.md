---
phase: 05-polish-and-production-readiness
plan: 02
subsystem: ui, infra
tags: [sorting, responsive, tailwind, docker, railway, vercel, gunicorn, deployment]

# Dependency graph
requires:
  - phase: 05-01
    provides: Theme-aware components with dark/light mode classes
provides:
  - Sortable AircraftTable (MSN, Type) with direction toggle and indicators
  - Sortable QuoteList (Quote #, Client, Status, Created) with direction toggle
  - Mobile responsive tables with column hiding at breakpoints
  - Multi-stage Dockerfile for Railway deployment with gunicorn
  - Railway deployment configuration with health check
  - Vercel monorepo configuration pointing to nextjs-project
affects: [deployment, production]

# Tech tracking
tech-stack:
  added: [gunicorn]
  patterns: [column-sorting-with-state, responsive-table-column-hiding, multi-stage-docker-build]

key-files:
  created:
    - fastapi-project/Dockerfile
    - fastapi-project/.dockerignore
    - fastapi-project/railway.json
    - vercel.json
  modified:
    - nextjs-project/src/components/aircraft/AircraftTable.tsx
    - nextjs-project/src/components/quotes/QuoteList.tsx
    - fastapi-project/requirements.txt

key-decisions:
  - "Only MSN and Type sortable in AircraftTable -- rate columns excluded per user decision"
  - "Only Quote #, Client, Status, Created sortable in QuoteList -- Rate and MSNs excluded per user decision"
  - "AircraftTable hides 8 rate columns below md breakpoint, showing MSN/Type/Registration on mobile"
  - "QuoteList hides Rate, MSNs, Actions columns below sm breakpoint"
  - "Gunicorn with UvicornWorker for Railway production deployment (2 workers, 120s timeout)"
  - "UI-04 (dashboard stats) explicitly dropped by user -- no implementation"

patterns-established:
  - "Column sorting pattern: useState for sortKey/sortDir, handleSort toggle function, sorted array before render"
  - "Responsive table hiding: hidden md:table-cell / hidden sm:table-cell on non-essential columns"
  - "Multi-stage Docker: builder stage installs deps, runtime stage copies venv only"

requirements-completed: [UI-02, UI-04]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 5 Plan 02: Table Sorting, Mobile Responsiveness, and Deployment Configuration Summary

**Sortable/responsive AircraftTable and QuoteList with Dockerfile, Railway, and Vercel deployment configs**

## Performance

- **Duration:** 5 min (continuation from checkpoint approval)
- **Started:** 2026-03-10T10:49:00Z
- **Completed:** 2026-03-10T10:59:29Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 7

## Accomplishments
- AircraftTable sorts by MSN (numeric) and Type (alphabetic) with ascending/descending toggle and triangle indicators
- QuoteList sorts by Quote #, Client, Status, and Created date with direction toggle (default: newest first)
- Both tables responsive on mobile -- non-essential columns hidden at breakpoints (md for AircraftTable, sm for QuoteList)
- Multi-stage Dockerfile with gunicorn + UvicornWorker for Railway, health check at /health
- Railway deployment config (Dockerfile builder, health check, restart policy)
- Vercel config pointing rootDirectory to nextjs-project
- Human visual verification passed for theme, sorting, responsiveness, and deployment files

## Task Commits

Each task was committed atomically:

1. **Task 1: Add column sorting and mobile responsiveness to AircraftTable and QuoteList** - `aaf0f57` (feat)
2. **Task 2: Create deployment configuration for Railway and Vercel** - `8a817de` (chore)
3. **Task 3: Visual verification checkpoint** - No commit (human-verify approved, no code changes)

## Files Created/Modified
- `nextjs-project/src/components/aircraft/AircraftTable.tsx` - Added sort state, handleSort, sorted array, sort indicators, responsive column hiding (hidden md:table-cell)
- `nextjs-project/src/components/quotes/QuoteList.tsx` - Added sort state, handleSort, sortedQuotes, sort indicators, responsive column hiding (hidden sm:table-cell)
- `fastapi-project/Dockerfile` - Multi-stage Docker build: python:3.12-slim builder + runtime, gunicorn CMD with $PORT binding
- `fastapi-project/.dockerignore` - Excludes __pycache__, .env, .git, tests, *.md, .planning
- `fastapi-project/railway.json` - Dockerfile builder, /health healthcheck, ON_FAILURE restart policy
- `fastapi-project/requirements.txt` - Added gunicorn dependency
- `vercel.json` - Monorepo config with rootDirectory: nextjs-project, Next.js framework

## Decisions Made
- Only MSN and Type are sortable in AircraftTable (rate columns excluded per user decision)
- Only Quote #, Client, Status, Created sortable in QuoteList (Rate and MSNs excluded per user decision)
- AircraftTable hides all 8 rate columns below md breakpoint, showing only MSN, Type, Registration on mobile
- QuoteList hides Rate, MSNs, Actions below sm breakpoint
- Gunicorn with 2 UvicornWorkers for production (Railway binds to $PORT)
- UI-04 (dashboard stats) explicitly dropped by user -- acknowledged, no implementation

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

External services require manual configuration before deployment:

**Railway (Backend):**
- Create new project and add PostgreSQL add-on
- Connect GitHub repo for auto-deploys
- Set environment variables: DATABASE_URL (auto from PostgreSQL add-on), JWT_SECRET (openssl rand -hex 32), ENVIRONMENT=production, FRONTEND_URL (Vercel URL)

**Vercel (Frontend):**
- Import GitHub repo, set Root Directory to "nextjs-project"
- Set environment variable: API_URL (Railway backend URL)

## Issues Encountered
None

## Next Phase Readiness
- All 5 phases complete -- application is production-ready
- Deployment configs in place for Railway (backend) and Vercel (frontend)
- Manual service setup required before going live (see User Setup Required above)

## Self-Check: PASSED

All 7 created/modified files verified present on disk. Both task commits (aaf0f57, 8a817de) verified in git history.

---
*Phase: 05-polish-and-production-readiness*
*Completed: 2026-03-10*
