# Phase 12: Refresh-token capture and token route - Research

**Researched:** 2026-10-01
**Domain:** Next.js 16 route handlers and cookies, jose JWE (`dir` / `A256GCM`), Entra refresh-token redemption via `@avora/tracker-client/server`
**Confidence:** HIGH. Every library behaviour below was checked against the installed code in `nextjs-project/node_modules` this session, most of it by running it.

## Summary

Phase 12 needs no new package. Everything it uses is already installed and was exercised this session:
- **jose 6.1.3** (installed and locked) provides `EncryptJWT`, `jwtDecrypt`, `decodeJwt` and `base64url`.
- **Next 16.1.6** provides `NextResponse` and `ResponseCookies`.
- **`@avora/tracker-client` 10.0.0** provides `redeemTrackerToken`, `tokenResponse`, `tokenErrorResponse` and `TrackerTokenError`.
- **Node v24.15.0** strips types by default, so `node --test` can import a `.ts` helper that imports only `jose`, with no flag. Tested this session in a scratch copy, with `node_modules` linked to the project's.

Three things are easy to get wrong, and each was reproduced this session:
1. **Deleting a cookie.**
   - `ResponseCookies.delete()` turns its options into a `set()`. Pass it an options object that still holds `maxAge: 604800` and it writes a **7-day cookie with an empty value** instead of deleting one.
   - A delete with no `path` defaults to `Path=/`, so it misses the `/api/tracker` cookie entirely.
   - Every delete must pass `{ name: 'tracker_rt', path: '/api/tracker' }` and nothing else.
2. **`jwtDecrypt` accepts a JWE with no `exp`** unless you pass `requiredClaims: ['exp']`.
3. **`base64url.decode` is lenient.**
   - It throws on some malformed input but returns an empty array for `""` and accepts padded or standard-alphabet base64.
   - Key parsing therefore needs both a `try/catch` and a `length === 32` check.

`tokenResponse` and `tokenErrorResponse` return plain `Response` objects with mutable headers. Wrapping one with `new NextResponse(res.body, res)` keeps its status, `Content-Type` and `Cache-Control: no-store` (verified), and gives `out.cookies.set/delete`, the same API the callback already uses.

