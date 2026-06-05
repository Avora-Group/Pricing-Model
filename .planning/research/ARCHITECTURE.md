# Architecture Research

**Domain:** ACMI pricing web app — v2.0 Dashboard & Project Pipeline (subsequent milestone, integration-focused)
**Researched:** 2026-06-05
**Confidence:** HIGH (grounded in direct codebase reads)

## Scope

This is **not** a greenfield architecture study. v1.0 is shipped. This document maps how three new capabilities integrate into the existing FastAPI + Next.js codebase:

1. Rename current Dashboard tab → **"Calculation"** (the pricing workspace stays, label/route changes)
2. **Project status lifecycle** (`potential` / `signed`) on `pricing_projects`, set in the Calculation page
3. **Quote → project linkage** + accepted-quote-auto-signs-project, plus a new read-only **Dashboard** with aggregate metrics

The hard part is integration, not invention. Everything below is "new vs modified" against the verified existing structure.

## Existing System (verified)

### Backend (`fastapi-project/`)
```
app/main.py            include_router: auth, users, aircraft, pricing, quotes
                       run_migrations() on startup — advisory lock + _migrations table,
                       applies migrations/*.sql in sorted filename order
app/pricing/router.py  prefix="/pricing"; mounts calculate, config, projects sub-routers
app/pricing/routes/projects.py   /projects CRUD + /projects/{id}/msn CRUD
app/pricing/repository.py        ProjectRepository (create/get/list/update_project,
                                 *_msn_input) — generic update_project(**fields) already exists
app/quotes/router.py   prefix="/quotes"; save, list, detail, PATCH /{id}/status, delete, pdf stub
app/quotes/repository.py  QuoteRepository — create_quote, update_status, list/count/get
app/db/base_repository.py  fetch_one/fetch_many/execute over asyncpg, dicts in/out
migrations/            001–007 applied; raw .sql, idempotent (CREATE TABLE IF NOT EXISTS)
```

Schema today:
- `pricing_projects` — id, name, exchange_rate, margin_percent, config FKs, created_by, timestamps. **No status column.**
- `project_msn_inputs` — project_id FK, aircraft_id, mgh, cycle_ratio, environment, **period_months**, lease_type, crew_sets. `UNIQUE(project_id, aircraft_id)`.
- `quotes` — has `status` CHECK(draft/sent/accepted/rejected), `total_eur_per_bh`, `msn_list INTEGER[]`, JSONB snapshots, `created_by`. **No project_id FK.**

### Frontend (`nextjs-project/`)
```
src/app/page.tsx               redirect('/dashboard')   ← root redirect
src/middleware.ts              protectedRoutes / viewerAllowedRoutes hardcode '/dashboard'
src/app/(dashboard)/dashboard/page.tsx   currently the pricing workspace (DashboardSummary)
src/app/(dashboard)/{pnl,aircraft,crew,costs,sensitivity,quotes,admin}/   other pages
src/components/sidebar/Sidebar.tsx   navItems[] hardcodes '/dashboard' label 'Dashboard';
                                     viewerAllowedHrefs Set(['/dashboard','/quotes'])
src/stores/pricing-store.ts    Zustand session store; has projectId / projectName already
src/components/quotes/SaveQuoteDialog.tsx   builds payload from 3 stores; calls saveQuoteAction
src/app/actions/quotes.ts      Server Actions (cookie-forwarded fetch to API)
```

**Critical verified fact:** `SaveQuoteDialog` builds `dashboard_state` from the pricing store but **does not currently include `projectId`** in the save payload — even though `pricing-store` tracks `projectId`. The quote→project link does not exist on either side today and must be wired through both the payload and the API.

> Note: the live Sidebar has more nav items than the milestone brief listed (also `crew`, `costs`, `sensitivity`, `pnl`). This doesn't change the integration but confirms route edits must target the real `navItems[]`.

## Integration Map: New vs Modified

### Migrations (NEW — `migrations/008_*.sql`, `009_*.sql`)

Follow the existing idempotent raw-SQL convention. Two concerns, recommend two files for clarity:

