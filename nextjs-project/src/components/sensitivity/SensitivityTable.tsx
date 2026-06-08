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
    <div className="av-panel p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
        Comparison Table
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Step</th>
              <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">
                {paramLabel}{paramUnit ? ` (${paramUnit})` : ''}
              </th>
              <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Cost/BH</th>
              <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Net Profit</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => {
              const isBase = point.label === 'Base'

              return (
                <tr
                  key={point.label}
                  className={`border-b border-gray-200 dark:border-gray-800 ${isBase ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                >
                  <td className="py-2 px-3 text-gray-900 dark:text-gray-100 font-medium">{point.label}</td>
                  <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                    {point.paramValue.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-900 dark:text-gray-100">
                    {'\u20AC'}{point.eurPerBh.toFixed(0)}
                  </td>
                  <td className={`py-2 px-3 text-right font-mono ${point.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtNum(point.netProfit)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
