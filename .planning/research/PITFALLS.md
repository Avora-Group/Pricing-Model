# Pitfalls Research

**Domain:** Metrics dashboard + status lifecycle automation + route rename, added to a shipped FastAPI + Next.js 14 (App Router) ACMI pricing app (v2.0 milestone)
**Researched:** 2026-06-05
**Confidence:** HIGH (grounded in the actual codebase: migrations 003/004, middleware.ts, quotes router, pricing repository; routing facts verified against Next.js docs)

## Codebase ground truth (read before the pitfalls)

These facts drive every pitfall below. Verified by reading source:

1. **Quotes have NO link to projects today.** `quotes` (migration 004) is keyed by `client_code` + `quote_number`, stores immutable JSONB snapshots, and has its own `status` enum (`draft`/`sent`/`accepted`/`rejected`). There is **no `project_id` column and no join table.** "Quotes linked to projects" is net-new schema, not a tweak.
2. **`pricing_projects` has NO `status` column** (migration 003). It is a mutable, `created_by`-scoped session container with `exchange_rate`, `margin_percent`, config FKs. `status` (`potential`/`signed`) must be added.
3. **`/dashboard` is hardcoded in at least 7 places**: `middleware.ts` (protectedRoutes, viewerAllowedRoutes, 2 redirect targets), `app/page.tsx` (root redirect), `api/auth/callback/azure/route.ts` (post-login redirect), `Sidebar.tsx`, `BottomTabBar.tsx` (+ their `viewerAllowedHrefs` sets), and `QuoteHeader.tsx` (`router.push('/dashboard')`).
4. **The page at `/dashboard` IS the pricing workspace** (`DashboardSummary` — "Configure MSN inputs and view pricing summary"). The rename moves the *workspace* to `/calculation`; the *new* Dashboard is a different, read-only metrics page that will reuse the now-freed `/dashboard` URL (or a new one — a decision that must be made explicitly).
5. **MGH and `period_months` live on `project_msn_inputs`** (per-MSN), not on the project and not on quotes. Quotes store `total_eur_per_bh` (project-level) and per-MSN `monthly_revenue`/`monthly_cost`. Contract value (`EUR/BH × MGH × period months`) pulls inputs from **three different tables/snapshots** — a fragmentation risk.
6. **Money discipline already exists**: Python uses `Decimal` everywhere; `DecimalEncoder` serializes Decimals as strings into JSONB; Postgres `NUMERIC` columns return Python `Decimal` via asyncpg. Aggregation code must not break this chain.

---

## Critical Pitfalls

### Pitfall 1: Route rename breaks bookmarks, deep links, and hardcoded redirects

**What goes wrong:**
The team renames the route folder `(dashboard)/dashboard` → `(dashboard)/calculation` (or repoints the URL) but misses one of the 7+ hardcoded `/dashboard` references. Symptoms: users with `/dashboard` bookmarks land on the *new metrics* page expecting the pricing workspace (or hit a 404); post-login Azure redirect sends users to a now-wrong page; viewer-role users get redirected to a route their allowlist no longer covers, producing a redirect loop or lockout.

**Why it happens:**
`/dashboard` is a magic string spread across middleware, root page, auth callback, two nav components, and QuoteHeader. There is no single source of truth for "where is the workspace." App Router folder renames silently change URLs with no redirect left behind. The semantics also flip: `/dashboard` historically *meant* the workspace; after the rename it means metrics.

**How to avoid:**
- Decide the URL map explicitly and write it down: `/calculation` = workspace (old `/dashboard` content), `/dashboard` = new metrics page. Confirm which URL existing bookmarks should resolve to.
- Add a permanent `next.config.ts` redirect for the OLD semantics if you want old bookmarks to keep reaching the *workspace*: `{ source: '/dashboard', destination: '/calculation', permanent: false }` — but note this collides with reusing `/dashboard` for metrics. Safer: give metrics a brand-new URL (e.g. `/overview` or `/pipeline`) and leave `/dashboard` redirecting to `/calculation` so no bookmark breaks. Use `permanent: false` (307) until the rename is proven, then flip to 308.
- Grep `grep -rn "/dashboard" nextjs-project/src` and fix every hit: middleware `protectedRoutes` + `viewerAllowedRoutes` + both redirect targets, `app/page.tsx`, Azure callback, `Sidebar.tsx`, `BottomTabBar.tsx`, `QuoteHeader.tsx`.
- Update viewer allowlists in BOTH middleware and the nav components (they duplicate the set) so viewers can reach whatever the new default landing page is.

