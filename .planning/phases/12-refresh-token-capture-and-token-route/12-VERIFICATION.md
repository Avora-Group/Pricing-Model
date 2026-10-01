---
phase: 12-refresh-token-capture-and-token-route
verified: 2026-10-01T15:12:11Z
status: passed
score: 5/5 roadmap success criteria verified (code, tests and live UAT); 9/9 requirements satisfied; 0 failed
covered_files:
  - .planning/phases/12-refresh-token-capture-and-token-route/12-01-PLAN.md
  - .planning/phases/12-refresh-token-capture-and-token-route/12-01-SUMMARY.md
  - .planning/phases/12-refresh-token-capture-and-token-route/12-02-PLAN.md
  - .planning/phases/12-refresh-token-capture-and-token-route/12-02-SUMMARY.md
  - nextjs-project/src/app/actions/auth.ts
  - nextjs-project/src/app/api/auth/callback/azure/route.ts
  - nextjs-project/src/app/api/auth/login/azure/route.ts
  - nextjs-project/src/app/api/tracker/token/route.ts
  - nextjs-project/src/lib/oauth-flow.ts
  - nextjs-project/src/lib/tracker-rt.ts
  - nextjs-project/src/lib/tracker-token.ts
  - nextjs-project/tests/rt-helper.test.mjs
  - nextjs-project/tests/rt-oauth-flow.test.mjs
  - nextjs-project/tests/rt-route-smoke.mjs
  - nextjs-project/tests/rt-token-route.test.mjs
  - nextjs-project/tests/rt-wiring.test.mjs
covered_digest: "v2:sha256:bc350f375d7df6b2055c90694c7068980986218191f520e3e175036b9401ac18"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "5/5 in code and tests; live items outstanding; behavior_unverified 1"
  gaps_closed:
    - "behavior_unverified: redeem-success and rotation branch now driven by rt-token-route.test.mjs (mocked Entra, IN-03) and live in UAT 3"
    - "live SC1, SC2, SC4, SC5 and the prohibition sign-off: 12-UAT.md tests 2, 3, 7, 8, 9"
    - "advisory WR-01, WR-02, WR-03, IN-01..IN-05: all fixed (12-REVIEW-DISPOSITION.md, open: 0)"
  gaps_remaining: []
  regressions: []
---

# Phase 12: Refresh-token capture and token route Verification Report

