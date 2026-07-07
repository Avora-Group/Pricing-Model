'use client'

import { useEffect, useState } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import type { MsnInput } from '@/stores/pricing-store'
import { computePeriodMonths, generateMonthRange } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { fmt } from '@/lib/format'
import { interpolateEpr } from '@/lib/pnl-engine'
import { pickAircraftRates } from '@/lib/aircraft-rate-basis'
import { buildMonthDayInfos } from '@/lib/pnl-proration'
import { periodBhWeightsFromStrings } from '@/lib/mgh-distribution'
import { LineDetailPopover, type BreakdownItem } from './CostDetailPopover'
import { useCanViewCosts, useCanViewNaked } from '@/providers/CostVisibilityProvider'
import { Redacted } from '@/components/common/Redacted'
import type { AircraftOption } from '@/lib/api-converters'


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
  // When true (and the aircraft has naked rates), price the Aircraft component
  // on the naked cost basis instead of current.
  useNaked = false,
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
  // Current vs naked aircraft cost basis (shared with the P&L engine).
  const ar = pickAircraftRates(input, useNaked)
  const dryLease = ar.leaseRentEur
  const maintReservesFixed = ar.sixYearCheckEur + ar.twelveYearCheckEur + ar.ldgEur
  const eprRate = interpolateEpr(ar.eprMatrix, cycleRatio, input.environment)
  const eprMr = eprRate * 2 * fh * exchangeRate
  const llpMr = (ar.llp1RateUsd + ar.llp2RateUsd) * fc * exchangeRate
  const apuMr = ar.apuRateUsd * apuFh * exchangeRate
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
  // Period MGH mode: per-month BH weights (else BH-side prorates by day fraction,
  // identical to the P&L engine). Kept in lock-step with buildMonthlyData.
  const bhWeights = (input.mghMode ?? 'month') === 'period'
    ? periodBhWeightsFromStrings(months, input.periodStart, input.periodEnd)
    : undefined

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
    // BH-side factor: period-mode month share (final), else the day fraction.
    const bhFactor = bhWeights ? bhWeights[m] : df

    // MGH block hours scale by bhFactor; excess is a per-month value by days.
    const monthMgh = mgh * bhFactor
    const monthExcess = excessBh * df
    const monthTotalBh = monthMgh + monthExcess
    const monthFh = bhFhRatio > 0 ? monthTotalBh / bhFhRatio : 0

    tRevenue += acmiRate * monthMgh + monthExcess * excessHourRate
    tBhSold += monthMgh
    tBhActual += monthTotalBh
    tFh += monthFh
    tFc += cycleRatio > 0 ? monthFh / cycleRatio : 0

    // Aircraft: fixed (dryLease, maintReservesFixed) by day fraction; reserves
    // variable (BH-proportional) by bhFactor.
    tAircraft += (dryLease + maintReservesFixed) * df + maintReservesVariable * bhFactor

    // Crew: fixed salaries/uniform/training * df + per diems (crew day fraction);
    // the BH bonus is BH-proportional.
    tCrew += crewFixed * df
      + pilotPerDiem_perDiem * cdf + pilotPerDiem_bhBonus * bhFactor
      + cabinCrewPerDiem * cdf
      + crew.accomTravelCPerMonth * df

    // Maintenance: fixed (line, base, salary, training, cCheck) * df; spare parts
    // BH-proportional; tires/wheels + personnel per-diem by day fraction.
    tMaint += maintFixed * df
      + totalBh * costs.sparePartsRatePerBh * bhFactor + costs.tiresWheelsCost * df
      + costs.maintPerDiemVal * df

    // Insurance: fixed, prorated by days
    tInsurance += insurance * df

    // DOC: all prorated by days
    tDoc += (costs.fuelVal + costs.handlingVal + costs.navigationVal + costs.airportChargesVal) * df
      + (costs.technicalVal + costs.otherFixedVal) * df

    // Commissions: BH-proportional with season
    const calMonth = months[m].month
    const isSummer = calMonth >= 5 && calMonth <= 10
    tOtherCogs += (isSummer ? costs.commissionWinterRate : costs.commissionSummerRate) * monthTotalBh

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
    // Per-month sub-component build-up for the drill-down popover.
    parts: {
      aircraft: {
        'Dry Lease': dryLease,
        'Maint. Reserves — Fixed': maintReservesFixed,
        'Maint. Reserves — Variable': maintReservesVariable,
      },
      crew: {
        'Pilot Salary': pilotSalary,
        'Cabin Crew Salary': cabinCrewSalary,
        'Uniform': crew.uniformPerMonth,
        'Training': crew.trainingPerMonth,
        'Pilot Per Diem': pilotPerDiem,
        'Cabin Crew Per Diem': cabinCrewPerDiem,
        'Accom & Travel': crew.accomTravelCPerMonth,
      },
      maintenance: {
        'Spare Parts': spareParts,
        'Personnel Per Diems': costs.maintPerDiemVal,
        'Line Maintenance': costs.lineMaintenanceVal,
        'Base Maintenance': costs.baseMaintenanceVal,
        'Personnel Salary': costs.maintPersonnelSalaryVal,
        'Training': costs.trainningVal,
        'C-Check': costs.cCheckVal,
      },
      doc: {
        'Fuel': costs.fuelVal,
        'Handling': costs.handlingVal,
        'Navigation': costs.navigationVal,
        'Airport Charges': costs.airportChargesVal,
        'Technical': costs.technicalVal,
        'Other Fixed': costs.otherFixedVal,
      },
      overhead: {
        'Overhead (base)': baseOverhead,
        'MXC commission': mxcCommission,
      },
      insurance: {
        'Insurance premium': insurance,
      },
    } as Record<string, Record<string, number>>,
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