**Warning signs:**
Redirect loops after login; viewer users bounced to a blank/forbidden page; `router.push('/dashboard')` from QuoteHeader landing on metrics instead of the editor; e2e/login smoke test failing only for the viewer role.

**Phase to address:**
First phase (route rename). Do the rename and redirect wiring as an isolated, shippable change BEFORE building metrics, so the URL semantics are settled.

---

### Pitfall 2: Double-counting revenue when a project has multiple quotes

**What goes wrong:**
Contract-value and revenue aggregates sum across all quotes (or all accepted quotes) for a project. A single project legitimately has many quotes over its life — drafts, revisions, a rejected v1, an accepted v2. Summing them inflates pipeline/signed revenue by 2–5×. Equally, a quote covering 3 MSNs summed alongside the project's own MSN inputs double-counts the same aircraft.

**Why it happens:**
Quotes are immutable snapshots, so a renegotiation produces a NEW quote rather than mutating the old one. Naive `SUM(monthly_revenue)` over `quote_msn_snapshots` joined to a project counts every historical revision. There's no current notion of "the one quote that represents this project's value."

**How to avoid:**
- Define "the authoritative quote per project" explicitly. Recommended: contract value for a **signed** project = the **single accepted quote** (enforce at most one accepted quote per project, or pick `MAX(created_at)` among accepted). For **potential** projects, use the latest non-rejected quote, or the project's own live MSN inputs — but pick ONE source, never sum across quotes.
- In SQL, aggregate with `DISTINCT ON (project_id) ... ORDER BY project_id, accepted DESC, created_at DESC` to collapse to one quote per project before summing MSN rows.
- Add a DB constraint or service-layer check: a project can have at most one `accepted` quote at a time (partial unique index on `(project_id) WHERE status='accepted'` once the FK exists).

**Warning signs:**
Dashboard total revenue noticeably exceeds the sum of known signed contracts; revenue jumps when a quote is revised rather than staying flat; the same MSN appears in the fleet-utilization count more than once.

**Phase to address:**
Quote→project linkage phase (define authoritative-quote rule + constraint) AND the metrics phase (aggregation queries must apply the rule).

---

### Pitfall 3: Status automation silently overwrites a manual override

**What goes wrong:**
A user manually sets a project to `signed` (or back to `potential` after a deal falls through). Later, an unrelated quote action — accepting a different quote, re-accepting, or a background re-sync — fires the auto-sign rule and flips the status back, destroying the human decision. Or the reverse: a manual `potential` override is stomped the next time any accepted quote is touched.

**Why it happens:**
"Accepted quote auto-signs project" is implemented as an unconditional `UPDATE pricing_projects SET status='signed'` on quote acceptance, with no record of whether the current status was set by a human or by automation. There's no precedence rule, so the last writer wins and automation usually writes last.

**How to avoid:**
- Track provenance: add `status_source TEXT CHECK (status_source IN ('auto','manual'))` (and ideally `status_updated_by`, `status_updated_at`) to `pricing_projects`. Automation only writes when `status_source <> 'manual'` (or only promotes `potential`→`signed`, never demotes). Manual edits set `status_source='manual'` and are sticky.
- Make automation **monotonic and idempotent**: accepting a quote can promote to `signed` but should never auto-demote. Demotion is a manual-only action.
- Decide explicitly what un-accepting / rejecting a previously-accepted quote does to a project that auto-signed: recommended is "leave signed, surface a warning" rather than auto-reverting.

