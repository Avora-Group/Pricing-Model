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
import { buildMonthDayInfos } from '@/lib/pnl-proration'
import type { MsnInput } from '@/stores/pricing-store'
import { LineDetailPopover } from './CostDetailPopover'
import type { BreakdownItem, ParamItem } from './CostDetailPopover'

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
): Record<string, number[]> {
  if (input.seasonalityEnabled && input.summer && input.winter) {
    // Determine effective period for each season (YYYY-MM from periodStart)
    const summerStart = input.summer.periodStart.substring(0, 7)
    const summerEnd = input.summer.periodEnd.substring(0, 7)
    const winterStart = input.winter.periodStart.substring(0, 7)
    const winterEnd = input.winter.periodEnd.substring(0, 7)

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

    const summerR = computeMsnConfig(summerInput, crew, costs, exchangeRate, fdDays, nfdDays)
    const winterR = computeMsnConfig(winterInput, crew, costs, exchangeRate, fdDays, nfdDays)

    // Build monthly data for each season config across the full month range
    const summerMdi = buildMonthDayInfos(months, input.summer.periodStart, input.summer.periodEnd)
    const winterMdi = buildMonthDayInfos(months, input.winter.periodStart, input.winter.periodEnd)

    const summerData = buildMonthlyData(
      months, summerR.mgh, summerR.acmiRate, summerR.excessBh, summerR.excessHourRate,
      summerR.cycleRatio, summerR.bhFhRatio, summerR.apuFhRatio, summerR.cfg, summerMdi,
    )
    const winterData = buildMonthlyData(
      months, winterR.mgh, winterR.acmiRate, winterR.excessBh, winterR.excessHourRate,
      winterR.cycleRatio, winterR.bhFhRatio, winterR.apuFhRatio, winterR.cfg, winterMdi,
    )

    // For each month, pick the correct season's data
    const data: Record<string, number[]> = {}
    for (const k of ALL_KEYS_IMPORT) {
      data[k] = new Array(months.length).fill(0)
    }

    for (let m = 0; m < months.length; m++) {
      const ms = `${months[m].year}-${String(months[m].month).padStart(2, '0')}`
      const inSummer = ms >= summerStart && ms <= summerEnd
      const inWinter = ms >= winterStart && ms <= winterEnd

      const src = inSummer ? summerData : inWinter ? winterData : null
      if (src) {
        for (const k of ALL_KEYS_IMPORT) {
          data[k][m] = src[k][m]
        }
      }
      // If month is in neither season, values stay 0
    }

    return data
  }

  // Non-seasonal: original logic
  const r = computeMsnConfig(input, crew, costs, exchangeRate, fdDays, nfdDays)
  const mdi = buildMonthDayInfos(months, input.periodStart, input.periodEnd)
  return buildMonthlyData(
    months, r.mgh, r.acmiRate, r.excessBh, r.excessHourRate,
    r.cycleRatio, r.bhFhRatio, r.apuFhRatio, r.cfg, mdi,
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
  anchorRect: DOMRect
}

export function PnlTable() {
  const selectedMsn = usePricingStore((s) => s.selectedMsn)
  const msnResults = usePricingStore((s) => s.msnResults)
  const totalResult = usePricingStore((s) => s.totalResult)
  const isCalculating = usePricingStore((s) => s.isCalculating)
  const msnInputs = usePricingStore((s) => s.msnInputs)
  const exchangeRate = parseFloat(usePricingStore((s) => s.exchangeRate) || '0.85')

  // -- Crew config store --
  const crewPayroll = useCrewConfigStore((s) => s.payroll)
  const crewOtherCost = useCrewConfigStore((s) => s.otherCost)
  const crewTraining = useCrewConfigStore((s) => s.training)
  const crewAvgAC = useCrewConfigStore((s) => s.averageAC)
  const crewFdDays = useCrewConfigStore((s) => s.fdDays)
  const crewNfdDays = useCrewConfigStore((s) => s.nfdDays)

  // -- Costs config store --
  const costsMaintPersonnel = useCostsConfigStore((s) => s.maintPersonnel)
  const costsMaintCosts = useCostsConfigStore((s) => s.maintCosts)
  const costsInsurance = useCostsConfigStore((s) => s.insurance)
  const costsDoc = useCostsConfigStore((s) => s.doc)
  const costsOtherCogs = useCostsConfigStore((s) => s.otherCogs)
  const costsOverhead = useCostsConfigStore((s) => s.overhead)
  const costsAvgAc = useCostsConfigStore((s) => s.avgAc)

  // -- Cost detail popover state --
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const closePopover = useCallback(() => setPopover(null), [])

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
    // Total project view
    if (msnInputs.length > 0) {
      hasData = true
      // Period: earliest start to latest end across all MSNs (accounting for seasonality)
      const allPeriods = msnInputs.map(getEffectivePeriod)
      periodStart = allPeriods.reduce((min, p) => (p.start < min ? p.start : min), allPeriods[0].start)
      periodEnd = allPeriods.reduce((max, p) => (p.end > max ? p.end : max), allPeriods[0].end)
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
      monthlyData = buildMsnMonthlyData(input, months, crew, costs, exchangeRate, crewFdDays, crewNfdDays)
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

    for (const input of msnInputs) {
      const msnData = buildMsnMonthlyData(input, months, crew, costs, exchangeRate, crewFdDays, crewNfdDays)

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
        <p className="text-[var(--text-muted)] text-sm">
          Configure MSNs on the Dashboard to see P&L calculations
        </p>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="av-panel p-8 text-center">
        <p className="text-[var(--text-muted)] text-sm">
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
          const eprRate = interpolateEpr(msnInput.eprMatrix ?? [], cr, msnInput.environment)
          const llp1 = parseFloat(msnInput.llp1RateUsd || '0')
          const llp2 = parseFloat(msnInput.llp2RateUsd || '0')
          const apuRate = parseFloat(msnInput.apuRateUsd || '0')
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
      case 'maintReservesFixed':
        return {
          title: 'Maint. Reserves - Fixed',
          items: [
            { label: '6-Year Check', value: v('maintReservesFixed_6yr') },
            { label: '12-Year Check', value: v('maintReservesFixed_12yr') },
            { label: 'Landing Gear', value: v('maintReservesFixed_ldg') },
          ],
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

  // Column widths
  const labelColWidth = 'min-w-[260px]'
  const dataColWidth = 'min-w-[100px]'

  return (
    <div className={`av-panel overflow-hidden transition-opacity ${isCalculating ? 'opacity-60' : ''}`}>
      {/* MSN header */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{headerLabel}</h2>
        <button
          onClick={() => setExpandedGroups(expandedGroups.size ? new Set() : new Set(ALL_GROUP_IDS))}
          className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {expandedGroups.size ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Scrollable table container */}
      <div className="overflow-x-auto">
        <table className="w-max min-w-full text-xs">
          {/* Month header row */}
          <thead>
            <tr className="border-b border-[var(--border-secondary)]">
              <th className={`sticky left-0 z-10 bg-white dark:bg-gray-900 text-left px-4 py-2 text-[var(--text-tertiary)] font-medium ${labelColWidth}`}>
                &nbsp;
              </th>
              {months.map((m, i) => {
                const info = monthInfos?.[i]
                const partial = info ? info.activeDays < info.totalDays : false
                return (
                  <th
                    key={i}
                    className={`text-right px-3 py-2 text-[var(--text-tertiary)] font-medium ${dataColWidth}`}
                  >
                    {m.label}
                    {partial && (
                      <span className="ml-1 text-[9px] font-normal text-[var(--text-muted)]">
                        {info!.activeDays}/{info!.totalDays}
                      </span>
                    )}
                  </th>
                )
              })}
              <th className={`text-right px-3 py-2 text-[var(--text-primary)] font-semibold ${dataColWidth} border-l border-[var(--border-secondary)]`}>
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
                  'sticky left-0 z-10 bg-[var(--bg-secondary)] px-4 py-1.5 text-[10.5px] text-[var(--text-tertiary)] uppercase tracking-[0.06em] font-semibold border-y border-[var(--border-primary)]'
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
                  <tr key={idx} onClick={() => toggleGroup(p.groupId)} className="cursor-pointer hover:bg-[var(--bg-secondary)]">
                    <td className={`sticky left-0 z-10 bg-white dark:bg-gray-900 px-4 py-1 text-[var(--text-primary)] font-medium pl-6 ${labelColWidth}`}>
                      <span className="inline-flex items-center gap-1">
                        {open
                          ? <ChevronDown size={12} className="text-[var(--text-muted)]" />
                          : <ChevronRight size={12} className="text-[var(--text-muted)]" />}
                        {p.label}
                      </span>
                    </td>
                    {v.map((val, mi) => (
                      <td key={mi} className={`text-right px-3 py-1 av-num font-medium text-[var(--text-primary)] ${dataColWidth} ${valColor(val)}`}>
                        {fmt(val, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1 av-num font-medium text-[var(--text-primary)] ${dataColWidth} border-l border-[var(--border-secondary)] ${valColor(tot)}`}>
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
                  <tr key={idx} className="hover:bg-[var(--bg-secondary)]">
                    <td className={`sticky left-0 z-10 bg-white dark:bg-gray-900 px-4 py-1 text-[var(--text-tertiary)] ${indent} ${labelColWidth}`}>
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td
                        key={mi}
                        className={`text-right px-3 py-1 av-num text-[var(--text-secondary)] ${dataColWidth} ${valColor(v)} ${p.clickable ? 'cursor-pointer hover:underline hover:text-indigo-600 dark:hover:text-indigo-400' : ''}`}
                        onClick={p.clickable ? (e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setPopover({ rowKey: p.key, monthIndex: mi, anchorRect: rect })
                        } : undefined}
                      >
                        {fmt(v, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1 av-num text-[var(--text-secondary)] ${dataColWidth} border-l border-[var(--border-secondary)] ${valColor(total)}`}>
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
                  <tr key={idx} className="border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
                    <td className={`sticky left-0 z-10 bg-[var(--bg-secondary)] px-4 py-1.5 text-[var(--text-primary)] font-semibold ${labelColWidth}`}>
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td key={mi} className={`text-right px-3 py-1.5 av-num font-semibold text-[var(--text-primary)] ${dataColWidth} ${valColor(v)}`}>
                        {fmt(v, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1.5 av-num font-semibold text-[var(--text-primary)] ${dataColWidth} border-l border-[var(--border-secondary)] ${valColor(total)}`}>
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
                  ? 'border-t-2 border-[var(--av-accent)] bg-[var(--av-accent-soft)]'
                  : 'border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]'
                const stickyBg = isKey ? 'bg-[var(--av-accent-soft)]' : 'bg-[var(--bg-secondary)]'
                return (
                  <tr key={idx} className={rowCls}>
                    <td className={`sticky left-0 z-10 ${stickyBg} px-4 py-2 text-[var(--text-primary)] font-bold ${labelColWidth}`}>
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td key={mi} className={`text-right px-3 py-2 av-num font-bold ${dataColWidth} ${v < 0 ? 'text-[var(--av-neg)]' : 'text-[var(--av-pos)]'}`}>
                        {fmt(v, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-2 av-num font-bold ${dataColWidth} border-l border-[var(--border-secondary)] ${total < 0 ? 'text-[var(--av-neg)]' : 'text-[var(--av-pos)]'}`}>
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
                    <td className={`sticky left-0 z-10 bg-white dark:bg-gray-900 px-4 py-1 text-[var(--text-tertiary)] italic ${labelColWidth}`}>
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td key={mi} className={`text-right px-3 py-1 av-num text-[var(--text-tertiary)] italic ${dataColWidth}`}>
                        {fmtPct(v)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1 av-num text-[var(--text-tertiary)] italic ${dataColWidth} border-l border-[var(--border-secondary)]`}>
                      {fmtPct(avgMargin)}
                    </td>
                  </tr>
                )
              }

              // KPI header band
              if (p.t === 'kpiheader') {
                return (
                  <tr key={idx}>
                    <td colSpan={months.length + 2} className="sticky left-0 z-10 bg-[var(--bg-secondary)] px-4 py-1.5 text-[10.5px] text-[var(--text-tertiary)] uppercase tracking-[0.06em] font-semibold border-y border-[var(--border-primary)]">
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
                    <td className={`sticky left-0 z-10 bg-white dark:bg-gray-900 px-4 py-1 text-[var(--text-secondary)] ${labelColWidth}`}>
                      {p.label}
                    </td>
                    {(vals ?? []).map((v, mi) => (
                      <td key={mi} className={`text-right px-3 py-1 av-num text-[var(--text-secondary)] ${dataColWidth}`}>
                        {isKpiDec ? fmtDec(v, 2) : fmt(v, 0)}
                      </td>
                    ))}
                    <td className={`text-right px-3 py-1 av-num text-[var(--text-secondary)] ${dataColWidth} border-l border-[var(--border-secondary)]`}>
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

      <p className="px-4 py-3 text-[11px] text-[var(--text-tertiary)] border-t border-[var(--border-primary)]">
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
            anchorRect={popover.anchorRect}
            onClose={closePopover}
          />
        )
      })()}
    </div>
  )
}
