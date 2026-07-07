import type { MsnInput, EprMatrixRow } from '@/stores/pricing-store'

/**
 * Single source of truth for selecting an MSN's aircraft cost inputs on the
 * current vs. naked basis. Used by every cost computation (Summary cards, the
 * P&L statement, and the standalone P&L engine) so the two bases can never
 * diverge between views.
 *
 * Naked is applied only when requested AND the aircraft actually has naked
 * rates; each field (and the EPR matrix) independently falls back to current.
 */
export interface ResolvedAircraftRates {
  leaseRentEur: number
  sixYearCheckEur: number
  twelveYearCheckEur: number
  ldgEur: number
  apuRateUsd: number
  llp1RateUsd: number
  llp2RateUsd: number
  eprMatrix: EprMatrixRow[]
}

export function pickAircraftRates(input: MsnInput, useNaked: boolean): ResolvedAircraftRates {
  const nk = useNaked && Boolean(input.hasNakedRates)
  const num = (v: string | null | undefined) => parseFloat(v || '0')
  return {
    leaseRentEur: num(nk ? input.nakedLeaseRentEur : input.leaseRentEur),
    sixYearCheckEur: num(nk ? input.nakedSixYearCheckEur : input.sixYearCheckEur),
    twelveYearCheckEur: num(nk ? input.nakedTwelveYearCheckEur : input.twelveYearCheckEur),
    ldgEur: num(nk ? input.nakedLdgEur : input.ldgEur),
    apuRateUsd: num(nk ? input.nakedApuRateUsd : input.apuRateUsd),
    llp1RateUsd: num(nk ? input.nakedLlp1RateUsd : input.llp1RateUsd),
    llp2RateUsd: num(nk ? input.nakedLlp2RateUsd : input.llp2RateUsd),
    eprMatrix: nk && input.nakedEprMatrix?.length ? input.nakedEprMatrix : (input.eprMatrix ?? []),
  }
}
