/**
 * Excel export for the ACMI pricing calculation.
 *
 * Produces a 5-sheet, formula-driven workbook (Calculation, P&L, Aircraft,
 * Crew, Costs). All monetary drivers (rates, salaries, costs, MGH, ACMI rate,
 * exchange rate, crew sets, cycle ratio, avg A/C, FD/NFD days, EPR matrix) are
 * live, editable cells; every cost build-up and the P&L are Excel formulas
 * referencing them, so editing an input recalculates the whole workbook.
 *
 * Calendar-derived proration factors (per-month day fractions, season flags)
 * are baked from the fixed period dates — there is no editable date model in
 * the sheet. Seasonal MSNs are expanded into two columns (summer/winter),
 * exactly as the live calculation does.
 *
 * Formula cells also carry a pre-computed `result` taken from the app's own
 * pricing engine, so the file shows correct numbers even before recalculation.
 */

import type { MsnInput } from '@/stores/pricing-store'
import { generateMonthRange } from '@/stores/pricing-store'
import type { PayrollRow, CostRow, TrainingRow } from '@/stores/crew-config-store'
import type {
  MaintPersonnel,
  MaintCostItem,
  InsuranceItem,
  DocItem,
  OtherCogsItem,
  OverheadItem,
} from '@/stores/costs-config-store'
import {
  deriveCrewValues,
  deriveCostsValues,
  computeMsnConfig,
} from '@/lib/pnl-msn-config'
import { buildMonthlyData } from '@/lib/pnl-monthly-builder'
import { buildMonthDayInfos } from '@/lib/pnl-proration'
import { PNL_ROWS } from '@/lib/pnl-row-defs'

// ---- Public input shape ----

export interface CrewExportData {
  payroll: PayrollRow[]
  otherCost: CostRow[]
  training: TrainingRow[]
  averageAC: number
  fdDays: number
  nfdDays: number
}

export interface CostsExportData {
  maintPersonnel: MaintPersonnel[]
  maintCosts: MaintCostItem[]
  insurance: InsuranceItem[]
  doc: DocItem[]
  otherCogs: OtherCogsItem[]
  overhead: OverheadItem[]
  avgAc: number
}

export interface CalcExportData {
  projectName: string
  exchangeRate: number
  marginPercent: number
  bhFhRatio: number
  apuFhRatio: number
  msnInputs: MsnInput[]
  crew: CrewExportData
  costs: CostsExportData
}

// ---- Sheet names ----

const S_CALC = 'Calculation'
const S_PNL = 'P&L'
const S_AC = 'Aircraft'
const S_CREW = 'Crew'
const S_COSTS = 'Costs'

// ---- Small helpers ----