**Primary recommendation:**
- Put all logic in one helper, `src/lib/tracker-rt.ts`, that imports only `jose`. It holds key parsing, seal/open, the `access_token` decode, the cookie constants and a pure `checkTrackerRt()` decision function.
- Keep the route, callback and `logoutAction` as thin wiring around it.
- Test the helper with `node --test` and the wiring with static checks.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Requesting `offline_access` (authorize + code exchange) | Frontend Server (Next route handlers `api/auth/*`) | — | ACMI runs its own OAuth code flow server-side; Entra is called only from the server |
| Sealing the refresh token into `tracker_rt` | Frontend Server (callback route) | — | Needs `TRACKER_RT_KEY` (server-only secret); the browser only ever holds ciphertext in an httpOnly cookie |
| Session gate for the token route | Frontend Server (token route) | — | `src/middleware.ts` matcher excludes `/api`, so the route enforces the session itself (TOKEN-02) |
| Redeeming the refresh token for a tracker token | Frontend Server (token route) → Entra | — | Confidential-client redemption needs `AZURE_CLIENT_SECRET`; never in the browser |
| Clearing cookies at sign-out | Frontend Server (server action `logoutAction`) | — | httpOnly cookies can only be cleared by a `Set-Cookie` from the server |
| Calling the tracker API with the access token | Browser (Phase 13) | — | Out of scope here: Phase 12 delivers only the same-origin token endpoint |
| FastAPI session JWT (`access_token`) | API / Backend (FastAPI) | Frontend Server (decoded, not verified) | FastAPI signs it; Next.js only decodes `sub` and `exp` (D-01, D-02) |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward (settled before this discussion)
- Cookie attributes are fixed by RT-03: `httpOnly`, `secure` in production (`NODE_ENV === 'production'`, as `access_token` does), `sameSite: 'lax'`, `maxAge` 7 days, `path: '/api/tracker'`.
- The JWE is jose `EncryptJWT`, `dir` / `A256GCM`, keyed by `TRACKER_RT_KEY` (32 random bytes, base64url). `jose ^6.1.3` is already a dependency, so the phase adds **no package** (Phase 11 D-05, DEP-01).
- The route uses `redeemTrackerToken`, `tokenResponse`, `tokenErrorResponse` and `TrackerTokenError` from `@avora/tracker-client/server`, and reuses `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.
- Logging follows HR's route: `tracker-token: <code> <JSON entraCodes>`, or `unexpected`. Never a token, a secret or the error object's raw contents.
- `src/middleware.ts`'s matcher skips `/api`, so the route enforces the session itself (TOKEN-02). The middleware does not change.
- `export const dynamic = 'force-dynamic'` on the route, as HR has it.
- Sentence-style commit subjects, the repo's configured identity (`avoradevops`), the session's Co-Authored-By trailer, no push (Phase 11 D-16, D-17).

#### Session gate
- **D-01:** The JWE payload is `{ rt, sub }`, not only `{ rt }`. `sub` is the ACMI user id taken from the FastAPI JWT the callback just received (`{ sub, role, exp }`, signed by FastAPI; Next.js decodes it without verifying, as `middleware.ts`'s `getRoleFromToken` does). — **Reversibility:** reversible — changing the payload only forces one `reauth` per user.
- **D-02:** The route decodes the `access_token` cookie without verifying it and returns `401 reauth` when it is missing, unparseable or past its `exp`. It then decrypts `tracker_rt` and returns `401 reauth` unless the JWE's `sub` equals the `access_token`'s `sub`. There is no network call to FastAPI. A refresh token can then never be redeemed under another user's session cookie.
- **D-03:** No `Origin` check, matching HR, Finance and MXT. `SameSite=Lax` plus no CORS headers already cover forged cross-site requests.

#### Lifetime and rotation
- **D-04:** Every set of `tracker_rt` (at sign-in and on rotation) uses the same attributes: cookie `maxAge` 7 days **and** a JWE `exp` of now + 7 days. The lifetime slides on rotation. A JWE past `exp` fails to open and counts as `reauth`. It may outlive `access_token`, but D-02 refuses it once `access_token` has expired.
- **D-05:** When the route returns `reauth` because of `tracker_rt` itself (missing aside: it won't decrypt, it is past `exp`, or `sub` doesn't match), the same 401 response also expires `tracker_rt` (same name and path, `maxAge: 0`). When Entra itself answers `reauth` (for example `invalid_grant`), the cookie is left alone; the next sign-in overwrites it.
- **D-06:** On a successful redeem that returns a rotated `refreshToken`, the route re-seals it with the same `sub` and re-sets `tracker_rt` on the same 200 response (TOKEN-04). Note that `tokenResponse` returns a plain `Response`; the planner decides how to attach `Set-Cookie` to it.
- **D-07:** Every sign-in leaves `tracker_rt` either freshly set or deleted. When the callback can't set a new one (the key is unset or malformed, Entra sent no `refresh_token`, or sealing threw), it deletes any existing `tracker_rt` (path `/api/tracker`) on the redirect response. `access_token` and the redirect behave exactly as today (RT-05).
- **D-08:** A signed-in user without `tracker_rt` (a pre-deploy session, or one that signed in while the key was unset) gets `reauth`. For Phase 12 the documented way back is sign out, then sign in. `/login` redirects signed-in users to the dashboard, so the notice's "Sign in again" doesn't work on its own. See Deferred for the Phase 13 link idea.

#### Bad key and failure isolation
- **D-09:** A `TRACKER_RT_KEY` that is set but doesn't decode (base64url) to exactly 32 bytes is treated as **no key**, in one shared key-parsing function. The callback skips the cookie (D-07 clears an old one), logs one line such as `tracker-rt: TRACKER_RT_KEY is malformed` with no value, and finishes sign-in. The route returns `503 unconfigured`, the same as an unset key or an unset `TRACKER_API_SCOPE`. The unconfigured check comes before the session gate, as in HR's route. There is no build-time or startup check.
- **D-10:** Sealing in the callback runs in its own try/catch, separate from the existing one, so any failure there only skips the cookie and never changes the sign-in outcome. The log line names the step, never the token or the error's payload.
- **D-11:** Entra consent for `offline_access`: **before** local UAT, the user confirms in the Entra portal that app `ac19614d-e6c8-4e6c-966f-2e6de3ee1516` has Microsoft Graph `offline_access` (delegated) with admin consent granted, adding it if it's missing. If the local sign-in still shows a consent screen or an `AADSTS65001` / `AADSTS90094` error, execution **stops and asks**. It doesn't click through and doesn't drop the scope. This must be a human checkpoint in the plan. Phase 14 SHIP-01 re-confirms it for production.

#### Verification
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

#### Commits
- **D-17:** One commit per plan, for example (1) the helper, the `offline_access` scope, cookie capture in the callback and logout, then (2) the token route and its tests. Each subject is sentence-style (`Tracker embed: …`), staged by file name. No push.

### Claude's Discretion
- The helper's file name and function names, within D-12.
- The exact log-line wording, within the never-a-token rule and HR's `tracker-token:` form for the route.
- How the plans split the work, within D-17's one-commit-per-plan.
- How `Set-Cookie` is attached to `tokenResponse` and `tokenErrorResponse` output (D-05, D-06).

### Deferred Ideas (OUT OF SCOPE)
- **Phase 13:** the `reauth` notice (or the wrapper around it) could link to `/api/auth/login/azure?next=<current path>`. That route is outside the middleware matcher, so it re-runs sign-in for an already signed-in user. Users without `tracker_rt` could then recover without signing out (D-08). This is a Phase 13 decision; Phase 12 changes nothing about it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-01 | Both sign-in requests send `openid email profile offline_access` | Exact lines: login route L18, callback L49 (see "Current code") |
| RT-02 | Callback sets `tracker_rt` = `EncryptJWT` (`dir`/`A256GCM`) under `TRACKER_RT_KEY` when Entra returns `refresh_token` | jose seal and open verified (Pattern 1). The payload is `{ rt, sub }` per D-01 |
| RT-03 | Cookie `httpOnly`, `secure` in prod, `sameSite: 'lax'`, 7 d, `path: '/api/tracker'` | Next serializer output verified: `Path=/api/tracker; Expires=…; Max-Age=604800; HttpOnly; SameSite=lax` |
| RT-04 | `logoutAction` clears `tracker_rt` with the same path | Server-action `cookies().delete({ name, path })` goes through `ResponseCookies.delete` (verified). Pitfall 1: the delete must not include `maxAge` |
| RT-05 | Sign-in unaffected when unconfigured or no `refresh_token` | Inner try/catch (D-10). `parseTrackerRtKey` returns null for unset or malformed keys. Delete on the redirect (D-07) |
| TOKEN-01 | `POST /api/tracker/token` redeems → `200 { accessToken, expiresAt }`, `no-store` | `redeemTrackerToken` / `tokenResponse` source quoted below. The NextResponse wrap keeps `no-store` (verified) |
| TOKEN-02 | Route enforces session itself → `401 reauth` without `access_token` | Middleware matcher excludes `/api` (L52). `decodeJwt` + `exp` check in the helper |
| TOKEN-03 | Errors map through `tokenErrorResponse`; log only code + numeric Entra codes | `STATUS` map and `classify()` quoted. Copy HR's log line, not the spec snippet's (Pitfall 6) |
| TOKEN-04 | Rotated refresh token re-set with the RT-03 attributes on the same response | `RedeemedTrackerToken.refreshToken` is "Present when Entra rotated". Entra rotates on every use (cited), so expect a re-set on nearly every 200 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

There is no `CLAUDE.md` in `C:/Projects/acmi-app` and no `.claude/skills/` or `.agents/skills/` (checked by glob this session). The binding constraints come from `.planning/PROJECT.md` and `STATE.md` instead:
- No push. Phases 11–13 are local commits only.
- Clean tree first: check `git status` before any commit. A dirty tree means stop and ask.
- `.env*` files are edited by the user. Agents never read or write them, except the tracked `.env.example`.
- The refresh token never reaches a page script or a log line.
- Work only under `nextjs-project/`. FastAPI does not change.

## Standard Stack

### Core (all already installed — no install step)
| Library | Version (installed) | Purpose | Evidence |
|---------|---------|---------|--------------|
| jose | 6.1.3 | `EncryptJWT`, `jwtDecrypt`, `decodeJwt`, `base64url` | [VERIFIED: `node_modules/jose/package.json` `"version": "6.1.3"`; `package-lock.json` L5212-5214 `"node_modules/jose": { "version": "6.1.3", "resolved": "https://registry.npmjs.org/jose/-/jose-6.1.3.tgz"`]. ESM only (`"type": "module"`); `.` export → `./dist/webapi/index.js` |
| next | 16.1.6 | Route handlers, `NextResponse`, `ResponseCookies`, `cookies()` | [VERIFIED: `package.json` `"next": "16.1.6"`, `node_modules/next/package.json` `"version": "16.1.6"`] |
| @avora/tracker-client | 10.0.0 (`#v10`, a369f81) | `redeemTrackerToken`, `tokenResponse`, `tokenErrorResponse`, `TrackerTokenError` from `@avora/tracker-client/server` | [VERIFIED: `node_modules/@avora/tracker-client/package.json` `"version": "10.0.0"`, exports `"./server": { "types": "./server/index.d.ts", "default": "./server/index.js" }`] |
| Node.js | v24.15.0 | `node --test` with type stripping on by default | [VERIFIED: `node --version` → `v24.15.0`] |

Note: two figures I was asked to include, "jose 6.2.3" and "Node 24.13.0", do not match this machine. The installed jose is 6.1.3 and the local Node is v24.15.0, each confirmed twice this session. This document uses the observed values.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `new NextResponse(res.body, res)` to attach cookies | `(await cookies()).set(...)` in the route, returning the plain `Response` | Also works in 16.1.6 (see Pattern 3), but it is implicit merging and is not the API the callback uses. Pick one; the wrap is recommended |
| `new NextResponse(...)` wrap | `res.headers.append('Set-Cookie', stringifyCookie(...))` | Works (verified), but `stringifyCookie` comes from `next/dist/compiled/...`, an internal path. Avoid it |
| jose `decodeJwt` for `access_token` | `JSON.parse(atob(token.split('.')[1]))` as in middleware | `atob` does not handle base64url `-`/`_`. It works today only because FastAPI's payload happens to encode without them. `decodeJwt` handles base64url and rejects malformed input with `JWTInvalid` |

**Installation:** none. `package.json` and `package-lock.json` must not change (DEP-01).

## Package Legitimacy Audit

No package is installed by this phase. `jose` and `@avora/tracker-client` were already vetted and locked in Phase 11.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none added) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Current code — exact lines the plans touch

All files below were read this session.

**`src/app/api/auth/login/azure/route.ts` L18** [VERIFIED: read]
```ts
    scope: 'openid email profile',
```
→ becomes `scope: 'openid email profile offline_access',`. Nothing else in the file changes.

**`src/app/api/auth/callback/azure/route.ts`** [VERIFIED: read, L1-108]
- L9: `const IS_PRODUCTION = process.env.NODE_ENV === 'production'`
- L49 (inside the code-exchange `URLSearchParams`): `          scope: 'openid email profile',` becomes `… offline_access`.
- L60: `    const tokens = await tokenRes.json()`. `tokens.refresh_token` will be present once the scope includes `offline_access`.
- L92-103, where the new code goes, after `access_token` is set and before `return response`:
```ts
    const { token } = await apiRes.json()

    // Set the JWT cookie on the redirect response directly
    const response = NextResponse.redirect(new URL(next, req.url))
    response.cookies.set('access_token', token, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      path: '/',
    })
    return response
```
- L104-107, the outer catch: `console.error('[azure-callback] Unexpected error:', e)`. It logs the **raw error object**, which is why D-10's inner try/catch must not let sealing errors reach it.

**`src/app/actions/auth.ts` L1-9** [VERIFIED: read]
```ts
'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  redirect('/login')
}
```

