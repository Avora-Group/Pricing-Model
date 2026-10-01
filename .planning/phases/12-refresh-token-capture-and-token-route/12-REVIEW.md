---
phase: 12-refresh-token-capture-and-token-route
reviewed: 2026-10-01T13:14:28Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - nextjs-project/src/app/actions/auth.ts
  - nextjs-project/src/app/api/auth/callback/azure/route.ts
  - nextjs-project/src/app/api/auth/login/azure/route.ts
  - nextjs-project/src/app/api/tracker/token/route.ts
  - nextjs-project/src/lib/tracker-rt.ts
  - nextjs-project/tests/rt-helper.test.mjs
  - nextjs-project/tests/rt-route-smoke.mjs
  - nextjs-project/tests/rt-wiring.test.mjs
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-10-01T13:14:28Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

I reviewed the refresh-token capture in the Azure callback, the `offline_access` scope change, `logoutAction`, the `tracker-rt.ts` helper (JWE seal/open, key parsing, the unverified session decode, cookie constants), the new `POST /api/tracker/token` route, and the three test files. I also traced the calls into `@avora/tracker-client/server` (`redeemTrackerToken`, `tokenResponse`, `tokenErrorResponse`, `TrackerTokenError`).

What holds up:
- **Token leakage.** No token, key, or Entra free text reaches a response body or a log line. `tokenResponse` drops the rotated refresh token. `TrackerTokenError.entraCodes` is filtered to numbers. The route logs only the code. The callback's skip messages are fixed text.
- **Cookie flags and deletes.** `tracker_rt` is httpOnly, SameSite=Lax, Path=/api/tracker, Secure in production, 7 days. Every delete carries the path.
- **JWE handling.** The algorithms are pinned (`dir` / `A256GCM`), `exp` is required, and the claim types are checked.
- **Sub binding.** It is enforced.
- **Sign-in isolation.** It is real: `captureTrackerRt` never throws, and it is wrapped again anyway.
- **Error responses.** They are JSON only and never redirect.

No blocker found. The main problems:
1. **Unbounded cookie lifetime.** The sliding lifetime (D-04) together with an unverified session gate (D-02) means a copied `tracker_rt` can be renewed with no limit. D-04's safety argument ("D-02 refuses it once access_token has expired") does not hold, because an attacker can forge `access_token`.
2. **No size check on rotation.** The rotation re-seal skips the 4 KB size guard that the callback applies.
3. **Login CSRF.** The OAuth flow has no `state` nonce and no PKCE. This was a login-CSRF hole before this phase. The phase makes it worse: the attacker's refresh token is now planted too, so the victim's tracker submissions are filed under the attacker's identity.

## Warnings

### WR-01: A copied tracker_rt can be renewed indefinitely, because the sliding JWE exp is "capped" only by a forgeable access_token

**File:** `nextjs-project/src/lib/tracker-rt.ts:93-99`, `nextjs-project/src/app/api/tracker/token/route.ts:84-96`, `nextjs-project/src/lib/tracker-rt.ts:122-135`
**Issue:**
- **Every successful redeem pushes the expiry out again.** Entra returns a new refresh token on every redeem when `offline_access` is in the scope, and the package appends it. So every successful POST re-seals `tracker_rt`, sets a fresh `exp = now + 7d` (`sealTrackerRt` line 97), and sets a fresh `maxAge`.
- **The gate meant to bound this is client-controlled.** D-04 says the cookie may outlive the session because D-02 refuses it once `access_token` expires. But `sessionSubject` decodes `access_token` without verifying it (line 128). Its `sub` is a sequential FastAPI user id and its `exp` is whatever the client writes.
- **Result: a stolen cookie works forever.** Anyone holding a copied `tracker_rt` (infostealer malware dumping the cookie jar, a shared machine profile, a backup) can send it with a hand-made `{"sub":"<id>","exp":<far future>}` token. That keeps it alive with no limit: each call returns a new 7-day cookie and a valid tracker access token for the victim.
- **The route makes the stolen cookie useful.** Without it, the raw refresh token is useless to the thief: it is bound to ACMI's confidential client and needs the client secret. The route turns the sealed cookie into a bearer credential that renews itself.
- **Logout cannot revoke a copy.** Nothing is stored server-side, and `logoutAction` only deletes the browser's copy.

