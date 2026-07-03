'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import type { InsuranceItem } from '@/stores/costs-config-store'

export interface InsuranceSectionProps {
  data: InsuranceItem[]
  total: number
  onUpdate: (idx: number, value: number) => void
}

export function InsuranceSection({ data, total, onUpdate }: InsuranceSectionProps) {
  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>Insurance</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="av-tbl">
          <thead>
            <tr>
              <th className="av-th" style={{ width: 200 }}>MSN</th>
              <th className="av-th r" style={{ width: 160 }}>Price, USD</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i}>
                <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.msn}</td>
                <td className="av-td r">
                  <EditableCell
                    value={item.priceUsd}
                    onChange={(v) => onUpdate(i, v ?? 0)}
                    allowNull={false}
                    decimals={0}
                  />
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--card-2)' }}>
              <td className="av-td" style={{ fontWeight: 800, color: 'var(--brand)' }}>Total</td>
              <td className="av-td r av-num" style={{ fontWeight: 800, color: 'var(--brand)' }}>
                {total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
