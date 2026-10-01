---
phase: "12"
slug: "refresh-token-capture-and-token-route"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-01"
---

# Phase 12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (12-01-PLAN.md, 12-02-PLAN.md). Verified at ASVS L1 (grep depth) after the 8 code-review fixes (7905685 … eac0d2d), the UAT (b732b5f, 18/18) and the Nyquist update (b23a8cf).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Entra -> Next.js callback (server) | The code exchange returns the user's refresh token to `/api/auth/callback/azure`; since WR-03 it is bound to an `azure_oauth` nonce + PKCE verifier | Secret (refresh token, auth code) |
| Next.js server -> browser | Only the sealed `dir`/`A256GCM` JWE crosses, in the httpOnly `tracker_rt` cookie scoped to `/api/tracker` | Ciphertext |
| Browser -> `POST /api/tracker/token` | Same-origin POST carrying `access_token` (unverified FastAPI JWT) and `tracker_rt` | Session + ciphertext |
| Next.js server -> Entra token endpoint | Refresh-token redeem for `TRACKER_API_SCOPE`, with ACMI's client secret | Secret |
| Token route -> browser | `{ accessToken, expiresAt }` only, `Cache-Control: no-store` | Tracker-scoped access token |
| Server env -> process | `TRACKER_RT_KEY`, `TRACKER_API_SCOPE`, `AZURE_CLIENT_SECRET`; none `NEXT_PUBLIC_` | Secret |
| Local `main` -> `origin/main` | A push deploys production on Vercel | Release control |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (evidence at HEAD) | Status |
|-----------|----------|-----------|----------|-------------|-------------------------------|--------|
| T-12-01 | Information Disclosure | `tracker_rt` read by page script | high | mitigate | `trackerRtCookieOptions` returns frozen `{ httpOnly: true, sameSite: 'lax', path: '/api/tracker' }` (tracker-rt.ts:53-58); UAT 2 confirmed `document.cookie` lacks it | closed |
| T-12-02 | Information Disclosure | Stolen `tracker_rt` used offline | high | mitigate | `dir`/`A256GCM` under a server-only 32-byte key; `requiredClaims: ['exp']` (tracker-rt.ts:179-182); since WR-01 exp = min(now+7d, `sexp`) and `sexp` is sealed in (tracker-rt.ts:42-43, 143-147), so a copy cannot be renewed past the original session | closed |
| T-12-03 | Information Disclosure | Refresh token in callback logs | high | mitigate | Capture in its own `try { } catch { }` with no binding (callback route.ts:142-150); log lines are `TRACKER_RT_SKIP_MESSAGES` text only (route.ts:149,153); IN-05 removed id_token claims and Entra's raw body from logs (route.ts:90,107) | closed |
| T-12-04 | Tampering | Forged/altered `tracker_rt`, alg confusion | medium | mitigate | `jwtDecrypt` allowlists `['dir']`/`['A256GCM']` (tracker-rt.ts:180-181); failure → reauth + clear (`checkTrackerRt` returns `clear: true`, tracker-rt.ts:234) | closed |
| T-12-05 | Denial of Service | Sign-in broken by embed config | high | mitigate | Malformed key = no key (`parseTrackerRtKey` → null); capture isolated; `applyTrackerRt` deletes on any skip; UAT 7 confirmed key-unset sign-in works (and the openssl-key incident in UAT 2 showed a bad key degrades to "unconfigured", not a broken sign-in) | closed |
| T-12-06 | Elevation of Privilege | User A's `tracker_rt` under user B's session | medium | mitigate | `opened.sub !== sub` → `{ ok: false, clear: true }` (tracker-rt.ts:234); every sign-in sets or deletes, sign-out deletes; route test "a tracker_rt for another user is reauth and cleared" | closed |
| T-12-07 | Information Disclosure | Delete misses the path / 7-day empty cookie | medium | mitigate | Single frozen `TRACKER_RT_DELETE = { name, path }` (tracker-rt.ts:68); UAT 7 saw the delete on Path=/api/tracker | closed |
| T-12-08 | Information Disclosure | `TRACKER_RT_KEY` exposure | high | mitigate | Read only in callback route.ts:144 and via `env` in tracker-token.ts:53; no `NEXT_PUBLIC_` variant; helpers read only `NODE_ENV` from env; no 43-char base64url string in SUMMARYs or UAT | closed |
| T-12-09 | Elevation of Privilege | Push of local commits (12-01) | high | mitigate | origin/main still 7c9993d (fetched 2026-10-01); 3f5b334, 7905685, 640adbf are not ancestors of origin/main | closed |
| T-12-10 | Repudiation | Commit authorship | low | mitigate | All 21 commits since d4c9cf3 authored `avoradevops <devops@avora.aero>` | closed |
| T-12-SC | Tampering | npm installs (both plans) | high | mitigate | `git diff d4c9cf3 HEAD -- nextjs-project/package.json nextjs-project/package-lock.json` is empty | closed |
| T-12-11 | Spoofing | Cross-site forgery of the token POST | medium | mitigate | Both cookies SameSite=Lax; no `Access-Control-*` header in route.ts or tracker-token.ts; static test `token route never redirects and sends no CORS headers` | closed |
| T-12-12 | Information Disclosure | Access token cached | high | mitigate | Package `HEADERS` carry `Cache-Control: no-store` (tracker-client server/index.js:82); `withCookies` reuses the Response init; `dynamic = 'force-dynamic'` (route.ts:37); UAT 3/4 saw `no-store` on 200 and 401 | closed |
| T-12-13 | Information Disclosure | Rotated refresh token sent to browser | high | mitigate | `tokenResponse` serializes only `{ accessToken, expiresAt }` (server/index.js:85-86); rotated token goes only into `sealTrackerRtCookie` (tracker-token.ts:87) | closed |
| T-12-14 | Elevation of Privilege | Request chooses scope/resource | high | mitigate | Route reads only the two cookies (route.ts:43-44); scope only from `env.TRACKER_API_SCOPE` (tracker-token.ts:52) | closed |
| T-12-15 | Spoofing | Forged `access_token` + stolen `tracker_rt` | medium | accept | See Accepted Risks AR-12-01. Narrowed by WR-01: a forged far-future `access_token` can no longer extend the cookie (route test "a forged far-future session cannot push the rotated cookie past the sign-in deadline") | closed |
| T-12-16 | Information Disclosure | Tokens or secrets in route logs | high | mitigate | Two log sites only: fixed `reseal skipped, <step>` (tracker-token.ts:89) and code + numeric Entra codes (tracker-token.ts:100-103); route tests assert no token/secret/key in logs; UAT 4 confirmed the dev log | closed |
| T-12-17 | Denial of Service | Entra outage / throttling | low | accept | See Accepted Risks AR-12-02 | closed |
| T-12-18 | Information Disclosure | Token pasted into chat/UAT notes | high | mitigate | UAT snippets printed only status, cache-control, keys and `aud`/`azp`/`scp`/`exp`; 12-UAT.md contains no token or key | closed |
| T-12-19 | Tampering | Consent worked around (D-11) | medium | mitigate | 12-02 Task 3 blocking-human checkpoint passed with no consent screen; both auth routes still request `offline_access` (static test `both sign-in requests ask for offline_access`) | closed |
| T-12-20 | Information Disclosure | Smoke server leaks real env | low | mitigate | rt-route-smoke.mjs pins `TRACKER_API_SCOPE`, `TRACKER_RT_KEY`, Azure ids and a blank `AZURE_CLIENT_SECRET` (lines 48-56) | closed |
| T-12-21 | Information Disclosure | `TRACKER_RT_KEY` printed during D-15 | high | mitigate | No 43-char base64url string in 12-0*-SUMMARY.md or 12-UAT.md; the user generated the key | closed |
| T-12-22 | Elevation of Privilege | Push of local commits (12-02) | high | mitigate | ecfd5fc not an ancestor of origin/main; main is 52 ahead, unpushed | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Beyond the plan-time register (from 12-REVIEW, now fixed):** WR-03 login CSRF / code injection — closed by an `azure_oauth` nonce cookie on the callback path, `state = nonce.next`, PKCE S256 and a constant-time nonce match (src/lib/oauth-flow.ts, commit 640adbf); UAT 1, 5 and 6 confirmed S256 + nonce state reach Entra, deep links survive, and a replayed callback ends at `azure_failed`. WR-02 oversized rotated cookie — closed by the shared `sealTrackerRtCookie` size guard (5bdc955).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-12-01 | T-12-15 | Next.js holds no FastAPI signing secret, so `access_token` is decoded, not verified; the `sub` match is a consistency check. Stealing `tracker_rt` already needs a compromised browser (httpOnly, path-scoped, encrypted), and since WR-01 its life is capped at the original session `exp` regardless of the presented `access_token`. | Plan 12-02 threat model (user-approved plan) | 2026-10-01 |
| AR-12-02 | T-12-17 | An Entra outage maps to 502 `unavailable` with the cookie kept; Phase 13's notice reports it. No retry loop by design. | Plan 12-02 threat model (user-approved plan) | 2026-10-01 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-01 | 22 | 22 | 0 | Claude (secure-phase, ASVS L1 grep depth; auditor short-circuited: register authored at plan time, threats_open 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-01