**Warning signs:**
Users report status "changing by itself"; a project flips status without anyone editing it; audit shows status updated by the quote-acceptance code path moments after a manual edit.

**Phase to address:**
Status lifecycle phase — bake provenance + monotonic automation into the schema and service from the start; retrofitting precedence after the fact requires data backfill.

---

### Pitfall 4: Stale / abandoned session projects pollute pipeline metrics

**What goes wrong:**
`pricing_projects` are mutable, per-user session containers (`list_projects` filters by `created_by`). Users spin up throwaway projects to experiment, abandon empty ones, or leave half-configured drafts. The new Dashboard counts ALL projects as "pipeline," so "potential projects: 47" is mostly noise, and "total pipeline value" includes scratch work.

**Why it happens:**
The projects table was designed as a scratch workspace, not a CRM pipeline. Adding `status` doesn't change that every save creates a row. The metrics layer treats every row as a real opportunity. No concept of "real vs. draft" exists.

**How to avoid:**
- Decide the inclusion rule for metrics explicitly. Recommended: a project enters pipeline metrics only when it has at least one quote (or a non-default name, or an explicit "promote to pipeline" action). Empty/unconfigured projects are excluded.
- Consider a `is_archived`/soft-delete flag and exclude archived from metrics.
- Decide the **ownership scope of the Dashboard**: today projects are per-user. A company pipeline dashboard almost certainly needs to aggregate across ALL users, not just `current_user`. Confirm this — it's a behavioral change from `list_projects`'s `WHERE created_by = $1`.
- Filter metrics by `status` deliberately: potential vs signed counts should exclude drafts with no economic content.

**Warning signs:**
Project counts far exceed the number of real deals the sales team recognizes; pipeline value dwarfs realistic figures; two salespeople see different totals because the dashboard is still user-scoped.

**Phase to address:**
Metrics/Dashboard phase (inclusion + ownership-scope rules in the aggregation queries). Flag the per-user vs. company-wide decision for the roadmap owner early.

---

### Pitfall 5: Decimal → float drift in aggregates

**What goes wrong:**
Per-row money is correctly stored as `NUMERIC`/`Decimal`, but the aggregation or API layer coerces to `float` (e.g. summing in Python with `sum()` over values that got JSON-parsed to float, building totals in JS `number`, or `json.dumps` without the existing `DecimalEncoder`). Totals show `185000.00000001` or rounding mismatches versus the per-quote figures, undermining trust in a financial dashboard.

**Why it happens:**
The discipline is enforced per-quote (`Decimal`, `DecimalEncoder`) but new aggregation code is greenfield and easy to write with float math. JSONB snapshot fields store Decimals as strings; if a metric reads `monthly_revenue` out of `dashboard_state` JSONB rather than the typed `NUMERIC` column, it must re-wrap in `Decimal(str(...))`. The frontend's JS `number` cannot represent these exactly.

**How to avoid:**
- Aggregate in SQL with `NUMERIC` (`SUM(monthly_revenue)::numeric`, `ROUND(..., 2)`) rather than pulling rows into Python/JS and summing. Postgres keeps it exact.
- Where Python aggregation is unavoidable, start from `Decimal` and never pass through `float`; reuse the existing `DecimalEncoder` on the way out.
- Prefer the typed `NUMERIC` columns (`quote_msn_snapshots.monthly_revenue`, `pricing_projects` rates) over re-parsing JSONB snapshot values.
- On the frontend, treat money as formatted strings from the API; do not re-sum money in JS. Send pre-aggregated, pre-rounded values.
- Round only at display time, with a single agreed rounding rule (EUR, 2dp).

**Warning signs:**
Trailing-precision noise (`...0001`, `...9999`) in totals; dashboard total ≠ sum of the per-quote numbers shown elsewhere; `float` appearing in new aggregation code or response models.

**Phase to address:**
Metrics phase. Add a test asserting aggregate totals equal hand-summed Decimal expectations.

---

