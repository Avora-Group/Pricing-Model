import { NextRequest, NextResponse } from 'next/server'
import { sanitizeNext } from '@/lib/safe-next'

const TENANT_ID = process.env.AZURE_TENANT_ID!
const CLIENT_ID = process.env.AZURE_CLIENT_ID!
const REDIRECT_URI = process.env.AZURE_REDIRECT_URI!

export async function GET(req: NextRequest) {
  // Where to land after sign-in (a shared quote link, usually). Azure echoes
  // `state` back verbatim on the callback, which re-validates it before use.
  const next = sanitizeNext(req.nextUrl.searchParams.get('next'))

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: 'openid email profile offline_access',
    state: next,
  })

  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params}`
  return NextResponse.redirect(url)
}
