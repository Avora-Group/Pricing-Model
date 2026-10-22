'use client'

import { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { usePricingStore } from '@/stores/pricing-store'
import { generateMonthRange } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { fmt, fmtPct, fmtDec, valColor } from '@/lib/format'
import { PNL_ROWS, KPI_DECIMAL_KEYS, ALL_DATA_KEYS } from '@/lib/pnl-row-defs'
import { buildMonthlyData } from '@/lib/pnl-monthly-builder'
import { ALL_DATA_KEYS as ALL_KEYS_IMPORT } from '@/lib/pnl-row-defs'
import { deriveCrewValues, deriveCostsValues, computeMsnConfig } from '@/lib/pnl-msn-config'
import type { CrewDerivedValues, CostsDerivedValues } from '@/lib/pnl-msn-config'
import { interpolateEpr } from '@/lib/pnl-engine'
import type { CrewStoreData, CostsStoreData } from '@/lib/pnl-engine'
import { pickAircraftRates } from '@/lib/aircraft-rate-basis'
import { buildMonthDayInfos } from '@/lib/pnl-proration'
import { periodBhWeightsFromStrings } from '@/lib/mgh-distribution'
import type { MsnInput } from '@/stores/pricing-store'
import { LineDetailPopover } from './CostDetailPopover'
import type { BreakdownItem, ParamItem } from './CostDetailPopover'
import { useCanViewCosts, useCanViewNaked } from '@/providers/CostVisibilityProvider'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

// ---- Clickable row definitions ----

const CLICKABLE_ROWS = new Set([
  'maintReservesVariable',
  'pilotPerDiem',
  'cabinCrewPerDiem',
  'spareParts',
  'maintPersonnelPerDiem',
  'maintReservesFixed',
  'pilotSalary',
  'cabinCrewSalary',
  'lineMaintenance',
])

// ---- Collapsible statement layout ----
// Cost categories (A/C/M/I/DOC/Other) collapse to a subtotal; sections with no
// categories (Revenue, Overhead) collapse at the section level. Items that sit
// after a section's TOTAL row (D&A, Interest, FX, Tax) stay loose / always-on.
const CAT_LABELS: Record<string, string> = {
  A: 'A · Aircraft',
  C: 'C · Crew',
  M: 'M · Maintenance',
  I: 'I · Insurance',
  DOC: 'DOC',
  Other: 'Other',
}

// Lines below EBITDA are always zero in this model (no D&A, interest, FX or
// tax), so Net profit === EBITDA. Hide them; EBITDA is the bottom line.
const HIDDEN_PNL_KEYS = new Set([
  'depAmort', 'ebit', 'ebitMargin', 'interestNet', 'fxNet', 'tax', 'netProfit', 'netProfitMargin',
])

type PlanRow =
  | { t: 'section'; label: string; groupId?: string }
  | { t: 'group'; groupId: string; label: string; keys: string[] }
  | { t: 'item'; key: string; label: string; groupId: string; clickable: boolean }
  | { t: 'total'; key: string; label: string }
  | { t: 'result'; key: string; label: string }
  | { t: 'margin'; key: string; label: string }
  | { t: 'kpiheader'; label: string }
  | { t: 'kpi'; key: string; label: string; groupId?: string }

const PNL_PLAN: PlanRow[] = (() => {
  // Which sections contain category sub-groups?
  const sectionHasCat: Record<string, boolean> = {}
  let s = ''
  for (const r of PNL_ROWS) {
    if (r.kind === 'section') { s = r.label; sectionHasCat[s] = false }
    else if (r.kind === 'category') { sectionHasCat[s] = true }
  }

  const plan: PlanRow[] = []
  const keysOf: Record<string, string[]> = {}
  let secCollapsible = false
  let secGroup = ''
  let catGroup = ''

  PNL_ROWS.forEach((r, i) => {
    const key = r.key ?? ''
    if (key && HIDDEN_PNL_KEYS.has(key)) return
    if (r.kind === 'section') {
      secCollapsible = !sectionHasCat[r.label]
      secGroup = secCollapsible ? `sec:${r.label}` : ''
      catGroup = ''
      if (secCollapsible) { keysOf[secGroup] = []; plan.push({ t: 'section', label: r.label, groupId: secGroup }) }
      else plan.push({ t: 'section', label: r.label })
    } else if (r.kind === 'category') {
      catGroup = `cat:${r.label}:${i}`
      keysOf[catGroup] = []
      plan.push({ t: 'group', groupId: catGroup, label: CAT_LABELS[r.label] ?? r.label, keys: keysOf[catGroup] })
    } else if (r.kind === 'item') {
      const gid = secCollapsible ? secGroup : catGroup
      if (gid) keysOf[gid].push(key)
      plan.push({ t: 'item', key, label: r.label, groupId: gid, clickable: CLICKABLE_ROWS.has(key) })
    } else if (r.kind === 'total') {
      plan.push({ t: 'total', key, label: r.label })
      // grouping ends at the subtotal — later items are standalone
      secCollapsible = false; secGroup = ''; catGroup = ''
    } else if (r.kind === 'result') {
      plan.push({ t: 'result', key, label: r.label })
    } else if (r.kind === 'margin') {
      plan.push({ t: 'margin', key, label: r.label })
    } else if (r.kind === 'kpi-header') {
      // KPIs render as a collapsible group (like Revenue/Overhead).
      plan.push({ t: 'section', label: r.label, groupId: 'kpi' })
    } else if (r.kind === 'kpi') {
      plan.push({ t: 'kpi', key, label: r.label, groupId: 'kpi' })
    }
  })
  return plan
})()

// Every collapsible group id (categories + Revenue/Overhead sections).
const ALL_GROUP_IDS: string[] = PNL_PLAN.flatMap((p) =>
  p.t === 'group' ? [p.groupId] : p.t === 'section' && p.groupId ? [p.groupId] : [],
)

/**
 * Build monthly P&L data for a single MSN, handling seasonality.
 *
 * When seasonality is enabled, each month uses the summer or winter config
 * depending on which season period the month falls into.
 */
function buildMsnMonthlyData(
  input: MsnInput,
  months: { year: number; month: number; label: string }[],
  crew: CrewDerivedValues,
  costs: CostsDerivedValues,
  exchangeRate: number,
  fdDays: number,
  nfdDays: number,
  useNaked: boolean = false,
): Record<string, number[]> {
  if (input.seasonalityEnabled && input.summer && input.winter) {
    // Season period fields can be null/absent on MSNs loaded from a saved quote;
    // fall back to the MSN's top-level period so string ops never see null.
    const sSummerStart = input.summer.periodStart || input.periodStart || ''
    const sSummerEnd = input.summer.periodEnd || input.periodEnd || ''
    const sWinterStart = input.winter.periodStart || input.periodStart || ''
    const sWinterEnd = input.winter.periodEnd || input.periodEnd || ''
    // Build virtual MsnInput for each season by overlaying season fields
    const makeSeasonal = (s: typeof input.summer): MsnInput => ({
      ...input,
      mgh: s!.mgh,
      cycleRatio: s!.cycleRatio,
      acmiRate: s!.acmiRate,
      excessHourRate: s!.excessHourRate,
      excessBh: s!.excessBh,
      crewSets: s!.crewSets,
    })

    const summerInput = makeSeasonal(input.summer)
    const winterInput = makeSeasonal(input.winter)

    const summerR = computeMsnConfig(summerInput, crew, costs, exchangeRate, fdDays, nfdDays, useNaked)
    const winterR = computeMsnConfig(winterInput, crew, costs, exchangeRate, fdDays, nfdDays, useNaked)

    // Build monthly data for each season config across the full month range
    const summerMdi = buildMonthDayInfos(months, sSummerStart, sSummerEnd)
    const winterMdi = buildMonthDayInfos(months, sWinterStart, sWinterEnd)

    const isPeriod = (input.mghMode ?? 'month') === 'period'
    const summerWeights = isPeriod ? periodBhWeightsFromStrings(months, sSummerStart, sSummerEnd) : undefined
    const winterWeights = isPeriod ? periodBhWeightsFromStrings(months, sWinterStart, sWinterEnd) : undefined

    const summerData = buildMonthlyData(
      months, summerR.mgh, summerR.acmiRate, summerR.excessBh, summerR.excessHourRate,
      summerR.cycleRatio, summerR.bhFhRatio, summerR.apuFhRatio, summerR.cfg, summerMdi, summerWeights,
    )
    const winterData = buildMonthlyData(
      months, winterR.mgh, winterR.acmiRate, winterR.excessBh, winterR.excessHourRate,
      winterR.cycleRatio, winterR.bhFhRatio, winterR.apuFhRatio, winterR.cfg, winterMdi, winterWeights,
    )

    // Each season's data is already zero outside its own dates (its day infos
    // carry 0 active days there), so the MSN's month is the SUM of both — a
    // mid-month handoff (summer to the 15th, winter from the 16th) bears each
    // season's own day share, exactly as the P&L engine and the workspace
    // summary compute it. Months in neither season stay 0.
    const data: Record<string, number[]> = {}
    for (const k of ALL_KEYS_IMPORT) {
      data[k] = new Array(months.length).fill(0)
    }

    for (let m = 0; m < months.length; m++) {
      const summerActive = summerMdi[m].activeDays > 0
      const winterActive = winterMdi[m].activeDays > 0
      for (const k of ALL_KEYS_IMPORT) {
        data[k][m] = (summerActive ? summerData[k][m] : 0) + (winterActive ? winterData[k][m] : 0)
      }
      // Ratios / flags don't add across seasons — recompute from the summed
      // absolutes (same as the Total Project view does across MSNs).
      const rev = data['totalRevenue'][m]
      data['ebitdaMargin'][m] = rev > 0 ? data['ebitda'][m] / rev : 0
      data['ebitMargin'][m] = rev > 0 ? data['ebit'][m] / rev : 0
      data['netProfitMargin'][m] = rev > 0 ? data['netProfit'][m] / rev : 0
      data['acOperational'][m] = summerActive || winterActive ? 1 : 0
      data['avgBhPerAc'][m] = data['bh'][m]
      const fcVal = data['fc'][m]
      data['fhFcRatio'][m] = fcVal > 0 ? data['fh'][m] / fcVal : 0
    }

    return data
  }

  // Non-seasonal: original logic
  const r = computeMsnConfig(input, crew, costs, exchangeRate, fdDays, nfdDays, useNaked)
  const mdi = buildMonthDayInfos(months, input.periodStart, input.periodEnd)
  const bhWeights = (input.mghMode ?? 'month') === 'period'
    ? periodBhWeightsFromStrings(months, input.periodStart, input.periodEnd)
    : undefined
  return buildMonthlyData(
    months, r.mgh, r.acmiRate, r.excessBh, r.excessHourRate,
    r.cycleRatio, r.bhFhRatio, r.apuFhRatio, r.cfg, mdi, bhWeights,
  )
}

/** Get the effective period start/end for an MSN input, accounting for seasonality */
function getEffectivePeriod(input: MsnInput): { start: string; end: string } {
  if (input.seasonalityEnabled && input.summer && input.winter) {
    const starts = [input.summer.periodStart, input.winter.periodStart].filter(Boolean)
    const ends = [input.summer.periodEnd, input.winter.periodEnd].filter(Boolean)
    const start = starts.reduce((min, s) => (s < min ? s : min), starts[0])
    const end = ends.reduce((max, e) => (e > max ? e : max), ends[0])
    return { start, end }
  }
  return { start: input.periodStart, end: input.periodEnd }
}

interface PopoverState {
  rowKey: string
  monthIndex: number
  x: number
  y: number
}

/**
 * Explicit data source for a standalone P&L (e.g. the P&L page rendering a
 * saved quote). When provided, the table computes entirely from it and never
 * reads the workspace stores.
 */
export interface PnlSource {
  msnInputs: MsnInput[]
  crew: CrewStoreData
  costs: CostsStoreData
  exchangeRate: number
  selectedMsn: number | null
}

export function PnlTable({ source }: { source?: PnlSource } = {}) {
  const canViewCosts = useCanViewCosts()
  const canViewNaked = useCanViewNaked()
  // Store reads run unconditionally (rules of hooks); an explicit source
  // overrides every one of them below.
  const storeSelectedMsn = usePricingStore((s) => s.selectedMsn)
  const storeMsnResults = usePricingStore((s) => s.msnResults)
  const storeIsCalculating = usePricingStore((s) => s.isCalculating)
  const storeMsnInputs = usePricingStore((s) => s.msnInputs)
  const rateBasis = usePricingStore((s) => s.rateBasis)
  const storeExchangeRate = usePricingStore((s) => s.exchangeRate)

  const selectedMsn = source ? source.selectedMsn : storeSelectedMsn
  const msnResults = source ? [] : storeMsnResults
  const isCalculating = source ? false : storeIsCalculating
  const msnInputs = source ? source.msnInputs : storeMsnInputs
  // Total-project scope excludes drafts (uncommitted dropdown selections).
  const committedInputs = msnInputs.filter((i) => !i.isDraft)
  const exchangeRate = source
    ? source.exchangeRate
    : parseFloat(storeExchangeRate || '0.85')
  // Match the Summary's cost basis: naked only when permitted + selected.
  // Saved-quote sources always show the current basis the snapshot priced.
  const useNaked = source ? false : canViewNaked && rateBasis === 'naked'

  // -- Crew config store --
  const storeCrew = useCrewConfigStore()
  const crewPayroll = source ? source.crew.payroll : storeCrew.payroll
  const crewOtherCost = source ? source.crew.otherCost : storeCrew.otherCost
  const crewTraining = source ? source.crew.training : storeCrew.training
  const crewAvgAC = source ? source.crew.averageAC : storeCrew.averageAC
  const crewFdDays = source ? source.crew.fdDays : storeCrew.fdDays
  const crewNfdDays = source ? source.crew.nfdDays : storeCrew.nfdDays

  // -- Costs config store --
  const storeCosts = useCostsConfigStore()
  const costsMaintPersonnel = source ? source.costs.maintPersonnel : storeCosts.maintPersonnel
  const costsMaintCosts = source ? source.costs.maintCosts : storeCosts.maintCosts
  const costsInsurance = source ? source.costs.insurance : storeCosts.insurance
  const costsDoc = source ? source.costs.doc : storeCosts.doc
  const costsOtherCogs = source ? source.costs.otherCogs : storeCosts.otherCogs
  const costsOverhead = source ? source.costs.overhead : storeCosts.overhead
  const costsAvgAc = source ? source.costs.avgAc : storeCosts.avgAc

  // -- Cost detail popover state --
  const [popover, setPopover] = useState<PopoverState | null>(null)

  // Mobile: the statement shows one period at a time — a month index or the
  // TOTAL column — picked via the chip row above the statement.
  const isMobile = useIsMobile()
  const [mobilePeriod, setMobilePeriod] = useState<number | 'total'>('total')

  // Collapsible groups — all collapsed by default for a compact statement.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Naked-cost gate: the P&L statement is the full cost / profit / margin
  // build-up. Users without permission see a redaction notice instead. Revenue
  // remains visible on the Pricing Workspace summary and quote views. This is a
  // cosmetic hide — the server omits the underlying data regardless.
  if (!canViewCosts) {
    return (
      <div className="av-panel p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="av-redacted" aria-label="Hidden — insufficient permission">
            ••••••••
          </span>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            The full P&amp;L cost breakdown is hidden — your account does not have
            permission to view naked costs and margins.
          </p>
        </div>
      </div>
    )
  }

  // -- Derive crew and costs values using extracted modules --
  const crew = deriveCrewValues(
    crewPayroll, crewOtherCost, crewTraining, crewAvgAC, crewFdDays, crewNfdDays,
  )
  const costs = deriveCostsValues(
    costsMaintPersonnel, costsMaintCosts, costsInsurance, costsDoc,
    costsOtherCogs, costsOverhead, costsAvgAc, exchangeRate,
  )

  // -- Determine which data to display --
  let periodStart = ''
  let periodEnd = ''
  let hasData = false

  if (selectedMsn !== null) {
    const match = msnResults.find((r) => r.msn === selectedMsn)
    const input = msnInputs.find((i) => i.msn === selectedMsn)
    if (match || input) hasData = true
    if (input) {
      const ep = getEffectivePeriod(input)
      periodStart = ep.start
      periodEnd = ep.end
    }
  } else {
    // Total project view — committed MSNs only
    if (msnInputs.length > 0) {
      hasData = true
      if (committedInputs.length > 0) {
        // Period: earliest start to latest end across all MSNs (accounting for seasonality)
        const allPeriods = committedInputs.map(getEffectivePeriod)
        periodStart = allPeriods.reduce((min, p) => (p.start < min ? p.start : min), allPeriods[0].start)
        periodEnd = allPeriods.reduce((max, p) => (p.end > max ? p.end : max), allPeriods[0].end)
      }
      // Draft-only: periodStart/periodEnd stay '' and the 12-month fallback
      // below produces an all-zero statement.
    }
  }

  // Fallback: if no period set, default to 12 months from now
  if (!periodStart || !periodEnd) {
    const now = new Date()
    const sy = now.getFullYear()
    const sm = now.getMonth() + 1
    periodStart = `${sy}-${String(sm).padStart(2, '0')}`
    const ed = new Date(sy, sm - 1 + 11, 1)
    periodEnd = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}`
  }

  const months = generateMonthRange(periodStart, periodEnd)

  // Day-fraction per month for the active scope — used to badge prorated months.
  // Only attributable cleanly in single-MSN view (each MSN has its own period).
  const monthInfos = selectedMsn !== null
    ? buildMonthDayInfos(months, periodStart, periodEnd)
    : null

  // -- Compute monthly P&L data --
  let monthlyData: Record<string, number[]>

  if (selectedMsn !== null) {
    // Single MSN view
    const input = msnInputs.find((i) => i.msn === selectedMsn)
    if (input) {
      monthlyData = buildMsnMonthlyData(input, months, crew, costs, exchangeRate, crewFdDays, crewNfdDays, useNaked)
    } else {
      // No input data — produce zeros
      monthlyData = {}
      for (const k of ALL_DATA_KEYS) {
        monthlyData[k] = new Array(months.length).fill(0)
      }
    }
  } else {
    // Total project — compute each MSN independently and sum per month
    monthlyData = {}
    for (const k of ALL_DATA_KEYS) {
      monthlyData[k] = new Array(months.length).fill(0)
    }

    for (const input of committedInputs) {
      const msnData = buildMsnMonthlyData(input, months, crew, costs, exchangeRate, crewFdDays, crewNfdDays, useNaked)

      // Zero out months outside this MSN's active period (accounting for seasonality)
      const ep = getEffectivePeriod(input)
      for (let m = 0; m < months.length; m++) {
        const monthStr = `${months[m].year}-${String(months[m].month).padStart(2, '0')}`
        const periodStartMonth = ep.start.substring(0, 7)
        const periodEndMonth = ep.end.substring(0, 7)
        if (monthStr < periodStartMonth || monthStr > periodEndMonth) {
          for (const k of ALL_DATA_KEYS) {
            msnData[k][m] = 0
          }
        }
      }

      // Accumulate into total
      for (const k of ALL_DATA_KEYS) {
        for (let m = 0; m < months.length; m++) {
          monthlyData[k][m] += msnData[k][m]
        }
      }
    }

    // Recompute margins and KPI ratios from summed absolutes
    for (let m = 0; m < months.length; m++) {
      const rev = monthlyData['totalRevenue'][m]
      monthlyData['ebitdaMargin'][m] = rev > 0 ? monthlyData['ebitda'][m] / rev : 0
      monthlyData['ebitMargin'][m] = rev > 0 ? monthlyData['ebit'][m] / rev : 0
      monthlyData['netProfitMargin'][m] = rev > 0 ? monthlyData['netProfit'][m] / rev : 0
      // KPI ratios
      const ac = monthlyData['acOperational'][m]
      monthlyData['avgBhPerAc'][m] = ac > 0 ? monthlyData['bh'][m] / ac : 0
      const fhVal = monthlyData['fh'][m]
      const fcVal = monthlyData['fc'][m]
      monthlyData['fhFcRatio'][m] = fcVal > 0 ? fhVal / fcVal : 0
    }
  }

  // -- Empty state --
  if (!hasData && msnInputs.length === 0) {
    return (
      <div className="av-panel p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Configure MSNs on the Dashboard to see P&L calculations
        </p>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="av-panel p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Select an MSN or Total Project to view P&L
        </p>
      </div>
    )
  }

  // Compute TOTAL column (sum across months)
  function getTotal(key: string): number {
    const arr = monthlyData[key]
    if (!arr) return 0
    return arr.reduce((s, v) => s + v, 0)
  }

  // Sum a group's member keys across months + grand total (for collapsed rows).
  function groupVals(keys: string[]): { v: number[]; tot: number } {
    const v = months.map((_, mi) => keys.reduce((s, k) => s + (monthlyData[k]?.[mi] ?? 0), 0))
    const tot = keys.reduce((s, k) => s + getTotal(k), 0)
    return { v, tot }
  }

  // -- Breakdown config for drill-down popovers --
  function getDetailConfig(rowKey: string, mi: number): {
    title: string
    items: BreakdownItem[]
    params?: ParamItem[]
  } | null {
    const v = (k: string) => monthlyData[k]?.[mi] ?? 0
    // For formula computation in single-MSN view
    const msnInput = selectedMsn !== null
      ? msnInputs.find((i) => i.msn === selectedMsn)
      : null
    // Number formatter for formulas
    const fn = (n: number, d: number = 0) =>
      d === 0
        ? Math.round(n).toLocaleString('en-US')
        : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

    switch (rowKey) {
      case 'maintReservesVariable': {
        let eprF: string | undefined, llpF: string | undefined, apuF: string | undefined
        if (msnInput) {
          const cr = parseFloat(msnInput.cycleRatio || '1')
          const ar = pickAircraftRates(msnInput, useNaked)
          const eprRate = interpolateEpr(ar.eprMatrix, cr, msnInput.environment)
          const llp1 = ar.llp1RateUsd
          const llp2 = ar.llp2RateUsd
          const apuRate = ar.apuRateUsd
          eprF = `${fn(eprRate, 2)} \u00d7 2 \u00d7 ${fn(v('fh'), 1)} FH \u00d7 ${fn(exchangeRate, 2)} \u20ac/$`
          llpF = `(${fn(llp1, 2)} + ${fn(llp2, 2)}) \u00d7 ${fn(v('fc'), 1)} FC \u00d7 ${fn(exchangeRate, 2)} \u20ac/$`
          apuF = `${fn(apuRate, 2)} \u00d7 ${fn(v('apuFh'), 1)} APU FH \u00d7 ${fn(exchangeRate, 2)} \u20ac/$`
        }
        return {
          title: 'Maint. Reserves - Variable',
          items: [
            { label: 'EPR', value: v('maintReservesVariable_epr'), formula: eprF },
            { label: 'LLP', value: v('maintReservesVariable_llp'), formula: llpF },
            { label: 'APU', value: v('maintReservesVariable_apu'), formula: apuF },
          ],
          params: [
            { label: 'FH', value: v('fh') },
            { label: 'FC', value: v('fc') },
            { label: 'APU FH', value: v('apuFh') },
          ],
        }
      }
      case 'pilotPerDiem': {
        const sets = msnInput?.crewSets ?? 0
        return {
          title: 'Pilot - Per Diem',
          items: [
            { label: 'Per Diem', value: v('pilotPerDiem_perDiem'),
              formula: msnInput ? `${fn(crew.pilotPerDiemPerSet)} \u00d7 ${sets} sets` : undefined },
            { label: 'BH Bonus', value: v('pilotPerDiem_bhBonus'),
              formula: msnInput ? `${fn(crew.bhBonusPerBh, 2)}/BH \u00d7 ${fn(v('bh'))} BH` : undefined },
          ],
          params: [
            { label: 'BH', value: v('bh'), decimals: 0 },
          ],
        }
      }
      case 'cabinCrewPerDiem': {
        let cabAttF: string | undefined, senAttF: string | undefined
        if (msnInput) {
          const sets = msnInput.crewSets
          const cnt = msnInput.aircraftType === 'A321' ? 4 : 3
          if (msnInput.leaseType === 'wet') {
            cabAttF = `${cnt} \u00d7 ${fn(crew.cabinAttPerDiem)} \u00d7 ${sets} sets`
            senAttF = `${fn(crew.seniorAttPerDiem)} \u00d7 ${sets} sets`
          } else if (msnInput.leaseType === 'moist') {
            senAttF = `${fn(crew.seniorAttPerDiem)} \u00d7 ${sets} sets`
          }
        }
        return {
          title: 'Cabin Crew - Per Diem',
          items: [
            { label: 'Cabin Attendant', value: v('cabinCrewPerDiem_cabinAtt'), formula: cabAttF },
            { label: 'Senior Attendant', value: v('cabinCrewPerDiem_seniorAtt'), formula: senAttF },
          ],
        }
      }
      case 'spareParts':
        return {
          title: 'Spare Parts',
          items: [
            { label: 'BH-based', value: v('spareParts_bh'),
              formula: msnInput ? `${fn(v('bh'))} BH \u00d7 ${fn(costs.sparePartsRatePerBh, 2)}/BH` : undefined },
            { label: 'Tires/Wheels', value: v('spareParts_tiresWheels') },
          ],
          params: [
            { label: 'BH', value: v('bh'), decimals: 0 },
          ],
        }
      case 'maintPersonnelPerDiem': {
        const totalFromStore = costsMaintPersonnel.reduce(
          (s, p) => s + p.engineers * p.perDiem * p.days, 0,
        )
        const monthVal = v('maintPersonnelPerDiem')
        const scale = totalFromStore > 0 ? monthVal / totalFromStore : 0
        return {
          title: 'Maint. Personnel - Per Diems',
          items: costsMaintPersonnel
            .filter((p) => p.engineers * p.perDiem * p.days > 0)
            .map((p) => ({
              label: p.name,
              value: p.engineers * p.perDiem * p.days * scale,
              formula: `${p.engineers} eng \u00d7 ${fn(p.perDiem)} \u00d7 ${p.days} days`,
            })),
        }
      }
      case 'maintReservesFixed': {
        const ar = msnInput ? pickAircraftRates(msnInput, useNaked) : null
        const usdF = (usd: number) => `$${fn(usd, 2)} × ${fn(exchangeRate, 2)} €/$`
        return {
          title: 'Maint. Reserves - Fixed',
          items: [
            { label: '6-Year Check', value: v('maintReservesFixed_6yr'), formula: ar ? usdF(ar.sixYearCheckUsd) : undefined },
            { label: '12-Year Check', value: v('maintReservesFixed_12yr'), formula: ar ? usdF(ar.twelveYearCheckUsd) : undefined },
            { label: 'Landing Gear', value: v('maintReservesFixed_ldg'), formula: ar ? usdF(ar.ldgUsd) : undefined },
          ],
        }
      }
      case 'pilotSalary': {
        const sets = msnInput?.crewSets ?? 0
        return {
          title: 'Pilot - Salary',
          items: [
            { label: 'Pilot', value: v('pilotSalary_pilot'),
              formula: msnInput ? `${fn(crew.pilotSS)} \u00d7 ${sets} sets` : undefined },
            { label: 'Co-Pilot', value: v('pilotSalary_copilot'),
              formula: msnInput ? `${fn(crew.copilotSS)} \u00d7 ${sets} sets` : undefined },
          ],
        }
      }
      case 'cabinCrewSalary': {
        let cabAttF: string | undefined, senAttF: string | undefined
        if (msnInput) {
          const sets = msnInput.crewSets
          const cnt = msnInput.aircraftType === 'A321' ? 4 : 3
          if (msnInput.leaseType === 'wet') {
            cabAttF = `${cnt} \u00d7 ${fn(crew.cabinAttendantSS)} \u00d7 ${sets} sets`
            senAttF = `${fn(crew.seniorAttendantSS)} \u00d7 ${sets} sets`
          } else if (msnInput.leaseType === 'moist') {
            senAttF = `${fn(crew.seniorAttendantSS)} \u00d7 ${sets} sets`
          }
        }
        return {
          title: 'Cabin Crew - Salary',
          items: [
            { label: 'Cabin Attendant', value: v('cabinCrewSalary_cabinAtt'), formula: cabAttF },
            { label: 'Senior Attendant', value: v('cabinCrewSalary_seniorAtt'), formula: senAttF },
          ],
        }
      }
      case 'lineMaintenance':
        return {
          title: 'Line Maintenance',
          items: [
            { label: 'Internal', value: v('lineMaintenance_internal') },
            { label: '3rd Party', value: v('lineMaintenance_3rdParty') },
          ],
        }
      default:
        return null
    }
  }

  // Header: MSN number
  const headerLabel = selectedMsn !== null
    ? `MSN ${selectedMsn}`
    : 'Project Total'

  // Column widths — slimmer pinned label column on phones so the month
  // columns keep meaningful room while panning
  const labelColWidth = 'min-w-[180px] md:min-w-[260px]'
  const dataColWidth = 'min-w-[100px]'

  // Mobile period index: null = TOTAL column. Clamped so a shorter month
  // range (after switching quotes) can't leave a stale out-of-range pick.
  const mi = mobilePeriod === 'total' ? null : Math.min(mobilePeriod, Math.max(months.length - 1, 0))
  const periodVal = (vals: number[] | undefined, tot: number): number =>
    mi === null ? tot : (vals?.[mi] ?? 0)

  return (
    <div className={`av-panel overflow-hidden transition-opacity ${isCalculating ? 'opacity-60' : ''}`}>
      {/* MSN header */}
      <div className="av-panel-h flex items-center justify-between gap-3">
        <h2>{headerLabel}</h2>
        <button
          onClick={() => setExpandedGroups(expandedGroups.size ? new Set() : new Set(ALL_GROUP_IDS))}
          className="text-[11px] font-medium transition-colors"
          style={{ color: 'var(--muted)' }}
        >
          {expandedGroups.size ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {isMobile ? (
        /* ── Mobile: single-period statement ─────────────────────────────
           A 12-month matrix can't read on a phone; instead the chips pick
           one period (or TOTAL) and the statement renders as a list —
           same rows, same collapsible groups as the desktop table. */
        <>
          {/* Period picker */}
          <div
            className="flex gap-1.5 px-3 py-2.5 overflow-x-auto"
            style={{ borderBottom: '1px solid var(--line-2)' }}
          >
            {([['total', 'TOTAL'] as const, ...months.map((m, i) => [i, m.label] as const)]).map(
              ([key, label]) => {
                const active = key === 'total' ? mi === null : mi === key
                return (
                  <button
                    key={String(key)}
                    onClick={() => setMobilePeriod(key === 'total' ? 'total' : key)}
                    className="shrink-0 px-3 rounded-full text-[11px] font-bold touch-manip"
                    style={{
                      minHeight: 32,
                      background: active ? 'var(--navy)' : 'var(--card-2)',
                      color: active ? '#fff' : 'var(--muted)',
                      border: `1px solid ${active ? 'var(--navy)' : 'var(--line)'}`,
                    }}
                  >
                    {label}
                  </button>
                )
              },
            )}
          </div>
          {/* Partial-month hint */}
          {mi !== null && monthInfos?.[mi] && monthInfos[mi].activeDays < monthInfos[mi].totalDays && (
            <div className="px-4 py-1.5 text-[10.5px]" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line-2)' }}>
              {months[mi].label}: {monthInfos[mi].activeDays}/{monthInfos[mi].totalDays} active days (prorated)
            </div>
          )}

          {/* Statement rows */}
          <div className="text-xs">
            {PNL_PLAN.map((p, idx) => {
              if (p.t === 'section') {
                const open = p.groupId ? expandedGroups.has(p.groupId) : false
                return (
                  <div
                    key={idx}
                    onClick={p.groupId ? () => toggleGroup(p.groupId!) : undefined}
                    className={`px-4 py-2 text-[10.5px] uppercase tracking-[0.06em] font-semibold bg-[var(--card-2)] text-[var(--muted)] border-y border-[var(--line-2)] ${p.groupId ? 'cursor-pointer select-none touch-manip' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {p.groupId ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
                      {p.label}
                    </span>
                  </div>
                )
              }

              if (p.t === 'group') {
                const open = expandedGroups.has(p.groupId)
                const { v, tot } = groupVals(p.keys)
                const value = periodVal(v, tot)
                return (
                  <div
                    key={idx}
                    onClick={() => toggleGroup(p.groupId)}
                    className="flex items-center justify-between gap-3 px-4 py-2 cursor-pointer select-none touch-manip border-b border-[var(--line-2)]"
                  >
                    <span className="inline-flex items-center gap-1 pl-2 font-medium text-[var(--ink)]">
                      {open
                        ? <ChevronDown size={12} style={{ color: 'var(--muted-2)' }} />
                        : <ChevronRight size={12} style={{ color: 'var(--muted-2)' }} />}
                      {p.label}
                    </span>
                    <span className={`av-num font-medium text-[var(--ink)] ${valColor(value)}`}>{fmt(value, 0)}</span>
                  </div>
                )
              }

              if (p.t === 'item') {
                if (p.groupId && !expandedGroups.has(p.groupId)) return null
                const value = periodVal(monthlyData[p.key], getTotal(p.key))
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between gap-3 px-4 py-1.5 border-b border-[var(--line-2)] ${p.groupId ? 'pl-9' : 'pl-7'}`}
                  >
                    <span className="text-[var(--muted)]">{p.label}</span>
                    <span className={`av-num text-[var(--ink-2)] ${valColor(value)}`}>{fmt(value, 0)}</span>
                  </div>
                )
              }

              if (p.t === 'total') {
                const value = periodVal(monthlyData[p.key], getTotal(p.key))
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 px-4 py-2 bg-[var(--card-2)] border-t border-b border-[var(--line-2)]"
                  >
                    <span className="font-semibold text-[var(--ink)]">{p.label}</span>
                    <span className={`av-num font-semibold text-[var(--ink)] ${valColor(value)}`}>{fmt(value, 0)}</span>
                  </div>
                )
              }

              if (p.t === 'result') {
                const value = periodVal(monthlyData[p.key], getTotal(p.key))
                const isKey = p.key === 'ebitda' || p.key === 'netProfit'
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                      isKey
                        ? 'border-t-2 border-[var(--cyan)] bg-[var(--cyan-soft)]'
                        : 'border-t border-[var(--line-2)] bg-[var(--card-2)]'
                    }`}
                  >
                    <span className="font-bold text-[var(--ink)]">{p.label}</span>
                    <span className={`av-num font-bold ${value < 0 ? 'av-neg' : 'av-pos'}`}>{fmt(value, 0)}</span>
                  </div>
                )
              }

              if (p.t === 'margin') {
                const vals = monthlyData[p.key]
                const avgMargin = months.length > 0
                  ? (vals ?? []).reduce((s, v) => s + v, 0) / months.length
                  : 0
                const value = mi === null ? avgMargin : (vals?.[mi] ?? 0)
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 px-4 py-1.5 italic text-[var(--muted)] border-b border-[var(--line-2)]"
                  >
                    <span>{p.label}</span>
                    <span className="av-num">{fmtPct(value)}</span>
                  </div>
                )
              }

              if (p.t === 'kpiheader') {
                return (
                  <div
                    key={idx}
                    className="px-4 py-2 text-[10.5px] uppercase tracking-[0.06em] font-semibold bg-[var(--card-2)] text-[var(--muted)] border-y border-[var(--line-2)]"
                  >
                    {p.label}
                  </div>
                )
              }

              if (p.t === 'kpi') {
                if (p.groupId && !expandedGroups.has(p.groupId)) return null
                const isKpiDec = KPI_DECIMAL_KEYS.has(p.key)
                const value = mi === null
                  ? (isKpiDec ? getTotal(p.key) / Math.max(months.length, 1) : getTotal(p.key))
                  : (monthlyData[p.key]?.[mi] ?? 0)
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 px-4 py-1.5 text-[var(--ink-2)] border-b border-[var(--line-2)]"
                  >
                    <span>{p.label}</span>
                    <span className="av-num">{isKpiDec ? fmtDec(value, 2) : fmt(value, 0)}</span>
                  </div>
                )
              }

              return null
            })}
          </div>
        </>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-max min-w-full text-xs">
          {/* Month header row */}
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-2)' }}>
              <th
                className={`sticky left-0 z-10 text-left px-4 py-2 font-medium ${labelColWidth}`}
                style={{ background: 'var(--card)', color: 'var(--muted)' }}
              >
                &nbsp;
              </th>
              {months.map((m, i) => {
                const info = monthInfos?.[i]
                const partial = info ? info.activeDays < info.totalDays : false
                return (
                  <th
                    key={i}
                    className={`text-right px-3 py-2 font-medium ${dataColWidth}`}
                    style={{ color: 'var(--muted)' }}
                  >
                    {m.label}
                    {partial && (
                      <span className="ml-1 text-[9px] font-normal" style={{ color: 'var(--muted-2)' }}>
                        {info!.activeDays}/{info!.totalDays}
                      </span>
                    )}
                  </th>
                )
              })}
              <th
                className={`text-right px-3 py-2 font-semibold ${dataColWidth}`}
                style={{ color: 'var(--ink)', borderLeft: '1px solid var(--line-2)' }}
              >
                TOTAL
              </th>
            </tr>
          </thead>

          <tbody>
            {PNL_PLAN.map((p, idx) => {
              // Section header — Revenue/Overhead are collapsible (chevron); others static.
              if (p.t === 'section') {
                const open = p.groupId ? expandedGroups.has(p.groupId) : false
                const bandCls =
                  'sticky left-0 z-10 bg-[var(--card-2)] px-4 py-1.5 text-[10.5px] text-[var(--muted)] uppercase tracking-[0.06em] font-semibold border-y border-[var(--line-2)]'
                if (p.groupId) {
                  return (
                    <tr key={idx} onClick={() => toggleGroup(p.groupId!)} className="cursor-pointer select-none">
                      <td colSpan={months.length + 2} className={bandCls}>
                        <span className="inline-flex items-center gap-1">
                          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {p.label}
                        </span>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={idx}>
                    <td colSpan={months.length + 2} className={bandCls}>{p.label}</td>
                  </tr>
                )
              }

              // Collapsible category subtotal (A/C/M/I/DOC/Other)
              if (p.t === 'group') {
                const open = expandedGroups.has(p.groupId)
                const { v, tot } = groupVals(p.keys)
                return (
                  <tr key={idx} onClick={() => toggleGroup(p.groupId)} className="cursor-pointer hover:bg-[var(--hover)]">
                    <td
                      className={`sticky left-0 z-10 px-4 py-1 font-medium pl-6 ${labelColWidth}`}
                      style={{ background: 'var(--card)', color: 'var(--ink)' }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {open
                          ? <ChevronDown size={12} style={{ color: 'var(--muted-2)' }} />
                          : <ChevronRight size={12} style={{ color: 'var(--muted-2)' }} />}
                        {p.label}
                      </span>
                    </td>
                    {v.map((val, mi) => (
                      <td key={mi} className={`text-right px-3 py-1 av-num font-medium text-[var(--ink)] ${dataColWidth} ${valColor(val)}`}>
                        {fmt(val, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1 av-num font-medium text-[var(--ink)] ${dataColWidth} border-l border-[var(--line-2)] ${valColor(tot)}`}>
                      {fmt(tot, 0)}
                    </td>
                  </tr>
                )
              }

              // Detail item — shown only when its group is expanded (loose items always)
              if (p.t === 'item') {
                if (p.groupId && !expandedGroups.has(p.groupId)) return null
                const vals = monthlyData[p.key]
                const total = getTotal(p.key)
                const indent = p.groupId ? 'pl-10' : 'pl-8'
                return (
                  <tr key={idx} className="hover:bg-[var(--hover)]">
                    <td
                      className={`sticky left-0 z-10 px-4 py-1 ${indent} ${labelColWidth}`}
                      style={{ background: 'var(--card)', color: 'var(--muted)' }}
                    >
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td
                        key={mi}
                        className={`text-right px-3 py-1 av-num text-[var(--ink-2)] ${dataColWidth} ${valColor(v)} ${p.clickable ? 'hover:underline hover:text-[var(--cyan-ink)]' : ''}`}
                        onMouseEnter={p.clickable ? (e) => {
                          setPopover({ rowKey: p.key, monthIndex: mi, x: e.clientX, y: e.clientY })
                        } : undefined}
                        onMouseLeave={p.clickable ? () => setPopover(null) : undefined}
                      >
                        {fmt(v, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1 av-num text-[var(--ink-2)] ${dataColWidth} border-l border-[var(--line-2)] ${valColor(total)}`}>
                      {fmt(total, 0)}
                    </td>
                  </tr>
                )
              }

              // Subtotal rows (Total revenue / variable / fixed / overhead)
              if (p.t === 'total') {
                const vals = monthlyData[p.key]
                const total = getTotal(p.key)
                return (
                  <tr key={idx} className="border-t border-[var(--line-2)] bg-[var(--card-2)]">
                    <td className={`sticky left-0 z-10 bg-[var(--card-2)] px-4 py-1.5 text-[var(--ink)] font-semibold ${labelColWidth}`}>
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td key={mi} className={`text-right px-3 py-1.5 av-num font-semibold text-[var(--ink)] ${dataColWidth} ${valColor(v)}`}>
                        {fmt(v, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1.5 av-num font-semibold text-[var(--ink)] ${dataColWidth} border-l border-[var(--line-2)] ${valColor(total)}`}>
                      {fmt(total, 0)}
                    </td>
                  </tr>
                )
              }

              // Result rows — EBITDA/Net profit accent band; contributions quieter
              if (p.t === 'result') {
                const vals = monthlyData[p.key]
                const total = getTotal(p.key)
                const isKey = p.key === 'ebitda' || p.key === 'netProfit'
                const rowCls = isKey
                  ? 'border-t-2 border-[var(--cyan)] bg-[var(--cyan-soft)]'
                  : 'border-t border-[var(--line-2)] bg-[var(--card-2)]'
                const stickyBg = isKey ? 'bg-[var(--cyan-soft)]' : 'bg-[var(--card-2)]'
                return (
                  <tr key={idx} className={rowCls}>
                    <td className={`sticky left-0 z-10 ${stickyBg} px-4 py-2 text-[var(--ink)] font-bold ${labelColWidth}`}>
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td key={mi} className={`text-right px-3 py-2 av-num font-bold ${dataColWidth} ${v < 0 ? 'av-neg' : 'av-pos'}`}>
                        {fmt(v, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-2 av-num font-bold ${dataColWidth} border-l border-[var(--line-2)] ${total < 0 ? 'av-neg' : 'av-pos'}`}>
                      {fmt(total, 0)}
                    </td>
                  </tr>
                )
              }

              // Margin rows (%)
              if (p.t === 'margin') {
                const vals = monthlyData[p.key]
                const avgMargin = months.length > 0
                  ? (vals ?? []).reduce((s, v) => s + v, 0) / months.length
                  : 0
                return (
                  <tr key={idx}>
                    <td
                      className={`sticky left-0 z-10 px-4 py-1 italic ${labelColWidth}`}
                      style={{ background: 'var(--card)', color: 'var(--muted)' }}
                    >
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td key={mi} className={`text-right px-3 py-1 av-num italic ${dataColWidth}`} style={{ color: 'var(--muted)' }}>
                        {fmtPct(v)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1 av-num italic ${dataColWidth} border-l border-[var(--line-2)]`} style={{ color: 'var(--muted)' }}>
                      {fmtPct(avgMargin)}
                    </td>
                  </tr>
                )
              }

              // KPI header band
              if (p.t === 'kpiheader') {
                return (
                  <tr key={idx}>
                    <td colSpan={months.length + 2} className="sticky left-0 z-10 bg-[var(--card-2)] px-4 py-1.5 text-[10.5px] text-[var(--muted)] uppercase tracking-[0.06em] font-semibold border-y border-[var(--line-2)]">
                      {p.label}
                    </td>
                  </tr>
                )
              }

              // KPI rows — only when the KPIs group is expanded
              if (p.t === 'kpi') {
                if (p.groupId && !expandedGroups.has(p.groupId)) return null
                const vals = monthlyData[p.key]
                const kpiTotal = getTotal(p.key)
                const isKpiDec = KPI_DECIMAL_KEYS.has(p.key)
                return (
                  <tr key={idx}>
                    <td
                      className={`sticky left-0 z-10 px-4 py-1 ${labelColWidth}`}
                      style={{ background: 'var(--card)', color: 'var(--ink-2)' }}
                    >
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td key={mi} className={`text-right px-3 py-1 av-num text-[var(--ink-2)] ${dataColWidth}`}>
                        {isKpiDec ? fmtDec(v, 2) : fmt(v, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1 av-num text-[var(--ink-2)] ${dataColWidth} border-l border-[var(--line-2)]`}>
                      {isKpiDec ? fmtDec(kpiTotal / Math.max(months.length, 1), 2) : fmt(kpiTotal, 0)}
                    </td>
                  </tr>
                )
              }

              return null
            })}
          </tbody>
        </table>
      </div>
      )}

      <p className="px-4 py-3 text-[11px] border-t border-[var(--line-2)]" style={{ color: 'var(--muted)' }}>
        Partial months are prorated by active days — a project starting or ending mid-month bears its
        day-fraction of fixed costs and overhead. EBITDA reconciles to the dashboard&apos;s net profit.
      </p>

      {/* Line detail popover */}
      {popover && (() => {
        const cfg = getDetailConfig(popover.rowKey, popover.monthIndex)
        if (!cfg) return null
        return (
          <LineDetailPopover
            title={cfg.title}
            monthLabel={months[popover.monthIndex]?.label ?? ''}
            items={cfg.items}
            params={cfg.params}
            cursor={{ x: popover.x, y: popover.y }}
          />
        )
      })()}
    </div>
  )
}
