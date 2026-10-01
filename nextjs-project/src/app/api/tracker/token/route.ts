import type { NextRequest } from 'next/server'
import { TRACKER_RT_COOKIE } from '@/lib/tracker-rt'
import { trackerTokenResponse } from '@/lib/tracker-token'

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
 * `tracker_rt` with the same attributes, so the 7-day window slides, but never
 * past the exp of the sign-in session it was captured from (`sexp`, WR-01).
 */
export const dynamic = 'force-dynamic'

// The logic lives in src/lib/tracker-token.ts so tests can drive it with a
// mocked Entra (IN-03). This handler only reads the two cookies and the env.
export async function POST(req: NextRequest) {
  return trackerTokenResponse({
    accessToken: req.cookies.get('access_token')?.value,
    trackerRt: req.cookies.get(TRACKER_RT_COOKIE)?.value,
    env: process.env,
  })
}
