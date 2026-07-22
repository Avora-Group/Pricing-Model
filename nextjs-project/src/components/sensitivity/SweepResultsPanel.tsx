'use client'

import { fmt } from '@/lib/format'
import { SensitivityChart } from './SensitivityChart'
import type { SweepResult } from './useSensitivitySweep'

interface SweepResultsPanelProps {
  result: SweepResult
  /** Workspace inputs changed since this sweep ran. */
  stale: boolean
}

export function SweepResultsPanel({ result, stale }: SweepResultsPanelProps) {
  const paramLabel = result.params.map((p) => p.label).join(' + ')
  const chartData = result.rows.map((r) => ({
    label: r.label,
    paramValue: 0,
    eurPerBh: r.eurPerBh,
    netProfit: r.netProfit,
  }))
  const marginTone = (m: number) =>
    m >= 0.1 ? 'var(--pos)' : m >= 0.02 ? 'var(--amber)' : 'var(--neg)'

  return (
    <div className="space-y-[18px]">
      {stale && (
        <div
          className="rounded-lg px-4 py-2.5 text-xs font-semibold"
          style={{ background: 'var(--amber-soft)', color: 'var(--amber)', border: '1px solid var(--amber)' }}
        >
          Inputs have changed since this sweep — run the analysis again to refresh.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <SensitivityChart data={chartData} paramLabel={paramLabel} />

        <div className="av-panel overflow-hidden">
          <div className="av-panel-h">
            <h2>Sweep · {paramLabel}</h2>
            <span className="av-hint">{result.scopeLabel} · figures in EUR</span>
          </div>
          <div className="overflow-x-auto">
            <table className="av-tbl w-full">
              <thead>
                <tr>
                  <th className="av-th">Step</th>
                  {result.params.map((p) => (
                    <th key={p.key} className="av-th r">
                      {p.label}
                      {p.unit ? ` (${p.unit})` : ''}
                    </th>
                  ))}
                  <th className="av-th r">Cost/BH</th>
                  <th className="av-th r">Net profit</th>
                  <th className="av-th r">Margin</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => {
                  const isBase = row.label === 'Base'
                  return (
                    <tr key={row.label} style={isBase ? { background: 'var(--hover)' } : undefined}>
                      <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.label}</td>
                      {result.params.map((p) => (
                        <td key={p.key} className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>
                          {fmt(row.values[p.key], p.key === 'cycleRatio' ? 2 : 0)}
                        </td>
                      ))}
                      <td className="av-td r av-num" style={{ color: 'var(--ink)' }}>{fmt(row.eurPerBh, 0)}</td>
                      <td className={`av-td r av-num ${row.netProfit >= 0 ? 'av-pos' : 'av-neg'}`}>
                        {fmt(row.netProfit, 0)}
                      </td>
                      <td className="av-td r av-num" style={{ color: marginTone(row.margin) }}>
                        {(row.margin * 100).toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
