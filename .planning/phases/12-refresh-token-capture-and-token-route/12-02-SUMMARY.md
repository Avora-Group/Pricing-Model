---
phase: 12-refresh-token-capture-and-token-route
plan: 02
subsystem: auth
tags: [entra, refresh-token, token-route, cookies, nextjs, node-test, smoke]

requires:
  - phase: 12-refresh-token-capture-and-token-route
    provides: "12-01 helper src/lib/tracker-rt.ts (parseTrackerRtKey, checkTrackerRt, sealTrackerRt, cookie constants) and tracker_rt captured at sign-in"
  - phase: 11-install-tracker-client-v10
    provides: "@avora/tracker-client v10 server entry (redeemTrackerToken, tokenResponse, tokenErrorResponse, TrackerTokenError)"
provides:
  - "POST /api/tracker/token: same-origin tracker access token for the signed-in user, 200 { accessToken, expiresAt } with no-store"
  - "Route-level session gate (middleware skips /api), clear of a bad tracker_rt, re-set of a rotated one"
  - "tests/rt-route-smoke.mjs: 12-case HTTP smoke of the built route under next start with throwaway config and no network call"
  - "7 static route checks added to tests/rt-wiring.test.mjs"
  - "Human confirmation of Entra offline_access consent and the local TRACKER_RT_KEY / TRACKER_API_SCOPE env (D-11, D-15)"
affects: [13 embed UI, 14 ship]

actuals:
  tokens: 5111
  tasks: 3
  commits: 1
plan_head_before: e70e7a9d57cddfc935a6afdd5b3b4719532bb5b9
plan_head_after: ecfd5fc154e95cbf17644f9a35ba1ad1d9d18c4e

tech-stack:
  added: []
  patterns:
    - "withCookies(res, apply): wrap the package's plain Response in new NextResponse(res.body, res) so status, Content-Type and no-store survive a Set-Cookie"
    - "Configuration check (scope, key) before any session check; session gate in the route because the middleware matcher skips /api"
    - "HTTP smoke against next start with process env pinning throwaway values over .env.local"

key-files:
  created:
    - nextjs-project/src/app/api/tracker/token/route.ts
    - nextjs-project/tests/rt-route-smoke.mjs
  modified:
    - nextjs-project/tests/rt-wiring.test.mjs

key-decisions:
  - "12-02 token route is the single local commit ecfd5fc on main, not pushed; 80/80 node:test, lint 10/10 baseline, build green, smoke 12/12 RT-SMOKE-OK"
  - "12-02 a failed re-seal still returns the 200 with no Set-Cookie and logs the fixed line tracker-token: reseal failed (A3)"
  - "12-02 Task 3 approved by the user: Entra sign-in with offline_access reached the dashboard with no consent prompt and no AADSTS error; local UAT runs at http://localhost:3001 with the FastAPI backend on :8079"

patterns-established:
  - "Token route answers every failure in JSON through tokenErrorResponse and never redirects"
  - "Only the helper constants name, set or delete tracker_rt (TRACKER_RT_DELETE, trackerRtCookieOptions)"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04]

coverage:
  - id: D1
    description: "POST /api/tracker/token exists with force-dynamic and answers through tokenResponse / tokenErrorResponse with no-store"
    requirement: TOKEN-01
    verification:
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#token route exports POST and force-dynamic"
        status: pass
      - kind: integration
        ref: "nextjs-project/tests/rt-route-smoke.mjs (no-store asserted on every response)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No session, an expired session or a missing tracker_rt is 401 reauth in JSON with no redirect and no network call"
    requirement: TOKEN-02
    verification:
      - kind: integration
        ref: "nextjs-project/tests/rt-route-smoke.mjs#no cookies is reauth / session without tracker_rt is reauth / expired session keeps tracker_rt"
        status: pass
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#token route never redirects and sends no CORS headers"
        status: pass
    human_judgment: false
  - id: D3
    description: "A bad tracker_rt is 401 reauth and cleared; unset scope or malformed key is 503 unconfigured before the session; the log carries only the code"
    requirement: TOKEN-03
    verification:
      - kind: integration
        ref: "nextjs-project/tests/rt-route-smoke.mjs (4 clearing cases, 2 unconfigured cases, log carries only the code)"
        status: pass
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#token route checks configuration before the session / token route logs only a code, numeric Entra codes or a fixed step"
        status: pass
    human_judgment: false
  - id: D4
    description: "A rotated refresh token is re-sealed with the same sub and re-set with trackerRtCookieOptions on the same 200"
    requirement: TOKEN-04
    verification:
      - kind: unit
        ref: "nextjs-project/tests/rt-wiring.test.mjs#token route clears and re-sets tracker_rt only through the helper constants"
        status: pass
    human_judgment: false
  - id: D5
    description: "SC2: a real signed-in POST returns 200 no-store with aud/azp/scp/exp as expected, and a rotation re-sets tracker_rt"
    requirement: TOKEN-01
    verification: []
    human_judgment: true
    rationale: "Needs a real Entra refresh token and redeem; the smoke deliberately stops before any network call"
  - id: D6
    description: "SC3: a private window gets 401 false {\"error\":\"reauth\"}; the next dev log never shows a token or cookie value"
    requirement: TOKEN-02
    verification: []
    human_judgment: true
    rationale: "The real dev server's log during real redeems can only be read by the person running it"
  - id: D7
    description: "SC5: Dashboard, Calculation, Quotes and a saved quote behave as before this phase"
    requirement: TOKEN-01
    verification: []
    human_judgment: true
    rationale: "App-wide regression check across real data and the FastAPI backend"

