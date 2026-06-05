# Project Research Summary — v2.0 Dashboard & Project Pipeline

**Project:** ACMI Pricing Platform — Milestone v2.0
**Domain:** B2B ACMI leasing pricing tool (existing shipped app); adding executive metrics dashboard and project pipeline lifecycle
**Researched:** 2026-06-05
**Confidence:** HIGH (stack and architecture grounded in direct codebase reads; features and pitfalls grounded in CRM/lessor patterns + codebase verification)

## Executive Summary

This milestone adds two surfaces to a shipped, production pricing app: a project pipeline lifecycle (potential/signed status on `pricing_projects`) and a read-only executive Dashboard showing aggregate metrics across all projects. Because the app already exists, the dominant challenge is integration, not invention. Every required technology — recharts, next-themes, Zustand, zod, Tailwind v4 — is already installed and proven. No new dependencies are needed. The primary build work is schema additions (two migrations), backend wiring (quote→project FK, auto-sign logic, one new metrics endpoint), and a frontend route rename that displaces the old `/dashboard` URL to make room for the new metrics page.

The central new primitive is the `pricing_projects.status` column and the `quotes.project_id` FK. Everything else — counts, pipeline value, utilization, margin averages, auto-sign automation — depends on these two columns existing first. The recommended build order is data layer (migrations) → backend project status + linkage → auto-sign transaction → frontend route rename → Calculation status UI → Dashboard metrics page. This ordering ensures each step is independently verifiable before the next builds on it.

The key risks are concentrated in four areas: (1) the route rename is spread across 7+ hardcoded `/dashboard` references and will silently break navigation if done partially; (2) revenue aggregates will be inflated 2–5x if the "authoritative quote per project" rule is not enforced before summing; (3) the auto-sign hook will overwrite manual overrides unless provenance is tracked from the start; and (4) fleet utilization will miscount without `DISTINCT` MSN logic anchored to the `aircraft` master table. All four risks are preventable with up-front schema and query discipline — retrofitting any of them is significantly more expensive.

## Key Findings

### Recommended Stack

No new dependencies are required. The v2.0 features run entirely on the already-installed stack. The one decision a dashboard typically forces — "which charting library?" — is already resolved: `recharts@3.8.0` is installed, React 19-compatible in this project's lockfile, and actively used with a proven dark/light theming pattern in `SensitivityChart.tsx`. Every Dashboard chart should copy that pattern verbatim.

**Core technologies:**
- **Next.js 16.1.6 (App Router):** Dashboard is a read-only server-rendered page — identical pattern to the existing dashboard page; no client-side data fetching layer needed
- **recharts 3.8.0:** Already installed and production-proven; SVG-based, integrates with next-themes; copy the `SensitivityChart` mounted-guard + `resolvedTheme` color pattern for every chart
- **asyncpg + BaseRepository (raw SQL):** Metrics are SQL aggregates (`COUNT FILTER`, `SUM`, `GROUP BY`); raw SQL matches the codebase ethos and avoids the N+1 pattern already present in `list_projects`
- **Tailwind v4 + next-themes 0.4.6:** Dashboard styling uses existing `dark:` utilities; theme integration already wired app-wide
- **zod 4.3.6:** Reuse for dashboard API response validation and project status `PATCH` body
- **StatusBadge.tsx (existing):** Extend, do not replace, for project status pills

**What NOT to add:** Any second charting library (Tremor, Chart.js, visx), any component kit (shadcn, MUI), React Query / SWR, or frontend money arithmetic. All monetary math stays on the backend in Python `Decimal` / Postgres `NUMERIC`.

### Expected Features

**Must have (table stakes — v2.0 launch):**
- `pricing_projects.status` column (potential/signed) with manual override in the Calculation page
- `quotes.project_id` FK — without this, no metric can be attributed to a project
- Accepted-quote auto-signs its project (idempotent, atomic, with `status_overridden` guard)
- Dashboard: project counts split by status (potential vs signed)
- Dashboard: pipeline contract value (potential) and signed contract value (EUR/BH × MGH × period months)
- Dashboard: average EUR/BH rate and average margin
- Dashboard: fleet utilization — committed MSN count (signed projects) vs available (aircraft master), with utilization % headline
- Rename current Dashboard tab to "Calculation" (prerequisite framing; clears the URL for the new metrics page)

**Should have (add after v2.0 core ships — v2.x):**
- Time-bounded utilization (period overlap logic) — flat committed/available proves misleading as leases expire
- Pipeline breakdowns by client / aircraft type — low cost once GROUP BY columns exist
- Pipeline/signed trend over time — capture `signed_at` timestamp in v2.0 even if the chart ships later

**Defer to v3+:**
- Weighted pipeline / probability — no multi-state funnel to weight against
- AI forecasting / deal scoring — no win/loss history yet
- Actuals comparison — out of scope per PROJECT.md

