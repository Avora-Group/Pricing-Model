/**
 * Shared P&L computation engine.
 *
 * Replicates the exact cost calculation from PnlTable so that
 * QuoteDetailClient (and future consumers) can compute correct
 * net-profit / ACMI-cost-per-BH values without duplicating
 * 400+ lines of inline logic.
 */

import { generateMonthRange } from '@/stores/pricing-store'
import { buildMonthDayInfos } from './pnl-proration'
import type { MsnInput, EprMatrixRow } from '@/stores/pricing-store'
import type { PayrollRow, CostRow, TrainingRow } from '@/stores/crew-config-store'
import type {
  MaintPersonnel,
  MaintCostItem,
  InsuranceItem,
  DocItem,
  OtherCogsItem,
  OverheadItem,
} from '@/stores/costs-config-store'

// ---- EPR interpolation (same as PnlTable) ----

export function interpolateEpr(
  matrix: EprMatrixRow[],
  targetCr: number,
  environment: 'benign' | 'hot',
): number {
  if (matrix.length === 0) return 0
  const sorted = [...matrix].sort((a, b) => a.cycleRatio - b.cycleRatio)
  const getRate = (row: EprMatrixRow) =>
    environment === 'benign' ? row.benignRate : row.hotRate

  if (targetCr <= sorted[0].cycleRatio) return getRate(sorted[0])
  if (targetCr >= sorted[sorted.length - 1].cycleRatio)
    return getRate(sorted[sorted.length - 1])

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]
    const hi = sorted[i + 1]
    if (targetCr >= lo.cycleRatio && targetCr <= hi.cycleRatio) {
      if (lo.cycleRatio === hi.cycleRatio) return getRate(lo)
      const t = (targetCr - lo.cycleRatio) / (hi.cycleRatio - lo.cycleRatio)
      return getRate(lo) + t * (getRate(hi) - getRate(lo))
    }
  }
  return getRate(sorted[sorted.length - 1])
}

// ---- Store data shapes (for type-safe parameter passing) ----

export interface CrewStoreData {
  payroll: PayrollRow[]
  otherCost: CostRow[]
  training: TrainingRow[]
  averageAC: number
  fdDays: number
  nfdDays: number
}

export interface CostsStoreData {
  maintPersonnel: MaintPersonnel[]
  maintCosts: MaintCostItem[]
  insurance: InsuranceItem[]
  doc: DocItem[]
  otherCogs: OtherCogsItem[]
  overhead: OverheadItem[]
  avgAc: number
}

// ---- Result type ----

export interface MsnPnlSummary {
  acmiRatePerBh: number
  acmiCostPerBh: number // total cost / total BH
  totalRevenue: number
  totalCost: number
  netProfit: number
  totalBh: number
}

// ---- Core computation ----

/**
 * Compute the full P&L summary for a single MSN.
 *
 * Replicates `computeForMsn` + `buildMonthlyData` from PnlTable,
 * then sums across the MSN's active period to produce totals.
 */
