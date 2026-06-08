'use client'

import { useEffect, useState } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import type { EprMatrixRow, MsnInput } from '@/stores/pricing-store'
import { computePeriodMonths, generateMonthRange } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { fmt } from '@/lib/format'
import { interpolateEpr } from '@/lib/pnl-engine'
import { buildMonthDayInfos } from '@/lib/pnl-proration'

interface SummaryRow {
  label: string
  perMonth: string | number
  totalProject: string | number
  isSeparator?: boolean
  isBold?: boolean
  isRate?: boolean
  colorClass?: string
  colorClassTotal?: string
}

/** Compute all monthly cost components for a single MSN (mirrors PnlTable.computeForMsn) */
function computeMsnCosts(
  input: MsnInput,
  exchangeRate: number,
  bhFhRatio: number,
  apuFhRatio: number,
  // Crew derived values
  crew: {
    pilotSalaryPerSet: number
    cabinAttendantSS: number
    seniorAttendantSS: number
    uniformPerMonth: number
    trainingPerMonth: number
    accomTravelCPerMonth: number
    pilotPerDiemPerSet: number
    bhBonusPerBh: number
    cabinAttPerDiem: number
    seniorAttPerDiem: number
    fdDays: number
    nfdDays: number
  },
  // Costs derived values
  costs: {
    lineMaintenanceVal: number
    baseMaintenanceVal: number
    maintPersonnelSalaryVal: number
    trainningVal: number
    cCheckVal: number
    maintPerDiemVal: number
    sparePartsRatePerBh: number
    tiresWheelsCost: number
    insuranceByMsn: Record<number, number>
    technicalVal: number
    otherFixedVal: number
    commissionSummerRate: number
    commissionWinterRate: number
    commissionMxcRate: number
    fuelVal: number
    handlingVal: number
    navigationVal: number
    airportChargesVal: number
    overheadPerMonth: number[]
  },
) {
  const mgh = parseFloat(input.mgh) || 0
  const excessBh = parseFloat(input.excessBh || '0')
  const rawExcessHourRate = parseFloat(input.excessHourRate || '0')
  const rawAcmiRate = parseFloat(input.acmiRate || '0')
  // Convert USD rates to EUR if needed
  const rateToEur = input.rateCurrency === 'usd' ? exchangeRate : 1
  const acmiRate = rawAcmiRate * rateToEur
  const excessHourRate = rawExcessHourRate * rateToEur
  const cycleRatio = parseFloat(input.cycleRatio || '1')
  const totalBh = mgh + excessBh
  const fh = bhFhRatio > 0 ? totalBh / bhFhRatio : 0
  const fc = cycleRatio > 0 ? fh / cycleRatio : 0
  const apuFh = fh * apuFhRatio
  const duration = computePeriodMonths(input.periodStart, input.periodEnd)
  const revenuePerMonth = (acmiRate * mgh) + (excessBh * excessHourRate)

  // ── Aircraft (Category A) ──
  const dryLease = parseFloat(input.leaseRentEur || '0')
  const maintReservesFixed = (parseFloat(input.sixYearCheckEur || '0')
    + parseFloat(input.twelveYearCheckEur || '0')
    + parseFloat(input.ldgEur || '0'))
  const eprRate = interpolateEpr(input.eprMatrix ?? [], cycleRatio, input.environment)
  const eprMr = eprRate * 2 * fh * exchangeRate
  const llpMr = (parseFloat(input.llp1RateUsd || '0') + parseFloat(input.llp2RateUsd || '0')) * fc * exchangeRate
  const apuMr = parseFloat(input.apuRateUsd || '0') * apuFh * exchangeRate
  const maintReservesVariable = eprMr + llpMr + apuMr
  const aircraft = dryLease + maintReservesFixed + maintReservesVariable

  // ── Crew (Category C) ──
  const crewSets = input.crewSets
  const leaseType = input.leaseType
  const aircraftType = input.aircraftType

  // C - Fixed
  const pilotSalary = crew.pilotSalaryPerSet * crewSets
  let cabinCrewSalary = 0
  if (leaseType === 'wet') {
    if (aircraftType === 'A321') {
      cabinCrewSalary = (4 * crew.cabinAttendantSS + crew.seniorAttendantSS) * crewSets
    } else {
      cabinCrewSalary = (3 * crew.cabinAttendantSS + crew.seniorAttendantSS) * crewSets
    }
  } else if (leaseType === 'moist') {
    cabinCrewSalary = crew.seniorAttendantSS * crewSets
  }
  const crewFixed = pilotSalary + cabinCrewSalary + crew.uniformPerMonth + crew.trainingPerMonth

  // C - Variable
  const pilotPerDiem = crew.pilotPerDiemPerSet * crewSets + crew.bhBonusPerBh * totalBh
  let cabinCrewPerDiem = 0
  if (leaseType === 'wet') {
    if (aircraftType === 'A321') {
      cabinCrewPerDiem = (4 * crew.cabinAttPerDiem + crew.seniorAttPerDiem) * crewSets
    } else {
      cabinCrewPerDiem = (3 * crew.cabinAttPerDiem + crew.seniorAttPerDiem) * crewSets
    }
  } else if (leaseType === 'moist') {
    cabinCrewPerDiem = crew.seniorAttPerDiem * crewSets
  }
  const crewVariable = pilotPerDiem + cabinCrewPerDiem + crew.accomTravelCPerMonth
  const crewTotal = crewFixed + crewVariable

  // ── Maintenance (Category M) ──
  const spareParts = totalBh * costs.sparePartsRatePerBh + costs.tiresWheelsCost
  const maintVariable = spareParts + costs.maintPerDiemVal
  const maintFixed = costs.lineMaintenanceVal + costs.baseMaintenanceVal
    + costs.maintPersonnelSalaryVal + costs.trainningVal + costs.cCheckVal
  const maintenance = maintVariable + maintFixed

  // ── Insurance (Category I) ──
  const insurance = costs.insuranceByMsn[input.msn] ?? 0

  // ── DOC (includes Technical and Other Fixed) ──
  const doc = costs.fuelVal + costs.handlingVal + costs.navigationVal + costs.airportChargesVal
    + costs.technicalVal + costs.otherFixedVal

  // ── Other COGS (not shown as separate row, included in ACMI Cost) ──
  // Commissions use average of summer/winter rate × BH as monthly approximation
  const avgCommissionRate = (costs.commissionSummerRate + costs.commissionWinterRate) / 2
  const commissions = avgCommissionRate * totalBh
  const otherCogs = commissions

  // ── Overhead ──
  const baseOverhead = costs.overheadPerMonth.reduce((s, v) => s + v, 0)
  const mxcCommission = costs.commissionMxcRate * totalBh
  const overhead = baseOverhead + mxcCommission

  // ── Totals (per month, full-month values) ──
  const acmiCost = aircraft + crewTotal + maintenance + insurance + doc + otherCogs
  const totalCost = acmiCost

  // ── Prorated totals across all months ──
  const months = generateMonthRange(input.periodStart, input.periodEnd)
  const monthDayInfos = buildMonthDayInfos(months, input.periodStart, input.periodEnd)
  const workingDays = crew.fdDays + crew.nfdDays

  // Split per-diem components for correct proration
  const pilotPerDiem_perDiem = crew.pilotPerDiemPerSet * crewSets
  const pilotPerDiem_bhBonus = crew.bhBonusPerBh * totalBh

  let tRevenue = 0, tAircraft = 0, tCrew = 0, tMaint = 0
  let tInsurance = 0, tDoc = 0, tOtherCogs = 0, tOverhead = 0
  let tBhSold = 0, tBhActual = 0, tFh = 0, tFc = 0

  const _baseOverhead = costs.overheadPerMonth.reduce((s, v) => s + v, 0)

  for (let m = 0; m < months.length; m++) {
    const info = monthDayInfos[m]
    const isPartial = info.activeDays < info.totalDays
    const df = isPartial ? info.activeDays / info.totalDays : 1.0
    const cdf = (isPartial && workingDays > 0) ? info.activeDays / workingDays : 1.0
    const monthBh = totalBh * df

    tRevenue += revenuePerMonth * df
    tBhSold += mgh * df
    tBhActual += totalBh * df
    tFh += fh * df
    tFc += fc * df

    // All costs prorate by the day fraction for partial months (same as the
    // P&L engine): a project starting on the 22nd of a 30-day month bears 9/30.
    // Aircraft: fixed (dryLease, maintReservesFixed) + variable, all * df
    tAircraft += (dryLease + maintReservesFixed + maintReservesVariable) * df

    // Crew: fixed salaries/uniform/training * df + per diems (crew day fraction)
    tCrew += crewFixed * df
      + pilotPerDiem_perDiem * cdf + pilotPerDiem_bhBonus * df
      + cabinCrewPerDiem * cdf
      + crew.accomTravelCPerMonth * df

    // Maintenance: fixed (line, base, salary, training, cCheck) + variable, all * df
    tMaint += maintFixed * df
      + totalBh * costs.sparePartsRatePerBh * df + costs.tiresWheelsCost * df
      + costs.maintPerDiemVal * df

    // Insurance: fixed, prorated by days
    tInsurance += insurance * df

    // DOC: all prorated by days
    tDoc += (costs.fuelVal + costs.handlingVal + costs.navigationVal + costs.airportChargesVal) * df
      + (costs.technicalVal + costs.otherFixedVal) * df

    // Commissions: BH-proportional with season
    const calMonth = months[m].month
    const isSummer = calMonth >= 5 && calMonth <= 10
    tOtherCogs += (isSummer ? costs.commissionWinterRate : costs.commissionSummerRate) * monthBh

    // Overhead: prorated by days. Scaling (_baseOverhead + MXC×fullBh) by df
    // prorates fixed personnel and charges MXC on the prorated BH (= monthBh).
    tOverhead += (_baseOverhead + costs.commissionMxcRate * totalBh) * df
  }

  const tAcmiCost = tAircraft + tCrew + tMaint + tInsurance + tDoc + tOtherCogs

  return {
    msn: input.msn,
    leaseType,
    mgh,
    bhSold: mgh,
    bhActual: totalBh,
    fh,
    fc,
    cycleRatio: parseFloat(input.cycleRatio || '0'),
    acmiRate,
    duration,
    revenuePerMonth,
    aircraft,
    crew: crewTotal,
    maintenance,
    insurance,
    doc,
    otherCogs,
    acmiCost,
    totalCost,
    overhead,
    // Fixed cost breakdown (per month) for coverage calculation
    fixedCosts: {
      aircraft: dryLease + maintReservesFixed,
      crew: crewFixed,
      maintenance: maintFixed,
      insurance,
      doc: costs.technicalVal + costs.otherFixedVal,
      overhead: costs.overheadPerMonth.reduce((s, v) => s + v, 0),
    },
    total: {
      revenue: tRevenue,
      bhSold: tBhSold,
      bhActual: tBhActual,
      fh: tFh,
      fc: tFc,
      aircraft: tAircraft,
      crew: tCrew,
      maintenance: tMaint,
      insurance: tInsurance,
      doc: tDoc,
      otherCogs: tOtherCogs,
      acmiCost: tAcmiCost,
      totalCost: tAcmiCost,
      overhead: tOverhead,
    },
  }
}