### Pitfall 6: Contract-value formula inputs are scattered across tables/snapshots

**What goes wrong:**
`Contract value = EUR/BH × MGH × period months`, but `EUR/BH` is project-level (`total_eur_per_bh` on the quote), while `MGH` and `period_months` are **per-MSN** (`project_msn_inputs` / quote snapshot `msn_input`). Developers pick the wrong granularity — multiply a project-level rate by one MSN's MGH, or sum per-MSN revenue AND also apply the project rate — producing wrong contract values that look plausible.

**Why it happens:**
The data model never anticipated a single "contract value." MGH and period are per-aircraft; rate is sometimes blended at project level. There's genuine ambiguity: is contract value the sum over MSNs of (per-MSN rate × per-MSN MGH × per-MSN months), or a single blended figure? The quote already stores per-MSN `monthly_revenue`, which may be the cleaner basis.

**How to avoid:**
- Define the formula at the correct granularity ONCE, in writing: recommended `contract_value = Σ_msn (msn.eur_per_bh × msn.mgh × msn.period_months)` using per-MSN values, OR `Σ_msn (msn.monthly_revenue × msn.period_months)` if `monthly_revenue` already bakes in MGH × rate. Pick the basis and document the assumption (e.g. MGH is monthly block hours, period in months).
- Verify against a known historical quote by hand before trusting the dashboard.
- Beware mismatched period semantics: `project_msn_inputs.period_months` defaults to 12; quote snapshots carry `periodStart`/`periodEnd`. Reconcile which defines "period months" for value.

**Warning signs:**
Contract value off by exactly the MSN count, or by a factor of `period_months`; multi-MSN projects wildly higher/lower than single-MSN ones of similar size; numbers that don't reconcile with the EUR/BH the sales team quoted.

**Phase to address:**
Metrics phase; lock the formula and granularity before building the aggregate, with a worked example test.

---

### Pitfall 7: Fleet utilization counts the same MSN twice or counts the wrong universe

**What goes wrong:**
"Committed vs available MSNs" double-counts an MSN that appears in multiple signed projects or multiple quotes, counts MSNs from abandoned draft projects as committed, or compares committed against a stale "available" universe. Utilization > 100% or nonsensical denominators result.

**Why it happens:**
MSNs live in `project_msn_inputs` (mutable, per project) and in `quote_msn_snapshots` (per quote, possibly many quotes per MSN). There's no single registry of "which MSNs exist and which are committed." Summing across quotes/projects re-counts. The `aircraft` table is the only true MSN universe.

**How to avoid:**
- Define "committed" as a `DISTINCT` set of MSNs belonging to **signed** projects (via the authoritative quote per project from Pitfall 2), not a count of rows.
- Define "available" against the master `aircraft` table (the real fleet), not against the union of all projects.
- Use `COUNT(DISTINCT msn)` and explicitly exclude potential/draft projects from "committed."

**Warning signs:**
Utilization exceeds 100%; committed MSN count exceeds fleet size; an MSN in two signed deals counted twice.