export function computeMsnPnlSummary(
  input: MsnInput,
  crew: CrewStoreData,
  costs: CostsStoreData,
  exchangeRate: number,
): MsnPnlSummary {
  // ── Parse MSN input values ──
  const mgh = parseFloat(input.mgh) || 0
  const rateToEur = input.rateCurrency === 'usd' ? exchangeRate : 1
  const acmiRate = (parseFloat(input.acmiRate || '0')) * rateToEur
  const excessBh = parseFloat(input.excessBh || '0')
  const excessHourRate = (parseFloat(input.excessHourRate || '0')) * rateToEur
  const cycleRatio = parseFloat(input.cycleRatio || '1')
  const bhFhRatio = parseFloat(input.bhFhRatio || '1.2')
  const apuFhRatio = parseFloat(input.apuFhRatio || '1.1')
  const crewSets = input.crewSets
  const leaseType = input.leaseType
  const aircraftType = input.aircraftType
  const environment = input.environment
  const totalBhPerMonth = mgh + excessBh

  const months = generateMonthRange(input.periodStart, input.periodEnd)
  if (months.length === 0 || mgh === 0) {
    return {
      acmiRatePerBh: acmiRate,
      acmiCostPerBh: 0,
      totalRevenue: 0,
      totalCost: 0,
      netProfit: 0,
      totalBh: 0,
    }
  }

  // Revenue per month
  const revenuePerMonth = acmiRate * mgh + excessBh * excessHourRate

  // ── Crew derivations ──
  const pilotSalaryPerSet =
    crew.payroll[0].grossSalary +
    crew.payroll[0].benefits +
    (crew.payroll[1].grossSalary + crew.payroll[1].benefits)
  const cabinAttendantSS =
    crew.payroll[2].grossSalary + crew.payroll[2].benefits
  const seniorAttendantSS =
    crew.payroll[6].grossSalary + crew.payroll[6].benefits

  const uniformsRow = crew.otherCost.find((r) => r.item === 'Uniforms')
  const uniformPerMonth =
    uniformsRow?.amount && crew.averageAC > 0
      ? uniformsRow.amount / crew.averageAC / 12
      : 0

  const trainingTotal = crew.training.reduce(
    (s, r) => s + (r.amount ?? 0),
    0,
  )
  const trainingPerMonth =
    crew.averageAC > 0 ? trainingTotal / crew.averageAC / 12 : 0

  const travelCostsRow = crew.otherCost.find((r) => r.item === 'Travel costs')
  const accomRow = crew.otherCost.find((r) => r.item === 'Accomodation')
  const accomTravelCPerMonth =
    crew.averageAC > 0
      ? ((travelCostsRow?.amount ?? 0) + (accomRow?.amount ?? 0)) /
        crew.averageAC /
        12
      : 0

  const perDiemForRow = (row: PayrollRow) =>
    row.perDiemFD * crew.fdDays + row.perDiemNFD * crew.nfdDays
  const pilotPerDiemPerSet =
    perDiemForRow(crew.payroll[0]) + perDiemForRow(crew.payroll[1])
  const bhBonusPerBh =
    crew.payroll[0].perBhPerdiem + crew.payroll[1].perBhPerdiem
  const cabinAttPerDiem = perDiemForRow(crew.payroll[2])
  const seniorAttPerDiem = perDiemForRow(crew.payroll[6])

  // Crew — salary per month
  const pilotSalary = pilotSalaryPerSet * crewSets
  let cabinCrewSalary = 0
  if (leaseType === 'wet') {
    if (aircraftType === 'A321') {
      cabinCrewSalary =
        (4 * cabinAttendantSS + seniorAttendantSS) * crewSets
    } else {
      cabinCrewSalary =
        (3 * cabinAttendantSS + seniorAttendantSS) * crewSets
    }
  } else if (leaseType === 'moist') {
    cabinCrewSalary = seniorAttendantSS * crewSets
  }

  // Crew — per diems per month
  const pilotPerDiem =
    pilotPerDiemPerSet * crewSets + bhBonusPerBh * totalBhPerMonth
  let cabinCrewPerDiem = 0
  if (leaseType === 'wet') {
    if (aircraftType === 'A321') {
      cabinCrewPerDiem =
        (4 * cabinAttPerDiem + seniorAttPerDiem) * crewSets
    } else {
      cabinCrewPerDiem =
        (3 * cabinAttPerDiem + seniorAttPerDiem) * crewSets
    }
  } else if (leaseType === 'moist') {
    cabinCrewPerDiem = seniorAttPerDiem * crewSets
  }

  // ── Costs derivations ──
  const findMaintCost = (name: string) =>
    costs.maintCosts.find((c) => c.name === name)?.perMonthPerAc ?? 0
  const lineMaintenanceVal =
    findMaintCost('Line Maintenance - Internal') +
    findMaintCost('Line Maintenance - 3rd Party')
  const baseMaintenanceVal = findMaintCost('Capital Maintenance')
  const maintPersonnelSalaryVal = findMaintCost(
    'Maintenance Personnel Salary',
  )
  const trainningVal = findMaintCost('Trainning')
  const cCheckVal = findMaintCost('C-Check')

  const maintPerDiemVal = costs.maintPersonnel.reduce(
    (sum, p) => sum + p.engineers * p.perDiem * p.days,
    0,
  )

  const sparePartsRatePerBh = findMaintCost('Spare Parts KPI (Per BH)')
  const tiresWheelsCost = findMaintCost('Tires/Wheels')

  // Insurance for this MSN (USD → EUR)
  const insuranceByMsn: Record<number, number> = {}
  for (const ins of costs.insurance) {
    insuranceByMsn[ins.msn] = ins.priceUsd * exchangeRate
  }
  const insuranceFixed = insuranceByMsn[input.msn] ?? 0

  // Other COGS
  const otherCogsComputed = costs.otherCogs.map((item) => {
    if (item.hasTotal && item.total !== undefined) {
      if (item.name === 'Other Fixed')
        return { ...item, perMonth: item.total / 9 / 7 }
      if (item.name === 'Technical')
        return {
          ...item,
          perMonth:
            costs.avgAc > 0 ? item.total / costs.avgAc / 12 : 0,
        }
    }
    return item
  })
  const technicalVal =
    otherCogsComputed.find((c) => c.name === 'Technical')?.perMonth ?? 0
  const otherFixedVal =
    otherCogsComputed.find((c) => c.name === 'Other Fixed')?.perMonth ?? 0
  const commissionSummerRate =
    otherCogsComputed.find(
      (c) => c.name === 'Commission - Third Party Summer',
    )?.perMonth ?? 0
  const commissionWinterRate =
    otherCogsComputed.find(
      (c) => c.name === 'Commission - Third Party Winter',
    )?.perMonth ?? 0
  const commissionMxcRate =
    otherCogsComputed.find((c) => c.name === 'Commission - MXC')
      ?.perMonth ?? 0

  // DOC: per month per AC = total / avgAc / 12
  const docPerMonth = costs.doc.map((d) =>
    costs.avgAc > 0 ? d.total / costs.avgAc / 12 : 0,
  )
  const fuelVal = docPerMonth[0] ?? 0
  const handlingVal = docPerMonth[1] ?? 0
  const navigationVal = docPerMonth[2] ?? 0
  const airportChargesVal = docPerMonth[3] ?? 0

  // Overhead: per month per AC = total / avgAc / 12
  const overheadPerMonth = costs.overhead.map((o) =>
    costs.avgAc > 0 ? o.total / costs.avgAc / 12 : 0,
  )

  // ── Maintenance reserves variable ──
  const fh = bhFhRatio > 0 ? totalBhPerMonth / bhFhRatio : 0
  const fc = cycleRatio > 0 ? fh / cycleRatio : 0
  const apuFh = fh * apuFhRatio
  const eprRate = interpolateEpr(
    input.eprMatrix ?? [],
    cycleRatio,
    environment,
  )
  const eprMr = eprRate * 2 * fh * exchangeRate
  const llpMr =
    (parseFloat(input.llp1RateUsd || '0') +
      parseFloat(input.llp2RateUsd || '0')) *
    fc *
    exchangeRate
  const apuMr =
    parseFloat(input.apuRateUsd || '0') * apuFh * exchangeRate
  const maintReservesVariable = eprMr + llpMr + apuMr

  // Spare parts = totalBH × spare parts rate + tires/wheels fixed
  const spareParts = totalBhPerMonth * sparePartsRatePerBh + tiresWheelsCost

  // Maintenance reserves fixed (6yr + 12yr + LDG)
  const maintReservesFixed =
    parseFloat(input.sixYearCheckEur || '0') +
    parseFloat(input.twelveYearCheckEur || '0') +
    parseFloat(input.ldgEur || '0')

  // ── Proration info ──
  const monthDayInfos = buildMonthDayInfos(months, input.periodStart, input.periodEnd)
  const workingDays = crew.fdDays + crew.nfdDays // e.g. 28

  // Per-diem split: day-based vs BH-based for pilot per diem
  const pilotPerDiem_perDiem = pilotPerDiemPerSet * crewSets
  const pilotPerDiem_bhBonus = bhBonusPerBh * totalBhPerMonth

  // ── Sum across all months ──
  let sumRevenue = 0
  let sumCost = 0
  let sumBh = 0

  for (let m = 0; m < months.length; m++) {
    // Proration factors
    const info = monthDayInfos[m]
    const isPartial = info.activeDays < info.totalDays
    const df = isPartial ? info.activeDays / info.totalDays : 1.0
    const cdf = (isPartial && workingDays > 0) ? info.activeDays / workingDays : 1.0
    const monthBh = totalBhPerMonth * df

    sumRevenue += revenuePerMonth * df
    sumBh += monthBh

    // Commission depends on calendar month (May–Oct = summer → winter rate)
    const calMonth = months[m].month
    const isSummer = calMonth >= 5 && calMonth <= 10
    const commissions =
      (isSummer ? commissionWinterRate : commissionSummerRate) * monthBh

    // Variable costs (prorated)
    const totalVariable =
      maintReservesVariable * df +
      0 /* assetMgmtFee */ +
      pilotPerDiem_perDiem * cdf + pilotPerDiem_bhBonus * df +
      cabinCrewPerDiem * cdf +
      accomTravelCPerMonth * df +
      (totalBhPerMonth * sparePartsRatePerBh * df + tiresWheelsCost * df) +
      maintPerDiemVal * df +
      0 /* accomTravelM */ +
      0 /* otherMaintV */ +
      fuelVal * df +
      handlingVal * df +
      navigationVal * df +
      airportChargesVal * df +
      commissions +
      0 /* delaysCancellations */

    // Fixed costs (prorated by day fraction, same as variable)
    const totalFixed =
      (parseFloat(input.leaseRentEur || '0') +
        maintReservesFixed +
        pilotSalary +
        cabinCrewSalary +
        uniformPerMonth +
        trainingPerMonth +
        lineMaintenanceVal +
        baseMaintenanceVal +
        maintPersonnelSalaryVal +
        trainningVal +
        cCheckVal +
        insuranceFixed +
        technicalVal +
        otherFixedVal) *
      df

    // Overhead (prorated). The personnel line is fixed personnel + MXC
    // commission on the month's BH; scaling the whole block by df prorates the
    // fixed parts by days and charges MXC on the prorated BH (monthBh = full×df).
    const totalOverhead =
      ((overheadPerMonth[0] ?? 0) +
        ((overheadPerMonth[1] ?? 0) + commissionMxcRate * totalBhPerMonth) +
        (overheadPerMonth[2] ?? 0) +
        (overheadPerMonth[3] ?? 0) +
        (overheadPerMonth[4] ?? 0) +
        (overheadPerMonth[5] ?? 0) +
        (overheadPerMonth[6] ?? 0) +
        (overheadPerMonth[7] ?? 0) +
        (overheadPerMonth[8] ?? 0)) *
      df

    sumCost += totalVariable + totalFixed + totalOverhead
  }

  const totalBhAll = sumBh
  const netProfit = sumRevenue - sumCost
  const acmiCostPerBh = totalBhAll > 0 ? sumCost / totalBhAll : 0

  return {
    acmiRatePerBh: acmiRate,
    acmiCostPerBh,
    totalRevenue: sumRevenue,
    totalCost: sumCost,
    netProfit,
    totalBh: totalBhAll,
  }
}

