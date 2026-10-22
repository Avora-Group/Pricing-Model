import { create } from 'zustand'
import { buildMonthDayInfos } from '@/lib/pnl-proration'

// ---- Types ----

/** EPR matrix row from aircraft tab — rates are USD per engine */
export interface EprMatrixRow {
  cycleRatio: number
  benignRate: number
  hotRate: number
}

/** Per-season operational parameters (used when seasonality is enabled) */
export interface SeasonInput {
  mgh: string
  cycleRatio: string
  acmiRate: string
  excessHourRate: string
  excessBh: string
  crewSets: number
  periodStart: string // "YYYY-MM-DD"
  periodEnd: string   // "YYYY-MM-DD"
}

export interface MsnInput {
  id?: number // DB id (from project_msn_inputs)
  aircraftId: number
  msn: number
  aircraftType: string // "A320" or "A321"
  registration: string | null
  mgh: string // String to preserve decimal precision
  cycleRatio: string
  environment: 'benign' | 'hot'
  periodStart: string // "YYYY-MM" or "YYYY-MM-DD" format
  periodEnd: string // "YYYY-MM" or "YYYY-MM-DD" format
  leaseType: 'wet' | 'damp' | 'moist'
  crewSets: number
  rateCurrency: 'eur' | 'usd' // Currency of ACMI rate and excess hour rate
  // MGH interpretation: 'month' = the mgh value is per calendar month (default);
  // 'period' = mgh is the TOTAL block hours for the whole term, distributed
  // across months by 30/360 day-weights. In period mode a month's distributed
  // BH is final (drives revenue + BH-variable directly); fixed costs still
  // prorate by actual calendar days.
  mghMode?: 'month' | 'period'
  acmiRate: string // per BH — revenue = (acmiRate × MGH) + (excessBh × excessHourRate)
  excessBh: string // Excess BH above MGH (default 0)
  excessHourRate: string // per excess BH (default 0)
  bhFhRatio: string // BH:FH ratio — FH = BH / bhFhRatio (default 1.2)
  apuFhRatio: string // APU FH:FH ratio — APU FH = FH * apuFhRatio (default 0.7)
  // Aircraft rates from Aircraft tab (USD, monthly — fixed). Converted to EUR
  // with the quote's exchange rate at calculation time.
  leaseRentUsd: string // Dry lease rent per month
  sixYearCheckUsd: string // 6-year check reserve per month
  twelveYearCheckUsd: string // 12-year check reserve per month
  ldgUsd: string // Landing gear reserve per month
  // Legacy EUR snapshots (taken at 0.85) on quotes saved before USD storage.
  // Read only as a fallback by pickAircraftRates; never written.
  leaseRentEur?: string
  sixYearCheckEur?: string
  twelveYearCheckEur?: string
  ldgEur?: string
  // Aircraft rates from Aircraft tab (USD — variable, per engine)
  apuRateUsd: string  // APU rate per APU FH
  llp1RateUsd: string // LLP #1 rate per FC
  llp2RateUsd: string // LLP #2 rate per FC
  // EPR matrix from Aircraft tab (USD per engine)
  eprMatrix: EprMatrixRow[]
  // Naked rates (parallel cost basis; only populated for cost-access users +
  // aircraft that have naked rates). Used when rateBasis === 'naked'.
  hasNakedRates?: boolean
  nakedLeaseRentUsd?: string
  nakedSixYearCheckUsd?: string
  nakedTwelveYearCheckUsd?: string
  nakedLdgUsd?: string
  // Legacy naked EUR snapshots (see leaseRentEur above)
  nakedLeaseRentEur?: string
  nakedSixYearCheckEur?: string
  nakedTwelveYearCheckEur?: string
  nakedLdgEur?: string
  nakedApuRateUsd?: string
  nakedLlp1RateUsd?: string
  nakedLlp2RateUsd?: string
  nakedEprMatrix?: EprMatrixRow[]
  // Seasonality
  seasonalityEnabled: boolean
  summer?: SeasonInput
  winter?: SeasonInput
  // Fixed cost coverage (summer project covers winter fixed costs)
  fixedCostCoverageEnabled: boolean
  fixedCostCoveragePercent: string // e.g. "50"
  fixedCostCoverageMonths: string  // e.g. "6"
  // Draft: created when an aircraft is picked from the dropdown, before "Add
  // aircraft" commits it. Excluded from Total-Project aggregation and quote
  // snapshots until committed (isDraft set false).
  isDraft?: boolean
}

