'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { fmtEur } from '@/lib/format'
import type { CostRow, TrainingRow } from '@/stores/crew-config-store'

export interface OtherCostTrainingSectionProps {
  otherCost: CostRow[]
  training: TrainingRow[]
  otherCostPerMonth: (number | null)[]
  trainingPerMonth: (number | null)[]
  onUpdateOtherCost: (idx: number, value: number | null) => void
  onUpdateTraining: (idx: number, value: number | null) => void
}

export function OtherCostTrainingSection({
  otherCost,
  training,
  otherCostPerMonth,
  trainingPerMonth,
  onUpdateOtherCost,
  onUpdateTraining,
}: OtherCostTrainingSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
      {/* Other Cost */}
      <div className="av-panel">
        <div className="av-panel-h">
          <h2>Other cost</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="av-tbl">
            <thead>
              <tr>
                <th className="av-th">Item</th>
                <th className="av-th r">Amount</th>
                <th className="av-th r">Per month</th>
              </tr>
            </thead>
            <tbody>
              {otherCost.map((row, i) => (
                <tr key={i}>
                  <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.item}</td>
                  <td className="av-td r">
                    <EditableCell
                      value={row.amount}
                      onChange={v => onUpdateOtherCost(i, v)}
                      decimals={0}
                      formatFn={v => v !== null ? fmtEur(v, 0) : '-'}
                    />
                  </td>
                  <td className="av-td r av-num" style={{ color: 'var(--muted)' }}>
                    {otherCostPerMonth[i] !== null ? fmtEur(otherCostPerMonth[i]) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Training */}
      <div className="av-panel">
        <div className="av-panel-h">
          <h2>Training</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="av-tbl">
            <thead>
              <tr>
                <th className="av-th">Item</th>
                <th className="av-th r">Amount</th>
                <th className="av-th r">Per month</th>
              </tr>
            </thead>
            <tbody>
              {training.map((row, i) => (
                <tr key={i}>
                  <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.item}</td>
                  <td className="av-td r">
                    <EditableCell
                      value={row.amount}
                      onChange={v => onUpdateTraining(i, v)}
                      decimals={0}
                      formatFn={v => v !== null ? fmtEur(v, 0) : '-'}
                    />
                  </td>
                  <td className="av-td r av-num" style={{ color: 'var(--muted)' }}>
                    {trainingPerMonth[i] !== null ? fmtEur(trainingPerMonth[i]) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
