/**
 * API-to-store data converters.
 *
 * Converts snake_case API responses into camelCase store types
 * used by the pricing store.
 */

import type { ComponentBreakdown, MsnPnlResult } from '@/stores/pricing-store'
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
  lease_rent_eur: string | null
  six_year_check_eur: string | null
  twelve_year_check_eur: string | null
  ldg_eur: string | null
  apu_rate_usd: string | null
  llp1_rate_usd: string | null
  llp2_rate_usd: string | null
  epr_matrix: EprMatrixRowApi[]
  // Naked rates — present only for cost-access users.
  has_naked_rates?: boolean
  naked_lease_rent_eur?: string | null
  naked_six_year_check_eur?: string | null
  naked_twelve_year_check_eur?: string | null
  naked_ldg_eur?: string | null
  naked_apu_rate_usd?: string | null
  naked_llp1_rate_usd?: string | null
  naked_llp2_rate_usd?: string | null
  naked_epr_matrix?: EprMatrixRowApi[]
}

// ---- Converters ----

/** Convert API snake_case breakdown to camelCase store format */
export function toStoreBreakdown(api: {
  aircraft_eur_per_bh: string
  crew_eur_per_bh: string
  maintenance_eur_per_bh: string
  insurance_eur_per_bh: string
  doc_eur_per_bh: string
  other_cogs_eur_per_bh: string
  overhead_eur_per_bh: string
  total_cost_per_bh: string
  revenue_per_bh: string
  margin_percent: string
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
    monthlyCost: api.monthly_cost,
    monthlyRevenue: api.monthly_revenue,
    monthlyPnl: api.monthly_pnl,
  }
}
