'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuoteHydration } from '@/components/quotes/hooks/useQuoteHydration'
import { QuoteHeader } from '@/components/quotes/QuoteHeader'
import { NewQuoteModal } from '@/components/quotes/NewQuoteModal'
import { QuoteParamsRail } from '@/components/quotes/QuoteParamsRail'
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
  // Deep-link from the dashboard fleet board: ?edit=1 opens the quote straight
  // in the Pricing Workspace dialog (editors only).
  const [showEdit, setShowEdit] = useState(!isViewer && searchParams.get('edit') === '1')

  // Legacy deep-link (?go=pnl): the P&L page is standalone now and loads its
  // own quote — forward there directly.
  const go = searchParams.get('go')
  useEffect(() => {
    if (go === 'pnl') {
      router.replace(`/pnl?quote=${quote.id}`)
    }
  }, [go, quote.id, router])

  if (go === 'pnl') {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
        Opening {quote.quote_number} in P&L…
      </div>
    )
  }

  // Closing the dialog also drops the ?edit=1 param so a refresh doesn't reopen it.
  const closeEdit = () => {
    setShowEdit(false)
    if (searchParams.get('edit') === '1') {
      router.replace(`/quotes/${quote.id}`, { scroll: false })
    }
  }

  return (
    <div className="space-y-6">
      <QuoteHeader
        quoteNumber={quote.quote_number}
        clientName={quote.client_name}
        status={quote.status}
        createdAt={quote.created_at}
        pnlHref={`/pnl?quote=${quote.id}`}
        sharePath={`/quotes/${quote.id}`}
        onEdit={!isViewer ? () => setShowEdit(true) : undefined}
      />

      {/* Same view as the Pricing Workspace: deal-parameter rail (read-only)
          beside the live results (metrics, ACMI cost build-up, sensitivity,
          cost breakdown), all driven by the hydrated pricing store. */}
      {loaded ? (
        <div className="av-workspace">
          <div className="av-rail">
            <QuoteParamsRail />
          </div>
          <div className="min-w-0">
            <SummaryTable aircraftList={aircraftList} editable={!isViewer} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
          Loading {quote.quote_number}…
        </div>
      )}

      {/* Navigation hint */}
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        See this quote&apos;s full monthly statement on the{' '}
        <Link href={`/pnl?quote=${quote.id}`} className="av-link">
          P&amp;L
        </Link>{' '}
        page. This quote&apos;s own crew and cost assumptions are edited in its Edit
        dialog (Crew / Costs tabs); the Crew and Costs pages hold the company
        defaults for new quotes.
      </div>

      {/* In-place edit dialog. After an update, router.refresh() re-fetches
          the quote; the fresh prop re-runs useQuoteHydration, overwriting the
          snapshot the closing dialog restored. */}
      <NewQuoteModal
        isOpen={showEdit}
        editQuote={quote}
        onClose={closeEdit}
        aircraftList={aircraftList}
        onSaved={() => {
          closeEdit()
          router.refresh()
        }}
      />
    </div>
  )
}