**Phase Goal:** A signed-in ACMI user's browser can obtain a tracker-scoped access token from its own origin. The Entra refresh token exists only as an encrypted, httpOnly cookie that the browser sends to `/api/tracker` and nowhere else.
**Verified:** 2026-10-01T15:12:11Z
**Status:** passed
**Re-verification:** Yes. The earlier report (human_needed, 13:18:30Z) went stale when eight code-review fixes changed covered source files. Everything below was re-checked against the current code.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Authorize and exchange both send `openid email profile offline_access`; `tracker_rt` is httpOnly, Lax, `/api/tracker`, 7-day, `dir`/`A256GCM` JWE; not in `document.cookie` | VERIFIED | `login/azure/route.ts` and `callback/azure/route.ts` both carry the 4-word scope. `tracker-rt.ts`: `trackerRtCookieOptions(maxAge)` returns frozen `{ httpOnly: true, secure: prod, sameSite: 'lax', path: '/api/tracker', maxAge }` with maxAge clamped to 0..604800; `sealTrackerRt` uses `alg: 'dir', enc: 'A256GCM'`. The callback calls `applyTrackerRt(response.cookies, capture)`. Live: 12-UAT.md test 2 (attributes, expiry equals `access_token` expiry, 5-segment JWE, absent from `document.cookie`), test 1 (S256 + nonce state), test 10 |
| SC2 | `POST /api/tracker/token` gives `200 { accessToken, expiresAt }`, `no-store`, `aud` tracker, `azp` ACMI; rotation re-sets `tracker_rt` with the same attributes | VERIFIED | `tracker-token.ts` redeems via `redeemTrackerToken` with `TRACKER_API_SCOPE` and the three `AZURE_*` vars, answers `tokenResponse(result)`; on `result.refreshToken` it re-seals through `sealTrackerRtCookie` (same `sub`, same `sexp`) and sets with `trackerRtCookieOptions(maxAge)`. `rt-token-route.test.mjs` (mocked Entra) drives "a redeem with rotation answers 200 and re-seals...", "...without rotation leaves tracker_rt alone" and the forged far-future session case. Live: 12-UAT.md test 3 (200, only `{ accessToken, expiresAt }`, `no-store`, `aud 86fcee80-...`, `azp ac19614d-...`, rotation does not extend the cookie), test 18 |
| SC3 | JSON only, never a redirect: 401 reauth without session, with missing/undecryptable `tracker_rt`; 503 unconfigured for unset scope/key; Entra failures via `tokenErrorResponse`; logs carry only codes | VERIFIED | `trackerTokenResponse`: unset scope or `parseTrackerRtKey` null gives `tokenErrorResponse(unconfigured)` before the session check; `checkTrackerRt` gives reauth with `clear` per D-05; catch maps via `tokenErrorResponse(e)` and logs `e.code` plus numeric `entraCodes` only; the reseal-skipped line logs a fixed step message. `rt-route-smoke.mjs` against the real build: all cases ok, `RT-SMOKE-OK`. Live: 12-UAT.md test 4 (private window `401 no-store`, `{"error":"reauth"}`, clean dev log), tests 15-17 |
| SC4 | `TRACKER_RT_KEY` unset: sign-in still sets `access_token`, no `tracker_rt`; sign-out removes both | VERIFIED | Callback sets `access_token` before and independently of the capture, which has its own try/catch; `captureTrackerRt` returns `no-key` (logged as nothing), and `applyTrackerRt` deletes `tracker_rt` on every skip or null capture. `logoutAction` deletes `access_token` then `TRACKER_RT_DELETE`. Live: 12-UAT.md test 7 (key blanked then restored, sign-out removes both), tests 11, 13, 14 |
| SC5 | Dashboard, Calculation, quotes work; `npm run build` passes; lint at baseline (10 errors, 10 warnings) | VERIFIED | Run now: `npm run build` exits clean (route table includes `/api/tracker/token`); `npm run lint` reports `20 problems (10 errors, 10 warnings)` with no finding in any phase file; `npx tsc --noEmit` exits 0. Live: 12-UAT.md test 8 |

**Score:** 5/5 truths verified, 0 PRESENT_BEHAVIOR_UNVERIFIED. The previous report's one behavior-unverified item (redeem-success and rotation) is now covered by `rt-token-route.test.mjs` and UAT test 3.

### Prohibition (judgment tier)