**Anti-features to explicitly reject:**
- Many-stage pipeline funnel (this is a pricing tool, not a CRM)
- Real-time/live-updating dashboard (on-load aggregation is sufficient for an internal team)
- Editing metrics or status on the Dashboard (violates the read-only decision; all mutation belongs in Calculation)
- Auto-revert when a quote un-accepts (automation should only escalate potential→signed; demotion is manual)

### Architecture Approach

This is an integration milestone, not a greenfield design. Two schema migrations establish the foundation; the rest is additive backend endpoints and frontend wiring against the existing FastAPI + Next.js server-component pattern. The highest-complexity integration point is the transactional two-table write in `PATCH /quotes/{id}/status` (update quote status AND project status atomically). The highest-risk deployment step is the route rename, which requires synchronized edits to 7+ hardcoded `/dashboard` references across middleware, nav components, auth callback, and `QuoteHeader`.

**Major components:**
1. **Migrations 008 + 009** — add `pricing_projects.status` / `status_overridden` and `quotes.project_id` FK; idempotent; backfill via `DEFAULT 'potential'` and nullable FK respectively
2. **`PATCH /pricing/projects/{id}/status`** — new endpoint; manual override sets `status_overridden = TRUE`; uses existing `update_project(**fields)`
3. **`PATCH /quotes/{id}/status` (modified)** — existing endpoint gains an atomic auto-sign hook: on `accepted`, if `project_id` is set and `status_overridden` is false, set project `status='signed'` in the same transaction
4. **`GET /dashboard/metrics`** — new router (`app/dashboard/`); single aggregation query returning counts, contract values, avg rate/margin, fleet utilization; registered in `main.py`
5. **Frontend route rename** — move `(dashboard)/dashboard/page.tsx` → `(dashboard)/calculation/page.tsx`; new `(dashboard)/dashboard/page.tsx` becomes the read-only metrics page; update Sidebar, middleware, root redirect, Azure callback, BottomTabBar, QuoteHeader in one synchronized change
6. **Calculation-page status control** — status badge + potential/signed toggle calling a new `updateProjectStatusAction`; reuses `StatusBadge` component
7. **New Dashboard page** — Server Component fetching `/dashboard/metrics` via existing cookie-forwarding idiom; StatCard grid + recharts charts (bar for pipeline, utilization bar)

### Critical Pitfalls

1. **Route rename breaks navigation (7+ hardcoded refs)** — Do the rename as a single isolated change before other UI work; grep `nextjs-project/src` for `/dashboard` and fix every hit; add a `next.config.ts` redirect so existing bookmarks do not 404; verify viewer + Azure login land on the correct page after the change.

2. **Double-counted revenue from multiple quotes per project** — Define "authoritative quote" (latest accepted, or latest non-rejected for potential projects) and enforce it with a `DISTINCT ON (project_id)` query before aggregating; consider a partial unique index on `(project_id) WHERE status='accepted'` to enforce at most one accepted quote per project.

3. **Auto-sign silently overwrites manual overrides** — Add `status_overridden BOOLEAN DEFAULT FALSE` to `pricing_projects` in the migration; auto-sign only fires when `status_overridden = FALSE`; manual override sets `status_overridden = TRUE`; automation is monotonic (never auto-demotes).

4. **Decimal → float drift in aggregates** — Aggregate in SQL using `NUMERIC`/`SUM` rather than pulling rows into Python or JS; reuse existing `DecimalEncoder` on any Python path; send pre-aggregated, pre-rounded values to the frontend; never re-sum money in JS.

5. **Fleet utilization double-counts MSNs** — Use `COUNT(DISTINCT msn)` over signed projects only; define "available" against the `aircraft` master table, not the union of project inputs; verify committed <= fleet size in a test.

## Implications for Roadmap

Based on research, the dependency chain is strict and suggests a 5-phase structure. The data layer must precede all other work; the route rename is independent and should be isolated to prevent partial-broken navigation.

### Phase 1: Schema Foundation
**Rationale:** Everything else depends on `pricing_projects.status` and `quotes.project_id` existing. Migrations are idempotent and backfill safely via defaults. No frontend or UI risk.
**Delivers:** Database columns that make every subsequent feature possible; existing projects get `status='potential'` automatically; existing quotes remain valid with `project_id = NULL`; `status_overridden` column prevents future override-stomping; `signed_at` timestamp captured for future trend charts.
**Addresses:** The "no project entity" gap from FEATURES.md; Pitfalls 2 and 3 (authoritative-quote constraint and provenance column established here).
**Avoids:** Retrofitting provenance after data exists (highest recovery cost per PITFALLS.md).
**Research flag:** None — standard `ALTER TABLE` migrations following the idempotent pattern already in migrations 001–007.