**`src/middleware.ts`** [VERIFIED: read]
- L52: `  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],`. `/api/tracker/token` never runs through middleware. No change.
- L8-15 `getRoleFromToken` decodes with `atob(token.split('.')[1])` and does not verify.

**FastAPI JWT shape.** `fastapi-project/app/auth/service.py` L19-23 [VERIFIED: read]:
```py
def create_access_token(user_id: int, role: str) -> str:
    """Create a signed JWT with sub=str(user_id), role, and 7-day expiry."""
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```
`sub` is a string. `exp` is serialized by PyJWT as numeric epoch seconds. A probe decoding a token of this shape with `decodeJwt` returned `{"sub":"7","role":"admin","exp":1790857844}`.

**`.env.example`** [VERIFIED: read] already declares `TRACKER_API_SCOPE=` with the comment `# Value: api://86fcee80-55d8-4992-937e-af37620ed7f9/access_as_user`, and `TRACKER_RT_KEY=` with the generator `node -p "require('crypto').randomBytes(32).toString('base64url')"`. It needs no edit.

**`src/lib/`** has no `jose` import today, so `src/lib/tracker-rt.ts` is a new file. `src/lib/session.ts` starts with `import 'server-only'`. The new helper must **not** copy that line (Pitfall 4).

## `@avora/tracker-client/server`: exact API

From `node_modules/@avora/tracker-client/server/index.d.ts` L4-35 [VERIFIED: read]:
```ts
export interface RedeemTrackerTokenOptions {
  /** Missing → 'unconfigured', no network call. */
  tenantId: string | undefined;
  /** Missing → 'unconfigured', no network call. */
  clientId: string | undefined;
  /** Server-side only. Never logged, never returned, never in an error. Missing → 'unconfigured', no network call. */
  clientSecret: string | undefined;
  /** The user's Entra refresh token, as the host stores it. Missing → 'reauth'. */
  refreshToken: string | undefined | null;
  /** api://<tracker-client-id>/access_as_user — offline_access is appended. Missing → 'unconfigured', no network call. */
  scope: string | undefined;
  fetch?: typeof fetch;
  /** Milliseconds since epoch. A test hook; defaults to Date.now. */
  now?: () => number;
}
export interface RedeemedTrackerToken {
  accessToken: string;
  /** Epoch seconds. */
  expiresAt: number;
  /** Present when Entra rotated the refresh token. */
  refreshToken?: string;
}
/** Rejects with TrackerTokenError. */
export declare function redeemTrackerToken(options: RedeemTrackerTokenOptions): Promise<RedeemedTrackerToken>;
/** 200 { accessToken, expiresAt }, Cache-Control: no-store. */
export declare function tokenResponse(result: { accessToken: string; expiresAt: number }): Response;
/** 401 reauth · 403 consent · 503 config/unconfigured · 502 unavailable — body { error }, no-store. */
export declare function tokenErrorResponse(error: unknown): Response;
```

Runtime, from `server/index.js` [VERIFIED: read]:
- **L40-41.** `if (!tenantId || !clientId || !clientSecret || !scope) throw new TrackerTokenError('unconfigured');` then `if (!refreshToken) throw new TrackerTokenError('reauth');`. An empty-string env var (a blank `TRACKER_API_SCOPE=` line in `.env.local`) is therefore also `unconfigured`.
- **L55.** `scope: \`${scope} offline_access\``: the package asks Entra for a rotated refresh token.
- **L16-17, 24-34 (`classify`).**
  - `65001` or `consent_required` → `consent`.
  - `invalid_client` / `unauthorized_client` / `invalid_scope` → `config`.
  - `invalid_grant` / `interaction_required` → `reauth`.
  - 429 or `temporarily_unavailable` → `unavailable`.
  - Any other named 4xx error → `config`.
  - Anything else → `unavailable`.
- **L77.** `if (typeof body.refresh_token === 'string') result.refreshToken = body.refresh_token;`
- **L81-82.** `const STATUS = { reauth: 401, consent: 403, config: 503, unconfigured: 503, unavailable: 502 };` and `const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };`
- **L85-93.** Both helpers return `new Response(JSON.stringify(...), { status, headers: HEADERS })`, a plain `Response` whose headers can be changed. `tokenErrorResponse` maps anything that is not a `TrackerTokenError` to `unavailable` (502).

From `token/errors.js` [VERIFIED: read]:
- **L8.** `export const TOKEN_ERROR_CODES = Object.freeze(['reauth', 'consent', 'config', 'unconfigured', 'unavailable']);`
- **L13.** `reauth: 'Your sign-in has expired. Sign in again to send a request.',`
- **L26-31.** `constructor(code, entraCodes = [])`. An unknown code becomes `'unavailable'`, and `this.entraCodes = Array.isArray(entraCodes) ? entraCodes.filter((n) => typeof n === 'number') : [];`

