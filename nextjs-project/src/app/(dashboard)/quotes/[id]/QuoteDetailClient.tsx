'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuoteHydration } from '@/components/quotes/hooks/useQuoteHydration'
import { QuoteHeader } from '@/components/quotes/QuoteHeader'
import { SummaryTable } from '@/components/pricing/SummaryTable'
import type { QuoteDetailResponse } from '@/app/actions/quotes'

interface QuoteDetailClientProps {
  quote: QuoteDetailResponse
}

export function QuoteDetailClient({ quote }: QuoteDetailClientProps) {
  const { loaded } = useQuoteHydration(quote)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Deep-link target (e.g. from the dashboard): once this quote's data is
  // hydrated into the stores, forward to Calculation or P&L to inspect it.
  const go = searchParams.get('go')
  useEffect(() => {
    if (loaded && (go === 'pnl' || go === 'calculation')) {
      router.replace(go === 'pnl' ? '/pnl' : '/calculation')
    }
  }, [loaded, go, router])

  if (go === 'pnl' || go === 'calculation') {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
        Loading {quote.quote_number} into {go === 'pnl' ? 'P&L' : 'Calculation'}…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <QuoteHeader
        quoteNumber={quote.quote_number}
        clientName={quote.client_name}
        status={quote.status}
        createdAt={quote.created_at}
      />

      {/* Same summary cards as the Pricing Workspace (metrics, ACMI cost
          build-up, cost breakdown), driven by the hydrated pricing store. */}
      {loaded ? (
        <SummaryTable />
      ) : (
        <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
          Loading {quote.quote_number}…
        </div>
      )}

      {/* Navigation hint */}
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        Stores are loaded with this quote&apos;s data. Navigate to{' '}
        <Link href="/pnl" className="av-link">
          P&amp;L
        </Link>
        ,{' '}
        <Link href="/crew" className="av-link">
          Crew
        </Link>
        , or{' '}
        <Link href="/costs" className="av-link">
          Costs
        </Link>{' '}
        to see full details from this quote.
      </div>
    </div>
  )
}