duration: 6min execution (plus the Task 3 human checkpoint)
completed: 2026-10-01
status: complete
---

# Phase 12 Plan 02: Same-origin tracker token route Summary

**`POST /api/tracker/token` redeems the signed-in user's sealed `tracker_rt` for a tracker-scoped access token with `redeemTrackerToken`. It checks configuration first (503 `unconfigured`), then enforces the `access_token` session itself (401 `reauth`, never a redirect). A `tracker_rt` that will not open, has expired or belongs to someone else gets 401 and is cleared. A rotated refresh token is re-sealed into the cookie on the same `no-store` 200. A 12-case HTTP smoke of the built app and 7 static checks prove the route, and the user confirmed Entra consent and the local env (D-11, D-15).**

## Performance

- **Duration:** about 6 min of execution, from 2026-10-01T12:26:32Z (base `e70e7a9`) to the code commit at 12:32:17Z. The plan closed at about 13:09Z, after the Task 3 human checkpoint.
- **Tasks:** 3 (1 tracer, 1 auto, 1 blocking-human checkpoint)
- **Files:** 3 (2 created, 1 modified)
- **Timings:** tracer build about 11 s and smoke about 13 s (7 cases). The Task 2 gate (suite, lint, build, smoke) took about 32 s in total.

## Repo positions

| | HEAD | origin/main |
|---|---|---|
| Start (Task 1 Step 1) | `e70e7a9d57cddfc935a6afdd5b3b4719532bb5b9` | `7c9993dcd777f89d1fc0e8c884731f2ecf27fe04` |
| End (after the code commit, before this docs commit) | `ecfd5fc154e95cbf17644f9a35ba1ad1d9d18c4e` | `7c9993dcd777f89d1fc0e8c884731f2ecf27fe04` (unchanged, nothing pushed) |

## Accomplishments

- `src/app/api/tracker/token/route.ts` (107 lines) exports `POST` and `dynamic = 'force-dynamic'`. Steps, in order:
  - (1) `TRACKER_API_SCOPE` and `parseTrackerRtKey(TRACKER_RT_KEY)`: either missing gives 503 `unconfigured` (D-09).
  - (2) `checkTrackerRt` on the two cookies: a failure gives 401 `reauth`, with `cookies.delete(TRACKER_RT_DELETE)` when `clear` is set (D-02, D-05).
  - (3) `redeemTrackerToken` with ACMI's `AZURE_*` names, then `tokenResponse`. A rotated refresh token is re-sealed for `check.sub` and set with `trackerRtCookieOptions` through `withCookies` (D-06, TOKEN-04).
  - (4) The catch logs HR's one line and returns `tokenErrorResponse(e)`.
- The route reads only the `access_token` and `tracker_rt` cookies from the request. It sends no CORS headers and runs no Origin check (D-03).
- `tests/rt-route-smoke.mjs` starts `next start` on a free 127.0.0.1 port under three throwaway configs (A, B, C) and asserts status, body, `no-store`, no `location` and the Set-Cookie behaviour over HTTP.
- `tests/rt-wiring.test.mjs` gains 7 route tests. Plan 12-01's src-wide set and delete tests now cover the route as well.

## Test and gate results

