---
phase: 12-refresh-token-capture-and-token-route
plan: 01
subsystem: auth
tags: [jose, jwe, entra, refresh-token, cookies, nextjs, node-test]

requires:
  - phase: 11-install-tracker-client-v10
    provides: jose ^6.1.3 locked as a dependency; node:test conventions in nextjs-project/tests
provides:
  - src/lib/tracker-rt.ts, a jose-only helper holding every tracker_rt name, option, key parse, seal/open, session decode and decision (the contract plan 12-02 imports)
  - offline_access in both Microsoft sign-in requests
  - tracker_rt set (or deleted) on the sign-in redirect, in its own try/catch
  - logoutAction deleting tracker_rt on its path
  - 51 node:test checks (44 helper, 7 static wiring)
affects: [12-02 token route, 13 embed UI, 14 ship]

actuals:
  tokens: 7726
  tasks: 2
  commits: 1
plan_head_before: d4c9cf32885fa5aeb166929f0c682f7e6975e9ef
plan_head_after: 3f5b33416595c5a63976e684392d8b12105f60c1

tech-stack:
  added: []
  patterns:
    - "Cookie logic in one jose-only helper that node --test imports as .ts (no @/, no next/*)"
    - "Every set of tracker_rt uses trackerRtCookieOptions; every delete uses TRACKER_RT_DELETE (name + path, never maxAge)"
    - "Capture step returns a skip reason, and the callback logs only fixed TRACKER_RT_SKIP_MESSAGES text"

key-files:
  created:
    - nextjs-project/src/lib/tracker-rt.ts
    - nextjs-project/tests/rt-helper.test.mjs
    - nextjs-project/tests/rt-wiring.test.mjs
  modified:
    - nextjs-project/src/app/api/auth/login/azure/route.ts
    - nextjs-project/src/app/api/auth/callback/azure/route.ts
    - nextjs-project/src/app/actions/auth.ts

key-decisions:
  - "The callback's capture decision lives in captureTrackerRt (A2), which never throws; the callback still wraps it in its own try with a bindingless catch (D-10)"
  - "Sealed values over TRACKER_RT_MAX_LENGTH (3800) are deleted and logged, not set, because browsers silently drop ~4 KB cookies (A3)"
  - "The plan's one commit landed on local main, as the dispatch prompt and D-17 direct, although the GSD protected-branch query reports main as protected. Not pushed."

patterns-established:
  - "tracker-rt helper: fail closed (null or a skip reason), never logs, imports only jose"
  - "Static wiring tests read source with \\r stripped and check a code-only view (block comments and whole // lines removed)"

requirements-completed: [RT-01, RT-02, RT-03, RT-04, RT-05]

coverage:
  - id: D1
    description: "Both sign-in requests send openid email profile offline_access"
    requirement: RT-01
    verification:
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#both sign-in requests ask for offline_access"
        status: pass
    human_judgment: false
  - id: D2
    description: "The callback seals the refresh token with the session sub into a dir/A256GCM JWE and sets tracker_rt beside access_token on the redirect"
    requirement: RT-02
    verification:
      - kind: unit
        ref: "nextjs-project/tests/rt-helper.test.mjs#captureTrackerRt seals the refresh token for the session sub"
        status: pass
      - kind: unit
        ref: "nextjs-project/tests/rt-helper.test.mjs#callback redirect carries access_token and tracker_rt as separate cookies"
        status: pass
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#callback captures tracker_rt in its own try/catch after access_token"
        status: pass
    human_judgment: false
  - id: D3
    description: "tracker_rt attributes (httpOnly, SameSite=Lax, 7 days, /api/tracker, Secure in production) and a JWE exp 7 days after iat"
    requirement: RT-03
    verification:
      - kind: unit
        ref: "nextjs-project/tests/rt-helper.test.mjs#cookie options are RT-03"
        status: pass
      - kind: unit
        ref: "nextjs-project/tests/rt-helper.test.mjs#sealed value is a dir/A256GCM compact JWE with exp 7 days after iat"
        status: pass
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#tracker_rt is set only with trackerRtCookieOptions"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sign-out deletes tracker_rt on its path"
    requirement: RT-04
    verification:
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#logoutAction deletes access_token and tracker_rt before redirecting"
        status: pass
      - kind: unit
        ref: "nextjs-project/tests/rt-helper.test.mjs#deleting tracker_rt emits an expired cookie on its path and replaces an earlier set"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sign-in is unchanged when the key is unset or malformed, the session has no sub, Entra sends no refresh token, or the cookie is too large"
    requirement: RT-05
    verification:
      - kind: unit
        ref: "nextjs-project/tests/rt-helper.test.mjs#captureTrackerRt skips with ... (no-key, malformed-key, no-session, no-refresh-token, too-large, first-failure order)"
        status: pass
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#callback leaves access_token and the redirect as they were"
        status: pass
    human_judgment: false
  - id: D6
    description: "SC1: a real Entra sign-in sets tracker_rt with the expected attributes, the JWE prefix and a size under 4096; document.cookie lacks it"
    requirement: RT-02
    verification: []
    human_judgment: true
    rationale: "Needs a real Entra sign-in that returns a refresh token, after plan 12-02's setup checkpoint (consent confirmed, TRACKER_RT_KEY in .env.local)"
  - id: D7
    description: "SC4: blank key gives sign-in with tracker_rt removed and no log line; key restored brings it back; Sign out removes both cookies"
    requirement: RT-05
    verification: []
    human_judgment: true
    rationale: "Needs real sign-ins with .env.local edited and next dev restarted by the user between them (D-15)"

