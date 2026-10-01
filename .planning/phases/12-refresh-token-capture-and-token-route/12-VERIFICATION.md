---
phase: 12-refresh-token-capture-and-token-route
verified: 2026-10-01T13:18:30Z
status: human_needed
score: 5/5 roadmap success criteria verified in code and tests; 0 failed; live browser confirmation of SC1, SC2, SC4 and SC5 outstanding
covered_files:
  - .planning/phases/12-refresh-token-capture-and-token-route/12-01-PLAN.md
  - .planning/phases/12-refresh-token-capture-and-token-route/12-01-SUMMARY.md
  - .planning/phases/12-refresh-token-capture-and-token-route/12-02-PLAN.md
  - .planning/phases/12-refresh-token-capture-and-token-route/12-02-SUMMARY.md
  - nextjs-project/src/app/actions/auth.ts
  - nextjs-project/src/app/api/auth/callback/azure/route.ts
  - nextjs-project/src/app/api/auth/login/azure/route.ts
  - nextjs-project/src/app/api/tracker/token/route.ts
  - nextjs-project/src/lib/tracker-rt.ts
  - nextjs-project/tests/rt-helper.test.mjs
  - nextjs-project/tests/rt-route-smoke.mjs
  - nextjs-project/tests/rt-wiring.test.mjs
covered_digest: "v2:sha256:3fb773d6de85e4c24c2abadd8c915ad68fdd0fa3b3256688f2ea42be8a5b4eca"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "When Entra rotates the refresh token, the same 200 response re-sets tracker_rt with the RT-03 attributes (SC2 second sentence, TOKEN-04); and the 200 { accessToken, expiresAt } happy path (TOKEN-01)"
    test: "Sign in locally, call POST /api/tracker/token from the dashboard tab (devtools console fetch), then call it a second time"
    expected: "200 { accessToken, expiresAt } with Cache-Control: no-store; Set-Cookie tracker_rt with Path=/api/tracker; HttpOnly; SameSite=Lax; Max-Age=604800 on the response; decoded token has aud 86fcee80-... and azp ac19614d-..."
    why_human: "No test drives the redeem-success branch: the smoke deliberately stops at 503 (empty client secret, no network), and the static checks only match strings. Presence and wiring are confirmed, and I confirmed by direct execution that the withCookies composition keeps status 200, no-store, application/json and adds the correct Set-Cookie. The real Entra response (aud, azp, rotation) can only be seen live."
human_verification:
  - test: "SC1 live cookie attributes. Fresh local sign-in, then devtools > Application > Cookies"
    expected: "tracker_rt is HttpOnly, SameSite=Lax, Path=/api/tracker, ~7-day expiry, value is a 5-segment JWE starting eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0.. ; document.cookie in the console does not list it; the cookie is not sent with ordinary page requests"
    why_human: "Needs a real browser and a real Entra sign-in. Code, helper tests and the static wiring tests prove the attributes are set; devtools proves the browser accepted them."
  - test: "SC2 live token. From a signed-in tab: fetch('/api/tracker/token', { method: 'POST' }); decode the accessToken at jwt.ms"
    expected: "200 with { accessToken, expiresAt } only; aud 86fcee80-55d8-4992-937e-af37620ed7f9, azp ac19614d-e6c8-4e6c-966f-2e6de3ee1516; a Set-Cookie for tracker_rt when Entra rotated"
    why_human: "Needs a live Entra redeem (see behavior_unverified_items)."
  - test: "SC4 key-unset sign-in and sign-out. Unset TRACKER_RT_KEY (or use a private window with a build without it), sign in, then sign out"
    expected: "Sign-in still sets access_token and lands on the dashboard; no tracker_rt appears (an old one is expired). Sign-out removes both cookies"
    why_human: "Needs a browser session. Code path is covered by static wiring tests and by reading the callback and logoutAction."
  - test: "SC5 dashboard pages after sign-in"
    expected: "Dashboard, Calculation and quotes load and behave as before"
    why_human: "Visual and flow check. npm run build was run by the executor and the build output is current, but page behaviour is not provable from code."
  - test: "Prohibition (judgment tier): the Entra refresh token never reaches the browser in readable form (not in a URL, a response body, a non-httpOnly cookie or document.cookie)"
    expected: "Human sign-off. Verifier's non-authoritative judgment: PASS. The callback only ever sets the sealed JWE via an httpOnly cookie; tokenResponse returns { accessToken, expiresAt } and drops the rotated refresh token (checked in @avora/tracker-client/server/index.js); no tracker-rt code is NEXT_PUBLIC or client-side; the log lines carry codes only"
    why_human: "unverified-prohibition: judgment-tier prohibitions are never silently passed; flagged for human review."
