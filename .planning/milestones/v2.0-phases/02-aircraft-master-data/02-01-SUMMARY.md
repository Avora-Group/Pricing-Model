---
phase: 02-aircraft-master-data
plan: 01
subsystem: database
tags: [asyncpg, pydantic, postgresql, decimal, openpyxl, aircraft, epr-matrix]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: BaseRepository, MockConnection, conftest fixtures, asyncpg database layer
provides:
  - Aircraft database schema (3 tables: aircraft, aircraft_rates, epr_matrix_rows)
  - AircraftRepository with list/search/detail/update/upsert methods
  - Pydantic schemas for aircraft request/response with Decimal types
  - Excel seed script for all 11 MSNs with EPR matrices (110 rows)
  - Extended MockConnection for aircraft/rates/EPR table queries
  - test_aircraft_data fixture with 2 aircraft, rates, and EPR rows
  - 9 Wave 0 test stubs for API router (Plan 02)
affects: [02-02-PLAN, 02-03-PLAN, 03-pricing-engine]

# Tech tracking
tech-stack:
  added: [openpyxl==3.1.5]
  patterns: [multi-table MockConnection routing, TDD for repository layer, NUMERIC precision for monetary columns]

key-files:
  created:
    - fastapi-project/migrations/002_create_aircraft.sql
    - fastapi-project/app/aircraft/__init__.py
    - fastapi-project/app/aircraft/schemas.py
    - fastapi-project/app/aircraft/repository.py
    - fastapi-project/scripts/seed_aircraft.py
    - fastapi-project/tests/test_aircraft.py
    - fastapi-project/tests/test_aircraft_repository.py
  modified:
    - fastapi-project/tests/conftest.py
    - fastapi-project/requirements.txt

key-decisions:
  - "MockConnection uses _detect_table() to route queries by FROM/INTO clause, not by simple substring match, to handle JOIN queries correctly"
  - "ILIKE search check precedes WHERE MSN/ID checks in mock to avoid false matches on search queries"
  - "Seed script hardcodes all data from Excel audit for reliability, with optional Excel validation for mismatch detection"
  - "Using 2026 EPR tables for MSNs 1932, 1960, 1503 (most current data)"
  - "EPR matrix stores per-engine rates; pricing engine multiplies by engine count in Phase 3"

patterns-established:
  - "Aircraft module structure: __init__.py, schemas.py, repository.py (router.py and service.py added in Plan 02)"
  - "Multi-table MockConnection: _detect_table() routes to table-specific handlers based on FROM/INTO clause"
  - "NUMERIC(12,2) for dollar amounts, NUMERIC(10,4) for rates, NUMERIC(6,4) for escalation percentages"
  - "TDD for data layer: RED (failing tests) -> GREEN (implementation) -> verify with full suite"
  - "Seed script with --dry-run flag and Excel validation"

requirements-completed: [ACFT-01]

# Metrics
duration: 7min
completed: 2026-03-05
---

# Phase 2 Plan 01: Aircraft Data Layer Summary

**3-table aircraft schema with NUMERIC precision, AircraftRepository with TDD-verified CRUD, Excel seed for 11 MSNs (110 EPR rows), and Wave 0 test stubs for API router**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T09:23:57Z
- **Completed:** 2026-03-05T09:31:05Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Migration SQL defines aircraft, aircraft_rates, and epr_matrix_rows tables with explicit NUMERIC precision/scale (avoids asyncpg scientific notation)
- AircraftRepository extends BaseRepository with list/search/detail/update/create/upsert methods following UserRepository pattern
- Pydantic schemas use Decimal exclusively for all monetary fields (never float)
- Seed script contains complete data for all 11 MSNs including 110 EPR matrix rows extracted from Excel audit
- MockConnection extended to handle aircraft/rates/EPR table queries without breaking existing 13 auth tests
- 12 new repository/schema tests + 9 Wave 0 stubs = 34 total tests (25 passed, 9 skipped)

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration, Pydantic schemas, and AircraftRepository (TDD)**
   - `e0e70ee` (test) - RED: failing tests for repository and schemas
   - `8ac1a77` (feat) - GREEN: implementation + extended MockConnection
2. **Task 2: Seed script, Wave 0 test stubs** - `f49d8ea` (feat)

## Files Created/Modified
- `fastapi-project/migrations/002_create_aircraft.sql` - DDL for aircraft, aircraft_rates, epr_matrix_rows tables
- `fastapi-project/app/aircraft/__init__.py` - Empty package marker
- `fastapi-project/app/aircraft/schemas.py` - AircraftListResponse, AircraftDetailResponse, EprMatrixRow, UpdateRatesRequest
- `fastapi-project/app/aircraft/repository.py` - AircraftRepository with list/search/detail/update/upsert
- `fastapi-project/scripts/seed_aircraft.py` - Excel-to-database import for all 11 MSNs with --dry-run
- `fastapi-project/tests/test_aircraft_repository.py` - 12 tests: 5 schema + 7 repository
- `fastapi-project/tests/test_aircraft.py` - 9 Wave 0 test stubs (all skipped)
- `fastapi-project/tests/conftest.py` - Extended MockConnection for aircraft tables + test_aircraft_data fixture
- `fastapi-project/requirements.txt` - Added openpyxl==3.1.5

## Decisions Made
- MockConnection table routing uses FROM/INTO clause detection rather than simple substring matching to correctly handle JOIN queries (e.g., aircraft LEFT JOIN aircraft_rates)
- ILIKE search check precedes WHERE MSN check in mock handler to avoid false matches when search pattern is a string
- Seed script uses hardcoded data from Excel audit rather than dynamic parsing (more reliable for complex multi-sheet layout), with optional Excel validation for mismatch warnings
- Using 2026 EPR tables where both 2025 and 2026 exist (MSNs 1932, 1960, 1503) per research recommendation
- MSN 4023 (found in workbook row 52) excluded as it is not in the confirmed 11 MSN fleet

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MockConnection table detection for JOIN queries**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** `_detect_table()` matched "AIRCRAFT_RATES" substring in JOIN queries, routing aircraft list/search to wrong handler
- **Fix:** Changed detection to check FROM clause (primary table) rather than any substring match
- **Files modified:** fastapi-project/tests/conftest.py
- **Verification:** All 12 repository tests pass
- **Committed in:** 8ac1a77

**2. [Rule 1 - Bug] Fixed ILIKE/MSN check ordering in MockConnection**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** WHERE A.MSN check matched before ILIKE check, treating search queries as fetch_by_msn
- **Fix:** Moved ILIKE check before WHERE MSN/ID checks in handler priority
- **Files modified:** fastapi-project/tests/conftest.py
- **Verification:** Search-by-MSN and search-by-registration tests pass
- **Committed in:** 8ac1a77

---

**Total deviations:** 2 auto-fixed (2 bugs in mock layer)
**Impact on plan:** Both fixes required for MockConnection correctness with aircraft queries. No scope creep.

## Issues Encountered
None beyond the MockConnection routing bugs (documented above as deviations).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Aircraft data layer complete: schema, repository, schemas, seed script, test fixtures
- Plan 02 can build API router on top of AircraftRepository
- Plan 02 will unskip 9 Wave 0 test stubs and implement endpoint tests
- Seed script ready to populate real database when PostgreSQL is available

## Self-Check: PASSED

All 9 created files verified on disk. All 3 task commits (e0e70ee, 8ac1a77, f49d8ea) verified in git log.

---
*Phase: 02-aircraft-master-data*
*Completed: 2026-03-05*
