import { useState, useMemo, useCallback } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import type { MsnInput } from '@/stores/pricing-store'
import type { AircraftOption } from '@/lib/api-converters'

/**
 * Custom hook that manages aircraft selection and addition logic.
 *
 * Handles:
 *  - selected aircraft state
 *  - filtering available aircraft (excluding already-added MSNs)
 *  - building a new MsnInput from the selected AircraftOption
 *  - adding it to the pricing store
 */
export function useAddAircraft(
  aircraftList: AircraftOption[],
  msnInputs: MsnInput[],
  bhFhRatio: string,
  apuFhRatio: string,
) {
  const { addMsnInput } = usePricingStore()
  const [selectedAircraft, setSelectedAircraft] = useState('')

  const availableAircraft = useMemo(
    () => aircraftList.filter((ac) => !msnInputs.some((i) => i.msn === ac.msn)),
    [aircraftList, msnInputs],
  )

  const handleAddAircraft = useCallback(() => {
    if (!selectedAircraft) return
    const ac = aircraftList.find((a) => a.id === Number(selectedAircraft))
    if (!ac) return

    // Prevent duplicate MSN
    if (msnInputs.some((i) => i.msn === ac.msn)) return

    // Default: 1st of current month to last day of 12th month ahead
    const now = new Date()
    const startYear = now.getFullYear()
    const startMonth = now.getMonth() + 1 // 1-indexed
    const defaultStart = `${startYear}-${String(startMonth).padStart(2, '0')}-01`
    const endDate = new Date(startYear, startMonth - 1 + 12, 0) // last day of 12th month ahead
    const endYear = endDate.getFullYear()
    const endMonth = endDate.getMonth() + 1
    const endDay = endDate.getDate()
    const defaultEnd = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

    const newInput: MsnInput = {
      aircraftId: ac.id,
      msn: ac.msn,
      aircraftType: ac.aircraft_type,
      registration: ac.registration,
      mgh: '350',
      cycleRatio: '1.0',
      environment: 'benign',
      periodStart: defaultStart,
      periodEnd: defaultEnd,
      leaseType: 'wet',
      crewSets: 4,
      rateCurrency: 'eur',
      acmiRate: '0',
      excessBh: '0',
      excessHourRate: '0',
      bhFhRatio: bhFhRatio,
      apuFhRatio: apuFhRatio,
      // Aircraft rates from Aircraft tab (EUR, fixed)
      leaseRentEur: ac.lease_rent_eur ?? '0',
      sixYearCheckEur: ac.six_year_check_eur ?? '0',
      twelveYearCheckEur: ac.twelve_year_check_eur ?? '0',
      ldgEur: ac.ldg_eur ?? '0',
      // Aircraft rates from Aircraft tab (USD, variable per engine)
      apuRateUsd: ac.apu_rate_usd ?? '0',
      llp1RateUsd: ac.llp1_rate_usd ?? '0',
      llp2RateUsd: ac.llp2_rate_usd ?? '0',
      // EPR matrix from Aircraft tab
      eprMatrix: (ac.epr_matrix ?? []).map((r) => ({
        cycleRatio: parseFloat(r.cycle_ratio),
        benignRate: parseFloat(r.benign_rate),
        hotRate: parseFloat(r.hot_rate),
      })),
      // Naked rates (present only for cost-access users + aircraft with naked data)
      hasNakedRates: Boolean(ac.has_naked_rates),
      nakedLeaseRentEur: ac.naked_lease_rent_eur ?? undefined,
      nakedSixYearCheckEur: ac.naked_six_year_check_eur ?? undefined,
      nakedTwelveYearCheckEur: ac.naked_twelve_year_check_eur ?? undefined,
      nakedLdgEur: ac.naked_ldg_eur ?? undefined,
      nakedApuRateUsd: ac.naked_apu_rate_usd ?? undefined,
      nakedLlp1RateUsd: ac.naked_llp1_rate_usd ?? undefined,
      nakedLlp2RateUsd: ac.naked_llp2_rate_usd ?? undefined,
      nakedEprMatrix: (ac.naked_epr_matrix ?? []).map((r) => ({
        cycleRatio: parseFloat(r.cycle_ratio),
        benignRate: parseFloat(r.benign_rate),
        hotRate: parseFloat(r.hot_rate),
      })),
      // Seasonality (off by default)
      seasonalityEnabled: false,
      // Fixed cost coverage (off by default)
      fixedCostCoverageEnabled: false,
      fixedCostCoveragePercent: '50',
      fixedCostCoverageMonths: '6',
    }

    addMsnInput(newInput)
    setSelectedAircraft('')
  }, [selectedAircraft, aircraftList, msnInputs, bhFhRatio, apuFhRatio, addMsnInput])

  return {
    selectedAircraft,
    setSelectedAircraft,
    handleAddAircraft,
    availableAircraft,
  }
}