advisory_review_findings:
  - id: WR-01
    summary: "A copied tracker_rt can be renewed indefinitely, because the sliding JWE exp is bounded only by a client-forgeable access_token (D-04 safety argument does not hold)"
  - id: WR-02
    summary: "Rotation re-seal skips the 3800-char guard; an oversized rotated cookie is silently dropped by the browser"
  - id: WR-03
    summary: "No OAuth state nonce or PKCE (pre-existing); login CSRF now also plants the attacker's refresh token"
  - note: "12-REVIEW.md: 0 critical, 3 warning, 5 info, all disposition open (12-REVIEW-DISPOSITION.md). None contradicts a must-have as written; WR-01 weakens the intent of the 'nowhere else' hardening and deserves a decision before Phase 14 ships to production."
---

# Phase 12: Refresh-token capture and token route Verification Report

**Phase Goal:** A signed-in ACMI user's browser can obtain a tracker-scoped access token from its own origin. The Entra refresh token exists only as an encrypted, httpOnly cookie that the browser sends to `/api/tracker` and nowhere else.
**Verified:** 2026-10-01T13:18:30Z
**Status:** human_needed
**Re-verification:** No (initial verification)

All code, wiring and automated evidence supports the goal. Nothing failed. The status is `human_needed` because the live browser checks (SC1 cookie attributes, SC2 real 200 with `aud`/`azp` and rotation, SC4 key-unset flow, SC5 pages) and the judgment-tier prohibition have not been exercised in a browser, and the redeem-success / rotation branch has no behavioural test.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Authorize request and code exchange both send `openid email profile offline_access`; callback sets `tracker_rt` httpOnly, SameSite=Lax, path `/api/tracker`, 7 days, compact `dir`/`A256GCM` JWE; not in `document.cookie` | VERIFIED in code and tests; live cookie check is a human item | `login/azure/route.ts:17` and `callback/azure/route.ts:~60` both carry the 4-word scope (the old 3-word literal is gone). `tracker-rt.ts:31-37` `trackerRtCookieOptions` = httpOnly true, secure in production, sameSite lax, maxAge 604800, path `/api/tracker`. `sealTrackerRt` uses `alg: 'dir', enc: 'A256GCM'`. `rt-helper.test.mjs:20` pins the `eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..` prefix. Callback applies it with `response.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions)`. httpOnly makes it invisible to `document.cookie` |
| SC2 | `POST /api/tracker/token` returns `200 { accessToken, expiresAt }` with `no-store`, `aud` tracker / `azp` ACMI client; rotation re-sets `tracker_rt` with same attributes | VERIFIED in code; the live token and rotation are PRESENT_BEHAVIOR_UNVERIFIED (human item) | `token/route.ts` redeems via `redeemTrackerToken` with `TRACKER_API_SCOPE` and the three existing `AZURE_*` vars, returns `tokenResponse(result)` (package: body is `{ accessToken, expiresAt }` only, headers `Content-Type: application/json`, `Cache-Control: no-store`). Rotation: `sealTrackerRt` then `withCookies(... out.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions))`. I executed that composition directly: it gives `200 no-store application/json`, body `{"accessToken":"AT","expiresAt":123}` (the rotated refresh token is not in the body), and `Set-Cookie: tracker_rt=...; Path=/api/tracker; Max-Age=604800; HttpOnly; SameSite=lax`. `azp` comes from ACMI's own client id because the redeem uses `AZURE_CLIENT_ID`; `aud` from the scope; neither is checkable without a live Entra call |
| SC3 | Route answers JSON, never redirects: 401 reauth without `access_token`; 401 reauth when `tracker_rt` missing or undecryptable; 503 unconfigured when scope/key unset; Entra failures through `tokenErrorResponse`; log shows code and numeric codes only | VERIFIED | `route.ts`: unset scope or `parseTrackerRtKey` null gives `tokenErrorResponse(new TrackerTokenError('unconfigured'))` first; `checkTrackerRt` gives `{ok:false}` for missing/expired/unparseable session, missing cookie (no clear) and undecryptable/expired/no-exp/other-sub cookie (clear on same 401 via `out.cookies.delete(TRACKER_RT_DELETE)`); catch maps with `tokenErrorResponse(e)` (package STATUS map: reauth 401, consent 403, config 503, unconfigured 503, unavailable 502). Only `console.error` lines: `tracker-token: reseal failed` and `tracker-token: <code> <JSON numeric entraCodes>` / `unexpected`. Smoke run by me: 12/12 cases ok over real HTTP (no cookies, no tracker_rt, garbage / other-user / other-key / expired tracker_rt cleared, expired session keeps cookie, 405 for non-POST, blank scope and malformed key are 503 before the session, log carries only the code), ending `RT-SMOKE-OK` |
| SC4 | With `TRACKER_RT_KEY` unset, sign-in still sets `access_token` and redirects, sets no `tracker_rt`; sign-out removes both | VERIFIED in code and tests; live run is a human item | Callback: `access_token` is set before and independently of the capture; `captureTrackerRt` returns `no-key` for unset or empty key (logs nothing), the capture has its own try/catch, and the else branch runs `response.cookies.delete(TRACKER_RT_DELETE)`. `logoutAction` (`actions/auth.ts`) deletes `access_token` then `TRACKER_RT_DELETE` (`{name, path:'/api/tracker'}`, no maxAge) before `redirect('/login')`. `rt-helper.test.mjs` and `rt-wiring.test.mjs` cover these |
| SC5 | Dashboard, Calculation, quotes still work; `npm run build` passes; lint at baseline (10 errors, 10 warnings) | VERIFIED for build and lint on the phase files; page behaviour is a human item | `.next/BUILD_ID` and `.next/server/app/api/tracker/token/route.js` are dated after `route.ts` (build current; I did not rebuild because the user's `next dev` is listening on :3001). `eslint` on all phase source and test files: no findings. No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`) in any phase file. `package.json` and `package-lock.json` unchanged since the phase plan commit. Orchestrator-reported repo-wide baseline 10/10 not re-run in full |

**Score:** 5/5 roadmap criteria verified in code and tests (1 behaviour-dependent sub-claim, the redeem-success and rotation path, is present, wired and partially exercised but not driven end to end: counted as `behavior_unverified: 1`).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `nextjs-project/src/lib/tracker-rt.ts` | jose-only helper: key parse, seal/open, session decode, decisions, cookie constants | VERIFIED | 180 lines, imports only `jose`. Exports `captureTrackerRt`, `checkTrackerRt`, `parseTrackerRtKey` (exactly 32 bytes), `sealTrackerRt` (`exp` = now + 604800), `openTrackerRt` (pinned algorithms, `requiredClaims: ['exp']`), `sessionSubject`, constants |
| `.../api/auth/login/azure/route.ts` | authorize with offline_access | VERIFIED | `scope: 'openid email profile offline_access'` |
| `.../api/auth/callback/azure/route.ts` | exchange with offline_access; tracker_rt set or delete | VERIFIED | Wired to `captureTrackerRt`; own try/catch; one redirect response carries both cookies |
| `.../actions/auth.ts` | logout deletes tracker_rt | VERIFIED | `cookieStore.delete(TRACKER_RT_DELETE)` |
| `.../api/tracker/token/route.ts` | POST token route | VERIFIED | `dynamic = 'force-dynamic'`, exports `POST` only (smoke confirms 405 for other methods) |
| `tests/rt-helper.test.mjs`, `rt-wiring.test.mjs`, `rt-route-smoke.mjs` | coverage | VERIFIED | `node --test "tests/*.test.mjs"`: 80 pass, 0 fail (22 Phase 11 plus the phase 12 checks); smoke prints `RT-SMOKE-OK` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| callback route | `tracker-rt.ts` | `captureTrackerRt`, `trackerRtCookieOptions`, `TRACKER_RT_DELETE`, `TRACKER_RT_SKIP_MESSAGES` | WIRED | imported and used on the redirect response |
| token route | `tracker-rt.ts` | `parseTrackerRtKey`, `checkTrackerRt`, `sealTrackerRt`, cookie constants | WIRED | all used |
| token route | `@avora/tracker-client/server` | `redeemTrackerToken`, `tokenResponse`, `tokenErrorResponse`, `TrackerTokenError` | WIRED | the Phase 11 v10 install provides the entry; the smoke exercises it in the built app |
| `logoutAction` | `tracker-rt.ts` | `TRACKER_RT_DELETE` | WIRED | only deletion path for `tracker_rt` under `src/` apart from the callback's and token route's use of the same constant |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| token route 200 body | `accessToken`, `expiresAt` | Entra `/oauth2/v2.0/token` via `redeemTrackerToken` using the opened `tracker_rt` | Yes, by code; live call not made | FLOWING (code), live check outstanding |
| `tracker_rt` value | refresh token | `tokens.refresh_token` from the code exchange, sealed with the user's `sub` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full node:test suite | `node --test "tests/*.test.mjs"` (in `nextjs-project`) | 80 tests, 80 pass, 0 fail | PASS |
| HTTP smoke of the built route | `node tests/rt-route-smoke.mjs` (existing current build, free port, throwaway env, no network) | 12 `ok` lines, `RT-SMOKE-OK` | PASS |
| Rotation response composition | one-off script: `tokenResponse` plus `NextResponse` plus `cookies.set` (script removed afterwards) | `200 no-store application/json`, body without refresh token, correct `tracker_rt` Set-Cookie | PASS |
| ESLint on phase files | `npx eslint` on 5 source and 3 test files | no findings | PASS |
| Debt markers | grep `TBD\|FIXME\|XXX\|TODO\|HACK` in phase files | none | PASS |
| Full `npm run build` | not run | skipped: the user's `next dev` is on :3001 from this checkout and a build would disturb `.next`; the existing build output is dated after the last source change | SKIP |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared by the phase. The declared runnable check is `rt-route-smoke.mjs`, run above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RT-01 | 12-01 | `offline_access` in authorize and exchange | SATISFIED | both routes carry the 4-word scope; static wiring test asserts neither holds the old literal |
| RT-02 | 12-01 | callback sets `tracker_rt` = `EncryptJWT`, `dir`/`A256GCM`, keyed by `TRACKER_RT_KEY` | SATISFIED (superset) | Payload is `{ rt, sub }` plus `iat`/`exp`, not bare `{ rt }`. This is the plan's recorded decision D-01/D-04 (the `sub` binding and the JWE's own expiry). It adds claims and removes none; the intent (encrypted `rt` under the key) holds. Worth a requirement-text touch-up when the milestone is archived |
| RT-03 | 12-01 | httpOnly, secure in prod, lax, 7 days, path `/api/tracker` | SATISFIED | `trackerRtCookieOptions`; single constant reused by callback and token route |
| RT-04 | 12-01 | `logoutAction` clears `tracker_rt` with same path | SATISFIED | `TRACKER_RT_DELETE` after `access_token` delete |
| RT-05 | 12-01 | Sign-in unaffected when unconfigured or no refresh token | SATISFIED | skip paths in `captureTrackerRt`, separate try/catch, delete on every skip; tests cover each skip |
| TOKEN-01 | 12-02 | POST redeems `tracker_rt`, 200 `{ accessToken, expiresAt }` no-store | SATISFIED (live happy path outstanding) | route code and package response helper; see `behavior_unverified_items` |
| TOKEN-02 | 12-02 | Route enforces own session; 401 reauth without `access_token` | SATISFIED | `checkTrackerRt` via `sessionSubject`; smoke cases "no cookies" and "expired session keeps tracker_rt" |
| TOKEN-03 | 12-02 | 503 unconfigured, 401 reauth, `tokenErrorResponse`, safe logging | SATISFIED | route code; smoke cases for blank scope, malformed key, garbage/other-key/other-user/expired cookie; log case |
| TOKEN-04 | 12-02 | rotated refresh token re-set with RT-03 attributes on same response | SATISFIED in code; live rotation outstanding | route code and my composition check |

