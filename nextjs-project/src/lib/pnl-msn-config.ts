/**
 * MSN P&L configuration derivation.
 *
 * Derives crew and costs values from raw store data, then builds a
 * PnlLineConfig for a single MSN. Pure computation — no React.
 */

import type { PayrollRow, CostRow, TrainingRow } from '@/stores/crew-config-store'
import type {
  MaintPersonnel,
  MaintCostItem,
  InsuranceItem,
  DocItem,
  OtherCogsItem,
  OverheadItem,
} from '@/stores/costs-config-store'
import type { MsnInput, EprMatrixRow } from '@/stores/pricing-store'
import { interpolateEpr } from './pnl-engine'
import { pickAircraftRates } from './aircraft-rate-basis'
import type { PnlLineConfig } from './pnl-monthly-builder'

// ---- Crew derived values ----

export interface CrewDerivedValues {
  pilotSalaryPerSet: number
  pilotSS: number            // pilot only (gross + benefits)
  copilotSS: number          // copilot only (gross + benefits)
  cabinAttendantSS: number
  seniorAttendantSS: number
  uniformPerMonth: number
  trainingPerMonth: number
  accomTravelCPerMonth: number
  pilotPerDiemPerSet: number
  bhBonusPerBh: number
  cabinAttPerDiem: number
  seniorAttPerDiem: number
}

export function deriveCrewValues(
  payroll: PayrollRow[],
  otherCost: CostRow[],
  training: TrainingRow[],
  averageAC: number,
  fdDays: number,
  nfdDays: number,
): CrewDerivedValues {
  // Pilot salary per crew set = (pilot SS) + (copilot SS)
  const pilotSS = payroll[0].grossSalary + payroll[0].benefits
  const copilotSS = payroll[1].grossSalary + payroll[1].benefits
  const pilotSalaryPerSet = pilotSS + copilotSS

  // Cabin attendant SS (any of rows 2-5)
  const cabinAttendantSS = payroll[2].grossSalary + payroll[2].benefits
  // Senior attendant SS (row 6)
  const seniorAttendantSS = payroll[6].grossSalary + payroll[6].benefits

  // Uniform per month (per AC) = Uniforms amount / avgAC / 12
  const uniformsRow = otherCost.find((r) => r.item === 'Uniforms')
  const uniformPerMonth = uniformsRow?.amount && averageAC > 0 ? uniformsRow.amount / averageAC / 12 : 0

  // Training total per month (per AC) = sum of all training amounts / avgAC / 12
  const trainingTotal = training.reduce((s, r) => s + (r.amount ?? 0), 0)
  const trainingPerMonth = averageAC > 0 ? trainingTotal / averageAC / 12 : 0

  // Accommodation & Travel C = (travel costs + accommodation) / avgAC / 12
  const travelCostsRow = otherCost.find((r) => r.item === 'Travel costs')
  const accomRow = otherCost.find((r) => r.item === 'Accomodation')
  const accomTravelCPerMonth = averageAC > 0
    ? ((travelCostsRow?.amount ?? 0) + (accomRow?.amount ?? 0)) / averageAC / 12
    : 0

  // Per diem per person = (perDiemFD x fdDays) + (perDiemNFD x nfdDays)
  const perDiemForRow = (row: PayrollRow) =>
    row.perDiemFD * fdDays + row.perDiemNFD * nfdDays

  // Pilot per diem per crew set = pilot perDiem + copilot perDiem
  const pilotPerDiemPerSet = perDiemForRow(payroll[0]) + perDiemForRow(payroll[1])

  // BH bonus for pilot = (pilot perBhPerdiem + copilot perBhPerdiem) x BH
  const bhBonusPerBh = payroll[0].perBhPerdiem + payroll[1].perBhPerdiem

  // Cabin attendant per diem (any of rows 2-5)
  const cabinAttPerDiem = perDiemForRow(payroll[2])
  // Senior attendant per diem (row 6)
  const seniorAttPerDiem = perDiemForRow(payroll[6])

  return {
    pilotSalaryPerSet,
    pilotSS,
    copilotSS,
    cabinAttendantSS,
    seniorAttendantSS,
    uniformPerMonth,
    trainingPerMonth,
    accomTravelCPerMonth,
    pilotPerDiemPerSet,
    bhBonusPerBh,
    cabinAttPerDiem,
    seniorAttPerDiem,
  }
}

// ---- Costs derived values ----

export interface CostsDerivedValues {
  lineMaintenanceVal: number
  lineMaintenanceInternal: number
  lineMaintenance3rdParty: number
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
}

