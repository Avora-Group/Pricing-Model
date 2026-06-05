# Requirements: ACMI Pricing Platform

**Defined:** 2026-06-05 (milestone v2.0)
**Core Value:** Accurate, repeatable ACMI pricing quotes that sales teams can generate, save, and retrieve — replacing manual spreadsheet-based pricing.

## v2.0 Requirements

Milestone v2.0 — Dashboard & Project Pipeline. Each maps to roadmap phases.

### Navigation & Routing

- [ ] **NAV-01**: User sees the pricing workspace as "Calculation" in the sidebar, served at `/calculation` — all nav links, middleware route protection, viewer allowlists, and redirects (root page, Azure callback, BottomTabBar, QuoteHeader) updated consistently
- [ ] **NAV-02**: User lands on the new Dashboard (`/dashboard`) after login; root redirect points to Dashboard

### Project Pipeline

- [x] **PROJ-01**: Every pricing project has a status of `potential` or `signed` (new projects default to `potential`)
- [ ] **PROJ-02**: User can manually set a project's status (potential ↔ signed) from the Calculation page
- [x] **PROJ-03**: A quote saved from a project is linked to that project (`quotes.project_id`)
- [ ] **PROJ-04**: When a linked quote is marked Accepted, its project is automatically set to `signed` — idempotent, escalation-only (un-accepting or rejecting a quote never auto-demotes a project)
- [x] **PROJ-05**: Status changes record provenance: `signed_at` timestamp and whether the change was automatic or manual (manual overrides are never overwritten by automation)

### Dashboard Metrics

