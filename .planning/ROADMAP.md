# Roadmap: ACMI Pricing Platform

## Milestones

- ✅ **v1.0 Core Pricing Tool** — Phases 1-5 (shipped 2026-03-10)
- ✅ **v2.0 Dashboard & Project Pipeline** — Phases 6-10 (closed 2026-09-30 from code evidence)
- 🚧 **v2.1 Tracker request embed** — Phases 11-14 (in progress)

## Shipped milestones

<details>
<summary>✅ v1.0 Core Pricing Tool (Phases 1-5) — SHIPPED 2026-03-10</summary>

- [x] Phase 1: Foundation and Authentication — completed 2026-03-05
- [x] Phase 2: Aircraft Master Data — completed 2026-03-05
- [x] Phase 3: Pricing Engine — completed 2026-03-10
- [x] Phase 4: Quote Persistence and History — completed 2026-03-10
- [x] Phase 5: Polish and Production Readiness — completed 2026-03-10

Carried over: QUOT-06 (PDF export) is still pending.

</details>

<details>
<summary>✅ v2.0 Dashboard & Project Pipeline (Phases 6-10) — CLOSED 2026-09-30</summary>

Closed from code evidence, not from a verified closeout. See MILESTONES.md.

- [x] Phase 6: Project Schema Foundation (2/2 plans) — completed 2026-06-05 under GSD
- [x] Phase 7: Project Status Backend & Auto-Sign — built outside GSD
- [x] Phase 8: Route Rename (Dashboard → Calculation) — built outside GSD
- [x] Phase 9: Calculation-Page Status Control — built outside GSD
- [x] Phase 10: Dashboard Metrics Page — built outside GSD

Phase directories as they stood: `milestones/v2.0-phases/`. The v2.0 phase details are in git history at `b624bfa:.planning/ROADMAP.md`.

</details>

## v2.1 — Tracker request embed

**Milestone goal:** A signed-in ACMI user can file a feature request or bug report from the app shell, and it lands in the Avora task tracker as their own request, with `source_app` = `acmi-app`.

### Overview

ACMI is the last of the five host apps in the embed spec (`2026-09-14-host-app-embeds-design.md`). This roadmap follows the same four steps HR, MXT and Finance took:

1. Install the private package so that Vercel can build it.
2. Keep a refresh token out of the browser's reach and redeem it at a same-origin token route.
3. Put the two triggers in the app shell, with ACMI's palette.
4. Deploy to production after sign-off and run the spec's UAT.

ACMI differs from Finance in three ways:

- It is TypeScript.
- It runs its own code exchange instead of next-auth. The refresh token therefore gets its own encrypted cookie and key, and the token route checks the session itself (Phase 12).
- It has no user menu. The triggers are icon buttons in the sidebar footer and entries in the mobile More list (Phase 13).

All paths are under `nextjs-project/`. FastAPI and the tracker backend do not change.

Phases 11 to 13 are local commits only. Nothing is pushed until Phase 14, because a push to `main` is a production deploy.

## Phases

**Phase Numbering:**