export function deriveCostsValues(
  maintPersonnel: MaintPersonnel[],
  maintCosts: MaintCostItem[],
  insurance: InsuranceItem[],
  doc: DocItem[],
  otherCogs: OtherCogsItem[],
  overhead: OverheadItem[],
  avgAc: number,
  exchangeRate: number,
): CostsDerivedValues {
  // M component: look up by name in maintCosts
  const findMaintCost = (name: string) => maintCosts.find((c) => c.name === name)?.perMonthPerAc ?? 0
  const lineMaintenanceInternal = findMaintCost('Line Maintenance - Internal')
  const lineMaintenance3rdParty = findMaintCost('Line Maintenance - 3rd Party')
  const lineMaintenanceVal = lineMaintenanceInternal + lineMaintenance3rdParty
  const baseMaintenanceVal = findMaintCost('Capital Maintenance')
  const maintPersonnelSalaryVal = findMaintCost('Maintenance Personnel Salary')
  const trainningVal = findMaintCost('Trainning')
  const cCheckVal = findMaintCost('C-Check')

  // Maintenance personnel per diems: sum of (engineers x perDiem x days) for each role
  const maintPerDiemVal = maintPersonnel.reduce(
    (sum, p) => sum + p.engineers * p.perDiem * p.days,
    0,
  )

  // Spare parts: rate per BH and tires/wheels fixed cost
  const sparePartsRatePerBh = findMaintCost('Spare Parts KPI (Per BH)')
  const tiresWheelsCost = findMaintCost('Tires/Wheels')

  // Insurance: build MSN -> amount map (convert USD -> EUR using dashboard exchange rate)
  const insuranceByMsn: Record<number, number> = {}
  for (const ins of insurance) {
    insuranceByMsn[ins.msn] = ins.priceUsd * exchangeRate
  }

  // Other COGS: Technical and Other Fixed (per month per AC)
  const otherCogsComputed = otherCogs.map((item) => {
    if (item.hasTotal && item.total !== undefined) {
      if (item.name === 'Other Fixed') return { ...item, perMonth: item.total / 9 / 7 }
      if (item.name === 'Technical') return { ...item, perMonth: avgAc > 0 ? item.total / avgAc / 12 : 0 }
    }
    return item
  })
  const technicalVal = otherCogsComputed.find((c) => c.name === 'Technical')?.perMonth ?? 0
  const otherFixedVal = otherCogsComputed.find((c) => c.name === 'Other Fixed')?.perMonth ?? 0
  // Commission rates per BH (seasonal)
  const commissionSummerRate = otherCogsComputed.find((c) => c.name === 'Commission - Third Party Summer')?.perMonth ?? 0
  const commissionWinterRate = otherCogsComputed.find((c) => c.name === 'Commission - Third Party Winter')?.perMonth ?? 0
  // MXC commission rate per BH
  const commissionMxcRate = otherCogsComputed.find((c) => c.name === 'Commission - MXC')?.perMonth ?? 0

  // DOC: per month per AC = total / avgAc / 12
  const docPerMonth = doc.map((d) => (avgAc > 0 ? d.total / avgAc / 12 : 0))
  const fuelVal = docPerMonth[0] ?? 0
  const handlingVal = docPerMonth[1] ?? 0
  const navigationVal = docPerMonth[2] ?? 0
  const airportChargesVal = docPerMonth[3] ?? 0

  // Overhead: per month per AC = total / avgAc / 12
  const overheadPerMonth = overhead.map((o) => (avgAc > 0 ? o.total / avgAc / 12 : 0))

  return {
    lineMaintenanceVal,
    lineMaintenanceInternal,
    lineMaintenance3rdParty,
    baseMaintenanceVal,
    maintPersonnelSalaryVal,
    trainningVal,
    cCheckVal,
    maintPerDiemVal,
    sparePartsRatePerBh,
    tiresWheelsCost,
    insuranceByMsn,
    technicalVal,
    otherFixedVal,
    commissionSummerRate,
    commissionWinterRate,
    commissionMxcRate,
    fuelVal,
    handlingVal,
    navigationVal,
    airportChargesVal,
    overheadPerMonth,
  }
}

// ---- Single MSN config builder ----

export interface MsnComputeResult {
  mgh: number
  acmiRate: number
  excessBh: number
  excessHourRate: number
  cycleRatio: number
  bhFhRatio: number
  apuFhRatio: number
  cfg: PnlLineConfig
}

/**
 * Build PnlLineConfig and KPI parameters for a single MSN input.
 */
