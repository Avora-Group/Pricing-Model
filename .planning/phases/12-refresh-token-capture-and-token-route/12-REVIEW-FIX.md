---
phase: 12-refresh-token-capture-and-token-route
fixed_at: 2026-10-01T14:05:00Z
review_path: .planning/phases/12-refresh-token-capture-and-token-route/12-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-10-01T14:05:00Z
**Source review:** .planning/phases/12-refresh-token-capture-and-token-route/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (fix scope `all`: 3 warnings, 5 info)
- Fixed: 8
- Skipped: 0

All eight fixes are committed on `main` (eac0d2d is the tip), one commit per finding, and nothing is pushed. WR-01 and WR-03 change security logic. Their tests pass, but they still need a person to confirm them in a real sign-in (see "Human verification" below).

## Fixed Issues

### WR-01: A copied tracker_rt can be renewed indefinitely, because the sliding JWE exp is "capped" only by a forgeable access_token

**Files modified:** `nextjs-project/src/lib/tracker-rt.ts`, `nextjs-project/src/app/api/auth/callback/azure/route.ts`, `nextjs-project/src/app/api/tracker/token/route.ts`, `nextjs-project/tests/rt-helper.test.mjs`, `nextjs-project/tests/rt-wiring.test.mjs`, `nextjs-project/tests/rt-route-smoke.mjs`, `.planning/phases/12-refresh-token-capture-and-token-route/12-CONTEXT.md`
**Commit:** 7905685
**Status:** fixed: requires human verification (this is a logic change)
**Applied fix:**
- **The deadline is sealed in.** The JWE payload is now `{ rt, sub, sexp }`. `sexp` is the FastAPI session token's `exp`, read once at sign-in by the new `sessionClaims`.
- **Every seal is capped.** `sealTrackerRt` sets the JWE `exp` to `trackerRtExp(sexp, now)`, which is `min(now + 7d, sexp)`. It throws if `sexp` is not a whole epoch second in the future.
- **The cookie expires with the JWE.** `trackerRtCookieOptions` is now a function of `maxAge`. Each set passes `exp - now`, clamped to 0 to 7 days.
- **Opening checks the deadline.** `openTrackerRt` rejects a JWE whose `sexp` is missing, not an integer, zero, or earlier than its `exp`. `checkTrackerRt` returns `sexp`.
- **Rotation does not slide.** The rotation re-seal passes `check.sexp` forward, so the cookie never outlives the original sign-in.
- **D-04 updated.** 12-CONTEXT.md D-04 has a dated amendment (2026-10-01) recording the cap.
- **Tests added:**
  - a re-seal five days later still ends at the original `sexp`
  - a forged `access_token` with a far-future `exp` does not move the deadline
  - `exp` is capped when the session ends within 7 days
  - `sealTrackerRt` refuses a bad `sexp`
  - `openTrackerRt` rejects a JWE with no `sexp`, a string, fractional or zero one, or `exp > sexp`
  - `checkTrackerRt` clears a cookie with no `sexp`

### WR-02: The rotation re-seal skips the TRACKER_RT_MAX_LENGTH guard, so an oversized rotated cookie is silently dropped by the browser

**Files modified:** `nextjs-project/src/lib/tracker-rt.ts`, `nextjs-project/src/app/api/tracker/token/route.ts`, `nextjs-project/tests/rt-helper.test.mjs`, `nextjs-project/tests/rt-wiring.test.mjs`
**Commit:** 5bdc955
**Applied fix:**
- **One shared seal step.** I added `sealTrackerRtCookie(value, key, now?)`. It never throws. It returns `{ sealed, maxAge, skipped: null }` or `{ sealed: null, skipped: 'seal-failed' | 'too-large' }`.
- **Both paths use it.** `captureTrackerRt` and the route's rotation re-seal now go through it, so the size guard cannot drift between them.
- **The skip is logged.** On a skip, the route logs `tracker-token: reseal skipped, <fixed step text>` and still returns the 200 without a cookie.
- **Wiring test updated.** It still expects exactly 2 `console.error` calls but matches the new line. It also checks that the route never calls `sealTrackerRt(` directly and that the set comes after the skip check.

### WR-03: The OAuth flow has no state nonce and no PKCE, so login CSRF now also plants the attacker's refresh token in tracker_rt

