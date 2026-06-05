# Feature Research — v2.0 Dashboard & Project Pipeline

**Domain:** B2B ACMI leasing pricing tool — executive Dashboard & project pipeline (potential vs signed)
**Researched:** 2026-06-05
**Confidence:** MEDIUM (domain patterns HIGH from CRM/lessor sources; project-specific mapping MEDIUM, grounded in existing codebase)

> Note: This file covers the **v2.0 milestone** (Dashboard & Project Pipeline) only. v1.0 pricing-engine feature research (the original full ACMI feature landscape) is superseded by this file at this path; see git history / SUMMARY for the v1 baseline. Existing v1 features (pricing engine, per-MSN inputs, quote save/retrieve with statuses, aircraft master, auth/SSO, P&L, sensitivity, admin) are NOT re-researched here.

## Scope Note

This milestone adds reporting and pipeline concepts to a shipped pricing app. Research below covers ONLY the new surface:
1. Project status lifecycle (potential → signed) with quote-driven automation + manual override
2. Executive Dashboard metrics (counts/pipeline, revenue & contract value, fleet utilization, margins/rates)
3. The "Calculation" rename (trivial, included for completeness)

**Existing primitives the new features depend on** (verified in codebase):
- `quotes` table has `status` (draft/sent/accepted/rejected), `total_eur_per_bh`, `margin_percent`, `msn_list`, `period_start`/`period_end`, `client_code`, `client_name`.
- `quote_msn_snapshots` already stores per-MSN `monthly_cost`, `monthly_revenue`, and `msn_input` (containing MGH, period, lease type, crew sets).
- **There is NO `pricing_projects` table yet.** Quotes are currently standalone, grouped only by `client_code`. The project entity must be created and quotes linked to it. This is the central new dependency.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Project entity with status (potential/signed) | Pipeline view is meaningless without a unit to count; status is the pivot for every dashboard split | MEDIUM | New `pricing_projects` table + FK from quotes. Two-state lifecycle is the explicit requirement — resist more states (see anti-features) |
| Project counts split by status | Headline of any pipeline dashboard: "X potential, Y signed" | LOW | Simple `GROUP BY status COUNT(*)`. StatCard components already exist (AeroVista) |
| Quote → project linkage | Without it, contract value/revenue can't be attributed to a project or rolled up | MEDIUM | Add `project_id` FK to `quotes`. Must decide cardinality: one project ↔ many quotes (versions/options) is standard CRM pattern |
| Accepted-quote auto-signs project | Stated requirement; mirrors CRM "quote accepted → Closed Won" (Salesforce CPQ, Zoho, HubSpot) | MEDIUM | On quote status → `accepted`, set project `status = signed`. Must be idempotent and fire from the existing quote status endpoint (`UpdateQuoteStatusRequest`) |
| Manual status override | Sales must set signed/potential independent of quote state (verbal commitments, corrections) | LOW–MEDIUM | Settable field on the project edit UI in the Calculation page. Key question: does a manual override survive later automation? (see Pitfall in Open Questions) |
| Total pipeline contract value (potential) | The "how much is in play" number every exec asks for | MEDIUM | Contract value per project = EUR/BH × MGH × period months (PROJECT.md decision). Sum across potential projects. All inputs exist in snapshots |
| Signed / committed contract value | The "booked" counterpart to pipeline | MEDIUM | Same formula, filtered to signed projects. Lessor equivalent of TCV (Total Contract Value) |
| Average EUR/BH rate & average margin | Pricing-team table stakes: are we pricing consistently and at target margin? | LOW | Avg of `total_eur_per_bh` and `margin_percent`. Decide simple vs weighted up front |
| Fleet utilization: committed vs available MSNs | Core lessor metric (industry standard "owned & committed" reporting); answers "how much fleet is locked up" | MEDIUM–HIGH | Committed = distinct MSNs on signed projects. Available = master fleet − committed. Needs aircraft master as denominator |
| Dashboard is read-only | Stated decision: workspace (Calculation) and reporting (Dashboard) are separate | LOW | No mutations on Dashboard; reduces scope and bug surface |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Time-bounded utilization (lease period overlap) | "Committed" is only meaningful within a window — an MSN signed Jan–Mar is free in Apr. Period data exists (`period_start`/`period_end`) | HIGH | Materially more accurate than flat counts, but needs interval logic. Strong candidate to DEFER unless leadership needs it now |
| Pipeline value by client / by aircraft type | Lets execs see concentration risk and demand mix | LOW–MEDIUM | `client_code` and `aircraft_type` already present; additional GROUP BYs + a bar chart |
| Utilization rate % headline | Single KPI (committed ÷ available) — lessors report this prominently (e.g. "99.3% fleet utilization") | LOW | Cheap once committed/available counts exist; high executive legibility |
| Trend over time (pipeline/signed by month) | Shows momentum, not just a snapshot; leadership favorite | MEDIUM | Requires status-change timestamps (`signed_at` / status history). Capture timestamps in this milestone even if the chart ships later |
| Weighted pipeline (potential × probability) | CRM-standard forecasting refinement | MEDIUM | With only two states there is no stage gradient to weight against — **low value here, likely skip** |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Many-stage pipeline (lead → qualified → proposal → negotiation → won/lost) | "Real CRMs have funnels" | This is a pricing tool, not a CRM. Requirement is explicitly two-state. A funnel adds config, conversion-rate reporting, and complexity nobody asked for | Keep potential/signed. Granularity already exists in quote status (draft/sent/accepted) if needed |
| Editing metrics / status on the Dashboard | "It's right there, let me fix it" | Violates the read-only decision; two places to mutate state → sync bugs | All mutation in Calculation page; Dashboard links back to the project |
| Real-time / live-updating dashboard | "Should always be current" | Forecast-accuracy gains come from having a dashboard at all, not sub-second freshness. Websockets/polling is overkill for a small internal team | On-load query; optional manual refresh button |
| Auto-reverting status when a quote un-accepts | "Keep it perfectly in sync" | Aggressive bidirectional automation fights manual overrides and surprises users | Automation only escalates potential→signed on acceptance; downgrades are manual with an audit note |
| Currency conversion / multi-currency dashboard | "Clients are global" | PROJECT.md fixes EUR; FX adds rate-source + as-of-date complexity | EUR-only; `exchange_rate` already captured per quote if ever needed |
| Forecasting / AI deal scoring | 2026 dashboards tout AI insights | No win/loss history yet to train on; premature | Ship descriptive metrics first; revisit once pipeline history exists |