All nine IDs are declared in the plan frontmatter (12-01: RT-01..05; 12-02: TOKEN-01..04), all are mapped to Phase 12 in REQUIREMENTS.md, and no Phase 12 requirement is orphaned.

### Anti-Patterns Found

None blocking. No stubs, placeholders, debt markers or hollow data in phase files. The advisory review findings below are the only open items.

### Advisory (open code review findings, not blockers)

| # | Finding | Severity | Why advisory |
|---|---------|----------|--------------|
| WR-01 | A copied `tracker_rt` can be renewed indefinitely: the sliding 7-day `exp` is bounded only by `access_token`, which the route decodes without verification and so can be forged | Warning | Does not contradict a written must-have (D-04 chose sliding), but the stated safety argument for sliding is wrong. Recommend deciding before Phase 14 ships: seal an absolute deadline, or record that the bound is the Entra refresh-token lifetime |
| WR-02 | The rotation re-seal skips the 3800-char guard, so an oversized rotated cookie is silently dropped by the browser | Warning | Unlikely at current token sizes; no log line today |
| WR-03 | No OAuth `state` nonce or PKCE (pre-existing); the phase widens login-CSRF impact by also planting the attacker's refresh token | Warning | Root cause predates the phase |
| IN-01..IN-05 | key base64 leniency by runtime, mutable option exports, no behavioural test of the 200/rotation path (relates to the unverified item above), two tests that test `NextResponse`, pre-existing logging of id_token claims | Info | Quality items |

All eight remain `open` in `12-REVIEW-DISPOSITION.md`.

### Human Verification Required

The five items listed in the frontmatter (`human_verification`) and the one behaviour-unverified item. They are the same live checks the phase brief already classed as end-of-phase UAT: SC1 cookie attributes in devtools, SC2 real 200 with `aud`/`azp` and rotation, SC4 key-unset sign-in and sign-out, SC5 dashboard pages, and sign-off on the judgment-tier prohibition. The Entra `offline_access` consent and local env were confirmed by the user at the 12-02 Task 3 checkpoint, and a fresh sign-in reached the dashboard with no consent prompt (reported by the orchestrator; no `.env*` file was read).

### Gaps Summary

No gaps. Every roadmap criterion and all nine requirements are implemented, wired and covered by passing automated evidence (80/80 tests, 12/12 HTTP smoke cases, clean lint on phase files). What remains is live-browser confirmation, one untested branch (Entra redeem success and rotation), and a decision on the open review warnings, particularly WR-01.

---

_Verified: 2026-10-01T13:18:30Z_
_Verifier: Claude (gsd-verifier)_