- [ ] **DASH-01**: User sees project counts split by status (X potential, Y signed) on the Dashboard
- [ ] **DASH-02**: User sees pipeline contract value (potential) and signed contract value in EUR, computed as EUR/BH × MGH × period months per project — using one authoritative quote per project (latest accepted quote for signed projects, latest quote of any status for potential projects)
- [ ] **DASH-03**: User sees average EUR/BH rate and average margin % across projects
- [ ] **DASH-04**: User sees fleet utilization: MSNs committed to signed projects vs available fleet, with a utilization % headline KPI
- [ ] **DASH-05**: User sees pipeline value broken down by client and by aircraft type
- [ ] **DASH-06**: User sees a trend chart of pipeline/signed value by month (driven by `signed_at`/created timestamps)
- [ ] **DASH-07**: Dashboard is read-only and company-wide (all users' projects visible to everyone); all monetary aggregation happens in SQL with NUMERIC precision

## v1.0 Requirements (shipped)

### Authentication

- [x] **AUTH-01**: User can log in with company email and password
- [x] **AUTH-02**: User session persists across browser refresh (JWT)
- [x] **AUTH-03**: User can log out from any page
- [x] **AUTH-04**: Admin can create and manage user accounts (no self-signup)

### Aircraft Data

- [x] **ACFT-01**: System stores aircraft records imported from Excel (MSN, type, registration, cost parameters)
- [x] **ACFT-02**: User can view list of aircraft with search by MSN or registration
- [x] **ACFT-03**: User can view aircraft detail with associated cost data
- [x] **ACFT-04**: Admin can update aircraft cost parameters

### Pricing Engine

- [x] **PRIC-01**: User can enter pricing inputs: MGH, Cycle Ratio, Environment, Period, MSN
- [x] **PRIC-02**: System calculates per-BH cost for each component: Aircraft, Crew, Maintenance, Insurance, DOC, Other COGS, Overhead
- [x] **PRIC-03**: User can enter margin percentage and see final EUR/BH rate
- [x] **PRIC-04**: Calculation results update in real-time as inputs change
- [x] **PRIC-05**: Calculation output matches Excel workbook exactly (verified with test fixtures)
- [x] **PRIC-06**: All monetary calculations use Decimal precision (never floating-point)

### Pricing Configuration

- [x] **CONF-01**: Admin can view and update base rates and pricing parameters via admin page
- [x] **CONF-02**: Pricing config changes are versioned (old quotes reference the config version they were created with)
- [x] **CONF-03**: System prevents config changes from altering previously saved quotes

### Sensitivity Analysis

- [x] **SENS-01**: User can vary a single input parameter and see how the EUR/BH rate changes
- [x] **SENS-02**: Sensitivity results display as a comparison table or chart

### Quote Management

- [x] **QUOT-01**: User can save a completed pricing calculation as a named quote with client name
- [x] **QUOT-02**: Saved quotes are immutable (original calculation preserved exactly as generated)
- [x] **QUOT-03**: User can view list of saved quotes with search and filter (by client, date, MSN)
- [x] **QUOT-04**: User can view full detail of a saved quote including all component breakdowns
- [x] **QUOT-05**: User can set quote status: Draft, Sent, Accepted, Rejected
- [ ] **QUOT-06**: User can export a quote as PDF with professional formatting *(carried over — still pending)*

### UI / UX

- [x] **UI-01**: Application has sidebar navigation with pages: Dashboard, Pricing, Quotes, Aircraft, Admin
- [x] **UI-02**: Data displayed in responsive, sortable tables with detail panes
- [x] **UI-03**: Dark/light mode toggle persisted per user
- [x] **UI-04**: Dashboard shows summary stats: total quotes, quotes by status, recent activity
- [x] **UI-05**: Application matches AeroVista visual style (Tailwind, Zustand, component patterns)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Dashboard Enhancements

- **DASH-08**: Time-bounded fleet utilization (lease period overlap — an MSN signed Jan–Mar is free in Apr)
- **DASH-09**: Weighted pipeline forecasting (requires multi-state funnel; low value with two states)

### Actuals Comparison

- **ACTV-01**: User can upload Excel file with actual operational cost data
- **ACTV-02**: System displays comparison of quoted vs actual costs per contract
- **ACTV-03**: User can identify pricing model gaps (missing or irrelevant costs)

### Quote Enhancement

- **QUOT-07**: User can clone/duplicate an existing quote with modified inputs
- **QUOT-08**: User can add notes and attachments to quotes

### Integration

- **INTG-01**: System syncs financial data from Business Central Dynamics
- **INTG-02**: System provides monthly financial performance reporting

### Advanced Auth

- **AUTH-06**: Role-based access control with granular permissions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-stage CRM pipeline (lead → qualified → proposal → won) | This is a pricing tool, not a CRM; two states (potential/signed) is the explicit requirement; quote statuses already provide granularity |
| Editing status/metrics on the Dashboard | Dashboard is read-only by decision; all mutation lives in Calculation — two mutation surfaces cause sync bugs |
| Real-time / live-updating dashboard | On-load query is sufficient for a small internal team; websockets/polling is overkill |
| Auto-reverting project status when a quote un-accepts | Aggressive bidirectional automation fights manual overrides; downgrades are manual |
| Fuel cost calculation | Fuel is the lessee's cost, not the lessor's — does not belong in ACMI pricing |
| Real-time aircraft tracking | Not relevant to pricing; belongs in operations tools |
| Mobile app | Web-first; mobile deferred indefinitely |
| Multi-currency support | All ACMI contracts in EUR for this market |
| Self-service signup | Controlled company access only |
| Component-level tracking (engines, APU, LG) | v1 uses aircraft-level costs from Excel; component tracking is AeroVista's domain |
| AI forecasting / deal scoring | No win/loss history to train on; ship descriptive metrics first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 8 | Pending |
| NAV-02 | Phase 8 | Pending |
| PROJ-01 | Phase 6 | Complete |
| PROJ-02 | Phase 9 | Pending |
| PROJ-03 | Phase 7 | Complete |
| PROJ-04 | Phase 7 | Pending |
| PROJ-05 | Phase 6 | Complete |
| DASH-01 | Phase 10 | Pending |
| DASH-02 | Phase 10 | Pending |
| DASH-03 | Phase 10 | Pending |
| DASH-04 | Phase 10 | Pending |
| DASH-05 | Phase 10 | Pending |
| DASH-06 | Phase 10 | Pending |
| DASH-07 | Phase 10 | Pending |

**Coverage:**
- v2.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-05 for milestone v2.0*
*Roadmap mapped: 2026-06-05 — phases 6–10*
*v1.0 requirements (30) shipped 2026-03-10; QUOT-06 (PDF export) still pending*
