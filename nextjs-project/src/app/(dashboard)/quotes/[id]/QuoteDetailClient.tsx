'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuoteHydration } from '@/components/quotes/hooks/useQuoteHydration'
import { QuoteHeader } from '@/components/quotes/QuoteHeader'
import { NewQuoteModal } from '@/components/quotes/NewQuoteModal'
import { SummaryTable } from '@/components/pricing/SummaryTable'
import type { QuoteDetailResponse } from '@/app/actions/quotes'
import type { AircraftOption } from '@/lib/api-converters'

interface QuoteDetailClientProps {
  quote: QuoteDetailResponse
  aircraftList?: AircraftOption[]
  isViewer?: boolean
}

export function QuoteDetailClient({ quote, aircraftList = [], isViewer = false }: QuoteDetailClientProps) {
  const { loaded } = useQuoteHydration(quote)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showEdit, setShowEdit] = useState(false)

  // Deep-link target (e.g. from the dashboard): once this quote's data is
  // hydrated into the stores, forward to P&L to inspect it.
  const go = searchParams.get('go')
  useEffect(() => {
    if (loaded && go === 'pnl') {
      router.replace('/pnl')
    }
  }, [loaded, go, router])

  if (go === 'pnl') {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
        Loading {quote.quote_number} into P&L…
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
        onEdit={!isViewer ? () => setShowEdit(true) : undefined}
      />

      {/* Same summary cards as the Pricing Workspace (metrics, ACMI cost
          build-up, cost breakdown), driven by the hydrated pricing store. */}
      {loaded ? (
        <SummaryTable aircraftList={aircraftList} />
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

      {/* In-place edit dialog. After an update, router.refresh() re-fetches
          the quote; the fresh prop re-runs useQuoteHydration, overwriting the
          snapshot the closing dialog restored. */}
      <NewQuoteModal
        isOpen={showEdit}
        editQuote={quote}
        onClose={() => setShowEdit(false)}
        aircraftList={aircraftList}
        onSaved={() => {
          setShowEdit(false)
          router.refresh()
        }}
      />
    </div>
  )
}