**Files modified:** `nextjs-project/src/lib/oauth-flow.ts` (new), `nextjs-project/src/app/api/auth/login/azure/route.ts`, `nextjs-project/src/app/api/auth/callback/azure/route.ts`, `nextjs-project/tests/rt-oauth-flow.test.mjs` (new)
**Commit:** 640adbf
**Status:** fixed: requires human verification (the auth flow changed; Entra must accept the PKCE exchange)
**Applied fix:**
- **New helper module.** `src/lib/oauth-flow.ts` imports only `node:crypto`. It holds:
  - `newOAuthFlow` (32-byte base64url nonce and verifier)
  - `pkceChallenge` (S256)
  - `serializeOAuthFlow` / `parseOAuthFlow`
  - `buildOAuthState` / `parseOAuthState`
  - `nonceMatches` (`timingSafeEqual` after a length check)
  - the frozen cookie options and the delete constant
- **The flow cookie.** It is `azure_oauth`: httpOnly, SameSite=Lax, Secure in production, `Path=/api/auth/callback/azure`, maxAge 600.
- **Login route.** It sends `state = nonce.next`, `code_challenge` and `code_challenge_method=S256`, and sets the cookie to `nonce.verifier`. `next` is still validated with `sanitizeNext` first.
- **Callback route:**
  - It splits `state` at the first dot and runs `next` through `sanitizeNext` again.
  - Before the code exchange, it rejects a missing or mismatched nonce with `loginRedirect(req, 'azure_failed', next)` and logs a fixed line.
  - It sends `code_verifier` in the token request.
  - It deletes the flow cookie on every answer, both from `loginRedirect` and from the success redirect.
- **Tests (28 in total).**
  - Helper tests: the RFC 7636 appendix B PKCE vector, cookie round trip and rejections, state round trip (including a `next` that contains dots and a query string), rejection of the old bare-path state, constant-time match cases, cookie attributes and freezing, and Next's serialization of the set and delete.
  - Static wiring checks: the login route's parameters and cookie set, the nonce check placed before the exchange, `code_verifier` in the exchange, the cookie deleted on every return, and no `==` comparison of nonces.
- **Side effect.** A sign-in that is already in progress during the deploy, or a second tab that overwrites the cookie, ends with `azure_failed` once. Signing in again fixes it.

### IN-01: Whether parseTrackerRtKey accepts standard base64 depends on the runtime

**Files modified:** `nextjs-project/src/lib/tracker-rt.ts`, `nextjs-project/tests/rt-helper.test.mjs`
**Commit:** cee9c8d
**Applied fix:** `parseTrackerRtKey` now trims the key and requires `/^[A-Za-z0-9_-]{43}$/` before decoding. Tests check that standard base64 of 32 bytes and a 43-character key containing `+` or `/` are rejected, and that surrounding whitespace is trimmed.

### IN-02: The shared cookie option objects are mutable exports

**Files modified:** `nextjs-project/src/lib/tracker-rt.ts`, `nextjs-project/tests/rt-helper.test.mjs`
**Commit:** d4a56b0
**Applied fix:** `TRACKER_RT_DELETE` is now `Object.freeze`d. `trackerRtCookieOptions` (a function since WR-01) returns a new frozen object on every call. The test checks that both are frozen, that assigning to them throws `TypeError`, and that two calls never share an object. The new `azure_oauth` cookie constants from WR-03 are frozen too.

### IN-03: No behavioural test covers the 200 and rotation path, and the HTTP smoke is outside the test glob

**Files modified:** `nextjs-project/src/lib/tracker-token.ts` (new), `nextjs-project/src/app/api/tracker/token/route.ts`, `nextjs-project/tests/rt-token-route.test.mjs` (new), `nextjs-project/tests/rt-wiring.test.mjs`
**Commit:** 3ff0fdf
**Applied fix:**
- **The logic moved.** The route body now lives in `trackerTokenResponse({ accessToken, trackerRt, env, fetch? })` in `src/lib/tracker-token.ts`. The route only reads the two cookies and passes `process.env`.
- **The tests drive it against a mocked Entra endpoint** and cover:
  - **Rotation:** a no-store JSON 200; one `tracker_rt` with the RT-03 attributes and a `Max-Age` capped by `sexp`; the new cookie opens to the rotated token with the same `sub` and the original `sexp`; the Entra request body is checked.
  - **Forged far-future session:** the rotated cookie still stops at the deadline.
  - **No rotation:** no `Set-Cookie`.
  - **Oversized re-seal:** a 200 with no cookie and the fixed log line.
  - **invalid_grant:** a 401 `reauth`, the cookie kept, and only the log line `tracker-token: reauth [70008]`.
  - **Entra unreachable:** a 502 `unavailable` with the cookie kept.
  - **Unconfigured:** no scope, no key, or a standard-base64 key gives 503 with no Entra call.
  - **Another user's cookie:** a 401 that clears it, with no-store kept and no Entra call.
  - **No session:** a 401 with no clear.
