import type { MsnInput, EprMatrixRow } from '@/stores/pricing-store'

/**
 * USD/EUR rate the backend used when it snapshotted EUR aircraft costs into
 * MSN inputs. Quotes saved before aircraft costs were held in USD carry only
 * those EUR snapshots; dividing by this rate recovers the USD source value so
 * the quote's own exchange rate can be applied like everywhere else.
 */
export const LEGACY_SNAPSHOT_RATE = 0.85

/**
 * Single source of truth for selecting an MSN's aircraft cost inputs on the
 * current vs. naked basis. Used by every cost computation (Summary cards, the
 * P&L statement, and the standalone P&L engine) so the two bases can never
 * diverge between views.
 *
 * Naked is applied only when requested AND the aircraft actually has naked
 * rates; each field (and the EPR matrix) independently falls back to current.
 *
 * All rates are USD as entered on the Aircraft tab; callers convert to EUR
 * with the quote's exchange rate (see aircraftFixedEur).
 */
export interface ResolvedAircraftRates {
  leaseRentUsd: number
  sixYearCheckUsd: number
  twelveYearCheckUsd: number
  ldgUsd: number
  apuRateUsd: number
  llp1RateUsd: number
  llp2RateUsd: number
  eprMatrix: EprMatrixRow[]
  /** Included-MR allowance (current basis only; null = none). See MsnInput. */
  includedFh: number | null
  includedFc: number | null
  suppLlpPerFcUsd: number
  suppEprMatrix: EprMatrixRow[]
}

const num = (v: string | null | undefined) => parseFloat(v || '0')

/**
 * MSNs leased with a supplemental rent that covers every reserve (MSN 5228:
 * 175k/mo). They carry no usage-based (variable) maintenance reserves, so
 * EPR, LLP and APU always resolve to zero whatever rates are stored or
 * snapshotted in a saved quote. Keep in sync with NO_VARIABLE_MR_MSNS in
 * fastapi-project/app/pricing/service.py.
 */
export const NO_VARIABLE_MR_MSNS: ReadonlySet<number> = new Set([5228])

export function hasVariableMr(msn: number): boolean {
  return !NO_VARIABLE_MR_MSNS.has(Number(msn))
}

/** USD value, or the legacy EUR snapshot converted back to USD when the input predates USD storage. */
function usd(usdValue: string | null | undefined, legacyEur: string | null | undefined): number {
  if (usdValue != null && usdValue !== '') return num(usdValue)
  if (legacyEur != null && legacyEur !== '') return num(legacyEur) / LEGACY_SNAPSHOT_RATE
  return 0
}

export function pickAircraftRates(input: MsnInput, useNaked: boolean): ResolvedAircraftRates {
  const nk = useNaked && Boolean(input.hasNakedRates)
  const variableMr = hasVariableMr(input.msn)
  return {
    leaseRentUsd: nk
      ? usd(input.nakedLeaseRentUsd, input.nakedLeaseRentEur)
      : usd(input.leaseRentUsd, input.leaseRentEur),
    sixYearCheckUsd: nk
      ? usd(input.nakedSixYearCheckUsd, input.nakedSixYearCheckEur)
      : usd(input.sixYearCheckUsd, input.sixYearCheckEur),
    twelveYearCheckUsd: nk
      ? usd(input.nakedTwelveYearCheckUsd, input.nakedTwelveYearCheckEur)
      : usd(input.twelveYearCheckUsd, input.twelveYearCheckEur),
    ldgUsd: nk ? usd(input.nakedLdgUsd, input.nakedLdgEur) : usd(input.ldgUsd, input.ldgEur),
    apuRateUsd: variableMr ? num(nk ? input.nakedApuRateUsd : input.apuRateUsd) : 0,
    llp1RateUsd: variableMr ? num(nk ? input.nakedLlp1RateUsd : input.llp1RateUsd) : 0,
    llp2RateUsd: variableMr ? num(nk ? input.nakedLlp2RateUsd : input.llp2RateUsd) : 0,
    eprMatrix: !variableMr
      ? []
      : nk && input.nakedEprMatrix?.length ? input.nakedEprMatrix : (input.eprMatrix ?? []),
    // The naked basis has no allowance; an MSN with no variable MR has no
    // excess charge either, so its allowance is dropped entirely.
    includedFh: variableMr && !nk && input.includedFh != null && input.includedFh !== '' ? num(input.includedFh) : null,
    includedFc: variableMr && !nk && input.includedFc != null && input.includedFc !== '' ? num(input.includedFc) : null,
    suppLlpPerFcUsd: variableMr ? num(input.suppLlpPerFcUsd) : 0,
    suppEprMatrix: variableMr ? (input.suppEprMatrix ?? []) : [],
  }
}

/** Monthly fixed aircraft costs in EUR at the given USD/EUR rate. */
export function aircraftFixedEur(ar: ResolvedAircraftRates, exchangeRate: number) {
  const sixYearCheck = ar.sixYearCheckUsd * exchangeRate
  const twelveYearCheck = ar.twelveYearCheckUsd * exchangeRate
  const ldg = ar.ldgUsd * exchangeRate
  return {
    dryLease: ar.leaseRentUsd * exchangeRate,
    sixYearCheck,
    twelveYearCheck,
    ldg,
    maintReservesFixed: sixYearCheck + twelveYearCheck + ldg,
  }
}

/** Saved-quote field as a string, or undefined when absent (keeps legacy fallback detectable). */
export function optStr(v: unknown): string | undefined {
  return v == null || v === '' ? undefined : String(v)
}
