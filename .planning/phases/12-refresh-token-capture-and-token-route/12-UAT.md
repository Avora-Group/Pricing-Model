---
status: testing
phase: 12-refresh-token-capture-and-token-route
source: [12-VERIFICATION.md]
started: 2026-10-01T13:20:00Z
updated: 2026-10-01T13:20:00Z
---

## Current Test

number: 1
name: SC1 live cookie attributes
expected: |
  After a fresh local sign-in at http://localhost:3001, devtools > Application > Cookies shows tracker_rt as
  HttpOnly, SameSite=Lax, Path=/api/tracker, with a ~7-day expiry. Its value is a 5-segment JWE starting
  eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0.. ; `document.cookie` in the console does not list it, and it is not
  sent with ordinary page requests.
awaiting: user response

## Tests

Local setup: `next dev` on http://localhost:3001, FastAPI on :8079 (API_URL / NEXT_PUBLIC_API_URL point there).
Never paste a token, cookie value or key into a reply.

### 1. SC1 live cookie attributes
expected: tracker_rt is HttpOnly, SameSite=Lax, Path=/api/tracker, ~7-day expiry; value is a dir/A256GCM JWE; `document.cookie` does not list it; it is not sent with ordinary page requests.
result: [pending]

### 2. SC2 live token from a signed-in tab
expected: `fetch('/api/tracker/token', { method: 'POST' })` returns 200 with only `{ accessToken, expiresAt }` and `Cache-Control: no-store`. Decoded at jwt.ms, the token's aud is 86fcee80-55d8-4992-937e-af37620ed7f9 and azp is ac19614d-e6c8-4e6c-966f-2e6de3ee1516. When Entra rotated the refresh token, the response carries a Set-Cookie for tracker_rt with the same attributes.
result: [pending]

### 3. SC4 key-unset sign-in and sign-out
expected: With TRACKER_RT_KEY unset (restart next dev), sign-in still sets access_token and lands on the dashboard, and no new tracker_rt is set (an existing one is expired). Signing out removes both access_token and tracker_rt. Restore the key afterwards.
result: [pending]

### 4. SC5 dashboard pages after sign-in
expected: Dashboard, Calculation and quotes load and behave as before.
result: [pending]

### 5. Prohibition sign-off: the refresh token never reaches the browser readably
expected: Not in a URL, a response body, a non-httpOnly cookie or document.cookie. Verifier's non-authoritative judgment: PASS (callback sets only the sealed JWE in an httpOnly cookie; tokenResponse drops the rotated refresh token; no tracker-rt code is client-side; logs carry codes only).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
