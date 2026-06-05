# ACMI Pricing Platform

## What This Is

A web application for generating ACMI (Aircraft, Crew, Maintenance, Insurance) lease pricing quotes. Sales and operations teams enter aircraft and operational parameters to get a per-Block-Hour cost breakdown across all ACMI components, add a margin, and produce a EUR/BH rate to charge airline clients. Built to replace a complex Excel workbook with a proper multi-user web application.

## Core Value

Accurate, repeatable ACMI pricing quotes that the sales team can generate, save, and retrieve — replacing manual spreadsheet-based pricing with a structured tool that produces consistent results.

## Current Milestone: v2.0 Dashboard & Project Pipeline

**Goal:** Separate the pricing workspace from reporting — rename the current Dashboard to "Calculation" and build a real Dashboard showing metrics across current projects, split by potential vs signed.

**Target features:**
- Rename the current Dashboard tab to "Calculation" — all pricing inputs/outputs live there
- Project status (potential/signed) on pricing projects, managed inside the Calculation page
- Quotes linked to projects; an accepted quote auto-marks its project as signed (manual override possible)
- New Dashboard with metrics: project counts & pipeline, revenue & contract value (EUR/BH × MGH × period), fleet utilization (committed vs available MSNs), margins & average rates

## Requirements

### Validated

- ✓ Aircraft/MSN master data management — v1.0
- ✓ ACMI pricing engine (formula-based, translated from Excel workbook) — v1.0
- ✓ Pricing inputs: MGH, Cycle Ratio, Environment, Period, MSN — v1.0
- ✓ Per-BH cost breakdown: Aircraft, Crew, Maintenance, Insurance, DOC, Other COGS, Overhead — v1.0
- ✓ Margin input (percentage) producing final EUR/BH rate — v1.0
- ✓ Quote saving and retrieval (history) — v1.0
- ✓ Team authentication (login + Azure SSO with email allowlist) — v1.0
- ✓ AeroVista-style UI: sidebar navigation, detail panes, dark/light mode — v1.0

### Active

- [ ] Current Dashboard renamed to Calculation (pricing workspace)
- [ ] Project status lifecycle: potential/signed, set inside Calculation
- [ ] Quote→project linkage; accepted quote auto-signs project (manual override allowed)
- [ ] Dashboard: project counts and pipeline overview (potential vs signed)
- [ ] Dashboard: revenue and contract value metrics (EUR/BH × MGH × period months)
- [ ] Dashboard: fleet utilization — MSNs committed to signed projects vs available
- [ ] Dashboard: margin and average EUR/BH rate metrics

### Out of Scope

- Actuals comparison (Excel upload) — deferred to v2, after pricing model proves value
- Business Central Dynamics integration — future milestone, depends on v1 success
- Full financial reporting — future milestone, larger scope
- Real-time aircraft tracking — not relevant to pricing
- Mobile app — web-first
- OAuth/SSO — email/password sufficient for v1

## Context

- **Reference application:** AeroVista Asset Management Platform (irakli934/Asset-Management-App) — same team built this; want identical tech stack, architecture, and UI patterns
- **Existing pricing logic:** Complex Excel workbook with many interconnected sheets containing all ACMI pricing formulas. Will be provided during development for formula extraction.
- **Domain:** ACMI wet leasing — lessor provides aircraft + crew + maintenance + insurance to airline clients, charged per block hour
- **Future vision:** This pricing module is phase 1 of a larger financial platform. Success here leads to actuals tracking, Business Central integration, and company-wide financial reporting.
- **Pricing components:** A (Aircraft), C (Crew), M (Maintenance), I (Insurance), DOC (Direct Operating Costs), Other COGS, Overhead — each calculated separately, summed, then margin applied

## Constraints

- **Tech stack:** FastAPI (Python 3.12+) + Next.js 14 + TypeScript + Tailwind CSS + PostgreSQL 15+ with asyncpg (raw SQL, no ORM) — must match AeroVista architecture
- **State management:** Zustand (matching AeroVista pattern)
- **Database pattern:** Raw SQL via asyncpg with BaseRepository pattern — no ORM
- **UI pattern:** Sidebar nav, detail panes, dark/light mode, StatusBadge/StatCard/DataTable components — AeroVista style
- **Currency:** EUR for all pricing outputs
- **Spreadsheet dependency:** Pricing formulas will be extracted from provided Excel workbook — development of pricing engine depends on receiving this file

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Match AeroVista stack exactly | Team familiarity, proven architecture, consistent codebase | ✓ Good |
| Raw SQL over ORM | Performance, full query control, matches existing pattern | ✓ Good |
| v1 = pricing + save only | Prove value before adding actuals comparison | ✓ Good |
| EUR as pricing currency | Standard for ACMI contracts in this market | ✓ Good |
| v2.0: project status lives on pricing_projects, auto-updated by accepted quotes | Single source of truth for pipeline state with quote-driven automation + manual override | — Pending |
| v2.0: status managed inside Calculation page, Dashboard is read-only metrics | Keep the workspace and reporting concerns separate | — Pending |
| v2.0: contract value = EUR/BH × MGH × period months | Full projected contract value per project for pipeline metrics | — Pending |

---
*Last updated: 2026-06-05 after starting milestone v2.0*
