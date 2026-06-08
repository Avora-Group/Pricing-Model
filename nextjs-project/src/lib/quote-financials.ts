/**
 * Shared quote → financials computation.
 *
 * Reconstructs the pricing engine inputs from a saved quote snapshot and runs
 * the SAME P&L engine the P&L page and quote detail use, so the Dashboard,
 * quote detail, and P&L page all report identical revenue / cost / profit.
 *
 * Pure functions — safe to call on the server (dashboard) or client.
 */

import { computeMsnPnlSummarySeasonal } from '@/lib/pnl-engine'
import type { CrewStoreData, CostsStoreData } from '@/lib/pnl-engine'
import type { MsnInput, SeasonInput } from '@/stores/pricing-store'
import type { QuoteDetailResponse, QuoteMsnSnapshot } from '@/app/actions/quotes'

/** Reconstruct a full MsnInput from a saved MSN snapshot. */
export function reconstructMsnInput(snap: QuoteMsnSnapshot): MsnInput {
  const input = snap.msn_input as Record<string, unknown>
  return {
    id: input.id as number | undefined,
    aircraftId: (input.aircraftId as number) ?? snap.aircraft_id,
    msn: (input.msn as number) ?? snap.msn,
    aircraftType: (input.aircraftType as string) ?? snap.aircraft_type,
    registration: (input.registration as string | null) ?? null,
    mgh: String(input.mgh ?? '350'),
    cycleRatio: String(input.cycleRatio ?? '1.0'),
    environment: (input.environment as 'benign' | 'hot') ?? 'benign',
    periodStart: (input.periodStart as string) ?? '',
    periodEnd: (input.periodEnd as string) ?? '',
    leaseType: (input.leaseType as 'wet' | 'damp' | 'moist') ?? 'wet',
    crewSets: (input.crewSets as number) ?? 4,
    rateCurrency: (input.rateCurrency as 'eur' | 'usd') ?? 'eur',
    acmiRate: String(input.acmiRate ?? '0'),
    excessBh: String(input.excessBh ?? '0'),
    excessHourRate: String(input.excessHourRate ?? '0'),
    bhFhRatio: String(input.bhFhRatio ?? '1.2'),
    apuFhRatio: String(input.apuFhRatio ?? '1.1'),
    leaseRentEur: String(input.leaseRentEur ?? '0'),
    sixYearCheckEur: String(input.sixYearCheckEur ?? '0'),
    twelveYearCheckEur: String(input.twelveYearCheckEur ?? '0'),
    ldgEur: String(input.ldgEur ?? '0'),
    apuRateUsd: String(input.apuRateUsd ?? '0'),
    llp1RateUsd: String(input.llp1RateUsd ?? '0'),
    llp2RateUsd: String(input.llp2RateUsd ?? '0'),
    eprMatrix:
      (input.eprMatrix as Array<{ cycleRatio: number; benignRate: number; hotRate: number }>) ??
      [],
    seasonalityEnabled: (input.seasonalityEnabled as boolean) ?? false,
    summer: input.summer as SeasonInput | undefined,
    winter: input.winter as SeasonInput | undefined,
    fixedCostCoverageEnabled: (input.fixedCostCoverageEnabled as boolean) ?? false,
    fixedCostCoveragePercent: String(input.fixedCostCoveragePercent ?? '50'),
    fixedCostCoverageMonths: String(input.fixedCostCoverageMonths ?? '6'),
  }
}

/** Count whole calendar months spanned by a YYYY-MM[-DD] range (min 1). */
function monthsCount(start: string, end: string): number {
  if (!start || !end) return 1
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  if (!sy || !sm || !ey || !em) return 1
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1)
}

export interface MsnFinancials {
  msn: number
  aircraft_type: string
  mgh: string | null
  cycle_ratio: string | null
  crew_sets: string | null
  environment: string | null
  lease_type: string | null
  eur_per_bh: string | null
  period_months: string | null
  monthly_revenue: string | null
  monthly_cost: string | null
  monthly_profit: string | null
}

export interface QuoteFinancials {
  msns: MsnFinancials[]
  msn_count: number
  total_mgh: string | null
  period_months: number | null
  eur_per_bh: string | null
  monthly_revenue: string | null
  monthly_cost: string | null
  monthly_profit: string | null
  total_revenue: string | null
  total_profit: string | null
  has_financials: boolean
}

const s = (n: number | null): string | null =>
  n === null || Number.isNaN(n) ? null : String(n)