export function SummaryTable() {
  const {
    projectName,
    exchangeRate: globalExchangeRate,
    bhFhRatio: globalBhFhRatio,
    apuFhRatio: globalApuFhRatio,
    msnInputs,
    selectedMsn,
    setSelectedMsn,
    isCalculating,
  } = usePricingStore()

  // ── Crew config ──
  const crewPayroll = useCrewConfigStore((s) => s.payroll)
  const crewOtherCost = useCrewConfigStore((s) => s.otherCost)
  const crewTraining = useCrewConfigStore((s) => s.training)
  const crewAvgAC = useCrewConfigStore((s) => s.averageAC)
  const crewFdDays = useCrewConfigStore((s) => s.fdDays)
  const crewNfdDays = useCrewConfigStore((s) => s.nfdDays)

  // ── Costs config ──
  const costsMaintPersonnel = useCostsConfigStore((s) => s.maintPersonnel)
  const costsMaintCosts = useCostsConfigStore((s) => s.maintCosts)
  const costsInsurance = useCostsConfigStore((s) => s.insurance)
  const costsDoc = useCostsConfigStore((s) => s.doc)
  const costsOtherCogs = useCostsConfigStore((s) => s.otherCogs)
  const costsOverhead = useCostsConfigStore((s) => s.overhead)
  const costsAvgAc = useCostsConfigStore((s) => s.avgAc)

  const [displayMode, setDisplayMode] = useState<'eur' | 'eurPerBh'>('eur')
  const [seasonFilter, setSeasonFilter] = useState<'total' | 'summer' | 'winter'>('total')

  const exchangeRate = parseFloat(globalExchangeRate || '0.85')
  const bhFhRatioNum = parseFloat(globalBhFhRatio || '1.2')
  const apuFhRatioNum = parseFloat(globalApuFhRatio || '1.1')

  const numAc = msnInputs.length

  // Auto-select first MSN when inputs change (but preserve null = Total view)
  useEffect(() => {
    if (numAc === 0) {
      setSelectedMsn(null)
      return
    }
    // If the selected MSN was removed, fall back to first MSN
    if (selectedMsn !== null && !msnInputs.some((i) => i.msn === selectedMsn)) {
      setSelectedMsn(msnInputs[0].msn)
    }
  }, [msnInputs, numAc, selectedMsn, setSelectedMsn])

  // Reset season filter when no MSN has seasonality enabled
  useEffect(() => {
    if (seasonFilter !== 'total' && !msnInputs.some((i) => i.seasonalityEnabled)) {
      setSeasonFilter('total')
    }
  }, [msnInputs, seasonFilter])

  if (msnInputs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Add an aircraft to see the pricing summary.
        </p>
      </div>
    )
  }

  // ── Derive crew values (same as PnlTable) ──
  const pilotSalaryPerSet = (crewPayroll[0].grossSalary + crewPayroll[0].benefits)
    + (crewPayroll[1].grossSalary + crewPayroll[1].benefits)
  const cabinAttendantSS = crewPayroll[2].grossSalary + crewPayroll[2].benefits
  const seniorAttendantSS = crewPayroll[6].grossSalary + crewPayroll[6].benefits
  const uniformsRow = crewOtherCost.find((r) => r.item === 'Uniforms')
  const uniformPerMonth = uniformsRow?.amount && crewAvgAC > 0 ? uniformsRow.amount / crewAvgAC / 12 : 0
  const trainingTotal = crewTraining.reduce((s, r) => s + (r.amount ?? 0), 0)
  const trainingPerMonth = crewAvgAC > 0 ? trainingTotal / crewAvgAC / 12 : 0
  const travelCostsRow = crewOtherCost.find((r) => r.item === 'Travel costs')
  const accomRow = crewOtherCost.find((r) => r.item === 'Accomodation')
  const accomTravelCPerMonth = crewAvgAC > 0
    ? ((travelCostsRow?.amount ?? 0) + (accomRow?.amount ?? 0)) / crewAvgAC / 12
    : 0
  const perDiemForRow = (row: typeof crewPayroll[number]) =>
    row.perDiemFD * crewFdDays + row.perDiemNFD * crewNfdDays
  const pilotPerDiemPerSet = perDiemForRow(crewPayroll[0]) + perDiemForRow(crewPayroll[1])
  const bhBonusPerBh = crewPayroll[0].perBhPerdiem + crewPayroll[1].perBhPerdiem
  const cabinAttPerDiem = perDiemForRow(crewPayroll[2])
  const seniorAttPerDiem = perDiemForRow(crewPayroll[6])

  // ── Derive costs values (same as PnlTable) ──
  const findMaintCost = (name: string) => costsMaintCosts.find((c) => c.name === name)?.perMonthPerAc ?? 0
  const lineMaintenanceVal = findMaintCost('Line Maintenance - Internal') + findMaintCost('Line Maintenance - 3rd Party')
  const baseMaintenanceVal = findMaintCost('Capital Maintenance')
  const maintPersonnelSalaryVal = findMaintCost('Maintenance Personnel Salary')
  const trainningVal = findMaintCost('Trainning')
  const cCheckVal = findMaintCost('C-Check')
  const maintPerDiemVal = costsMaintPersonnel.reduce((sum, p) => sum + p.engineers * p.perDiem * p.days, 0)
  const sparePartsRatePerBh = findMaintCost('Spare Parts KPI (Per BH)')
  const tiresWheelsCost = findMaintCost('Tires/Wheels')

  const insuranceByMsn: Record<number, number> = {}
  for (const ins of costsInsurance) {
    insuranceByMsn[ins.msn] = ins.priceUsd * exchangeRate
  }

  const otherCogsComputed = costsOtherCogs.map((item) => {
    if (item.hasTotal && item.total !== undefined) {
      if (item.name === 'Other Fixed') return { ...item, perMonth: item.total / 9 / 7 }
      if (item.name === 'Technical') return { ...item, perMonth: costsAvgAc > 0 ? item.total / costsAvgAc / 12 : 0 }
    }
    return item
  })
  const technicalVal = otherCogsComputed.find((c) => c.name === 'Technical')?.perMonth ?? 0
  const otherFixedVal = otherCogsComputed.find((c) => c.name === 'Other Fixed')?.perMonth ?? 0
  const commissionSummerRate = otherCogsComputed.find((c) => c.name === 'Commission - Third Party Summer')?.perMonth ?? 0
  const commissionWinterRate = otherCogsComputed.find((c) => c.name === 'Commission - Third Party Winter')?.perMonth ?? 0
  const commissionMxcRate = otherCogsComputed.find((c) => c.name === 'Commission - MXC')?.perMonth ?? 0

  const docPerMonth = costsDoc.map((d) => (costsAvgAc > 0 ? d.total / costsAvgAc / 12 : 0))
  const fuelVal = docPerMonth[0] ?? 0
  const handlingVal = docPerMonth[1] ?? 0
  const navigationVal = docPerMonth[2] ?? 0
  const airportChargesVal = docPerMonth[3] ?? 0

  const overheadPerMonth = costsOverhead.map((o) => (costsAvgAc > 0 ? o.total / costsAvgAc / 12 : 0))

  const crewDerived = {
    pilotSalaryPerSet, cabinAttendantSS, seniorAttendantSS,
    uniformPerMonth, trainingPerMonth, accomTravelCPerMonth,
    pilotPerDiemPerSet, bhBonusPerBh, cabinAttPerDiem, seniorAttPerDiem,
    fdDays: crewFdDays, nfdDays: crewNfdDays,
  }
  const costsDerived = {
    lineMaintenanceVal, baseMaintenanceVal, maintPersonnelSalaryVal,
    trainningVal, cCheckVal, maintPerDiemVal, sparePartsRatePerBh,
    tiresWheelsCost, insuranceByMsn, technicalVal, otherFixedVal,
    commissionSummerRate, commissionWinterRate, commissionMxcRate,
    fuelVal, handlingVal, navigationVal, airportChargesVal, overheadPerMonth,
  }

  // ── Compute per-MSN data (with seasonal breakdown when applicable) ──
  type MsnCostResult = ReturnType<typeof computeMsnCosts>
  interface MsnDataWithSeasons extends MsnCostResult {
    summerData?: MsnCostResult
    winterData?: MsnCostResult
  }

  const perMsnData: MsnDataWithSeasons[] = msnInputs.map((input) => {
    if (input.seasonalityEnabled && input.summer && input.winter) {
      // Build virtual inputs for each season by overlaying season fields onto the base input
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
      const s = computeMsnCosts(summerInput, exchangeRate, bhFhRatioNum, apuFhRatioNum, crewDerived, costsDerived)
      const w = computeMsnCosts(winterInput, exchangeRate, bhFhRatioNum, apuFhRatioNum, crewDerived, costsDerived)
      const totalDuration = s.duration + w.duration

      // Weighted average per-month values (weight by duration)
      const wAvg = (sv: number, wv: number) => totalDuration > 0 ? (sv * s.duration + wv * w.duration) / totalDuration : 0

      const combined: MsnDataWithSeasons = {
        ...s,
        // Per-month: weighted average of both seasons
        mgh: wAvg(s.mgh, w.mgh),
        bhSold: wAvg(s.bhSold, w.bhSold),
        bhActual: wAvg(s.bhActual, w.bhActual),
        fh: wAvg(s.fh, w.fh),
        fc: wAvg(s.fc, w.fc),
        cycleRatio: wAvg(s.cycleRatio, w.cycleRatio),
        acmiRate: wAvg(s.acmiRate, w.acmiRate),
        duration: totalDuration,
        revenuePerMonth: wAvg(s.revenuePerMonth, w.revenuePerMonth),
        aircraft: wAvg(s.aircraft, w.aircraft),
        crew: wAvg(s.crew, w.crew),
        maintenance: wAvg(s.maintenance, w.maintenance),
        insurance: wAvg(s.insurance, w.insurance),
        doc: wAvg(s.doc, w.doc),
        otherCogs: wAvg(s.otherCogs, w.otherCogs),
        acmiCost: wAvg(s.acmiCost, w.acmiCost),
        totalCost: wAvg(s.acmiCost, w.acmiCost),
        overhead: wAvg(s.overhead, w.overhead),
        // Fixed costs: weighted average (for coverage calc)
        fixedCosts: {
          aircraft: wAvg(s.fixedCosts.aircraft, w.fixedCosts.aircraft),
          crew: wAvg(s.fixedCosts.crew, w.fixedCosts.crew),
          maintenance: wAvg(s.fixedCosts.maintenance, w.fixedCosts.maintenance),
          insurance: wAvg(s.fixedCosts.insurance, w.fixedCosts.insurance),
          doc: wAvg(s.fixedCosts.doc, w.fixedCosts.doc),
          overhead: wAvg(s.fixedCosts.overhead, w.fixedCosts.overhead),
        },
        // Totals: sum both seasons
        total: {
          revenue: s.total.revenue + w.total.revenue,
          bhSold: s.total.bhSold + w.total.bhSold,
          bhActual: s.total.bhActual + w.total.bhActual,
          fh: s.total.fh + w.total.fh,
          fc: s.total.fc + w.total.fc,
          aircraft: s.total.aircraft + w.total.aircraft,
          crew: s.total.crew + w.total.crew,
          maintenance: s.total.maintenance + w.total.maintenance,
          insurance: s.total.insurance + w.total.insurance,
          doc: s.total.doc + w.total.doc,
          otherCogs: s.total.otherCogs + w.total.otherCogs,
          acmiCost: s.total.acmiCost + w.total.acmiCost,
          totalCost: s.total.acmiCost + w.total.acmiCost,
          overhead: s.total.overhead + w.total.overhead,
        },
        // Keep separate season data for filtering
        summerData: s,
        winterData: w,
      }
      return combined
    }
    return computeMsnCosts(input, exchangeRate, bhFhRatioNum, apuFhRatioNum, crewDerived, costsDerived)
  })

  // ── Helper: pick season-filtered data for an MSN ──
  const getFilteredMsn = (d: MsnDataWithSeasons): MsnCostResult => {
    if (seasonFilter === 'summer' && d.summerData) return d.summerData
    if (seasonFilter === 'winter' && d.winterData) return d.winterData
    return d // combined / non-seasonal
  }

  // ── Active MSN (Per Month column) — uses season filter ──
  if (perMsnData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">Calculating...</p>
      </div>
    )
  }
  const activeRaw = perMsnData.find((d) => d.msn === selectedMsn) ?? perMsnData[0]
  const activeMsn = getFilteredMsn(activeRaw)
  const activeInput = msnInputs.find((i) => i.msn === activeMsn?.msn)

  const activeCondition = activeInput
    ? activeInput.leaseType.charAt(0).toUpperCase() + activeInput.leaseType.slice(1) + ' Lease'
    : '-'

  // ── Total Project (all MSNs aggregated, with proration) — uses season filter ──
  const filteredMsnData = perMsnData.map(getFilteredMsn)

  const totalProjectDuration = numAc === 1
    ? filteredMsnData[0].duration
    : Math.max(...filteredMsnData.map((d) => d.duration))

  const totalMgh = filteredMsnData.reduce((s, d) => s + d.mgh, 0)

  const totalProjectRevenue = filteredMsnData.reduce((s, d) => s + d.total.revenue, 0)
  const totalProjectBhSold = filteredMsnData.reduce((s, d) => s + d.total.bhSold, 0)
  const totalProjectBhActual = filteredMsnData.reduce((s, d) => s + d.total.bhActual, 0)
  const totalProjectFh = filteredMsnData.reduce((s, d) => s + d.total.fh, 0)
  const totalProjectFc = filteredMsnData.reduce((s, d) => s + d.total.fc, 0)

  // ── Fixed Cost Coverage: per-MSN coverage% × monthly fixed cost × months ──
  // Coverage always uses combined (unfiltered) data — it's a total-project adjustment
  let covAircraft = 0, covCrew = 0, covMaint = 0, covInsurance = 0, covDoc = 0, covOverhead = 0
  for (let idx = 0; idx < msnInputs.length; idx++) {
    const inp = msnInputs[idx]
    if (!inp.fixedCostCoverageEnabled) continue
    const pct = (parseFloat(inp.fixedCostCoveragePercent) || 0) / 100
    const months = parseFloat(inp.fixedCostCoverageMonths) || 0
    const d = perMsnData[idx] // use combined data for coverage calc
    covAircraft += d.fixedCosts.aircraft * pct * months
    covCrew += d.fixedCosts.crew * pct * months
    covMaint += d.fixedCosts.maintenance * pct * months
    covInsurance += d.fixedCosts.insurance * pct * months
    covDoc += d.fixedCosts.doc * pct * months
    covOverhead += d.fixedCosts.overhead * pct * months
  }

  // When filtering by season, only include coverage in 'total' view
  const includeCoverage = seasonFilter === 'total'

  const tAircraftAbs = filteredMsnData.reduce((s, d) => s + d.total.aircraft, 0) + (includeCoverage ? covAircraft : 0)
  const tCrewAbs = filteredMsnData.reduce((s, d) => s + d.total.crew, 0) + (includeCoverage ? covCrew : 0)
  const tMaintAbs = filteredMsnData.reduce((s, d) => s + d.total.maintenance, 0) + (includeCoverage ? covMaint : 0)
  const tInsuranceAbs = filteredMsnData.reduce((s, d) => s + d.total.insurance, 0) + (includeCoverage ? covInsurance : 0)
  const tDocAbs = filteredMsnData.reduce((s, d) => s + d.total.doc, 0) + (includeCoverage ? covDoc : 0)
  const tAcmiCostAbs = tAircraftAbs + tCrewAbs + tMaintAbs + tInsuranceAbs + tDocAbs
    + filteredMsnData.reduce((s, d) => s + d.total.otherCogs, 0)
  const tOverheadAbs = filteredMsnData.reduce((s, d) => s + d.total.overhead, 0) + (includeCoverage ? covOverhead : 0)
  const totalProjectCost = tAcmiCostAbs
  const totalProjectGrossProfit = totalProjectRevenue - totalProjectCost
  const totalProjectNetProfit = totalProjectGrossProfit - tOverheadAbs

  // Display values
  const leaseTypes = [...new Set(msnInputs.map((i) => i.leaseType))]
  const totalCondition = leaseTypes.length === 1
    ? leaseTypes[0].charAt(0).toUpperCase() + leaseTypes[0].slice(1) + ' Lease'
    : 'Mixed'

  // ── EUR/BH helpers ──
  const isPerBh = displayMode === 'eurPerBh'
  const isTotalView = selectedMsn === null
  const activeBh = isTotalView
    ? (totalMgh || 1)
    : (activeMsn.bhActual || 1)

  // ── Display totals: per-MSN totals when a specific MSN is selected, project totals when "Total" ──
  const dRevenue = isTotalView ? totalProjectRevenue : activeMsn.total.revenue
  const dBhSold = isTotalView ? totalProjectBhSold : activeMsn.total.bhSold
  const dBhActual = isTotalView ? totalProjectBhActual : activeMsn.total.bhActual
  const dFh = isTotalView ? totalProjectFh : activeMsn.total.fh
  const dFc = isTotalView ? totalProjectFc : activeMsn.total.fc
  const dAircraft = isTotalView ? tAircraftAbs : activeMsn.total.aircraft
  const dCrew = isTotalView ? tCrewAbs : activeMsn.total.crew
  const dMaint = isTotalView ? tMaintAbs : activeMsn.total.maintenance
  const dInsurance = isTotalView ? tInsuranceAbs : activeMsn.total.insurance
  const dDoc = isTotalView ? tDocAbs : activeMsn.total.doc
  const dAcmiCost = isTotalView ? tAcmiCostAbs : activeMsn.total.acmiCost
  const dTotalCost = isTotalView ? totalProjectCost : activeMsn.total.totalCost
  const dOverhead = isTotalView ? tOverheadAbs : activeMsn.total.overhead
  const dGrossProfit = isTotalView ? totalProjectGrossProfit : (dRevenue - dTotalCost)
  const dNetProfit = isTotalView ? totalProjectNetProfit : (dGrossProfit - dOverhead)
  const dBhForPerBh = dBhActual || 1

  /** Format a monetary value — in EUR/BH mode divides by block hours */
  const fmtV = (monthlyVal: number, totalVal: number, decimals = 0): { perMonth: string; totalProject: string } => {
    if (isPerBh) {
      return {
        perMonth: fmt(monthlyVal / activeBh, 0),
        totalProject: fmt(totalVal / dBhForPerBh, 0),
      }
    }
    return {
      perMonth: fmt(monthlyVal, decimals),
      totalProject: fmt(totalVal, decimals),
    }
  }

  // ── Per-month values: use weighted average across MSNs in total view ──
  const mMonthly = isTotalView
    ? totalMgh / numAc  // average MGH per month across MSNs
    : activeMsn.mgh
  const mRevenue = isTotalView
    ? filteredMsnData.reduce((s, d) => s + d.revenuePerMonth, 0)
    : activeMsn.revenuePerMonth
  const mAircraft = isTotalView ? filteredMsnData.reduce((s, d) => s + d.aircraft, 0) : activeMsn.aircraft
  const mCrew = isTotalView ? filteredMsnData.reduce((s, d) => s + d.crew, 0) : activeMsn.crew
  const mMaint = isTotalView ? filteredMsnData.reduce((s, d) => s + d.maintenance, 0) : activeMsn.maintenance
  const mInsurance = isTotalView ? filteredMsnData.reduce((s, d) => s + d.insurance, 0) : activeMsn.insurance
  const mDoc = isTotalView ? filteredMsnData.reduce((s, d) => s + d.doc, 0) : activeMsn.doc
  const mAcmiCost = isTotalView ? filteredMsnData.reduce((s, d) => s + d.acmiCost, 0) : activeMsn.acmiCost
  const mTotalCost = isTotalView ? filteredMsnData.reduce((s, d) => s + d.totalCost, 0) : activeMsn.totalCost
  const mOverhead = isTotalView ? filteredMsnData.reduce((s, d) => s + d.overhead, 0) : activeMsn.overhead
  const mGrossProfit = mRevenue - mTotalCost
  const mNetProfit = mGrossProfit - mOverhead
  const mBhSold = isTotalView ? filteredMsnData.reduce((s, d) => s + d.bhSold, 0) : activeMsn.bhSold
  const mBhActual = isTotalView ? filteredMsnData.reduce((s, d) => s + d.bhActual, 0) : activeMsn.bhActual
  const mFh = isTotalView ? filteredMsnData.reduce((s, d) => s + d.fh, 0) : activeMsn.fh
  const mFc = isTotalView ? filteredMsnData.reduce((s, d) => s + d.fc, 0) : activeMsn.fc

  // ── Build rows ──
  const rows: SummaryRow[] = [
    { label: 'Customer', perMonth: projectName || 'Untitled', totalProject: projectName || 'Untitled' },
    { label: 'Condition', perMonth: isTotalView ? totalCondition : activeCondition, totalProject: isTotalView ? totalCondition : activeCondition },
    { label: 'MSN', perMonth: isTotalView ? `All (${numAc})` : String(activeMsn.msn), totalProject: isTotalView ? `All (${numAc})` : String(activeMsn.msn) },
    { label: '# of AC', perMonth: isTotalView ? String(numAc) : '1', totalProject: isTotalView ? String(numAc) : '1' },
    { label: 'MGH', perMonth: fmt(isTotalView ? totalMgh : activeMsn.mgh, 0), totalProject: fmt(dBhSold, 0) },
    { label: 'Cycle Ratio', perMonth: isTotalView ? '-' : activeMsn.cycleRatio.toFixed(1), totalProject: isTotalView ? '-' : activeMsn.cycleRatio.toFixed(1) },
    { label: 'Duration', perMonth: isTotalView ? String(totalProjectDuration) : String(activeMsn.duration), totalProject: isTotalView ? String(totalProjectDuration) : String(activeMsn.duration) },
    { label: '', perMonth: '', totalProject: '', isSeparator: true },
    { label: 'BH - Sold', perMonth: fmt(mBhSold, 0), totalProject: fmt(dBhSold, 0) },
    { label: 'BH - Actual', perMonth: fmt(mBhActual, 0), totalProject: fmt(dBhActual, 0) },
    { label: 'FH - Actual', perMonth: fmt(mFh, 0), totalProject: fmt(dFh, 0) },
    { label: 'FC', perMonth: fmt(mFc, 0), totalProject: fmt(dFc, 0) },
    { label: '', perMonth: '', totalProject: '', isSeparator: true },
    { label: 'ACMI Rate', perMonth: isTotalView ? '-' : fmt(activeMsn.acmiRate, 0), totalProject: isTotalView ? '-' : fmt(activeMsn.acmiRate, 0), isRate: true },
    { label: 'Total Revenue', ...fmtV(mRevenue, dRevenue), isBold: true, colorClass: 'text-green-400', colorClassTotal: 'text-green-400' },
    { label: '', perMonth: '', totalProject: '', isSeparator: true },
    { label: 'Aircraft', ...fmtV(mAircraft, dAircraft) },
    { label: 'Crew', ...fmtV(mCrew, dCrew) },
    { label: 'Maintenance', ...fmtV(mMaint, dMaint) },
    { label: 'Insurance', ...fmtV(mInsurance, dInsurance) },
    { label: 'DOC', ...fmtV(mDoc, dDoc) },
    { label: 'ACMI Cost', ...fmtV(mAcmiCost, dAcmiCost), isBold: true },
    { label: '', perMonth: '', totalProject: '', isSeparator: true },
    { label: 'TOTAL Cost', ...fmtV(mTotalCost, dTotalCost), isBold: true },
    { label: 'Gross Profit', ...fmtV(mGrossProfit, dGrossProfit), isBold: true, colorClass: mGrossProfit >= 0 ? 'text-green-400' : 'text-red-400', colorClassTotal: dGrossProfit >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Overhead', ...fmtV(mOverhead, dOverhead) },
    { label: 'Net Profit', ...fmtV(mNetProfit, dNetProfit), isBold: true, colorClass: mNetProfit >= 0 ? 'text-green-400' : 'text-red-400', colorClassTotal: dNetProfit >= 0 ? 'text-green-400' : 'text-red-400' },
  ]

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      {/* MSN Selector — only shown when multiple aircraft */}
      {numAc > 1 && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-100/40 dark:bg-gray-800/40 border-b border-gray-300 dark:border-gray-700">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">MSN:</span>
          <button
            onClick={() => setSelectedMsn(null)}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
              selectedMsn === null
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-800 dark:text-gray-200'
            }`}
          >
            Total
          </button>
          {msnInputs.map((input) => (
            <button
              key={input.msn}
              onClick={() => setSelectedMsn(input.msn)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                selectedMsn === input.msn
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-800 dark:text-gray-200'
              }`}
            >
              {input.msn}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-[1fr_90px_90px] bg-gray-100/60 dark:bg-gray-800/60 border-b border-gray-300 dark:border-gray-700">
        <div className="px-3 py-1.5 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Summary</span>
          <div className="flex bg-gray-200 dark:bg-gray-700 rounded-md p-0.5">
            <button
              onClick={() => setDisplayMode('eur')}
              className={`px-1.5 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                displayMode === 'eur'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200'
              }`}
            >
              EUR
            </button>
            <button
              onClick={() => setDisplayMode('eurPerBh')}
              className={`px-1.5 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                displayMode === 'eurPerBh'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200'
              }`}
            >
              EUR/BH
            </button>
          </div>
          {/* Season filter — only shown when any MSN has seasonality enabled */}
          {msnInputs.some((i) => i.seasonalityEnabled) && (
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-md p-0.5">
              {(['total', 'summer', 'winter'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSeasonFilter(f)}
                  className={`px-1.5 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                    seasonFilter === f
                      ? f === 'summer' ? 'bg-amber-500 text-white' : f === 'winter' ? 'bg-sky-500 text-white' : 'bg-indigo-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {f === 'total' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-right">
          Monthly
        </div>
        <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-right">
          Total
        </div>
      </div>

      {/* Body */}
      <div className={isCalculating ? 'opacity-60' : ''}>
        {rows.map((row, idx) => {
          if (row.isSeparator) {
            return <div key={idx} className="h-px bg-gray-200 dark:bg-gray-700/40" />
          }
          return (
            <div
              key={idx}
              className={`grid grid-cols-[1fr_90px_90px] ${row.isBold ? 'bg-gray-100/30 dark:bg-gray-800/30' : ''}`}
            >
              <div className={`px-3 py-[3px] text-xs ${row.isBold ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                {row.label}
              </div>
              <div className={`px-2 py-[3px] text-xs text-right font-mono ${row.colorClass ?? (row.isBold ? 'text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-800 dark:text-gray-200')}`}>
                {row.perMonth}
              </div>
              <div className={`px-2 py-[3px] text-xs text-right font-mono ${(row.colorClassTotal ?? row.colorClass) ?? (row.isBold ? 'text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-800 dark:text-gray-200')}`}>
                {row.totalProject}
              </div>
            </div>
          )
        })}
      </div>

      {isCalculating && (
        <div className="px-2 py-1 text-[10px] text-indigo-600 dark:text-indigo-400 bg-gray-100/40 dark:bg-gray-800/40 text-center">
          Calculating...
        </div>
      )}
    </div>
  )
}
