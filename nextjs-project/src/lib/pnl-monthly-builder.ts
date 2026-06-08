/**
 * Monthly P&L data builder.
 *
 * Builds a Record<string, number[]> mapping each P&L line key to an array
 * of monthly values. Pure computation — no React, no side effects.
 */

import { VARIABLE_COST_KEYS, FIXED_COST_KEYS, OVERHEAD_KEYS, ALL_DATA_KEYS } from './pnl-row-defs'
import type { MonthDayInfo } from './pnl-proration'

/** All derived config values that feed into P&L line items */
export interface PnlLineConfig {
  // A component — variable (from Aircraft tab + KPIs)
  maintReservesVariable: number // EPR MR + LLP MR + APU MR (monthly, EUR)
  eprMr: number   // EPR maintenance reserve sub-component (EUR)
  llpMr: number   // LLP maintenance reserve sub-component (EUR)
  apuMr: number   // APU maintenance reserve sub-component (EUR)
  // A component — fixed (from Aircraft tab)
  leaseRentEur: number
  maintReservesFixedEur: number
  // C component — variable (from Crew tab)
  pilotPerDiem: number      // (pilot per diem per set x crewSets) + BH bonus
  cabinCrewPerDiem: number  // depends on leaseType + aircraftType x crewSets
  accomTravelC: number      // (travel costs + accommodation) / avgAC / 12
  // C component — fixed (from Crew tab)
  pilotSalary: number       // (pilot SS + copilot SS) x crewSets
  cabinCrewSalary: number   // depends on leaseType + aircraftType
  staffUniformF: number     // uniform per month (per AC)
  trainingC: number         // training total per month (per AC)
  // M component — variable (from Costs tab + KPIs)
  spareParts: number        // BH x spare parts rate + tires/wheels fixed
  maintPersonnelPerDiem: number // sum of (engineers x perDiem x days) from maint personnel
  // M component — fixed (from Costs tab)
  lineMaintenance: number   // internal + 3rd party
  baseMaintenance: number   // capital maintenance
  maintPersonnelSalary: number
  trainningM: number
  maintCCheck: number
  // I component (from Costs tab)
  insuranceFixed: number    // insurance for selected MSN
  // Other (from Costs tab)
  technical: number
  otherFixed: number
  // Overhead (from Costs tab) — per month per AC
  personnelCostSS: number
  personnelCost: number
  travelExpenses: number
  legalExpenses: number
  licenseRegCost: number
  adminCost: number
  itComms: number
  adminGeneralExp: number
  sellingMarketingCost: number
  // DOC (from Costs tab) — per month per AC
  fuel: number
  handling: number
  navigation: number
  airportCharges: number
  // Other COGS (from Costs tab) — commission rates per BH
  commissionSummerRate: number // Nov-Apr: rate x BH
  commissionWinterRate: number // May-Oct: rate x BH
  // -- Sub-components for drill-down popovers --
  pilotPerDiem_perDiem: number    // per diem component (pilotPerDiemPerSet × crewSets)
  pilotPerDiem_bhBonus: number    // BH bonus component (bhBonusPerBh × totalBH)
  cabinCrewPerDiem_cabinAtt: number  // cabin attendant per diem portion
  cabinCrewPerDiem_seniorAtt: number // senior attendant per diem portion
  spareParts_bh: number           // BH-based spare parts (totalBH × rate)
  spareParts_tiresWheels: number  // tires/wheels fixed cost
  maintReservesFixed_6yr: number  // 6-year check
  maintReservesFixed_12yr: number // 12-year check
  maintReservesFixed_ldg: number  // landing gear
  pilotSalary_pilot: number       // pilot SS × crewSets
  pilotSalary_copilot: number     // copilot SS × crewSets
  cabinCrewSalary_cabinAtt: number   // cabin attendant SS portion
  cabinCrewSalary_seniorAtt: number  // senior attendant SS portion
  lineMaintenance_internal: number   // Line Maintenance - Internal
  lineMaintenance_3rdParty: number   // Line Maintenance - 3rd Party
  // Crew working day info (for partial-month proration)
  fdDays: number     // flying duty days per month (from crew config, e.g. 18)
  nfdDays: number    // non-flying duty days per month (from crew config, e.g. 10)
}

/**
 * Build monthly P&L data arrays for a single MSN.
 *
 * Returns a Record mapping each data key to an array of monthly values.
 */
