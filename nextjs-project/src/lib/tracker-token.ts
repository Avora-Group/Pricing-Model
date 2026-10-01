import { NextResponse } from 'next/server'
import {
  redeemTrackerToken,
  tokenResponse,
  tokenErrorResponse,
  TrackerTokenError,
} from '@avora/tracker-client/server'
import {
  TRACKER_RT_COOKIE,
  TRACKER_RT_DELETE,
  TRACKER_RT_SKIP_MESSAGES,
  trackerRtCookieOptions,
  parseTrackerRtKey,
  checkTrackerRt,
  sealTrackerRtCookie,
} from '@/lib/tracker-rt'

/**
 * The body of POST /api/tracker/token (src/app/api/tracker/token/route.ts),
 * apart from reading the request. It takes the two cookie values, the env and
 * an optional `fetch` for the Entra call, so tests can drive every branch,
 * including a successful redeem and a rotation, against a mocked Entra (IN-03).
 * The route passes `process.env` and the real cookies; see the route's header
 * for the access-control and cookie rules this follows.
 */

/**
 * The env this reads: TRACKER_API_SCOPE, TRACKER_RT_KEY, AZURE_TENANT_ID,
 * AZURE_CLIENT_ID and AZURE_CLIENT_SECRET. The route passes process.env.
 */
export type TrackerTokenEnv = Readonly<Record<string, string | undefined>>

export interface TrackerTokenRequest {
  /** The `access_token` cookie (the FastAPI session token). */
  accessToken: string | undefined
  /** The `tracker_rt` cookie. */
  trackerRt: string | undefined
  env: TrackerTokenEnv
  /** A test hook for the Entra token call; defaults to the global fetch. */
  fetch?: typeof fetch
}

/** The package's Response with cookie changes; keeps status, Content-Type and no-store. */
function withCookies(res: Response, apply: (out: NextResponse) => void): NextResponse {
  const out = new NextResponse(res.body, res)
  apply(out)
  return out
}

export async function trackerTokenResponse(input: TrackerTokenRequest): Promise<Response> {
  const { env } = input
  const scope = env.TRACKER_API_SCOPE
  const key = parseTrackerRtKey(env.TRACKER_RT_KEY)
  if (!scope || !key) return tokenErrorResponse(new TrackerTokenError('unconfigured'))

  const check = await checkTrackerRt({
    accessToken: input.accessToken,
    trackerRt: input.trackerRt,
    key,
  })
  if (!check.ok) {
    const res = tokenErrorResponse(new TrackerTokenError('reauth'))
    if (!check.clear) return res
    return withCookies(res, (out) => {
      out.cookies.delete(TRACKER_RT_DELETE)
    })
  }

  try {
    const result = await redeemTrackerToken({
      tenantId: env.AZURE_TENANT_ID,
      clientId: env.AZURE_CLIENT_ID,
      clientSecret: env.AZURE_CLIENT_SECRET,
      refreshToken: check.rt,
      scope,
      fetch: input.fetch,
    })
    const res = tokenResponse(result)
    const rotated = result.refreshToken
    if (!rotated) return res

    // A failed or oversized re-seal still answers the 200 without a cookie:
    // Entra does not revoke a refresh token on use, so the current tracker_rt
    // keeps working. The re-seal keeps the sign-in deadline check.sexp, so
    // rotation never pushes the cookie past the session it was captured from
    // (WR-01), and it goes through the callback's size guard (WR-02).
    const reseal = await sealTrackerRtCookie({ rt: rotated, sub: check.sub, sexp: check.sexp }, key)
    if (reseal.skipped !== null) {
      console.error(`tracker-token: reseal skipped, ${TRACKER_RT_SKIP_MESSAGES[reseal.skipped]}`)
      return res
    }
    const { sealed, maxAge } = reseal
    return withCookies(res, (out) => {
      out.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions(maxAge))
    })
  } catch (e) {
    // The code and Entra's numeric error codes, never a token or a secret:
    // TrackerTokenError's message is derived from the code and its entraCodes
    // are filtered to numbers by the package.
    console.error(
      'tracker-token:',
      e instanceof TrackerTokenError ? `${e.code} ${JSON.stringify(e.entraCodes)}` : 'unexpected',
    )
    return tokenErrorResponse(e)
  }
}
