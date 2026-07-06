'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const AZURE_ERRORS: Record<string, string> = {
  azure_failed: 'Azure login was cancelled or failed',
  token_failed: 'Failed to authenticate with Azure',
  missing_claims: 'Azure account is missing required information',
  api_failed: 'Failed to create account. Contact your administrator.',
  not_allowed: 'You do not have access to this application. Please ask an administrator to invite you.',
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const azureError = searchParams.get('error')

  return (
    <div className="av-panel w-full" style={{ maxWidth: 400 }}>
      <div className="av-card-b" style={{ padding: 32 }}>
        {/* Brand lockup */}
        <div className="flex flex-col items-center text-center mb-7">
          {/* Card follows the theme → navy wordmark on light, white on dark */}
          <img
            src="/fly2sky_logo.png"
            alt="Fly2Sky JSC"
            className="f2s-logo-light mb-3"
            style={{ height: 40, width: 'auto', objectFit: 'contain' }}
          />
          <img
            src="/fly2sky_logo_white.png"
            alt="Fly2Sky JSC"
            className="f2s-logo-dark mb-3"
            style={{ height: 40, width: 'auto', objectFit: 'contain' }}
          />
          <div
            style={{
              color: 'var(--muted)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '.18em',
            }}
          >
            ACMI Pricing
          </div>
        </div>

        {azureError && (
          <p
            className="text-sm rounded-lg px-3 py-2 mb-5"
            style={{
              color: 'var(--neg)',
              background: 'var(--neg-soft)',
              border: '1px solid color-mix(in srgb, var(--neg) 30%, transparent)',
            }}
          >
            {AZURE_ERRORS[azureError] ?? 'Login failed'}
          </p>
        )}

        <a
          href="/api/auth/login/azure"
          className="av-btn av-btn-cyan w-full justify-center"
        >
          <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Sign in with Microsoft
        </a>

        <p className="text-center mt-6" style={{ color: 'var(--muted)', fontSize: 12 }}>
          Fly2Sky JSC · ACMI &amp; wet-lease pricing
        </p>
      </div>
    </div>
  )
}
