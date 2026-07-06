'use client'

import { RatesSection } from '@/components/aircraft/RatesSection'
import { EprMatrixTable } from '@/components/aircraft/EprMatrixTable'
import type { RateRow } from '@/components/aircraft/RatesSection'
import type { EprMatrixRow } from '@/components/aircraft/EprMatrixTable'
import { useCanViewCosts } from '@/providers/CostVisibilityProvider'

export interface AircraftDetailData {
  id: number
  msn: number
  aircraft_type: string
  registration: string | null
  lease_rent_usd: string
  six_year_check_usd: string
  twelve_year_check_usd: string
  ldg_usd: string
  apu_rate_usd: string
  llp1_rate_usd: string
  llp2_rate_usd: string
  epr_escalation: string
  llp_escalation: string
  af_apu_escalation: string
  lease_rent_eur: string
  six_year_check_eur: string
  twelve_year_check_eur: string
  ldg_eur: string
  apu_rate_eur: string
  llp1_rate_eur: string
  llp2_rate_eur: string
  epr_matrix: EprMatrixRow[]
  // Naked rates — only present in the API response for cost-access users.
  has_naked_rates?: boolean
  naked_lease_rent_usd?: string | null
  naked_six_year_check_usd?: string | null
  naked_twelve_year_check_usd?: string | null
  naked_ldg_usd?: string | null
  naked_apu_rate_usd?: string | null
  naked_llp1_rate_usd?: string | null
  naked_llp2_rate_usd?: string | null
  naked_lease_rent_eur?: string | null
  naked_six_year_check_eur?: string | null
  naked_twelve_year_check_eur?: string | null
  naked_ldg_eur?: string | null
  naked_apu_rate_eur?: string | null
  naked_llp1_rate_eur?: string | null
  naked_llp2_rate_eur?: string | null
  naked_epr_escalation?: string | null
  naked_llp_escalation?: string | null
  naked_af_apu_escalation?: string | null
  naked_epr_matrix?: EprMatrixRow[]
}

function formatEscalation(value: string | number | null): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return `${(num * 100).toFixed(1)}%`
}