/** 1-based column index -> spreadsheet column letter (1 -> A, 27 -> AA). */
function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Absolute, sheet-qualified address, e.g. 'Crew'!$B$3 */
function ref(sheet: string, col: number, row: number): string {
  return `'${sheet}'!$${colLetter(col)}$${row}`
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ---- Number formats ----

const FMT_EUR = '#,##0'
const FMT_EUR2 = '#,##0.00'
const FMT_RATE = '#,##0.00'
const FMT_PCT = '0.0%'
const FMT_NUM = '#,##0'
const FMT_DEC = '#,##0.00'

// ---- Effective-period helper (mirrors PnlTable.getEffectivePeriod) ----

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

// ---- Expanded entry: one column on the Calculation sheet ----

interface Entry {
  label: string
  input: MsnInput // virtual input (season fields overlaid for seasonal entries)
  start: string
  end: string
  // engine-computed config (full-month values)
  cfg: ReturnType<typeof computeMsnConfig>
  // baked per-global-month coefficients, keyed "YYYY-MM"
  coeffs: Map<string, { df: number; cdf: number; isSummer: boolean }>
  // engine monthly data mapped onto the global month grid (for results)
  monthly: Record<string, number[]>
  cabinCount: number
  seniorCount: number
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Build the expanded entries (seasonal MSN -> summer + winter). */
function buildEntries(
  data: CalcExportData,
  globalMonths: { year: number; month: number; label: string }[],
): Entry[] {
  const crew = deriveCrewValues(
    data.crew.payroll, data.crew.otherCost, data.crew.training,
    data.crew.averageAC, data.crew.fdDays, data.crew.nfdDays,
  )
  const costs = deriveCostsValues(
    data.costs.maintPersonnel, data.costs.maintCosts, data.costs.insurance,
    data.costs.doc, data.costs.otherCogs, data.costs.overhead,
    data.costs.avgAc, data.exchangeRate,
  )
  const fd = data.crew.fdDays
  const nfd = data.crew.nfdDays

  const entries: Entry[] = []

  const makeEntry = (input: MsnInput, label: string, start: string, end: string) => {
    const cfg = computeMsnConfig(input, crew, costs, data.exchangeRate, fd, nfd)
    const months = generateMonthRange(start, end)
    const mdi = buildMonthDayInfos(months, start, end)
    const workingDays = fd + nfd

    // Per-entry monthly data, then mapped onto the global grid (out-of-period -> 0).
    const localData = buildMonthlyData(
      months, cfg.mgh, cfg.acmiRate, cfg.excessBh, cfg.excessHourRate,
      cfg.cycleRatio, cfg.bhFhRatio, cfg.apuFhRatio, cfg.cfg, mdi,
    )
    const globalData: Record<string, number[]> = {}
    const keys = Object.keys(localData)
    for (const k of keys) globalData[k] = new Array(globalMonths.length).fill(0)

    const coeffs = new Map<string, { df: number; cdf: number; isSummer: boolean }>()
    const globalIndexByKey = new Map<string, number>()
    globalMonths.forEach((gm, gi) => globalIndexByKey.set(monthKey(gm.year, gm.month), gi))

    months.forEach((m, i) => {
      const info = mdi[i]
      const isPartial = info.activeDays < info.totalDays
      const df = isPartial ? info.activeDays / info.totalDays : 1.0
      const cdf = isPartial && workingDays > 0 ? info.activeDays / workingDays : 1.0
      const isSummer = m.month >= 5 && m.month <= 10
      const key = monthKey(m.year, m.month)
      coeffs.set(key, { df, cdf, isSummer })
      const gi = globalIndexByKey.get(key)
      if (gi !== undefined) {
        for (const k of keys) globalData[k][gi] = localData[k][i]
      }
    })

    // cabin / senior crew counts (baked from lease type + aircraft type)
    let cabinCount = 0
    let seniorCount = 0
    if (input.leaseType === 'wet') {
      cabinCount = input.aircraftType === 'A321' ? 4 : 3
      seniorCount = 1
    } else if (input.leaseType === 'moist') {
      seniorCount = 1
    }

    entries.push({ label, input, start, end, cfg, coeffs, monthly: globalData, cabinCount, seniorCount })
  }

  for (const input of data.msnInputs) {
    if (input.seasonalityEnabled && input.summer && input.winter) {
      const summerInput: MsnInput = {
        ...input,
        mgh: input.summer.mgh,
        cycleRatio: input.summer.cycleRatio,
        acmiRate: input.summer.acmiRate,
        excessHourRate: input.summer.excessHourRate,
        excessBh: input.summer.excessBh,
        crewSets: input.summer.crewSets,
        periodStart: input.summer.periodStart,
        periodEnd: input.summer.periodEnd,
      }
      const winterInput: MsnInput = {
        ...input,
        mgh: input.winter.mgh,
        cycleRatio: input.winter.cycleRatio,
        acmiRate: input.winter.acmiRate,
        excessHourRate: input.winter.excessHourRate,
        excessBh: input.winter.excessBh,
        crewSets: input.winter.crewSets,
        periodStart: input.winter.periodStart,
        periodEnd: input.winter.periodEnd,
      }
      makeEntry(summerInput, `MSN ${input.msn} (S)`, input.summer.periodStart, input.summer.periodEnd)
      makeEntry(winterInput, `MSN ${input.msn} (W)`, input.winter.periodStart, input.winter.periodEnd)
    } else {
      makeEntry(input, `MSN ${input.msn}`, input.periodStart, input.periodEnd)
    }
  }

  return entries
}

// ============================================================================
// Workbook builder
// ============================================================================

export async function buildCalculationWorkbook(data: CalcExportData) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Avora ACMI Pricing'
  wb.calcProperties.fullCalcOnLoad = true

  // Plan for EPR interpolation formulas (written after the Calc cycle-ratio cell exists).
  const eprRatePlan: {
    ei: number
    cell: { col: number; row: number }
    crRange: string
    rRange: string
  }[] = []

  // Global month range across all (effective) periods.
  let gStart = ''
  let gEnd = ''
  for (const input of data.msnInputs) {
    const ep = getEffectivePeriod(input)
    if (!gStart || ep.start < gStart) gStart = ep.start
    if (!gEnd || ep.end > gEnd) gEnd = ep.end
  }
  const globalMonths = gStart && gEnd ? generateMonthRange(gStart, gEnd) : []

  const entries = buildEntries(data, globalMonths)

  // Create all sheets up front in the requested tab order. Cross-sheet formula
  // references resolve by name/address, so populating order is irrelevant.
  const calc = wb.addWorksheet(S_CALC, { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] })
  const pnl = wb.addWorksheet(S_PNL, { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] })
  const acWs = wb.addWorksheet(S_AC, { views: [{ state: 'frozen', ySplit: 1 }] })
  const crew = wb.addWorksheet(S_CREW, { views: [{ state: 'frozen', ySplit: 1 }] })
  const costsWs = wb.addWorksheet(S_COSTS, { views: [{ state: 'frozen', ySplit: 1 }] })

  // ---- Style helpers ----
  const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as const
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } } as const
  const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } } as const
  const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } } as const
  const white = { argb: 'FFFFFFFF' }
  const inputFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } } as const // pale amber = editable

  // ===========================================================================
  // CREW SHEET
  // ===========================================================================
  crew.columns = [
    { width: 42 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
  ]
  const cTitle = crew.getCell('A1')
  cTitle.value = 'CREW CONFIGURATION'
  cTitle.font = { bold: true, color: white, size: 12 }
  cTitle.fill = titleFill
  crew.mergeCells('A1:G1')

  // globals
  crew.getCell('A3').value = 'Average A/C'
  crew.getCell('B3').value = data.crew.averageAC
  crew.getCell('B3').fill = inputFill
  crew.getCell('A4').value = 'FD Days (flying duty / month)'
  crew.getCell('B4').value = data.crew.fdDays
  crew.getCell('B4').fill = inputFill
  crew.getCell('A5').value = 'NFD Days (non-flying duty / month)'
  crew.getCell('B5').value = data.crew.nfdDays
  crew.getCell('B5').fill = inputFill

  const R = {
    crewAvgAc: ref(S_CREW, 2, 3),
    crewFd: ref(S_CREW, 2, 4),
    crewNfd: ref(S_CREW, 2, 5),
  }

  // payroll table
  const payHeadRow = 7
  ;['Position', 'Gross Salary', 'Benefits', 'SS (gross+ben)', 'Per Diem FD', 'Per Diem NFD', 'Per BH Perdiem']
    .forEach((h, i) => {
      const c = crew.getCell(payHeadRow, i + 1)
      c.value = h
      c.font = { bold: true }
      c.fill = headFill
    })
  const payStart = payHeadRow + 1 // row 8
  data.crew.payroll.forEach((p, i) => {
    const r = payStart + i
    crew.getCell(r, 1).value = p.position
    crew.getCell(r, 2).value = p.grossSalary
    crew.getCell(r, 3).value = p.benefits
    crew.getCell(r, 4).value = { formula: `B${r}+C${r}`, result: p.grossSalary + p.benefits }
    crew.getCell(r, 5).value = p.perDiemFD
    crew.getCell(r, 6).value = p.perDiemNFD
    crew.getCell(r, 7).value = p.perBhPerdiem
    for (const col of [2, 3, 5, 6, 7]) crew.getCell(r, col).fill = inputFill
    for (const col of [2, 3, 4, 5, 6, 7]) crew.getCell(r, col).numFmt = FMT_EUR2
  })
  // Payroll row helpers (0-based payroll index -> sheet row)
  const payRow = (i: number) => payStart + i
  const ssRef = (i: number) => ref(S_CREW, 4, payRow(i))
  const fdRef = (i: number) => ref(S_CREW, 5, payRow(i))
  const nfdRef = (i: number) => ref(S_CREW, 6, payRow(i))
  const perBhRef = (i: number) => ref(S_CREW, 7, payRow(i))

  // other cost table
  let r = payStart + data.crew.payroll.length + 1
  crew.getCell(r, 1).value = 'OTHER COST'
  crew.getCell(r, 2).value = 'Amount (annual)'
  crew.getCell(r, 1).font = { bold: true }
  crew.getCell(r, 2).font = { bold: true }
  crew.getCell(r, 1).fill = headFill
  crew.getCell(r, 2).fill = headFill
  r++
  const otherStart = r
  const otherRowByItem = new Map<string, number>()
  data.crew.otherCost.forEach((o, i) => {
    const rr = otherStart + i
    crew.getCell(rr, 1).value = o.item
    crew.getCell(rr, 2).value = o.amount ?? 0
    crew.getCell(rr, 2).fill = inputFill
    crew.getCell(rr, 2).numFmt = FMT_EUR
    otherRowByItem.set(o.item, rr)
  })
  r = otherStart + data.crew.otherCost.length + 1

  // training table
  crew.getCell(r, 1).value = 'TRAINING'
  crew.getCell(r, 2).value = 'Amount (annual)'
  crew.getCell(r, 1).font = { bold: true }
  crew.getCell(r, 2).font = { bold: true }
  crew.getCell(r, 1).fill = headFill
  crew.getCell(r, 2).fill = headFill
  r++
  const trainStart = r
  data.crew.training.forEach((t, i) => {
    const rr = trainStart + i
    crew.getCell(rr, 1).value = t.item
    crew.getCell(rr, 2).value = t.amount ?? 0
    crew.getCell(rr, 2).fill = inputFill
    crew.getCell(rr, 2).numFmt = FMT_EUR
  })
  const trainEnd = trainStart + data.crew.training.length - 1
  r = trainEnd + 2

  // derived block
  const crewDerived = deriveCrewValues(
    data.crew.payroll, data.crew.otherCost, data.crew.training,
    data.crew.averageAC, data.crew.fdDays, data.crew.nfdDays,
  )
  crew.getCell(r, 1).value = 'DERIVED (per month / per A/C)'
  crew.getCell(r, 1).font = { bold: true }
  crew.getCell(r, 1).fill = sectionFill
  crew.mergeCells(r, 1, r, 2)
  r++
  const uniformsRow = otherRowByItem.get('Uniforms')!
  const travelRow = otherRowByItem.get('Travel costs')!
  const accomRow = otherRowByItem.get('Accomodation')!
  // helper to add a derived row
  const crewDeriv: Record<string, string> = {}
  const addDeriv = (label: string, formula: string, result: number, fmt = FMT_EUR2) => {
    crew.getCell(r, 1).value = label
    crew.getCell(r, 2).value = { formula, result }
    crew.getCell(r, 2).numFmt = fmt
    crewDeriv[label] = ref(S_CREW, 2, r)
    r++
  }
  addDeriv('Pilot Salary per Set',
    `${ssRef(0)}+${ssRef(1)}`, crewDerived.pilotSalaryPerSet)
  addDeriv('Cabin Attendant SS', `${ssRef(2)}`, crewDerived.cabinAttendantSS)
  addDeriv('Senior Attendant SS', `${ssRef(6)}`, crewDerived.seniorAttendantSS)
  addDeriv('Uniform per month',
    `${ref(S_CREW, 2, uniformsRow)}/${R.crewAvgAc}/12`, crewDerived.uniformPerMonth)
  addDeriv('Training per month',
    `SUM(${colLetter(2)}${trainStart}:${colLetter(2)}${trainEnd})/${R.crewAvgAc}/12`, crewDerived.trainingPerMonth)
  addDeriv('Accom & Travel C per month',
    `(${ref(S_CREW, 2, travelRow)}+${ref(S_CREW, 2, accomRow)})/${R.crewAvgAc}/12`, crewDerived.accomTravelCPerMonth)
  addDeriv('Pilot Per Diem per Set',
    `(${fdRef(0)}*${R.crewFd}+${nfdRef(0)}*${R.crewNfd})+(${fdRef(1)}*${R.crewFd}+${nfdRef(1)}*${R.crewNfd})`,
    crewDerived.pilotPerDiemPerSet)
  addDeriv('BH Bonus per BH', `${perBhRef(0)}+${perBhRef(1)}`, crewDerived.bhBonusPerBh)
  addDeriv('Cabin Att Per Diem', `${fdRef(2)}*${R.crewFd}+${nfdRef(2)}*${R.crewNfd}`, crewDerived.cabinAttPerDiem)
  addDeriv('Senior Att Per Diem', `${fdRef(6)}*${R.crewFd}+${nfdRef(6)}*${R.crewNfd}`, crewDerived.seniorAttPerDiem)

  const CR = {
    pilotSalaryPerSet: crewDeriv['Pilot Salary per Set'],
    cabinAttendantSS: crewDeriv['Cabin Attendant SS'],
    seniorAttendantSS: crewDeriv['Senior Attendant SS'],
    uniformPerMonth: crewDeriv['Uniform per month'],
    trainingPerMonth: crewDeriv['Training per month'],
    accomTravelCPerMonth: crewDeriv['Accom & Travel C per month'],
    pilotPerDiemPerSet: crewDeriv['Pilot Per Diem per Set'],
    bhBonusPerBh: crewDeriv['BH Bonus per BH'],
    cabinAttPerDiem: crewDeriv['Cabin Att Per Diem'],
    seniorAttPerDiem: crewDeriv['Senior Att Per Diem'],
  }

  // ===========================================================================
  // COSTS SHEET
  // ===========================================================================
  costsWs.columns = [{ width: 40 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 30 }]
  const coTitle = costsWs.getCell('A1')
  coTitle.value = 'COSTS CONFIGURATION'
  coTitle.font = { bold: true, color: white, size: 12 }
  coTitle.fill = titleFill
  costsWs.mergeCells('A1:E1')

  costsWs.getCell('A3').value = 'Average A/C'
  costsWs.getCell('B3').value = data.costs.avgAc
  costsWs.getCell('B3').fill = inputFill
  const costAvgAc = ref(S_COSTS, 2, 3)

  let cr = 5
  // exchange rate reference lives on the Calculation sheet; placed there later.
  const calcExchRef = ref(S_CALC, 2, 3) // Calculation!$B$3 (set below)

  // maint personnel
  costsWs.getCell(cr, 1).value = 'MAINTENANCE PERSONNEL'
  costsWs.getCell(cr, 1).font = { bold: true }
  costsWs.getCell(cr, 1).fill = sectionFill
  cr++
  ;['Name', 'Engineers', 'Per Diem', 'Days', 'Total / A/C / month'].forEach((h, i) => {
    const c = costsWs.getCell(cr, i + 1); c.value = h; c.font = { bold: true }; c.fill = headFill
  })
  cr++
  const mpStart = cr
  data.costs.maintPersonnel.forEach((p, i) => {
    const rr = mpStart + i
    costsWs.getCell(rr, 1).value = p.name
    costsWs.getCell(rr, 2).value = p.engineers
    costsWs.getCell(rr, 3).value = p.perDiem
    costsWs.getCell(rr, 4).value = p.days
    costsWs.getCell(rr, 5).value = { formula: `B${rr}*C${rr}*D${rr}`, result: p.engineers * p.perDiem * p.days }
    for (const col of [2, 3, 4]) costsWs.getCell(rr, col).fill = inputFill
    costsWs.getCell(rr, 5).numFmt = FMT_EUR
  })
  const mpEnd = mpStart + data.costs.maintPersonnel.length - 1
  const maintPerDiemRef = `SUM('${S_COSTS}'!$E$${mpStart}:$E$${mpEnd})`
  cr = mpEnd + 2

  // maint costs
  costsWs.getCell(cr, 1).value = 'MAINTENANCE COST ASSUMPTIONS'
  costsWs.getCell(cr, 1).font = { bold: true }
  costsWs.getCell(cr, 1).fill = sectionFill
  cr++
  ;['Name', 'Per Month / A/C', 'P&L Mapping'].forEach((h, i) => {
    const c = costsWs.getCell(cr, i + 1); c.value = h; c.font = { bold: true }; c.fill = headFill
  })
  cr++
  const mcStart = cr
  const mcRowByName = new Map<string, number>()
  data.costs.maintCosts.forEach((m, i) => {
    const rr = mcStart + i
    costsWs.getCell(rr, 1).value = m.name
    costsWs.getCell(rr, 2).value = m.perMonthPerAc
    costsWs.getCell(rr, 2).fill = inputFill
    costsWs.getCell(rr, 2).numFmt = FMT_EUR2
    costsWs.getCell(rr, 3).value = m.mapping
    mcRowByName.set(m.name, rr)
  })
  cr = mcStart + data.costs.maintCosts.length + 1
  const mcRef = (name: string) => {
    const row = mcRowByName.get(name)
    return row ? ref(S_COSTS, 2, row) : '0'
  }

  // insurance
  costsWs.getCell(cr, 1).value = 'INSURANCE'
  costsWs.getCell(cr, 1).font = { bold: true }
  costsWs.getCell(cr, 1).fill = sectionFill
  cr++
  ;['MSN', 'Price (USD)', 'Price (EUR)'].forEach((h, i) => {
    const c = costsWs.getCell(cr, i + 1); c.value = h; c.font = { bold: true }; c.fill = headFill
  })
  cr++
  const insStart = cr
  const insRowByMsn = new Map<number, number>()
  data.costs.insurance.forEach((ins, i) => {
    const rr = insStart + i
    costsWs.getCell(rr, 1).value = ins.msn
    costsWs.getCell(rr, 2).value = ins.priceUsd
    costsWs.getCell(rr, 2).fill = inputFill
    costsWs.getCell(rr, 2).numFmt = FMT_EUR
    costsWs.getCell(rr, 3).value = { formula: `B${rr}*${calcExchRef}`, result: ins.priceUsd * data.exchangeRate }
    costsWs.getCell(rr, 3).numFmt = FMT_EUR
    insRowByMsn.set(ins.msn, rr)
  })
  cr = insStart + data.costs.insurance.length + 1
  const insEurRef = (msn: number) => {
    const row = insRowByMsn.get(msn)
    return row ? ref(S_COSTS, 3, row) : '0'
  }

  // DOC
  costsWs.getCell(cr, 1).value = 'DOC — DIRECT OPERATING COST'
  costsWs.getCell(cr, 1).font = { bold: true }
  costsWs.getCell(cr, 1).fill = sectionFill
  cr++
  ;['Name', 'Total (annual)', 'Per Month / A/C', 'P&L Mapping'].forEach((h, i) => {
    const c = costsWs.getCell(cr, i + 1); c.value = h; c.font = { bold: true }; c.fill = headFill
  })
  cr++
  const docStart = cr
  const docPerMonthRef: string[] = []
  data.costs.doc.forEach((d, i) => {
    const rr = docStart + i
    costsWs.getCell(rr, 1).value = d.name
    costsWs.getCell(rr, 2).value = d.total
    costsWs.getCell(rr, 2).fill = inputFill
    costsWs.getCell(rr, 2).numFmt = FMT_EUR
    costsWs.getCell(rr, 3).value = {
      formula: `B${rr}/${costAvgAc}/12`,
      result: data.costs.avgAc > 0 ? d.total / data.costs.avgAc / 12 : 0,
    }
    costsWs.getCell(rr, 3).numFmt = FMT_EUR2
    costsWs.getCell(rr, 4).value = d.mapping
    docPerMonthRef[i] = ref(S_COSTS, 3, rr)
  })
  cr = docStart + data.costs.doc.length + 1

  // other COGS
  costsWs.getCell(cr, 1).value = 'OTHER COGS'
  costsWs.getCell(cr, 1).font = { bold: true }
  costsWs.getCell(cr, 1).fill = sectionFill
  cr++
  ;['Name', 'Total (annual)', 'Per Month / per BH', 'P&L Mapping'].forEach((h, i) => {
    const c = costsWs.getCell(cr, i + 1); c.value = h; c.font = { bold: true }; c.fill = headFill
  })
  cr++
  const ocStart = cr
  const ocRowByName = new Map<string, number>()
  data.costs.otherCogs.forEach((o, i) => {
    const rr = ocStart + i
    costsWs.getCell(rr, 1).value = o.name
    if (o.hasTotal && o.total !== undefined) {
      costsWs.getCell(rr, 2).value = o.total
      costsWs.getCell(rr, 2).fill = inputFill
      costsWs.getCell(rr, 2).numFmt = FMT_EUR
      if (o.name === 'Other Fixed') {
        costsWs.getCell(rr, 3).value = { formula: `B${rr}/9/7`, result: o.total / 9 / 7 }
      } else if (o.name === 'Technical') {
        costsWs.getCell(rr, 3).value = {
          formula: `B${rr}/${costAvgAc}/12`,
          result: data.costs.avgAc > 0 ? o.total / data.costs.avgAc / 12 : 0,
        }
      }
    } else {
      // commission rates: per-month value is the direct input
      costsWs.getCell(rr, 3).value = o.perMonth
      costsWs.getCell(rr, 3).fill = inputFill
    }
    costsWs.getCell(rr, 3).numFmt = FMT_EUR2
    costsWs.getCell(rr, 4).value = o.mapping
    ocRowByName.set(o.name, rr)
  })
  cr = ocStart + data.costs.otherCogs.length + 1
  const ocRef = (name: string) => {
    const row = ocRowByName.get(name)
    return row ? ref(S_COSTS, 3, row) : '0'
  }

  // overhead
  costsWs.getCell(cr, 1).value = 'OVERHEAD'
  costsWs.getCell(cr, 1).font = { bold: true }
  costsWs.getCell(cr, 1).fill = sectionFill
  cr++
  ;['Name', 'Total (annual)', 'Per Month / A/C', 'P&L Mapping'].forEach((h, i) => {
    const c = costsWs.getCell(cr, i + 1); c.value = h; c.font = { bold: true }; c.fill = headFill
  })
  cr++
  const ohStart = cr
  const ohPerMonthRef: string[] = []
  data.costs.overhead.forEach((o, i) => {
    const rr = ohStart + i
    costsWs.getCell(rr, 1).value = o.name
    costsWs.getCell(rr, 2).value = o.total
    costsWs.getCell(rr, 2).fill = inputFill
    costsWs.getCell(rr, 2).numFmt = FMT_EUR
    costsWs.getCell(rr, 3).value = {
      formula: `B${rr}/${costAvgAc}/12`,
      result: data.costs.avgAc > 0 ? o.total / data.costs.avgAc / 12 : 0,
    }
    costsWs.getCell(rr, 3).numFmt = FMT_EUR2
    costsWs.getCell(rr, 4).value = o.mapping
    ohPerMonthRef[i] = ref(S_COSTS, 3, rr)
  })

  const CO = {
    lineInternal: mcRef('Line Maintenance - Internal'),
    line3rd: mcRef('Line Maintenance - 3rd Party'),
    capital: mcRef('Capital Maintenance'),
    persSalary: mcRef('Maintenance Personnel Salary'),
    trainning: mcRef('Trainning'),
    cCheck: mcRef('C-Check'),
    sparePartsRate: mcRef('Spare Parts KPI (Per BH)'),
    tiresWheels: mcRef('Tires/Wheels'),
    maintPerDiem: maintPerDiemRef,
    commSummer: ocRef('Commission - Third Party Summer'),
    commWinter: ocRef('Commission - Third Party Winter'),
    mxc: ocRef('Commission - MXC'),
    technical: ocRef('Technical'),
    otherFixed: ocRef('Other Fixed'),
    fuel: docPerMonthRef[0] ?? '0',
    handling: docPerMonthRef[1] ?? '0',
    navigation: docPerMonthRef[2] ?? '0',
    airport: docPerMonthRef[3] ?? '0',
    oh: ohPerMonthRef,
  }

  // ===========================================================================
  // AIRCRAFT SHEET
  // ===========================================================================
  acWs.columns = [
    { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
  ]
  const acTitle = acWs.getCell('A1')
  acTitle.value = 'AIRCRAFT RATES'
  acTitle.font = { bold: true, color: white, size: 12 }
  acTitle.fill = titleFill
  acWs.mergeCells('A1:I1')

  const acHeadRow = 3
  ;['Entry', 'MSN / Type', 'Lease Rent (EUR)', '6Y Check (EUR)', '12Y Check (EUR)',
    'LDG (EUR)', 'APU Rate (USD)', 'LLP#1 (USD)', 'LLP#2 (USD)']
    .forEach((h, i) => {
      const c = acWs.getCell(acHeadRow, i + 1); c.value = h; c.font = { bold: true }; c.fill = headFill
    })
  let acr = acHeadRow + 1
  // Per-entry aircraft rate row + ref capture
  const acRefs: { lease: string; sixY: string; twelveY: string; ldg: string; apu: string; llp1: string; llp2: string; eprRate: string }[] = []
  // We also need EPR interpolation referencing each entry's matrix. Place matrices below.
  const entryAcRow: number[] = []
  entries.forEach((e) => {
    const rr = acr
    entryAcRow.push(rr)
    acWs.getCell(rr, 1).value = e.label
    acWs.getCell(rr, 2).value = `${e.input.msn} ${e.input.aircraftType}`
    acWs.getCell(rr, 3).value = parseFloat(e.input.leaseRentEur || '0')
    acWs.getCell(rr, 4).value = parseFloat(e.input.sixYearCheckEur || '0')
    acWs.getCell(rr, 5).value = parseFloat(e.input.twelveYearCheckEur || '0')
    acWs.getCell(rr, 6).value = parseFloat(e.input.ldgEur || '0')
    acWs.getCell(rr, 7).value = parseFloat(e.input.apuRateUsd || '0')
    acWs.getCell(rr, 8).value = parseFloat(e.input.llp1RateUsd || '0')
    acWs.getCell(rr, 9).value = parseFloat(e.input.llp2RateUsd || '0')
    for (const col of [3, 4, 5, 6, 7, 8, 9]) {
      acWs.getCell(rr, col).fill = inputFill
      acWs.getCell(rr, col).numFmt = FMT_EUR2
    }
    acr++
  })
  acr++ // gap

  // EPR matrices (one block per entry) + interpolated EPR rate cell
  entries.forEach((e, ei) => {
    const matrix = [...(e.input.eprMatrix ?? [])].sort((a, b) => a.cycleRatio - b.cycleRatio)
    acWs.getCell(acr, 1).value = `${e.label} — EPR Matrix`
    acWs.getCell(acr, 1).font = { bold: true }
    acWs.getCell(acr, 1).fill = sectionFill
    acr++
    ;['Cycle Ratio', 'Benign Rate (USD)', 'Hot Rate (USD)'].forEach((h, i) => {
      const c = acWs.getCell(acr, i + 1); c.value = h; c.font = { bold: true }; c.fill = headFill
    })
    acr++
    const matStart = acr
    matrix.forEach((m) => {
      acWs.getCell(acr, 1).value = m.cycleRatio
      acWs.getCell(acr, 2).value = m.benignRate
      acWs.getCell(acr, 3).value = m.hotRate
      for (const col of [1, 2, 3]) { acWs.getCell(acr, col).fill = inputFill; acWs.getCell(acr, col).numFmt = FMT_RATE }
      acr++
    })
    const matEnd = acr - 1
    // EPR rate (interpolated) — references this entry's cycle ratio on the Calc sheet.
    // We don't yet know the Calc cycle-ratio address, so store the matrix ranges and
    // the rate column, and write the EPR rate cell after the Calc sheet exists.
    const rateCol = e.input.environment === 'benign' ? 2 : 3
    const crCol = colLetter(1)
    const rCol = colLetter(rateCol)
    const crRange = matStart <= matEnd ? `${ref(S_AC, 1, matStart)}:${ref(S_AC, 1, matEnd)}` : ''
    const rRange = matStart <= matEnd ? `${ref(S_AC, rateCol, matStart)}:${ref(S_AC, rateCol, matEnd)}` : ''
    // EPR rate output cell:
    acWs.getCell(acr, 1).value = 'EPR Rate (interp.)'
    acWs.getCell(acr, 1).font = { italic: true }
    const eprRateCell = ref(S_AC, 2, acr)
    // placeholder; formula filled after Calc cycle-ratio cell known.
    acRefs[ei] = {
      lease: ref(S_AC, 3, entryAcRow[ei]),
      sixY: ref(S_AC, 4, entryAcRow[ei]),
      twelveY: ref(S_AC, 5, entryAcRow[ei]),
      ldg: ref(S_AC, 6, entryAcRow[ei]),
      apu: ref(S_AC, 7, entryAcRow[ei]),
      llp1: ref(S_AC, 8, entryAcRow[ei]),
      llp2: ref(S_AC, 9, entryAcRow[ei]),
      eprRate: eprRateCell,
    }
    // remember where to write the EPR formula + its ranges/result
    void crCol; void rCol; void matStart; void matEnd; void rateCol
    eprRatePlan.push({ ei, cell: { col: 2, row: acr }, crRange, rRange })
    acr += 2
  })

  // ===========================================================================
  // CALCULATION SHEET (entries as columns)
  // ===========================================================================
  const calcTitle = calc.getCell('A1')
  calcTitle.value = 'ACMI PRICING — CALCULATION'
  calcTitle.font = { bold: true, color: white, size: 12 }
  calcTitle.fill = titleFill

  // Globals (B3 = exchange rate — referenced by Costs sheet)
  calc.getCell('A2').value = 'Project'
  calc.getCell('B2').value = data.projectName || 'Untitled Project'
  calc.getCell('A3').value = 'USD/EUR Rate'
  calc.getCell('B3').value = data.exchangeRate
  calc.getCell('B3').fill = inputFill
  calc.getCell('B3').numFmt = FMT_RATE
  calc.getCell('C3').value = 'Margin %'
  calc.getCell('D3').value = data.marginPercent / 100
  calc.getCell('D3').numFmt = FMT_PCT
  calc.getCell('D3').fill = inputFill
  calc.getCell('A4').value = 'BH:FH'
  calc.getCell('B4').value = data.bhFhRatio
  calc.getCell('B4').fill = inputFill
  calc.getCell('B4').numFmt = FMT_RATE
  calc.getCell('C4').value = 'APU FH:FH'
  calc.getCell('D4').value = data.apuFhRatio
  calc.getCell('D4').numFmt = FMT_RATE
  calc.getCell('D4').fill = inputFill

  const exchR = ref(S_CALC, 2, 3)
  const bhfhR = ref(S_CALC, 2, 4)
  const apufhR = ref(S_CALC, 4, 4)

  // Column layout: A = labels; entries start at column 2 (B); after entries a
  // "Project / Month" and "Project / Total" column.
  const firstEntryCol = 2
  const entryCol = (i: number) => firstEntryCol + i
  const projMonthCol = firstEntryCol + entries.length
  const projTotalCol = projMonthCol + 1

  calc.getColumn(1).width = 34
  for (let i = 0; i < entries.length; i++) calc.getColumn(entryCol(i)).width = 16
  calc.getColumn(projMonthCol).width = 16
  calc.getColumn(projTotalCol).width = 18

  // Header row for the entry table
  const tableHeadRow = 6
  calc.getCell(tableHeadRow, 1).value = 'Per-MSN build-up (per month)'
  calc.getCell(tableHeadRow, 1).font = { bold: true }
  calc.getCell(tableHeadRow, 1).fill = headFill
  entries.forEach((e, i) => {
    const c = calc.getCell(tableHeadRow, entryCol(i)); c.value = e.label; c.font = { bold: true }; c.fill = headFill
    c.alignment = { horizontal: 'right' }
  })
  calc.getCell(tableHeadRow, projMonthCol).value = 'PROJECT / Month'
  calc.getCell(tableHeadRow, projMonthCol).font = { bold: true }
  calc.getCell(tableHeadRow, projMonthCol).fill = headFill
  calc.getCell(tableHeadRow, projTotalCol).value = 'PROJECT / Total'
  calc.getCell(tableHeadRow, projTotalCol).font = { bold: true }
  calc.getCell(tableHeadRow, projTotalCol).fill = headFill

  // Row registry as we go
  let crow = tableHeadRow + 1
  // map of logical line key -> sheet row, and per-entry result accessor
  const calcRowOf: Record<string, number> = {}

  // Helpers to write an entry row.
  type CellSpec = { formula?: string; value?: number | string; result?: number; fmt?: string }
  const writeRow = (
    key: string,
    label: string,
    perEntry: (e: Entry, i: number) => CellSpec,
    opts: { section?: boolean; bold?: boolean; fmt?: string; indent?: number; input?: boolean } = {},
  ) => {
    const row = crow
    calcRowOf[key] = row
    const lc = calc.getCell(row, 1)
    lc.value = label
    if (opts.bold) lc.font = { bold: true }
    if (opts.section) { lc.font = { bold: true }; lc.fill = sectionFill }
    if (opts.indent) lc.alignment = { indent: opts.indent }
    entries.forEach((e, i) => {
      const spec = perEntry(e, i)
      const cell = calc.getCell(row, entryCol(i))
      if (spec.formula !== undefined) cell.value = { formula: spec.formula, result: spec.result ?? 0 }
      else if (spec.value !== undefined) cell.value = spec.value
      cell.numFmt = spec.fmt ?? opts.fmt ?? FMT_EUR
      if (opts.bold) cell.font = { bold: true }
      if (opts.input) cell.fill = inputFill
    })
    crow++
    return row
  }
  // address of an entry cell for a given logical key
  const cellRef = (key: string, i: number) => ref(S_CALC, entryCol(i), calcRowOf[key])

  // ---- INPUTS ----
  writeRow('__inp_hdr', 'INPUTS', () => ({ value: '' }), { section: true })
  writeRow('mgh', 'MGH', (e) => ({ value: parseFloat(e.input.mgh || '0'), fmt: FMT_NUM, input: true }), { fmt: FMT_NUM })
  writeRow('excessBh', 'Excess BH', (e) => ({ value: parseFloat(e.input.excessBh || '0'), fmt: FMT_NUM, input: true }), { fmt: FMT_NUM })
  writeRow('acmiRateRaw', 'ACMI Rate (input ccy)', (e) => ({ value: parseFloat(e.input.acmiRate || '0'), fmt: FMT_RATE, input: true }), { fmt: FMT_RATE })
  writeRow('excessRateRaw', 'Excess Hour Rate (input ccy)', (e) => ({ value: parseFloat(e.input.excessHourRate || '0'), fmt: FMT_RATE, input: true }), { fmt: FMT_RATE })
  writeRow('cycleRatio', 'Cycle Ratio', (e) => ({ value: parseFloat(e.input.cycleRatio || '1'), fmt: FMT_DEC, input: true }), { fmt: FMT_DEC })
  writeRow('crewSets', 'Crew Sets', (e) => ({ value: e.input.crewSets, fmt: FMT_NUM, input: true }), { fmt: FMT_NUM })
  writeRow('leaseType', 'Lease Type', (e) => ({ value: e.input.leaseType }), {})
  writeRow('acType', 'Aircraft Type', (e) => ({ value: e.input.aircraftType }), {})
  writeRow('environment', 'Environment', (e) => ({ value: e.input.environment }), {})
  writeRow('rateCcy', 'Rate Currency', (e) => ({ value: e.input.rateCurrency.toUpperCase() }), {})
  // rate->EUR factor (formula referencing exch when USD)
  writeRow('rateToEur', 'Rate→EUR factor', (e) => {
    if (e.input.rateCurrency === 'usd') return { formula: `${exchR}`, result: data.exchangeRate, fmt: FMT_RATE }
    return { value: 1, fmt: FMT_RATE }
  }, { fmt: FMT_RATE })
  writeRow('cabinCount', 'Cabin Attendants', (e) => ({ value: e.cabinCount, fmt: FMT_NUM }), { fmt: FMT_NUM })
  writeRow('seniorCount', 'Senior Attendants', (e) => ({ value: e.seniorCount, fmt: FMT_NUM }), { fmt: FMT_NUM })
  // baked proration sums
  const sumDf = (e: Entry) => [...e.coeffs.values()].reduce((s, c) => s + c.df, 0)
  const sumCdf = (e: Entry) => [...e.coeffs.values()].reduce((s, c) => s + c.cdf, 0)
  const sumDfSummer = (e: Entry) => [...e.coeffs.values()].reduce((s, c) => s + (c.isSummer ? c.df : 0), 0)
  const sumDfWinter = (e: Entry) => [...e.coeffs.values()].reduce((s, c) => s + (!c.isSummer ? c.df : 0), 0)
  writeRow('months', 'Months (Σ day-fraction)', (e) => ({ value: sumDf(e), fmt: FMT_DEC }), { fmt: FMT_DEC })
  writeRow('sumCdf', 'Σ crew day-fraction', (e) => ({ value: sumCdf(e), fmt: FMT_DEC }), { fmt: FMT_DEC })
  writeRow('sumDfSummer', 'Σ df (summer months)', (e) => ({ value: sumDfSummer(e), fmt: FMT_DEC }), { fmt: FMT_DEC })
  writeRow('sumDfWinter', 'Σ df (winter months)', (e) => ({ value: sumDfWinter(e), fmt: FMT_DEC }), { fmt: FMT_DEC })

  // ---- KPIs ----
  writeRow('__kpi_hdr', 'KPIs (per month, full)', () => ({ value: '' }), { section: true })
  writeRow('acmiRateEur', 'ACMI Rate (EUR)', (e, i) => ({
    formula: `${cellRef('acmiRateRaw', i)}*${cellRef('rateToEur', i)}`,
    result: e.cfg.acmiRate, fmt: FMT_RATE,
  }), { fmt: FMT_RATE })
  writeRow('excessRateEur', 'Excess Hour Rate (EUR)', (e, i) => ({
    formula: `${cellRef('excessRateRaw', i)}*${cellRef('rateToEur', i)}`,
    result: e.cfg.excessHourRate, fmt: FMT_RATE,
  }), { fmt: FMT_RATE })
  writeRow('totalBh', 'Total BH', (e, i) => ({
    formula: `${cellRef('mgh', i)}+${cellRef('excessBh', i)}`,
    result: e.cfg.mgh + e.cfg.excessBh, fmt: FMT_NUM,
  }), { fmt: FMT_NUM })
  writeRow('fh', 'FH', (e, i) => {
    const fh = e.cfg.bhFhRatio > 0 ? (e.cfg.mgh + e.cfg.excessBh) / e.cfg.bhFhRatio : 0
    return { formula: `IF(${bhfhR}>0,${cellRef('totalBh', i)}/${bhfhR},0)`, result: fh, fmt: FMT_NUM }
  }, { fmt: FMT_NUM })
  writeRow('fc', 'FC', (e, i) => {
    const fh = e.cfg.bhFhRatio > 0 ? (e.cfg.mgh + e.cfg.excessBh) / e.cfg.bhFhRatio : 0
    const fc = e.cfg.cycleRatio > 0 ? fh / e.cfg.cycleRatio : 0
    return { formula: `IF(${cellRef('cycleRatio', i)}>0,${cellRef('fh', i)}/${cellRef('cycleRatio', i)},0)`, result: fc, fmt: FMT_NUM }
  }, { fmt: FMT_NUM })
  writeRow('apuFh', 'APU FH', (e, i) => {
    const fh = e.cfg.bhFhRatio > 0 ? (e.cfg.mgh + e.cfg.excessBh) / e.cfg.bhFhRatio : 0
    return { formula: `${cellRef('fh', i)}*${apufhR}`, result: fh * e.cfg.apuFhRatio, fmt: FMT_NUM }
  }, { fmt: FMT_NUM })
  // EPR rate row references the Aircraft-sheet interpolated cell
  writeRow('eprRate', 'EPR Rate (interp.)', (e, i) => ({
    formula: `${acRefs[i].eprRate}`,
    // result computed by engine via cfg.eprMr; recover eprRate = eprMr/(2*fh*exch)
    result: (() => {
      const fh = e.cfg.bhFhRatio > 0 ? (e.cfg.mgh + e.cfg.excessBh) / e.cfg.bhFhRatio : 0
      return fh > 0 && data.exchangeRate > 0 ? e.cfg.cfg.eprMr / (2 * fh * data.exchangeRate) : 0
    })(),
    fmt: FMT_RATE,
  }), { fmt: FMT_RATE })

  // Now that the Calc cycle-ratio row exists, write the EPR interpolation formulas.
  eprRatePlan.forEach((p) => {
    const e = entries[p.ei]
    const crCell = cellRef('cycleRatio', p.ei)
    const cell = acWs.getCell(p.cell.row, p.cell.col)
    void p
    // engine result for eprRate
    const fh = e.cfg.bhFhRatio > 0 ? (e.cfg.mgh + e.cfg.excessBh) / e.cfg.bhFhRatio : 0
    const eprResult = fh > 0 && data.exchangeRate > 0 ? e.cfg.cfg.eprMr / (2 * fh * data.exchangeRate) : 0
    if (!p.crRange) {
      cell.value = { formula: '0', result: 0 }
    } else {
      const CRr = p.crRange
      const Rr = p.rRange
      const lo = `INDEX(${Rr},MATCH(${crCell},${CRr},1))`
      const loCr = `INDEX(${CRr},MATCH(${crCell},${CRr},1))`
      const hiCr = `INDEX(${CRr},MATCH(${crCell},${CRr},1)+1)`
      const hi = `INDEX(${Rr},MATCH(${crCell},${CRr},1)+1)`
      const interp = `${lo}+(${crCell}-${loCr})/(${hiCr}-${loCr})*(${hi}-${lo})`
      cell.value = {
        formula: `IF(${crCell}<=MIN(${CRr}),INDEX(${Rr},MATCH(MIN(${CRr}),${CRr},0)),IF(${crCell}>=MAX(${CRr}),INDEX(${Rr},MATCH(MAX(${CRr}),${CRr},0)),${interp}))`,
        result: eprResult,
      }
    }
    cell.numFmt = FMT_RATE
  })

  // ---- BASE COST LINES (full month) ----
  writeRow('__base_hdr', 'COST BUILD-UP (per month, full)', () => ({ value: '' }), { section: true })
  const baseRes = (e: Entry, key: string) => e.cfg.cfg[key as keyof typeof e.cfg.cfg] as number

  // A
  writeRow('eprMr', 'Maint. Reserve — EPR', (e, i) => ({
    formula: `${cellRef('eprRate', i)}*2*${cellRef('fh', i)}*${exchR}`, result: e.cfg.cfg.eprMr,
  }), { indent: 1 })
  writeRow('llpMr', 'Maint. Reserve — LLP', (e, i) => ({
    formula: `(${acRefs[i].llp1}+${acRefs[i].llp2})*${cellRef('fc', i)}*${exchR}`, result: e.cfg.cfg.llpMr,
  }), { indent: 1 })
  writeRow('apuMr', 'Maint. Reserve — APU', (e, i) => ({
    formula: `${acRefs[i].apu}*${cellRef('apuFh', i)}*${exchR}`, result: e.cfg.cfg.apuMr,
  }), { indent: 1 })
  writeRow('maintReservesVariable', 'Maint. Reserves — Variable', (e, i) => ({
    formula: `${cellRef('eprMr', i)}+${cellRef('llpMr', i)}+${cellRef('apuMr', i)}`, result: e.cfg.cfg.maintReservesVariable,
  }), {})
  writeRow('dryLease', 'Dry Lease', (e, i) => ({ formula: `${acRefs[i].lease}`, result: e.cfg.cfg.leaseRentEur }), {})
  writeRow('maintReservesFixed', 'Maint. Reserves — Fixed', (e, i) => ({
    formula: `${acRefs[i].sixY}+${acRefs[i].twelveY}+${acRefs[i].ldg}`, result: e.cfg.cfg.maintReservesFixedEur,
  }), {})
  // C
  writeRow('pilotSalary', 'Pilot — Salary', (e, i) => ({
    formula: `${CR.pilotSalaryPerSet}*${cellRef('crewSets', i)}`, result: e.cfg.cfg.pilotSalary,
  }), {})
  writeRow('cabinCrewSalary', 'Cabin Crew — Salary', (e, i) => ({
    formula: `(${cellRef('cabinCount', i)}*${CR.cabinAttendantSS}+${cellRef('seniorCount', i)}*${CR.seniorAttendantSS})*${cellRef('crewSets', i)}`,
    result: e.cfg.cfg.cabinCrewSalary,
  }), {})
  writeRow('staffUniformF', 'Staff Uniform', (e) => ({ formula: `${CR.uniformPerMonth}`, result: e.cfg.cfg.staffUniformF }), {})
  writeRow('trainingC', 'Training (C)', (e) => ({ formula: `${CR.trainingPerMonth}`, result: e.cfg.cfg.trainingC }), {})
  writeRow('pilotPerDiemPD', 'Pilot — Per Diem (per diem)', (e, i) => ({
    formula: `${CR.pilotPerDiemPerSet}*${cellRef('crewSets', i)}`, result: e.cfg.cfg.pilotPerDiem_perDiem,
  }), { indent: 1 })
  writeRow('pilotPerDiemBH', 'Pilot — Per Diem (BH bonus)', (e, i) => ({
    formula: `${CR.bhBonusPerBh}*${cellRef('totalBh', i)}`, result: e.cfg.cfg.pilotPerDiem_bhBonus,
  }), { indent: 1 })
  writeRow('cabinCrewPerDiem', 'Cabin Crew — Per Diem', (e, i) => ({
    formula: `(${cellRef('cabinCount', i)}*${CR.cabinAttPerDiem}+${cellRef('seniorCount', i)}*${CR.seniorAttPerDiem})*${cellRef('crewSets', i)}`,
    result: e.cfg.cfg.cabinCrewPerDiem,
  }), {})
  writeRow('accomTravelC', 'Accom & Travel (C)', (e) => ({ formula: `${CR.accomTravelCPerMonth}`, result: e.cfg.cfg.accomTravelC }), {})
  // M
  writeRow('sparePartsBh', 'Spare Parts (BH)', (e, i) => ({
    formula: `${cellRef('totalBh', i)}*${CO.sparePartsRate}`, result: e.cfg.cfg.spareParts_bh,
  }), { indent: 1 })
  writeRow('sparePartsTW', 'Spare Parts (Tires/Wheels)', (e) => ({ formula: `${CO.tiresWheels}`, result: e.cfg.cfg.spareParts_tiresWheels }), { indent: 1 })
  writeRow('maintPersonnelPerDiem', 'Maint. Personnel — Per Diems', () => ({ formula: `${CO.maintPerDiem}`, result: entries[0]?.cfg.cfg.maintPersonnelPerDiem ?? 0 }), {})
  writeRow('lineMaintenance', 'Line Maintenance', (e) => ({ formula: `${CO.lineInternal}+${CO.line3rd}`, result: e.cfg.cfg.lineMaintenance }), {})
  writeRow('baseMaintenance', 'Base Maintenance', (e) => ({ formula: `${CO.capital}`, result: e.cfg.cfg.baseMaintenance }), {})
  writeRow('maintPersonnelSalary', 'Maint. Personnel — Salary', (e) => ({ formula: `${CO.persSalary}`, result: e.cfg.cfg.maintPersonnelSalary }), {})
  writeRow('trainningM', 'Training (M)', (e) => ({ formula: `${CO.trainning}`, result: e.cfg.cfg.trainningM }), {})
  writeRow('maintCCheck', 'Maintenance C-Check', (e) => ({ formula: `${CO.cCheck}`, result: e.cfg.cfg.maintCCheck }), {})
  // I
  writeRow('insuranceFixed', 'Insurance', (e) => ({ formula: `${insEurRef(e.input.msn)}`, result: e.cfg.cfg.insuranceFixed }), {})
  // DOC
  writeRow('fuel', 'Fuel', (e) => ({ formula: `${CO.fuel}`, result: e.cfg.cfg.fuel }), { indent: 1 })
  writeRow('handling', 'Handling', (e) => ({ formula: `${CO.handling}`, result: e.cfg.cfg.handling }), { indent: 1 })
  writeRow('navigation', 'Navigation', (e) => ({ formula: `${CO.navigation}`, result: e.cfg.cfg.navigation }), { indent: 1 })
  writeRow('airportCharges', 'Airport Charges', (e) => ({ formula: `${CO.airport}`, result: e.cfg.cfg.airportCharges }), { indent: 1 })
  writeRow('technical', 'Technical', (e) => ({ formula: `${CO.technical}`, result: e.cfg.cfg.technical }), {})
  writeRow('otherFixed', 'Other Fixed', (e) => ({ formula: `${CO.otherFixed}`, result: e.cfg.cfg.otherFixed }), {})
  // Overhead lines
  const ohLabels = ['Personnel Cost - SS', 'Personnel Cost', 'Travel Expenses', 'Legal Expenses',
    'License & Registration', 'Admin Cost', 'IT & Communications', 'Admin & General', 'Selling & Marketing']
  const ohKeys = ['personnelCostSS', 'personnelCost', 'travelExpenses', 'legalExpenses', 'licenseRegCost', 'adminCost', 'itComms', 'adminGeneralExp', 'sellingMarketingCost']
  ohKeys.forEach((k, idx) => {
    writeRow(`oh_${k}`, ohLabels[idx], (e, i) => {
      if (k === 'personnelCost') {
        return { formula: `${CO.oh[1]}+${CO.mxc}*${cellRef('totalBh', i)}`, result: e.cfg.cfg.personnelCost }
      }
      return { formula: `${CO.oh[idx]}`, result: baseRes(e, k) }
    }, { indent: 1 })
  })

  // ---- SUMMARY ----
  writeRow('__sum_hdr', 'SUMMARY', () => ({ value: '' }), { section: true })

  // Per-entry per-month summary formulas + project month/total columns.
  // helper for summary line: write per-entry formula, project/month = sum entries, project/total = explicit
  const ohSumRef = (i: number) => ohKeys.map((k) => cellRef(`oh_${k}`, i)).join('+')

  const summaryLine = (
    key: string, label: string,
    perEntryFormula: (i: number) => string,
    perEntryResult: (e: Entry, i: number) => number,
    projTotalFormula: () => string,
    projTotalResult: () => number,
    opts: { bold?: boolean; color?: 'pos' | 'neg' } = {},
  ) => {
    const row = crow
    calcRowOf[key] = row
    const lc = calc.getCell(row, 1)
    lc.value = label
    if (opts.bold) lc.font = { bold: true }
    entries.forEach((e, i) => {
      const cell = calc.getCell(row, entryCol(i))
      cell.value = { formula: perEntryFormula(i), result: perEntryResult(e, i) }
      cell.numFmt = FMT_EUR
      if (opts.bold) cell.font = { bold: true }
    })
    // project / month = sum of entry per-month
    const pm = calc.getCell(row, projMonthCol)
    const sumRefs = entries.map((_, i) => ref(S_CALC, entryCol(i), row)).join('+')
    const pmResult = entries.reduce((s, e, i) => s + perEntryResult(e, i), 0)
    pm.value = entries.length ? { formula: sumRefs, result: pmResult } : { formula: '0', result: 0 }
    pm.numFmt = FMT_EUR
    if (opts.bold) pm.font = { bold: true }
    // project / total
    const pt = calc.getCell(row, projTotalCol)
    pt.value = { formula: projTotalFormula(), result: projTotalResult() }
    pt.numFmt = FMT_EUR
    pt.font = { bold: true }
    if (opts.bold) pt.fill = totalFill
    crow++
    return row
  }

  // Per-entry per-month component results (full month)
  const cfgPerMonth = {
    aircraft: (e: Entry) => e.cfg.cfg.maintReservesVariable + e.cfg.cfg.leaseRentEur + e.cfg.cfg.maintReservesFixedEur,
    crew: (e: Entry) => e.cfg.cfg.pilotSalary + e.cfg.cfg.cabinCrewSalary + e.cfg.cfg.staffUniformF + e.cfg.cfg.trainingC
      + e.cfg.cfg.pilotPerDiem_perDiem + e.cfg.cfg.pilotPerDiem_bhBonus + e.cfg.cfg.cabinCrewPerDiem + e.cfg.cfg.accomTravelC,
    maint: (e: Entry) => e.cfg.cfg.spareParts_bh + e.cfg.cfg.spareParts_tiresWheels + e.cfg.cfg.maintPersonnelPerDiem
      + e.cfg.cfg.lineMaintenance + e.cfg.cfg.baseMaintenance + e.cfg.cfg.maintPersonnelSalary + e.cfg.cfg.trainningM + e.cfg.cfg.maintCCheck,
    insurance: (e: Entry) => e.cfg.cfg.insuranceFixed,
    doc: (e: Entry) => e.cfg.cfg.fuel + e.cfg.cfg.handling + e.cfg.cfg.navigation + e.cfg.cfg.airportCharges + e.cfg.cfg.technical + e.cfg.cfg.otherFixed,
    overhead: (e: Entry) => ohKeys.reduce((s, k) => s + (e.cfg.cfg[k as keyof typeof e.cfg.cfg] as number), 0),
    revenue: (e: Entry) => e.cfg.acmiRate * e.cfg.mgh + e.cfg.excessBh * e.cfg.excessHourRate,
  }
  // engine totals per entry (from monthly grid)
  const totSum = (e: Entry, k: string) => (e.monthly[k] ?? []).reduce((s, v) => s + v, 0)

  // Revenue
  summaryLine('sum_revenue', 'Total Revenue',
    (i) => `${cellRef('acmiRateEur', i)}*${cellRef('mgh', i)}+${cellRef('excessBh', i)}*${cellRef('excessRateEur', i)}`,
    (e) => cfgPerMonth.revenue(e),
    () => entries.map((_, i) => `(${cellRef('acmiRateEur', i)}*${cellRef('mgh', i)}+${cellRef('excessBh', i)}*${cellRef('excessRateEur', i)})*${cellRef('months', i)}`).join('+') || '0',
    () => entries.reduce((s, e) => s + totSum(e, 'totalRevenue'), 0),
    { bold: true },
  )
  // Aircraft
  summaryLine('sum_aircraft', 'Aircraft',
    (i) => `${cellRef('maintReservesVariable', i)}+${cellRef('dryLease', i)}+${cellRef('maintReservesFixed', i)}`,
    (e) => cfgPerMonth.aircraft(e),
    () => entries.map((_, i) => `(${cellRef('maintReservesVariable', i)}+${cellRef('dryLease', i)}+${cellRef('maintReservesFixed', i)})*${cellRef('months', i)}`).join('+') || '0',
    () => entries.reduce((s, e) => s + totSum(e, 'maintReservesVariable') + totSum(e, 'dryLease') + totSum(e, 'maintReservesFixed'), 0),
  )
  // Crew (per-diem parts use Σcdf)
  summaryLine('sum_crew', 'Crew',
    (i) => `${cellRef('pilotSalary', i)}+${cellRef('cabinCrewSalary', i)}+${cellRef('staffUniformF', i)}+${cellRef('trainingC', i)}+${cellRef('pilotPerDiemPD', i)}+${cellRef('pilotPerDiemBH', i)}+${cellRef('cabinCrewPerDiem', i)}+${cellRef('accomTravelC', i)}`,
    (e) => cfgPerMonth.crew(e),
    () => entries.map((_, i) =>
      `(${cellRef('pilotSalary', i)}+${cellRef('cabinCrewSalary', i)}+${cellRef('staffUniformF', i)}+${cellRef('trainingC', i)}+${cellRef('pilotPerDiemBH', i)}+${cellRef('accomTravelC', i)})*${cellRef('months', i)}+(${cellRef('pilotPerDiemPD', i)}+${cellRef('cabinCrewPerDiem', i)})*${cellRef('sumCdf', i)}`,
    ).join('+') || '0',
    () => entries.reduce((s, e) =>
      s + totSum(e, 'pilotSalary') + totSum(e, 'cabinCrewSalary') + totSum(e, 'staffUniformF') + totSum(e, 'trainingC')
      + totSum(e, 'pilotPerDiem') + totSum(e, 'cabinCrewPerDiem') + totSum(e, 'accomTravelC'), 0),
  )
  // Maintenance
  summaryLine('sum_maint', 'Maintenance',
    (i) => `${cellRef('sparePartsBh', i)}+${cellRef('sparePartsTW', i)}+${cellRef('maintPersonnelPerDiem', i)}+${cellRef('lineMaintenance', i)}+${cellRef('baseMaintenance', i)}+${cellRef('maintPersonnelSalary', i)}+${cellRef('trainningM', i)}+${cellRef('maintCCheck', i)}`,
    (e) => cfgPerMonth.maint(e),
    () => entries.map((_, i) => `(${cellRef('sparePartsBh', i)}+${cellRef('sparePartsTW', i)}+${cellRef('maintPersonnelPerDiem', i)}+${cellRef('lineMaintenance', i)}+${cellRef('baseMaintenance', i)}+${cellRef('maintPersonnelSalary', i)}+${cellRef('trainningM', i)}+${cellRef('maintCCheck', i)})*${cellRef('months', i)}`).join('+') || '0',
    () => entries.reduce((s, e) => s + totSum(e, 'spareParts') + totSum(e, 'maintPersonnelPerDiem') + totSum(e, 'lineMaintenance') + totSum(e, 'baseMaintenance') + totSum(e, 'maintPersonnelSalary') + totSum(e, 'trainningM') + totSum(e, 'maintCCheck'), 0),
  )
  // Insurance
  summaryLine('sum_insurance', 'Insurance',
    (i) => `${cellRef('insuranceFixed', i)}`,
    (e) => cfgPerMonth.insurance(e),
    () => entries.map((_, i) => `${cellRef('insuranceFixed', i)}*${cellRef('months', i)}`).join('+') || '0',
    () => entries.reduce((s, e) => s + totSum(e, 'insuranceFixed'), 0),
  )
  // DOC
  summaryLine('sum_doc', 'DOC',
    (i) => `${cellRef('fuel', i)}+${cellRef('handling', i)}+${cellRef('navigation', i)}+${cellRef('airportCharges', i)}+${cellRef('technical', i)}+${cellRef('otherFixed', i)}`,
    (e) => cfgPerMonth.doc(e),
    () => entries.map((_, i) => `(${cellRef('fuel', i)}+${cellRef('handling', i)}+${cellRef('navigation', i)}+${cellRef('airportCharges', i)}+${cellRef('technical', i)}+${cellRef('otherFixed', i)})*${cellRef('months', i)}`).join('+') || '0',
    () => entries.reduce((s, e) => s + totSum(e, 'fuel') + totSum(e, 'handling') + totSum(e, 'navigation') + totSum(e, 'airportCharges') + totSum(e, 'technical') + totSum(e, 'otherFixed'), 0),
  )
  // Other COGS (commissions). Per-month uses avg rate; total uses seasonal swap.
  const commSummerVal = data.costs.otherCogs.find((c) => c.name === 'Commission - Third Party Summer')?.perMonth ?? 0
  const commWinterVal = data.costs.otherCogs.find((c) => c.name === 'Commission - Third Party Winter')?.perMonth ?? 0
  const avgCommRate = (commSummerVal + commWinterVal) / 2
  summaryLine('sum_otherCogs', 'Other COGS (Commissions)',
    (i) => `(${CO.commSummer}+${CO.commWinter})/2*${cellRef('totalBh', i)}`,
    (e) => avgCommRate * (e.cfg.mgh + e.cfg.excessBh),
    () => entries.map((_, i) => `${cellRef('totalBh', i)}*(${CO.commWinter}*${cellRef('sumDfSummer', i)}+${CO.commSummer}*${cellRef('sumDfWinter', i)})`).join('+') || '0',
    () => entries.reduce((s, e) => s + totSum(e, 'commissions'), 0),
  )
  // ACMI Cost = sum of the component summary rows (per column + project total)
  summaryLine('sum_acmiCost', 'ACMI Cost',
    (i) => ['sum_aircraft', 'sum_crew', 'sum_maint', 'sum_insurance', 'sum_doc', 'sum_otherCogs']
      .map((k) => ref(S_CALC, entryCol(i), calcRowOf[k])).join('+'),
    (e) => cfgPerMonth.aircraft(e) + cfgPerMonth.crew(e) + cfgPerMonth.maint(e) + cfgPerMonth.insurance(e)
      + cfgPerMonth.doc(e) + avgCommRate * (e.cfg.mgh + e.cfg.excessBh),
    () => ['sum_aircraft', 'sum_crew', 'sum_maint', 'sum_insurance', 'sum_doc', 'sum_otherCogs']
      .map((k) => ref(S_CALC, projTotalCol, calcRowOf[k])).join('+'),
    () => entries.reduce((s, e) => s
      + totSum(e, 'maintReservesVariable') + totSum(e, 'dryLease') + totSum(e, 'maintReservesFixed')
      + totSum(e, 'pilotSalary') + totSum(e, 'cabinCrewSalary') + totSum(e, 'staffUniformF') + totSum(e, 'trainingC') + totSum(e, 'pilotPerDiem') + totSum(e, 'cabinCrewPerDiem') + totSum(e, 'accomTravelC')
      + totSum(e, 'spareParts') + totSum(e, 'maintPersonnelPerDiem') + totSum(e, 'lineMaintenance') + totSum(e, 'baseMaintenance') + totSum(e, 'maintPersonnelSalary') + totSum(e, 'trainningM') + totSum(e, 'maintCCheck')
      + totSum(e, 'insuranceFixed')
      + totSum(e, 'fuel') + totSum(e, 'handling') + totSum(e, 'navigation') + totSum(e, 'airportCharges') + totSum(e, 'technical') + totSum(e, 'otherFixed')
      + totSum(e, 'commissions'), 0),
    { bold: true },
  )
  // Overhead
  summaryLine('sum_overhead', 'Overhead',
    (i) => ohSumRef(i),
    (e) => cfgPerMonth.overhead(e),
    () => entries.map((_, i) => `(${ohSumRef(i)})*${cellRef('months', i)}`).join('+') || '0',
    () => entries.reduce((s, e) => s + totSum(e, 'totalOverhead'), 0),
  )
  // Net Profit
  {
    const revRow = calcRowOf['sum_revenue']
    const acmiRow = calcRowOf['sum_acmiCost']
    const ohRow = calcRowOf['sum_overhead']
    summaryLine('sum_net', 'Net Profit',
      (i) => `${ref(S_CALC, entryCol(i), revRow)}-${ref(S_CALC, entryCol(i), acmiRow)}-${ref(S_CALC, entryCol(i), ohRow)}`,
      (e) => cfgPerMonth.revenue(e)
        - (cfgPerMonth.aircraft(e) + cfgPerMonth.crew(e) + cfgPerMonth.maint(e) + cfgPerMonth.insurance(e) + cfgPerMonth.doc(e) + avgCommRate * (e.cfg.mgh + e.cfg.excessBh))
        - cfgPerMonth.overhead(e),
      () => `${ref(S_CALC, projTotalCol, revRow)}-${ref(S_CALC, projTotalCol, acmiRow)}-${ref(S_CALC, projTotalCol, ohRow)}`,
      () => entries.reduce((s, e) => s + totSum(e, 'netProfit'), 0),
      { bold: true },
    )
  }

  // ===========================================================================
  // P&L SHEET (Total Project, monthly)
  // ===========================================================================
  const pTitle = pnl.getCell('A1')
  pTitle.value = `P&L — ${data.projectName || 'Untitled Project'} (Total Project)`
  pTitle.font = { bold: true, color: white, size: 12 }
  pTitle.fill = titleFill
  pnl.mergeCells(1, 1, 1, globalMonths.length + 2)

  pnl.getColumn(1).width = 34
  const pHeadRow = 2
  pnl.getCell(pHeadRow, 1).value = ''
  globalMonths.forEach((m, i) => {
    const c = pnl.getCell(pHeadRow, 2 + i)
    c.value = `${MONTH_LABELS[m.month - 1]} ${String(m.year).slice(2)}`
    c.font = { bold: true }
    c.fill = headFill
    c.alignment = { horizontal: 'right' }
    pnl.getColumn(2 + i).width = 12
  })
  const totCol = 2 + globalMonths.length
  pnl.getCell(pHeadRow, totCol).value = 'TOTAL'
  pnl.getCell(pHeadRow, totCol).font = { bold: true }
  pnl.getCell(pHeadRow, totCol).fill = headFill
  pnl.getColumn(totCol).width = 14

  // coefficient lookups per entry/month
  const dfOf = (e: Entry, gi: number) => {
    const m = globalMonths[gi]
    return e.coeffs.get(monthKey(m.year, m.month))?.df ?? 0
  }
  const cdfOf = (e: Entry, gi: number) => {
    const m = globalMonths[gi]
    return e.coeffs.get(monthKey(m.year, m.month))?.cdf ?? 0
  }
  const isSummerOf = (gi: number) => {
    const m = globalMonths[gi]
    return m.month >= 5 && m.month <= 10
  }
  // does entry contribute at all this month?
  const activeOf = (e: Entry, gi: number) => {
    const m = globalMonths[gi]
    return e.coeffs.has(monthKey(m.year, m.month))
  }

  // number formatting helper
  const numStr = (n: number) => (Math.abs(n) < 1e-9 ? '0' : String(n))

  // Build a monthly cell formula that sums entry contributions:
  //   base (Calc cell for entry i) × coeff(entry,month)
  // baseKey: calc logical key; coeffMode: 'df' | 'cdf'
  const sumMonthly = (gi: number, baseKey: string, coeffMode: 'df' | 'cdf'): string => {
    const terms: string[] = []
    entries.forEach((e, i) => {
      const coeff = coeffMode === 'df' ? dfOf(e, gi) : cdfOf(e, gi)
      if (coeff <= 0) return
      const baseRef = cellRef(baseKey, i)
      terms.push(coeff === 1 ? baseRef : `${baseRef}*${numStr(coeff)}`)
    })
    return terms.length ? terms.join('+') : '0'
  }

  let pr = pHeadRow + 1
  const pnlRowOf: Record<string, number> = {}

  // result accessor: total-project monthly value for a key = Σ entries monthly[key][gi]
  const monthlyTotal = (key: string, gi: number) => entries.reduce((s, e) => s + (e.monthly[key]?.[gi] ?? 0), 0)

  // Write a P&L data row given a formula generator + result generator
  const writePnlRow = (
    key: string,
    label: string,
    kind: string,
    monthFormula: (gi: number) => string,
    monthResult: (gi: number) => number,
    fmt: string,
    style: { bold?: boolean; section?: boolean; italic?: boolean; indent?: number } = {},
  ) => {
    const row = pr
    pnlRowOf[key] = row
    const lc = pnl.getCell(row, 1)
    lc.value = label
    if (style.section) { lc.font = { bold: true, color: { argb: 'FF4338CA' } }; }
    if (style.bold) lc.font = { bold: true }
    if (style.italic) lc.font = { italic: true }
    if (style.indent) lc.alignment = { indent: style.indent }
    if (kind !== 'section' && kind !== 'category' && kind !== 'kpi-header') {
      globalMonths.forEach((_, gi) => {
        const cell = pnl.getCell(row, 2 + gi)
        cell.value = { formula: monthFormula(gi), result: monthResult(gi) }
        cell.numFmt = fmt
        if (style.bold) cell.font = { bold: true }
        if (style.italic) cell.font = { italic: true }
      })
      // TOTAL column
      const tcell = pnl.getCell(row, totCol)
      const firstC = colLetter(2)
      const lastC = colLetter(1 + globalMonths.length)
      if (fmt === FMT_PCT) {
        // margin: total = result-line-total / revenue-total — handled by caller via special keys
        tcell.value = { formula: '0', result: 0 }
      } else {
        tcell.value = { formula: `SUM(${firstC}${row}:${lastC}${row})`, result: globalMonths.reduce((s, _, gi) => s + monthResult(gi), 0) }
      }
      tcell.numFmt = fmt
      tcell.font = { bold: true }
    }
    pr++
    return row
  }

  // zero-line helper
  const zeroRow = (key: string, label: string, style = {}) =>
    writePnlRow(key, label, 'item', () => '0', () => 0, FMT_EUR, style)

  // Iterate PNL_ROWS and emit
  // We need subtotal rows to reference other rows; track as we go.
  const variableItemKeys: string[] = []
  const fixedItemKeys: string[] = []
  const overheadItemKeys: string[] = []
  let section: 'rev' | 'var' | 'fixed' | 'oh' | 'other' = 'rev'

  for (const def of PNL_ROWS) {
    const key = def.key ?? ''
    if (def.kind === 'section') {
      writePnlRow(`__sec_${def.label}`, def.label, 'section', () => '', () => 0, FMT_EUR, { section: true })
      if (def.label === 'REVENUE') section = 'rev'
      else if (def.label === 'VARIABLE COST') section = 'var'
      else if (def.label === 'FIXED COST') section = 'fixed'
      else if (def.label === 'OVERHEAD') section = 'oh'
      continue
    }
    if (def.kind === 'category') {
      writePnlRow(`__cat_${def.label}_${pr}`, `  ${def.label}`, 'category', () => '', () => 0, FMT_EUR, { italic: true, indent: 1 })
      continue
    }
    if (def.kind === 'kpi-header') {
      writePnlRow(`__kpih`, def.label, 'kpi-header', () => '', () => 0, FMT_EUR, { section: true })
      continue
    }

    // data rows
    if (key === 'wetLease' || key === 'totalRevenue') {
      // revenue = Σ revenuePerMonth(entry) × df  ; revenuePerMonth = acmiEur*mgh + excessBh*excessEur
      const f = (gi: number) => {
        const terms: string[] = []
        entries.forEach((e, i) => {
          const df = dfOf(e, gi)
          if (df <= 0) return
          const rev = `(${cellRef('acmiRateEur', i)}*${cellRef('mgh', i)}+${cellRef('excessBh', i)}*${cellRef('excessRateEur', i)})`
          terms.push(df === 1 ? rev : `${rev}*${numStr(df)}`)
        })
        return terms.length ? terms.join('+') : '0'
      }
      writePnlRow(key, def.label, def.kind, f, (gi) => monthlyTotal('totalRevenue', gi), FMT_EUR, { bold: def.kind === 'total' })
      continue
    }
    if (key === 'otherRevenue' || key === 'financeIncome' || key === 'assetMgmtFee' ||
        key === 'accomTravelM' || key === 'otherMaintV' || key === 'delaysCancellations' ||
        key === 'depAmort' || key === 'interestNet' || key === 'fxNet' || key === 'tax') {
      zeroRow(key, def.label, { indent: def.kind === 'item' ? 2 : 0 })
      if (section === 'var') variableItemKeys.push(key)
      if (section === 'fixed') fixedItemKeys.push(key)
      continue
    }

    // commissions — special seasonal
    if (key === 'commissions') {
      const f = (gi: number) => {
        const terms: string[] = []
        entries.forEach((e, i) => {
          const df = dfOf(e, gi)
          if (df <= 0) return
          const rate = isSummerOf(gi) ? CO.commWinter : CO.commSummer
          const bh = `${cellRef('totalBh', i)}`
          terms.push(`${rate}*${bh}*${numStr(df)}`)
        })
        return terms.length ? terms.join('+') : '0'
      }
      writePnlRow(key, def.label, def.kind, f, (gi) => monthlyTotal('commissions', gi), FMT_EUR, { indent: 2 })
      variableItemKeys.push(key)
      continue
    }

    // pilotPerDiem (perDiem part cdf + bhBonus part df)
    if (key === 'pilotPerDiem') {
      const f = (gi: number) => {
        const terms: string[] = []
        entries.forEach((e, i) => {
          const df = dfOf(e, gi); const cdf = cdfOf(e, gi)
          if (df <= 0 && cdf <= 0) return
          if (cdf > 0) terms.push(cdf === 1 ? cellRef('pilotPerDiemPD', i) : `${cellRef('pilotPerDiemPD', i)}*${numStr(cdf)}`)
          if (df > 0) terms.push(df === 1 ? cellRef('pilotPerDiemBH', i) : `${cellRef('pilotPerDiemBH', i)}*${numStr(df)}`)
        })
        return terms.length ? terms.join('+') : '0'
      }
      writePnlRow(key, def.label, def.kind, f, (gi) => monthlyTotal('pilotPerDiem', gi), FMT_EUR, { indent: 2 })
      variableItemKeys.push(key)
      continue
    }
    // cabinCrewPerDiem (cdf)
    if (key === 'cabinCrewPerDiem') {
      writePnlRow(key, def.label, def.kind, (gi) => sumMonthly(gi, 'cabinCrewPerDiem', 'cdf'), (gi) => monthlyTotal('cabinCrewPerDiem', gi), FMT_EUR, { indent: 2 })
      variableItemKeys.push(key)
      continue
    }
    // accomTravelC (df)
    if (key === 'accomTravelC') {
      writePnlRow(key, def.label, def.kind, (gi) => sumMonthly(gi, 'accomTravelC', 'df'), (gi) => monthlyTotal('accomTravelC', gi), FMT_EUR, { indent: 2 })
      variableItemKeys.push(key)
      continue
    }
    // spareParts (df) = sparePartsBh + sparePartsTW
    if (key === 'spareParts') {
      const f = (gi: number) => {
        const terms: string[] = []
        entries.forEach((e, i) => {
          const df = dfOf(e, gi)
          if (df <= 0) return
          const base = `(${cellRef('sparePartsBh', i)}+${cellRef('sparePartsTW', i)})`
          terms.push(df === 1 ? base : `${base}*${numStr(df)}`)
        })
        return terms.length ? terms.join('+') : '0'
      }
      writePnlRow(key, def.label, def.kind, f, (gi) => monthlyTotal('spareParts', gi), FMT_EUR, { indent: 2 })
      variableItemKeys.push(key)
      continue
    }
    // maintReservesVariable (df)
    if (key === 'maintReservesVariable') {
      writePnlRow(key, def.label, def.kind, (gi) => sumMonthly(gi, 'maintReservesVariable', 'df'), (gi) => monthlyTotal('maintReservesVariable', gi), FMT_EUR, { indent: 2 })
      variableItemKeys.push(key)
      continue
    }
    if (key === 'maintPersonnelPerDiem') {
      writePnlRow(key, def.label, def.kind, (gi) => sumMonthly(gi, 'maintPersonnelPerDiem', 'df'), (gi) => monthlyTotal('maintPersonnelPerDiem', gi), FMT_EUR, { indent: 2 })
      variableItemKeys.push(key)
      continue
    }
    if (key === 'fuel' || key === 'handling' || key === 'navigation' || key === 'airportCharges') {
      writePnlRow(key, def.label, def.kind, (gi) => sumMonthly(gi, key, 'df'), (gi) => monthlyTotal(key, gi), FMT_EUR, { indent: 2 })
      variableItemKeys.push(key)
      continue
    }

    // totals / results / margins / kpis
    if (key === 'totalVariableCost') {
      writePnlRow(key, def.label, 'total', (gi) => sumKeysFormula(variableItemKeys, gi, pnlRowOf, pnl), (gi) => variableItemKeys.reduce((s, k) => s + monthlyTotal(k, gi), 0), FMT_EUR, { bold: true })
      continue
    }
    if (key === 'contributionI') {
      writePnlRow(key, def.label, 'result', (gi) => `${cellAddr(pnlRowOf['totalRevenue'], gi)}-${cellAddr(pnlRowOf['totalVariableCost'], gi)}`, (gi) => monthlyTotal('totalRevenue', gi) - variableItemKeys.reduce((s, k) => s + monthlyTotal(k, gi), 0), FMT_EUR, { bold: true })
      continue
    }
    // fixed cost items (df) — generic
    if (section === 'fixed' && def.kind === 'item') {
      writePnlRow(key, def.label, def.kind, (gi) => sumMonthly(gi, key, 'df'), (gi) => monthlyTotal(key, gi), FMT_EUR, { indent: 2 })
      fixedItemKeys.push(key)
      continue
    }
    if (key === 'totalFixedCost') {
      writePnlRow(key, def.label, 'total', (gi) => sumKeysFormula(fixedItemKeys, gi, pnlRowOf, pnl), (gi) => fixedItemKeys.reduce((s, k) => s + monthlyTotal(k, gi), 0), FMT_EUR, { bold: true })
      continue
    }
    if (key === 'contributionII') {
      writePnlRow(key, def.label, 'result', (gi) => `${cellAddr(pnlRowOf['contributionI'], gi)}-${cellAddr(pnlRowOf['totalFixedCost'], gi)}`, (gi) => (monthlyTotal('totalRevenue', gi) - variableItemKeys.reduce((s, k) => s + monthlyTotal(k, gi), 0)) - fixedItemKeys.reduce((s, k) => s + monthlyTotal(k, gi), 0), FMT_EUR, { bold: true })
      continue
    }
    // overhead items (Calc rows are stored with an `oh_` prefix)
    if (section === 'oh' && def.kind === 'item') {
      writePnlRow(key, def.label, def.kind, (gi) => sumMonthly(gi, `oh_${key}`, 'df'), (gi) => monthlyTotal(key, gi), FMT_EUR, { indent: 1 })
      overheadItemKeys.push(key)
      continue
    }
    if (key === 'totalOverhead') {
      writePnlRow(key, def.label, 'total', (gi) => sumKeysFormula(overheadItemKeys, gi, pnlRowOf, pnl), (gi) => overheadItemKeys.reduce((s, k) => s + monthlyTotal(k, gi), 0), FMT_EUR, { bold: true })
      continue
    }
    if (key === 'ebitda') {
      writePnlRow(key, def.label, 'result', (gi) => `${cellAddr(pnlRowOf['contributionII'], gi)}-${cellAddr(pnlRowOf['totalOverhead'], gi)}`, (gi) => monthlyTotal('ebitda', gi), FMT_EUR, { bold: true })
      continue
    }
    if (key === 'ebit') {
      writePnlRow(key, def.label, 'result', (gi) => `${cellAddr(pnlRowOf['ebitda'], gi)}-${cellAddr(pnlRowOf['depAmort'], gi)}`, (gi) => monthlyTotal('ebit', gi), FMT_EUR, { bold: true })
      continue
    }
    if (key === 'netProfit') {
      writePnlRow(key, def.label, 'result', (gi) => `${cellAddr(pnlRowOf['ebit'], gi)}-${cellAddr(pnlRowOf['interestNet'], gi)}-${cellAddr(pnlRowOf['fxNet'], gi)}-${cellAddr(pnlRowOf['tax'], gi)}`, (gi) => monthlyTotal('netProfit', gi), FMT_EUR, { bold: true })
      continue
    }
    if (def.kind === 'margin') {
      const resultKey = key === 'ebitdaMargin' ? 'ebitda' : key === 'ebitMargin' ? 'ebit' : 'netProfit'
      const row = writePnlRow(key, def.label, 'margin', (gi) => `IF(${cellAddr(pnlRowOf['totalRevenue'], gi)}>0,${cellAddr(pnlRowOf[resultKey], gi)}/${cellAddr(pnlRowOf['totalRevenue'], gi)},0)`, (gi) => { const r = monthlyTotal('totalRevenue', gi); return r > 0 ? monthlyTotal(resultKey, gi) / r : 0 }, FMT_PCT, { italic: true })
      // total margin = result total / revenue total
      pnl.getCell(row, totCol).value = {
        formula: `IF(${cellAddr(pnlRowOf['totalRevenue'], -1)}>0,${cellAddr(pnlRowOf[resultKey], -1)}/${cellAddr(pnlRowOf['totalRevenue'], -1)},0)`,
        result: (() => { const rt = globalMonths.reduce((s, _, gi) => s + monthlyTotal('totalRevenue', gi), 0); const xt = globalMonths.reduce((s, _, gi) => s + monthlyTotal(resultKey, gi), 0); return rt > 0 ? xt / rt : 0 })(),
      }
      pnl.getCell(row, totCol).numFmt = FMT_PCT
      continue
    }
    // KPIs
    if (def.kind === 'kpi') {
      if (key === 'acOperational') {
        const f = (gi: number) => { const t = entries.filter((e) => activeOf(e, gi)).length; return String(t) }
        writePnlRow(key, def.label, 'kpi', f, (gi) => entries.filter((e) => activeOf(e, gi)).length, FMT_NUM, {})
        continue
      }
      if (key === 'bh') {
        writePnlRow(key, def.label, 'kpi', (gi) => sumMonthly(gi, 'totalBh', 'df'), (gi) => monthlyTotal('bh', gi), FMT_NUM, {})
        continue
      }
      if (key === 'fh') {
        writePnlRow(key, def.label, 'kpi', (gi) => sumMonthly(gi, 'fh', 'df'), (gi) => monthlyTotal('fh', gi), FMT_NUM, {})
        continue
      }
      if (key === 'fc') {
        writePnlRow(key, def.label, 'kpi', (gi) => sumMonthly(gi, 'fc', 'df'), (gi) => monthlyTotal('fc', gi), FMT_NUM, {})
        continue
      }
      if (key === 'apuFh') {
        writePnlRow(key, def.label, 'kpi', (gi) => sumMonthly(gi, 'apuFh', 'df'), (gi) => monthlyTotal('apuFh', gi), FMT_NUM, {})
        continue
      }
      if (key === 'avgBhPerAc') {
        const row = writePnlRow(key, def.label, 'kpi', (gi) => `IF(${cellAddr(pnlRowOf['acOperational'], gi)}>0,${cellAddr(pnlRowOf['bh'], gi)}/${cellAddr(pnlRowOf['acOperational'], gi)},0)`, (gi) => { const ac = monthlyTotal('acOperational', gi); return ac > 0 ? monthlyTotal('bh', gi) / ac : 0 }, FMT_DEC, {})
        const acTot = globalMonths.reduce((s, _, gi) => s + monthlyTotal('acOperational', gi), 0)
        const bhTot = globalMonths.reduce((s, _, gi) => s + monthlyTotal('bh', gi), 0)
        pnl.getCell(row, totCol).value = { formula: `IF(SUM(${colLetter(2)}${pnlRowOf['acOperational']}:${colLetter(1 + globalMonths.length)}${pnlRowOf['acOperational']})>0,SUM(${colLetter(2)}${pnlRowOf['bh']}:${colLetter(1 + globalMonths.length)}${pnlRowOf['bh']})/SUM(${colLetter(2)}${pnlRowOf['acOperational']}:${colLetter(1 + globalMonths.length)}${pnlRowOf['acOperational']}),0)`, result: acTot > 0 ? bhTot / acTot : 0 }
        pnl.getCell(row, totCol).numFmt = FMT_DEC
        continue
      }
      if (key === 'fhFcRatio') {
        const row = writePnlRow(key, def.label, 'kpi', (gi) => `IF(${cellAddr(pnlRowOf['fc'], gi)}>0,${cellAddr(pnlRowOf['fh'], gi)}/${cellAddr(pnlRowOf['fc'], gi)},0)`, (gi) => { const fc = monthlyTotal('fc', gi); return fc > 0 ? monthlyTotal('fh', gi) / fc : 0 }, FMT_DEC, {})
        const fcTot = globalMonths.reduce((s, _, gi) => s + monthlyTotal('fc', gi), 0)
        const fhTot = globalMonths.reduce((s, _, gi) => s + monthlyTotal('fh', gi), 0)
        pnl.getCell(row, totCol).value = { formula: `IF(SUM(${colLetter(2)}${pnlRowOf['fc']}:${colLetter(1 + globalMonths.length)}${pnlRowOf['fc']})>0,SUM(${colLetter(2)}${pnlRowOf['fh']}:${colLetter(1 + globalMonths.length)}${pnlRowOf['fh']})/SUM(${colLetter(2)}${pnlRowOf['fc']}:${colLetter(1 + globalMonths.length)}${pnlRowOf['fc']}),0)`, result: fcTot > 0 ? fhTot / fcTot : 0 }
        pnl.getCell(row, totCol).numFmt = FMT_DEC
        continue
      }
    }
    // fallback: zero
    zeroRow(key || `__row_${pr}`, def.label, { indent: 2 })
    if (section === 'var') variableItemKeys.push(key)
    if (section === 'fixed') fixedItemKeys.push(key)
  }

  return wb

  // ---- inner helpers that need closure over globalMonths ----
  function cellAddr(row: number, gi: number): string {
    // gi === -1 means TOTAL column
    if (gi === -1) return `${colLetter(totCol)}${row}`
    return `${colLetter(2 + gi)}${row}`
  }
}

// helper used above (declared after return is not reachable; define at module scope instead)
function sumKeysFormula(
  keys: string[],
  gi: number,
  rowOf: Record<string, number>,
  pnl: import('exceljs').Worksheet,
): string {
  void pnl
  const cols = (n: number) => {
    let s = ''
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
    return s
  }
  const terms = keys.filter((k) => rowOf[k]).map((k) => `${cols(2 + gi)}${rowOf[k]}`)
  return terms.length ? terms.join('+') : '0'
}

// ---- Download trigger ----

export async function downloadCalculationWorkbook(data: CalcExportData, filename?: string) {
  const wb = await buildCalculationWorkbook(data)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = (data.projectName || 'ACMI-Pricing').replace(/[^a-z0-9-_]+/gi, '_')
  a.download = filename ?? `${safe}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
