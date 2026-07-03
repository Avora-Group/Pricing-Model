'use client'

import { useCanViewCosts } from '@/providers/CostVisibilityProvider'
import { Redacted } from '@/components/common/Redacted'

interface QuoteMetricsProps {
  exchangeRate: string
  ebitdaMargin: string
  msnCount: number
}

export function QuoteMetrics({ exchangeRate, ebitdaMargin, msnCount }: QuoteMetricsProps) {
  const canViewCosts = useCanViewCosts()
  // EBITDA margin is a naked-cost figure — redact it for unpermitted users.
  const cells = [
    { k: 'Exchange rate', v: exchangeRate as string | null, unit: 'USD/EUR', variant: 'k-navy', sensitive: false },
    { k: 'EBITDA margin', v: canViewCosts ? `${ebitdaMargin}` : null, unit: '%', variant: 'k-green', sensitive: true },
    { k: 'Aircraft', v: String(msnCount), unit: 'MSN', variant: 'k-amber', sensitive: false },
  ]
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      {cells.map((c) => (
        <div key={c.k} className={`av-kpi ${c.variant}`}>
          <div className="lab">{c.k}</div>
          <div className="val av-num">
            {c.sensitive && !canViewCosts ? (
              <Redacted />
            ) : (
              <>
                {c.v}
                <span className="text-sm font-medium ml-1" style={{ color: 'var(--muted)' }}>{c.unit}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
