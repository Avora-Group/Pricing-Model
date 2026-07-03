'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { FormulaCell } from '@/components/ui/TableParts'
import type { OverheadItem } from '@/stores/costs-config-store'

export interface OverheadSectionProps {
  data: OverheadItem[]
  perMonth: number[]
  totalPerMonth: number
  onUpdate: (idx: number, value: number) => void
}

export function OverheadSection({ data, perMonth, totalPerMonth, onUpdate }: OverheadSectionProps) {
  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>Overhead</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="av-tbl">
          <thead>
            <tr>
              <th className="av-th" style={{ width: 300 }}>Name</th>
              <th className="av-th r" style={{ width: 160 }}>Total</th>
              <th className="av-th r" style={{ width: 160 }}>Per month</th>
              <th className="av-th" style={{ width: 220 }}>P&amp;L mapping</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i}>
                <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.name}</td>
                <td className="av-td r">
                  <EditableCell value={item.total} onChange={(v) => onUpdate(i, v ?? 0)} allowNull={false} decimals={2} />
                </td>
                <td className="av-td r">
                  <FormulaCell value={perMonth[i]} decimals={2} />
                </td>
                <td className="av-td" style={{ color: 'var(--muted)', fontSize: 12 }}>{item.mapping}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--card-2)' }}>
              <td className="av-td" colSpan={2} style={{ fontWeight: 800, color: 'var(--brand)' }}>Total Overhead</td>
              <td className="av-td r av-num" style={{ fontWeight: 800, color: 'var(--brand)' }}>
                {totalPerMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="av-td" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
