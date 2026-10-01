# Phase 12: Refresh-token capture and token route - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A signed-in ACMI user's browser can get a tracker-scoped access token from its own origin. Phase 12 delivers, under `nextjs-project/`:
- `offline_access` in both the authorize request (`src/app/api/auth/login/azure/route.ts`) and the code exchange (`src/app/api/auth/callback/azure/route.ts`)
- an encrypted, httpOnly `tracker_rt` cookie set by the callback, scoped to `/api/tracker`
- `POST /api/tracker/token` (`src/app/api/tracker/token/route.ts`), which checks ACMI's session itself and redeems the refresh token with `redeemTrackerToken`
- `logoutAction` clearing `tracker_rt` alongside `access_token`
- one self-contained helper module holding the crypto, the session decode and the cookie options, plus `node:test` checks for it

No UI. The triggers, wrapper and theming are Phase 13. Nothing is pushed: the push to `main` is Phase 14.

Requirements: RT-01..05, TOKEN-01..04.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (settled before this discussion)
- Cookie attributes are fixed by RT-03: `httpOnly`, `secure` in production (`NODE_ENV === 'production'`, as `access_token` does), `sameSite: 'lax'`, `maxAge` 7 days, `path: '/api/tracker'`.
- The JWE is jose `EncryptJWT`, `dir` / `A256GCM`, keyed by `TRACKER_RT_KEY` (32 random bytes, base64url). `jose ^6.1.3` is already a dependency, so the phase adds **no package** (Phase 11 D-05, DEP-01).
- The route uses `redeemTrackerToken`, `tokenResponse`, `tokenErrorResponse` and `TrackerTokenError` from `@avora/tracker-client/server`, and reuses `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.
- Logging follows HR's route: `tracker-token: <code> <JSON entraCodes>`, or `unexpected`. Never a token, a secret or the error object's raw contents.
- `src/middleware.ts`'s matcher skips `/api`, so the route enforces the session itself (TOKEN-02). The middleware does not change.
- `export const dynamic = 'force-dynamic'` on the route, as HR has it.
- Sentence-style commit subjects, the repo's configured identity (`avoradevops`), the session's Co-Authored-By trailer, no push (Phase 11 D-16, D-17).

### Session gate
- **D-01:** The JWE payload is `{ rt, sub }`, not only `{ rt }`. `sub` is the ACMI user id taken from the FastAPI JWT the callback just received (`{ sub, role, exp }`, signed by FastAPI; Next.js decodes it without verifying, as `middleware.ts`'s `getRoleFromToken` does). — **Reversibility:** reversible — changing the payload only forces one `reauth` per user.
- **D-02:** The route decodes the `access_token` cookie without verifying it and returns `401 reauth` when it is missing, unparseable or past its `exp`. It then decrypts `tracker_rt` and returns `401 reauth` unless the JWE's `sub` equals the `access_token`'s `sub`. There is no network call to FastAPI. A refresh token can then never be redeemed under another user's session cookie.
- **D-03:** No `Origin` check, matching HR, Finance and MXT. `SameSite=Lax` plus no CORS headers already cover forged cross-site requests.

### Lifetime and rotation
- **D-04:** Every set of `tracker_rt` (at sign-in and on rotation) uses the same attributes: cookie `maxAge` 7 days **and** a JWE `exp` of now + 7 days. The lifetime slides on rotation. A JWE past `exp` fails to open and counts as `reauth`. It may outlive `access_token`, but D-02 refuses it once `access_token` has expired.
  - **2026-10-01 amendment (code review WR-01):** the slide is now capped at the sign-in session's `exp`. D-02 decodes `access_token` without verifying it, so a client can forge a far-future one, and D-02 alone did not bound a copied cookie. The JWE now carries `sexp` (the FastAPI session token's `exp`, read at sign-in), and every seal sets the JWE `exp` and the cookie `maxAge` to min(now + 7 days, `sexp`). A rotation re-seal keeps the original `sexp` instead of sliding past it, and a JWE with no `sexp` or an invalid one fails to open. FastAPI sets `access_token` only at sign-in, with a fixed 7-day exp, and never renews it, so an honest user loses nothing.
- **D-05:** When the route returns `reauth` because of `tracker_rt` itself (missing aside: it won't decrypt, it is past `exp`, or `sub` doesn't match), the same 401 response also expires `tracker_rt` (same name and path, `maxAge: 0`). When Entra itself answers `reauth` (for example `invalid_grant`), the cookie is left alone; the next sign-in overwrites it.
- **D-06:** On a successful redeem that returns a rotated `refreshToken`, the route re-seals it with the same `sub` and re-sets `tracker_rt` on the same 200 response (TOKEN-04). Note that `tokenResponse` returns a plain `Response`; the planner decides how to attach `Set-Cookie` to it.
- **D-07:** Every sign-in leaves `tracker_rt` either freshly set or deleted. When the callback can't set a new one (the key is unset or malformed, Entra sent no `refresh_token`, or sealing threw), it deletes any existing `tracker_rt` (path `/api/tracker`) on the redirect response. `access_token` and the redirect behave exactly as today (RT-05).
- **D-08:** A signed-in user without `tracker_rt` (a pre-deploy session, or one that signed in while the key was unset) gets `reauth`. For Phase 12 the documented way back is sign out, then sign in. `/login` redirects signed-in users to the dashboard, so the notice's "Sign in again" doesn't work on its own. See Deferred for the Phase 13 link idea.

### Bad key and failure isolation
- **D-09:** A `TRACKER_RT_KEY` that is set but doesn't decode (base64url) to exactly 32 bytes is treated as **no key**, in one shared key-parsing function. The callback skips the cookie (D-07 clears an old one), logs one line such as `tracker-rt: TRACKER_RT_KEY is malformed` with no value, and finishes sign-in. The route returns `503 unconfigured`, the same as an unset key or an unset `TRACKER_API_SCOPE`. The unconfigured check comes before the session gate, as in HR's route. There is no build-time or startup check.
- **D-10:** Sealing in the callback runs in its own try/catch, separate from the existing one, so any failure there only skips the cookie and never changes the sign-in outcome. The log line names the step, never the token or the error's payload.
- **D-11:** Entra consent for `offline_access`: **before** local UAT, the user confirms in the Entra portal that app `ac19614d-e6c8-4e6c-966f-2e6de3ee1516` has Microsoft Graph `offline_access` (delegated) with admin consent granted, adding it if it's missing. If the local sign-in still shows a consent screen or an `AADSTS65001` / `AADSTS90094` error, execution **stops and asks**. It doesn't click through and doesn't drop the scope. This must be a human checkpoint in the plan. Phase 14 SHIP-01 re-confirms it for production.

### Verification
- **D-12:** All logic lives in one self-contained helper (for example `src/lib/tracker-rt.ts`), imported by the callback, the route and `logoutAction`. It imports only `jose` (no `@/` aliases, no `next/*`), so `node --test` on Node 24 can import the `.ts` file directly. It holds:
  - key parsing (D-09)
  - `seal({ rt, sub })` and `open(jwe)` with `exp` (D-04)
  - the `access_token` decode (`sub`, `exp`) for D-02
  - the cookie name and an options constant, used by every set and delete
- **D-13:** New `node:test` files in `nextjs-project/tests/` (`rt-*.test.mjs`, same style as Phase 11's `dep0*-*.test.mjs`, run with `node --test "tests/*.test.mjs"`):
  - **Helper tests:** a seal/open round trip; the wrong key; past `exp`; a `sub` mismatch; a malformed or short key counted as unconfigured; an unparseable or expired `access_token`.
  - **Static checks:** both auth routes send `openid email profile offline_access`; the cookie options are `httpOnly`, `sameSite: 'lax'`, 7 days and path `/api/tracker`; `logoutAction` deletes `tracker_rt` with that path.

  This adds no npm test runner and no `test` script requirement. The existing 22 checks must still pass.
- **D-14:** Gates: `npm run build` passes; `npm run lint` adds nothing to the baseline (10 errors, 10 warnings); every `node --test` check passes; then the local UAT for success criteria 1–5.
- **D-15:** Local env: execution **prints** the key-generation one-liner (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) and the `TRACKER_API_SCOPE` value from `.env.example`. The **user** pastes both into `.env.local` and restarts `next dev`. Agents never read or write `.env*`. Local and production use different keys.
- **D-16:** Checking `aud` and `azp` locally (success criterion 2): the UAT step decodes the returned access token's claims in the browser and shows only `aud`, `azp`, `scp` and `exp`. The token string itself is never printed, pasted or logged.

### Commits
- **D-17:** One commit per plan, for example (1) the helper, the `offline_access` scope, cookie capture in the callback and logout, then (2) the token route and its tests. Each subject is sentence-style (`Tracker embed: …`), staged by file name. No push.

### Claude's Discretion
- The helper's file name and function names, within D-12.
- The exact log-line wording, within the never-a-token rule and HR's `tracker-token:` form for the route.
- How the plans split the work, within D-17's one-commit-per-plan.
- How `Set-Cookie` is attached to `tokenResponse` and `tokenErrorResponse` output (D-05, D-06).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec
- `C:/Projects/task-tracker/docs/superpowers/specs/2026-09-14-host-app-embeds-design.md`: "The token route (HR, Finance, MXT, ACMI)" (lines ~184–223), "acmi-app" (lines ~354–383), "Error handling", "Testing" and "Risks and open items" (the `TRACKER_RT_KEY` rotation note).

### Package
- `nextjs-project/node_modules/@avora/tracker-client/server/index.d.ts`: the `redeemTrackerToken` options (a missing `refreshToken` → `reauth` with no network call; a missing tenant, client, secret or scope → `unconfigured`), `RedeemedTrackerToken.refreshToken` (present on rotation), `tokenResponse`, `tokenErrorResponse`.
- `nextjs-project/node_modules/@avora/tracker-client/token/errors.js`: `TOKEN_MESSAGES` (the `reauth` text, "Sign in again to send a request.") and `TrackerTokenError.entraCodes` (numbers only).

### Reference implementation
- `C:/Projects/hr-app/nextjs-project/src/app/api/tracker/token/route.ts`: the route shape, the header comment style, `dynamic = "force-dynamic"`, the unconfigured check first, and the log line. ACMI differs: its session check is D-02 (HR relies on its middleware), and the refresh token comes from `tracker_rt`, not a next-auth JWT.

### Project
- `.planning/REQUIREMENTS.md`: RT-01..05, TOKEN-01..04.
- `.planning/ROADMAP.md`: Phase 12 success criteria 1–5.
- `.planning/PROJECT.md`: Constraints (secrets, `.env*` edited by the user, clean tree first, no push).
- `.planning/STATE.md`: Blockers/Concerns (jose already a dependency, the lint baseline, local UAT needs the user, the tracker's CORS for the local origin is unconfirmed).
- `.planning/phases/11-install-tracker-client-v10/11-CONTEXT.md`: commit conventions (D-16, D-17) and the `.env.example` values (D-10).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `jose ^6.1.3` is in `package.json`, but nothing under `src/` imports it yet. `EncryptJWT` and `jwtDecrypt`, and `base64url.decode` for the key, are all in jose.
- `src/lib/safe-next.ts` (`sanitizeNext`, `DEFAULT_NEXT`): the callback already uses it, and nothing about it changes.

### Established Patterns
- `src/app/api/auth/callback/azure/route.ts` sets `access_token` on the `NextResponse.redirect` with `httpOnly`, `secure: IS_PRODUCTION`, `sameSite: 'lax'`, `maxAge: 7 * 24 * 3600`, `path: '/'`. `tracker_rt` is set and deleted on that same response. `tokens.refresh_token` is in the parsed token response, and the FastAPI JWT is `token` from `apiRes.json()`.
- Errors in the callback go through `loginRedirect(req, code, next)` and `console.error('[azure-callback] …')`. The existing outer try/catch wraps everything (D-10 adds a separate inner one).
- `src/app/actions/auth.ts` `logoutAction` is `cookieStore.delete('access_token'); redirect('/login')`. `tracker_rt` needs a delete that carries the path, for example `cookieStore.delete({ name: 'tracker_rt', path: '/api/tracker' })`.
- The FastAPI JWT payload is `{ sub: str(user_id), role, exp }` (`fastapi-project/app/auth/service.py:20`). `middleware.ts` decodes it with `atob(token.split('.')[1])` and doesn't verify it.
- `nextjs-project/tests/*.test.mjs` use `node:test` and `node:assert/strict` and resolve `ROOT` from `import.meta.url`. There is no `test` script in `package.json`.

### Integration Points
- `src/app/api/` has only `auth/login/azure` and `auth/callback/azure` today. `src/app/api/tracker/token/route.ts` is new.
- Logout is called from `Sidebar.tsx` (lines ~151 and ~164) and `TopBar.tsx`, all through the one `logoutAction`. Only that action changes.
- The callback already has a `refresh_token` once `offline_access` is in the code-exchange scope. Nothing else in the app reads the token response.

</code_context>

<specifics>
## Specific Ideas

- ACMI is the first app to keep the refresh token in a cookie of its own; HR, Finance and MXT keep it in a next-auth JWT. Where the decisions above go beyond the spec (the `sub` binding, the JWE `exp`, deleting a bad cookie, the callback always setting or clearing), they are deliberate ACMI hardening, not drift from the siblings.
- Local UAT needs a real Entra refresh token, so the D-11 portal check is a precondition, not an afterthought.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 13:** the `reauth` notice (or the wrapper around it) could link to `/api/auth/login/azure?next=<current path>`. That route is outside the middleware matcher, so it re-runs sign-in for an already signed-in user. Users without `tracker_rt` could then recover without signing out (D-08). This is a Phase 13 decision; Phase 12 changes nothing about it.

</deferred>

---

*Phase: 12-refresh-token-capture-and-token-route*
*Context gathered: 2026-10-01*