```sql
-- 008_add_project_status.sql
ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'potential'
    CHECK (status IN ('potential', 'signed'));
-- track manual override so auto-sign doesn't fight a human decision
ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS status_overridden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_pricing_projects_status ON pricing_projects(status);

-- 009_link_quotes_to_projects.sql
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES pricing_projects(id);
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);
```

Notes:
- `DEFAULT 'potential'` backfills every existing project cleanly — no data-migration step needed.
- `project_id` is **nullable** (older quotes have no project; standalone quotes may continue to). Do NOT make it `NOT NULL`.
- `ON DELETE` left as default (`NO ACTION`) — a linked quote should block silent project deletion. No project-delete endpoint exists today anyway.

### Backend endpoints

| Endpoint | New/Modified | Notes |
|----------|--------------|-------|
| `PATCH /pricing/projects/{id}/status` | **NEW** | Sets status manually; sets `status_overridden = TRUE`. Use existing `ProjectRepository.update_project(**fields)` — no new repo method strictly required. |
| `GET /pricing/projects/{id}` & list responses | **MODIFIED** | Add `status` (+ `status_overridden`) to `ProjectResponse` schema and the response constructors in `projects.py`. |
| `POST /quotes/` | **MODIFIED** | Accept optional `project_id` in `SaveQuoteRequest`; pass to `create_quote`; `create_quote` SQL gains the column. |
| `PATCH /quotes/{id}/status` | **MODIFIED** | This is where auto-sign lives. On transition to `accepted`, if the quote has a `project_id` and the project is not `status_overridden`, set project `status='signed'`. |
| `GET /dashboard/metrics` | **NEW** | New router (`app/dashboard/`) mounted in `main.py`. SQL aggregation (see below). |

#### Where auto-sign logic lives (decision: HIGH confidence)

Put it **inside the existing `PATCH /quotes/{id}/status` handler**, after `repo.update_status(...)` succeeds, on the same connection. `get_db` yields the connection; run both writes on it. The handler already loads the quote (`repo.get_quote`) for the ownership check, so `project_id` is available with no extra query.

```python
async with db.transaction():
    updated = await repo.update_status(quote_id, body.status)
    if body.status == "accepted" and quote.get("project_id"):
        project_repo = ProjectRepository(db)
        project = await project_repo.get_project(quote["project_id"])
        if project and not project["status_overridden"]:
            await project_repo.update_project(quote["project_id"], status="signed")
```

**Wrap the two writes in a transaction** so an accepted quote and its signed project commit atomically. This is the one place the milestone introduces a multi-table write — the highest-correctness-risk integration point.

Rationale vs alternatives:
- *Not* a Postgres trigger: the codebase has zero triggers and uses app-layer logic everywhere; the `status_overridden` guard is easier in Python. Keep the pattern consistent.
- *Not* a separate "promote project" endpoint called from the frontend: that splits the invariant across two round-trips and lets the UI forget to call it. Server-side coupling to the status PATCH is the single source of truth PROJECT.md's key decision calls for.

#### Dashboard metrics: SQL aggregation vs app-side (decision: SQL, HIGH confidence)

Aggregate **in SQL**, not in Python. Metrics are counts/sums/averages over `pricing_projects` joined to `project_msn_inputs` (and `quotes` for rate/accepted info). Volume is tiny (tens of projects), but SQL aggregation is simpler, avoids N+1, and matches the raw-SQL ethos. **Do not** copy the existing `list_projects` pattern, which loops `get_msn_inputs` per project (an N+1 — verified in `projects.py`).

Contract value per project = `EUR/BH × MGH × period_months`, summed across a project's MSNs. `EUR/BH` source: a project's accepted quote `total_eur_per_bh` is the cleanest signed-revenue source. MGH and period_months live on `project_msn_inputs`.

