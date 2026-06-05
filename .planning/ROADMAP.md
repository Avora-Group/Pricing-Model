# Roadmap: ACMI Pricing Platform

## Overview

**Current milestone: v2.0 — Dashboard & Project Pipeline.** This milestone separates the pricing workspace from reporting. The existing Dashboard becomes "Calculation" (the pricing workspace), pricing projects gain a potential/signed lifecycle managed inside Calculation, quotes link to projects so an accepted quote auto-signs its project, and a new read-only company-wide Dashboard surfaces pipeline metrics.

The structure follows a strict dependency chain established by research: the schema (`pricing_projects.status` + provenance, `quotes.project_id`) must exist before any behavior can attach to it, the backend behavior must be correct before the UI consumes it, the route rename must be isolated to avoid partial-broken navigation, and the metrics Dashboard is built last because it is the read-only consumer of everything beneath it. Each phase delivers an independently verifiable capability.

## v1.0 (shipped)

Milestone v1.0 — Core Pricing Tool — shipped 2026-03-10. Five phases, all complete:

- [x] **Phase 1: Foundation and Authentication** — Secure access, project scaffold, database schema foundation (completed 2026-03-05)
- [x] **Phase 2: Aircraft Master Data** — Aircraft records with cost parameters feeding the pricing engine (completed 2026-03-05)
- [x] **Phase 3: Pricing Engine** — Formula-accurate EUR/BH calculation across all seven ACMI cost components (completed 2026-03-10)
- [x] **Phase 4: Quote Persistence and History** — Save, retrieve, and manage pricing quotes as auditable records (completed 2026-03-10)
- [x] **Phase 5: Polish and Production Readiness** — Admin controls, UI completeness, deployment configuration (completed 2026-03-10)

Carried-over requirement: QUOT-06 (PDF export) remains pending and is not scheduled in v2.0.

## Phases