The browser getter (`token/index.js` L18-37, Phase 13's consumer) [VERIFIED: read]:
- It fetches with `method: 'POST', credentials: 'same-origin', redirect: 'manual', cache: 'no-store'`.
- A redirect, or a 401 without a known body code, is read as `reauth`.
- So the route must answer in JSON and never redirect. `tokenErrorResponse` already does both.

## Architecture Patterns

### System Architecture Diagram

```
SIGN-IN
Browser ──GET /api/auth/login/azure──► login route ──302──► Entra /authorize
                                         (scope: openid email profile offline_access)
Entra ──302 ?code&state──► callback route
   callback ──POST code (scope … offline_access)──► Entra /token ──► { id_token, refresh_token, … }
   callback ──POST /auth/azure──► FastAPI ──► { token }   (FastAPI JWT: sub, role, exp)
   callback builds 302 redirect:
      Set-Cookie access_token (path /)                       [unchanged]
      ┌─ inner try (D-10) ───────────────────────────────────────────────┐
      │ key = parseTrackerRtKey(TRACKER_RT_KEY)  → null if unset/malformed│
      │ sub = sessionSubject(token)                                       │
      │ rt  = tokens.refresh_token                                        │
      │ all present? ── yes ─► JWE = seal({rt, sub}) ─► Set-Cookie tracker_rt (path /api/tracker, 7 d)
      │              └─ no / threw ─► Set-Cookie tracker_rt= ; Expires=1970 (path /api/tracker)  (D-07)
      └───────────────────────────────────────────────────────────────────┘

TOKEN (Phase 13's dialog will call this; Phase 12 UAT calls it by hand)
Browser ──POST /api/tracker/token (cookies: access_token, tracker_rt)──► token route
   1. TRACKER_API_SCOPE empty OR parseTrackerRtKey()==null ──► 503 {error:"unconfigured"}
   2. checkTrackerRt({accessToken, trackerRt, key}):
        access_token missing/bad/expired ─────────────► 401 reauth            (cookie untouched)
        tracker_rt missing ───────────────────────────► 401 reauth            (cookie untouched)
        won't decrypt / past exp / sub ≠ session sub ─► 401 reauth + DELETE tracker_rt   (D-05)
        ok → { rt, sub }
   3. redeemTrackerToken({tenant, client, secret, refreshToken: rt, scope}) ──► Entra /token
        throws TrackerTokenError ─► log "tracker-token: <code> <entraCodes>" ─► tokenErrorResponse (cookie untouched)
        ok, result.refreshToken ─► seal({rt: result.refreshToken, sub}) ─► 200 + Set-Cookie tracker_rt (D-06)
        ok, no rotation ─────────► 200 {accessToken, expiresAt}, Cache-Control: no-store

SIGN-OUT
Browser ──server action──► logoutAction: delete access_token (path /), delete {tracker_rt, path /api/tracker} ─► 303 /login
```

### Recommended file layout
```
nextjs-project/
├── src/lib/tracker-rt.ts                    # NEW: imports only 'jose'; all logic + constants
├── src/app/api/tracker/token/route.ts       # NEW: thin wiring (POST, dynamic = 'force-dynamic')
├── src/app/api/auth/login/azure/route.ts    # EDIT: L18 scope
├── src/app/api/auth/callback/azure/route.ts # EDIT: L49 scope; seal + set/delete after L102
├── src/app/actions/auth.ts                  # EDIT: delete tracker_rt with path
└── tests/
    ├── rt-helper.test.mjs                   # NEW: imports ../src/lib/tracker-rt.ts
    └── rt-wiring.test.mjs                   # NEW: static checks on the 4 wired files
```

### Pattern 1: jose seal/open with `dir` / `A256GCM` (verified behaviour)

Ran against jose 6.1.3 on Node v24.15.0 this session [VERIFIED: probe output]:

| Case | Result |
|------|--------|
| `new EncryptJWT({rt,sub}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuedAt().setExpirationTime('7d').encrypt(key32)` | Compact JWE of 5 segments, the 2nd empty (no encrypted key with `dir`). The header decodes to `{"alg":"dir","enc":"A256GCM"}`, so every cookie value starts `eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..`. `exp - iat` = `604800` |
| round trip `jwtDecrypt(jwe, key32, {keyManagementAlgorithms:['dir'], contentEncryptionAlgorithms:['A256GCM']})` | `payload` `{"rt":"R","sub":"42","iat":…,"exp":…}`, `protectedHeader` `{"alg":"dir","enc":"A256GCM"}` |
| wrong 32-byte key | `JWEDecryptionFailed`, code `ERR_JWE_DECRYPTION_FAILED`, "decryption operation failed" |
| `exp` in the past | `JWTExpired`, `ERR_JWT_EXPIRED`, "\"exp\" claim timestamp check failed" |
| **no `exp` claim, default options** | **ACCEPTED**: payload `{"rt":"R"}` returned |
| no `exp`, `requiredClaims: ['exp']` | `JWTClaimValidationFailed`, `ERR_JWT_CLAIM_VALIDATION_FAILED`, "missing required \"exp\" claim" |
| `""`, `"garbage"` | `JWEInvalid`, `ERR_JWE_INVALID`, "Invalid Compact JWE" |
| `"a.b.c.d.e"` | `JWEInvalid`, "JWE Protected Header is invalid" |
| truncated or appended-to JWE | `JWEDecryptionFailed` |
| 16-byte key (encrypt **or** decrypt) | `JWEInvalid`, "Invalid Content Encryption Key length. Expected 256 bits, got 128 bits" |
| `instanceof errors.JOSEError` | `true` for jose's errors. The helper should still `catch {}` everything and return `null`, so even a non-jose `TypeError` becomes `reauth` |

`setExpirationTime` accepts a number (epoch seconds), a `Date` or a time-span string such as `'7d'` [VERIFIED: `dist/types/jwt/encrypt.d.ts` `setExpirationTime(input: number | string | Date): this;`]. `jwtDecrypt` checks `exp` against the current clock when the claim is present, with `clockTolerance` defaulting to 0, and `currentDate` is an option.

### Pattern 2: key parsing, where `base64url.decode` is lenient

jose's `base64url.decode` (from `dist/webapi/util/base64url.js`) [VERIFIED: read]:
- It uses `Uint8Array.fromBase64` when that exists. On Node v24.15.0 it does not (`typeof Uint8Array.fromBase64` → `undefined`), so the code falls back to `atob` after `replace(/-/g,'+').replace(/_/g,'/')`, wrapped in a `try` that throws `TypeError('The input to be decoded is not correctly encoded.')`.

Probe results [VERIFIED]:

| Input | Result |
|-------|--------|
| `""` | **no throw, length 0** |
| `"!!!!"`, `"a"`, a comma list | `TypeError` "The input to be decoded is not correctly encoded." |
| `"abc"` | no throw, length 2 |
| `"abc="` (padded) | no throw, length 2 |
| `"abcd+/=="` (standard alphabet) | no throw, length 4 |
| a real 43-char base64url key | length 32 |

So the parser must `try/catch` **and** check `length === 32`, and treat `undefined` and `""` as no key. A runtime that has `Uint8Array.fromBase64`, such as a future Vercel Node, is stricter: it rejects `+` and `/` under the base64url alphabet. Generate keys with `base64url`, as `.env.example` says, and the difference never matters.

### Pattern 3: attaching `Set-Cookie` in Next 16.1.6

Facts [VERIFIED: read `node_modules/next/dist/compiled/@edge-runtime/cookies/index.js` and `index.d.ts`; behaviour run in Node]:
- `ResponseCookies` keys cookies by **name only** (`this._parsed.set(parsed.name, parsed)`). Every `set` or `delete` rewrites all `set-cookie` headers from that map (`function replace(bag, headers) { headers.delete("set-cookie"); … headers.append("set-cookie", serialized) }`). `access_token` and `tracker_rt` have different names, so setting both on one response is fine. Verified output from a single `NextResponse.redirect`:
  `access_token=T; Path=/; Expires=…; Max-Age=604800; HttpOnly; SameSite=lax` and `tracker_rt=; Path=/api/tracker; Expires=Thu, 01 Jan 1970 00:00:00 GMT`.
- `delete(...args: [key: string] | [options: Omit<ResponseCookie, 'value' | 'expires'>]): this;`. Its implementation is `return this.set({ ...options, name, value: "", expires: new Date(0) });`.
- `normalizeCookie` does `if (cookie.maxAge) { cookie.expires = new Date(Date.now() + cookie.maxAge * 1e3); }` and `if (cookie.path === null || cookie.path === void 0) { cookie.path = "/"; }`.
  - So `delete({ ...OPTS_WITH_MAXAGE, name })` emits `tracker_rt=; Path=/api/tracker; Expires=<+7d>; Max-Age=604800; HttpOnly; SameSite=lax`, which is **not a delete** (verified).
  - And `delete('tracker_rt')` emits `Path=/`, which **misses the cookie** (verified).
- `new NextResponse(plain.body, plain)` on a `tokenResponse(...)` output keeps status `200`, `cache-control: no-store` and `content-type: application/json`, and `out.cookies.set('tracker_rt', 'JWE', OPTS)` adds `tracker_rt=JWE; Path=/api/tracker; Expires=…; Max-Age=604800; HttpOnly; SameSite=lax` (verified).
- Alternative, also valid: `cookies()` from `next/headers` inside a route handler. `app-route/module.js` ~L484-493 merges the request store's changed cookies into whatever `Response` the handler returns: `const headers = new Headers(res.headers); if (appendMutableCookies(headers, requestStore.mutableCookies)) { return new Response(res.body, { status: res.status, statusText: res.statusText, headers }); }`. Cookies set on the returned response take precedence.
- Server action: `cookies().delete(...)` goes through `MutableRequestCookiesAdapter` (`adapters/request-cookies.js` ~L137-145, L169-174), whose `delete` calls `ResponseCookies.delete(...args)`. Same serializer, same pitfall. Changed cookies ride on the action's `redirect('/login')` response (303 for actions, `module.js` L445-458).

**Recommendation:** in the route, wrap with a small local function:
```ts
function withCookies(res: Response, apply: (out: NextResponse) => void): NextResponse {
  const out = new NextResponse(res.body, res)
  apply(out)
  return out
}
```
- On rotation: `withCookies(tokenResponse(result), (out) => out.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions))`.
- On a bad `tracker_rt`: `withCookies(tokenErrorResponse(new TrackerTokenError('reauth')), (out) => out.cookies.delete(TRACKER_RT_DELETE))`.

### Pattern 4: the helper module (prescriptive skeleton)

`src/lib/tracker-rt.ts`. It imports only `jose`, with no `@/`, `next/*` or `server-only` import and no TS-only runtime syntax.
```ts
import { EncryptJWT, jwtDecrypt, decodeJwt, base64url } from 'jose'

export const TRACKER_RT_COOKIE = 'tracker_rt'
export const TRACKER_RT_PATH = '/api/tracker'
export const TRACKER_RT_MAX_AGE = 7 * 24 * 3600 // seconds; also the JWE exp span (D-04)

/** Every set of tracker_rt uses exactly these attributes (RT-03). */
export const trackerRtCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: TRACKER_RT_MAX_AGE,
  path: TRACKER_RT_PATH,
}

/** Every delete of tracker_rt uses exactly this: name + path, NEVER maxAge (Pitfall 1). */
export const TRACKER_RT_DELETE = { name: TRACKER_RT_COOKIE, path: TRACKER_RT_PATH }

export interface TrackerRt { rt: string; sub: string }

/** D-09: unset, empty, undecodable or not exactly 32 bytes → null (= unconfigured). */
export function parseTrackerRtKey(raw: string | undefined): Uint8Array | null {
  if (!raw) return null
  try {
    const key = base64url.decode(raw.trim())
    return key.length === 32 ? key : null
  } catch {
    return null
  }
}

export async function sealTrackerRt(value: TrackerRt, key: Uint8Array): Promise<string> {
  return new EncryptJWT({ rt: value.rt, sub: value.sub })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TRACKER_RT_MAX_AGE)
    .encrypt(key)
}

/** Wrong key, malformed, past exp, missing exp, wrong claim types → null. Never throws. */
export async function openTrackerRt(jwe: string, key: Uint8Array): Promise<TrackerRt | null> {
  try {
    const { payload } = await jwtDecrypt(jwe, key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
      requiredClaims: ['exp'],
    })
    const { rt, sub } = payload
    return typeof rt === 'string' && rt && typeof sub === 'string' && sub ? { rt, sub } : null
  } catch {
    return null
  }
}

/** The FastAPI session JWT, decoded WITHOUT verification (D-01/D-02). Missing, bad or expired → null. */
export function sessionSubject(accessToken: string | undefined, nowSec = Math.floor(Date.now() / 1000)): string | null {
  if (!accessToken) return null
  try {
    const { sub, exp } = decodeJwt(accessToken)
    if (typeof sub !== 'string' || !sub) return null
    if (typeof exp !== 'number' || exp <= nowSec) return null
    return sub
  } catch {
    return null
  }
}

export type TrackerRtCheck =
  | { ok: true; rt: string; sub: string }
  | { ok: false; clear: boolean } // clear: expire tracker_rt on the 401 (D-05)

/** D-02 + D-05 as one pure, unit-testable decision. Key presence is checked by the caller first (D-09). */
export async function checkTrackerRt(input: {
  accessToken: string | undefined
  trackerRt: string | undefined
  key: Uint8Array
}): Promise<TrackerRtCheck> {
  const sub = sessionSubject(input.accessToken)
  if (!sub) return { ok: false, clear: false }
  if (!input.trackerRt) return { ok: false, clear: false }
  const opened = await openTrackerRt(input.trackerRt, input.key)
  if (!opened || opened.sub !== sub) return { ok: false, clear: true }
  return { ok: true, rt: opened.rt, sub }
}
```
Every TypeScript construct above survives Node's strip-only mode: an interface, a union type alias, `as const`, parameter and return annotations, and a default parameter. `decodeJwt` validates the `exp` **type** only when present [ASSUMED from jose internals; the helper checks types itself regardless].

### Pattern 5: the token route

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { redeemTrackerToken, tokenResponse, tokenErrorResponse, TrackerTokenError } from '@avora/tracker-client/server'
import {
  TRACKER_RT_COOKIE, TRACKER_RT_DELETE, trackerRtCookieOptions,
  parseTrackerRtKey, checkTrackerRt, sealTrackerRt,
} from '@/lib/tracker-rt'

/** (header comment in HR's style: what, why the refresh token works, access = own session check
 *  because the middleware matcher skips /api, no CORS headers) */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const scope = process.env.TRACKER_API_SCOPE
  const key = parseTrackerRtKey(process.env.TRACKER_RT_KEY)
  if (!scope || !key) return tokenErrorResponse(new TrackerTokenError('unconfigured'))

  const check = await checkTrackerRt({
    accessToken: req.cookies.get('access_token')?.value,
    trackerRt: req.cookies.get(TRACKER_RT_COOKIE)?.value,
    key,
  })
  if (!check.ok) {
    const res = tokenErrorResponse(new TrackerTokenError('reauth'))
    return check.clear ? withCookies(res, (out) => out.cookies.delete(TRACKER_RT_DELETE)) : res
  }

  try {
    const result = await redeemTrackerToken({
      tenantId: process.env.AZURE_TENANT_ID,
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      refreshToken: check.rt,
      scope,
    })
    const res = tokenResponse(result)
    if (!result.refreshToken) return res
    const sealed = await sealTrackerRt({ rt: result.refreshToken, sub: check.sub }, key)
    return withCookies(res, (out) => out.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions))
  } catch (e) {
    console.error(
      'tracker-token:',
      e instanceof TrackerTokenError ? `${e.code} ${JSON.stringify(e.entraCodes)}` : 'unexpected',
    )
    return tokenErrorResponse(e)
  }
}
```
Notes:
- `sealTrackerRt` cannot realistically fail with a key that `parseTrackerRtKey` has already accepted. If it throws, it lands in the catch as `unexpected` and becomes a 502. The planner may instead return the 200 without a re-set. Entra does not revoke the old refresh token when it issues a new one (cited), so the old cookie keeps working.
- Reading cookies via `req.cookies` avoids pulling in `next/headers`.

### Pattern 6: the callback insertion (after L102, before `return response`)

```ts
    // tracker_rt: always freshly set or deleted (D-07); never affects sign-in (D-10).
    let sealed: string | null = null
    try {
      const key = parseTrackerRtKey(process.env.TRACKER_RT_KEY)
      if (process.env.TRACKER_RT_KEY && !key) console.error('[azure-callback] tracker-rt: TRACKER_RT_KEY is malformed')
      const sub = sessionSubject(token)
      const rt = typeof tokens.refresh_token === 'string' ? tokens.refresh_token : ''
      if (key && sub && rt) sealed = await sealTrackerRt({ rt, sub }, key)
    } catch {
      console.error('[azure-callback] tracker-rt: sealing failed')
    }
    if (sealed) response.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions)
    else response.cookies.delete(TRACKER_RT_DELETE)
