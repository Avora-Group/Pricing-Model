---
phase: 06-project-schema-foundation
plan: 01
subsystem: database
tags: [postgres, migration, pydantic, fastapi, asyncpg]

# Dependency graph
requires:
  - phase: 04-quote-persistence-and-history
    provides: pricing_projects table and ProjectRepository CRUD
provides:
  - "pricing_projects.status column ('potential'|'signed', default 'potential')"
  - "pricing_projects.status_source column ('automatic'|'manual', default 'manual')"
  - "pricing_projects.signed_at nullable TIMESTAMPTZ column"
  - "idx_pricing_projects_status index"
  - "ProjectResponse API model exposes status/status_source/signed_at"
  - "update_project round-trips status/status_source/signed_at (writable provenance)"
affects: [07-project-status-backend-and-auto-sign, 09-calculation-page-status-control, 10-dashboard-metrics-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent ADD COLUMN IF NOT EXISTS with inline CHECK (mirrors migrations 006/007)"
    - "Column DEFAULT backfills existing rows at ALTER time (no separate UPDATE)"
    - ".get(...)-with-default convention for populating new ProjectResponse fields"

key-files:
  created:
    - fastapi-project/migrations/008_add_project_status.sql
  modified:
    - fastapi-project/app/pricing/schemas.py
    - fastapi-project/app/pricing/routes/projects.py
    - fastapi-project/tests/conftest.py
    - fastapi-project/tests/test_pricing.py

key-decisions:
  - "Provenance modeled as status_source ('automatic'|'manual') rather than a boolean status_overridden, so Phase 7's auto-sign guard (WHERE status_source <> 'manual') is directly expressible"
  - "signed_at has no DEFAULT — stays NULL for potential rows; set on first transition to signed (enforcement deferred to Phase 7/9)"
  - "No status-mutation/auto-sign logic ships here — pure schema + API plumbing"

patterns-established:
  - "Migration 008 idempotent inline-CHECK ADD COLUMN pattern reused for future column adds"
  - "Mock-DB _handle_projects_insert setdefaults mirror SQL column DEFAULTs to keep tests faithful"

requirements-completed: [PROJ-01, PROJ-05]

# Metrics
duration: 5min
completed: 2026-06-05
---

# Phase 6 Plan 01: Project Schema Foundation Summary

**Added project lifecycle status + provenance (status / status_source / signed_at) to pricing_projects via idempotent migration 008 and exposed all three on the ProjectResponse API model with writable round-trip through the existing generic update_project.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-05T15:48Z
- **Completed:** 2026-06-05T15:53Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Migration 008 adds `status`, `status_source`, `signed_at` columns + `idx_pricing_projects_status`, fully idempotent (inline CHECKs, no BEGIN/COMMIT, no backfill UPDATE).
- `ProjectResponse` now exposes `status` (default 'potential'), `status_source` (default 'manual'), `signed_at` (default None); all three route constructors (create/list/detail) populate them via `.get(...)` defaults.
- New repository-level test `test_project_status_update` proves PROJ-05: `update_project(status='signed', status_source='automatic', signed_at=...)` round-trips through the existing generic dynamic UPDATE — no new repo method.
- Mock-DB `_handle_projects_insert` setdefaults the three new fields to match the SQL column DEFAULTs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 008 (status + provenance columns)** - `a4e30bc` (feat)
2. **Task 2: Wave 0 — mock-DB defaults + failing tests** - `8560a6b` (test, TDD RED)
3. **Task 3: Expose status/provenance on ProjectResponse + constructors** - `a8c700b` (feat, TDD GREEN)

_Note: Task 2 (RED) and Task 3 (GREEN) form the TDD pair; no separate refactor commit was needed._

## Files Created/Modified
- `fastapi-project/migrations/008_add_project_status.sql` - status/status_source/signed_at columns + status index (idempotent)
- `fastapi-project/app/pricing/schemas.py` - import datetime; add status/status_source/signed_at to ProjectResponse
- `fastapi-project/app/pricing/routes/projects.py` - populate the three fields in create_project, list_projects, get_project constructors
- `fastapi-project/tests/conftest.py` - setdefault status/status_source/signed_at in _handle_projects_insert
- `fastapi-project/tests/test_pricing.py` - default-field assertions in create/list/detail tests + new test_project_status_update

## Decisions Made
- Modeled provenance as `status_source` enum (not a boolean override flag) to make Phase 7's auto-sign guard expressible. (From plan.)
- `signed_at` deliberately has no DEFAULT and stays NULL until first sign. (From plan.)
- No auto-sign / status-mutation behavior in this phase; pure foundation plumbing. (From plan.)

## Deviations from Plan

None - plan executed exactly as written. (No Rule 1-4 deviations; no auto-fixes needed.)

## Issues Encountered

**Pre-existing test-suite breakage (out of scope, NOT fixed):** Every API-level test in the
suite uses a `_login()` helper that POSTs to `/auth/login`, but that endpoint no longer exists
— the project migrated to Azure SSO (commit 356d0d8), and `app/auth/router.py` now exposes only
`/auth/logout`, `/auth/azure`, `/auth/me`. All login-based tests therefore fail with `404` before
reaching any assertions. This is unrelated to Phase 6 and was logged to
`.planning/phases/06-project-schema-foundation/deferred-items.md` per the scope boundary.

- **Baseline (parent commit 05ffd91):** 38 failed, 82 passed.
- **After this plan:** 38 failed, 83 passed — same 38 pre-existing login-gate failures, plus the
  one new passing `test_project_status_update`. **Zero regressions introduced.**
- **GREEN verification despite the gate:** The implementation was verified end-to-end via a
  TestClient run with a dependency-override for `get_current_user`/`get_db` that bypasses the
  broken login endpoint — `create_project`, `list_projects`, and `get_project` all return the
  three new fields with the correct defaults. The new `test_project_status_update` (which does not
  use `_login`) passes through pytest, proving the PROJ-05 round-trip.

## Manual Verification Required (Phase gate)

The migration idempotency gate cannot be exercised by the mock DB. Per the plan's verification
block, before phase close run against a scratch Postgres:
`psql $DATABASE_URL -f fastapi-project/migrations/008_add_project_status.sql` **twice** — the
second run must be a no-op with no error.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema + API foundation is in place: Phase 7 (auto-sign) can write `status`/`status_source`/`signed_at`
  via the existing `update_project`, and its auto-sign guard `WHERE status_source <> 'manual'` is now expressible.
- Phases 9 and 10 can read the three fields off `ProjectResponse`.
- **Concern carried forward:** The Azure-SSO login-gate test breakage should be addressed by a
  maintenance task so the API-level project tests (including the status-field assertions added here)
  can execute again.

## Self-Check: PASSED

All 5 modified/created code files and the SUMMARY exist on disk; all 3 task commits
(`a4e30bc`, `8560a6b`, `a8c700b`) are present in git history.

---
*Phase: 06-project-schema-foundation*
*Completed: 2026-06-05*
