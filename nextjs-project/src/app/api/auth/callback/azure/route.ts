import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_NEXT, sanitizeNext } from '@/lib/safe-next'
import {
  TRACKER_RT_COOKIE,
  TRACKER_RT_DELETE,
  TRACKER_RT_SKIP_MESSAGES,
  trackerRtCookieOptions,
  captureTrackerRt,
  type TrackerRtCapture,
} from '@/lib/tracker-rt'

const TENANT_ID = process.env.AZURE_TENANT_ID!
const CLIENT_ID = process.env.AZURE_CLIENT_ID!
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!
const REDIRECT_URI = process.env.AZURE_REDIRECT_URI!
const API_BASE = process.env.API_URL ?? 'http://localhost:8000'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * Back to the login screen, keeping the intended destination so a retry still
 * lands on the shared link rather than the dashboard.
 */
function loginRedirect(req: NextRequest, error: string, next: string) {
  const url = new URL('/login', req.url)
  url.searchParams.set('error', error)
  if (next !== DEFAULT_NEXT) url.searchParams.set('next', next)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  // `state` carries the post-login destination set by /api/auth/login/azure.
  // It came back through the browser, so it is validated again here.
  const next = sanitizeNext(req.nextUrl.searchParams.get('state'))

  try {
    const code = req.nextUrl.searchParams.get('code')
    const error = req.nextUrl.searchParams.get('error')

    if (error || !code) {
      const desc = req.nextUrl.searchParams.get('error_description') ?? 'Azure login failed'
      console.error('[azure-callback] Error:', error, desc)
      return loginRedirect(req, 'azure_failed', next)
    }

    // Exchange auth code for tokens
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
          scope: 'openid email profile offline_access',
        }),
      },
    )

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('[azure-callback] Token exchange failed:', err)
      return loginRedirect(req, 'token_failed', next)
    }

    const tokens = await tokenRes.json()

    // Decode the id_token to get user info (JWT payload is base64url)
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString(),
    )

    const email = payload.preferred_username ?? payload.email
    const fullName = payload.name ?? null
    const azureId = payload.oid // Azure object ID

    if (!email || !azureId) {
      console.error('[azure-callback] Missing email or oid in token:', payload)
      return loginRedirect(req, 'missing_claims', next)
    }

    // Call FastAPI to create/find user and get JWT
    const apiRes = await fetch(`${API_BASE}/auth/azure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName, azure_id: azureId }),
    })

    if (!apiRes.ok) {
      const err = await apiRes.text()
      console.error('[azure-callback] API call failed:', apiRes.status, err)
      if (apiRes.status === 403) {
        return loginRedirect(req, 'not_allowed', next)
      }
      return loginRedirect(req, 'api_failed', next)
    }

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

    // tracker_rt is always freshly set or deleted (D-07); nothing in this step can change how sign-in ends (D-10).
    let capture: TrackerRtCapture | null = null
    try {
      capture = await captureTrackerRt({
        rawKey: process.env.TRACKER_RT_KEY,
        sessionToken: token,
        refreshToken: tokens.refresh_token,
      })
    } catch {
      console.error('[azure-callback] tracker-rt: capture failed')
    }
    const skipped = capture?.skipped ?? null
    const skipMessage = skipped ? TRACKER_RT_SKIP_MESSAGES[skipped] : null
    if (skipMessage) console.error(`[azure-callback] tracker-rt: ${skipMessage}`)
    const sealed = capture?.sealed ?? null
    if (sealed) response.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions)
    else response.cookies.delete(TRACKER_RT_DELETE)
    return response
  } catch (e) {
    console.error('[azure-callback] Unexpected error:', e)
    return loginRedirect(req, 'api_failed', next)
  }
}