## Feature Dependencies

```
pricing_projects table (status: potential/signed)
    └──requires──> nothing new (greenfield table)

quote.project_id FK
    └──requires──> pricing_projects table

Accepted-quote auto-signs project
    └──requires──> quote.project_id FK
    └──requires──> existing quote status endpoint (UpdateQuoteStatusRequest)

Manual status override
    └──requires──> pricing_projects table
    └──conflicts──> aggressive bidirectional auto-revert (anti-feature)

Project counts & pipeline split
    └──requires──> pricing_projects table

Revenue / contract value metrics
    └──requires──> quote.project_id FK (attribute value to a project)
    └──uses──────> existing snapshot fields (EUR/BH, MGH, period months, monthly_revenue)

Fleet utilization (committed vs available)
    └──requires──> pricing_projects status (signed = committed)
    └──requires──> aircraft master data (existing) as the "available" denominator
    └──requires──> msn_list / quote_msn_snapshots (existing)

Time-bounded utilization (differentiator)
    └──requires──> period_start/period_end (existing) + interval overlap logic

Trend-over-time (differentiator)
    └──requires──> status-change timestamps (signed_at / status history — NEW)
```

### Dependency Notes

- **Everything hinges on the project entity.** The biggest piece of new work is introducing `pricing_projects` and back-linking quotes. This must come first; all dashboard metrics depend on it.
- **Auto-sign reuses existing plumbing.** The quote status update path already exists; auto-sign is a hook on the `accepted` transition, not a new subsystem.
- **Metrics are mostly read-only aggregation over data that already exists** in `quotes` / `quote_msn_snapshots`. Once linkage exists, the metric queries are GROUP BY / SUM / AVG — low individual complexity.
- **Fleet utilization is the one metric with real modeling depth** because "committed" needs a clear definition (signed projects only, ideally time-bounded). Flag for a deeper design pass.
- **Trend metrics need a schema decision now** (capture `signed_at` / status history) even if the chart ships later — retrofitting timestamps loses history.

## MVP Definition

### Launch With (v2.0)

- [ ] Rename Dashboard tab → "Calculation" — trivial, removes naming collision
- [ ] `pricing_projects` table + `project_id` on quotes — foundation for everything
- [ ] Project status field (potential/signed), editable in Calculation page
- [ ] Accepted quote auto-signs its project (idempotent, fires on accept transition)
- [ ] Manual status override (potential ↔ signed)
- [ ] New Dashboard: project counts + pipeline split (potential vs signed)
- [ ] Dashboard: pipeline contract value (potential) and signed contract value (EUR/BH × MGH × period months)
- [ ] Dashboard: average EUR/BH rate and average margin
- [ ] Dashboard: fleet utilization — committed MSN count (signed) vs available (master − committed), with utilization % headline

### Add After Validation (v2.x)

- [ ] Time-bounded utilization (period overlap) — trigger: flat committed/available proves misleading as leases expire
- [ ] Breakdowns by client / aircraft type — trigger: execs ask "which clients/types drive pipeline"
- [ ] Pipeline/signed trend over time — trigger: once a few months of status history accumulate (capture `signed_at` now)

### Future Consideration (v3+)