duration: 6min
completed: 2026-10-01
status: complete
---

# Phase 12 Plan 01: Refresh-token capture Summary

**Entra refresh token captured at sign-in via `offline_access` and sealed into an httpOnly, `/api/tracker`-scoped `tracker_rt` cookie (jose `dir`/`A256GCM` JWE bound to the session `sub`, 7-day `exp`). It is deleted on every failed capture and at sign-out, and all the logic sits in one jose-only helper covered by 51 `node:test` checks.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-10-01T12:19:11Z
- **Completed:** 2026-10-01T12:25:30Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)
- **Build time:** `npm run build` took about 12 s in the gate run (compile 3.6 s). The tracer run's build plus helper tests took about 20 s.

## Repo positions

| | HEAD | origin/main |
|---|---|---|
| Start (Task 1 Step 1) | `d4c9cf32885fa5aeb166929f0c682f7e6975e9ef` | `7c9993dcd777f89d1fc0e8c884731f2ecf27fe04` |
| End (after the code commit) | `3f5b33416595c5a63976e684392d8b12105f60c1` | `7c9993dcd777f89d1fc0e8c884731f2ecf27fe04` (unchanged, nothing pushed) |

## Accomplishments

- `src/lib/tracker-rt.ts` implements the full public contract plan 12-02 imports: `TRACKER_RT_COOKIE`, `TRACKER_RT_PATH`, `TRACKER_RT_MAX_AGE`, `TRACKER_RT_MAX_LENGTH`, `trackerRtCookieOptions`, `TRACKER_RT_DELETE`, `TRACKER_RT_SKIP_MESSAGES`, the four types, and `parseTrackerRtKey`, `sealTrackerRt`, `openTrackerRt`, `sessionSubject`, `checkTrackerRt` and `captureTrackerRt`. Its only import is `jose`, and it reads no env var except `NODE_ENV`.
- Both the authorize request and the code exchange ask for `openid email profile offline_access` (RT-01).
- The callback runs `captureTrackerRt` in its own try with a bindingless catch, logs only fixed skip text, then sets `tracker_rt` with `trackerRtCookieOptions` or deletes it with `TRACKER_RT_DELETE`. The `access_token` block, the redirect and the outer catch are unchanged (RT-02, RT-05, D-07, D-09, D-10).
- `logoutAction` deletes `TRACKER_RT_DELETE` right after `access_token`, before `redirect('/login')` (RT-04).

## Test and gate results

- `node --test tests/rt-helper.test.mjs` (tracer, Task 1): `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`, then `npm run build` exit 0, so `TRACER-OK`.
- `node --test tests/rt-helper.test.mjs tests/rt-wiring.test.mjs`: `ℹ tests 51`, `ℹ pass 51`, `ℹ fail 0`.
- Full suite `node --test "tests/*.test.mjs"`: `ℹ tests 73`, `ℹ pass 73`, `ℹ fail 0` (22 Phase 11 checks plus 51 new).
- Lint gate: `lint errors=10 warnings=10 phase-files-with-findings=0`, `LINT-BASELINE-OK`.
- `npm run build`: exit 0, so `GATES-OK`.
- Commit gate: file list, author, subject, trailer, placeholder and not-pushed checks all pass individually. The verbatim COMMIT-OK command prints `COMMIT-OK` once `.planning/config.json` is in the metadata commit (see Issues Encountered).

## Task Commits

The plan's commit policy (D-17) puts both tasks in one commit:

1. **Task 1: sign-in seals the refresh token into tracker_rt (tracer)**: no commit, by design
2. **Task 2: sign-out clears tracker_rt, every failure path proven, the plan's one commit**: `3f5b334` (`Tracker embed: capture the Entra refresh token in an encrypted tracker_rt cookie`)

**Plan metadata:** the `docs(12-01): ...` commit that follows this SUMMARY

## Files Created/Modified

- `nextjs-project/src/lib/tracker-rt.ts`: every `tracker_rt` constant, type and decision (180 lines)
- `nextjs-project/src/app/api/auth/login/azure/route.ts`: `offline_access` in the authorize scope
- `nextjs-project/src/app/api/auth/callback/azure/route.ts`: `offline_access` in the code-exchange scope; the capture block
- `nextjs-project/src/app/actions/auth.ts`: `cookieStore.delete(TRACKER_RT_DELETE)`
- `nextjs-project/tests/rt-helper.test.mjs`: 44 helper and cookie-serialization checks (28 named tests; the placeholder names expand per case)
- `nextjs-project/tests/rt-wiring.test.mjs`: 7 static wiring checks

