---
gsd_state_version: "1.0"
milestone: v2.1
milestone_name: Tracker request embed
current_phase: 13
current_phase_name: Triggers and themed dialog
status: planning
stopped_at: Phase 12 complete, ready to plan Phase 13
last_updated: "2026-10-01T15:13:27.532Z"
last_activity: 2026-10-01
last_activity_desc: Phase 12 complete, transitioned to Phase 13
state_head: 7f681c5fa1bbe28f2ae1f1ee99aed87bf4a3870a
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-01)

**Core value:** Accurate, repeatable ACMI pricing quotes that the sales team can generate, save, and retrieve — replacing manual spreadsheet-based pricing with a structured tool that produces consistent results.
**Current focus:** Phase 13 — Triggers and themed dialog

## Current Position

Phase: 13 — Triggers and themed dialog
Plan: Not started
Status: Ready to plan
Last activity: 2026-10-01 — Phase 12 complete, transitioned to Phase 13

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 17 (v1.0), 4 (v2.1)
- Average duration: 6min
- Total execution time: 1.25 hours

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Foundation | 4/4 | 19min | 5min |
| 2 - Aircraft Master Data | 3/3 | 18min | 6min |
| 3 - Pricing Engine | 5/5 | 26min | 5min |
| 4 - Quote Persistence | 4/4 | 17min | 4min |
| 5 - Polish | 2/2 | 13min | 7min |
| 11 | 2 | - | - |
| 12 | 2 | - | - |

**Recent Trend:**
- Last 5 plans: 04-02 (3min), 04-03 (4min), 04-04 (5min), 05-01 (8min), 05-02 (5min)
- Trend: Consistent

*Updated after each plan completion*
| Phase 02 P01 | 7min | 2 tasks | 9 files |
| Phase 02 P02 | 3min | 2 tasks | 6 files |
| Phase 02 P03 | 8min | 3 tasks | 7 files |
| Phase 03 P01 | 5min | 2 tasks | 6 files |
| Phase 03 P02 | 9min | 2 tasks | 3 files |
| Phase 03 P03 | 8min | 1 task | 7 files |
| Phase 03 P04 | 4min | 2 tasks | 9 files |
| Phase 04 P02 | 3min | 2 tasks | 8 files |
| Phase 04 P01 | 5min | 2 tasks | 7 files |
| Phase 04 P03 | 4min | 2 tasks | 5 files |
| Phase 04 P04 | 5min | 3 tasks | 11 files |
| Phase 05 P01 | 8min | 2 tasks | 42 files |
| Phase 05 P02 | 5min | 3 tasks | 7 files |
| Phase 06 P01 | 5min | 3 tasks | 5 files |
| Phase 06 P02 | 2min | 2 tasks | 3 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 11 P01 | 17min | 2 tasks | 1 files |
| Phase 11 P02 | 5min | 3 tasks | 7 files |
| Phase 12 P01 | 6min | 2 tasks | 6 files |
| Phase 12 P02 | 6min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in the PROJECT.md Key Decisions table.
Decisions affecting v2.1 work:

- [v2.1]: A same-origin token route, not a proxy or in-browser MSAL. The browser calls the tracker directly.
- [v2.1]: The refresh token lives in its own `tracker_rt` cookie: `EncryptJWT` (`dir` / `A256GCM`) under `TRACKER_RT_KEY`, path `/api/tracker`. ACMI has no next-auth JWT to hold it.
- [v2.1]: The theme is passed to the dialog inline and never written to `documentElement`. ACMI defines `--shadow-lg` and switches dark mode by class.
- [v2.1]: Phases continue at 11. v2.0 ended at Phase 10.
- [Phase 05]: next-themes handles theme persistence. Its `resolvedTheme` picks the dialog palette (EMBED-06).

Working rules from PROJECT.md Constraints:

- No push without sign-off. Phases 11–13 are local commits only; the push to `main` is Phase 14.
- Clean tree first: check `git status` before any dependency change or commit. A dirty tree means stop and ask.
- `.env*` files are edited by the user. The refresh token never reaches a page script or a log line.
- `nextjs-project/` only. The package is pinned to the `v10` tag (`a369f81`).
- [Phase 11]: .planning/state.json is ignored, not committed: SDK machine state; STATE.md is the tracked record (D-12, commit 39e3b6e)
- [Phase 11]: User approved the package source for 11-02: @avora/tracker-client from Avora-Group/tracker-client tag v10 at a369f81 (D-01)
- [Phase 11]: tracker-client v10 installed and locked to a369f81 over git+https (lock diff 9 0, additions only, no D-14 retry); HR's normalizer and vercel-install.sh copied verbatim; phase work is the single local commit f20debf, not pushed
- [Phase 11]: Code review fixes WR-01..04: vercel-install.sh now keeps git state in a process-scoped temp config (no longer HR's blob), a prebuild guard fails a git+ssh tracker lock, and .env.example comments out the two API vars that have code defaults
- [Phase 11]: Verified (passed), UAT 1/1, Nyquist-compliant (22 node:test checks in nextjs-project/tests, run with `node --test "tests/*.test.mjs"`), threats_open 0
- [Phase 12]: 12-01 captureTrackerRt holds the callback's tracker_rt capture decision (key, sub, refresh token, seal, length) and never throws; the callback still wraps it in its own bindingless try/catch (D-10, A2)
- [Phase 12]: 12-01 sealed tracker_rt values over 3800 chars are deleted and logged, not set (A3)
- [Phase 12]: 12-01 code is the single local commit 3f5b334 on main, not pushed; 73/73 node:test, lint 10/10 baseline, build green
- [Phase 12]: 12-02 token route is the single local commit ecfd5fc on main, not pushed; 80/80 node:test, lint 10/10 baseline, build green, smoke 12/12; Task 3 approved (consent OK, local UAT at :3001 with backend :8079)
- [Phase 12]: All 8 review findings fixed (7905685 … eac0d2d): WR-01 caps tracker_rt at the session exp (`sexp` sealed in, D-04 amended), WR-02 shared size-guarded `sealTrackerRtCookie`, WR-03 OAuth state nonce + PKCE S256 (`src/lib/oauth-flow.ts`), route logic moved to `src/lib/tracker-token.ts` (IN-03)
- [Phase 12]: COMPLETE — UAT 18/18 (b732b5f), Nyquist-compliant 141 tests (b23a8cf), threats_open 0 (f59f106), re-verification passed 5/5 (7f681c5)

### Pending Todos

None yet.

### Blockers/Concerns

- **Unpushed docs commits.** `main` is ahead of `origin/main` by this milestone's `.planning/` commits. They stay local and go out with the Phase 14 push.
- **[Phase 11] Sibling apps' install script.** ACMI's `vercel-install.sh` is now the hardened, process-scoped form; HR, MXT and Finance still run the older one that writes `~/.gitconfig`. Port it there separately (outside this milestone).
- **[Phase 11] The DEP-02 test has only run on Windows Git Bash.** Run `node --test "tests/*.test.mjs"` once on Linux.
- **[Phase 14] `TRACKER_RT_KEY` format.** It must be 43 base64url characters (`node -p "require('crypto').randomBytes(32).toString('base64url')"`). An `openssl rand -base64 32` key is rejected and silently disables the embed (sign-in works, the route answers 503 `unconfigured`) — this happened in Phase 12 UAT. After the deploy, probe `POST /api/tracker/token` for a 200, not just a working sign-in.
- **[Phase 14] Sign-ins in flight during the deploy** end once at `/login?error=azure_failed` (WR-03 flow cookie); signing in again fixes it.
- **[Phases 12–13] Lint is not clean today.** `npm run lint` reports 10 errors and 10 warnings, two of them in `Sidebar.tsx` and `ThemeToggle.tsx`. The gate is "nothing new".
- **[Phases 12–13] Local UAT needs the user.** The tracker variables go into `.env.local` by hand. Whether the tracker's CORS accepts ACMI's local origin is unconfirmed.
- **[Phase 13] `BottomTabBar` takes only `userRole` and hides More from viewers** (`showMore = !isViewer`). EMBED-02, -07 and -08 need `userEmail` there and a More list for viewers.
- **[Phase 13] UAT rows are real.** Host-app tokens are create-only, so `[UAT]` rows must be deleted from the tracker itself.
- **[Phase 14] Re-check the tracker side.** Consent, the authorized-client entry and CORS were last verified on 2026-09-15. Confirm what else a push to `main` redeploys (the root `railway.json` builds the API).
- **[Carried] API test suite.** The `_login()` helper posts to the removed `/auth/login`, so every API-level test 404s. v2.1 does not touch the backend.

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| Requirement | QUOT-06 PDF export (the API route is a 501 stub) | Pending | 2026-09-30 | v2.0 |
| Tests | Re-enable the API test suite after the Azure SSO migration | Pending | 2026-09-30 | v2.0 |

## Session Continuity

Last session: 2026-10-01T13:10:07.102Z
Stopped at: Phase 12 complete, ready to plan Phase 13
Resume file: None

## Operator Next Steps

- Discuss Phase 13 with `/gsd-discuss-phase 13`