- [ ] Weighted pipeline / probability — only if a multi-state funnel is ever introduced
- [ ] AI forecasting / deal scoring — defer until meaningful win/loss history exists
- [ ] Actuals comparison — already out of scope per PROJECT.md

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dashboard → Calculation rename | LOW | LOW | P1 (prerequisite framing) |
| pricing_projects + quote linkage | HIGH | MEDIUM | P1 |
| Project status + manual override | HIGH | LOW–MEDIUM | P1 |
| Accepted-quote auto-sign | HIGH | MEDIUM | P1 |
| Counts & pipeline split | HIGH | LOW | P1 |
| Contract value (potential & signed) | HIGH | MEDIUM | P1 |
| Avg rate & avg margin | MEDIUM | LOW | P1 |
| Fleet utilization (flat) + % headline | HIGH | MEDIUM–HIGH | P1 |
| Time-bounded utilization | MEDIUM | HIGH | P2 |
| Breakdowns by client/type | MEDIUM | LOW–MEDIUM | P2 |
| Trend over time | MEDIUM | MEDIUM | P2 (capture timestamps in P1) |
| Weighted pipeline | LOW | MEDIUM | P3 |

**Priority key:** P1 = must have for this milestone; P2 = should have, add after core ships; P3 = future.

## Competitor / Pattern Analysis

| Pattern | CRM / CPQ (Salesforce, Zoho, HubSpot) | Aircraft lessors (AerCap, CDB, Cirium tooling) | Our Approach |
|---------|----------------------------------------|------------------------------------------------|--------------|
| Deal status automation | Quote "Accepted" → Opportunity "Closed Won" via flow/CPQ sync | Internal | Accepted quote → project "signed", idempotent, manual override |
| Pipeline value | Total + weighted-by-probability | Backlog / committed contract value | Total contract value split potential vs signed; skip probability weighting |
| Contract value | TCV = recurring × term + one-time fees | Lease value over term | EUR/BH × MGH × period months (PROJECT.md) |
| Utilization | N/A | Fleet utilization % (e.g. 99.3%); "owned & committed" counts | Committed MSNs (signed) vs available (master); utilization % headline |
| Dashboard freshness | Real-time / AI-surfaced | Periodic portfolio reporting | On-load aggregation, read-only; no real-time |

## Key Open Questions (flag for design / phase research)

1. **Project ↔ quote cardinality.** One project with many quotes (versions/options) and one "winning" quote, or one quote per project? Determines which quote's value counts as signed contract value.
2. **Committed definition for utilization.** Distinct MSN count on signed projects ignoring period, or time-bounded overlap with today/a selected window? MVP likely flat; flag for accuracy review.
3. **Manual override persistence.** If a user manually sets signed and a linked quote is later un-accepted, does it auto-revert? Recommendation: no auto-downgrade; only auto-upgrade on accept. Needs confirmation.
4. **Average rate weighting.** Simple average of EUR/BH or BH-weighted (more accurate)? Decide for consistency with margin averaging.
5. **Available-fleet denominator.** Is "available" the entire aircraft master or only active/in-service aircraft? Confirm against the aircraft master schema.

## Sources

- [Improvado — Sales Dashboard: Core Metrics & Design Framework (2026)](https://improvado.io/blog/sales-dashboard) — leading vs lagging indicators, layout (MEDIUM)
- [Monday.com — 15 critical B2B sales metrics (2026)](https://monday.com/blog/crm-and-sales/b2b-sales-metrics/) (MEDIUM)
- [DealHub — Weighted Pipeline](https://dealhub.io/glossary/weighted-pipeline/) and [Quote Syncing](https://dealhub.io/glossary/quote-syncing/) (MEDIUM)
- [Count.co — Pipeline Value](https://count.co/metric/pipeline-value) (MEDIUM)
- [MetricHQ — Weighted ACV vs ACV](https://www.metrichq.org/difference/wacv-vs-acv/) (MEDIUM)
- [GoCardless — Total Contract Value (TCV)](https://gocardless.com/en-us/guides/posts/what-is-total-contract-value-tcv/) (MEDIUM)
- [Automation Champion — Auto-sync Accepted Quote with Opportunity (Salesforce)](https://automationchampion.com/2020/11/24/getting-started-with-lightning-flow-builder-part-22-auto-sync-accepted-quote-with-opportunity/) (MEDIUM)
- [Zenatta — Automate Deal Stages in Zoho CRM](https://zenatta.com/automate-deals-zoho-crm/) (MEDIUM)
- [Cirium — Aviation Finance / Lessors tooling](https://www.cirium.com/industry-solutions/aviation-finance/lessors/) — fleet/portfolio utilization (MEDIUM)
- [Aerospace Global News — Biggest lessors by fleet size 2026](https://aerospaceglobalnews.com/news/the-biggest-commercial-aircraft-lessors-by-fleet-size-in-2026/) — "owned & committed" framing, utilization rates (MEDIUM)
- Codebase: `fastapi-project/migrations/004_create_quotes.sql`, `fastapi-project/app/quotes/schemas.py` (existing status/value/MSN fields) (HIGH)

---
*Feature research for: B2B ACMI leasing pipeline & executive dashboard (v2.0 milestone)*
*Researched: 2026-06-05*
