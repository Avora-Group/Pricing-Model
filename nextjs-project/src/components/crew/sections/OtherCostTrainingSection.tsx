'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { fmtEur } from '@/lib/format'
import { thBase, tdBase, tdLabel, tdComputed, borderRow } from '@/components/ui/table-styles'
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Other Cost */}
      <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">OTHER COST</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-secondary)] bg-gray-100/40 dark:bg-gray-800/40">
              <th className={`${thBase} text-left`}>Item</th>
              <th className={`${thBase} text-right`}>Amount</th>
              <th className={`${thBase} text-right`}>Per Month</th>
            </tr>
          </thead>
          <tbody>
            {otherCost.map((row, i) => (
              <tr key={i} className={borderRow}>
                <td className={tdLabel}>{row.item}</td>
                <td className={`${tdBase} text-right`}>
                  <EditableCell
                    value={row.amount}
                    onChange={v => onUpdateOtherCost(i, v)}
                    decimals={0}
                    formatFn={v => v !== null ? fmtEur(v, 0) : '-'}
                  />
                </td>
                <td className={tdComputed}>
                  {otherCostPerMonth[i] !== null ? fmtEur(otherCostPerMonth[i]) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Training */}
      <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Training</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-secondary)] bg-gray-100/40 dark:bg-gray-800/40">
              <th className={`${thBase} text-left`}>Item</th>
              <th className={`${thBase} text-right`}>Amount</th>
              <th className={`${thBase} text-right`}>Per Month</th>
            </tr>
          </thead>
          <tbody>
            {training.map((row, i) => (
              <tr key={i} className={borderRow}>
                <td className={tdLabel}>{row.item}</td>
                <td className={`${tdBase} text-right`}>
                  <EditableCell
                    value={row.amount}
                    onChange={v => onUpdateTraining(i, v)}
                    decimals={0}
                    formatFn={v => v !== null ? fmtEur(v, 0) : '-'}
                  />
                </td>
                <td className={tdComputed}>
                  {trainingPerMonth[i] !== null ? fmtEur(trainingPerMonth[i]) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
