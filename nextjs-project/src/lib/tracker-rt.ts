/**
 * `tracker_rt` holds the Entra refresh token that the tracker embed's token
 * route (`/api/tracker/token`) redeems for a tracker-scoped access token. A
 * refresh token is a long-lived credential, so the browser only ever holds it
 * as ciphertext: a `dir` / `A256GCM` JWE under `TRACKER_RT_KEY`, which never
 * leaves the server. The cookie is httpOnly and scoped to `/api/tracker`, so
 * page scripts cannot read it and ordinary page requests never carry it.
 *
 * The JWE payload is `{ rt, sub }`, where `sub` is the ACMI user id from the
 * FastAPI session token. Next.js decodes that token without verifying it, so
 * the `sub` binding is a consistency check that stops a stale cookie on a
 * shared browser being redeemed under someone else's session. It is not
 * authentication.
 *
 * Every function here fails closed: bad input gives `null` or a skip reason,
 * never a throw (except `sealTrackerRt`, whose callers catch). Nothing in this
 * module logs. It imports only `jose`, so `node --test` can load it directly.
 */

import { EncryptJWT, jwtDecrypt, decodeJwt, base64url } from 'jose'

export const TRACKER_RT_COOKIE = 'tracker_rt'
export const TRACKER_RT_PATH = '/api/tracker'
// Seconds: the cookie's maxAge and the JWE's exp span alike (D-04).
export const TRACKER_RT_MAX_AGE = 7 * 24 * 3600
// Browsers silently drop a cookie of about 4 KB, so a longer sealed value is
// deleted and logged instead of set.
export const TRACKER_RT_MAX_LENGTH = 3800

/** Every set of tracker_rt uses exactly these attributes (RT-03). */
export const trackerRtCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: TRACKER_RT_MAX_AGE,
  path: TRACKER_RT_PATH,
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
}

export type TrackerRtCheck =
  | { ok: true; rt: string; sub: string }
  | { ok: false; clear: boolean } // clear: expire tracker_rt on the 401 (D-05)

export type TrackerRtCaptureSkip =
  | 'no-key'
  | 'malformed-key'
  | 'no-session'
  | 'no-refresh-token'
  | 'too-large'
  | 'seal-failed'

export type TrackerRtCapture =
  | { sealed: string; skipped: null }
  | { sealed: null; skipped: TrackerRtCaptureSkip }

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

/** D-09: unset, empty, undecodable or not exactly 32 bytes gives null (unconfigured). */
export function parseTrackerRtKey(raw: string | undefined): Uint8Array | null {
  if (!raw) return null
  try {
    const key = base64url.decode(raw.trim())
    return key.length === 32 ? key : null
  } catch {
    return null
  }
}

/** Seals `{ rt, sub }` with an exp 7 days out (D-04). May throw. */
export async function sealTrackerRt(value: TrackerRt, key: Uint8Array): Promise<string> {
  return new EncryptJWT({ rt: value.rt, sub: value.sub })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TRACKER_RT_MAX_AGE)
    .encrypt(key)
}

/** A wrong key, a malformed value, a past or missing exp, or non-string claims give null. Never throws. */
export async function openTrackerRt(jwe: string, key: Uint8Array): Promise<TrackerRt | null> {
  try {
    const { payload } = await jwtDecrypt(jwe, key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
      requiredClaims: ['exp'],
    })
    const { rt, sub } = payload
    if (typeof rt !== 'string' || !rt) return null
    if (typeof sub !== 'string' || !sub) return null
    return { rt, sub }
  } catch {
    return null
  }
}

/**
 * The FastAPI session token's `sub`, decoded WITHOUT verification (D-01, D-02).
 * Missing, unparseable, without a string sub, or at or past its exp gives null.
 */
export function sessionSubject(
  accessToken: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): string | null {
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
  return { ok: true, rt: opened.rt, sub }
}

/**
 * The sign-in callback's capture step (D-07, D-09, D-10). Checks the key, the
 * session sub, the refresh token, sealing and the sealed length, in that
 * order, and reports the first failure. Never throws.
 */
export async function captureTrackerRt(input: {
  rawKey: string | undefined
  sessionToken: string | undefined
  refreshToken: unknown
}): Promise<TrackerRtCapture> {
  if (!input.rawKey) return { sealed: null, skipped: 'no-key' }
  const key = parseTrackerRtKey(input.rawKey)
  if (!key) return { sealed: null, skipped: 'malformed-key' }
  const sub = sessionSubject(input.sessionToken)
  if (!sub) return { sealed: null, skipped: 'no-session' }
  const rt = input.refreshToken
  if (typeof rt !== 'string' || !rt) return { sealed: null, skipped: 'no-refresh-token' }
  let sealed: string
  try {
    sealed = await sealTrackerRt({ rt, sub }, key)
  } catch {
    return { sealed: null, skipped: 'seal-failed' }
  }
  if (sealed.length > TRACKER_RT_MAX_LENGTH) return { sealed: null, skipped: 'too-large' }
  return { sealed, skipped: null }
}