### Phase 2: Backend Project Status + Quote Linkage + Auto-Sign
**Rationale:** Wire all backend behavior before the frontend touches anything. The transactional auto-sign is the highest-correctness risk and should be tested in isolation.
**Delivers:** `PATCH /pricing/projects/{id}/status`; updated `ProjectResponse` schema with `status` + `status_overridden`; `quotes.project_id` wired through `POST /quotes/` and `SaveQuoteRequest` (closing the gap in `SaveQuoteDialog`); auto-sign logic in `PATCH /quotes/{id}/status` wrapped in a transaction with override guard.
**Addresses:** FEATURES.md table stakes (auto-sign, manual override, quote linkage).
**Avoids:** Pitfall 3 (provenance + monotonic automation baked in, not retrofitted); Pitfall 5 (Decimal discipline enforced in new code from day one).
**Research flag:** None — patterns are clear. The transactional write needs a careful test plan (override path, draft→accepted directly, re-accept after override), not deeper research.

### Phase 3: Frontend Route Rename (Dashboard → Calculation)
**Rationale:** Isolate the rename as its own shippable change after backend stabilizes. If rename and new metrics page are developed together, a partial rename is much harder to debug and rollback.
**Delivers:** Pricing workspace at `/calculation`; `/dashboard` redirects to `/calculation` via `next.config.ts` (no bookmark breakage); Sidebar / middleware / Azure callback / BottomTabBar / QuoteHeader all updated in one commit; `/dashboard` URL freed for the metrics page.
**Addresses:** FEATURES.md "Calculation rename" item.
**Avoids:** Pitfall 1 (the entire pitfall is addressed by doing this as an isolated, grepped, smoke-tested change before anything else occupies `/dashboard`).
**Research flag:** None — Next.js redirect and middleware patterns are well-documented (HIGH confidence in PITFALLS.md sources).

### Phase 4: Calculation-Page Status UI
**Rationale:** Backend project status endpoint exists (Phase 2) and Calculation page lives at its new URL (Phase 3). Add the status badge and toggle as the only new mutation surface.
**Delivers:** Status badge (potential/signed) on the Calculation page; toggle fires `updateProjectStatusAction` → `PATCH /pricing/projects/{id}/status`; UI reflects provenance ("Signed — auto from quote" vs "Signed — set manually") to avoid Pitfall 3 UX variant.
**Addresses:** FEATURES.md "manual status override" and "project status editable in Calculation page".
**Avoids:** Pitfall 3 UX variant (auto-sign feedback visible to users).
**Research flag:** None — reuses `StatusBadge.tsx` and existing Server Action cookie-forwarding pattern.

### Phase 5: Dashboard Metrics Page
**Rationale:** The read-only consumer of everything built in Phases 1–4. Built last so aggregation queries run against real linked/signed data. Three design decisions (authoritative-quote rule, dashboard scope, period source) must be confirmed in requirements before writing SQL.
**Delivers:** New read-only Dashboard at `/dashboard`; `GET /dashboard/metrics` (one aggregation query, no N+1); StatCard grid (potential count, signed count, pipeline value, signed value, avg EUR/BH, avg margin, fleet utilization %); recharts charts using the `SensitivityChart` dark-mode pattern; company-wide scope (confirmed per open question).
**Addresses:** All FEATURES.md dashboard metrics table stakes.
**Uses:** recharts 3.8.0 (no install); Server Component + `cache: 'no-store'`; existing StatCard and `StatusBadge` components.
**Avoids:** Pitfall 2 (authoritative-quote rule in aggregation query); Pitfall 4 (include only projects with at least one quote; company-wide scope explicitly confirmed); Pitfall 5 (aggregate in SQL NUMERIC); Pitfall 6 (formula locked with hand-verified test against a known historical quote); Pitfall 7 (DISTINCT MSN counting).
**Research flag:** NEEDS DESIGN DECISIONS BEFORE CODING — three open questions gate the aggregation SQL: (a) authoritative-quote selection rule for potential projects, (b) company-wide vs per-user dashboard scope, (c) `period_months` source (live `project_msn_inputs` vs quote snapshot). These are product decisions, not research gaps, but they must be resolved in requirements before Phase 5 starts.

### Phase Ordering Rationale

- Phases 1 → 2 are strictly ordered by schema dependency.
- Phase 3 (rename) is independent of backend phases and can run in parallel if two engineers are available, but must complete before Phase 5 (metrics page occupies `/dashboard`).
- Phase 4 depends on Phase 2 (backend endpoint) and Phase 3 (Calculation URL stable).
- Phase 5 depends on Phases 1–4 for meaningful data and a settled URL.
- Front-loading schema decisions (provenance column, FK, DISTINCT rule) avoids the highest-recovery-cost pitfalls before any UI lands on top of them.

### Research Flags