```
`catch {}` has no binding, so the error object cannot be logged and ESLint has no unused variable to flag.

### Pattern 7: logout

```ts
import { TRACKER_RT_DELETE } from '@/lib/tracker-rt'
…
  cookieStore.delete('access_token')
  cookieStore.delete(TRACKER_RT_DELETE)   // { name: 'tracker_rt', path: '/api/tracker' }
  redirect('/login')
```
A `'use server'` file may export only async functions, but it may **import** constants. The helper is a separate module, so this is fine.

### Anti-Patterns to Avoid
- **Spreading `trackerRtCookieOptions` into a delete.** Because of `maxAge`, the result is a 7-day empty cookie, not a delete (Pitfall 1).
- **`cookieStore.delete('tracker_rt')` with no path.** It targets `Path=/` and leaves the real cookie in place.
- **`import 'server-only'` in the helper.** The package's default export throws (Pitfall 4).
- **Copying the spec's code sketch for the log line**: `console.error('tracker-token:', e instanceof TrackerTokenError ? \`${e.code} ${e.entraCodes}\` : e)` logs the raw error object for unexpected errors. Use HR's `'unexpected'` form.
- **Putting branching logic in `route.ts`.** The route imports `@/` aliases and `next/server`, so `node --test` cannot import it. Keep every decision in `checkTrackerRt`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authenticated encryption of the RT | AES-GCM with `crypto.subtle` + custom framing | jose `EncryptJWT` / `jwtDecrypt` (`dir`/`A256GCM`) | Handles IV, tag, header binding, `exp` validation and constant error types |
| JWT payload decode | `atob(split('.')[1])` | jose `decodeJwt` | Handles base64url, rejects 2- and 5-segment input and non-object claims (verified) |
| Entra refresh grant, error mapping | Own `fetch` + error parsing | `redeemTrackerToken` + `tokenErrorResponse` | Consent-before-reauth ordering, numbers-only `entraCodes`, no secret in errors |
| `Set-Cookie` serialization | String building | `NextResponse.cookies.set/delete` | Consistent attributes. `stringifyCookie` itself is internal to Next |

## Runtime State Inventory

Not a rename phase, so this section is omitted, apart from one note on runtime state the phase *creates*:
- **Browser cookies.** Users signed in before this deploy have only `access_token`. D-08 makes them `reauth` until they sign out and back in.
- **Server env.** `TRACKER_RT_KEY` and `TRACKER_API_SCOPE` must be set in `.env.local` by the user (D-15). Production is Phase 14.

## Common Pitfalls

### Pitfall 1: A "delete" that sets a 7-day cookie
**What goes wrong:** `response.cookies.delete({ ...trackerRtCookieOptions, name })` emits `Max-Age=604800` with an empty value.
**Why:** `delete` → `set({ ...options, value: "", expires: new Date(0) })` → `normalizeCookie` replaces `expires` because `maxAge` is truthy (verified).
**How to avoid:** use the dedicated `TRACKER_RT_DELETE = { name, path }` constant everywhere. Add a static test asserting that every `delete(` of `tracker_rt` in `src/` passes `TRACKER_RT_DELETE`, and a helper test asserting `TRACKER_RT_DELETE` has no `maxAge`.
**Warning signs:** DevTools shows a `tracker_rt` with an empty value and a future expiry.

### Pitfall 2: The JWE without `exp` is accepted
**What goes wrong:** `jwtDecrypt` with default options opens a JWE that has no `exp` (verified). A future code path that forgot `setExpirationTime` would then mint cookies that never expire server-side.
**How to avoid:** pass `requiredClaims: ['exp']` in `openTrackerRt`, and add a helper test that a JWE sealed without `exp` opens to `null`.

### Pitfall 3: A lenient key decode
**What goes wrong:** `TRACKER_RT_KEY=""` from a blank `.env` line decodes to 0 bytes without throwing. A short key would only fail later, inside `encrypt` (`JWEInvalid` "Invalid Content Encryption Key length").
**How to avoid:** `parseTrackerRtKey` checks `length === 32`, catches every throw and returns `null`. Test with `undefined`, `""`, `"!!!!"`, a 16-byte key and a 33-byte key.

### Pitfall 4: Helper imports that break `node --test`
Each of these failed in a scratch probe on Node v24.15.0 [VERIFIED]:
- `enum` → `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode`
- a constructor parameter property → `…TypeScript parameter property is not supported in strip-only mode`
- `import { JWTPayload } from 'jose'` without `type` → `SyntaxError: The requested module 'jose' does not provide an export named 'JWTPayload'`. Type-only imports must say `type`.
- `import … from '@/lib/y'` → `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`
- an extensionless relative import `'./h'` → `ERR_MODULE_NOT_FOUND`. A `.ts` extension would be needed, and tsconfig lacks `allowImportingTsExtensions`, so the helper must import **no** sibling module.
- `import 'server-only'` → its default export `index.js` throws `"This module cannot be imported from a Client Component module…"`.

What works: `import { seal, open, parseKey } from "../src/lib/h.ts"` from `tests/*.test.mjs`, with bare `jose` resolving from the project `node_modules`. The scratch run printed `✔ roundtrip`, `pass 1`.

Expected noise: `nextjs-project/package.json` has no `"type"`, so Node prints `[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///…/tracker-rt.ts is not specified … Reparsing as ES module` (reproduced). It is harmless and the tests pass. **Do not** add `"type": "module"` to `package.json`: that changes module semantics for the whole project and breaks DEP-01's "no other package changes".

### Pitfall 5: `sub` binding is a consistency check, not authentication
**What goes wrong:** treating D-02 as proof of identity. `access_token` is not verified in Next.js (no JWT secret in Next's env; `.env.example` lists none), so anyone holding a victim's `tracker_rt` could forge a matching unsigned `access_token`.
**Why it is still right:** `tracker_rt` is httpOnly, path-scoped and encrypted. The binding stops one user's stale refresh token being redeemed under another user's session on a shared browser. Document this in the route header comment. Do not claim more.

### Pitfall 6: Logging a token
**What goes wrong:** the callback's outer catch (L105) logs a raw `e`, and the spec sketch logs a raw `e` too. A seal or redeem error that ends up there could carry request context.
**How to avoid:**
- Use an inner `catch {}` with no binding in the callback.
- In the route, use HR's ternary that prints `'unexpected'`.
- Never log `tokens`, `token`, `sealed`, `result` or a cookie value.
- Add a static test that the route's `console.error` arguments contain no identifier other than `e.code` / `e.entraCodes`. Practically: a regex that the file has no `console.error(` whose argument list ends `, e)`.

### Pitfall 7: Cookie size
**What goes wrong:** browsers silently drop a cookie over about 4096 bytes. The user would then get `reauth` forever with no log line.
**Estimate:**
- Entra refresh tokens are opaque and of no documented length [CITED: learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens, "Refresh tokens are encrypted and only the Microsoft identity platform can read them"].
- The JWE grows the payload by about 4/3 plus about 100 bytes of header, IV and tag. A ~2 KB refresh token gives a cookie of ~2.8 KB [ASSUMED].

**How to avoid:** optionally, when `sealed.length > 3800` in the callback, skip the set (delete instead) and log `tracker-rt: sealed cookie too large (<length>)`. The length is not secret. UAT step 1 records the actual cookie size from DevTools.

### Pitfall 8: `dynamic` with cache components
`export const dynamic = 'force-dynamic'` conflicts with Next 16's `cacheComponents` mode, which is not enabled here: `next.config.ts` is `const nextConfig: NextConfig = { /* config options here */ };` [VERIFIED: read]. The build gate confirms this.

### Pitfall 9: Rotation on every call
Entra "Refresh tokens replace themselves with a fresh token upon every use. The Microsoft identity platform doesn't revoke old refresh tokens" [CITED: learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens, updated 2026-06-15]. Combined with the package appending `offline_access` (L55), nearly every 200 carries a `Set-Cookie`. That is expected, and it slides the 7-day window (D-04). The default refresh-token lifetime for a confidential web app is 90 days [CITED: same page], so the 7-day JWE `exp` is the tighter bound.

## Code Examples

### Helper test skeleton (`tests/rt-helper.test.mjs`)
```js
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { EncryptJWT } from "jose";
import {
  parseTrackerRtKey, sealTrackerRt, openTrackerRt, sessionSubject, checkTrackerRt,
  trackerRtCookieOptions, TRACKER_RT_DELETE, TRACKER_RT_COOKIE,
} from "../src/lib/tracker-rt.ts";

const keyStr = () => randomBytes(32).toString("base64url");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const session = (sub, expOffset = 3600) =>
  `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role: "admin", exp: Math.floor(Date.now() / 1000) + expOffset })}.sig`;

test("seal/open round trip", async () => {
  const k = parseTrackerRtKey(keyStr());
  const jwe = await sealTrackerRt({ rt: "RT", sub: "7" }, k);
  assert.equal(jwe.split(".").length, 5);
  assert.deepEqual(await openTrackerRt(jwe, k), { rt: "RT", sub: "7" });
});
test("wrong key → null", async () => { /* seal with k1, open with k2 */ });
test("past exp → null", async () => {
  const k = parseTrackerRtKey(keyStr());
  const old = await new EncryptJWT({ rt: "RT", sub: "7" }).setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 10).encrypt(k);
  assert.equal(await openTrackerRt(old, k), null);
});
test("no exp → null", async () => { /* EncryptJWT without setExpirationTime */ });
for (const bad of [undefined, "", "!!!!", randomBytes(16).toString("base64url"), randomBytes(33).toString("base64url")])
  test(`malformed key ${JSON.stringify(bad)?.slice(0, 8)} → null`, () => assert.equal(parseTrackerRtKey(bad), null));
test("sessionSubject: unparseable / expired / missing sub → null", () => {
  assert.equal(sessionSubject("garbage"), null);
  assert.equal(sessionSubject(session("7", -10)), null);
  assert.equal(sessionSubject(session("7")), "7");
});
test("checkTrackerRt: sub mismatch → clear", async () => { /* seal sub "7", session sub "8" → { ok:false, clear:true } */ });
test("checkTrackerRt: no session → no clear; missing rt → no clear; garbage rt → clear", async () => {});
test("cookie options are RT-03", () => {
  assert.equal(TRACKER_RT_COOKIE, "tracker_rt");
  assert.equal(trackerRtCookieOptions.httpOnly, true);
  assert.equal(trackerRtCookieOptions.sameSite, "lax");
  assert.equal(trackerRtCookieOptions.maxAge, 604800);
  assert.equal(trackerRtCookieOptions.path, "/api/tracker");
  assert.deepEqual(TRACKER_RT_DELETE, { name: "tracker_rt", path: "/api/tracker" });
});
```

