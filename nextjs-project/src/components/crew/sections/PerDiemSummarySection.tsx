'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { fmtInt } from '@/lib/format'

export interface PerDiemData {
  pilotFD: number
  pilotNFD: number
  bhBonusFD: number
  bhBonusNFD: number
  a321FD: number
  a321NFD: number
  a320FD: number
  a320NFD: number
  moistFD: number
  moistNFD: number
  pilotTotal: number
  bhBonusTotal: number
  a321Total: number
  a320Total: number
  moistTotal: number
}

export interface PerDiemSummarySectionProps {
  fdDays: number
  nfdDays: number
  perDiem: PerDiemData
  onSetFdDays: (v: number) => void
  onSetNfdDays: (v: number) => void
}

export function PerDiemSummarySection({
  fdDays,
  nfdDays,
  perDiem,
  onSetFdDays,
  onSetNfdDays,
}: PerDiemSummarySectionProps) {
  const groupBorder = { borderLeft: '1px solid var(--line-2)' }
  const bhBonus = {
    background: 'var(--pos-soft)',
    color: 'var(--pos)',
    borderRadius: 6,
    padding: '2px 8px',
    fontWeight: 600,
  }
  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>Per diem summary</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="av-tbl">
          <thead>
            {/* Lease type header row */}
            <tr>
              <th className="av-th"></th>
              <th className="av-th r"></th>
              <th colSpan={2} className="av-th" style={{ textAlign: 'center', ...groupBorder }}>
                Wet / Moist / Damp Lease
              </th>
              <th colSpan={2} className="av-th" style={{ textAlign: 'center', ...groupBorder }}>
                Wet Lease
              </th>
              <th className="av-th" style={{ textAlign: 'center', ...groupBorder }}>
                Moist Lease
              </th>
            </tr>
            {/* Column headers */}
            <tr>
              <th className="av-th"></th>
              <th className="av-th r">Days</th>
              <th className="av-th r" style={groupBorder}>PILOT A321/A320</th>
              <th className="av-th r">BH Bonus for Pilot</th>
              <th className="av-th r" style={groupBorder}>A321</th>
              <th className="av-th r">A320</th>
              <th className="av-th r" style={groupBorder}>A321/A320</th>
            </tr>
          </thead>
          <tbody>
            {/* FD row */}
            <tr>
              <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>FD</td>
              <td className="av-td r">
                <EditableCell value={fdDays} onChange={v => onSetFdDays(v ?? 0)} decimals={0} formatFn={v => fmtInt(v)} />
              </td>
              <td className="av-td r av-num" style={{ color: 'var(--muted)', ...groupBorder }}>{fmtInt(perDiem.pilotFD)}</td>
              <td className="av-td r av-num">
                <span style={bhBonus}>{fmtInt(perDiem.bhBonusFD)}</span>
              </td>
              <td className="av-td r av-num" style={{ color: 'var(--muted)', ...groupBorder }}>{fmtInt(perDiem.a321FD)}</td>
              <td className="av-td r av-num" style={{ color: 'var(--muted)' }}>{fmtInt(perDiem.a320FD)}</td>
              <td className="av-td r av-num" style={{ color: 'var(--muted)', ...groupBorder }}>{fmtInt(perDiem.moistFD)}</td>
            </tr>
            {/* Non-FD row */}
            <tr>
              <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>Non-FD</td>
              <td className="av-td r">
                <EditableCell value={nfdDays} onChange={v => onSetNfdDays(v ?? 0)} decimals={0} formatFn={v => fmtInt(v)} />
              </td>
              <td className="av-td r av-num" style={{ color: 'var(--muted)', ...groupBorder }}>{fmtInt(perDiem.pilotNFD)}</td>
              <td className="av-td r av-num">
                <span style={bhBonus}>{fmtInt(perDiem.bhBonusNFD)}</span>
              </td>
              <td className="av-td r av-num" style={{ color: 'var(--muted)', ...groupBorder }}>{fmtInt(perDiem.a321NFD)}</td>
              <td className="av-td r av-num" style={{ color: 'var(--muted)' }}>{fmtInt(perDiem.a320NFD)}</td>
              <td className="av-td r av-num" style={{ color: 'var(--muted)', ...groupBorder }}>{fmtInt(perDiem.moistNFD)}</td>
            </tr>
            {/* Totals row */}
            <tr style={{ background: 'var(--card-2)' }}>
              <td className="av-td"></td>
              <td className="av-td r" style={{ fontSize: 11, color: 'var(--muted)' }}>Per Diem per Crew Set</td>
              <td className="av-td r av-num" style={{ fontWeight: 700, color: 'var(--brand)', ...groupBorder }}>{fmtInt(perDiem.pilotTotal)}</td>
              <td className="av-td r av-num" style={{ fontWeight: 700, color: 'var(--brand)' }}>{fmtInt(perDiem.bhBonusTotal)}</td>
              <td className="av-td r av-num" style={{ fontWeight: 700, color: 'var(--brand)', ...groupBorder }}>{fmtInt(perDiem.a321Total)}</td>
              <td className="av-td r av-num" style={{ fontWeight: 700, color: 'var(--brand)' }}>{fmtInt(perDiem.a320Total)}</td>
              <td className="av-td r av-num" style={{ fontWeight: 700, color: 'var(--brand)', ...groupBorder }}>{fmtInt(perDiem.moistTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