- Integer phases (11, 12, 13): Planned milestone work. Numbering continues from v2.0, which ended at Phase 10.
- Decimal phases (12.1, 12.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 11: Install tracker-client v10** - The private dependency over `git+https`, the Vercel install script and a new `.env.example` (completed 2026-10-01)
- [ ] **Phase 12: Refresh-token capture and token route** - `offline_access`, an encrypted `tracker_rt` cookie, and `POST /api/tracker/token`
- [ ] **Phase 13: Triggers and themed dialog** - A client wrapper, ACMI palette mapping, two sidebar icon buttons and two mobile More entries
- [ ] **Phase 14: Deploy and production UAT** - Prerequisites, gated push to `main`, and the spec's UAT checklist

## Phase Details

### Phase 11: Install tracker-client v10

**Goal**: ACMI's frontend depends on `@avora/tracker-client` v10 and builds locally, with the install script the Vercel build needs and the env manifest already in the tree.
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: DEP-01, DEP-02, DEP-03
**Success Criteria** (what must be TRUE):

  1. In `nextjs-project/`, `npm ci && npm run build` passes on a clean tree, with the dependency resolved over `git+https` to `a369f81…`.
  2. `grep -c git+ssh package-lock.json` is `0`, and the lockfile diff touches only the `@avora/tracker-client` entry.
  3. `vercel.json`'s `installCommand` is `bash vercel-install.sh`. The script writes git credentials from `TRACKER_REPO_TOKEN` for all three GitHub URL forms before `npm install`, and `git ls-files --eol vercel-install.sh` shows `i/lf`.
  4. `.env.example` is tracked by git despite the `.env*` ignore rule (`git ls-files .env.example` lists it). It holds names only: every `process.env` name read under `src/`, plus `TRACKER_API_SCOPE`, `TRACKER_RT_KEY`, `NEXT_PUBLIC_TRACKER_API_URL`, `NEXT_PUBLIC_TRACKER_URL` and `TRACKER_REPO_TOKEN`.

The install on Vercel itself is first exercised by the Phase 14 deploy.

**Plans**: TBD
- [x] 11-01-PLAN.md
- [x] 11-02-PLAN.md

### Phase 12: Refresh-token capture and token route

**Goal**: A signed-in ACMI user's browser can obtain a tracker-scoped access token from its own origin. The Entra refresh token exists only as an encrypted, httpOnly cookie that the browser sends to `/api/tracker` and nowhere else.
**Depends on**: Phase 11
**Requirements**: RT-01, RT-02, RT-03, RT-04, RT-05, TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04
**Success Criteria** (what must be TRUE):

  1. Both the authorize request and the code exchange send `openid email profile offline_access`. After a fresh local sign-in, the browser holds a `tracker_rt` cookie that is `HttpOnly`, `SameSite=Lax`, path `/api/tracker`, with a 7-day lifetime. Its value is a compact JWE (`dir` / `A256GCM`), and `document.cookie` does not show it.
  2. From a signed-in tab, `POST /api/tracker/token` returns `200 { accessToken, expiresAt }` with `Cache-Control: no-store`. The token's `aud` is the tracker (`86fcee80-…`) and its `azp` is `ac19614d-…`. When Entra rotates the refresh token, the same response re-sets `tracker_rt` with the same attributes.
  3. The route answers in JSON and never redirects: `401 reauth` without the `access_token` cookie, `401 reauth` when `tracker_rt` is missing or fails to decrypt, and `503 unconfigured` when `TRACKER_API_SCOPE` or `TRACKER_RT_KEY` is unset. Entra failures map through `tokenErrorResponse`, and the server log shows only the error code and Entra's numeric codes, never a token.
  4. With `TRACKER_RT_KEY` unset, sign-in still sets `access_token` and redirects as it does today, and sets no `tracker_rt`. Signing out removes both `access_token` and `tracker_rt`.
  5. The dashboard, Calculation and quotes still work after sign-in. `npm run build` passes, and `npm run lint` reports nothing beyond today's baseline (10 errors, 10 warnings).

**Plans**: 1/2 plans executed
**Wave 1**
- [x] 12-01-PLAN.md — the jose-only `tracker_rt` helper, `offline_access` in both sign-in requests, cookie capture in the callback, and the logout delete (RT-01..05)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 12-02-PLAN.md — `POST /api/tracker/token` with clear-on-bad-cookie and re-set on rotation, an HTTP smoke of the built route, then the Entra consent and local env checkpoint (TOKEN-01..04)

### Phase 13: Triggers and themed dialog

**Goal**: ACMI users see **Request a feature** and **Report a bug** in the sidebar footer and in the mobile More list. Each opens the tracker dialog pinned to `acmi-app` and matching ACMI's light or dark palette.
**Depends on**: Phase 12
**Requirements**: EMBED-01, EMBED-02, EMBED-03, EMBED-04, EMBED-05, EMBED-06, EMBED-07, EMBED-08
**Success Criteria** (what must be TRUE):

  1. Locally, the expanded sidebar footer shows two icon buttons (`Lightbulb`, `Bug`) beside the theme toggle, each with its label as `aria-label` and `title`. They disappear when the sidebar is collapsed. At mobile width, both entries appear in the bottom bar's More list.
  2. Each trigger opens the dialog with the right type, the project locked to ACMI App, and the signed-in user as requester: the email from the shell, the name from the token's `name` claim. Submitting shows the package notice, and its link opens the tracker's Requests view filtered to `acmi-app`.
  3. When the token fetch fails, an error notice shows the error's message and no dialog opens.
  4. In both light and dark, the dialog and notices match ACMI, with all 18 variables set on the dialog's own elements. The page behind does not change colour, and `documentElement` gains no inline style.
  5. A viewer-role user can open the dialog from the sidebar and from the mobile bar, where viewers have no More list today. With `NEXT_PUBLIC_TRACKER_API_URL` unset, or with no `userEmail`, no trigger renders on desktop or mobile. `npm run build` passes and lint adds nothing to the baseline.

**Plans**: TBD
**UI hint**: yes

### Phase 14: Deploy and production UAT

**Goal**: The embed is live on the addresses ACMI users land on, and passes the spec's per-app UAT checklist.
**Depends on**: Phase 13
**Requirements**: SHIP-01, SHIP-02, SHIP-03, SHIP-04, SHIP-05
**Success Criteria** (what must be TRUE):

  1. The user re-confirms the Entra consent and authorized-client entries for `ac19614d-…`. A live preflight to the tracker API returns `access-control-allow-origin` from both `https://pricing-model.avora.aero` and `https://acmi-pricing.vercel.app`.
  2. The four tracker variables and `TRACKER_REPO_TOKEN` are on the Vercel project `pricing-model`. The rollback target is recorded before the push. After explicit sign-off, the `main` deploy reaches `READY`, and its install log shows the credential step.
  3. On production, a feature (with a screenshot) and a bug each land in the tracker with `source_app` = `acmi-app` and `created_by` = the user. In light and dark the dialog matches ACMI, and the page behind it does not change colour.
  4. A forced `reauth` shows the notice and no dialog opens. A session from before the deploy gets the `reauth` notice once, then works after signing in again. After logout, `tracker_rt` is gone.
  5. ACMI's own session, quotes and dashboard still work after filing. The rollback path (a `git revert` of the milestone's commits, pushed after sign-off) is written down and understood.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 11 → 12 → 13 → 14

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. Install tracker-client v10 | 2/2 | Complete    | 2026-10-01 |
| 12. Refresh-token capture and token route | 1/2 | In Progress|  |
| 13. Triggers and themed dialog | 0/0 | Not started | - |
| 14. Deploy and production UAT | 0/0 | Not started | - |