Example shape (one round-trip, one metrics row):
```sql
SELECT
  count(*) FILTER (WHERE p.status='potential')           AS potential_count,
  count(*) FILTER (WHERE p.status='signed')              AS signed_count,
  coalesce(sum(mi.mgh * mi.period_months)
           FILTER (WHERE p.status='signed'), 0)          AS signed_committed_bh,
  ...
FROM pricing_projects p
LEFT JOIN project_msn_inputs mi ON mi.project_id = p.id
LEFT JOIN LATERAL (
  SELECT q.total_eur_per_bh FROM quotes q
  WHERE q.project_id = p.id AND q.status='accepted'
  ORDER BY q.created_at DESC LIMIT 1
) q ON true;
```
Finalize the exact metric set during planning; the principle is **one aggregation endpoint** returning a typed metrics object, not multiple chatty endpoints. Fleet utilization (committed vs available MSNs) compares total `aircraft` rows against distinct MSNs in signed projects — another FILTER/subquery in the same or a sibling query.

### Frontend

| File | New/Modified | Notes |
|------|--------------|-------|
| `(dashboard)/dashboard/page.tsx` | **MOVED → calculation** | The pricing workspace becomes the **Calculation** page: move to `(dashboard)/calculation/page.tsx`. |
| `(dashboard)/dashboard/page.tsx` | **NEW (replaced)** | New read-only metrics dashboard. Server Component fetching `GET /dashboard/metrics` via existing cookie-forwarding idiom (copy `getAircraftList`). |
| `components/sidebar/Sidebar.tsx` | **MODIFIED** | Add `/calculation` nav item (label "Calculation"); keep `/dashboard` labeled "Dashboard". Add `/calculation` to `viewerAllowedHrefs` if viewers price. |
| `src/middleware.ts` | **MODIFIED** | Add `/calculation` to `protectedRoutes` and (if viewers use it) `viewerAllowedRoutes`. |
| `src/app/page.tsx` | **REVIEW** | `redirect('/dashboard')` — fine if Dashboard stays post-login home. Change only if product wants Calculation as home. |
| `components/quotes/SaveQuoteDialog.tsx` | **MODIFIED** | Add `project_id: pricingState.projectId` to the save payload (currently omitted) — closes the linkage gap. |
| `src/app/actions/quotes.ts` | **MODIFIED** | `SaveQuotePayload` gains optional `project_id`; add `updateProjectStatusAction`. |
| Calculation page status control | **NEW UI** | Status badge + potential/signed toggle calling the new project-status action. Reuse AeroVista `StatusBadge`. |

**Route-rename gotcha (MEDIUM confidence, verify during build):** renaming is a *move*, not just a label change. Three places hardcode `/dashboard` and must move in lockstep: `Sidebar.navItems`, `middleware.protectedRoutes`/`viewerAllowedRoutes`, and `Sidebar.viewerAllowedHrefs`. `isActive` uses `pathname.startsWith(href)`, so a distinct `/calculation` path avoids prefix collisions. Decide explicitly whether the new Dashboard or Calculation is the post-login landing page — both `page.tsx` and the middleware "logged-in → /dashboard" redirect point there.

## Data Flow Changes

### Quote acceptance → project sign (the new invariant)
```
Calculation page: create project, price MSNs
   → Save Quote (SaveQuoteDialog) now sends project_id
   → POST /quotes/  inserts quote WITH project_id
Quotes page: PATCH quote status → 'accepted'
   → PATCH /quotes/{id}/status
       repo.update_status → 'accepted'
       if project_id and not status_overridden:
           ProjectRepository.update_project(project_id, status='signed')
       (both writes in one db.transaction())
Dashboard: GET /dashboard/metrics → SQL aggregation reflects new signed project
```

### Manual override
```
Calculation status toggle → updateProjectStatusAction
   → PATCH /pricing/projects/{id}/status {status, override=true}
   → update_project(status=..., status_overridden=true)
   → future accepted quotes will NOT auto-flip this project
```

## Anti-Patterns to Avoid

### Replicating the list_projects N+1 in the dashboard
`ProjectRepository.list_projects` loops `get_msn_inputs` per project. **Do not** build metrics by fetching all projects then summing in Python — use one aggregation query.

