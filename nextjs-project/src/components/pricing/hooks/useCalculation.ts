import { useEffect, useRef } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import type { MsnInput } from '@/stores/pricing-store'
import { computePeriodMonths } from '@/stores/pricing-store'
import { calculatePnlAction } from '@/app/actions/pricing'
import type { CalculateResponse } from '@/app/actions/pricing'
import { toStoreMsnResult, toStoreBreakdown } from '@/lib/api-converters'

/**
 * Custom hook that runs a debounced P&L calculation whenever
 * msnInputs, exchangeRate, or marginPercent change.
 *
 * Manages the debounce timer internally and updates the pricing
 * store with the calculation results.
 */
export function useCalculation(
  msnInputs: MsnInput[],
  exchangeRate: string,
  marginPercent: string,
  rateBasis: 'current' | 'naked' = 'current',
): void {
  const { setResults, setIsCalculating, setLastError } = usePricingStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A calculation that is mid-flight when this component unmounts (e.g. the
  // New Quote dialog closing and restoring workspace state) must not write
  // its result into the store afterwards.
  const aliveRef = useRef(true)
  const inFlightRef = useRef(false)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      // A calculation still in flight can never clear the shared
      // isCalculating flag after this unmount (the alive guard drops its
      // write), so clear it here — otherwise the P&L view stays dimmed.
      if (inFlightRef.current) usePricingStore.getState().setIsCalculating(false)
    }
  }, [])

  useEffect(() => {
    if (msnInputs.length === 0) {
      setResults([], null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setIsCalculating(true)
      inFlightRef.current = true
      setLastError(null)

      // Expand seasonal MSNs into two entries (one per season)
      const expandedInputs = msnInputs.flatMap((i) => {
        if (i.seasonalityEnabled && i.summer && i.winter) {
          return [
            {
              msn: i.msn,
              mgh: i.summer.mgh,
              cycle_ratio: i.summer.cycleRatio,
              environment: i.environment,
              period_months: computePeriodMonths(i.summer.periodStart, i.summer.periodEnd),
              lease_type: i.leaseType,
              crew_sets: i.summer.crewSets,
            },
            {
              msn: i.msn,
              mgh: i.winter.mgh,
              cycle_ratio: i.winter.cycleRatio,
              environment: i.environment,
              period_months: computePeriodMonths(i.winter.periodStart, i.winter.periodEnd),
              lease_type: i.leaseType,
              crew_sets: i.winter.crewSets,
            },
          ]
        }
        return [{
          msn: i.msn,
          mgh: i.mgh,
          cycle_ratio: i.cycleRatio,
          environment: i.environment,
          period_months: computePeriodMonths(i.periodStart, i.periodEnd),
          lease_type: i.leaseType,
          crew_sets: i.crewSets,
        }]
      })

      const result = await calculatePnlAction({
        exchange_rate: exchangeRate,
        margin_percent: marginPercent,
        rate_basis: rateBasis,
        msn_inputs: expandedInputs,
      })

      inFlightRef.current = false

      if (!aliveRef.current) return

      if ('error' in result) {
        setLastError(result.error)
        setIsCalculating(false)
        return
      }

      const calcResponse = result as CalculateResponse
      const rawConverted = calcResponse.msn_results.map(toStoreMsnResult)

      // Merge duplicate MSN results (from seasonal expansion) by averaging breakdowns
      const mergedMap = new Map<number, typeof rawConverted[0]>()
      const countMap = new Map<number, number>()
      for (const r of rawConverted) {
        const existing = mergedMap.get(r.msn)
        if (existing) {
          const count = (countMap.get(r.msn) ?? 1) + 1
          countMap.set(r.msn, count)
          // Running average of breakdown fields
          const avgField = (field: keyof typeof existing.breakdown) =>
            String(
              ((parseFloat(existing.breakdown[field]) * (count - 1)) + parseFloat(r.breakdown[field])) / count
            )
          existing.breakdown = {
            aircraftEurPerBh: avgField('aircraftEurPerBh'),
            crewEurPerBh: avgField('crewEurPerBh'),
            maintenanceEurPerBh: avgField('maintenanceEurPerBh'),
            insuranceEurPerBh: avgField('insuranceEurPerBh'),
            docEurPerBh: avgField('docEurPerBh'),
            otherCogsEurPerBh: avgField('otherCogsEurPerBh'),
            overheadEurPerBh: avgField('overheadEurPerBh'),
            totalCostPerBh: avgField('totalCostPerBh'),
            revenuePerBh: avgField('revenuePerBh'),
            marginPercent: avgField('marginPercent'),
            finalRatePerBh: avgField('finalRatePerBh'),
          }
          existing.monthlyCost = String(
            ((parseFloat(existing.monthlyCost) * (count - 1)) + parseFloat(r.monthlyCost)) / count
          )
          existing.monthlyRevenue = String(
            ((parseFloat(existing.monthlyRevenue) * (count - 1)) + parseFloat(r.monthlyRevenue)) / count
          )
          existing.monthlyPnl = String(
            ((parseFloat(existing.monthlyPnl) * (count - 1)) + parseFloat(r.monthlyPnl)) / count
          )
        } else {
          mergedMap.set(r.msn, { ...r })
          countMap.set(r.msn, 1)
        }
      }
      const converted = Array.from(mergedMap.values())

      const total = calcResponse.total
        ? toStoreBreakdown(calcResponse.total)
        : null

      setResults(converted, total)
      setIsCalculating(false)
    }, 500)

    // Load-bearing beyond debouncing: the /calculation leak guard resets the
    // stores on mount and relies on this cleanup to cancel a timer scheduled
    // over pre-reset inputs — without it, leaked results reappear ~500ms in.
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msnInputs, exchangeRate, marginPercent, rateBasis])
}
