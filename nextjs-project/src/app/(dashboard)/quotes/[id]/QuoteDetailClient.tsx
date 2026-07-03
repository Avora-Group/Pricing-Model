'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuoteHydration } from '@/components/quotes/hooks/useQuoteHydration'
import { QuoteHeader } from '@/components/quotes/QuoteHeader'
import { QuoteMetrics } from '@/components/quotes/QuoteMetrics'
import { QuoteMsnTable } from '@/components/quotes/QuoteMsnTable'
import type { QuoteDetailResponse } from '@/app/actions/quotes'

interface QuoteDetailClientProps {
  quote: QuoteDetailResponse
}

export function QuoteDetailClient({ quote }: QuoteDetailClientProps) {
  const { loaded, msnSummaries } = useQuoteHydration(quote)
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

  const dashState = quote.dashboard_state as Record<string, string> | null

  // Compute EBITDA margin from MSN summaries (D&A is 0 in the model, so netProfit ≈ EBITDA)
  const totals = msnSummaries.reduce(
    (acc, s) => ({
      totalRevenue: acc.totalRevenue + s.totalRevenue,
      netProfit: acc.netProfit + s.netProfit,
    }),
    { totalRevenue: 0, netProfit: 0 },
  )
  const ebitdaMargin = totals.totalRevenue > 0
    ? ((totals.netProfit / totals.totalRevenue) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-6">
      <QuoteHeader
        quoteNumber={quote.quote_number}
        clientName={quote.client_name}
        status={quote.status}
        createdAt={quote.created_at}
      />

      <QuoteMetrics
        exchangeRate={dashState?.exchangeRate ?? quote.exchange_rate}
        ebitdaMargin={ebitdaMargin}
        msnCount={quote.msn_list?.length ?? 0}
      />

      {loaded && quote.msn_snapshots && quote.msn_snapshots.length > 0 && (
        <QuoteMsnTable
          msnSnapshots={quote.msn_snapshots}
          msnSummaries={msnSummaries}
        />
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