- **No leaks.** Every case asserts that no token, secret or key appears in the body or the logs.
- **Wiring checks updated.** They now check the logic file and also that the route holds no logic of its own.
- **Test-only resolve hook.** The test registers a `node:module` `registerHooks` hook that maps `@/` to `src/*.ts` and `next/server` to `next/server.js`. It applies only to that test process.
- **The smoke script.** `rt-route-smoke.mjs` stays outside the glob because it needs a build and a server. I ran it by hand for this report (see Verification).

### IN-04: Two helper tests test NextResponse, not the callback

**Files modified:** `nextjs-project/src/lib/tracker-rt.ts`, `nextjs-project/src/app/api/auth/callback/azure/route.ts`, `nextjs-project/tests/rt-helper.test.mjs`, `nextjs-project/tests/rt-wiring.test.mjs`
**Commit:** c433875
**Applied fix:**
- **New helper.** I added `applyTrackerRt(cookies, capture)`. It sets `tracker_rt` when the capture sealed, and deletes it on a skip or a `null` (thrown) capture. Its cookie jar is typed structurally, so the helper still imports only `jose`.
- **The callback calls it** in place of its inline set or delete.
- **Helper tests drive it on a real `NextResponse`:**
  - the set next to `access_token`, where the value opens to the refresh token
  - `Max-Age` for a short session
  - the delete for both a skipped and a `null` capture
- **Wiring test.** It checks that the callback calls `applyTrackerRt(response.cookies, capture)` after the capture and never sets `tracker_rt` by hand.
- **Renamed test.** The remaining test that only exercises `NextResponse` now says it pins Next's serialization.

### IN-05: Pre-existing callback logs write id_token claims and Entra's raw error body

**Files modified:** `nextjs-project/src/app/api/auth/callback/azure/route.ts`, `nextjs-project/tests/rt-wiring.test.mjs`
**Commit:** eac0d2d
**Applied fix:**
- **Missing claims.** The log now carries only `{ hasEmail, hasOid }`.
- **Failed code exchange.** The body is parsed as JSON, and the log carries only the HTTP status, Entra's OAuth `error` (restricted to `[a-z_]`) and its numeric `error_codes`. It never logs `error_description` or the raw body.
- **Static check.** A new check pins both log lines and rejects `payload` or `tokenRes.text()` in a log.

## Verification

Each fix was checked before its commit, inside the isolated review-fix worktree. The worktree has no `node_modules`, so I used two test-only aids kept in the session scratchpad (nothing was added to the repo):
- a `--import` resolve hook that falls back to the main checkout's `nextjs-project/node_modules`
- a scratch tsconfig that type-checks the worktree's `src` against the main checkout's packages, filtered to the files this phase touches

After all eight commits, `main` was fast-forwarded and the worktree removed. **All of the final gates below ran in the main checkout** (`C:/Projects/acmi-app/nextjs-project`, HEAD eac0d2d), so anyone can reproduce them from the current tree:

| Gate | Result |
|------|--------|
| `node --test "tests/*.test.mjs"` | **141 tests, 141 pass, 0 fail** (it was 80/80 before; 61 tests added) |
| `npx tsc --noEmit` | exit 0, no errors |
| `npm run lint` | 10 errors and 10 warnings, the same as the baseline; none in a touched file (`npx eslint` on the 12 touched files exits 0) |
| `npm run build` | passes (Next 16.1.6, Turbopack); `/api/auth/login/azure`, `/api/auth/callback/azure` and `/api/tracker/token` all build |
| `node tests/rt-route-smoke.mjs` (after the build) | all 12 cases `ok`, `RT-SMOKE-OK` |

## Human verification

- **WR-03 (needed before /gsd-verify-work 12 signs off).** Sign in locally through Microsoft:
  - Check that the authorize URL carries `code_challenge_method=S256` and a `state` of the form `<43 chars>.<path>`.
  - Check that the sign-in completes. Entra must accept `code_verifier` from this confidential web client.
  - Check that the `azure_oauth` cookie is gone after the callback.
  - Check that a shared deep link (`/login?next=/quotes/<id>`) still lands on its target.
  - Replay a stale callback URL in another browser. It should go to `/login?error=azure_failed`.
- **WR-01.** After signing in, check that the `tracker_rt` cookie's expiry matches the `access_token` cookie's (both about 7 days). The first `POST /api/tracker/token` that rotates the token should not push `tracker_rt` past that time.

---

_Fixed: 2026-10-01T14:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
