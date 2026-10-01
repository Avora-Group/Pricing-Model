/**
 * `tracker_rt` holds the Entra refresh token that the tracker embed's token
 * route (`/api/tracker/token`) redeems for a tracker-scoped access token. A
 * refresh token is a long-lived credential, so the browser only ever holds it
 * as ciphertext: a `dir` / `A256GCM` JWE under `TRACKER_RT_KEY`, which never
 * leaves the server. The cookie is httpOnly and scoped to `/api/tracker`, so
 * page scripts cannot read it and ordinary page requests never carry it.
 *
 * The JWE payload is `{ rt, sub, sexp }`, where `sub` is the ACMI user id from
 * the FastAPI session token. Next.js decodes that token without verifying it,
 * so the `sub` binding is a consistency check that stops a stale cookie on a
 * shared browser being redeemed under someone else's session. It is not
 * authentication.
 *
 * `sexp` is that session token's `exp`, read once at sign-in, while the token
 * has just come from FastAPI. It is an absolute deadline: every seal (at
 * sign-in and on rotation) sets the JWE exp and the cookie maxAge to
 * min(now + 7 days, sexp), and a re-seal carries the original `sexp` forward.
 * A copied cookie therefore dies when the sign-in session would have ended,
 * whatever `access_token` the client presents later (WR-01).
 *
 * Every function here fails closed: bad input gives `null` or a skip reason,
 * never a throw (except `sealTrackerRt`, whose callers catch). Nothing in this
 * module logs. It imports only `jose`, so `node --test` can load it directly.
 */

import { EncryptJWT, jwtDecrypt, decodeJwt, base64url } from 'jose'

export const TRACKER_RT_COOKIE = 'tracker_rt'
export const TRACKER_RT_PATH = '/api/tracker'
// Seconds: the longest the cookie's maxAge and the JWE's exp span (D-04). The
// sign-in session's exp caps both (WR-01).
export const TRACKER_RT_MAX_AGE = 7 * 24 * 3600
// Browsers silently drop a cookie of about 4 KB, so a longer sealed value is
// deleted and logged instead of set.
export const TRACKER_RT_MAX_LENGTH = 3800

const nowEpochSec = () => Math.floor(Date.now() / 1000)
const isEpochSec = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0

/** The JWE exp for a seal at `nowSec`: 7 days out, never past the session deadline `sexp` (D-04, WR-01). */
export function trackerRtExp(sexp: number, nowSec: number): number {
  return Math.min(nowSec + TRACKER_RT_MAX_AGE, sexp)
}

/**
 * Every set of tracker_rt uses exactly these attributes (RT-03). `maxAge` is
 * the seconds left until the JWE's exp, so the cookie and the JWE end
 * together; it is clamped to 0..7 days.
 */
export function trackerRtCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: Math.max(0, Math.min(TRACKER_RT_MAX_AGE, Math.floor(maxAge))),
    path: TRACKER_RT_PATH,
  }
}

/**
 * Every delete of tracker_rt uses exactly this: name and path only. A maxAge
 * here would turn the delete into a 7-day empty cookie, and no path would
 * target `Path=/` and miss the real one.
 */
export const TRACKER_RT_DELETE = { name: TRACKER_RT_COOKIE, path: TRACKER_RT_PATH }

export interface TrackerRt {
  rt: string
  sub: string
  /** The sign-in session's exp, epoch seconds: the deadline no re-seal moves (WR-01). */
  sexp: number
}

export type TrackerRtCheck =
  | { ok: true; rt: string; sub: string; sexp: number }
  | { ok: false; clear: boolean } // clear: expire tracker_rt on the 401 (D-05)

export type TrackerRtCaptureSkip =
  | 'no-key'
  | 'malformed-key'
  | 'no-session'
  | 'no-refresh-token'
  | 'too-large'
  | 'seal-failed'

export type TrackerRtCapture =
  | { sealed: string; maxAge: number; skipped: null } // maxAge: seconds until the JWE's exp
  | { sealed: null; skipped: TrackerRtCaptureSkip }

export type TrackerRtSealSkip = Extract<TrackerRtCaptureSkip, 'seal-failed' | 'too-large'>

export type TrackerRtSeal =
  | { sealed: string; maxAge: number; skipped: null }
  | { sealed: null; skipped: TrackerRtSealSkip }

/**
 * What the sign-in callback logs for each skip: fixed text naming the step,
 * never a value. An unset key means the embed is not configured, which is
 * normal, so it logs nothing.
 */
export const TRACKER_RT_SKIP_MESSAGES: Record<TrackerRtCaptureSkip, string | null> = {
  'no-key': null,
  'malformed-key': 'TRACKER_RT_KEY is malformed',
  'no-session': 'session token has no usable sub',
  'no-refresh-token': 'no refresh_token in the code exchange',
  'too-large': 'sealed cookie is too large',
  'seal-failed': 'sealing failed',
}

// 32 bytes as unpadded base64url is exactly 43 characters of [A-Za-z0-9_-].
const TRACKER_RT_KEY_RE = /^[A-Za-z0-9_-]{43}$/

