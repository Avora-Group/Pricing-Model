---
phase: 04-quote-persistence-and-history
plan: 01
subsystem: database
tags: [postgres, jsonb, asyncpg, pydantic, decimal, quote-persistence, repository-pattern, immutable-snapshots]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: BaseRepository, users table, mock DB conftest, FastAPI app
  - phase: 03-pricing-engine
    provides: pricing_config/crew_config tables, Pydantic Decimal patterns, MockConnection routing patterns
provides:
  - quotes, quote_msn_snapshots, quote_sequences tables (migration 004)
  - QuoteRepository with CRUD, atomic quote number generation, status updates
  - Pydantic schemas for SaveQuoteRequest, QuoteListItem, QuoteDetailResponse, UpdateQuoteStatusRequest
  - DecimalEncoder for Decimal-safe JSONB serialization
  - MockConnection handlers for 3 new tables (quotes, quote_msn_snapshots, quote_sequences)
  - Wave 0 test stubs (7 tests, RED -- router not yet registered)
  - test_quote and test_quote_msn_snapshot fixtures
affects: [04-02-quote-api-router, 04-03-quote-frontend, 04-04-sensitivity-analysis]

# Tech tracking
tech-stack:
  added: []
  patterns: [JSONB snapshot storage for immutable audit snapshots, atomic counter with INSERT ON CONFLICT for quote number generation, hybrid normalized metadata plus JSONB schema]

key-files:
  created:
    - fastapi-project/migrations/004_create_quotes.sql
    - fastapi-project/app/quotes/__init__.py
    - fastapi-project/app/quotes/schemas.py
    - fastapi-project/app/quotes/repository.py
    - fastapi-project/app/quotes/service.py
    - fastapi-project/tests/test_quotes.py
  modified:
    - fastapi-project/tests/conftest.py

key-decisions:
  - "JSONB columns for config snapshots and monthly P&L data to avoid schema explosion while keeping metadata columns normalized for search"
  - "Quote number generation uses INSERT ON CONFLICT DO UPDATE with RETURNING for atomic counter increment -- race-free without explicit locking"
  - "DecimalEncoder converts Decimal to string (not float) in JSON to preserve precision in JSONB storage"
  - "Client code validated as 2-4 uppercase letters via Pydantic field_validator"

patterns-established:
  - "JSONB insert pattern: assemble_snapshot_json() wraps json.dumps with DecimalEncoder, passed as string with ::jsonb cast in SQL"
  - "Quote table detection in _detect_table: quote_msn_snapshots checked before quotes to avoid false matches"
  - "Mock JSONB handling: INSERT handlers parse JSON strings back to dicts for in-memory storage"

requirements-completed: [QUOT-01, QUOT-02]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 4 Plan 1: Quote Persistence Data Layer Summary

**Quote persistence data layer with JSONB snapshot storage, atomic quote numbering, DecimalEncoder for precision-safe serialization, and 7 RED test stubs for the quote API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T16:35:24Z
- **Completed:** 2026-03-09T16:40:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Migration 004 creates 3 tables (quotes, quote_msn_snapshots, quote_sequences) with hybrid normalized metadata + JSONB snapshot columns, GIN index on msn_list, and proper foreign key constraints
- QuoteRepository extends BaseRepository with 8 methods: generate_quote_number, create_quote, create_msn_snapshot, list_quotes, count_quotes, get_quote, get_quote_msn_snapshots, update_status
- Pydantic schemas (6 models) enforce Decimal types for monetary fields and field_validator for client code format (2-4 uppercase letters) and status values
- MockConnection extended with 7 new handlers for quotes, quote_msn_snapshots, and quote_sequences tables (SELECT, INSERT, UPDATE routing)
- 7 Wave 0 test stubs fail meaningfully (RED) because router is not yet registered -- ready to go GREEN in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and Pydantic schemas** - `d33ab6a` (feat)
2. **Task 2: QuoteRepository, service, mock DB, and test stubs** - `6fc562e` (feat)

## Files Created/Modified
- `fastapi-project/migrations/004_create_quotes.sql` - DDL for quotes, quote_msn_snapshots, quote_sequences with indexes
- `fastapi-project/app/quotes/__init__.py` - Empty package init
- `fastapi-project/app/quotes/schemas.py` - 6 Pydantic models for quote CRUD with Decimal types and validators
- `fastapi-project/app/quotes/repository.py` - QuoteRepository with 8 CRUD methods, JSONB serialization via assemble_snapshot_json
- `fastapi-project/app/quotes/service.py` - DecimalEncoder and assemble_snapshot_json utility
- `fastapi-project/tests/test_quotes.py` - 7 test stubs covering QUOT-01 through QUOT-05
- `fastapi-project/tests/conftest.py` - Extended with quote table handlers, fixtures, and 3 new store keys

## Decisions Made
- JSONB columns for config snapshots and monthly P&L data to avoid schema explosion; normalized columns (exchange_rate, margin_percent, msn_list, status) for efficient search/filter without parsing JSONB
- Quote number generation uses INSERT ON CONFLICT DO UPDATE with RETURNING for atomic counter increment, avoiding race conditions without explicit row locking
- DecimalEncoder converts Decimal to string (not float) in JSON serialization, preserving precision like "185000.00" instead of 185000.0
- Client code validation enforces 2-4 uppercase letters (e.g., EZJ, RYR, WIZZ) via Pydantic field_validator with automatic uppercasing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data layer complete: all 3 tables, schemas, repository, service, and mock handlers ready for quote API router (Plan 02)
- test_quote and test_quote_msn_snapshot fixtures available for Plan 02 integration tests
- 7 test stubs ready to go GREEN once router is registered

## Self-Check: PASSED

All 7 files verified present. Both task commits (d33ab6a, ec299dd) found in git log.

---
*Phase: 04-quote-persistence-and-history*
*Completed: 2026-03-09*