/**
 * Seasonal-aware wrapper: if the input has seasonality enabled,
 * runs computeMsnPnlSummary twice (summer + winter) and merges.
 */
export function computeMsnPnlSummarySeasonal(
  input: MsnInput,
  crew: CrewStoreData,
  costs: CostsStoreData,
  exchangeRate: number,
): MsnPnlSummary {
  if (!input.seasonalityEnabled || !input.summer || !input.winter) {
    return computeMsnPnlSummary(input, crew, costs, exchangeRate)
  }

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

  const s = computeMsnPnlSummary(summerInput, crew, costs, exchangeRate)
  const w = computeMsnPnlSummary(winterInput, crew, costs, exchangeRate)

  const totalBh = s.totalBh + w.totalBh
  const totalRevenue = s.totalRevenue + w.totalRevenue
  const totalCost = s.totalCost + w.totalCost
  const netProfit = totalRevenue - totalCost
  const acmiCostPerBh = totalBh > 0 ? totalCost / totalBh : 0
  // Weighted average ACMI rate
  const acmiRatePerBh = totalBh > 0
    ? (s.acmiRatePerBh * s.totalBh + w.acmiRatePerBh * w.totalBh) / totalBh
    : 0

  return { acmiRatePerBh, acmiCostPerBh, totalRevenue, totalCost, netProfit, totalBh }
}
