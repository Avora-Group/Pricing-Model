'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, TrendingUp } from 'lucide-react'
import { StatusBadge } from '@/components/quotes/StatusBadge'

interface QuoteHeaderProps {
  quoteNumber: string
  clientName: string
  status: string
  createdAt: string
  /** Opens the in-place edit dialog. Omit (e.g. for viewers) to hide Edit. */
  onEdit?: () => void
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function QuoteHeader({ quoteNumber, clientName, status, createdAt, onEdit }: QuoteHeaderProps) {
  const router = useRouter()

  return (
    <div className="av-panel">
      <div className="av-card-b flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="av-page-title av-num !text-[22px]">
              {quoteNumber}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p style={{ color: 'var(--ink-2)' }}>{clientName}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Created {formatDate(createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/quotes')}
            className="av-btn av-btn-ghost"
          >
            <ArrowLeft size={14} />
            Back to Quotes
          </button>
          <button
            type="button"
            onClick={() => router.push('/pnl')}
            className="av-btn av-btn-ghost"
          >
            <TrendingUp size={14} />
            Go to P&amp;L
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="av-btn av-btn-primary"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