export function computeMsnConfig(
  input: MsnInput,
  crew: CrewDerivedValues,
  costs: CostsDerivedValues,
  exchangeRate: number,
  fdDays: number = 18,
  nfdDays: number = 10,
  useNaked: boolean = false,
): MsnComputeResult {
  // Current vs naked aircraft cost basis (single source of truth).
  const ar = pickAircraftRates(input, useNaked)
  const msnMgh = parseFloat(input.mgh) || 0
  const rateToEur = input.rateCurrency === 'usd' ? exchangeRate : 1
  const msnAcmiRate = parseFloat(input.acmiRate || '0') * rateToEur
  const msnExcessBh = parseFloat(input.excessBh || '0')
  const msnExcessHourRate = parseFloat(input.excessHourRate || '0') * rateToEur
  const msnCycleRatio = parseFloat(input.cycleRatio || '1')
  const msnBhFhRatio = parseFloat(input.bhFhRatio || '1.2')
  const msnApuFhRatio = parseFloat(input.apuFhRatio || '1.1')
  const msnCrewSets = input.crewSets
  const msnLeaseType = input.leaseType
  const msnAircraftType = input.aircraftType
  const msnEnvironment = input.environment
  const msnTotalBh = msnMgh + msnExcessBh

  // C component — salary
  const msnPilotSalary_pilot = crew.pilotSS * msnCrewSets
  const msnPilotSalary_copilot = crew.copilotSS * msnCrewSets
  const msnPilotSalary = msnPilotSalary_pilot + msnPilotSalary_copilot
  let msnCabinCrewSalary = 0
  let msnCabinCrewSalary_cabinAtt = 0
  let msnCabinCrewSalary_seniorAtt = 0
  if (msnLeaseType === 'wet') {
    if (msnAircraftType === 'A321') {
      msnCabinCrewSalary_cabinAtt = 4 * crew.cabinAttendantSS * msnCrewSets
    } else {
      msnCabinCrewSalary_cabinAtt = 3 * crew.cabinAttendantSS * msnCrewSets
    }
    msnCabinCrewSalary_seniorAtt = crew.seniorAttendantSS * msnCrewSets
    msnCabinCrewSalary = msnCabinCrewSalary_cabinAtt + msnCabinCrewSalary_seniorAtt
  } else if (msnLeaseType === 'moist') {
    msnCabinCrewSalary_seniorAtt = crew.seniorAttendantSS * msnCrewSets
    msnCabinCrewSalary = msnCabinCrewSalary_seniorAtt
  }

  // C component — per diems
  const msnPilotPerDiem_perDiem = crew.pilotPerDiemPerSet * msnCrewSets
  const msnPilotPerDiem_bhBonus = crew.bhBonusPerBh * msnTotalBh
  const msnPilotPerDiem = msnPilotPerDiem_perDiem + msnPilotPerDiem_bhBonus
  let msnCabinCrewPerDiem = 0
  let msnCabinCrewPerDiem_cabinAtt = 0
  let msnCabinCrewPerDiem_seniorAtt = 0
  if (msnLeaseType === 'wet') {
    if (msnAircraftType === 'A321') {
      msnCabinCrewPerDiem_cabinAtt = 4 * crew.cabinAttPerDiem * msnCrewSets
    } else {
      msnCabinCrewPerDiem_cabinAtt = 3 * crew.cabinAttPerDiem * msnCrewSets
    }
    msnCabinCrewPerDiem_seniorAtt = crew.seniorAttPerDiem * msnCrewSets
    msnCabinCrewPerDiem = msnCabinCrewPerDiem_cabinAtt + msnCabinCrewPerDiem_seniorAtt
  } else if (msnLeaseType === 'moist') {
    msnCabinCrewPerDiem_seniorAtt = crew.seniorAttPerDiem * msnCrewSets
    msnCabinCrewPerDiem = msnCabinCrewPerDiem_seniorAtt
  }

  // Insurance for this MSN
  const msnInsurance = costs.insuranceByMsn[input.msn] ?? 0

  // Maintenance reserves variable
  const msnFh = msnBhFhRatio > 0 ? msnTotalBh / msnBhFhRatio : 0
  const msnFc = msnCycleRatio > 0 ? msnFh / msnCycleRatio : 0
  const msnApuFh = msnFh * msnApuFhRatio
  const msnEprRate = interpolateEpr(ar.eprMatrix, msnCycleRatio, msnEnvironment)
  const msnEprMr = msnEprRate * 2 * msnFh * exchangeRate
  const msnLlpMr = (ar.llp1RateUsd + ar.llp2RateUsd) * msnFc * exchangeRate
  const msnApuMr = ar.apuRateUsd * msnApuFh * exchangeRate
  const msnMaintReservesVariable = msnEprMr + msnLlpMr + msnApuMr

  // Spare parts = totalBH x spare parts rate + tires/wheels fixed
  const msnSpareParts_bh = msnTotalBh * costs.sparePartsRatePerBh
  const msnSpareParts_tiresWheels = costs.tiresWheelsCost
  const msnSpareParts = msnSpareParts_bh + msnSpareParts_tiresWheels

  // Sum of 6yr + 12yr + LDG (current or naked basis)
  const msnMaintReservesFixed_6yr = ar.sixYearCheckEur
  const msnMaintReservesFixed_12yr = ar.twelveYearCheckEur
  const msnMaintReservesFixed_ldg = ar.ldgEur
  const maintReservesFixedEur = msnMaintReservesFixed_6yr + msnMaintReservesFixed_12yr + msnMaintReservesFixed_ldg

  const cfg: PnlLineConfig = {
    maintReservesVariable: msnMaintReservesVariable,
    eprMr: msnEprMr,
    llpMr: msnLlpMr,
    apuMr: msnApuMr,
    leaseRentEur: ar.leaseRentEur,
    maintReservesFixedEur,
    pilotPerDiem: msnPilotPerDiem,
    cabinCrewPerDiem: msnCabinCrewPerDiem,
    accomTravelC: crew.accomTravelCPerMonth,
    pilotSalary: msnPilotSalary,
    cabinCrewSalary: msnCabinCrewSalary,
    staffUniformF: crew.uniformPerMonth,
    trainingC: crew.trainingPerMonth,
    spareParts: msnSpareParts,
    maintPersonnelPerDiem: costs.maintPerDiemVal,
    lineMaintenance: costs.lineMaintenanceVal,
    baseMaintenance: costs.baseMaintenanceVal,
    maintPersonnelSalary: costs.maintPersonnelSalaryVal,
    trainningM: costs.trainningVal,
    maintCCheck: costs.cCheckVal,
    insuranceFixed: msnInsurance,
    technical: costs.technicalVal,
    otherFixed: costs.otherFixedVal,
    personnelCostSS: costs.overheadPerMonth[0] ?? 0,
    personnelCost: (costs.overheadPerMonth[1] ?? 0) + costs.commissionMxcRate * msnTotalBh,
    travelExpenses: costs.overheadPerMonth[2] ?? 0,
    legalExpenses: costs.overheadPerMonth[3] ?? 0,
    licenseRegCost: costs.overheadPerMonth[4] ?? 0,
    adminCost: costs.overheadPerMonth[5] ?? 0,
    itComms: costs.overheadPerMonth[6] ?? 0,
    adminGeneralExp: costs.overheadPerMonth[7] ?? 0,
    sellingMarketingCost: costs.overheadPerMonth[8] ?? 0,
    fuel: costs.fuelVal,
    handling: costs.handlingVal,
    navigation: costs.navigationVal,
    airportCharges: costs.airportChargesVal,
    commissionSummerRate: costs.commissionSummerRate,
    commissionWinterRate: costs.commissionWinterRate,
    // Sub-components for drill-down
    pilotPerDiem_perDiem: msnPilotPerDiem_perDiem,
    pilotPerDiem_bhBonus: msnPilotPerDiem_bhBonus,
    cabinCrewPerDiem_cabinAtt: msnCabinCrewPerDiem_cabinAtt,
    cabinCrewPerDiem_seniorAtt: msnCabinCrewPerDiem_seniorAtt,
    spareParts_bh: msnSpareParts_bh,
    spareParts_tiresWheels: msnSpareParts_tiresWheels,
    maintReservesFixed_6yr: msnMaintReservesFixed_6yr,
    maintReservesFixed_12yr: msnMaintReservesFixed_12yr,
    maintReservesFixed_ldg: msnMaintReservesFixed_ldg,
    pilotSalary_pilot: msnPilotSalary_pilot,
    pilotSalary_copilot: msnPilotSalary_copilot,
    cabinCrewSalary_cabinAtt: msnCabinCrewSalary_cabinAtt,
    cabinCrewSalary_seniorAtt: msnCabinCrewSalary_seniorAtt,
    lineMaintenance_internal: costs.lineMaintenanceInternal,
    lineMaintenance_3rdParty: costs.lineMaintenance3rdParty,
    fdDays,
    nfdDays,
  }

  return {
    mgh: msnMgh,
    acmiRate: msnAcmiRate,
    excessBh: msnExcessBh,
    excessHourRate: msnExcessHourRate,
    cycleRatio: msnCycleRatio,
    bhFhRatio: msnBhFhRatio,
    apuFhRatio: msnApuFhRatio,
    cfg,
  }
}