### Storing project status only in `dashboard_state` JSONB
Status must be a first-class column on `pricing_projects` (PROJECT.md decision: single source of truth). The `quotes` JSONB snapshots are immutable point-in-time records — never the live status source.

### Making `quotes.project_id` NOT NULL
Breaks existing quotes and future standalone quotes. Keep nullable; auto-sign skips quotes without a project.

### Trigger-based auto-sign
No triggers exist; adding one diverges from the app-layer pattern and complicates the `status_overridden` guard. Keep it in the status handler.

## Integration Points

| Boundary | Communication | Considerations |
|----------|---------------|----------------|
| `quotes` ↔ `pricing_projects` | new `project_id` FK + auto-sign in status PATCH | Atomic two-table write; transaction required |
| New dashboard router ↔ main.py | `app.include_router(dashboard_router)` | Mirror existing router registration |
| Calculation page ↔ project status API | new Server Action + `PATCH /pricing/projects/{id}/status` | Reuses cookie-forwarding fetch idiom |
| Dashboard page ↔ metrics API | Server Component fetch, `cache: 'no-store'` | Copy `getAircraftList` pattern |
| Sidebar/middleware/root ↔ route rename | three synchronized edits | Highest risk of broken nav/redirect if done partially |

## Suggested Build Order (dependency-ordered)

1. **Migration 008 (project status) + 009 (quotes.project_id).** Foundation; idempotent, backfills via defaults. Nothing else is meaningful without the columns.
2. **Backend project status: schema field + `ProjectResponse` + `PATCH /pricing/projects/{id}/status`.** Pure additive; uses existing `update_project`.
3. **Wire quote→project linkage end-to-end:** `SaveQuoteRequest.project_id` → `create_quote` SQL → `SaveQuoteDialog` payload (`projectId`) → `quotes.ts` action type. Verifiable independently (save a quote, confirm `project_id` persists).
4. **Auto-sign logic in `PATCH /quotes/{id}/status` (transactional).** Depends on 2+3. Correctness-critical; test override and no-override paths.
5. **Frontend route rename Dashboard → Calculation** (move page; edit Sidebar + middleware + root redirect together). Independent of backend; do as one self-contained change so a partial edit can't half-break nav.
6. **Calculation-page status control UI** (badge + toggle → action). Depends on 2 and 5.
7. **Dashboard metrics endpoint (SQL aggregation) + new Dashboard page.** Last — it consumes status, links, and signed state. Build the metrics SQL, then the Server Component page, then StatCard wiring.

Rationale: data layer first (1); independent additive backend (2,3); the cross-table invariant needing both (4); UI rename as an isolated change (5); UI depending on it (6); the read-only consumer of everything last (7). Steps 5 and 7 can run in parallel with backend work if two people are available; 4 must follow 2+3.

## Phase / Research Flags

- **Auto-sign transaction (step 4):** needs careful testing — override flag, draft→accepted directly, re-accept after override. Flag for verification, not deeper research.
- **Contract-value metric (step 7):** EUR/BH source for *potential* projects (no accepted quote) is ambiguous — confirm with product whether to use latest quote rate or live-compute. Flag for planning clarification.
- **Landing page after login:** confirm Dashboard vs Calculation as post-login home (affects `page.tsx` + middleware redirect).
- Route rename, status column, project_id FK: standard patterns, low research need.

## Sources

- Direct reads (HIGH): `migrations/003,004`, `app/pricing/routes/projects.py`, `app/quotes/router.py`, `app/quotes/repository.py`, `app/pricing/repository.py`, `app/main.py`, `app/db/base_repository.py`, `nextjs-project/src/{middleware.ts, app/page.tsx, app/(dashboard)/dashboard/page.tsx, components/sidebar/Sidebar.tsx, components/quotes/SaveQuoteDialog.tsx, app/actions/quotes.ts, stores/pricing-store.ts}`
- `.planning/PROJECT.md` (milestone goals + key decisions)

---
*Architecture research for: ACMI pricing v2.0 (integration)*
*Researched: 2026-06-05*
