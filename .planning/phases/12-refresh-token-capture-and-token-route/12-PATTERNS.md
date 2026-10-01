# Phase 12: Refresh-token capture and token route - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 7 (3 new source, 3 modified source, 2 new tests; counted as 7 entries below)
**Analogs found:** 7 / 7

All ACMI analog paths verified git-tracked (`git -C C:/Projects/acmi-app ls-files`). The HR analog is tracked in `C:/Projects/hr-app`. `nextjs-project/src/app/api/tracker/` does not exist in ACMI yet.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `nextjs-project/src/lib/tracker-rt.ts` (NEW) | utility (pure helper, crypto + constants) | transform | `nextjs-project/src/lib/safe-next.ts` | role-match (same style: header doc comment, exported constant + pure functions, no imports beyond what is needed) |
| `nextjs-project/src/app/api/tracker/token/route.ts` (NEW) | route handler | request-response (server -> Entra) | `C:/Projects/hr-app/nextjs-project/src/app/api/tracker/token/route.ts` | exact (differs in session check and RT source) |
| `nextjs-project/src/app/api/auth/login/azure/route.ts` (MOD) | route handler | request-response (redirect) | itself, line 18 | self |
| `nextjs-project/src/app/api/auth/callback/azure/route.ts` (MOD) | route handler | request-response (OAuth code exchange + cookie set) | itself, lines 49, 92-103 | self |
| `nextjs-project/src/app/actions/auth.ts` (MOD) | server action | request-response (cookie delete) | itself, lines 1-9 | self |
| `nextjs-project/tests/rt-helper.test.mjs` (NEW) | test (unit, imports `.ts`) | transform | `nextjs-project/tests/dep03-env-manifest.test.mjs` | role-match |
| `nextjs-project/tests/rt-wiring.test.mjs` (NEW) | test (static source checks) | file-I/O | `nextjs-project/tests/dep03-env-manifest.test.mjs` | exact (readFileSync + regex asserts) |

## Pattern Assignments

### `nextjs-project/src/lib/tracker-rt.ts` (utility, transform)

**Analog:** `nextjs-project/src/lib/safe-next.ts` (34 lines)

Style to copy (lines 1-13): a block doc comment explaining the threat model, then exported constants, then exported pure functions. Single quotes, no semicolons (ACMI's style; HR uses double quotes + semicolons, do NOT copy HR's quoting).
```ts
/**
 * Post-login redirect targets ... Both are attacker-controllable, so only same-origin
 * root-relative paths are ever honoured — anything else falls back to the
 * dashboard rather than becoming an open redirect.
 */

export const DEFAULT_NEXT = '/dashboard'

export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT
```
Fail-closed pattern (lines 14-32): every bad input returns the safe default, never throws. tracker-rt applies the same: `parseTrackerRtKey`, `openTrackerRt`, `sessionSubject` return `null` from a bare `catch {}`.

**Body:** use RESEARCH.md Pattern 4 skeleton verbatim (lines 396-481 of 12-RESEARCH.md): `TRACKER_RT_COOKIE`, `TRACKER_RT_PATH`, `TRACKER_RT_MAX_AGE`, `trackerRtCookieOptions`, `TRACKER_RT_DELETE` (name + path only, no maxAge), `parseTrackerRtKey` (try/catch + `length === 32`), `sealTrackerRt` (`dir`/`A256GCM`, iat, exp now+7d), `openTrackerRt` (`requiredClaims: ['exp']`), `sessionSubject` (jose `decodeJwt`), `checkTrackerRt` -> `{ ok, rt, sub } | { ok: false, clear }`.

**Constraints (differs from other `src/lib` files):** import ONLY `jose`; no `@/`, no `next/*`, no `import 'server-only'` (as `src/lib/session.ts` has), no `enum`, no parameter properties, type-only imports must use `import type`. Required so `node --test` can import the `.ts` directly.

---

### `nextjs-project/src/app/api/tracker/token/route.ts` (route, request-response)

