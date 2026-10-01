import { NextResponse, type NextRequest } from 'next/server'
import {
  redeemTrackerToken,
  tokenResponse,
  tokenErrorResponse,
  TrackerTokenError,
} from '@avora/tracker-client/server'
import {
  TRACKER_RT_COOKIE,
  TRACKER_RT_DELETE,
  trackerRtCookieOptions,
  parseTrackerRtKey,
  checkTrackerRt,
  sealTrackerRt,
} from '@/lib/tracker-rt'

/**
 * POST /api/tracker/token: an access token for the Avora tracker API, for the
 * signed-in user.
 *
 * ACMI signs in on the server, so the browser holds no Microsoft token to hand
 * @avora/tracker-client. Entra refresh tokens are multi-resource, though. At
 * sign-in the callback seals the refresh token into the httpOnly `tracker_rt`
 * cookie, and here ACMI's own confidential client redeems it for the tracker
 * scope. The resulting token's azp is ACMI's client id, which the tracker maps
 * to source_app "acmi-app". Nothing changes on the tracker side.
 *
 * Access control: ACMI's src/middleware.ts matcher skips /api, so this route
 * checks the `access_token` session itself. It only opens a `tracker_rt` sealed
 * for the same `sub`. That is a consistency check against a stale cookie on a
 * shared browser, not authentication: Next.js holds no FastAPI signing secret,
 * so it decodes the session token without verifying it.
 *
 * There is no Origin check. Both cookies are SameSite=Lax, so a cross-site POST
 * carries neither, and the response carries no CORS headers, so only ACMI's own
 * pages can read it.
 *
 * Every failure answers in JSON and never redirects, which is what the
 * package's browser getter expects. A signed-in user without `tracker_rt` (a
 * session from before this route existed, or one started while the key was
 * unset) gets `reauth`, and signing out and in again recovers.
 *
 * Cookies: a `tracker_rt` that will not open, is past its exp or was sealed
 * for another user is cleared on the same 401. A session or Entra failure
 * leaves it alone. When Entra rotates the refresh token, the 200 re-sets
 * `tracker_rt` with the same attributes, so the 7-day window slides.
 */
export const dynamic = 'force-dynamic'

/** The package's Response with cookie changes; keeps status, Content-Type and no-store. */
function withCookies(res: Response, apply: (out: NextResponse) => void): NextResponse {
  const out = new NextResponse(res.body, res)
  apply(out)
  return out
}

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
    if (!check.clear) return res
    return withCookies(res, (out) => {
      out.cookies.delete(TRACKER_RT_DELETE)
    })
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
    const rotated = result.refreshToken
    if (!rotated) return res

    // A failed re-seal still answers the 200 without a cookie: Entra does not
    // revoke a refresh token on use, so the current tracker_rt keeps working.
    const sealed = await sealTrackerRt({ rt: rotated, sub: check.sub }, key).catch(() => null)
    if (sealed === null) {
      console.error('tracker-token: reseal failed')
      return res
    }
    return withCookies(res, (out) => {
      out.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions)
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