**Phase Numbering:**
- Integer phases (6, 7, 8): Planned milestone work for v2.0
- Decimal phases (6.1, 6.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 6: Project Schema Foundation** - Status + provenance columns on projects and the quote→project FK that every v2.0 feature depends on (completed 2026-06-05)
- [ ] **Phase 7: Project Status Backend & Auto-Sign** - Quotes linked to projects; an accepted quote atomically signs its project, escalation-only
- [ ] **Phase 8: Route Rename (Dashboard → Calculation)** - Pricing workspace moves to /calculation; /dashboard freed and login lands there
- [ ] **Phase 9: Calculation-Page Status Control** - Users set and see project status (potential/signed) with provenance inside the Calculation page
- [ ] **Phase 10: Dashboard Metrics Page** - Read-only company-wide Dashboard with pipeline, contract value, margins, fleet utilization, and breakdowns

## Phase Details

### Phase 6: Project Schema Foundation
**Goal**: The database can represent project lifecycle state and quote-to-project ownership, so all subsequent v2.0 behavior has a place to live
**Depends on**: Phase 5 (v1.0 shipped schema)
**Requirements**: PROJ-01, PROJ-05
**Success Criteria** (what must be TRUE):
  1. Every existing and new pricing project has a `status` of `potential` or `signed`, with new projects defaulting to `potential`
  2. Projects can record provenance: a `signed_at` timestamp and a `status_source` (automatic vs manual) distinguishing quote-driven changes from manual overrides
  3. Every quote can be linked to a project via `quotes.project_id`; existing quotes remain valid with a null linkage and no existing quote or project is broken by the migration
  4. The migrations are idempotent and re-runnable, following the established pattern of migrations 001–007
**Plans**: 2 plans
- [ ] 06-01-PLAN.md — pricing_projects status + provenance columns (migration 008) + ProjectResponse exposure (PROJ-01, PROJ-05)
- [ ] 06-02-PLAN.md — nullable quotes.project_id FK (migration 009), foundation for project linkage (PROJ-03)

### Phase 7: Project Status Backend & Auto-Sign
**Goal**: When a sales user accepts a quote, that quote's project becomes signed automatically and atomically — without ever overwriting a manual decision
**Depends on**: Phase 6
**Requirements**: PROJ-03, PROJ-04
**Success Criteria** (what must be TRUE):
  1. A quote saved from a project is persisted with its `project_id`, so the quote is attributable to exactly one project through the save flow
  2. Marking a linked quote as Accepted sets its project to `signed` in the same database transaction, and re-accepting the same quote is idempotent (no error, no duplicate side effect)
  3. Auto-sign is escalation-only: un-accepting or rejecting a quote never auto-demotes a project back to potential
  4. Auto-sign never fires when the project status was set manually (the manual-override guard is respected), and the change is stamped as automatic in provenance
**Plans**: TBD

### Phase 8: Route Rename (Dashboard → Calculation)
**Goal**: The pricing workspace lives at `/calculation` and the `/dashboard` URL is freed for the new metrics page, with navigation intact everywhere
**Depends on**: Phase 5 (independent of Phases 6–7; must complete before Phase 10)
**Requirements**: NAV-01, NAV-02
**Success Criteria** (what must be TRUE):
  1. The sidebar shows the pricing workspace as "Calculation" served at `/calculation`, and every navigation entry point reaches it correctly (Sidebar, BottomTabBar, QuoteHeader)
  2. All route protection and viewer allowlists in middleware reference `/calculation`, so both standard users and viewers can reach the workspace without 403s or redirect loops
  3. After login, the user lands on `/dashboard`; the root page redirect and the Azure SSO callback both target the Dashboard
  4. A request to the old `/dashboard` workspace bookmark does not 404 — it resolves to the new location via a configured redirect
**Plans**: TBD

### Phase 9: Calculation-Page Status Control
**Goal**: A user can read and change a project's pipeline status directly in the Calculation page, and can tell whether a signed status came from a quote or from a manual decision
**Depends on**: Phase 7 (status backend), Phase 8 (Calculation URL stable)
**Requirements**: PROJ-02
**Success Criteria** (what must be TRUE):
  1. The Calculation page shows the current project status as a badge (potential or signed)
  2. The user can toggle the status (potential ↔ signed) from the Calculation page, and the change persists and is reflected on reload
  3. A manual status change is recorded as a manual override, so subsequent quote acceptances do not silently overwrite it
  4. The UI distinguishes provenance to the user (e.g. "Signed — auto from accepted quote" vs "Signed — set manually")
**Plans**: TBD

### Phase 10: Dashboard Metrics Page
**Goal**: Any user can open the Dashboard and read accurate, company-wide pipeline metrics across all projects, split by potential vs signed
**Depends on**: Phases 6, 7, 8, 9 (needs linked/signed data and the freed `/dashboard` URL)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. The Dashboard shows project counts split by status (X potential, Y signed) across all users' projects — it is read-only and company-wide
  2. The Dashboard shows pipeline contract value (potential) and signed contract value in EUR, computed as EUR/BH × MGH × period months using one authoritative quote per project (latest accepted for signed, latest of any non-rejected status for potential), so revenue is never double-counted
  3. The Dashboard shows average EUR/BH rate and average margin % across projects, with all monetary aggregation performed in SQL at NUMERIC precision (no money re-summed in JS)
  4. The Dashboard shows fleet utilization — distinct MSNs committed to signed projects vs available fleet from the aircraft master — with a utilization % headline KPI where committed never exceeds fleet size
  5. The Dashboard shows pipeline/signed value broken down by client and by aircraft type, plus a trend chart of value by month driven by `signed_at`/created timestamps
**Plans**: TBD

## Progress

**Execution Order:**
v2.0 phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10. Phase 8 (route rename) is independent of Phases 6–7 and may run in parallel, but must complete before Phase 10.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Project Schema Foundation | 2/2 | Complete   | 2026-06-05 |
| 7. Project Status Backend & Auto-Sign | 0/0 | Not started | - |
| 8. Route Rename (Dashboard → Calculation) | 0/0 | Not started | - |
| 9. Calculation-Page Status Control | 0/0 | Not started | - |
| 10. Dashboard Metrics Page | 0/0 | Not started | - |