/**
 * Compute per-MSN and rolled-up financials for a saved quote using the live
 * P&L engine (with partial-month proration). Returns nulls when the quote
 * lacks the crew/costs snapshots needed to compute.
 */
export function computeQuoteFinancials(quote: QuoteDetailResponse): QuoteFinancials {
  const empty: QuoteFinancials = {
    msns: [],
    msn_count: quote.msn_snapshots?.length ?? 0,
    total_mgh: null,
    period_months: null,
    eur_per_bh: null,
    monthly_revenue: null,
    monthly_cost: null,
    monthly_profit: null,
    total_revenue: null,
    total_profit: null,
    has_financials: false,
  }

  const crewSnap = quote.crew_config_snapshot as Record<string, unknown> | null
  const costsSnap = quote.costs_config_snapshot as Record<string, unknown> | null
  const dashboardState = (quote.dashboard_state ?? {}) as Record<string, string>
  const exRate = parseFloat(
    dashboardState.exchangeRate ?? quote.exchange_rate ?? '0.85',
  )

  // The engine needs crew payroll + costs; without them we cannot compute.
  const payroll = (crewSnap?.payroll as unknown[]) ?? []
  if (!crewSnap || !costsSnap || payroll.length < 7) {
    return empty
  }

  const crew: CrewStoreData = {
    payroll: crewSnap.payroll as CrewStoreData['payroll'],
    otherCost: crewSnap.otherCost as CrewStoreData['otherCost'],
    training: crewSnap.training as CrewStoreData['training'],
    averageAC: crewSnap.averageAC as number,
    fdDays: crewSnap.fdDays as number,
    nfdDays: crewSnap.nfdDays as number,
  }
  const costs: CostsStoreData = {
    maintPersonnel: costsSnap.maintPersonnel as CostsStoreData['maintPersonnel'],
    maintCosts: costsSnap.maintCosts as CostsStoreData['maintCosts'],
    insurance: costsSnap.insurance as CostsStoreData['insurance'],
    doc: costsSnap.doc as CostsStoreData['doc'],
    otherCogs: costsSnap.otherCogs as CostsStoreData['otherCogs'],
    overhead: costsSnap.overhead as CostsStoreData['overhead'],
    avgAc: costsSnap.avgAc as number,
  }

  let projMonthlyRev = 0
  let projMonthlyCost = 0
  let projTotalRev = 0
  let projTotalCost = 0
  let rateWeightSum = 0
  let rateWeight = 0
  let totalMgh = 0
  let maxMonths = 0
  const msns: MsnFinancials[] = []

  for (const snap of quote.msn_snapshots ?? []) {
    const input = reconstructMsnInput(snap)
    let summary
    try {
      summary = computeMsnPnlSummarySeasonal(input, crew, costs, exRate)
    } catch {
      continue
    }
    const months = monthsCount(input.periodStart, input.periodEnd)
    maxMonths = Math.max(maxMonths, months)

    const mgh = parseFloat(input.mgh) || 0
    const monthlyRev = summary.totalRevenue / months
    const monthlyCost = summary.totalCost / months
    const monthlyProfit = summary.netProfit / months

    totalMgh += mgh
    projMonthlyRev += monthlyRev
    projMonthlyCost += monthlyCost
    projTotalRev += summary.totalRevenue
    projTotalCost += summary.totalCost
    if (summary.acmiRatePerBh && mgh) {
      rateWeightSum += summary.acmiRatePerBh * mgh
      rateWeight += mgh
    }

    msns.push({
      msn: snap.msn,
      aircraft_type: snap.aircraft_type,
      mgh: s(mgh),
      cycle_ratio: input.cycleRatio,
      crew_sets: s(input.crewSets),
      environment: input.environment,
      lease_type: input.leaseType,
      eur_per_bh: s(summary.acmiRatePerBh || null),
      period_months: s(months),
      monthly_revenue: s(monthlyRev),
      monthly_cost: s(monthlyCost),
      monthly_profit: s(monthlyProfit),
    })
  }

  if (msns.length === 0) return empty

  return {
    msns,
    msn_count: msns.length,
    total_mgh: s(totalMgh),
    period_months: maxMonths || null,
    eur_per_bh: rateWeight > 0 ? s(rateWeightSum / rateWeight) : null,
    monthly_revenue: s(projMonthlyRev),
    monthly_cost: s(projMonthlyCost),
    monthly_profit: s(projMonthlyRev - projMonthlyCost),
    total_revenue: s(projTotalRev),
    total_profit: s(projTotalRev - projTotalCost),
    has_financials: true,
  }
}
