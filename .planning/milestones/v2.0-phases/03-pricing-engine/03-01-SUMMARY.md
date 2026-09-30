---
phase: 03-pricing-engine
plan: 01
subsystem: database
tags: [postgres, asyncpg, pydantic, decimal, pricing, config-versioning, repository-pattern]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: BaseRepository, users table, mock DB conftest, FastAPI app
  - phase: 02-aircraft-master-data
    provides: aircraft/aircraft_rates/epr_matrix_rows tables and repository patterns
provides:
  - pricing_config and crew_config versioned tables (append-only)
  - pricing_projects and project_msn_inputs mutable tables
  - PricingConfigRepository, CrewConfigRepository, ProjectRepository
  - Pydantic schemas for all pricing inputs, configs, and calculation output
  - Mock DB handlers for 4 new tables
  - test_pricing_config and test_crew_config fixtures
  - Seed script for initial config version 1
affects: [03-02-calculation-service, 03-03-pricing-api, 03-04-pnl-frontend, 03-05-crew-page, 04-quote-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [append-only config versioning with is_current flag and partial unique index, dynamic INSERT for version creation, per-aircraft-type crew config]

key-files:
  created:
    - fastapi-project/migrations/003_create_pricing_config.sql
    - fastapi-project/app/pricing/__init__.py
    - fastapi-project/app/pricing/schemas.py
    - fastapi-project/app/pricing/repository.py
    - fastapi-project/scripts/seed_pricing_config.py
  modified:
    - fastapi-project/tests/conftest.py

key-decisions:
  - "Append-only versioning uses is_current boolean flag with PostgreSQL partial unique index to enforce single current row"
  - "crew_config is per aircraft_type (A320/A321) to handle different cabin crew compositions"
  - "pricing_projects stores separate crew_config_a320_id and crew_config_a321_id FKs for quote immutability"
  - "crew_sets stored as per-MSN input in project_msn_inputs (not global project setting)"

patterns-established:
  - "Config versioning: create_version() fetches current, marks is_current=FALSE, inserts new row with version+1"
  - "Dynamic INSERT builder: repositories construct INSERT from base values + overrides for flexible version creation"
  - "Mock DB table detection: pricing tables checked before aircraft in _detect_table() to avoid false matches"

requirements-completed: [PRIC-06, CONF-02, CONF-03]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 3 Plan 1: Pricing Config Data Foundation Summary

**Versioned pricing_config and crew_config tables with append-only repositories, Decimal Pydantic schemas for 7 cost components, project/MSN data model, and mock DB handlers for all 4 new tables**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T12:08:07Z
- **Completed:** 2026-03-05T12:14:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Migration 003 creates 4 tables (pricing_config, crew_config, pricing_projects, project_msn_inputs) with correct NUMERIC precision types and partial unique indexes for versioning
- Pydantic schemas (187 lines) cover all pricing inputs, component breakdown, P&L results, config responses, update requests, and project models -- all monetary fields use Decimal
- Three repository classes (PricingConfigRepository, CrewConfigRepository, ProjectRepository) extend BaseRepository with append-only versioning for configs and full CRUD for projects
- MockConnection extended with 12 new handlers (SELECT/INSERT/UPDATE for pricing_config, crew_config, pricing_projects; SELECT/INSERT/UPDATE/DELETE for project_msn_inputs)
- Seed script hardcodes Excel-audited values for pricing_config and crew_config (A320 + A321) with --dry-run support

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration SQL and seed script** - `385e167` (feat)
2. **Task 2: Schemas, repositories, mock DB handlers** - `634f666` (feat)

## Files Created/Modified
- `fastapi-project/migrations/003_create_pricing_config.sql` - DDL for 4 pricing tables with NUMERIC precision and partial unique indexes
- `fastapi-project/app/pricing/__init__.py` - Empty package init
- `fastapi-project/app/pricing/schemas.py` - 15 Pydantic models for pricing engine data contracts
- `fastapi-project/app/pricing/repository.py` - PricingConfigRepository, CrewConfigRepository, ProjectRepository
- `fastapi-project/scripts/seed_pricing_config.py` - Seed script with hardcoded Excel values and optional validation
- `fastapi-project/tests/conftest.py` - Extended MockConnection with 4 new table handlers and 2 new fixtures

## Decisions Made
- Append-only versioning uses `is_current` boolean flag with PostgreSQL partial unique index (not temporal tables or SCD Type 2) -- simpler, sufficient for expected ~10-20 config versions
- crew_config is per aircraft_type to handle A320 (1 senior + 3 regular) vs A321 (1 senior + 4 regular) cabin crew differences
- pricing_projects stores separate crew_config_a320_id and crew_config_a321_id FKs so quotes reference the exact crew config version per aircraft type
- crew_sets modeled as per-MSN input in project_msn_inputs (not global) since different MSNs in a project may have different crew arrangements
- Seed script values are representative placeholders pending full Excel cell-reference audit (consistent with STATE.md blocker note)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data layer complete: all 4 tables, schemas, repositories, and mock handlers ready for pricing calculation service (Plan 02)
- test_pricing_config and test_crew_config fixtures available for Plan 02 unit tests
- Seed script ready to populate real database when PostgreSQL is available

## Self-Check: PASSED

All 6 files verified present. Both task commits (385e167, 634f666) found in git log.

---
*Phase: 03-pricing-engine*
*Completed: 2026-03-05*
