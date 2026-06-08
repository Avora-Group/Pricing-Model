interface QuoteMetricsProps {
  exchangeRate: string
  ebitdaMargin: string
  msnCount: number
}

export function QuoteMetrics({ exchangeRate, ebitdaMargin, msnCount }: QuoteMetricsProps) {
  const cells = [
    { k: 'Exchange rate', v: exchangeRate, unit: 'USD/EUR', mono: true },
    { k: 'EBITDA margin', v: `${ebitdaMargin}`, unit: '%', mono: true },
    { k: 'Aircraft', v: String(msnCount), unit: 'MSN', mono: true },
  ]
  return (
    <div className="av-panel flex flex-wrap">
      {cells.map((c, i) => (
        <div
          key={c.k}
          className={`px-[18px] py-3.5 flex-1 min-w-[150px] ${i < cells.length - 1 ? 'border-r border-[var(--border-primary)]' : ''}`}
        >
          <div className="text-[10px] tracking-[0.1em] uppercase text-[var(--text-muted)] mb-1.5">{c.k}</div>
          <div className={`text-[22px] font-semibold tracking-tight ${c.mono ? 'av-num' : ''}`}>
            {c.v}
            <span className="text-xs text-[var(--text-muted)] font-medium ml-1">{c.unit}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
