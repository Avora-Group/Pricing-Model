/**
 * API-to-store data converters.
 *
 * Converts snake_case API responses into camelCase store types
 * used by the pricing store.
 */

import type { ComponentBreakdown, EprMatrixRow, MsnPnlResult } from '@/stores/pricing-store'
import type { CalculateResponse } from '@/app/actions/pricing'

// ---- API types (snake_case shapes from backend) ----

export interface EprMatrixRowApi {
  cycle_ratio: string
  benign_rate: string
  hot_rate: string
}

export interface AircraftOption {
  id: number
  msn: number
  aircraft_type: string
  registration: string | null
  /** False = switched off from the fleet: not offered for new pricing. */
  is_active?: boolean
  lease_rent_usd: string | null
  six_year_check_usd: string | null
  twelve_year_check_usd: string | null
  ldg_usd: string | null
  apu_rate_usd: string | null
  llp1_rate_usd: string | null
  llp2_rate_usd: string | null
  epr_matrix: EprMatrixRowApi[]
  // Included-MR allowance (e.g. MSN 5228): the fixed MR covers variable MRs up
  // to included_fh / included_fc per month; the excess is charged from the
  // supplemental matrix (USD per FH, per engine) and the LLP catalogue price
  // (USD per FC, per engine).
  included_fh?: string | null
  included_fc?: string | null
  supp_llp_per_fc_usd?: string | null
  supp_epr_matrix?: EprMatrixRowApi[]
  // Naked rates — present only for cost-access users.
  has_naked_rates?: boolean
  naked_lease_rent_usd?: string | null
  naked_six_year_check_usd?: string | null
  naked_twelve_year_check_usd?: string | null
  naked_ldg_usd?: string | null
  naked_apu_rate_usd?: string | null
  naked_llp1_rate_usd?: string | null
  naked_llp2_rate_usd?: string | null
  naked_epr_matrix?: EprMatrixRowApi[]
}

// ---- Converters ----

/** Allowance fields of an aircraft, in store (camelCase) shape. Absent (all
 *  undefined) for aircraft without an included-MR allowance. */
export function allowanceFields(ac: AircraftOption): {
  includedFh?: string
  includedFc?: string
  suppLlpPerFcUsd?: string
  suppEprMatrix?: EprMatrixRow[]
} {
  if (ac.included_fh == null && ac.included_fc == null) return {}
  return {
    includedFh: ac.included_fh ?? undefined,
    includedFc: ac.included_fc ?? undefined,
    suppLlpPerFcUsd: ac.supp_llp_per_fc_usd ?? undefined,
    suppEprMatrix: (ac.supp_epr_matrix ?? []).map((r) => ({
      cycleRatio: parseFloat(r.cycle_ratio),
      benignRate: parseFloat(r.benign_rate),
      hotRate: parseFloat(r.hot_rate),
    })),
  }
}

/** Convert API snake_case breakdown to camelCase store format.
 *  Cost/margin fields may be null (server redaction for non-cost-access users);
 *  each is guarded with `?? '0'` below. */
export function toStoreBreakdown(api: {
  aircraft_eur_per_bh: string | null
  crew_eur_per_bh: string | null
  maintenance_eur_per_bh: string | null
  insurance_eur_per_bh: string | null
  doc_eur_per_bh: string | null
  other_cogs_eur_per_bh: string | null
  overhead_eur_per_bh: string | null
  total_cost_per_bh: string | null
  revenue_per_bh: string
  margin_percent: string | null
  final_rate_per_bh: string
}): ComponentBreakdown {
  return {
    aircraftEurPerBh: api.aircraft_eur_per_bh ?? '0',
    crewEurPerBh: api.crew_eur_per_bh ?? '0',
    maintenanceEurPerBh: api.maintenance_eur_per_bh ?? '0',
    insuranceEurPerBh: api.insurance_eur_per_bh ?? '0',
    docEurPerBh: api.doc_eur_per_bh ?? '0',
    otherCogsEurPerBh: api.other_cogs_eur_per_bh ?? '0',
    overheadEurPerBh: api.overhead_eur_per_bh ?? '0',
    totalCostPerBh: api.total_cost_per_bh ?? '0',
    revenuePerBh: api.revenue_per_bh ?? '0',
    marginPercent: api.margin_percent ?? '0',
    finalRatePerBh: api.final_rate_per_bh ?? '0',
  }
}

/** Convert a single API MSN result to the store MsnPnlResult format */
export function toStoreMsnResult(api: CalculateResponse['msn_results'][number]): MsnPnlResult {
  return {
    msn: api.msn,
    aircraftType: api.aircraft_type,
    breakdown: toStoreBreakdown(api.breakdown),
    // Null for users without cost access (server redaction) — default to '0'.
    monthlyCost: api.monthly_cost ?? '0',
    monthlyRevenue: api.monthly_revenue ?? '0',
    monthlyPnl: api.monthly_pnl ?? '0',
    coverageCost: api.coverage_cost ?? '0',
  }
}