"MUST NOT let the Entra refresh token reach the browser in readable form (URL, response body, non-httpOnly cookie, `document.cookie`)": the code supports a PASS. The callback only sets the sealed JWE, httpOnly, on `/api/tracker`; `tokenResponse` returns only `{ accessToken, expiresAt }` and the rotated refresh token goes only into the re-seal; no tracker-rt code is client-side; the callback no longer logs id_token claims or Entra's raw error body (IN-05). This is a non-authoritative verifier judgment. The human sign-off is recorded in 12-UAT.md test 9 (pass), so no `unverified-prohibition` flag remains.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/tracker-rt.ts` | VERIFIED | Imports only `jose`. Key parse (strict 43-char base64url, then 32 bytes), `sealTrackerRt` / `sealTrackerRtCookie` (size guard shared), `openTrackerRt` (pinned algs, `exp` required, `sexp` required and `exp <= sexp`), `sessionClaims`, `checkTrackerRt`, `captureTrackerRt`, `applyTrackerRt`, frozen constants |
| `src/lib/tracker-token.ts` | VERIFIED | New since the last report (IN-03). Injectable `fetch` and env; the route is a thin shell |
| `src/lib/oauth-flow.ts` | VERIFIED | New since the last report (WR-03). Nonce and PKCE verifier (43-char base64url), S256 challenge, `timingSafeEqual` compare, flow cookie scoped to the callback path |
| `src/app/api/tracker/token/route.ts` | VERIFIED | `dynamic = 'force-dynamic'`, exports `POST` only, delegates to `trackerTokenResponse` |
| `src/app/api/auth/login/azure/route.ts` | VERIFIED | Scope with `offline_access`, `state = nonce.next`, `code_challenge` S256, sets `azure_oauth` |
| `src/app/api/auth/callback/azure/route.ts` | VERIFIED | Checks state nonce against the cookie before the exchange, sends `code_verifier`, deletes `azure_oauth` on every answer, capture isolated in its own try/catch |
| `src/app/actions/auth.ts` | VERIFIED | `cookieStore.delete(TRACKER_RT_DELETE)` |
| Tests: `rt-helper`, `rt-wiring`, `rt-oauth-flow`, `rt-token-route` (node:test) and `rt-route-smoke.mjs` | VERIFIED | 141/141 pass; smoke prints `RT-SMOKE-OK` |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| callback route | `tracker-rt.ts` | `captureTrackerRt`, `applyTrackerRt`, `TRACKER_RT_SKIP_MESSAGES` | WIRED |
| callback route | `oauth-flow.ts` | `parseOAuthState`, `parseOAuthFlow`, `nonceMatches`, `OAUTH_FLOW_DELETE`; verifier into the exchange body | WIRED |
| login route | `oauth-flow.ts` | `newOAuthFlow`, `pkceChallenge`, `buildOAuthState`, `oauthFlowCookieOptions` | WIRED |
| token route | `tracker-token.ts` | `trackerTokenResponse({ accessToken, trackerRt, env })` | WIRED |
| `tracker-token.ts` | `tracker-rt.ts`, `@avora/tracker-client/server` | `checkTrackerRt`, `sealTrackerRtCookie`, `parseTrackerRtKey`; `redeemTrackerToken`, `tokenResponse`, `tokenErrorResponse` | WIRED |
| `logoutAction` | `tracker-rt.ts` | `TRACKER_RT_DELETE` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Status |
|----------|------|--------|--------|
| token route 200 body | `accessToken`, `expiresAt` | Entra token endpoint through `redeemTrackerToken` with the opened `tracker_rt` | FLOWING (live: UAT 3) |
| `tracker_rt` value | refresh token | `tokens.refresh_token` from the code exchange, sealed with the session `sub` and `sexp` | FLOWING (live: UAT 2) |

### Behavioral Spot-Checks and Probes

| Behavior | Command (from `nextjs-project`) | Result | Status |
|----------|--------------------------------|--------|--------|
| Full unit suite | `node --test "tests/*.test.mjs"` | 141 tests, 141 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | exit 0, no output | PASS |
| Lint | `npm run lint` | 10 errors, 10 warnings (baseline); none in phase files | PASS |
| Build | `npm run build` | completes, route table lists `/api/tracker/token` | PASS |
| HTTP smoke of the built route | `node tests/rt-route-smoke.mjs` | `RT-SMOKE-OK` | PASS |
| Debt markers | grep `TBD\|FIXME\|XXX\|TODO\|HACK` over every phase source and test file | none | PASS |

No `scripts/*/tests/probe-*.sh` probes are declared by this phase; the declared runnable check is `rt-route-smoke.mjs`, run above.

### Requirements Coverage

All nine IDs are declared in plan frontmatter (12-01: RT-01..05; 12-02: TOKEN-01..04), are marked Complete for Phase 12 in REQUIREMENTS.md, and no Phase 12 requirement is orphaned.

