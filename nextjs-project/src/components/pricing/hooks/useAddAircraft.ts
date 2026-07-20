import { useMemo, useCallback } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import type { MsnInput } from '@/stores/pricing-store'
import type { AircraftOption } from '@/lib/api-converters'

/** Build a fresh MsnInput from an aircraft's master data with pricing defaults. */
export function buildMsnInput(
  ac: AircraftOption,
  bhFhRatio: string,
  apuFhRatio: string,
): MsnInput {
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

  return {
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
}

/**
 * Draft-aircraft selection logic.
 *
 * Selecting an aircraft from the dropdown immediately creates a *draft*
 * MsnInput (isDraft: true) so the pricing engine runs live and the user can
 * tune parameters. "Add aircraft" commits the draft into a permanent tab.
 * At most one draft exists at a time; selecting a different aircraft
 * replaces it.
 */
export function useAddAircraft(
  aircraftList: AircraftOption[],
  msnInputs: MsnInput[],
  bhFhRatio: string,
  apuFhRatio: string,
) {
  const { addMsnInput, removeMsnInput, patchMsnInput } = usePricingStore()

  const draft = useMemo(() => msnInputs.find((i) => i.isDraft) ?? null, [msnInputs])

  // Exclude committed MSNs only — the draft's aircraft stays listed so the
  // dropdown's value binding to it remains valid.
  const availableAircraft = useMemo(
    () => aircraftList.filter((ac) => !msnInputs.some((i) => !i.isDraft && i.msn === ac.msn)),
    [aircraftList, msnInputs],
  )

  /** Replace the current draft (if any) with a new draft for this aircraft.
   *  Returns the draft's MSN, or null when the id is unknown or the MSN is
   *  already committed. */
  const selectAircraft = useCallback((aircraftId: string): number | null => {
    const ac = aircraftList.find((a) => a.id === Number(aircraftId))
    if (!ac) return null
    if (msnInputs.some((i) => !i.isDraft && i.msn === ac.msn)) return null
    const current = msnInputs.find((i) => i.isDraft)
    if (current?.aircraftId === ac.id) return current.msn // same aircraft re-selected
    if (current) removeMsnInput(current.msn)
    addMsnInput({ ...buildMsnInput(ac, bhFhRatio, apuFhRatio), isDraft: true })
    return ac.msn
  }, [aircraftList, msnInputs, bhFhRatio, apuFhRatio, addMsnInput, removeMsnInput])

  /** Discard the current draft (dropdown returns to the placeholder). */
  const discardDraft = useCallback(() => {
    const current = msnInputs.find((i) => i.isDraft)
    if (current) removeMsnInput(current.msn)
  }, [msnInputs, removeMsnInput])

  /** Commit the draft: it becomes a permanent aircraft tab. */
  const commitDraft = useCallback(() => {
    const current = msnInputs.find((i) => i.isDraft)
    if (current) patchMsnInput(current.msn, { isDraft: false })
  }, [msnInputs, patchMsnInput])

  return { draft, selectAircraft, discardDraft, commitDraft, availableAircraft }
}