export function buildMonthlyData(
  months: { year: number; month: number; label: string }[],
  mgh: number,
  acmiRate: number,
  excessBh: number,
  excessHourRate: number,
  cycleRatio: number,
  bhFhRatio: number,
  apuFhRatio: number,
  cfg: PnlLineConfig,
  monthDayInfos?: MonthDayInfo[],
): Record<string, number[]> {
  const monthCount = months.length
  const data: Record<string, number[]> = {}

  // Initialize all keys with zeros for all months
  for (const k of ALL_DATA_KEYS) {
    data[k] = new Array(monthCount).fill(0)
  }

  if (mgh === 0) return data

  // Full-month base values
  const fullRevenue = acmiRate * mgh + excessBh * excessHourRate
  const fullTotalBh = mgh + excessBh
  const workingDays = cfg.fdDays + cfg.nfdDays // e.g. 18 + 10 = 28

  for (let m = 0; m < monthCount; m++) {
    // -- Proration factors --
    const info = monthDayInfos?.[m]
    const isPartial = info ? info.activeDays < info.totalDays : false
    const df = isPartial ? info!.activeDays / info!.totalDays : 1.0 // dayFraction for BH/DOC
    const cdf = (isPartial && workingDays > 0) // crewDayFraction for pilot/cabin per diems
      ? info!.activeDays / workingDays
      : 1.0

    // Prorated month values
    const monthMgh = mgh * df
    const monthExcessBh = excessBh * df
    const monthTotalBh = monthMgh + monthExcessBh
    const monthRevenue = acmiRate * monthMgh + monthExcessBh * excessHourRate

    // Revenue (prorated)
    data['wetLease'][m] = monthRevenue
    data['otherRevenue'][m] = 0
    data['financeIncome'][m] = 0
    data['totalRevenue'][m] = monthRevenue

    // -- VARIABLE COST (prorated) --
    // A: reserves variable — BH-proportional (scale by dayFraction)
    data['maintReservesVariable'][m] = cfg.maintReservesVariable * df
    data['maintReservesVariable_epr'][m] = cfg.eprMr * df
    data['maintReservesVariable_llp'][m] = cfg.llpMr * df
    data['maintReservesVariable_apu'][m] = cfg.apuMr * df
    data['assetMgmtFee'][m] = 0

    // C: per diems — crew day fraction for per diem, BH fraction for BH bonus
    data['pilotPerDiem_perDiem'][m] = cfg.pilotPerDiem_perDiem * cdf
    data['pilotPerDiem_bhBonus'][m] = cfg.pilotPerDiem_bhBonus * df
    data['pilotPerDiem'][m] = data['pilotPerDiem_perDiem'][m] + data['pilotPerDiem_bhBonus'][m]
    data['cabinCrewPerDiem_cabinAtt'][m] = cfg.cabinCrewPerDiem_cabinAtt * cdf
    data['cabinCrewPerDiem_seniorAtt'][m] = cfg.cabinCrewPerDiem_seniorAtt * cdf
    data['cabinCrewPerDiem'][m] = data['cabinCrewPerDiem_cabinAtt'][m] + data['cabinCrewPerDiem_seniorAtt'][m]
    data['accomTravelC'][m] = cfg.accomTravelC * df

    // M: variable maintenance — BH-proportional + day-proportional
    data['spareParts_bh'][m] = cfg.spareParts_bh * df
    data['spareParts_tiresWheels'][m] = cfg.spareParts_tiresWheels * df
    data['spareParts'][m] = data['spareParts_bh'][m] + data['spareParts_tiresWheels'][m]
    data['maintPersonnelPerDiem'][m] = cfg.maintPersonnelPerDiem * df
    data['accomTravelM'][m] = 0
    data['otherMaintV'][m] = 0

    // DOC: day-proportional
    data['fuel'][m] = cfg.fuel * df
    data['handling'][m] = cfg.handling * df
    data['navigation'][m] = cfg.navigation * df
    data['airportCharges'][m] = cfg.airportCharges * df

    // Commissions: BH-proportional (use prorated totalBh)
    const calMonth = months[m].month
    const isSummer = calMonth >= 5 && calMonth <= 10
    data['commissions'][m] = (isSummer ? cfg.commissionWinterRate : cfg.commissionSummerRate) * monthTotalBh
    data['delaysCancellations'][m] = 0

    // Total variable cost
    const totalVar = VARIABLE_COST_KEYS.reduce((s, k) => s + data[k][m], 0)
    data['totalVariableCost'][m] = totalVar
    data['contributionI'][m] = monthRevenue - totalVar

    // -- FIXED COST (prorated by day fraction, same as variable) --
    // A partial month bears only its share of fixed costs: a project starting
    // on the 22nd of a 30-day month pays 9/30 of each fixed line.
    data['dryLease'][m] = cfg.leaseRentEur * df
    data['maintReservesFixed'][m] = cfg.maintReservesFixedEur * df
    data['maintReservesFixed_6yr'][m] = cfg.maintReservesFixed_6yr * df
    data['maintReservesFixed_12yr'][m] = cfg.maintReservesFixed_12yr * df
    data['maintReservesFixed_ldg'][m] = cfg.maintReservesFixed_ldg * df

    data['pilotSalary'][m] = cfg.pilotSalary * df
    data['pilotSalary_pilot'][m] = cfg.pilotSalary_pilot * df
    data['pilotSalary_copilot'][m] = cfg.pilotSalary_copilot * df
    data['cabinCrewSalary'][m] = cfg.cabinCrewSalary * df
    data['cabinCrewSalary_cabinAtt'][m] = cfg.cabinCrewSalary_cabinAtt * df
    data['cabinCrewSalary_seniorAtt'][m] = cfg.cabinCrewSalary_seniorAtt * df
    data['staffUniformF'][m] = cfg.staffUniformF * df
    data['trainingC'][m] = cfg.trainingC * df

    data['lineMaintenance'][m] = cfg.lineMaintenance * df
    data['lineMaintenance_internal'][m] = cfg.lineMaintenance_internal * df
    data['lineMaintenance_3rdParty'][m] = cfg.lineMaintenance_3rdParty * df
    data['baseMaintenance'][m] = cfg.baseMaintenance * df
    data['maintPersonnelSalary'][m] = cfg.maintPersonnelSalary * df
    data['trainningM'][m] = cfg.trainningM * df
    data['maintCCheck'][m] = cfg.maintCCheck * df

    data['insuranceFixed'][m] = cfg.insuranceFixed * df
    data['technical'][m] = cfg.technical * df
    data['otherFixed'][m] = cfg.otherFixed * df

    const totalFixed = FIXED_COST_KEYS.reduce((s, k) => s + data[k][m], 0)
    data['totalFixedCost'][m] = totalFixed
    data['contributionII'][m] = data['contributionI'][m] - totalFixed

    // -- OVERHEAD (prorated by day fraction) --
    // personnelCost = fixed personnel + MXC commission (rate x full-month BH).
    // Scaling the whole line by df prorates the fixed part by days AND charges
    // MXC on the prorated BH (monthBh = fullBh x df):
    // 20,970 x 9/30 + 42 x 105 = 10,701.
    data['personnelCostSS'][m] = cfg.personnelCostSS * df
    data['personnelCost'][m] = cfg.personnelCost * df
    data['travelExpenses'][m] = cfg.travelExpenses * df
    data['legalExpenses'][m] = cfg.legalExpenses * df
    data['licenseRegCost'][m] = cfg.licenseRegCost * df
    data['adminCost'][m] = cfg.adminCost * df
    data['itComms'][m] = cfg.itComms * df
    data['adminGeneralExp'][m] = cfg.adminGeneralExp * df
    data['sellingMarketingCost'][m] = cfg.sellingMarketingCost * df

    const totalOH = OVERHEAD_KEYS.reduce((s, k) => s + data[k][m], 0)
    data['totalOverhead'][m] = totalOH

    // EBITDA
    data['ebitda'][m] = data['contributionII'][m] - totalOH
    data['ebitdaMargin'][m] = monthRevenue > 0 ? data['ebitda'][m] / monthRevenue : 0

    // D&A, EBIT
    data['depAmort'][m] = 0
    data['ebit'][m] = data['ebitda'][m] - data['depAmort'][m]
    data['ebitMargin'][m] = monthRevenue > 0 ? data['ebit'][m] / monthRevenue : 0

    // Below EBIT
    data['interestNet'][m] = 0
    data['fxNet'][m] = 0
    data['tax'][m] = 0
    data['netProfit'][m] = data['ebit'][m] - data['interestNet'][m] - data['fxNet'][m] - data['tax'][m]
    data['netProfitMargin'][m] = monthRevenue > 0 ? data['netProfit'][m] / monthRevenue : 0

    // KPIs — prorated BH values
    const monthFh = bhFhRatio > 0 ? monthTotalBh / bhFhRatio : 0
    data['acOperational'][m] = 1
    data['bh'][m] = monthTotalBh
    data['avgBhPerAc'][m] = monthTotalBh
    data['fh'][m] = monthFh
    data['fc'][m] = cycleRatio > 0 ? monthFh / cycleRatio : 0
    data['fhFcRatio'][m] = cycleRatio
    data['apuFh'][m] = monthFh * apuFhRatio
  }

  return data
}