Needs planning attention before coding starts:
- **Phase 5 (Dashboard Metrics):** Three product decisions gate the aggregation queries. Resolve in requirements. No external research needed — these are internal design choices.

Standard patterns (no `/gsd:research-phase` needed):
- **Phase 1:** Idempotent Postgres `ALTER TABLE` — same pattern as migrations 001–007.
- **Phase 2:** FastAPI endpoint + asyncpg transaction — pattern in `quotes/router.py`.
- **Phase 3:** Next.js App Router redirect + middleware — HIGH-confidence documented patterns.
- **Phase 4:** Reuses `StatusBadge` and Server Action patterns already in production.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions from direct `package.json` / lockfile reads and production-verified component usage; recharts React 19 compatibility confirmed from lockfile |
| Features | MEDIUM | Domain patterns (CRM auto-sign, lessor utilization) well-established; project-specific mapping (authoritative quote, period semantics) requires product confirmation |
| Architecture | HIGH | Grounded in direct reads of every relevant source file; integration points explicit and build order is dependency-ordered |
| Pitfalls | HIGH | Every pitfall derived from the actual schema/code (not speculation); 7 hardcoded refs, N+1 in `list_projects`, missing `project_id` on quotes — all verified facts |

**Overall confidence:** HIGH

### Gaps to Address

- **Authoritative-quote rule for potential projects:** Research recommends "latest non-rejected quote" but product must confirm. Gates the contract-value aggregate query. Resolve before Phase 5.
- **Dashboard scope (company-wide vs per-user):** `list_projects` is currently `created_by`-scoped. A company pipeline almost certainly needs all users' projects. Must be an explicit product decision — it is a behavioral change from current behavior.
- **Period months source reconciliation:** `project_msn_inputs.period_months` defaults to 12; quote snapshots carry `periodStart`/`periodEnd`. Confirm which is canonical for contract-value math before writing the aggregate.
- **Capture `signed_at` timestamp in Phase 1:** Trend-over-time charts (v2.x) require status-change timestamps. Add `signed_at TIMESTAMPTZ` in the Phase 1 migration even if the chart ships later — retrofitting loses history.
- **Post-login landing page:** Confirm whether Dashboard (metrics) or Calculation (workspace) is the default post-login page; affects `app/page.tsx` root redirect and Azure SSO callback target.

## Sources

### Primary (HIGH confidence)
- `fastapi-project/migrations/003_create_pricing_config.sql`, `004_create_quotes.sql` — verified schema (no status column, no project_id FK)
- `fastapi-project/app/pricing/routes/projects.py`, `app/pricing/repository.py` — existing ProjectRepository, update_project pattern, N+1 in list_projects verified
- `fastapi-project/app/quotes/router.py`, `app/quotes/repository.py`, `app/quotes/service.py` — existing status handler, Decimal/DecimalEncoder discipline
- `fastapi-project/app/main.py`, `app/db/base_repository.py` — router registration, asyncpg fetch patterns
- `nextjs-project/src/middleware.ts`, `app/page.tsx`, `api/auth/callback/azure/route.ts` — 7 hardcoded /dashboard references verified
- `nextjs-project/src/components/sidebar/Sidebar.tsx`, `navigation/BottomTabBar.tsx`, `components/quotes/QuoteHeader.tsx` — remaining /dashboard hardcodes
- `nextjs-project/src/app/(dashboard)/dashboard/page.tsx` — existing SSR + auth-cookie fetch pattern to reuse
- `nextjs-project/src/components/sensitivity/SensitivityChart.tsx` — proven recharts + next-themes dark/light pattern
- `nextjs-project/src/components/quotes/StatusBadge.tsx` — status-pill pattern to extend
- `nextjs-project/package.json`, `package-lock.json` — recharts 3.8.0, next-themes 0.4.6, React 19.2.3 compatibility confirmed
- [Next.js — Redirecting (next.config redirects, 307 vs 308)](https://nextjs.org/docs/app/building-your-application/routing/redirecting)

### Secondary (MEDIUM confidence)
- [Improvado — Sales Dashboard: Core Metrics & Design Framework (2026)](https://improvado.io/blog/sales-dashboard)
- [DealHub — Quote Syncing](https://dealhub.io/glossary/quote-syncing/) — accepted-quote auto-signs opportunity pattern
- [Cirium — Aviation Finance / Lessors tooling](https://www.cirium.com/industry-solutions/aviation-finance/lessors/) — fleet utilization framing
- [GoCardless — Total Contract Value (TCV)](https://gocardless.com/en-us/guides/posts/what-is-total-contract-value-tcv/) — contract value definition
- [LogRocket — Best React chart libraries 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/) — recharts recommendation for React 19

---
*Research completed: 2026-06-05*
*Milestone: v2.0 Dashboard & Project Pipeline*
*Ready for roadmap: yes*
