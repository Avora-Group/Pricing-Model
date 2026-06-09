'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { FormulaCell, TableCard } from '@/components/ui/TableParts'
import type { OverheadItem } from '@/stores/costs-config-store'

const thClass = 'text-left px-3 py-2 text-[var(--text-tertiary)] font-medium text-[10px] uppercase tracking-wider'
const tdClass = 'px-3 py-1.5 text-sm text-[var(--text-secondary)]'
const tdLabelClass = 'px-3 py-1.5 text-sm text-[var(--text-secondary)] pl-4'
const trHover = 'hover:bg-gray-100/20 dark:bg-gray-800/20'
const totalRowClass = 'border-t border-[var(--border-secondary)] font-semibold'

export interface OverheadSectionProps {
  data: OverheadItem[]
  perMonth: number[]
  totalPerMonth: number
  onUpdate: (idx: number, value: number) => void
}

export function OverheadSection({ data, perMonth, totalPerMonth, onUpdate }: OverheadSectionProps) {
  return (
    <TableCard>
      <thead>
        <tr className="border-b border-[var(--border-secondary)]">
          <th className={`${thClass} w-[300px]`}>Name</th>
          <th className={`${thClass} w-[160px] text-right`}>Total</th>
          <th className={`${thClass} w-[160px] text-right`}>Per Month</th>
          <th className={`${thClass} w-[220px]`}>P&L Mapping</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => (
          <tr key={i} className={trHover}>
            <td className={tdLabelClass}>{item.name}</td>
            <td className={tdClass}>
              <EditableCell value={item.total} onChange={(v) => onUpdate(i, v ?? 0)} allowNull={false} decimals={2} />
            </td>
            <td className={tdClass}>
              <FormulaCell value={perMonth[i]} decimals={2} />
            </td>
            <td className={`${tdClass} text-[var(--text-muted)] text-xs`}>{item.mapping}</td>
          </tr>
        ))}
        <tr className={totalRowClass}>
          <td className={`${tdClass} text-[var(--text-primary)]`} colSpan={2}>Total Overhead</td>
          <td className={tdClass}>
            <span className="block text-right text-sm text-[var(--text-primary)] font-semibold px-2 py-0.5">
              {totalPerMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </td>
          <td />
        </tr>
      </tbody>
    </TableCard>
  )
}