export function SummaryTable({
  aircraftList = [],
  editable = true,
}: {
  aircraftList?: AircraftOption[]
  /** When false (e.g. viewers), the exchange rate + project name render read-only. */
  editable?: boolean
} = {}) {
  const canViewCosts = useCanViewCosts()
  const canViewNaked = useCanViewNaked()
  const {
    exchangeRate: globalExchangeRate,
    bhFhRatio: globalBhFhRatio,
    apuFhRatio: globalApuFhRatio,
    projectName,
    setProjectName,
    setExchangeRate,
    msnInputs,
    selectedMsn,
    setSelectedMsn,
    isCalculating,
    rateBasis,
    setRateBasis,
    patchMsnInput,
  } = usePricingStore()

  // Naked cost basis is honored only for users with naked access.
  const useNaked = canViewNaked && rateBasis === 'naked'

  // Backfill naked rates onto MSNs that lack them (e.g. loaded from a saved
  // quote) using the current aircraft master data, for naked-access users.
  useEffect(() => {
    if (!canViewNaked || aircraftList.length === 0) return
    for (const input of msnInputs) {
      if (input.hasNakedRates !== undefined) continue
      const ac =
        aircraftList.find((a) => a.id === input.aircraftId) ??
        aircraftList.find((a) => a.msn === input.msn)
      if (!ac) continue
      patchMsnInput(input.msn, {
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
      })
    }
  }, [msnInputs, aircraftList, canViewNaked, patchMsnInput])

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

  const [currency, setCurrency] = useState<'eur' | 'usd'>('eur')
  const [seasonFilter, setSeasonFilter] = useState<'total' | 'summer' | 'winter'>('total')
  const [drill, setDrill] = useState<{ cat: string; rect: DOMRect } | null>(null)

  const exchangeRate = parseFloat(globalExchangeRate || '0.85')
  // Values are computed in EUR; EUR = USD × exchangeRate, so EUR → USD divides
  // by the rate. Guard against a zero/blank rate.
  const curFactor = currency === 'usd' && exchangeRate > 0 ? 1 / exchangeRate : 1
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

  // Note: when no MSN has seasonality the season toggle is not rendered, so a
  // stale non-'total' filter can never be reached from the UI; getFilteredMsn
  // also falls back to combined data when a season's data is absent — so no
  // effect is needed to reset it.

  if (msnInputs.length === 0) {
    return (
      <div className="av-panel p-4 text-center">
        <p className="text-xs text-[var(--text-muted)]">
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
      const s = computeMsnCosts(summerInput, exchangeRate, bhFhRatioNum, apuFhRatioNum, crewDerived, costsDerived, useNaked)
      const w = computeMsnCosts(winterInput, exchangeRate, bhFhRatioNum, apuFhRatioNum, crewDerived, costsDerived, useNaked)
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
    return computeMsnCosts(input, exchangeRate, bhFhRatioNum, apuFhRatioNum, crewDerived, costsDerived, useNaked)
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
      <div className="av-panel p-4 text-center">
        <p className="text-xs text-[var(--text-muted)]">Calculating...</p>
      </div>
    )
  }
  const activeRaw = perMsnData.find((d) => d.msn === selectedMsn) ?? perMsnData[0]
  const activeMsn = getFilteredMsn(activeRaw)
  // ── Total Project (all MSNs aggregated, with proration) — uses season filter ──
  const filteredMsnData = perMsnData.map(getFilteredMsn)

  const totalProjectDuration = numAc === 1
    ? filteredMsnData[0].duration
    : Math.max(...filteredMsnData.map((d) => d.duration))

  const totalMgh = filteredMsnData.reduce((s, d) => s + d.mgh, 0)

  const isTotalView0 = selectedMsn === null
  // Contract term (months) — denominator for the average-monthly figures below.
  const periodMonths = isTotalView0 ? totalProjectDuration : activeMsn.duration

  // Prorated PROJECT TOTALS per category (partial months already day-scaled in
  // `.total`, identical to the P&L engine). The displayed "monthly" figures are
  // derived as total / periodMonths so that monthly × months === project total
  // === P&L. For full-month projects this equals the plain monthly figure.
  const totOf = (pick: (t: (typeof filteredMsnData)[number]['total']) => number): number =>
    isTotalView0
      ? filteredMsnData.reduce((s, d) => s + pick(d.total), 0)
      : pick(activeMsn.total)
  const perMo = (v: number) => (periodMonths > 0 ? v / periodMonths : 0)

  // ── EUR/BH helpers ──
  // Per-BH display toggle removed; cost figures are always shown as monthly
  // totals (the cost breakdown already has a dedicated per-BH column).
  const isPerBh = false
  const isTotalView = selectedMsn === null
  const activeBh = isTotalView
    ? (totalMgh || 1)
    : (activeMsn.bhActual || 1)

  // ── Per-month values = prorated project total / periodMonths ──
  // (Average monthly over the term; matches P&L because monthly × months uses
  //  the same day-prorated totals. Full-month projects are unchanged.)
  const mRevenue = perMo(totOf((t) => t.revenue))
  const mAircraft = perMo(totOf((t) => t.aircraft))
  const mCrew = perMo(totOf((t) => t.crew))
  const mMaint = perMo(totOf((t) => t.maintenance))
  const mInsurance = perMo(totOf((t) => t.insurance))
  const mDoc = perMo(totOf((t) => t.doc))
  const mAcmiCost = perMo(totOf((t) => t.acmiCost))
  const mOverhead = perMo(totOf((t) => t.overhead))
  // totalCost excludes overhead (ACMI cost only), matching `.total.totalCost`.
  const mTotalCost = mAcmiCost
  const mGrossProfit = mRevenue - mAcmiCost
  const mNetProfit = mGrossProfit - mOverhead
  const mBhActual = perMo(totOf((t) => t.bhActual))
  const mFc = perMo(totOf((t) => t.fc))

  // Blended ACMI rate (weighted by MGH) for the Total view; a single MSN uses its own rate.
  const totalAcmiWeighted = (() => {
    let num = 0, den = 0
    for (const d of filteredMsnData) { num += d.acmiRate * d.mgh; den += d.mgh }
    return den > 0 ? num / den : 0
  })()
  const acmiRateDisplay = isTotalView ? totalAcmiWeighted : activeMsn.acmiRate

  const mOtherCogs = perMo(totOf((t) => t.otherCogs))

  // Sub-component build-up for the active scope (summed across MSNs in Total view).
  const scopeParts: Record<string, Record<string, number>> = (() => {
    if (!isTotalView) return activeMsn.parts
    const acc: Record<string, Record<string, number>> = {}
    for (const d of filteredMsnData) {
      for (const cat in d.parts) {
        acc[cat] = acc[cat] ?? {}
        for (const k in d.parts[cat]) acc[cat][k] = (acc[cat][k] ?? 0) + d.parts[cat][k]
      }
    }
    return acc
  })()

  // Build drill-down popover content for a category, honouring currency + /BH mode.
  const buildDrill = (catKey: string): { title: string; items: BreakdownItem[] } | null => {
    const pv = (v: number) => (isPerBh ? (v * curFactor) / activeBh : v * curFactor)
    if (catKey === 'acmiCost') {
      return {
        title: 'ACMI Cost',
        items: [
          { label: 'Aircraft', value: pv(mAircraft) },
          { label: 'Crew', value: pv(mCrew) },
          { label: 'Maintenance', value: pv(mMaint) },
          { label: 'Insurance', value: pv(mInsurance) },
          { label: 'DOC', value: pv(mDoc) },
          { label: 'Other COGS', value: pv(mOtherCogs) },
        ],
      }
    }
    const obj = scopeParts[catKey]
    if (!obj) return null
    const titles: Record<string, string> = {
      aircraft: 'Aircraft', crew: 'Crew', maintenance: 'Maintenance',
      doc: 'DOC', overhead: 'Overhead', insurance: 'Insurance',
    }
    return {
      title: titles[catKey] ?? catKey,
      items: Object.entries(obj).map(([label, v]) => ({ label, value: pv(v) })),
    }
  }

  // (periodMonths computed above — contract term / denominator for monthly figures)

  // ── Monthly block hours (MGH-based, incl. excess) for the "Per BH" column ──
  const monthlyBh = mBhActual

  // Display transforms honour the currency toggle. The dedicated Per-BH column
  // always divides monthly value by monthly block hours, independent of the
  // header's absolute/per-BH toggle (which still drives the "€ / month" column
  // exactly as before so no live number changes for existing users).
  const cur = (v: number) => v * curFactor

  /** € / month column — mirrors the old fmtV per-month behaviour. */
  const fmtMonth = (monthlyVal: number, decimals = 0): string =>
    isPerBh ? fmt(cur(monthlyVal) / activeBh, 0) : fmt(cur(monthlyVal), decimals)

  /** Project total = monthly value × period months. */
  const fmtProjectTotal = (monthlyVal: number): string => {
    if (!(periodMonths > 0)) return '—'
    return fmt(cur(monthlyVal) * periodMonths, 0)
  }

  /** Per BH = monthly value ÷ monthly block hours. Em dash if unavailable. */
  const fmtPerBh = (monthlyVal: number): string => {
    if (!(monthlyBh > 0)) return '—'
    return fmt(cur(monthlyVal) / monthlyBh, 0)
  }

  /** % of monthly revenue. Em dash if no revenue. */
  const fmtPctRev = (monthlyVal: number): string => {
    if (!(mRevenue > 0)) return '—'
    return `${((monthlyVal / mRevenue) * 100).toFixed(0)}%`
  }

  // ── Verdict metrics (from already-computed monthly + project figures) ──
  const netMargin = mRevenue > 0 ? mNetProfit / mRevenue : 0
  const gpMargin = mRevenue > 0 ? mGrossProfit / mRevenue : 0
  const projectNet = mNetProfit * (periodMonths > 0 ? periodMonths : 1)
  const marginTone = (m: number) =>
    m >= 0.1 ? 'var(--pos)' : m >= 0.02 ? 'var(--amber)' : 'var(--neg)'
  const flag =
    netMargin >= 0.1
      ? { cls: 'av-vf-good', text: `Healthy deal — ${(netMargin * 100).toFixed(1)}% net margin clears the 10% hurdle` }
      : netMargin >= 0.02
        ? { cls: 'av-vf-thin', text: `Thin margin — ${(netMargin * 100).toFixed(1)}% net, below the 10% hurdle. Review rate or utilisation` }
        : { cls: 'av-vf-loss', text: `Loss-making at this rate — ${(netMargin * 100).toFixed(1)}% net. Do not release` }

  // ── Waterfall (revenue → cost stack → net), all monthly, currency-adjusted ──
  const wfSteps: { lab: string; v: number; cls: 'rev' | 'cost' | 'net' }[] = [
    { lab: 'Revenue', v: cur(mRevenue), cls: 'rev' },
    { lab: 'Aircraft', v: cur(mAircraft), cls: 'cost' },
    { lab: 'Crew', v: cur(mCrew), cls: 'cost' },
    { lab: 'Maint.', v: cur(mMaint), cls: 'cost' },
    { lab: 'Insurance', v: cur(mInsurance), cls: 'cost' },
    { lab: 'DOC', v: cur(mDoc), cls: 'cost' },
    { lab: 'Overhead', v: cur(mOverhead), cls: 'cost' },
    { lab: 'Net', v: cur(mNetProfit), cls: 'net' },
  ]
  const wfMax = Math.max(cur(mRevenue) * 1.05, 1)
  let wfRun = 0
  const wfBars = wfSteps.map((s, i) => {
    let barH: number, floatBottom: number
    if (i === 0) { barH = (s.v / wfMax) * 100; floatBottom = 0; wfRun = s.v }
    else if (i === wfSteps.length - 1) { barH = (Math.abs(s.v) / wfMax) * 100; floatBottom = s.v >= 0 ? 0 : (s.v / wfMax) * 100; wfRun = s.v }
    else { wfRun -= s.v; barH = (s.v / wfMax) * 100; floatBottom = (wfRun / wfMax) * 100 }
    const neg = s.cls === 'net' && s.v < 0
    return { ...s, barH: Math.max(barH, 1.5), floatBottom: Math.max(floatBottom, 0), neg }
  })

  // Compact figure label for the waterfall bars (e.g. 1.2M / 340k).
  const compact = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${Math.round(v / 1_000)}k`
    return fmt(v, 0)
  }

  // ── Cost build-up rows (colour swatches mirror the prototype) ──
  const costLines: { n: string; v: number; sw: string; drillKey?: string }[] = [
    { n: 'Aircraft (lease + reserves)', v: mAircraft, sw: '#e08a8a', drillKey: 'aircraft' },
    { n: 'Crew', v: mCrew, sw: '#e5a3a3', drillKey: 'crew' },
    { n: 'Maintenance', v: mMaint, sw: '#eab5b5', drillKey: 'maintenance' },
    { n: 'Insurance', v: mInsurance, sw: '#f0c8c8', drillKey: 'insurance' },
    { n: 'DOC', v: mDoc, sw: '#f4d6d6', drillKey: 'doc' },
  ]

  // ── Rate sensitivity: net margin across a ±rate band. Revenue moves linearly
  // with the ACMI rate (revenue = rate × MGH + excess), so we shift the already-
  // computed monthly revenue by Δrate × monthly MGH — no pricing formula is
  // re-derived; costs/overhead are held at their computed monthly values. ──
  const sensMgh = isTotalView ? totalMgh : activeMsn.mgh
  const baseRate = acmiRateDisplay
  const sensBand = [-150, -100, -50, 0, 50, 100, 150]
  const sens = sensBand.map((d) => {
    const rev = mRevenue + d * sensMgh
    const net = rev - mTotalCost - mOverhead
    const m = rev > 0 ? net / rev : 0
    return { rate: baseRate + d, m, net: cur(net), cur: d === 0 }
  })

  const bdUnit = currency === 'usd' ? 'USD' : 'EUR'

  return (
    <div className={`flex flex-col gap-[18px] transition-opacity ${isCalculating ? 'opacity-60' : ''}`}>
      {/* ── Scope + display controls ── */}
      <div className="av-panel">
        <div className="av-card-b flex items-center gap-2 flex-wrap" style={{ padding: '12px 16px' }}>
          {/* Scope: Total / per-MSN */}
          <div className="av-seg" style={{ flex: 'unset' }}>
            <button
              className={selectedMsn === null ? 'on' : ''}
              onClick={() => setSelectedMsn(null)}
              style={{ padding: '6px 12px' }}
            >
              Total
            </button>
            {msnInputs.map((input) => (
              <button
                key={input.msn}
                className={selectedMsn === input.msn ? 'on' : ''}
                onClick={() => setSelectedMsn(input.msn)}
                style={{ padding: '6px 12px' }}
              >
                <span className="av-num">{input.msn}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Season filter */}
            {msnInputs.some((i) => i.seasonalityEnabled) && (
              <div className="av-seg" style={{ flex: 'unset' }}>
                {(['total', 'summer', 'winter'] as const).map((f) => (
                  <button key={f} className={seasonFilter === f ? 'on' : ''} onClick={() => setSeasonFilter(f)} style={{ padding: '6px 12px' }}>
                    {f === 'total' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}
            {/* USD / EUR exchange rate */}
            <label className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
              USD/EUR
              <input
                type="number"
                step="0.0001"
                value={globalExchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                readOnly={!editable}
                tabIndex={editable ? undefined : -1}
                className="av-input av-num"
                style={{ width: 76, padding: '5px 8px' }}
              />
            </label>
            {/* Currency */}
            <div className="av-seg" style={{ flex: 'unset' }}>
              {(['eur', 'usd'] as const).map((c) => (
                <button key={c} className={currency === c ? 'on' : ''} onClick={() => setCurrency(c)} style={{ padding: '6px 12px' }}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Cost basis — naked-access users only */}
            {canViewNaked && (
              <div className="av-seg" style={{ flex: 'unset' }}>
                {(['current', 'naked'] as const).map((b) => (
                  <button
                    key={b}
                    className={rateBasis === b ? 'on' : ''}
                    onClick={() => setRateBasis(b)}
                    style={{ padding: '6px 12px', textTransform: 'capitalize' }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Verdict ── */}
      <div className="av-panel overflow-hidden">
        <div className="av-verdict-top">
          {canViewCosts && (
            <div className="av-vcell">
              {/* Label + project name on one line (keeps value/subtitle aligned
                  with the Margin & Revenue cards). */}
              <div className="flex items-baseline gap-2">
                <span className="vlab whitespace-nowrap">Net profit · monthly</span>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  readOnly={!editable}
                  placeholder="Untitled project"
                  className="av-num bg-transparent border-0 p-0 focus:outline-none font-semibold"
                  style={{ color: 'var(--ink-2)', fontSize: 11, minWidth: 0, flex: '1 1 auto' }}
                  title="Project name"
                />
              </div>
              <div className="vval av-num" style={mNetProfit < 0 ? { color: 'var(--neg)' } : undefined}>
                {fmt(cur(mNetProfit), 0)} {bdUnit}
              </div>
              <div className="vsub av-num">
                {periodMonths > 0
                  ? `${fmt(cur(projectNet), 0)} over ${periodMonths}-month term`
                  : 'Set a contract term to see project total'}
              </div>
            </div>
          )}
          {canViewCosts && (
            <div className="av-vcell">
              <div className="vlab">Net margin</div>
              <div className="vval av-num" style={{ color: marginTone(netMargin) }}>
                {(netMargin * 100).toFixed(1)}%
              </div>
              <div className="vsub av-num">GP margin {(gpMargin * 100).toFixed(1)}%</div>
            </div>
          )}
          <div className="av-vcell">
            <div className="vlab">Monthly revenue</div>
            <div className="vval av-num">{fmt(cur(mRevenue), 0)} {bdUnit}</div>
            <div className="vsub av-num">{fmt(mBhActual, 0)} BH · {fmt(mFc, 0)} cycles</div>
          </div>
        </div>
        {/* Verdict flag exposes the net margin verdict — naked-cost only. */}
        {canViewCosts && <div className={`av-verdict-flag ${flag.cls}`}>{flag.text}</div>}
      </div>

      {/* ── Waterfall ── (naked cost build-up: hidden without permission) */}
      {canViewCosts && (
        <div className="av-panel">
          <div className="av-panel-h">
            <h2>ACMI cost build-up · monthly</h2>
            <span className="av-hint">Revenue → cost stack → net</span>
          </div>
          <div className="av-wf">
            {wfBars.map((s, i) => (
              <div className="av-wf-col" key={i}>
                <div
                  className={`av-wf-bar ${s.cls}${s.neg ? ' isneg' : ''}`}
                  style={{ height: `${s.barH}%`, marginBottom: `${s.floatBottom}%` }}
                >
                  <span className="av-wf-val av-num">{compact(s.v)}</span>
                </div>
                <div className="av-wf-lab">{s.lab}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cost build-up table (Line | € / month | Project total | Per BH | % rev) ── */}
      <div className="av-panel overflow-hidden">
        <div className="av-panel-h">
          <h2>Cost breakdown</h2>
          <span className="av-hint">
            monthly · project total ({periodMonths > 0 ? `${periodMonths} mo` : '—'}) · per block hour ({fmt(monthlyBh, 0)} BH)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="av-bd-tbl">
            <tbody>
              <tr className="head">
                <td>Line</td>
                <td className="r">{bdUnit} / month</td>
                <td className="r">Project total</td>
                <td className="r">Per BH</td>
                <td className="pct">% rev</td>
              </tr>

              {/* Total revenue */}
              <tr>
                <td>
                  <span className="cat"><span className="sw" style={{ background: 'var(--navy)' }} />Total revenue</span>
                </td>
                <td className="r av-num" style={{ color: 'var(--brand)' }}>{fmtMonth(mRevenue)}</td>
                <td className="r av-num">{fmtProjectTotal(mRevenue)}</td>
                <td className="r av-num">{fmtPerBh(mRevenue)}</td>
                <td className="pct av-num">{mRevenue > 0 ? '100%' : '—'}</td>
              </tr>

              {/* Cost lines — click to drill into the build-up (naked cost) */}
              {canViewCosts && costLines.map((r) => (
                <tr
                  key={r.n}
                  className="sub cursor-pointer"
                  onClick={r.drillKey ? (e) => setDrill({ cat: r.drillKey!, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }) : undefined}
                  title={r.drillKey ? 'Click to see the build-up' : undefined}
                >
                  <td>
                    <span className="cat"><span className="sw" style={{ background: r.sw }} />{r.n}</span>
                  </td>
                  <td className="r av-num">{fmtMonth(r.v)}</td>
                  <td className="r av-num">{fmtProjectTotal(r.v)}</td>
                  <td className="r av-num">{fmtPerBh(r.v)}</td>
                  <td className="pct av-num">{fmtPctRev(r.v)}</td>
                </tr>
              ))}

              {/* ACMI cost total (naked cost) */}
              {canViewCosts && (
                <tr
                  className="total cursor-pointer"
                  onClick={(e) => setDrill({ cat: 'acmiCost', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                  title="Click to see the build-up"
                >
                  <td>ACMI cost</td>
                  <td className="r av-num">{fmtMonth(mAcmiCost)}</td>
                  <td className="r av-num">{fmtProjectTotal(mAcmiCost)}</td>
                  <td className="r av-num">{fmtPerBh(mAcmiCost)}</td>
                  <td className="pct av-num">{fmtPctRev(mAcmiCost)}</td>
                </tr>
              )}

              {/* Gross profit (naked cost) */}
              {canViewCosts && (
                <tr>
                  <td>
                    <span className="cat"><span className="sw" style={{ background: 'var(--pos)' }} />Gross profit</span>
                  </td>
                  <td className={`r av-num ${mGrossProfit < 0 ? 'av-neg' : 'av-pos'}`}>{fmtMonth(mGrossProfit)}</td>
                  <td className={`r av-num ${mGrossProfit < 0 ? 'av-neg' : 'av-pos'}`}>{fmtProjectTotal(mGrossProfit)}</td>
                  <td className={`r av-num ${mGrossProfit < 0 ? 'av-neg' : 'av-pos'}`}>{fmtPerBh(mGrossProfit)}</td>
                  <td className="pct av-num">{fmtPctRev(mGrossProfit)}</td>
                </tr>
              )}

              {/* Overhead — click to drill (naked cost) */}
              {canViewCosts && (
                <tr
                  className="sub cursor-pointer"
                  onClick={(e) => setDrill({ cat: 'overhead', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                  title="Click to see the build-up"
                >
                  <td>Overhead</td>
                  <td className="r av-num">{fmtMonth(mOverhead)}</td>
                  <td className="r av-num">{fmtProjectTotal(mOverhead)}</td>
                  <td className="r av-num">{fmtPerBh(mOverhead)}</td>
                  <td className="pct av-num">{fmtPctRev(mOverhead)}</td>
                </tr>
              )}

              {/* Net profit (naked cost) */}
              {canViewCosts && (
                <tr className="total">
                  <td>Net profit</td>
                  <td className={`r av-num ${mNetProfit < 0 ? 'av-neg' : 'av-pos'}`}>{fmtMonth(mNetProfit)}</td>
                  <td className={`r av-num ${mNetProfit < 0 ? 'av-neg' : 'av-pos'}`}>{fmtProjectTotal(mNetProfit)}</td>
                  <td className={`r av-num ${mNetProfit < 0 ? 'av-neg' : 'av-pos'}`}>{fmtPerBh(mNetProfit)}</td>
                  <td className="pct av-num">{fmtPctRev(mNetProfit)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Rate sensitivity ── (net margin / net figures: naked cost) */}
      {canViewCosts && (
        <div className="av-panel">
          <div className="av-panel-h">
            <h2>Rate sensitivity</h2>
            <span className="av-hint">net margin @ ±150/BH</span>
          </div>
          <div className="av-card-b">
            <div className="av-sens-grid">
              {sens.map((s, i) => (
                <div className={`av-sens-cell${s.cur ? ' cur' : ''}`} key={i}>
                  <div className="sr av-num">{fmt(s.rate, 0)}</div>
                  <div className="sm av-num" style={{ color: marginTone(s.m) }}>{(s.m * 100).toFixed(0)}%</div>
                  <div className="sn av-num">{compact(s.net)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drill-down build-up popover */}
      {drill && (() => {
        const cfg = buildDrill(drill.cat)
        if (!cfg) return null
        return (
          <LineDetailPopover
            title={cfg.title}
            monthLabel={`Per month${isPerBh ? ' · per BH' : ''}${currency === 'usd' ? ' · USD' : ''}`}
            items={cfg.items}
            anchorRect={drill.rect}
            onClose={() => setDrill(null)}
          />
        )
      })()}
    </div>
  )
}