| Requirement | Plan | Status | Evidence |
|-------------|------|--------|----------|
| RT-01 | 12-01 | SATISFIED | Both routes send the 4-word scope; wiring tests; UAT 10 |
| RT-02 | 12-01 | SATISFIED (superset) | Payload is `{ rt, sub, sexp }` plus `iat`/`exp`, not bare `{ rt }`: `sub` binding (D-01) and the session deadline (D-04 amendment, WR-01). Adds claims, removes none; `dir`/`A256GCM` under `TRACKER_RT_KEY`. Worth a requirement-text touch-up at milestone archive |
| RT-03 | 12-01 | SATISFIED (note) | httpOnly, secure in production, Lax, `/api/tracker`. `maxAge` is now min(7 days, seconds to the session's `exp`), so it is at most 7 days and, because the session is issued at the same sign-in, equals 7 days less the instant between the two seals. UAT 2 confirmed the cookie's expiry equals `access_token`'s (~7 days). Intentional per the 2026-10-01 D-04 amendment |
| RT-04 | 12-01 | SATISFIED | `logoutAction` deletes `tracker_rt` on its path; UAT 7, 13 |
| RT-05 | 12-01 | SATISFIED | Skip paths, isolated try/catch, delete on every skip; UAT 7, 14 |
| TOKEN-01 | 12-02 | SATISFIED | 200 `{ accessToken, expiresAt }`, `no-store`; mocked-Entra test; UAT 3 |
| TOKEN-02 | 12-02 | SATISFIED | Route checks the session itself; UAT 4, smoke |
| TOKEN-03 | 12-02 | SATISFIED | 503/401/`tokenErrorResponse`, safe logging; smoke; UAT 4, 17 |
| TOKEN-04 | 12-02 | SATISFIED | Rotation re-set on the same 200, deadline preserved; mocked-Entra test; UAT 3, 18 |

### Review findings since the previous report

All eight findings are `fixed` (12-REVIEW-DISPOSITION.md, `open: 0`) and each fix is present in the current code. WR-01: JWE and cookie capped at the session `exp` via `sexp`, and a JWE without a valid `sexp` does not open. WR-02: one size-guarded `sealTrackerRtCookie` for sign-in and rotation. WR-03: `oauth-flow.ts` nonce plus PKCE, checked before the code exchange. IN-01: strict base64url key check. IN-02: frozen options and delete constants. IN-03: `tracker-token.ts` with an injectable `fetch`, plus `rt-token-route.test.mjs`. IN-04: callback cookie handling driven through `applyTrackerRt`. IN-05: callback logs only fixed text, an OAuth error code and numeric codes. Static security check: 12-SECURITY.md, `threats_open: 0`.

### Anti-Patterns Found

None. No stubs, placeholders, debt markers or hollow data in any phase file.

### Human Verification Required

None outstanding. Every formerly human item is evidenced by the completed 12-UAT.md (18/18 pass, 0 issues):

| Formerly human item | 12-UAT.md test |
|---------------------|----------------|
| SC1 live cookie attributes and expiry | 2 (and 1 for the sign-in flow) |
| SC2 live 200 with `aud`/`azp`, rotation | 3 |
| SC3 private-window 401 reauth, clean dev log | 4 |
| SC4 key-unset sign-in and sign-out | 7 |
| SC5 dashboard, Calculation, quotes | 8 |
| Judgment-tier prohibition sign-off | 9 |
| WR-03: S256 + state, no leftover `azure_oauth`, deep link, replayed callback rejected | 1, 5, 6 |

Remaining honest caveats, none blocking:

- **Production key format (UAT 2 incident).** A local key made with `openssl rand -base64 32` (44-char standard base64) was rejected as 503 unconfigured by IN-01's strict base64url check. That is the designed behaviour. Phase 14's production `TRACKER_RT_KEY` must use the base64url generator documented in `.env.example`, and a wrong-format production key will silently disable the embed (sign-in still works, token route answers 503).
- **Rotation not observed live as a Set-Cookie.** UAT 3 states the rotation condition (if a response carries Set-Cookie `tracker_rt`, the expiry is unchanged); whether Entra actually rotated during the run is not recorded. The rotation branch itself is proven by the mocked-Entra tests, so this is not a gap.
- **Production-only behaviour** (`Secure` flag, Vercel deployment, production Entra redirect URI and `offline_access` consent) is out of this phase's local scope and belongs to Phase 14.
- RT-02 requirement text still says `EncryptJWT({ rt })`; the implementation is a documented superset.

### Gaps Summary

No gaps. All five success criteria and all nine requirements hold in the current code, the full automated gate is green (141/141 tests, tsc, lint at baseline, build, route smoke), and the live behaviour is evidenced by 12-UAT.md.

---

_Verified: 2026-10-01T15:12:11Z_
_Verifier: Claude (gsd-verifier)_
