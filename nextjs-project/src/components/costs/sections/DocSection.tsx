'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { FormulaCell } from '@/components/ui/TableParts'
import type { DocItem } from '@/stores/costs-config-store'

export interface DocSectionProps {
  data: DocItem[]
  perMonth: number[]
  onUpdate: (idx: number, value: number) => void
}

export function DocSection({ data, perMonth, onUpdate }: DocSectionProps) {
  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>DOC (Direct Operating Cost)</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="av-tbl">
          <thead>
            <tr>
              <th className="av-th" style={{ width: 260 }}>Name</th>
              <th className="av-th r" style={{ width: 160 }}>Total</th>
              <th className="av-th r" style={{ width: 160 }}>Per month / A/C</th>
              <th className="av-th" style={{ width: 160 }}>P&amp;L mapping</th>
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
          </tbody>
        </table>
      </div>
    </div>
  )
}
