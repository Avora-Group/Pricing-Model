'use client'

import { RatesSection } from '@/components/aircraft/RatesSection'
import { EprMatrixTable } from '@/components/aircraft/EprMatrixTable'
import type { RateRow } from '@/components/aircraft/RatesSection'
import type { EprMatrixRow } from '@/components/aircraft/EprMatrixTable'

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
}

function formatEscalation(value: string | number | null): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return `${(num * 100).toFixed(1)}%`
}

export function AircraftDetail({
  aircraft,
  isAdmin,
}: {
  aircraft: AircraftDetailData
  isAdmin: boolean
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
        isAdmin={isAdmin}
      />

      {/* Variable Rates (per engine) */}
      <RatesSection
        title="Variable Rates (per engine)"
        rates={variableRates}
        msn={aircraft.msn}
        isAdmin={isAdmin}
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
      <EprMatrixTable eprMatrix={aircraft.epr_matrix} msn={aircraft.msn} isAdmin={isAdmin} />
    </div>
  )
}
