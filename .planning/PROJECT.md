# ACMI Pricing Platform

## What This Is

A web application for generating ACMI (Aircraft, Crew, Maintenance, Insurance) lease pricing quotes. Sales and operations teams enter aircraft and operational parameters to get a per-Block-Hour cost breakdown across all ACMI components, add a margin, and produce a EUR/BH rate to charge airline clients. Pricing projects carry a pipeline status, and a company-wide Dashboard reports on them. Built to replace a complex Excel workbook with a proper multi-user web application.

## Core Value

Accurate, repeatable ACMI pricing quotes that the sales team can generate, save, and retrieve — replacing manual spreadsheet-based pricing with a structured tool that produces consistent results.

## Current Milestone: v2.1 Tracker request embed

**Goal:** A signed-in ACMI user can file a feature request or bug report from the app shell, and it lands in the Avora task tracker as their own request, with `source_app` = `acmi-app`.

**Target features:**
- `@avora/tracker-client` v10 installed over `git+https`, with a Vercel install script and a `nextjs-project/.env.example`
- Sign-in requests `offline_access` and keeps the Entra refresh token in an encrypted, httpOnly `tracker_rt` cookie scoped to `/api/tracker`, cleared on logout
- `POST /api/tracker/token` redeems that refresh token for a tracker-scoped access token and re-sets the cookie when Entra rotates it
- **Request a feature** and **Report a bug** triggers in the `Sidebar.tsx` footer and in `BottomTabBar.tsx`'s more-items, opening the tracker dialog pinned to `acmi-app` in ACMI's light or dark palette
- A gated production deploy and the spec's per-app UAT checklist

**Source spec:** `C:\Projects\task-tracker\docs\superpowers\specs\2026-09-14-host-app-embeds-design.md` (approved 2026-09-14), section "acmi-app" plus the shared package, token-route, wrapper, error-handling, testing and rollout sections. ACMI is step 8, the last host app. Hub, HR, MXT and Finance are live.

**Reference implementation:** Finance's shipped milestone, `C:\Projects\avora-finance-app\.planning\milestones\v1.0-ROADMAP.md` and `v1.0-REQUIREMENTS.md`. ACMI differs in three ways: it is TypeScript, it runs its own code exchange instead of next-auth (so the refresh token needs its own cookie and key), and it has no user menu.

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
- ✓ Pricing workspace served as "Calculation" at `/calculation`; login lands on `/dashboard` — v2.0
- ✓ Project status lifecycle with provenance (`status_source`, `signed_at`), set inside Calculation — v2.0
- ✓ Quote→project linkage (`quotes.project_id`) — v2.0
- ✓ Company-wide Dashboard: pipeline metrics and the fleet deployment board — v2.0

The v2.0 entries were closed on 2026-09-30 from code evidence, not from per-requirement verification. Phase 6 ran under GSD. Phases 7–10 were built outside GSD, and the design moved past the v2.0 spec (migrations 010–013 add `active` and `completed` states). See MILESTONES.md.

### Active

- [ ] tracker-client v10 dependency that builds locally and on Vercel
- [ ] Refresh token captured at sign-in and held only in the encrypted `tracker_rt` cookie
- [ ] Same-origin token route with the spec's error contract
- [ ] Sidebar and mobile triggers opening the themed, project-locked dialog
- [ ] Production deploy after sign-off, passing the spec's UAT

### Out of Scope

- Actuals comparison (Excel upload) — deferred, after the pricing model proves value
- Business Central Dynamics integration — future milestone
- Full financial reporting — future milestone, larger scope
- Real-time aircraft tracking — not relevant to pricing
- Mobile app — web-first
- A test runner for the frontend — the spec verifies ACMI by `next build`, lint and UAT
- Any tracker read view, status sync or notification inside ACMI — spec non-goal; the embed is create-only
- Changing `AZURE_REDIRECT_URI` — sessions land on `acmi-pricing.vercel.app` today; the embed must work there as-is

## Context

