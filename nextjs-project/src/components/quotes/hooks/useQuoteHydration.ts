import { useEffect, useState } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { computeMsnPnlSummarySeasonal } from '@/lib/pnl-engine'
import type { MsnPnlSummary } from '@/lib/pnl-engine'
import type { QuoteDetailResponse } from '@/app/actions/quotes'
import type { MsnInput, MsnPnlResult, ComponentBreakdown, SeasonInput } from '@/stores/pricing-store'
import type { PayrollRow, CostRow, TrainingRow } from '@/stores/crew-config-store'
import type {
  MaintPersonnel,
  MaintCostItem,
  InsuranceItem,
  DocItem,
  OtherCogsItem,
  OverheadItem,
} from '@/stores/costs-config-store'

/**
 * Custom hook that hydrates pricing, crew, and costs stores from a
 * saved QuoteDetailResponse, then computes MsnPnlSummary[] for display.
 *
 * Returns { loaded, msnSummaries }.
 */
export function useQuoteHydration(quote: QuoteDetailResponse) {
  const [loaded, setLoaded] = useState(false)
  const [msnSummaries, setMsnSummaries] = useState<MsnPnlSummary[]>([])

  useEffect(() => {
    // Populate all 3 stores from the quote snapshot data
    const dashboardState = (quote.dashboard_state ?? {}) as Record<string, string>

    // Reconstruct msnInputs from msn_snapshots
    const msnInputs: MsnInput[] = (quote.msn_snapshots ?? []).map((snap) => {
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
        eprMatrix: (input.eprMatrix as Array<{ cycleRatio: number; benignRate: number; hotRate: number }>) ?? [],
        seasonalityEnabled: (input.seasonalityEnabled as boolean) ?? false,
        summer: input.summer as SeasonInput | undefined,
        winter: input.winter as SeasonInput | undefined,
        fixedCostCoverageEnabled: (input.fixedCostCoverageEnabled as boolean) ?? false,
        fixedCostCoveragePercent: String(input.fixedCostCoveragePercent ?? '50'),
        fixedCostCoverageMonths: String(input.fixedCostCoverageMonths ?? '6'),
      }
    })

    // Reconstruct msnResults from msn_snapshots
    const msnResults: MsnPnlResult[] = (quote.msn_snapshots ?? []).map((snap) => {
      // breakdown / monthly_pnl are null server-side for users without
      // cost-view permission — fall back to empty objects so hydration is safe.
      const bd = (snap.breakdown ?? {}) as Record<string, string>
      const mp = (snap.monthly_pnl ?? {}) as Record<string, string>
      return {
        msn: snap.msn,
        aircraftType: snap.aircraft_type,
        breakdown: {
          aircraftEurPerBh: bd.aircraftEurPerBh ?? '0',
          crewEurPerBh: bd.crewEurPerBh ?? '0',
          maintenanceEurPerBh: bd.maintenanceEurPerBh ?? '0',
          insuranceEurPerBh: bd.insuranceEurPerBh ?? '0',
          docEurPerBh: bd.docEurPerBh ?? '0',
          otherCogsEurPerBh: bd.otherCogsEurPerBh ?? '0',
          overheadEurPerBh: bd.overheadEurPerBh ?? '0',
          totalCostPerBh: bd.totalCostPerBh ?? '0',
          revenuePerBh: bd.revenuePerBh ?? '0',
          marginPercent: bd.marginPercent ?? '0',
          finalRatePerBh: bd.finalRatePerBh ?? '0',
        },
        monthlyCost: mp.monthlyCost ?? '0',
        monthlyRevenue: mp.monthlyRevenue ?? '0',
        monthlyPnl: mp.monthlyPnl ?? '0',
      }
    })

    // Compute totalResult from individual msn results
    let totalResult: ComponentBreakdown | null = null
    if (msnResults.length > 0) {
      const avg = (field: keyof ComponentBreakdown) =>
        (
          msnResults.reduce((acc, r) => acc + parseFloat(r.breakdown[field] || '0'), 0) /
          msnResults.length
        ).toFixed(2)

      totalResult = {
        aircraftEurPerBh: avg('aircraftEurPerBh'),
        crewEurPerBh: avg('crewEurPerBh'),
        maintenanceEurPerBh: avg('maintenanceEurPerBh'),
        insuranceEurPerBh: avg('insuranceEurPerBh'),
        docEurPerBh: avg('docEurPerBh'),
        otherCogsEurPerBh: avg('otherCogsEurPerBh'),
        overheadEurPerBh: avg('overheadEurPerBh'),
        totalCostPerBh: avg('totalCostPerBh'),
        revenuePerBh: avg('revenuePerBh'),
        marginPercent: dashboardState.marginPercent ?? '0',
        finalRatePerBh: avg('finalRatePerBh'),
      }
    }

    // Load into pricing store
    usePricingStore.getState().loadFromQuote({
      dashboardState: {
        projectName: dashboardState.projectName,
        exchangeRate: dashboardState.exchangeRate ?? quote.exchange_rate,
        marginPercent: dashboardState.marginPercent ?? quote.margin_percent,
        bhFhRatio: dashboardState.bhFhRatio,
        apuFhRatio: dashboardState.apuFhRatio,
      },
      msnInputs,
      msnResults,
      totalResult,
      editing: {
        quoteId: quote.id,
        quoteNumber: quote.quote_number,
        clientName: quote.client_name,
        clientCode: quote.client_code,
        projectId: (quote as { project_id?: number | null }).project_id ?? null,
      },
    })

    // Load crew config snapshot
    const crewSnap = quote.crew_config_snapshot as Record<string, unknown> | null
    if (crewSnap && Object.keys(crewSnap).length > 0) {
      useCrewConfigStore.getState().loadFromSnapshot({
        payroll: crewSnap.payroll as PayrollRow[],
        otherCost: crewSnap.otherCost as CostRow[],
        training: crewSnap.training as TrainingRow[],
        averageAC: crewSnap.averageAC as number,
        fdDays: crewSnap.fdDays as number,
        nfdDays: crewSnap.nfdDays as number,
      })
    }

    // Load costs config snapshot
    const costsSnap = quote.costs_config_snapshot as Record<string, unknown> | null
    if (costsSnap && Object.keys(costsSnap).length > 0) {
      useCostsConfigStore.getState().loadFromSnapshot({
        maintPersonnel: costsSnap.maintPersonnel as MaintPersonnel[],
        maintCosts: costsSnap.maintCosts as MaintCostItem[],
        insurance: costsSnap.insurance as InsuranceItem[],
        doc: costsSnap.doc as DocItem[],
        otherCogs: costsSnap.otherCogs as OtherCogsItem[],
        overhead: costsSnap.overhead as OverheadItem[],
        avgAc: costsSnap.avgAc as number,
      })
    }

    // Compute P&L summaries using the full engine (matches PnlTable logic)
    const crewData = useCrewConfigStore.getState()
    const costsData = useCostsConfigStore.getState()
    const exRate = parseFloat(dashboardState.exchangeRate ?? quote.exchange_rate ?? '0.85')

    const summaries = msnInputs.map((input) =>
      computeMsnPnlSummarySeasonal(input, crewData, costsData, exRate),
    )
    setMsnSummaries(summaries)

    setLoaded(true)
  }, [quote])

  return { loaded, msnSummaries }
}