## Decisions Made

- **The capture decision moves into the helper (A2).** `captureTrackerRt` checks the key, then the session `sub`, the refresh token, sealing and the sealed length, in that order, and returns the first skip reason. The callback still wraps the call in its own try/catch (D-10).
- **Size guard (A3).** A sealed value over 3800 characters is deleted and logged (`sealed cookie is too large`), not set.
- **Callback narrowing.** The callback reads `capture?.skipped ?? null` and `capture?.sealed ?? null` into locals before branching, so TypeScript narrows them without non-null assertions.

## Review-only coverage

- **`'seal-failed'` is covered by code review, not by a test.** `captureTrackerRt` validates the key to exactly 32 bytes before it seals, so `sealTrackerRt` cannot be made to throw from a test. By inspection, the path is a `try { sealed = await sealTrackerRt(...) } catch { return { sealed: null, skipped: 'seal-failed' } }`, and the callback logs the fixed text `sealing failed` and then deletes the cookie.

## Prohibition awaiting human review

- "MUST NOT let the Entra refresh token reach the browser in readable form: not in a URL, a response body, a non-httpOnly cookie or `document.cookie`." Status: **flagged, awaiting human review** (verification: judgment). The automated checks support it: `cookie options are RT-03`, `tracker_rt is set only with trackerRtCookieOptions`, and the callback logs only fixed skip text. SC1 checks `document.cookie` in a real browser.

## Pending end-of-phase UAT (harvested from `<human-check>`)

- **SC1 (RT-01, RT-02, RT-03).** After plan 12-02's setup checkpoint, sign out and sign in with Microsoft. If a consent screen or `AADSTS65001` / `AADSTS90094` appears, stop and report it (D-11). In DevTools, `tracker_rt` should be HttpOnly, SameSite Lax, Path `/api/tracker`, Expires in about 7 days, Secure unticked on localhost, with its value starting `eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..` and Size below 4096 (record the number). `document.cookie.includes('tracker_rt')` should print `false`.
- **SC4 (RT-04, RT-05, D-07).** (a) With the key blank and `next dev` restarted, open `/api/auth/login/azure`: you should land on the dashboard with `access_token` present, `tracker_rt` gone and no `tracker-rt` log line. (b) With the key restored, `tracker_rt` comes back. (c) After Sign out, you should be on `/login` with neither cookie present.

## Deviations from Plan

None in code. Two process notes:

- **[Process] Clean-tree pre-flight.** The status allowlist printed ` M .planning/config.json` at the start. The dispatch prompt identified this as a pre-existing orchestrator edit to be carried in the metadata commit, so it was not treated as another session's work. It is included in the `docs(12-01)` commit.
- **[Process] Protected-branch query.** `gsd-tools query git.base-branch --is-protected main` returns `true`. The commit was still made on local `main`, because the dispatch prompt explicitly runs this executor sequentially on `main` with normal commits, and D-17 and Phase 11's history put plan commits there. It used no `--no-verify`, no identity override and no push.

**Total deviations:** 0 auto-fixed. **Impact:** none on the code.

## Issues Encountered

- The verbatim COMMIT-OK check includes a clean-tree filter that does not allowlist `.planning/config.json`, so it printed nothing until the orchestrator's pending `config.json` edit was committed. Each underlying assertion passed on its own. The verbatim check is re-run after the metadata commit.
- A bash heredoc with an apostrophe failed to parse in this harness. The test additions were written with the Edit tool instead, and nothing was half-written.

## Known Stubs

None.

## User Setup Required

None for this plan. Plan 12-02 carries the setup checkpoint: Entra `offline_access` consent (D-11), and `TRACKER_RT_KEY` and `TRACKER_API_SCOPE` pasted into `.env.local` by the user (D-15).

## Next Phase Readiness

Ready for 12-02. The token route can import `parseTrackerRtKey`, `checkTrackerRt`, `sealTrackerRt`, `TRACKER_RT_COOKIE`, `TRACKER_RT_DELETE` and `trackerRtCookieOptions` from `@/lib/tracker-rt`. The static test `tracker_rt is set only with trackerRtCookieOptions` scans all of `src/`, so the route's rotation set must pass `trackerRtCookieOptions` as its third argument. `tracker_rt is deleted only through TRACKER_RT_DELETE` likewise covers the route's clear. The lint gate regex already lists `src/app/api/tracker/token/route.ts`.

## Self-Check: PASSED

- FOUND: nextjs-project/src/lib/tracker-rt.ts, nextjs-project/tests/rt-helper.test.mjs, nextjs-project/tests/rt-wiring.test.mjs
- FOUND: commit 3f5b334 (exactly the six plan files, author avoradevops <devops@avora.aero>, Co-Authored-By trailer, not an ancestor of origin/main)

---
*Phase: 12-refresh-token-capture-and-token-route*
*Completed: 2026-10-01*