/**
 * D-09: unset, empty, undecodable or not exactly 32 bytes gives null
 * (unconfigured). The format is checked before decoding, so standard base64
 * (`+`, `/`, `=`) is refused on every runtime: jose's decoder accepts it on
 * Node 24 but not where Uint8Array.fromBase64 exists (IN-01).
 */
export function parseTrackerRtKey(raw: string | undefined): Uint8Array | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!TRACKER_RT_KEY_RE.test(trimmed)) return null
  try {
    const key = base64url.decode(trimmed)
    return key.length === 32 ? key : null
  } catch {
    return null
  }
}

/**
 * Seals `{ rt, sub, sexp }` with exp = min(now + 7 days, sexp) (D-04, WR-01).
 * Throws when `sexp` is not a whole epoch second in the future; callers catch.
 */
export async function sealTrackerRt(
  value: TrackerRt,
  key: Uint8Array,
  nowSec = nowEpochSec(),
): Promise<string> {
  if (!isEpochSec(value.sexp) || value.sexp <= nowSec) throw new Error('tracker_rt deadline is not in the future')
  return new EncryptJWT({ rt: value.rt, sub: value.sub, sexp: value.sexp })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(nowSec)
    .setExpirationTime(trackerRtExp(value.sexp, nowSec))
    .encrypt(key)
}

/**
 * Seals `value` for the cookie and checks the sealed length against
 * TRACKER_RT_MAX_LENGTH. The sign-in capture and the route's rotation re-seal
 * both go through here, so the size guard cannot drift between them (WR-02).
 * `maxAge` is the seconds until the JWE's exp. Never throws.
 */
export async function sealTrackerRtCookie(
  value: TrackerRt,
  key: Uint8Array,
  nowSec = nowEpochSec(),
): Promise<TrackerRtSeal> {
  let sealed: string
  try {
    sealed = await sealTrackerRt(value, key, nowSec)
  } catch {
    return { sealed: null, skipped: 'seal-failed' }
  }
  if (sealed.length > TRACKER_RT_MAX_LENGTH) return { sealed: null, skipped: 'too-large' }
  return { sealed, maxAge: trackerRtExp(value.sexp, nowSec) - nowSec, skipped: null }
}

/**
 * A wrong key, a malformed value, a past or missing exp, non-string claims, or
 * a missing, invalid or exceeded `sexp` (exp later than sexp) give null. Never
 * throws.
 */
export async function openTrackerRt(jwe: string, key: Uint8Array): Promise<TrackerRt | null> {
  try {
    const { payload } = await jwtDecrypt(jwe, key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
      requiredClaims: ['exp'],
    })
    const { rt, sub, sexp, exp } = payload
    if (typeof rt !== 'string' || !rt) return null
    if (typeof sub !== 'string' || !sub) return null
    if (!isEpochSec(sexp)) return null
    if (typeof exp !== 'number' || exp > sexp) return null
    return { rt, sub, sexp }
  } catch {
    return null
  }
}

/**
 * The FastAPI session token's `sub` and `exp`, decoded WITHOUT verification
 * (D-01, D-02). Missing, unparseable, without a string sub, or at or past its
 * exp gives null. `exp` comes back as whole epoch seconds.
 */
export function sessionClaims(
  accessToken: string | undefined,
  nowSec = nowEpochSec(),
): { sub: string; exp: number } | null {
  if (!accessToken) return null
  try {
    const { sub, exp } = decodeJwt(accessToken)
    if (typeof sub !== 'string' || !sub) return null
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= nowSec) return null
    return { sub, exp: Math.floor(exp) }
  } catch {
    return null
  }
}

/** The session's `sub` alone; see sessionClaims. */
export function sessionSubject(accessToken: string | undefined, nowSec = nowEpochSec()): string | null {
  return sessionClaims(accessToken, nowSec)?.sub ?? null
}

/**
 * D-02 and D-05 as one decision. No usable session, or no cookie, is reauth
 * without clearing. A cookie that will not open or belongs to another `sub` is
 * reauth and clears it. The caller checks the key first (D-09).
 */
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
  return { ok: true, rt: opened.rt, sub, sexp: opened.sexp }
}

/**
 * The sign-in callback's capture step (D-07, D-09, D-10). Checks the key, the
 * session sub and exp, the refresh token, sealing and the sealed length, in
 * that order, and reports the first failure. The session token's exp becomes
 * the cookie's absolute deadline `sexp` (WR-01). Never throws.
 */
export async function captureTrackerRt(input: {
  rawKey: string | undefined
  sessionToken: string | undefined
  refreshToken: unknown
}): Promise<TrackerRtCapture> {
  if (!input.rawKey) return { sealed: null, skipped: 'no-key' }
  const key = parseTrackerRtKey(input.rawKey)
  if (!key) return { sealed: null, skipped: 'malformed-key' }
  const nowSec = nowEpochSec()
  const session = sessionClaims(input.sessionToken, nowSec)
  if (!session) return { sealed: null, skipped: 'no-session' }
  const rt = input.refreshToken
  if (typeof rt !== 'string' || !rt) return { sealed: null, skipped: 'no-refresh-token' }
  return sealTrackerRtCookie({ rt, sub: session.sub, sexp: session.exp }, key, nowSec)
}
