---
status: complete
phase: 12-refresh-token-capture-and-token-route
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-VERIFICATION.md, 12-REVIEW-FIX.md]
started: 2026-10-01T13:49:12Z
updated: 2026-10-01T15:07:40Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

Local setup: `next dev` on http://localhost:3001, FastAPI on :8079 (API_URL / NEXT_PUBLIC_API_URL point there).
Never paste a token, cookie value or key into a reply.

### 1. Sign-in with state nonce and PKCE (WR-03)
expected: The authorize redirect carries code_challenge_method=S256, a code_challenge and a state of the form <43 chars>.<path>; sign-in completes onto the dashboard; no azure_oauth cookie remains afterwards.
result: pass

### 2. SC1 live tracker_rt cookie attributes, with expiry capped at the session (WR-01)
expected: tracker_rt is HttpOnly, SameSite=Lax, Path=/api/tracker; its expiry equals access_token's expiry (both ~7 days out); value is a 5-segment JWE starting eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0.. and under 4096 bytes; `document.cookie` in the console does not list it.
result: pass
note: "First attempt got 503 unconfigured: the local key came from `openssl rand -base64 32` (44-char standard base64), which IN-01 (cee9c8d) now rejects by design. Regenerated with the base64url generator from .env.example; Phase 14's production key must use the same generator."

### 3. SC2 live token from a signed-in tab, rotation does not extend the cookie
expected: `fetch('/api/tracker/token', { method: 'POST' })`, run twice, returns 200 with only `{ accessToken, expiresAt }` and `Cache-Control: no-store`. Decoded at jwt.ms, aud is 86fcee80-55d8-4992-937e-af37620ed7f9 and azp is ac19614d-e6c8-4e6c-966f-2e6de3ee1516. If a response carries Set-Cookie tracker_rt (rotation), it has the same attributes and the cookie's expiry in Application > Cookies is unchanged from test 2 (not pushed later).
result: pass

### 4. SC3 no session gives reauth, and logs carry no secrets
expected: In a private window at http://localhost:3001 (not signed in), `fetch('/api/tracker/token', { method: 'POST' }).then(r => r.status + ' ' + r.headers.get('cache-control')).then(console.log)` gives `401 no-store`, and the body is `{"error":"reauth"}`. The `next dev` terminal output from tests 1–4 never shows a token, a cookie value or the key.
result: pass

### 5. Deep link survives sign-in (WR-03 state carries next)
expected: Signed out, open http://localhost:3001/login?next=/quotes/<an existing quote id>, then sign in with Microsoft. You land on that quote, not on the dashboard.
result: pass

### 6. Replayed callback is rejected (WR-03)
expected: Copy a used /api/auth/callback/azure?code=...&state=... URL from the Network log of test 1 or 5 and open it in a different browser or a private window. It ends at /login?error=azure_failed, and no access_token is set there.
result: pass

### 7. SC4 key-unset sign-in and sign-out
expected: With TRACKER_RT_KEY blanked in .env.local and next dev restarted, sign-in still sets access_token and lands on the dashboard, and tracker_rt is absent (an existing one is removed); there is no tracker-rt error line in the log. With the key restored and next dev restarted, a new sign-in sets tracker_rt again. Sign out then removes both access_token and tracker_rt.
result: pass

### 8. SC5 dashboard pages after sign-in
expected: Dashboard, Calculation, Quotes and a saved quote load and behave as before this phase.
result: pass

### 9. Prohibition sign-off: the refresh token never reaches the browser readably
expected: Not in a URL, a response body, a non-httpOnly cookie or document.cookie. Verifier's non-authoritative judgment: PASS (callback sets only the sealed JWE in an httpOnly cookie; tokenResponse drops the rotated refresh token; no tracker-rt code is client-side; logs carry codes only). Tests 1–4 give you the evidence to sign this off.
result: pass

### 10. Both sign-in requests send openid email profile offline_access
expected: Both sign-in requests send openid email profile offline_access
result: pass
source: automated
coverage_id: 12-01/D1

### 11. Callback seals the refresh token with the session sub and sets tracker_rt beside access_token
expected: The callback seals the refresh token with the session sub into a dir/A256GCM JWE and sets tracker_rt beside access_token on the redirect
result: pass
source: automated
coverage_id: 12-01/D2

### 12. tracker_rt attributes and JWE exp
expected: tracker_rt attributes (httpOnly, SameSite=Lax, 7 days, /api/tracker, Secure in production) and a JWE exp 7 days after iat
result: pass
source: automated
coverage_id: 12-01/D3

### 13. Sign-out deletes tracker_rt on its path
expected: Sign-out deletes tracker_rt on its path
result: pass
source: automated
coverage_id: 12-01/D4

### 14. Sign-in unchanged on key/session/refresh-token/size failures
expected: Sign-in is unchanged when the key is unset or malformed, the session has no sub, Entra sends no refresh token, or the cookie is too large
result: pass
source: automated
coverage_id: 12-01/D5

### 15. POST /api/tracker/token exists, force-dynamic, no-store
expected: POST /api/tracker/token exists with force-dynamic and answers through tokenResponse / tokenErrorResponse with no-store
result: pass
source: automated
coverage_id: 12-02/D1

### 16. Missing or expired session or missing tracker_rt is 401 reauth
expected: No session, an expired session or a missing tracker_rt is 401 reauth in JSON with no redirect and no network call
result: pass
source: automated
coverage_id: 12-02/D2

### 17. Bad tracker_rt cleared; unconfigured is 503; log carries only the code
expected: A bad tracker_rt is 401 reauth and cleared; unset scope or malformed key is 503 unconfigured before the session; the log carries only the code
result: pass
source: automated
coverage_id: 12-02/D3

### 18. Rotated refresh token re-sealed with the same sub
expected: A rotated refresh token is re-sealed with the same sub and re-set with trackerRtCookieOptions on the same 200
result: pass
source: automated
coverage_id: 12-02/D4

## Summary

total: 18
passed: 18
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