export function AircraftDetail({
  aircraft,
  canEdit,
}: {
  aircraft: AircraftDetailData
  canEdit: boolean
}) {
  const fixedRates: RateRow[] = [
    { label: 'Lease Rent', usd: aircraft.lease_rent_usd, eur: aircraft.lease_rent_eur, field: 'lease_rent_usd' },
    { label: '6-Year Check', usd: aircraft.six_year_check_usd, eur: aircraft.six_year_check_eur, field: 'six_year_check_usd' },
    { label: '12-Year Check', usd: aircraft.twelve_year_check_usd, eur: aircraft.twelve_year_check_eur, field: 'twelve_year_check_usd' },
    { label: 'Landing Gear (LDG)', usd: aircraft.ldg_usd, eur: aircraft.ldg_eur, field: 'ldg_usd' },
  ]

  const variableRates: RateRow[] = [
    { label: 'APU Rate', usd: aircraft.apu_rate_usd, eur: aircraft.apu_rate_eur, field: 'apu_rate_usd' },
    { label: 'LLP #1 Rate', usd: aircraft.llp1_rate_usd, eur: aircraft.llp1_rate_eur, field: 'llp1_rate_usd' },
    { label: 'LLP #2 Rate', usd: aircraft.llp2_rate_usd, eur: aircraft.llp2_rate_eur, field: 'llp2_rate_usd' },
  ]

  const canViewCosts = useCanViewCosts()
  const showNaked = canViewCosts && Boolean(aircraft.has_naked_rates)

  const nakedFixedRates: RateRow[] = [
    { label: 'Lease Rent', usd: aircraft.naked_lease_rent_usd ?? '', eur: aircraft.naked_lease_rent_eur ?? '', field: 'naked_lease_rent_usd' },
    { label: '6-Year Check', usd: aircraft.naked_six_year_check_usd ?? '', eur: aircraft.naked_six_year_check_eur ?? '', field: 'naked_six_year_check_usd' },
    { label: '12-Year Check', usd: aircraft.naked_twelve_year_check_usd ?? '', eur: aircraft.naked_twelve_year_check_eur ?? '', field: 'naked_twelve_year_check_usd' },
    { label: 'Landing Gear (LDG)', usd: aircraft.naked_ldg_usd ?? '', eur: aircraft.naked_ldg_eur ?? '', field: 'naked_ldg_usd' },
  ]

  const nakedVariableRates: RateRow[] = [
    { label: 'APU Rate', usd: aircraft.naked_apu_rate_usd ?? '', eur: aircraft.naked_apu_rate_eur ?? '', field: 'naked_apu_rate_usd' },
    { label: 'LLP #1 Rate', usd: aircraft.naked_llp1_rate_usd ?? '', eur: aircraft.naked_llp1_rate_eur ?? '', field: 'naked_llp1_rate_usd' },
    { label: 'LLP #2 Rate', usd: aircraft.naked_llp2_rate_usd ?? '', eur: aircraft.naked_llp2_rate_eur ?? '', field: 'naked_llp2_rate_usd' },
  ]

  return (
    <div className="space-y-[18px]">
      {/* Header */}
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="av-page-title av-num">MSN {aircraft.msn}</h1>
          <span className="chip">{aircraft.aircraft_type}</span>
        </div>
        <p className="av-page-sub">
          {aircraft.registration ?? 'No registration'}
        </p>
      </div>

      {/* Fixed Monthly Rates */}
      <RatesSection
        title="Fixed Monthly Rates"
        rates={fixedRates}
        msn={aircraft.msn}
        canEdit={canEdit}
      />

      {/* Variable Rates (per engine) */}
      <RatesSection
        title="Variable Rates (per engine)"
        rates={variableRates}
        msn={aircraft.msn}
        canEdit={canEdit}
      />

      {/* Escalation Rates */}
      <div className="av-panel">
        <div className="av-panel-h"><h2>Escalation Rates</h2></div>
        <div className="overflow-x-auto">
          <table className="av-tbl">
            <thead>
              <tr>
                <th className="av-th">Parameter</th>
                <th className="av-th r">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="av-td" style={{ color: 'var(--ink-2)' }}>EPR Escalation</td>
                <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>{formatEscalation(aircraft.epr_escalation)}</td>
              </tr>
              <tr>
                <td className="av-td" style={{ color: 'var(--ink-2)' }}>LLP Escalation</td>
                <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>{formatEscalation(aircraft.llp_escalation)}</td>
              </tr>
              <tr>
                <td className="av-td" style={{ color: 'var(--ink-2)' }}>AF+APU Escalation</td>
                <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>{formatEscalation(aircraft.af_apu_escalation)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* EPR Matrix */}
      <EprMatrixTable eprMatrix={aircraft.epr_matrix} msn={aircraft.msn} canEdit={canEdit} />

      {/* ── Naked Rates (cost-access only) ── */}
      {showNaked && (
        <>
          <div
            className="flex items-center gap-3 pt-3"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            <h2 className="av-page-title" style={{ fontSize: '1.05rem' }}>Naked Rates</h2>
            <span className="chip" style={{ background: 'var(--cyan-soft)', color: 'var(--cyan)' }}>
              Cost access only
            </span>
          </div>

          {/* Naked rates are read-only in the UI (seeded from the source workbook). */}
          <RatesSection title="Naked — Fixed Monthly Rates" rates={nakedFixedRates} msn={aircraft.msn} canEdit={false} />
          <RatesSection title="Naked — Variable Rates (per engine)" rates={nakedVariableRates} msn={aircraft.msn} canEdit={false} />

          <div className="av-panel">
            <div className="av-panel-h"><h2>Naked — Escalation Rates</h2></div>
            <div className="overflow-x-auto">
              <table className="av-tbl">
                <thead>
                  <tr>
                    <th className="av-th">Parameter</th>
                    <th className="av-th r">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="av-td" style={{ color: 'var(--ink-2)' }}>EPR Escalation</td>
                    <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>{formatEscalation(aircraft.naked_epr_escalation ?? null)}</td>
                  </tr>
                  <tr>
                    <td className="av-td" style={{ color: 'var(--ink-2)' }}>LLP Escalation</td>
                    <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>{formatEscalation(aircraft.naked_llp_escalation ?? null)}</td>
                  </tr>
                  <tr>
                    <td className="av-td" style={{ color: 'var(--ink-2)' }}>AF+APU Escalation</td>
                    <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>{formatEscalation(aircraft.naked_af_apu_escalation ?? null)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <EprMatrixTable eprMatrix={aircraft.naked_epr_matrix ?? []} msn={aircraft.msn} canEdit={false} />
        </>
      )}
    </div>
  )
}
