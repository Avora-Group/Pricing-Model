'use client'

import { useMemo } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { computeMsnPnlSummarySeasonal } from '@/lib/pnl-engine'
import type { CrewStoreData, CostsStoreData } from '@/lib/pnl-engine'
import type { MsnInput } from '@/stores/pricing-store'

interface ProjectTotals {
  costPerBh: number
  netProfit: number
  margin: number
}

function projectTotals(
  inputs: MsnInput[],
  crew: CrewStoreData,
  costs: CostsStoreData,
  exchangeRate: number,
): ProjectTotals {
  let cost = 0
  let revenue = 0
  let bh = 0
  for (const input of inputs) {
    const s = computeMsnPnlSummarySeasonal(input, crew, costs, exchangeRate)
    cost += s.totalCost
    revenue += s.totalRevenue
    bh += s.totalBh
  }
  return {
    costPerBh: bh > 0 ? cost / bh : 0,
    netProfit: revenue - cost,
    margin: revenue > 0 ? (revenue - cost) / revenue : 0,
  }
}

const eur = (n: number, d = 0) =>
  `€${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`

/**
 * Live project totals while editing the quote's crew / cost assumptions,
 * with the change against the assumptions the quote was opened with. Uses the
 * same client engine as the saved-quote figures, so the numbers match what
 * the quote will show after Update Quote.
 */
export function AssumptionsImpact({ baseline }: { baseline: { crew: CrewStoreData; costs: CostsStoreData } }) {
  const msnInputs = usePricingStore((s) => s.msnInputs)
  const exchangeRate = parseFloat(usePricingStore((s) => s.exchangeRate) || '0.85')
  const crew = useCrewConfigStore()
  const costs = useCostsConfigStore()

  const committed = useMemo(() => msnInputs.filter((i) => !i.isDraft), [msnInputs])
  const now = useMemo(
    () => projectTotals(committed, crew, costs, exchangeRate),
    [committed, crew, costs, exchangeRate],
  )
  const before = useMemo(
    () => projectTotals(committed, baseline.crew, baseline.costs, exchangeRate),
    [committed, baseline, exchangeRate],
  )

  if (committed.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Add an aircraft on the Deal &amp; Aircraft tab to see the effect of these assumptions.
      </p>
    )
  }

  const delta = (value: number, fmt: (n: number) => string, higherIsBetter: boolean) => {
    if (Math.abs(value) < 1e-9) return <span style={{ color: 'var(--muted)' }}>no change</span>
    const good = higherIsBetter ? value > 0 : value < 0
    return (
      <span className={good ? 'av-pos' : 'av-neg'}>
        {value > 0 ? '+' : '−'}{fmt(Math.abs(value))} vs opened
      </span>
    )
  }

  const tiles = [
    {
      label: 'Cost per BH',
      value: eur(now.costPerBh, 2),
      delta: delta(now.costPerBh - before.costPerBh, (n) => eur(n, 2), false),
    },
    {
      label: 'Net profit (term)',
      value: eur(now.netProfit),
      delta: delta(now.netProfit - before.netProfit, (n) => eur(n), true),
    },
    {
      label: 'Margin',
      value: `${(now.margin * 100).toFixed(1)}%`,
      delta: delta((now.margin - before.margin) * 100, (n) => `${n.toFixed(1)} pp`, true),
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="av-kpi !py-3">
          <div className="lab">{t.label}</div>
          <div className="val av-num !text-[22px] !mt-1.5">{t.value}</div>
          <div className="sub av-num !mt-1">{t.delta}</div>
        </div>
      ))}
    </div>
  )
}
