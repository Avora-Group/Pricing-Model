# Milestones

## v2.0 Dashboard & Project Pipeline (Closed: 2026-09-30)

**Phases:** 6–10. Phase 6 (project schema foundation, 2 plans) ran under GSD and completed 2026-06-05.
**Closeout:** closed from code evidence, not a verified closeout. Phases 7–10 were built outside GSD in the commits after 2026-06-05, so they have no plans, summaries or verification records. No per-requirement audit was run.
**Evidence on `main` at `7c9993d`:** the `/calculation` and `/dashboard` routes and the middleware lists; `quotes.project_id` in the quotes router and repository; `status_source` stamping in `pricing/routes/projects.py`; `pricing/routes/dashboard.py`; `DashboardMetrics.tsx` and `FleetBoard.tsx`.
**Drift from the v2.0 spec:** migrations 010–013 add `active` and `completed` states beyond the two-state (potential/signed) model the requirements describe.
**Archive:** `milestones/v2.0-phases/` (phases 1–7 directories as they stood; Phase 7 holds research only).

**Carried forward:** QUOT-06 (PDF export) is still pending. The API test suite's `_login()` helper posts to the removed `/auth/login`.

---

## v1.0 Core Pricing Tool (Shipped: 2026-03-10)

**Phases completed:** 5 phases, 17 plans
**Delivered:** authentication, aircraft master data, the pricing engine, quote persistence and history, admin controls and deployment configuration.

---