**Phase to address:**
Metrics phase, after the authoritative-quote rule (Pitfall 2) exists.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `/dashboard` URL for the new metrics page instead of a fresh URL | One fewer route to name | Breaks every existing bookmark's expected destination; entangles rename with new feature | Never — give metrics a new URL and redirect old `/dashboard` to `/calculation` |
| Auto-sign via unconditional `UPDATE status='signed'` (no provenance) | Ships automation in one line | Stomps manual overrides (Pitfall 3); requires schema backfill to fix | Never for this feature — provenance is the whole point |
| Aggregate money in Python/JS with `float` | Faster to write | Precision drift in a financial tool; erodes user trust | Never for money; fine for counts |
| Count all `pricing_projects` rows as pipeline | No filtering logic | Metrics dominated by scratch projects (Pitfall 4) | Only in a throwaway prototype, never in shipped metrics |
| Keep Dashboard user-scoped (`created_by = me`) like `list_projects` | Reuse existing query | Each salesperson sees a different "company" pipeline | Acceptable only if product explicitly wants per-user dashboards — confirm |
| Sum revenue across all quotes per project | Trivial SQL | 2–5× inflated revenue (Pitfall 2) | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Next.js middleware route allowlists | Renaming the route but not updating `protectedRoutes` / `viewerAllowedRoutes` (and the duplicate sets in Sidebar/BottomTabBar) | Update every allowlist; the route name appears in 4+ allowlist locations |
| Azure SSO post-login redirect | Leaving `callback/azure/route.ts` redirecting to `/dashboard` (now metrics) when users expect the workspace | Point post-login to the intended landing page; verify the viewer role can access it |
| asyncpg ↔ Postgres `NUMERIC` | Reading money from JSONB snapshot strings and forgetting to re-wrap in `Decimal` | Read from typed `NUMERIC` columns; if from JSONB, `Decimal(str(v))` |
| New `quotes.project_id` FK | Adding the column but no migration to link existing immutable quotes to projects | Decide backfill policy: existing quotes likely stay `project_id NULL`; metrics must tolerate unlinked quotes |
| JSONB serialization | Using plain `json.dumps` for new project/status payloads instead of the existing `DecimalEncoder` | Reuse `serialize` / `DecimalEncoder` from `quotes/service.py` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries building the dashboard (one query per project for its quotes/MSNs) | Dashboard load grows linearly with project count | Compute aggregates in a few set-based SQL queries with GROUP BY / DISTINCT ON | Noticeable past ~100 projects; painful in the hundreds |
| Aggregating in app code after `SELECT *` of all rows | High memory, slow response | `SUM`/`COUNT`/`DISTINCT` in SQL, return only totals | Hundreds–thousands of quote_msn rows |
| No index supporting `quotes.project_id` joins/filters once added | Sequential scans on every dashboard load | Index `quotes(project_id)` and partial index for accepted-per-project | As quote volume grows |
| Recomputing metrics on every page render with `cache: 'no-store'` | Repeated full aggregation per navigation | Acceptable at this scale (single-digit users); revisit caching only if slow | Unlikely at internal-team scale |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing company-wide pipeline/revenue to `viewer` role without intent | Viewers see aggregate financials they shouldn't | Decide explicitly whether viewers see the metrics dashboard; enforce in middleware allowlist AND the data endpoint |
| Trusting client-supplied status transitions | A user forces `signed` via API bypassing UI rules | Validate status + provenance server-side in the service layer, not just the UI |
| Cross-user project visibility leak via new aggregate endpoint | If dashboard goes company-wide, a per-user-scoped detail endpoint might now leak another user's project details | Keep authorization explicit per endpoint; aggregate ≠ row-level access |
| Reusing IDOR-prone project endpoints for status update | One user flips another user's project status | Authorize `update_project`/status changes against ownership or role |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent route rename with no notice | Long-time users' muscle memory / bookmarks land somewhere unexpected | Redirect old URL; optionally a one-time banner explaining "Dashboard is now Calculation" |
| Auto-sign with no visible feedback | User accepts a quote and doesn't realize the project flipped to signed | Show a toast/inline note: "Project marked Signed (from accepted quote)"; show status provenance |
| No way to tell auto-set vs manual status apart | User can't trust or audit the status | Surface `status_source` ("Signed — auto from quote QN-123" vs "Signed — set by you") |
| Metrics include scratch projects, numbers feel wrong | Sales team distrusts the whole dashboard | Exclude empty/draft projects; show what's counted |
| Two pages both reachable, unclear which is the workspace | Users edit on the wrong page | Clear labels: "Calculation" (workspace) vs "Dashboard/Overview" (read-only metrics) |

## "Looks Done But Isn't" Checklist