- **Tracer (Task 1):** `npm run build` exit 0, then 7 smoke cases `ok`, then `RT-SMOKE-OK`. The tracer gate continued without a checkpoint (end-of-phase mode, and the automated verify passed).
- **Task 2 gate:**
  - `node --test "tests/*.test.mjs"`: 80 tests, 80 pass, 0 fail
  - lint: `lint errors=10 warnings=10 phase-files-with-findings=0`, `LINT-BASELINE-OK`
  - `npm run build`: exit 0
  - smoke: 12 `ok` lines, `RT-SMOKE-OK`
  - then `GATES-OK`
- **Commit gate:** `COMMIT-OK` (three files, repo author, subject, `Co-Authored-By:` trailer, not an ancestor of `origin/main`).

The smoke's `ok` lines:

1. `ok no cookies is reauth`
2. `ok session without tracker_rt is reauth`
3. `ok matching tracker_rt reaches the redeem`
4. `ok only POST is served`
5. `ok garbage tracker_rt is reauth and cleared`
6. `ok another user's tracker_rt is reauth and cleared`
7. `ok tracker_rt under another key is reauth and cleared`
8. `ok tracker_rt past its exp is reauth and cleared`
9. `ok expired session keeps tracker_rt`
10. `ok log carries only the code`
11. `ok blank scope is unconfigured before the session`
12. `ok malformed key is unconfigured before the session`

## Task Commits

The plan's commit policy (D-17) puts the code in one commit:

1. **Task 1: tracer, POST /api/tracker/token answers from the built app.** No commit, by design.
2. **Task 2: clear a bad tracker_rt, re-set a rotated one, static route checks.** `ecfd5fc` (`Tracker embed: add the same-origin tracker token route`). It holds exactly `nextjs-project/src/app/api/tracker/token/route.ts`, `nextjs-project/tests/rt-route-smoke.mjs` and `nextjs-project/tests/rt-wiring.test.mjs`.
3. **Task 3: Entra consent and local env (checkpoint:human-action, blocking-human).** No file change and no commit.

**Plan metadata:** the `docs(12-02): ...` commit that follows this SUMMARY.

## Task 3 checkpoint (D-11, D-15)

- The checkpoint message printed the key-generator command as text and the scope value `api://86fcee80-55d8-4992-937e-af37620ed7f9/access_as_user`. The executor never ran the generator.
- **User reply, verbatim:** "ok works pass". This is APPROVED. The user added `TRACKER_RT_KEY` and `TRACKER_API_SCOPE` to `nextjs-project/.env.local` and restarted `next dev`. They then signed in with Microsoft from `/login` and reached the dashboard with no consent prompt and no AADSTS error.
- The D-11 portal state was not checked independently by any agent. The user's reply is the evidence: a successful `offline_access` sign-in with no consent screen.
- **Resume checks, read-only:**
  - `git diff --quiet HEAD -- nextjs-project` exits 0.
  - Both auth routes still contain `'openid email profile offline_access'` (count 1 each).
  - `ecfd5fc` is HEAD.
- **Dev-server probe:** it shows `next dev -p 3001` (PID 2456) and its `start-server.js` child (PID 14412), both from this checkout's `nextjs-project`.

## Environment notes (not code deviations)

- **Local ports for the Phase 12 UAT.** `next dev` runs on **http://localhost:3001**, because another app holds port 3000. The FastAPI backend is on **:8079**.
- **First sign-in failed with "Failed to create account" (`api_failed`).** Phase 12 code did not cause it. The orchestrator diagnosed it:
  - The Entra token exchange had succeeded, so consent was fine.
  - The callback's `API_URL ?? 'http://localhost:8000'` fallback then called port 8000, where nothing listened, because the backend was on 8079.
  - The user set `API_URL` and `NEXT_PUBLIC_API_URL` to `http://localhost:8079` in `.env.local` and restarted, and the next sign-in succeeded. No agent read or wrote any `.env*` file.
- **Uncommitted `docker-compose.yml` change.** At resume, `git status` showed ` M docker-compose.yml`, which is outside the plan's status allowlist. The diff is the user's local port remap and nothing else: `FRONTEND_URL` becomes `http://localhost:3001`, and the API port mapping becomes `"8079:8000"`. The executor did not make this change, so it is left unstaged and is not in any commit. Because of it, Task 3's "status allowlist prints nothing" criterion does not hold literally. Every other line of the allowlist output is clean. The user should decide whether to keep, commit or revert the remap. A push in Phase 14 should not carry it unless that is intended.

## Prohibitions awaiting human review

All three have `verification: judgment`, so they are reported as **flagged, awaiting human review**:

1. **MUST NOT let a request choose what the token route redeems for.** The scope comes only from `TRACKER_API_SCOPE`. Supporting evidence: the static test `token route reads only its two cookies from the request` finds no `req.` access other than `req.cookies`.
2. **MUST NOT work around an Entra consent prompt.** That means no click-through and no dropping `offline_access`. Supporting evidence: no prompt appeared, both auth routes still request `offline_access`, and no file changed in Task 3.
3. **MUST NOT put an access token, refresh token, `tracker_rt` value or `TRACKER_RT_KEY` value into any transcript, UAT note, SUMMARY or commit.** Supporting evidence: the generator was printed and never run, the smoke redacts its throwaway values in the failure log tail, and this SUMMARY was checked for any 43-character base64url run (0 found).

## Pending end-of-phase UAT

Local UAT runs at http://localhost:3001, with the backend on :8079.

- **SC1 (plan 12-01; RT-01, RT-02, RT-03).** Inspect `tracker_rt` in DevTools after a Microsoft sign-in:
  - HttpOnly, SameSite Lax, Path `/api/tracker`, Expires in about 7 days, Secure unticked on localhost
  - its value is a `dir`/`A256GCM` JWE, and its Size is below 4096 (record the number)
  - `document.cookie.includes('tracker_rt')` prints `false`
- **SC4 (plan 12-01; RT-04, RT-05).**
  - (a) With the key blank: sign-in works, `tracker_rt` is absent and no log line appears.
  - (b) With the key restored: `tracker_rt` returns.
  - (c) Sign out: both cookies are removed.
- **SC2 (TOKEN-01, TOKEN-04, D-16).** Run the plan's console snippet, signed in. Expected:
  - the console prints `200 'no-store' 'number'`
  - `aud` is the tracker app id (bare or `api://`), `azp` is `ac19614d-e6c8-4e6c-966f-2e6de3ee1516`, `scp` contains `access_as_user`, and `exp` is in the future
  - on rotation, the response sets `tracker_rt` on Path `/api/tracker` with Max-Age 604800, and the cookie's value changes
  - Never print or copy a token or a cookie value.
- **SC3 (TOKEN-02, TOKEN-03).** In a private window, the POST prints `401 false {"error":"reauth"}`. The `next dev` log shows only `tracker-token: <code> [<numbers>]`, `unexpected` or `reseal failed` lines, and nothing that begins with a JWT header.
- **SC5.** Dashboard, Calculation, Quotes and one saved quote behave as before, and no new console or terminal errors appear.

## Deviations from Plan

None in code. Process notes:

- **[Process] Tracer gate.** Task 1 continued without a checkpoint (`human_verify_mode` end-of-phase, and the automated verify passed).
- **[Process] Harmless warning.** Node prints a `MODULE_TYPELESS_PACKAGE_JSON` warning on stderr when the smoke imports the `.ts` helper. It has no effect on results.
- **[Process] Redaction.** The smoke redacts its throwaway values in the failure log tail.
- **[Process] Protected branch.** The commit is on local `main`, as the dispatch prompt and D-17 direct, although GSD's protected-branch query reports `main` as protected (same as 12-01). Nothing was pushed.
- **[Environment] Dirty `docker-compose.yml`.** See Environment notes. It is the user's change and is left untouched.

**Total deviations:** 0 auto-fixed. **Impact:** none on the code.

## Known Stubs

None.

## User Setup Required

Done in Task 3: `offline_access` consent was confirmed by a successful sign-in, and `TRACKER_RT_KEY` and `TRACKER_API_SCOPE` are set in `.env.local`. Production gets its own key in Phase 14.

## Next Phase Readiness

Phase 12's code is complete. The end-of-phase UAT (SC1 to SC5) and verification are next. Phase 13's dialog wrapper can call `POST /api/tracker/token`. Its contract (200 `{ accessToken, expiresAt }`, JSON `{ error }` with 401, 403, 502 or 503, `no-store`, never a redirect) matches the package's browser getter.

## Self-Check: PASSED

- FOUND: nextjs-project/src/app/api/tracker/token/route.ts, nextjs-project/tests/rt-route-smoke.mjs, nextjs-project/tests/rt-wiring.test.mjs
- FOUND: commit ecfd5fc (exactly the three plan files, author avoradevops <devops@avora.aero>, Co-Authored-By trailer, not an ancestor of origin/main)

---
*Phase: 12-refresh-token-capture-and-token-route*
*Completed: 2026-10-01*
