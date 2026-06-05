---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Dashboard & Project Pipeline
status: in-progress
stopped_at: Completed 06-01-PLAN.md
last_updated: "2026-06-05T15:54:58.692Z"
last_activity: 2026-06-05 — Completed Phase 6 Plan 01 (migration 008 + ProjectResponse fields)
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05)

**Core value:** Accurate, repeatable ACMI pricing quotes that the sales team can generate, save, and retrieve — replacing manual spreadsheet-based pricing with a structured tool that produces consistent results.
**Current focus:** Milestone v2.0 — rename Dashboard to Calculation, build real Dashboard with project pipeline metrics (potential vs signed).

## Current Position

Phase: Phase 6 — Project Schema Foundation (in progress)
Plan: 06-01 complete (1/2); next 06-02
Status: Plan 06-01 executed — status/provenance schema + ProjectResponse fields shipped
Last activity: 2026-06-05 — Completed Phase 6 Plan 01 (migration 008 + ProjectResponse fields)

v2.0 phases (execute 6 -> 7 -> 8 -> 9 -> 10; Phase 8 independent of 6-7, must precede 10):
- [ ] Phase 6: Project Schema Foundation — PROJ-01, PROJ-05
- [ ] Phase 7: Project Status Backend & Auto-Sign — PROJ-03, PROJ-04
- [ ] Phase 8: Route Rename (Dashboard → Calculation) — NAV-01, NAV-02
- [ ] Phase 9: Calculation-Page Status Control — PROJ-02
- [ ] Phase 10: Dashboard Metrics Page — DASH-01..07

Next: `/gsd:plan-phase 6`

## Performance Metrics

**Velocity:**
- Total plans completed: 17 (v1.0)
- Average duration: 6min
- Total execution time: 1.25 hours

**By Phase (v1.0):**

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
| Phase 06 P01 | 5min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current (v2.0) work:

- [v2.0]: Project status lives on `pricing_projects`, auto-updated by accepted quotes (single source of truth + manual override)
- [v2.0]: Status managed inside Calculation page; Dashboard is read-only company-wide metrics (separate workspace from reporting)
- [v2.0]: Contract value = EUR/BH × MGH × period months
- [v2.0]: Auto-sign is escalation-only (potential→signed) and never overwrites manual overrides; downgrades are manual
- [v2.0]: Login lands on `/dashboard` (metrics); pricing workspace moves to `/calculation`
- [v2.0]: Authoritative quote per project = latest accepted (signed) else latest non-rejected (potential) — prevents revenue double-counting
- [v2.0]: All monetary aggregation in SQL at NUMERIC precision; never re-sum money in JS

Carried v1.0 decisions still relevant:
- [Init]: Match AeroVista stack exactly — FastAPI + Next.js 14 + PostgreSQL 15+ with asyncpg raw SQL
- [Init]: All monetary calculations use Python decimal.Decimal and PostgreSQL NUMERIC — never float
- [Init]: Quote immutability is a schema-level decision — store all seven component values and config FK at save time
- [02-03]: Server Components fetch API with cookie forwarding (cookies() from next/headers) — keeps API_URL server-only
- [Phase 04-01]: DecimalEncoder converts Decimal to string (not float) in JSONB to preserve precision
- [Phase 04]: Fork behavior: loadFromQuote sets projectId=null so saving creates a new quote, preserving original immutability
- [Phase 05]: next-themes handles theme persistence; SensitivityChart.tsx is the proven recharts + dark-mode pattern to reuse
- [Phase 06-01]: Project provenance modeled as status_source ('automatic'|'manual'), not a boolean override, so Phase 7 auto-sign guard (WHERE status_source <> 'manual') is directly expressible

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 10]: Three product decisions gate the metrics aggregation SQL — (a) authoritative-quote rule for potential projects, (b) company-wide scope, (c) period_months source (live project_msn_inputs vs quote snapshot). Decisions (a) and (b) are now made (see Decisions above); confirm period_months source during Phase 10 planning.
- Test suite: _login() helper POSTs to removed /auth/login (Azure SSO migration) — all API-level tests 404 before assertions; pre-existing, logged in deferred-items.md. Needs a maintenance task to re-enable API tests.

## Session Continuity

Last session: 2026-06-05T15:54:23.711Z
Stopped at: Completed 06-01-PLAN.md
Resume file: None
