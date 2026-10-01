import { NextRequest, NextResponse } from 'next/server'
import { sanitizeNext } from '@/lib/safe-next'
import {
  OAUTH_FLOW_COOKIE,
  oauthFlowCookieOptions,
  newOAuthFlow,
  pkceChallenge,
  serializeOAuthFlow,
  buildOAuthState,
} from '@/lib/oauth-flow'

const TENANT_ID = process.env.AZURE_TENANT_ID!
const CLIENT_ID = process.env.AZURE_CLIENT_ID!
const REDIRECT_URI = process.env.AZURE_REDIRECT_URI!

export async function GET(req: NextRequest) {
  // Where to land after sign-in (a shared quote link, usually). Azure echoes
  // `state` back verbatim on the callback, which re-validates it before use.
  const next = sanitizeNext(req.nextUrl.searchParams.get('next'))

  // Bind this sign-in to this browser (WR-03): the nonce rides in `state` and
  // in the azure_oauth cookie, and the PKCE verifier stays in the cookie while
  // only its S256 challenge goes to Entra. See src/lib/oauth-flow.ts.
  const flow = newOAuthFlow()

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: 'openid email profile offline_access',
    state: buildOAuthState(flow.nonce, next),
    code_challenge: pkceChallenge(flow.verifier),
    code_challenge_method: 'S256',
  })

  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params}`
  const response = NextResponse.redirect(url)
  response.cookies.set(OAUTH_FLOW_COOKIE, serializeOAuthFlow(flow), oauthFlowCookieOptions)
  return response
}
