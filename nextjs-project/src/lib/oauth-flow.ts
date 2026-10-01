/**
 * Ties an Azure sign-in to the browser that started it (code review WR-03).
 *
 * The login route makes a random nonce and a PKCE code verifier, keeps both in
 * the short-lived httpOnly `azure_oauth` cookie scoped to the callback path,
 * sends `state = nonce + '.' + next` and the S256 `code_challenge` to Entra,
 * and the callback checks them before it redeems the code:
 * - the nonce in `state` must equal the cookie's, compared in constant time;
 * - the code exchange sends the cookie's `code_verifier`, so Entra refuses a
 *   code that was issued to another browser's flow.
 * Either check failing is `azure_failed`, and the callback deletes the cookie
 * on every answer. Without this, a link to the callback carrying an
 * attacker's code signs the victim in as the attacker and plants the
 * attacker's refresh token in `tracker_rt` (login CSRF).
 *
 * Every parser here fails closed: bad input gives null, never a throw. Nothing
 * in this module logs. It imports only `node:crypto`, so `node --test` can load
 * it directly.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const OAUTH_FLOW_COOKIE = 'azure_oauth'
export const OAUTH_FLOW_PATH = '/api/auth/callback/azure'
// Seconds: long enough for a sign-in with MFA, short enough to go stale fast.
export const OAUTH_FLOW_MAX_AGE = 600

/** Every set of azure_oauth uses exactly these attributes. */
export const oauthFlowCookieOptions = Object.freeze({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: OAUTH_FLOW_MAX_AGE,
  path: OAUTH_FLOW_PATH,
})

/** Every delete of azure_oauth uses exactly this: name and path only. */
export const OAUTH_FLOW_DELETE = Object.freeze({ name: OAUTH_FLOW_COOKIE, path: OAUTH_FLOW_PATH })

// 32 random bytes as base64url: 43 characters, no padding. A PKCE verifier
// must be 43 to 128 characters of [A-Za-z0-9-._~], which this satisfies.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const newToken = () => randomBytes(32).toString('base64url')

export interface OAuthFlow {
  nonce: string
  verifier: string
}

/** A fresh nonce and PKCE code verifier for one sign-in. */
export function newOAuthFlow(): OAuthFlow {
  return { nonce: newToken(), verifier: newToken() }
}

/** The PKCE S256 code_challenge: base64url(SHA-256(verifier)), RFC 7636 section 4.2. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

/** The azure_oauth cookie value: `nonce.verifier`. */
export function serializeOAuthFlow(flow: OAuthFlow): string {
  return `${flow.nonce}.${flow.verifier}`
}

/** The azure_oauth cookie value back as a flow. Anything but two well-formed parts gives null. */
export function parseOAuthFlow(raw: string | null | undefined): OAuthFlow | null {
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [nonce, verifier] = parts
  if (!TOKEN_RE.test(nonce) || !TOKEN_RE.test(verifier)) return null
  return { nonce, verifier }
}

/** The OAuth `state`: the nonce, a dot, then the post-login path. */
export function buildOAuthState(nonce: string, next: string): string {
  return `${nonce}.${next}`
}

/**
 * Splits `state` at its first dot. A missing or malformed nonce gives null.
 * `next` comes back unvalidated: the caller still runs it through sanitizeNext.
 */
export function parseOAuthState(state: string | null | undefined): { nonce: string; next: string } | null {
  if (!state) return null
  const dot = state.indexOf('.')
  if (dot < 0) return null
  const nonce = state.slice(0, dot)
  if (!TOKEN_RE.test(nonce)) return null
  return { nonce, next: state.slice(dot + 1) }
}

/** Constant-time comparison of the state's nonce with the cookie's. */
export function nonceMatches(fromState: string, fromCookie: string): boolean {
  const a = Buffer.from(fromState)
  const b = Buffer.from(fromCookie)
  return a.length === b.length && timingSafeEqual(a, b)
}