### Static wiring test (`tests/rt-wiring.test.mjs`): the checks to include
- **Scope, both routes.** `readFileSync(ROOT/src/app/api/auth/login/azure/route.ts)` and `…/callback/azure/route.ts` each include `'openid email profile offline_access'`, and neither still matches `/'openid email profile'/`.
- **Logout.** `src/app/actions/auth.ts` includes `cookieStore.delete(TRACKER_RT_DELETE)` (or `/delete\(\s*\{\s*name:\s*['"]tracker_rt['"],\s*path:\s*['"]\/api\/tracker['"]/`) **and** still `cookieStore.delete('access_token')`.
- **Route file.**
  - `src/app/api/tracker/token/route.ts` exists, exports `POST`, and has `export const dynamic = 'force-dynamic'`.
  - It calls `redeemTrackerToken`, `tokenResponse` and `tokenErrorResponse`.
  - The `unconfigured` check appears before `checkTrackerRt` (compare `indexOf`).
  - It has no `NextResponse.redirect` and no `Access-Control-` string.
  - It has no `console.error(` ending in `, e)`.
- **Callback.** It references `sealTrackerRt`, `TRACKER_RT_DELETE` and `trackerRtCookieOptions`.
- **No bad deletes.** No file under `src/` has `delete('tracker_rt')` or `delete("tracker_rt")`.
- **Helper imports.** `src/lib/tracker-rt.ts` import lines name only `jose`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--experimental-strip-types` flag | Type stripping on by default | Node 23.6 / 22.18 [ASSUMED] | On v24.15.0, no flag and no ExperimentalWarning appeared in the run [VERIFIED: run] |
| `middleware.ts` | `proxy.ts` (Next 16 renamed it; `NextProxy`/`ProxyConfig` are exported from `next/server`, verified in `server.d.ts`) | Next 16 | Out of scope: the middleware does not change this phase |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A sealed `tracker_rt` stays under ~4 KB (Entra refresh token ~2 KB or less) | Pitfall 7 | Browser drops the cookie and the user gets permanent `reauth`. The UAT step measures it; the optional size guard logs it |
| A2 | The tracker access token's `aud` is the GUID `86fcee80-…` rather than `api://…` (it depends on the tracker app's `accessTokenAcceptedVersion`) | Validation SC2 | UAT check wording only. The spec states `aud` equals the tracker client id |
| A3 | `decodeJwt` validates claim *types* only when present | Pattern 4 | None: the helper type-checks `sub` and `exp` itself |
| A4 | Strip-types default since Node 23.6 / 22.18 | State of the Art | None for this machine. Verified working on v24.15.0 |
| A5 | Vercel's Node runtime for `pricing-model` behaves the same for jose `base64url` | Pattern 2 | Only for non-base64url keys. Generate with `base64url` |