**Fix:** Keep an absolute deadline inside the JWE, taken from the real session at sign-in, and never slide past it. For example, seal `{ rt, sub, sexp }`, where `sexp` is the FastAPI token's `exp` at capture time:
```ts
// captureTrackerRt: take exp from the session token alongside sub
const exp = Math.min(nowSec + TRACKER_RT_MAX_AGE, sessionExp)
new EncryptJWT({ rt, sub, sexp: sessionExp })...setExpirationTime(exp)

// route re-seal: keep the original deadline instead of sliding
sealTrackerRt({ rt: rotated, sub: check.sub, sexp: check.sexp }, key) // exp = min(now+7d, sexp)
// cookie maxAge = sexp - now
```
After this, a copied cookie dies when the original session would have ended, whatever `access_token` the client sends. If the sliding window is wanted on purpose, record in D-04 that its bound is the Entra refresh-token lifetime, not the session.

### WR-02: The rotation re-seal skips the TRACKER_RT_MAX_LENGTH guard, so an oversized rotated cookie is silently dropped by the browser

**File:** `nextjs-project/src/app/api/tracker/token/route.ts:89-96`
**Issue:** The callback refuses to set a sealed value longer than `TRACKER_RT_MAX_LENGTH` (3800), because "Browsers silently drop a cookie of about 4 KB" (`tracker-rt.ts:26-28`, `captureTrackerRt` line 178). The route's rotation path calls `sealTrackerRt` directly and sets the result with no length check.
- **What happens when it is too long.** Entra refresh tokens vary in length. If a rotated one seals to more than about 4 KB, the browser ignores the `Set-Cookie` with no error.
- **What the user sees.** The old cookie stays, and its `exp` stops sliding. The user gets `reauth` 7 days after the last successful set.
- **Why it is hard to diagnose.** Nothing is logged, unlike the callback's `too-large` skip.

**Fix:** Apply the same guard and log line in the route:
```ts
const sealed = await sealTrackerRt({ rt: rotated, sub: check.sub }, key).catch(() => null)
if (sealed === null || sealed.length > TRACKER_RT_MAX_LENGTH) {
  console.error(`tracker-token: reseal ${sealed === null ? 'failed' : 'too large'}`)
  return res
}
```
A cleaner option is to move the length check into a shared helper, such as `resealTrackerRt`, that returns a skip reason, so the callback and the route cannot drift. Update the static check in `rt-wiring.test.mjs:209-217` (exact count of 2 `console.error` calls) to match.

### WR-03: The OAuth flow has no state nonce and no PKCE, so login CSRF now also plants the attacker's refresh token in tracker_rt

**File:** `nextjs-project/src/app/api/auth/login/azure/route.ts:13-20`, `nextjs-project/src/app/api/auth/callback/azure/route.ts:33-60,112-128`
**Issue:**
- **The flow is not tied to the browser that started it.** `state` carries only the post-login path (`state: next`). No per-browser nonce is set in a cookie and checked on return, and no `code_challenge`/`code_verifier` is used. The callback is a top-level GET, so SameSite does not protect it.
- **How the attack works.** An attacker can sign in with their own account, stop at the redirect, and send the victim `/api/auth/callback/azure?code=<attacker code>&state=/dashboard`. The victim's browser then redeems the attacker's code.
- **What this phase adds.** Before, that only swapped the ACMI session. Now the callback also seals the attacker's Entra refresh token into the victim's `tracker_rt`, bound to the attacker's `sub`, which matches the planted `access_token`. Every tracker request the victim files from ACMI, including screenshots of ACMI data, is created under the attacker's tracker identity, where the attacker can read it.
- **Severity.** The root cause predates this phase, which is why this is a WARNING. But this phase widens the impact, and the review brief asked about CSRF.

**Fix:**
1. In the login route, generate a random nonce. Store it in a short-lived httpOnly, SameSite=Lax cookie (Path=/api/auth/callback/azure, maxAge about 10 minutes). Send `state = nonce + '.' + next`.
2. In the callback, compare the nonce with the cookie in constant time, and reject with `loginRedirect(..., 'azure_failed', ...)` on a mismatch. Then delete the cookie.
3. Add PKCE (S256 `code_challenge` in the authorize request, `code_verifier` in the token request; store the verifier in the same cookie).