- **Reference application:** AeroVista Asset Management Platform (irakli934/Asset-Management-App) — same team built this; want identical tech stack, architecture, and UI patterns
- **Domain:** ACMI wet leasing — lessor provides aircraft + crew + maintenance + insurance to airline clients, charged per block hour
- **Pricing components:** A (Aircraft), C (Crew), M (Maintenance), I (Insurance), DOC (Direct Operating Costs), Other COGS, Overhead — each calculated separately, summed, then margin applied
- **Future vision:** This pricing module is phase 1 of a larger financial platform.
- **Repo layout:** the frontend is `nextjs-project/` (Vercel project `pricing-model`), the API is `fastapi-project/` (Railway). The remote is `Avora-Group/Pricing-Model`, default branch `main`. A push to `main` is a production deploy.
- **Auth today (v2.1 starting point):**
  - `src/app/api/auth/login/azure/route.ts` sends the authorize request with scope `openid email profile`.
  - `src/app/api/auth/callback/azure/route.ts` exchanges the code with the same scope, calls FastAPI `/auth/azure`, and sets the `access_token` cookie (a FastAPI JWT, httpOnly, 7 days, path `/`). No Microsoft token is kept.
  - `src/app/actions/auth.ts` `logoutAction` deletes `access_token`. It is called from `Sidebar.tsx` and `TopBar.tsx`.
  - `src/middleware.ts` has a matcher that excludes `/api`, so an API route must check the session cookie itself.
  - Env names: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`, `API_URL`.
- **Shell today:** `Sidebar.tsx` receives `userEmail` and `userRole`, has a collapsed state, and renders `ThemeToggle` in its footer only when expanded. `BottomTabBar.tsx` has a `moreItems` array of links filtered for viewers. There is no menu component and no display name in the shell.
- **Theme:** next-themes with a `.dark` class. The palette lives in `src/app/globals.css` as `--card`, `--line`, `--ink`, `--muted`, `--cyan`, `--neg`, `--shadow-lg` and friends. ACMI defines `--shadow-lg` on `:root`, one of the dialog's 18 names.
- **Tracker side, verified 2026-09-15:** ACMI's Entra client `ac19614d-e6c8-4e6c-966f-2e6de3ee1516` has `access_as_user` with admin consent and is an authorized client on the tracker registration; it is mapped to `acmi-app` in `tracker.config.json`; both ACMI origins pass the tracker's CORS. Re-check each before the deploy.
- **Lessons carried from HR, MXT and Finance:**
  - npm resolves the private dependency over `ssh://` whatever the URL says, so the lockfile needs normalizing to `git+https` and `vercel-install.sh` must rewrite all three GitHub URL forms.
  - Vercel binds env vars at deploy time. Every change needs a redeploy.
  - `TRACKER_API_SCOPE` has no `NEXT_PUBLIC_` prefix and holds the tracker's client id, not the app's.
  - Host-app tokens are create-only: UAT rows must be deleted from the tracker itself.
  - Importing `dialog.css` sets `color-scheme` and default variables on `:root` at load (Finance 03-REVIEW WR-05).

## Constraints

- **Tech stack:** FastAPI (Python 3.12+) + Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + PostgreSQL with asyncpg (raw SQL, no ORM)
- **State management:** Zustand
- **Database pattern:** Raw SQL via asyncpg with BaseRepository pattern — no ORM
- **Currency:** EUR for all pricing outputs
- **No push without sign-off:** a push to `main` deploys to production. Milestone v2.1 phases stay local until the ship phase.
- **Clean tree first:** check `git status` before any dependency change or commit. A dirty tree means stop and ask.
- **Secrets:** the refresh token never reaches the browser or a log line. `TRACKER_RT_KEY` and `TRACKER_API_SCOPE` are server-only. `.env*` files are edited by the user.
- **No backend change:** the embed touches `nextjs-project/` only. FastAPI and the tracker backend stay as they are.
- **Package pin:** `@avora/tracker-client` at the `v10` tag (`a369f81`).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Match AeroVista stack exactly | Team familiarity, proven architecture, consistent codebase | ✓ Good |
| Raw SQL over ORM | Performance, full query control, matches existing pattern | ✓ Good |
| v1 = pricing + save only | Prove value before adding actuals comparison | ✓ Good |
| EUR as pricing currency | Standard for ACMI contracts in this market | ✓ Good |
| v2.0: project status lives on pricing_projects, auto-updated by accepted quotes | Single source of truth for pipeline state with quote-driven automation + manual override | ✓ Good |
| v2.0: status managed inside Calculation page, Dashboard is read-only metrics | Keep the workspace and reporting concerns separate | ✓ Good |
| v2.0: contract value = EUR/BH × MGH × period months | Full projected contract value per project for pipeline metrics | ✓ Good |
| v2.1: a same-origin token route, not a proxy or in-browser MSAL | Spec decision for all server-auth host apps; the browser calls the tracker directly | — Pending |
| v2.1: refresh token in its own `tracker_rt` cookie, `EncryptJWT` (`dir` / `A256GCM`) under `TRACKER_RT_KEY`, path `/api/tracker` | ACMI has no next-auth JWT to hold it; the path keeps the cookie off every other request | — Pending |
| v2.1: theme passed to the dialog inline, never written to `documentElement` | ACMI defines `--shadow-lg` and switches dark mode by class | — Pending |
| v2.1: phases continue at 11 | GSD default; v2.0 ended at Phase 10 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-30 after starting milestone v2.1*