**Analog:** `C:/Projects/hr-app/nextjs-project/src/app/api/tracker/token/route.ts` (55 lines)

**Imports** (HR lines 2-8; replace `getToken` with the helper and `NextResponse`):
```ts
import type { NextRequest } from "next/server";
import {
  redeemTrackerToken,
  tokenResponse,
  tokenErrorResponse,
  TrackerTokenError,
} from "@avora/tracker-client/server";
```
ACMI version: `import { NextResponse, type NextRequest } from 'next/server'` plus `import { ... } from '@/lib/tracker-rt'`.

**Header comment + dynamic** (HR lines 10-27): copy the structure (what it is; why a refresh token works / azp = ACMI client id; access control; no CORS headers). Rewrite the access-control paragraph: ACMI's `src/middleware.ts` matcher skips `/api`, so the route checks the `access_token` session itself and binds `tracker_rt` to its `sub` (consistency check, not authentication — Pitfall 5).
```ts
export const dynamic = "force-dynamic";
```

**Unconfigured check first** (HR lines 30-31):
```ts
  const scope = process.env.TRACKER_API_SCOPE;
  if (!scope) return tokenErrorResponse(new TrackerTokenError("unconfigured"));
```
ACMI extends: `if (!scope || !key)` where `key = parseTrackerRtKey(process.env.TRACKER_RT_KEY)` (D-09).

**Core redeem + error log** (HR lines 35-54) — copy the log line exactly, it never prints the raw error:
```ts
  try {
    return tokenResponse(
      await redeemTrackerToken({
        tenantId: process.env.AZURE_AD_TENANT_ID,
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        refreshToken: token?.refreshToken,
        scope,
      }),
    );
  } catch (e) {
    console.error(
      "tracker-token:",
      e instanceof TrackerTokenError ? `${e.code} ${JSON.stringify(e.entraCodes)}` : "unexpected",
    );
    return tokenErrorResponse(e);
  }
```
ACMI differences: env names are `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` (no `_AD_`); `refreshToken: check.rt` from `checkTrackerRt({ accessToken: req.cookies.get('access_token')?.value, trackerRt: req.cookies.get(TRACKER_RT_COOKIE)?.value, key })`; on `!check.ok` return 401 reauth, deleting `TRACKER_RT_DELETE` when `check.clear` (D-05); on `result.refreshToken` re-seal and set with `trackerRtCookieOptions` (D-06). Attach cookies via the `withCookies(res, apply)` wrapper (`new NextResponse(res.body, res)`) from RESEARCH.md Pattern 3/5 (lines 382-533).

---

### `nextjs-project/src/app/api/auth/login/azure/route.ts` (MOD)

Line 18 only:
```ts
    scope: 'openid email profile',
```
-> `scope: 'openid email profile offline_access',`. Nothing else changes.

---

### `nextjs-project/src/app/api/auth/callback/azure/route.ts` (MOD)

**Imports** (line 2 pattern — `@/lib` alias import):
```ts
import { DEFAULT_NEXT, sanitizeNext } from '@/lib/safe-next'
```
Add alongside: `import { TRACKER_RT_COOKIE, TRACKER_RT_DELETE, trackerRtCookieOptions, parseTrackerRtKey, sealTrackerRt, sessionSubject } from '@/lib/tracker-rt'`.

**Scope** (line 49): `scope: 'openid email profile',` -> add `offline_access`.

**Cookie-set pattern to sit next to** (lines 92-103):
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
Insert RESEARCH.md Pattern 6 (lines 540-554) between the `access_token` set and `return response`: an inner `try { ... } catch { console.error('[azure-callback] tracker-rt: sealing failed') }` with NO error binding, then `set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions)` or `delete(TRACKER_RT_DELETE)` (D-07, D-10). `tokens` is in scope from line 60.

**Logging convention** (lines 33, 56, 105): prefix `'[azure-callback] '`. Outer catch at line 104-107 logs raw `e` — sealing errors must never reach it.

---

### `nextjs-project/src/app/actions/auth.ts` (MOD)

