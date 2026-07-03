'use client'

import type { DataPoint } from './SensitivityChart'

interface SensitivityTableProps {
  data: DataPoint[]
  paramLabel: string
  paramUnit: string
}

export function SensitivityTable({ data, paramLabel, paramUnit }: SensitivityTableProps) {
  const fmtNum = (v: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>Comparison Table</h2>
      </div>
      <div className="av-card-b">
        <div className="overflow-x-auto">
          <table className="av-tbl">
            <thead>
              <tr>
                <th className="av-th">Step</th>
                <th className="av-th r">
                  {paramLabel}{paramUnit ? ` (${paramUnit})` : ''}
                </th>
                <th className="av-th r">Cost/BH</th>
                <th className="av-th r">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => {
                const isBase = point.label === 'Base'

                return (
                  <tr key={point.label} style={isBase ? { background: 'var(--hover)' } : undefined}>
                    <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{point.label}</td>
                    <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>
                      {point.paramValue.toFixed(2)}
                    </td>
                    <td className="av-td r av-num" style={{ color: 'var(--ink)' }}>
                      {'€'}{point.eurPerBh.toFixed(0)}
                    </td>
                    <td className={`av-td r av-num ${point.netProfit >= 0 ? 'av-pos' : 'av-neg'}`}>
                      {fmtNum(point.netProfit)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