/**
 * Term length in months from start/end strings (YYYY-MM or YYYY-MM-DD, inclusive).
 *
 * Measured in DAYS, not in calendar months touched: the result is the sum of
 * each month's active-day fraction (activeDays / daysInMonth) over the term.
 * A term of 2026-09-03 -> 2026-10-03 is 31 days = 28/30 + 3/31 = 1.03 months,
 * NOT the 2 calendar months it happens to straddle.
 *
 * This is the exact denominator that turns the engine's day-prorated project
 * totals back into per-month figures: the engine prorates a month's fixed cost
 * by the same day fraction, so dividing the term total by the summed fractions
 * recovers the true per-full-month rate, and multiplying back reproduces the
 * project total. Whole-month terms (YYYY-MM, or 1st-to-last-day ranges) are
 * unaffected — every fraction is 1, so the result is the plain month count.
 *
 * Returns 1 as a neutral fallback when the dates are missing or unparseable.
 */
export function computePeriodMonths(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 1
  const months = generateMonthRange(start, end)
  if (months.length === 0) return 1
  const infos = buildMonthDayInfos(months, start, end)
  const term = infos.reduce((sum, i) => sum + (i.totalDays > 0 ? i.activeDays / i.totalDays : 0), 0)
  return term > 0 ? term : 1
}

/**
 * Whole-month term for the API payload / DB, where `period_months` is an
 * INTEGER column and is stored as metadata only (the pricing engine never
 * computes with it). Display and math use the fractional computePeriodMonths.
 */
export function computePeriodMonthsInt(start: string | null | undefined, end: string | null | undefined): number {
  return Math.max(1, Math.round(computePeriodMonths(start, end)))
}

/** Generate an array of {year, month} for each month from start to end (inclusive).
 *  Accepts both YYYY-MM and YYYY-MM-DD — only year and month are used. */