Current (lines 1-9):
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
Add `import { TRACKER_RT_DELETE } from '@/lib/tracker-rt'` and `cookieStore.delete(TRACKER_RT_DELETE)` before `redirect`. Never `delete('tracker_rt')` (wrong path) or a spread of `trackerRtCookieOptions` (Pitfall 1).

---

### `nextjs-project/tests/rt-helper.test.mjs` (test, unit)

**Analog:** `nextjs-project/tests/dep03-env-manifest.test.mjs` (header lines 1-8) and `dep02-install-script.test.mjs` (`for ... of` parameterised tests, lines 63-70).

**Header** (dep03 lines 1-8; double quotes + semicolons in tests):
```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
```
Then import the helper directly: `import { parseTrackerRtKey, sealTrackerRt, openTrackerRt, sessionSubject, checkTrackerRt, TRACKER_RT_DELETE, trackerRtCookieOptions } from "../src/lib/tracker-rt.ts";` (works on Node 24.15 with type stripping; expect a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning — do not add `"type": "module"`).

**Parameterised cases** (dep02 lines 63-70):
```js
for (const [name, env] of [["unset", {}], ["empty", { TRACKER_REPO_TOKEN: "" }]]) {
  test(`${name} TRACKER_REPO_TOKEN fails with stderr error and never calls npm`, () => {
```
Use for key cases: `undefined`, `""`, `"!!!!"`, 16-byte, 33-byte -> `null`. Build test JWTs/JWEs with `jose` (`EncryptJWT` without `setExpirationTime` for the missing-exp case; `UnsecuredJWT` or a hand base64url payload for `access_token`). Cover D-13's list plus `TRACKER_RT_DELETE` having no `maxAge`.

---

### `nextjs-project/tests/rt-wiring.test.mjs` (test, static)

**Analog:** `nextjs-project/tests/dep03-env-manifest.test.mjs` lines 26-38 (read a file, assert by regex):
```js
const lines = readFileSync(join(ROOT, ".env.example"), "utf8").split(/\r?\n/);

test("no uncommented assignment in .env.example carries a value", () => {
  const assigns = lines.filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l));
  assert.ok(assigns.length > 0);
  for (const l of assigns) assert.match(l, /^[A-Za-z_][A-Za-z0-9_]*=$/, `has a value: ${l.split("=")[0]}`);
});
```
Apply with a `src = (p) => readFileSync(join(ROOT, p), "utf8")` helper to: both auth routes contain `'openid email profile offline_access'`; `actions/auth.ts` contains `delete(TRACKER_RT_DELETE)`; token route has `dynamic = 'force-dynamic'` and the `'unexpected'` log form; no `delete('tracker_rt')` / `delete("tracker_rt")` anywhere under `src/`.

## Shared Patterns

### Cookie attributes
**Source:** callback route lines 96-102 (`access_token`). **Apply to:** every `tracker_rt` set via `trackerRtCookieOptions` (same attrs, `path: '/api/tracker'`). Every delete via `TRACKER_RT_DELETE`.

### Logging (never a token)
**Source:** HR route lines 46-52 (route), callback `'[azure-callback] '` prefix (callback). Inner `catch {}` with no binding wherever a token is in scope.

### Fail closed
**Source:** `safe-next.ts` lines 13-32. Helpers return a safe sentinel (`null`) instead of throwing.

### Code style
ACMI `src/`: single quotes, no semicolons, `@/` alias (except `tracker-rt.ts`). `tests/*.mjs`: double quotes, semicolons, `node:test` + `node:assert/strict`, `ROOT` from `import.meta.url`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (crypto in `tracker-rt.ts`) | utility | transform | Nothing under `src/` imports `jose` yet; use RESEARCH.md Pattern 1/4 |

## Metadata

**Analog search scope:** `acmi-app/nextjs-project/src/{lib,app/api,app/actions}`, `acmi-app/nextjs-project/tests`, `hr-app/nextjs-project/src/app/api/tracker`
**Files scanned:** 8
**Pattern extraction date:** 2026-10-01
