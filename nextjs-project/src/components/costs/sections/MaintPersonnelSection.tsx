'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { FormulaCell } from '@/components/ui/TableParts'
import type { MaintPersonnel } from '@/stores/costs-config-store'

export interface MaintPersonnelSectionProps {
  data: MaintPersonnel[]
  totals: number[]
  grandTotal: number
  onUpdate: (idx: number, field: keyof MaintPersonnel, value: number) => void
}

export function MaintPersonnelSection({
  data,
  totals,
  grandTotal,
  onUpdate,
}: MaintPersonnelSectionProps) {
  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>Maintenance personnel cost</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="av-tbl">
          <thead>
            <tr>
              <th className="av-th" style={{ width: 260 }}>Name</th>
              <th className="av-th r" style={{ width: 120 }}>Engineers / A/C</th>
              <th className="av-th r" style={{ width: 140 }}>Per diem, EUR/day</th>
              <th className="av-th r" style={{ width: 100 }}>Days</th>
              <th className="av-th r" style={{ width: 160 }}>Total / A/C / mo</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={i}>
                <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.name}</td>
                <td className="av-td r">
                  <EditableCell value={p.engineers} onChange={(v) => onUpdate(i, 'engineers', v ?? 0)} allowNull={false} decimals={0} />
                </td>
                <td className="av-td r">
                  <EditableCell value={p.perDiem} onChange={(v) => onUpdate(i, 'perDiem', v ?? 0)} allowNull={false} decimals={0} />
                </td>
                <td className="av-td r">
                  <FormulaCell value={p.days} decimals={0} />
                </td>
                <td className="av-td r">
                  <FormulaCell value={totals[i]} decimals={2} />
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--card-2)' }}>
              <td className="av-td" colSpan={4} style={{ fontWeight: 800, color: 'var(--brand)' }}>Total</td>
              <td className="av-td r av-num" style={{ fontWeight: 800, color: 'var(--brand)' }}>
                {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
