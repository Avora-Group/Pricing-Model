---
phase: 02-aircraft-master-data
plan: 02
subsystem: api
tags: [fastapi, decimal, eur-conversion, rest-api, auth, tdd, aircraft]

# Dependency graph
requires:
  - phase: 02-aircraft-master-data
    plan: 01
    provides: AircraftRepository, Pydantic schemas, MockConnection, test fixtures, Wave 0 test stubs
  - phase: 01-foundation
    provides: BaseRepository, auth dependencies (get_current_user, require_admin), CORS middleware
provides:
  - Aircraft REST API: GET /aircraft (list+search), GET /aircraft/{msn} (detail+EPR), PUT /aircraft/{msn}/rates (admin update)
  - EUR conversion service with DEFAULT_ADJ_RATE=0.85 applied to all monetary responses
  - Pydantic schemas with explicit EUR companion fields for type-safe API contract
  - 41 passing tests (9 API + 7 service + 12 repository + 13 auth/users)
affects: [02-03-PLAN, 03-pricing-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: [EUR conversion on read via service layer, router auth guards with Depends, TDD for API endpoints]

key-files:
  created:
    - fastapi-project/app/aircraft/service.py
    - fastapi-project/app/aircraft/router.py
    - fastapi-project/tests/test_aircraft_service.py
  modified:
    - fastapi-project/app/aircraft/schemas.py
    - fastapi-project/app/main.py
    - fastapi-project/tests/test_aircraft.py

key-decisions:
  - "EUR fields added explicitly to Pydantic schemas (option a) for type-safe API contract rather than response_model=None"
  - "apply_eur_conversion returns new dict, never mutates input -- safe for concurrent use"
  - "Router uses Depends(get_current_user) for read endpoints, Depends(require_admin) for write endpoints"

patterns-established:
  - "EUR conversion service: centralized DEFAULT_ADJ_RATE with apply_eur_conversion applied at router level before response"
  - "API test pattern: _login helper obtains auth cookie, then uses cookies= kwarg for authenticated requests"
  - "Router follows users/router.py pattern: APIRouter with prefix, Depends for auth, repository instantiation per endpoint"

requirements-completed: [ACFT-02, ACFT-03, ACFT-04]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 2 Plan 02: Aircraft API Router Summary

**FastAPI aircraft router with 3 auth-protected endpoints, EUR conversion service at 0.85 rate, and 41 green tests including 9 full API integration tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T09:34:28Z
- **Completed:** 2026-03-05T09:37:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 3 REST endpoints: list with search, detail with EPR matrix, admin-only rate updates -- all with EUR conversion
- Service layer centralizes USD-to-EUR conversion with DEFAULT_ADJ_RATE=0.85, applied at router level
- Pydantic schemas extended with explicit EUR fields for type safety (lease_rent_eur, six_year_check_eur, etc.)
- 41 tests passing: 9 API integration + 7 service unit + 12 repository + 13 auth/users -- zero failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Service layer and FastAPI router with all endpoints (TDD)**
   - `6dd0c5c` (test) - RED: 7 failing tests for EUR conversion and router registration
   - `07a1249` (feat) - GREEN: service.py, router.py, updated schemas.py and main.py
2. **Task 2: Unskip all test stubs and make them green** - `ce87784` (feat)

## Files Created/Modified
- `fastapi-project/app/aircraft/service.py` - EUR conversion logic: DEFAULT_ADJ_RATE, apply_eur_conversion()
- `fastapi-project/app/aircraft/router.py` - 3 endpoints: list, detail, update with auth guards
- `fastapi-project/app/aircraft/schemas.py` - Added EUR companion fields to AircraftListResponse and AircraftDetailResponse
- `fastapi-project/app/main.py` - Registered aircraft_router via include_router
- `fastapi-project/tests/test_aircraft_service.py` - 7 unit tests for EUR conversion service
- `fastapi-project/tests/test_aircraft.py` - 9 integration tests for aircraft API endpoints

## Decisions Made
- Added EUR fields explicitly to Pydantic schemas (option a from plan) rather than using response_model=None -- keeps the API contract explicit and type-safe
- apply_eur_conversion creates a new dict rather than mutating input, safe for reuse
- Router follows the established users/router.py pattern: APIRouter prefix, Depends for auth, repository per endpoint
- Test helper _login() authenticates via /auth/login endpoint to get cookies, matching existing test_auth.py pattern

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Aircraft API complete: all 3 endpoints functional with auth and EUR conversion
- Plan 03 (frontend aircraft pages) can consume GET /aircraft and GET /aircraft/{msn}
- Phase 3 pricing engine can use PUT /aircraft/{msn}/rates for config updates
- MockConnection handles all aircraft query patterns without modification needed

## Self-Check: PASSED

All 6 files verified on disk. All 3 task commits (6dd0c5c, 07a1249, ce87784) verified in git log.

---
*Phase: 02-aircraft-master-data*
*Completed: 2026-03-05*
