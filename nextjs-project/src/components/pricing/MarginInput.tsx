'use client'

import { useEffect, useRef } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import { calculatePnlAction } from '@/app/actions/pricing'
import type { CalculateResponse } from '@/app/actions/pricing'
import { useCanViewCosts } from '@/providers/CostVisibilityProvider'
import type { MsnPnlResult, ComponentBreakdown } from '@/stores/pricing-store'
import { computePeriodMonths } from '@/stores/pricing-store'

function mapBreakdown(api: CalculateResponse['msn_results'][number]['breakdown']): ComponentBreakdown {
  return {
    aircraftEurPerBh: api.aircraft_eur_per_bh,
    crewEurPerBh: api.crew_eur_per_bh,
    maintenanceEurPerBh: api.maintenance_eur_per_bh,
    insuranceEurPerBh: api.insurance_eur_per_bh,
    docEurPerBh: api.doc_eur_per_bh,
    otherCogsEurPerBh: api.other_cogs_eur_per_bh,
    overheadEurPerBh: api.overhead_eur_per_bh,
    totalCostPerBh: api.total_cost_per_bh,
    revenuePerBh: api.revenue_per_bh,
    marginPercent: api.margin_percent,
    finalRatePerBh: api.final_rate_per_bh,
  }
}

export function MarginInput() {
  const marginPercent = usePricingStore((s) => s.marginPercent)
  const setMarginPercent = usePricingStore((s) => s.setMarginPercent)
  const msnInputs = usePricingStore((s) => s.msnInputs)
  const exchangeRate = usePricingStore((s) => s.exchangeRate)
  const setIsCalculating = usePricingStore((s) => s.setIsCalculating)
  const setResults = usePricingStore((s) => s.setResults)
  const setLastError = usePricingStore((s) => s.setLastError)
  const msnResults = usePricingStore((s) => s.msnResults)
  const selectedMsn = usePricingStore((s) => s.selectedMsn)
  const rateBasis = usePricingStore((s) => s.rateBasis)
  const canViewCosts = useCanViewCosts()
  const effectiveBasis: 'current' | 'naked' =
    canViewCosts && rateBasis === 'naked' ? 'naked' : 'current'

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recalculate when margin changes (debounced)
  useEffect(() => {
    if (msnInputs.length === 0) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setIsCalculating(true)

      const result = await calculatePnlAction({
        exchange_rate: exchangeRate,
        margin_percent: marginPercent,
        rate_basis: effectiveBasis,
        msn_inputs: msnInputs.map((i) => ({
          msn: i.msn,
          mgh: i.mgh,
          cycle_ratio: i.cycleRatio,
          environment: i.environment,
          period_months: computePeriodMonths(i.periodStart, i.periodEnd),
          lease_type: i.leaseType,
          crew_sets: i.crewSets,
        })),
      })

      if ('error' in result) {
        setLastError(result.error)
        return
      }

      const mapped: MsnPnlResult[] = result.msn_results.map((r) => ({
        msn: r.msn,
        aircraftType: r.aircraft_type,
        breakdown: mapBreakdown(r.breakdown),
        monthlyCost: r.monthly_cost,
        monthlyRevenue: r.monthly_revenue,
        monthlyPnl: r.monthly_pnl,
      }))

      const total = result.total ? mapBreakdown(result.total) : null
      setResults(mapped, total)
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [marginPercent, msnInputs, exchangeRate, effectiveBasis, setIsCalculating, setResults, setLastError])

  // Get current final rate to display
  let finalRate = '--'
  if (selectedMsn !== null) {
    const match = msnResults.find((r) => r.msn === selectedMsn)
    if (match) finalRate = formatEur(match.breakdown.finalRatePerBh)
  } else if (msnResults.length > 0) {
    // Total: use first result's final rate for now, or total if available
    const totalResult = usePricingStore.getState().totalResult
    if (totalResult) {
      finalRate = formatEur(totalResult.finalRatePerBh)
    } else if (msnResults.length === 1) {
      finalRate = formatEur(msnResults[0].breakdown.finalRatePerBh)
    }
  }

  return (
    <div className="av-panel flex items-center gap-4 px-4 py-3">
      <label className="text-sm whitespace-nowrap" style={{ color: 'var(--muted)' }}>Margin:</label>
      <input
        type="number"
        step="0.01"
        min="0"
        max="99"
        value={marginPercent}
        onChange={(e) => setMarginPercent(e.target.value)}
        className="av-input av-num w-20 text-sm text-right"
      />
      <span className="text-sm" style={{ color: 'var(--muted)' }}>%</span>
      <span className="text-sm mx-2" style={{ color: 'var(--muted-2)' }}>=&gt;</span>
      <span className="av-num text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--cyan-ink)' }}>
        Final Rate: EUR {finalRate}/BH
      </span>
    </div>
  )
}

function formatEur(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '--'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
