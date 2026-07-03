'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { FormulaCell } from '@/components/ui/TableParts'
import type { OtherCogsItem } from '@/stores/costs-config-store'

export interface OtherCogsSectionProps {
  data: OtherCogsItem[]
  onUpdate: (idx: number, field: 'perMonth' | 'total', value: number) => void
}

export function OtherCogsSection({ data, onUpdate }: OtherCogsSectionProps) {
  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>Other COGS</h2>
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
                  {item.hasTotal ? (
                    <EditableCell
                      value={item.total ?? 0}
                      onChange={(v) => onUpdate(i, 'total', v ?? 0)}
                      allowNull={false}
                      decimals={2}
                    />
                  ) : (
                    <span className="av-num" style={{ color: 'var(--muted)' }}>&mdash;</span>
                  )}
                </td>
                <td className="av-td r">
                  {item.hasTotal ? (
                    <FormulaCell value={item.perMonth} decimals={2} />
                  ) : (
                    <EditableCell
                      value={item.perMonth}
                      onChange={(v) => onUpdate(i, 'perMonth', v ?? 0)}
                      allowNull={false}
                      decimals={0}
                    />
                  )}
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
