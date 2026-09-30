---
phase: 03-pricing-engine
plan: 03
subsystem: api
tags: [fastapi, pricing, decimal, config-versioning, crud, epr-interpolation, project-management]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: BaseRepository, users table, auth dependencies, FastAPI app, mock DB conftest
  - phase: 02-aircraft-master-data
    provides: AircraftRepository, aircraft/rates/EPR tables, EUR conversion pattern
  - phase: 03-pricing-engine
    plan: 01
    provides: PricingConfigRepository, CrewConfigRepository, ProjectRepository, Pydantic schemas, mock DB handlers
provides:
  - Pricing router with 12 endpoints (calculate, config CRUD, crew config CRUD, project CRUD, MSN input CRUD)
  - Service layer with 7-component calculator, EPR interpolation, project P&L aggregation
  - Router registered in main.py as /pricing prefix
  - 18 integration tests covering all endpoints with auth gating
  - Config versioning verified at API level (append-only, old versions retrievable)
affects: [03-04-pnl-frontend, 03-05-crew-page, 04-quote-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [router imports service layer for calculation, EPR interpolation at router level before passing to service, Pydantic schema conversion from service dataclass result, auto-attach config FKs on project creation]

key-files:
  created:
    - fastapi-project/app/pricing/router.py
    - fastapi-project/app/pricing/service.py
  modified:
    - fastapi-project/app/main.py
    - fastapi-project/app/pricing/repository.py
    - fastapi-project/tests/test_pricing.py
    - fastapi-project/tests/test_pricing_service.py
    - fastapi-project/tests/test_pricing_fixtures.py

key-decisions:
  - "Router interpolates EPR rate and passes pre-computed epr_rate to AircraftCosts dataclass, keeping service layer pure"
  - "Project creation auto-attaches current pricing_config, crew_config_a320, and crew_config_a321 FKs via repository"
  - "Service layer uses its own ComponentBreakdown dataclass; router converts to Pydantic schema for API response"
  - "Config versioning enforced at API layer: PUT creates new version via append-only repo, GET retrieves any version by ID"

patterns-established:
  - "Router-to-service bridge: router fetches data, builds dataclasses, calls pure service, converts result to Pydantic"
  - "Auto-attach config versions: project creation captures current config snapshot IDs for quote immutability"
  - "EPR interpolation pipeline: fetch matrix rows -> build (cr, rate) tuples -> interpolate -> pass rate to AircraftCosts"

requirements-completed: [PRIC-01, CONF-01, CONF-02, CONF-03]

# Metrics
duration: 8min
completed: 2026-03-05
---

# Phase 3 Plan 3: Pricing API Summary

**Full pricing API with 12 endpoints: 7-component P&L calculation, versioned config CRUD, crew config CRUD, project/MSN management, and 18 integration tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-05T12:17:13Z
- **Completed:** 2026-03-05T12:25:38Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 7

## Accomplishments
- 12 pricing API endpoints: calculate, config get/get-version/update, crew-config get/update, projects create/list/detail, MSN input add/update/delete
- P&L calculation engine with all 7 ACMI cost components, EPR interpolation, margin formula, and project aggregation
- Config versioning verified at API level: PUT creates version+1, old versions retrievable unchanged (CONF-02, CONF-03)
- Auth gating: require_admin for config writes, get_current_user for reads; 401/403 tests green
- 112 total tests passing (18 new pricing API + 48 pricing service/fixtures + 46 prior)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing integration tests** - `e1bde5a` (test)
2. **Task 1 GREEN: Router, service, all tests passing** - `dd48587` (feat)

## Files Created/Modified
- `fastapi-project/app/pricing/router.py` - All 12 pricing API endpoints with auth dependencies
- `fastapi-project/app/pricing/service.py` - Pure calculation engine: 7 component calculators, EPR interpolation, project P&L aggregation
- `fastapi-project/app/main.py` - Added pricing_router include
- `fastapi-project/app/pricing/repository.py` - Updated ProjectRepository.create_project to accept config FK IDs
- `fastapi-project/tests/test_pricing.py` - 18 integration tests for all pricing endpoints
- `fastapi-project/tests/test_pricing_service.py` - Fixed to match service.py API (pre-existing file from incomplete Plan 02)
- `fastapi-project/tests/test_pricing_fixtures.py` - Fixed to match service.py API (pre-existing file from incomplete Plan 02)

## Decisions Made
- Router interpolates EPR rate at the API layer (fetch matrix, build tuples, call interpolate_epr) and passes pre-computed epr_rate to AircraftCosts -- keeps service layer pure with no DB awareness
- Service layer defines its own ComponentBreakdown dataclass separate from the Pydantic schema -- router converts between them for API response serialization
- Project creation auto-attaches current config version IDs (pricing_config, crew_config_a320, crew_config_a321) so quotes reference the exact config snapshot
- Updated ProjectRepository.create_project signature to accept config_version_id, crew_config_a320_id, crew_config_a321_id

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created service.py as blocking dependency**
- **Found during:** Task 1 (Router implementation)
- **Issue:** Plan 03-02 (calculation service) was not yet executed, but the router imports from app.pricing.service
- **Fix:** Created service.py with calculate_pricing, calculate_project_pnl, interpolate_epr, and dataclasses per Plan 02 specification
- **Files modified:** fastapi-project/app/pricing/service.py
- **Verification:** All 112 tests pass including service unit tests
- **Committed in:** dd48587

**2. [Rule 1 - Bug] Fixed pre-existing test files with API mismatches**
- **Found during:** Task 1 (Full suite verification)
- **Issue:** test_pricing_service.py and test_pricing_fixtures.py had API mismatches (wrong field names, wrong CREW_COMPOSITION format, wrong function signatures) from an incomplete Plan 02 attempt
- **Fix:** Updated both test files to match the actual service.py implementation
- **Files modified:** fastapi-project/tests/test_pricing_service.py, fastapi-project/tests/test_pricing_fixtures.py
- **Verification:** All 112 tests pass
- **Committed in:** dd48587

**3. [Rule 3 - Blocking] Updated ProjectRepository.create_project for config FKs**
- **Found during:** Task 1 (Project creation endpoint)
- **Issue:** create_project only accepted name/created_by but plan requires auto-attaching config version IDs
- **Fix:** Added config_version_id, crew_config_a320_id, crew_config_a321_id parameters to create_project
- **Files modified:** fastapi-project/app/pricing/repository.py
- **Verification:** test_create_project verifies config_version_id is non-null
- **Committed in:** dd48587

---

**Total deviations:** 3 auto-fixed (1 blocking dependency, 1 bug fix, 1 blocking API gap)
**Impact on plan:** All auto-fixes necessary for correctness. Service.py creation was essential since Plan 02 was not yet executed. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All pricing API endpoints functional and tested, ready for frontend consumption (Plan 04: P&L frontend, Plan 05: Crew page)
- Config versioning verified end-to-end: create, retrieve current, retrieve by version ID, update creates new version
- Service layer available for Plan 02 TDD completion (calculate_pricing, interpolate_epr already implemented)
- 112 tests green across all phases

## Self-Check: PASSED

All 7 files verified present. Both task commits (e1bde5a, dd48587) found in git log.

---
*Phase: 03-pricing-engine*
*Completed: 2026-03-05*
