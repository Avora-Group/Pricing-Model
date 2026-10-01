---
gsd_state_version: "1.0"
milestone: v2.1
milestone_name: Tracker request embed
current_phase: 12
current_phase_name: Refresh-token capture and token route
status: planning
stopped_at: Phase 12 context gathered
last_updated: "2026-10-01T10:49:40.088Z"
last_activity: 2026-10-01
last_activity_desc: Phase 11 complete, transitioned to Phase 12
state_head: 3d813f98e95aca64e6606483b9ab115825629e67
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-01)

**Core value:** Accurate, repeatable ACMI pricing quotes that the sales team can generate, save, and retrieve — replacing manual spreadsheet-based pricing with a structured tool that produces consistent results.
**Current focus:** Phase 12 — Refresh-token capture and token route

## Current Position

Phase: 12 — Refresh-token capture and token route
Plan: Not started
Status: Ready to plan
Last activity: 2026-10-01 — Phase 11 complete, transitioned to Phase 12

Progress: [███░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 17 (v1.0), 2 (v2.1)
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

### Pending Todos

None yet.

### Blockers/Concerns

- **Unpushed docs commits.** `main` is ahead of `origin/main` by this milestone's `.planning/` commits. They stay local and go out with the Phase 14 push.
- **[Phase 11] Sibling apps' install script.** ACMI's `vercel-install.sh` is now the hardened, process-scoped form; HR, MXT and Finance still run the older one that writes `~/.gitconfig`. Port it there separately (outside this milestone).
- **[Phase 11] The DEP-02 test has only run on Windows Git Bash.** Run `node --test "tests/*.test.mjs"` once on Linux.
- **[Phase 12] `jose` is already a dependency (`^6.1.3`).** RT-02 adds no package, which keeps DEP-01's "no other package changes" true.
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

Last session: 2026-10-01T10:49:40.056Z
Stopped at: Phase 12 context gathered
Resume file: .planning/phases/12-refresh-token-capture-and-token-route/12-CONTEXT.md

## Operator Next Steps

- Discuss Phase 12 with `/gsd-discuss-phase 12`