## Info

### IN-01: Whether parseTrackerRtKey accepts standard base64 depends on the runtime

**File:** `nextjs-project/src/lib/tracker-rt.ts:82-90`
**Issue:**
- **Today, on Node 24.** `Uint8Array.fromBase64` is undefined, so jose's `base64url.decode` falls back to `atob` after mapping `-_`. That accepts a standard-base64 key with `+`, `/` and `=` (for example `openssl rand -base64 32`). I checked: a 44-character standard base64 key decodes to 32 bytes.
- **On newer runtimes.** Where `Uint8Array.fromBase64` exists, jose passes `alphabet: 'base64url'`, which rejects `+` and `/`.
- **Consequence.** A key that works today can turn into "malformed" after a Node upgrade on Vercel, which quietly turns into 503 `unconfigured` and blocks every capture. D-09 specifies base64url.

**Fix:** Validate the format before decoding: `if (!/^[A-Za-z0-9_-]{43}$/.test(raw.trim())) return null`.

### IN-02: The shared cookie option objects are mutable exports

**File:** `nextjs-project/src/lib/tracker-rt.ts:31-37,44`
**Issue:** `trackerRtCookieOptions` and `TRACKER_RT_DELETE` are plain exported objects that every set and delete reuses. Any consumer that mutates one (for example `trackerRtCookieOptions.maxAge = 0` in a future "clear" path) silently changes every later cookie write in the process.
**Fix:** Wrap both in `Object.freeze({...})`. Keep `as const` on `sameSite`, or type them as `Readonly<...>`.

### IN-03: No behavioural test covers the 200 and rotation path, and the HTTP smoke is outside the test glob

**File:** `nextjs-project/tests/rt-route-smoke.mjs:208-212`, `nextjs-project/tests/rt-wiring.test.mjs:219-231`
**Issue:** The most security-sensitive branch has no behavioural test. That branch is: a successful redeem, then a re-seal bound to `check.sub`, then `Set-Cookie` with `trackerRtCookieOptions` on a `no-store` 200, plus the fallback when the re-seal fails.
- **The smoke stops before the redeem.** It deliberately ends at 503 (an empty `AZURE_CLIENT_SECRET`).
- **The static check only matches strings.** It cannot catch a wrong status, a missing `no-store` after `withCookies`, or the WR-02 length bug.
- **The smoke never runs automatically.** `rt-route-smoke.mjs` is not a `*.test.mjs`, so `node --test "tests/*.test.mjs"` skips it, and nothing else invokes it.

**Fix:** Pull the route body out into a function that takes an injectable `fetch` (`redeemTrackerToken` already accepts `fetch`). Unit-test the rotation, no-rotation, re-seal-failure and Entra-`invalid_grant` (cookie kept) cases against a mocked Entra response.

### IN-04: Two helper tests test NextResponse, not the callback

**File:** `nextjs-project/tests/rt-helper.test.mjs:85-101,292-306`
**Issue:** "callback redirect carries access_token and tracker_rt as separate cookies" and "deleting tracker_rt emits an expired cookie..." build their own `NextResponse` and copy the callback's options by hand (`ACCESS_TOKEN_OPTIONS`). They would still pass if the callback stopped setting `tracker_rt`, or set it with different options. Only the string-matching checks in `rt-wiring.test.mjs` cover the real callback.
**Fix:** Rename them to say they pin Next's cookie serialization. Better, import a small `applyTrackerRt(response, capture)` helper that the callback also uses, and test that.

### IN-05: Pre-existing callback logs write id_token claims and Entra's raw error body

**File:** `nextjs-project/src/app/api/auth/callback/azure/route.ts:64,80`
**Issue:**
- **Line 80.** `console.error('[azure-callback] Missing email or oid in token:', payload)` logs the whole decoded id_token: name, email, oid, tid and other personal data.
- **Line 64.** This line logs Entra's full error body.

Neither carries the new refresh token. But both break the "fixed text, never a value" logging rule this phase adopted for the tracker lines, and they sit in a file the phase edited.

**Fix:** Log only which claims are missing (`{ hasEmail: !!email, hasOid: !!azureId }`). For a failed token exchange, log `error` and `error_codes` only.

---

_Reviewed: 2026-10-01T13:14:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