export function generateMonthRange(start: string | null | undefined, end: string | null | undefined): { year: number; month: number; label: string }[] {
  if (!start || !end) return []
  const sp = start.split('-').map(Number)
  const ep = end.split('-').map(Number)
  const sy = sp[0], sm = sp[1], ey = ep[0], em = ep[1]
  if (!sy || !sm || !ey || !em) return []
  const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const result: { year: number; month: number; label: string }[] = []
  let y = sy
  let m = sm
  while (y < ey || (y === ey && m <= em)) {
    result.push({ year: y, month: m, label: MONTH_LABELS[m - 1] })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

export interface ComponentBreakdown {
  aircraftEurPerBh: string
  crewEurPerBh: string
  maintenanceEurPerBh: string
  insuranceEurPerBh: string
  docEurPerBh: string
  otherCogsEurPerBh: string
  overheadEurPerBh: string
  totalCostPerBh: string
  revenuePerBh: string
  marginPercent: string
  finalRatePerBh: string
}

export interface MsnPnlResult {
  msn: number
  aircraftType: string
  breakdown: ComponentBreakdown
  monthlyCost: string
  monthlyRevenue: string
  monthlyPnl: string
  // Engine-computed fixed-cost coverage (absolute EUR over the coverage
  // period). '0' when coverage is disabled or redacted.
  coverageCost: string
}

interface PricingStore {
  // Edit-in-place: when set, saving updates this existing quote instead of
  // creating a new one. Carries the client identity for the save dialog.
  editingQuoteId: number | null
  editingQuoteNumber: string | null
  editingClientName: string | null
  editingClientCode: string | null

  // Project state
  projectId: number | null
  projectName: string
  exchangeRate: string // Default "0.85"
  marginPercent: string // Default "0"
  rateBasis: 'current' | 'naked' // Cost basis for pricing (cost-access only)
  displayCurrency: 'eur' | 'usd' // Display currency for summary/chart figures
  bhFhRatio: string // Global BH:FH ratio — FH = BH / bhFhRatio (default 1.2)
  apuFhRatio: string // Global APU FH:FH ratio — APU FH = FH * apuFhRatio (default 0.7)
  msnInputs: MsnInput[]

  // P&L results
  selectedMsn: number | null // null = total project view
  msnResults: MsnPnlResult[]
  totalResult: ComponentBreakdown | null
  isCalculating: boolean
  lastError: string | null

  // Actions
  setProjectId: (id: number | null) => void
  setProjectName: (name: string) => void
  setExchangeRate: (rate: string) => void
  setMarginPercent: (margin: string) => void
  setRateBasis: (basis: 'current' | 'naked') => void
  setDisplayCurrency: (currency: 'eur' | 'usd') => void
  setBhFhRatio: (ratio: string) => void
  setApuFhRatio: (ratio: string) => void
  addMsnInput: (input: MsnInput) => void
  removeMsnInput: (msn: number) => void
  updateMsnInput: (msn: number, field: keyof MsnInput, value: string | number | boolean | null) => void
  patchMsnInput: (msn: number, patch: Partial<MsnInput>) => void
  setSelectedMsn: (msn: number | null) => void
  setResults: (msnResults: MsnPnlResult[], total: ComponentBreakdown | null) => void
  setIsCalculating: (val: boolean) => void
  swapMsnAircraft: (oldMsn: number, newAircraft: {
    aircraftId: number
    msn: number
    aircraftType: string
    registration: string | null
    leaseRentUsd: string
    sixYearCheckUsd: string
    twelveYearCheckUsd: string
    ldgUsd: string
    apuRateUsd: string
    llp1RateUsd: string
    llp2RateUsd: string
    eprMatrix: EprMatrixRow[]
  }) => void
  toggleSeasonality: (msn: number, enabled: boolean) => void
  updateSeasonInput: (msn: number, season: 'summer' | 'winter', field: keyof SeasonInput, value: string | number) => void
  setLastError: (err: string | null) => void
  reset: () => void
  loadFromQuote: (quoteData: {
    dashboardState: {
      projectName?: string
      exchangeRate: string
      marginPercent: string
      bhFhRatio?: string
      apuFhRatio?: string
    }
    msnInputs: MsnInput[]
    msnResults: MsnPnlResult[]
    totalResult: ComponentBreakdown | null
    editing?: {
      quoteId: number
      quoteNumber: string
      clientName: string
      clientCode: string
      projectId: number | null
    }
  }) => void
}

const initialState = {
  editingQuoteId: null as number | null,
  editingQuoteNumber: null as string | null,
  editingClientName: null as string | null,
  editingClientCode: null as string | null,
  projectId: null as number | null,
  projectName: '',
  exchangeRate: '0.85',
  marginPercent: '0',
  rateBasis: 'current' as 'current' | 'naked',
  displayCurrency: 'eur' as 'eur' | 'usd',
  bhFhRatio: '1.2',
  apuFhRatio: '0.7',
  msnInputs: [] as MsnInput[],
  selectedMsn: null as number | null,
  msnResults: [] as MsnPnlResult[],
  totalResult: null as ComponentBreakdown | null,
  isCalculating: false,
  lastError: null as string | null,
}

export const usePricingStore = create<PricingStore>()((set) => ({
  ...initialState,

  setProjectId: (id) => set({ projectId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setExchangeRate: (rate) => set({ exchangeRate: rate }),
  setMarginPercent: (margin) => set({ marginPercent: margin }),
  setRateBasis: (basis) => set({ rateBasis: basis }),
  setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
  setBhFhRatio: (ratio) =>
    set((state) => ({
      bhFhRatio: ratio,
      msnInputs: state.msnInputs.map((i) => ({ ...i, bhFhRatio: ratio })),
    })),
  setApuFhRatio: (ratio) =>
    set((state) => ({
      apuFhRatio: ratio,
      msnInputs: state.msnInputs.map((i) => ({ ...i, apuFhRatio: ratio })),
    })),

  addMsnInput: (input) =>
    set((state) => ({
      msnInputs: [...state.msnInputs, input],
    })),

  removeMsnInput: (msn) =>
    set((state) => ({
      msnInputs: state.msnInputs.filter((i) => i.msn !== msn),
    })),

  updateMsnInput: (msn, field, value) =>
    set((state) => ({
      msnInputs: state.msnInputs.map((i) =>
        i.msn === msn ? { ...i, [field]: value } : i
      ),
    })),

  patchMsnInput: (msn, patch) =>
    set((state) => ({
      msnInputs: state.msnInputs.map((i) =>
        i.msn === msn ? { ...i, ...patch } : i
      ),
    })),

  swapMsnAircraft: (oldMsn, newAircraft) =>
    set((state) => ({
      msnInputs: state.msnInputs.map((i) =>
        i.msn === oldMsn
          ? {
              ...i,
              aircraftId: newAircraft.aircraftId,
              msn: newAircraft.msn,
              aircraftType: newAircraft.aircraftType,
              registration: newAircraft.registration,
              leaseRentUsd: newAircraft.leaseRentUsd,
              sixYearCheckUsd: newAircraft.sixYearCheckUsd,
              twelveYearCheckUsd: newAircraft.twelveYearCheckUsd,
              ldgUsd: newAircraft.ldgUsd,
              // Drop any legacy EUR snapshot from the previous aircraft
              leaseRentEur: undefined,
              sixYearCheckEur: undefined,
              twelveYearCheckEur: undefined,
              ldgEur: undefined,
              apuRateUsd: newAircraft.apuRateUsd,
              llp1RateUsd: newAircraft.llp1RateUsd,
              llp2RateUsd: newAircraft.llp2RateUsd,
              eprMatrix: newAircraft.eprMatrix,
              id: undefined, // Clear DB id since this is a new aircraft assignment
            }
          : i
      ),
    })),

  toggleSeasonality: (msn, enabled) =>
    set((state) => ({
      msnInputs: state.msnInputs.map((i) => {
        if (i.msn !== msn) return i
        if (enabled) {
          const seasonDefaults: SeasonInput = {
            mgh: i.mgh,
            cycleRatio: i.cycleRatio,
            acmiRate: i.acmiRate,
            excessHourRate: i.excessHourRate,
            excessBh: i.excessBh,
            crewSets: i.crewSets,
            periodStart: i.periodStart,
            periodEnd: i.periodEnd,
          }
          return { ...i, seasonalityEnabled: true, summer: { ...seasonDefaults }, winter: { ...seasonDefaults } }
        }
        return { ...i, seasonalityEnabled: false, summer: undefined, winter: undefined }
      }),
    })),

  updateSeasonInput: (msn, season, field, value) =>
    set((state) => ({
      msnInputs: state.msnInputs.map((i) => {
        if (i.msn !== msn || !i[season]) return i
        return { ...i, [season]: { ...i[season]!, [field]: value } }
      }),
    })),

  setSelectedMsn: (msn) => set({ selectedMsn: msn }),

  setResults: (msnResults, total) => set({ msnResults, totalResult: total }),

  setIsCalculating: (val) => set({ isCalculating: val }),

  setLastError: (err) => set({ lastError: err }),

  reset: () => set({ ...initialState }),

  loadFromQuote: (quoteData) =>
    set({
      editingQuoteId: quoteData.editing?.quoteId ?? null,
      editingQuoteNumber: quoteData.editing?.quoteNumber ?? null,
      editingClientName: quoteData.editing?.clientName ?? null,
      editingClientCode: quoteData.editing?.clientCode ?? null,
      // Edit in place: keep the original project link so saving updates it.
      projectId: quoteData.editing?.projectId ?? null,
      projectName: quoteData.dashboardState.projectName ?? '',
      exchangeRate: quoteData.dashboardState.exchangeRate,
      marginPercent: quoteData.dashboardState.marginPercent,
      bhFhRatio: quoteData.dashboardState.bhFhRatio ?? '1.2',
      apuFhRatio: quoteData.dashboardState.apuFhRatio ?? '0.7',
      msnInputs: quoteData.msnInputs,
      msnResults: quoteData.msnResults,
      totalResult: quoteData.totalResult,
      selectedMsn: null,
      isCalculating: false,
      lastError: null,
    }),
}))