- [ ] **Route rename:** Often missing one of the 7 hardcoded `/dashboard` refs — verify `grep -rn "/dashboard" nextjs-project/src` returns only intended hits, and viewer login + Azure login both land correctly.
- [ ] **Old bookmarks:** Often missing the redirect — verify visiting the old `/dashboard` URL still reaches the pricing workspace (not a 404 or the wrong page).
- [ ] **Quote→project link:** Often missing the FK migration and backfill decision — verify existing quotes don't crash metrics (NULL `project_id` handled).
- [ ] **Status automation:** Often missing provenance — verify a manual override survives a subsequent quote acceptance.
- [ ] **Revenue aggregate:** Often missing de-duplication — verify a project with 3 quotes counts revenue once, and the total reconciles to known contracts.
- [ ] **Fleet utilization:** Often missing DISTINCT — verify utilization never exceeds 100% and committed ≤ fleet size.
- [ ] **Decimal totals:** Often missing the type discipline — verify aggregate totals equal hand-summed Decimal values with no precision noise.
- [ ] **Contract-value formula:** Often missing a worked example — verify one real historical quote's value by hand.
- [ ] **Dashboard scope:** Often missing the per-user vs company-wide decision — verify two users see the intended (same or different) totals.
- [ ] **Viewer access to metrics:** Often missing the access decision — verify viewers see exactly what's intended on the new dashboard.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missed `/dashboard` reference | LOW | Grep, patch the string, add redirect; no data impact |
| Double-counted revenue | MEDIUM | Rewrite aggregation with DISTINCT ON / authoritative-quote rule; numbers self-correct, no data loss |
| Automation overwrote manual override | HIGH | If no provenance column existed, the manual value is lost; must add provenance, then manually re-set affected projects from memory/audit — add provenance up front to avoid |
| Float drift in aggregates | LOW–MEDIUM | Move math into SQL `NUMERIC`; rounding test catches regressions |
| Wrong contract-value granularity | MEDIUM | Redefine formula, re-run aggregation; verify against hand example |
| Stale projects in metrics | LOW | Add inclusion filter (has-quote / status); counts drop to real values |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Route rename breakage | Phase: Route rename (isolated, first) | Grep clean; viewer + Azure login land correctly; old `/dashboard` redirects |
| 3. Status automation stomps manual | Phase: Status lifecycle | Manual override survives a later quote acceptance (provenance test) |
| 2. Double-counted revenue | Phase: Quote→project linkage (rule + constraint) + Metrics (apply rule) | Project with N quotes counts once; total reconciles |
| 6. Contract-value granularity | Phase: Metrics | Hand-verified value for one real quote |
| 5. Decimal/float drift | Phase: Metrics | Aggregate == hand-summed Decimal, no precision noise |
| 4. Stale session projects | Phase: Metrics | Counts match sales team's real pipeline; scope decision confirmed |
| 7. Fleet utilization double-count | Phase: Metrics (after linkage rule) | Utilization ≤ 100%; committed ≤ fleet size |

## Sources

- Codebase (HIGH): `fastapi-project/migrations/003_create_pricing_config.sql` (pricing_projects, project_msn_inputs — no status column), `004_create_quotes.sql` (quotes have no project_id, own status enum), `app/quotes/router.py` + `service.py` (Decimal/DecimalEncoder discipline), `app/pricing/repository.py` (ProjectRepository, user-scoped list_projects), `nextjs-project/src/middleware.ts`, `app/page.tsx`, `api/auth/callback/azure/route.ts`, `components/sidebar/Sidebar.tsx`, `navigation/BottomTabBar.tsx`, `components/quotes/QuoteHeader.tsx`, `app/(dashboard)/dashboard/page.tsx` (hardcoded `/dashboard`).
- [Next.js — Redirecting (next.config redirects, 307 vs 308 permanent)](https://nextjs.org/docs/app/building-your-application/routing/redirecting) (HIGH)
- [Next.js — next.config.js redirects](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects) (HIGH)
- Domain reasoning on immutable-snapshot / mutable-pipeline modeling and Decimal aggregation (MEDIUM).

---
*Pitfalls research for: adding metrics dashboard + status lifecycle automation + route rename to a shipped ACMI pricing app (v2.0)*
*Researched: 2026-06-05*