## Open Questions

1. **Does local sign-in with `offline_access` trigger a consent prompt?**
   - Known: D-11 makes the portal check a human checkpoint before UAT.
   - Unclear: whether admin consent for Graph `offline_access` is already granted on `ac19614d-…`.
   - Recommendation: the plan's first UAT task is `checkpoint:human-verify` for the portal state, with stop-and-ask on `AADSTS65001` / `AADSTS90094`.
2. **Does the tracker's CORS accept ACMI's local origin?** (STATE.md concern)
   - It does not affect Phase 12: the UAT calls only the same-origin route. It is Phase 13's concern.
3. **Reseal failure on rotation:** return a 502, or the 200 without a re-set?
   - Recommendation: either is safe, because the old refresh token remains valid (Entra doesn't revoke on use). The planner picks, and the skeleton shows the simpler catch-all.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node --test` (strip-types), `next` | ✓ | v24.15.0 | — |
| jose | helper | ✓ (installed) | 6.1.3 | — |
| @avora/tracker-client | route | ✓ (installed) | 10.0.0 @ a369f81 | — |
| ESLint 9 + eslint-config-next | lint gate | ✓ | per lockfile | — |
| `TRACKER_RT_KEY`, `TRACKER_API_SCOPE` in `.env.local` | UAT | ✗ (user sets them, D-15) | — | Blocking for UAT only. Print the one-liner and scope; the user pastes them |
| Entra portal admin consent for `offline_access` | UAT | unknown | — | Human checkpoint (D-11) |
| FastAPI backend at `API_URL` | sign-in during UAT | not probed | — | The user runs it locally, as for any sign-in |

**Missing dependencies with no fallback:** the user-supplied env values and the Entra consent check. Both are human checkpoints and do not block the code tasks.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (built into Node v24.15.0); no npm test runner, no `test` script |
| Config file | none. Files are `nextjs-project/tests/*.test.mjs` with `ROOT` from `import.meta.url` (Phase 11 style, verified in `dep03-env-manifest.test.mjs`) |
| Quick run command | `cd nextjs-project && node --test tests/rt-helper.test.mjs tests/rt-wiring.test.mjs` |
| Full suite command | `cd nextjs-project && node --test "tests/*.test.mjs"` (baseline today: `tests 22`, `pass 22`, `fail 0`, verified this session) |
| Build gate | `cd nextjs-project && npm run build` (runs `prebuild` → `scripts/check-tracker-lock.mjs` first) |
| Lint gate | `cd nextjs-project && npm run lint` → must stay at **10 errors, 10 warnings**. Verified this session with `eslint -f json .` over 111 files. ESLint's scope covers `src/**` **and** `tests/*.mjs` and `scripts/*.mjs`, so the new test files are linted too |

Lint baseline by file (none is touched by this phase) [VERIFIED: eslint run]:
- `login/page.tsx` w2
- `AircraftDetail` e1
- `CreateAircraftDialog` e1 w1
- `EprMatrixTable` e1
- `EscalationSection` e1
- `RatesSection` e1
- `NewQuoteModal` e1
- `useQuoteHydration` e1
- `SensitivityChart` e1
- `Sidebar.tsx` e1 w1
- `ThemeToggle.tsx` e1
- `pnl-engine` w3
- `pnl-monthly-builder` w2
- `pnl-msn-config` w1

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command / Manual Step | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-01 / SC1a | Both routes send `openid email profile offline_access` | static | `node --test tests/rt-wiring.test.mjs` (scope checks) | ❌ Wave 0 |
| RT-02 | Callback seals `{rt, sub}` with `dir`/`A256GCM`, `exp` = +7 d | unit + static | `rt-helper` round trip, 5-segment shape, `exp-iat == 604800`; `rt-wiring` callback references `sealTrackerRt` | ❌ Wave 0 |
| RT-03 / SC1b | Cookie attributes | unit + manual | `rt-helper` "cookie options are RT-03". UAT 1: DevTools → Application → Cookies shows `tracker_rt` HttpOnly ✓, SameSite Lax, Path `/api/tracker`, expiry ≈ +7 d, value starts `eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..`; `document.cookie` in the console does not contain `tracker_rt` | ❌ Wave 0 |
| RT-04 / SC4b | Logout clears both | static + manual | `rt-wiring` logout check; `rt-helper` `TRACKER_RT_DELETE` has no `maxAge`. UAT 4b: after Sign out, DevTools shows neither cookie | ❌ Wave 0 |
| RT-05 / SC4a | Unset or malformed key → sign-in unaffected, no `tracker_rt` | unit + manual | `rt-helper` malformed-key cases → `null`. UAT 4a: user blanks `TRACKER_RT_KEY`, restarts dev, signs in → lands on dashboard, `access_token` present, no `tracker_rt`; the server log shows the malformed-key line only if a bad value was set | ❌ Wave 0 |
| TOKEN-01 / SC2 | 200 `{accessToken, expiresAt}`, `no-store`, `aud`/`azp` | manual | UAT 2 in the signed-in tab console: `const r = await fetch('/api/tracker/token',{method:'POST'}); const j = await r.json(); const p = JSON.parse(atob(j.accessToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); console.log(r.status, r.headers.get('cache-control'), typeof j.expiresAt, {aud:p.aud, azp:p.azp, scp:p.scp, exp:p.exp})`. Expect `200 'no-store' 'number'`, `aud` 86fcee80-…, `azp` ac19614d-…, `scp` including `access_as_user`. Never print `j` or the token (D-16) | manual-only (needs a real Entra RT) |
| TOKEN-02 / SC3a | No `access_token` → 401 reauth JSON, no redirect | unit + manual | `rt-helper` `checkTrackerRt` no-session → `{ok:false, clear:false}`; `rt-wiring` route has no redirect. UAT 3a: `curl -si -X POST http://localhost:3000/api/tracker/token` → `HTTP/1.1 401`, `{"error":"reauth"}`, no `Location` | ❌ Wave 0 |
| TOKEN-03 / SC3b | Missing or undecryptable `tracker_rt` → 401 reauth (+ clear when bad) | unit + manual | `rt-helper` wrong key / past exp / sub mismatch / garbage → `clear:true`, missing → `clear:false`. UAT 3b: `curl -si -X POST -H "Cookie: access_token=<unsigned test JWT, future exp>; tracker_rt=garbage" …` → 401 reauth + `Set-Cookie: tracker_rt=; Path=/api/tracker; Expires=Thu, 01 Jan 1970…` | ❌ Wave 0 |
| TOKEN-03 / SC3c | Unset scope or key → 503 unconfigured, before the session gate | static + manual | `rt-wiring` `unconfigured` before `checkTrackerRt`. UAT 3c: user blanks `TRACKER_API_SCOPE`, restarts, `curl -si -X POST …` (no cookies) → `503 {"error":"unconfigured"}` | ❌ Wave 0 |
| TOKEN-03 / SC3d | Entra errors via `tokenErrorResponse`; logs only code + numeric codes | static + manual | `rt-wiring` HR-form log line, no `, e)`. UAT: inspect the `next dev` terminal after the UAT 3 calls; only `tracker-token: <code> [..]` lines. (Package-level mapping is covered by tracker-client's own tests) | ❌ Wave 0 |
| TOKEN-04 / SC2b | Rotation re-sets `tracker_rt` with the same attributes | static + manual | `rt-wiring` route sets `trackerRtCookieOptions` after `redeemTrackerToken`. UAT 2b: DevTools Network → the token request's Response Headers show `set-cookie: tracker_rt=…; Path=/api/tracker; Max-Age=604800; HttpOnly; SameSite=lax`, and the cookie value changed | ❌ Wave 0 |
| SC5 | App unaffected, build and lint green | build + lint + manual | `npm run build` exit 0; `npm run lint` = 10/10; UAT 5: open Dashboard, Calculation, Quotes after sign-in | existing |
| D-11 | Consent precondition | manual checkpoint | `checkpoint:human-verify` before UAT 1: the user confirms Graph `offline_access` admin consent on `ac19614d-…`; stop on AADSTS65001 / AADSTS90094 | n/a |

The UAT 3b curl needs an `access_token`-shaped value. The UAT step builds an **unsigned** test JWT with a future `exp` and `sub` matching nothing real, via `node -e` printing `b64(header).b64(payload).x`. That works because the route does not verify the signature (D-02). It is test data, not a credential.

### Sampling Rate
- **Per task commit:** `node --test "tests/*.test.mjs"` (all 22 existing checks plus the new ones, under 5 s)
- **Per plan merge:** the above, plus `npm run lint` (count must equal 10/10), plus `npm run build`
- **Phase gate:** full suite green, build, lint baseline, then local UAT 1–5 with the D-11 checkpoint first

### Wave 0 Gaps
- [ ] `tests/rt-helper.test.mjs`: RT-02, RT-03, RT-05, TOKEN-02, TOKEN-03 (helper decisions)
- [ ] `tests/rt-wiring.test.mjs`: RT-01, RT-04, TOKEN-01..04 (static wiring)
- No framework install. `node:test` is built in and `jose` resolves from `tests/` through the project `node_modules` (verified in the probe).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Entra confidential client (`redeemTrackerToken`). No credential handling in the browser |
| V3 Session Management | yes | httpOnly + SameSite=Lax + Secure (prod) cookies. Path-scoped `tracker_rt`. Sliding 7-day `exp` inside the JWE (D-04). Cleared at logout (RT-04) |
| V4 Access Control | yes | Route-level session gate (D-02), because the middleware skips `/api` |
| V5 Input Validation | yes | Cookie values parsed only through jose (`decodeJwt`, `jwtDecrypt` with alg/enc allowlists + `requiredClaims`). Every failure → `reauth` |
| V6 Cryptography | yes | jose `dir`/`A256GCM` with a 256-bit random key. No hand-rolled crypto |
| V7 Error handling and logging | yes | `tracker-token: <code> <numeric entraCodes>`; `catch {}` without binding in the callback; never log tokens or cookies |
| V14 Configuration | yes | Secrets server-only, never `NEXT_PUBLIC_`; `.env*` user-edited |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS reads the refresh token | Information disclosure | `HttpOnly`; `Path=/api/tracker`, so page requests never carry it |
| Cookie theft → offline use | Information disclosure | Encrypted under a server-only key; `exp` 7 d; key rotation forces `reauth` |
| CSRF on the token route | Spoofing | `SameSite=Lax` (cross-site POST sends no cookies) + no CORS headers, so the response is unreadable cross-origin (D-03) |
| Response caching of the access token | Information disclosure | `Cache-Control: no-store` from the package (preserved by the wrap, verified) + `dynamic = 'force-dynamic'` |
| Stale RT redeemed under another user | Elevation of privilege | `sub` binding (D-02). Limits stated in Pitfall 5 |
| Token in logs | Information disclosure | HR log form; no raw `e`; static test |
| Rotated RT leaked to the browser | Information disclosure | `tokenResponse` sends only `{accessToken, expiresAt}` ("a rotated refresh token is never sent to the browser", server/index.js L84) |
| Algorithm confusion on decrypt | Tampering | `keyManagementAlgorithms: ['dir']`, `contentEncryptionAlgorithms: ['A256GCM']` |

## Sources

### Primary (HIGH confidence; installed code read or executed this session)
- `nextjs-project/node_modules/jose` 6.1.3: `dist/types/jwt/encrypt.d.ts`, `decrypt.d.ts`, `util/base64url.d.ts`, `util/decode_jwt.d.ts`, `types.d.ts` (DecryptOptions, JWTClaimVerificationOptions), `dist/webapi/util/base64url.js`, `lib/base64.js`; behaviour probe run
- `nextjs-project/node_modules/next` 16.1.6: `dist/compiled/@edge-runtime/cookies/index.{js,d.ts}`, `dist/server/route-modules/app-route/module.js`, `dist/server/web/spec-extension/adapters/request-cookies.js`, `server.d.ts`; NextResponse wrap and serializer probe run
- `nextjs-project/node_modules/@avora/tracker-client` 10.0.0: `server/index.{js,d.ts}`, `token/errors.js`, `token/index.js`, `package.json`
- `C:/Projects/hr-app/nextjs-project/src/app/api/tracker/token/route.ts` (reference route)
- acmi-app source: login and callback routes, `actions/auth.ts`, `middleware.ts`, `lib/session.ts`, `lib/safe-next.ts`, `.env.example`, `fastapi-project/app/auth/service.py`, `tests/*.test.mjs`, `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`, `vercel.json`
- Node v24.15.0 strip-types probe (scratch copy with a junction to the project `node_modules`)
- ESLint run (`eslint -f json .`) and full `node --test` run in `nextjs-project`

### Secondary (MEDIUM)
- Microsoft Learn, "Refresh tokens in the Microsoft identity platform" (updated 2026-06-15): rotation on every use, no revocation of the old token, 90-day default, opaque and encrypted
- `C:/Projects/task-tracker/docs/superpowers/specs/2026-09-14-host-app-embeds-design.md`: token route section, acmi-app section, Error handling, Testing

### Tertiary (LOW)
- Refresh token size estimate (A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions read from installed `package.json` files and the lockfile.
- Architecture and cookie mechanics: HIGH. Serializer and merge paths read and executed.
- jose behaviour: HIGH. Every error case executed.
- Pitfalls: HIGH, except cookie size (LOW, assumed).

**Research date:** 2026-10-01
**Valid until:** 2026-10-31, or until jose, next or tracker-client is upgraded
