'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { FormulaCell, TableCard } from '@/components/ui/TableParts'
import type { MaintPersonnel } from '@/stores/costs-config-store'

// ---- Styles (local to Costs tables) ----
const thClass = 'text-left px-3 py-2 text-[var(--text-tertiary)] font-medium text-[10px] uppercase tracking-wider'
const tdClass = 'px-3 py-1.5 text-sm text-[var(--text-secondary)]'
const tdLabelClass = 'px-3 py-1.5 text-sm text-[var(--text-secondary)] pl-4'
const trHover = 'hover:bg-gray-100/20 dark:bg-gray-800/20'
const totalRowClass = 'border-t border-[var(--border-secondary)] font-semibold'

export interface MaintPersonnelSectionProps {
  data: MaintPersonnel[]
  totals: number[]
  grandTotal: number
  onUpdate: (idx: number, field: keyof MaintPersonnel, value: number) => void
}

export function MaintPersonnelSection({
  data,
  totals,
  grandTotal,
  onUpdate,
}: MaintPersonnelSectionProps) {
  return (
    <TableCard>
      <thead>
        <tr className="border-b border-[var(--border-secondary)]">
          <th className={`${thClass} w-[260px]`}>Name</th>
          <th className={`${thClass} w-[120px] text-right`}>No. Engineers per A/C</th>
          <th className={`${thClass} w-[140px] text-right`}>Per Diem, EUR/day</th>
          <th className={`${thClass} w-[100px] text-right`}>No. Days</th>
          <th className={`${thClass} w-[160px] text-right`}>Total Cost per A/C per Month</th>
        </tr>
      </thead>
      <tbody>
        {data.map((p, i) => (
          <tr key={i} className={trHover}>
            <td className={tdLabelClass}>{p.name}</td>
            <td className={tdClass}>
              <EditableCell value={p.engineers} onChange={(v) => onUpdate(i, 'engineers', v ?? 0)} allowNull={false} decimals={0} />
            </td>
            <td className={tdClass}>
              <EditableCell value={p.perDiem} onChange={(v) => onUpdate(i, 'perDiem', v ?? 0)} allowNull={false} decimals={0} />
            </td>
            <td className={tdClass}>
              <FormulaCell value={p.days} decimals={0} />
            </td>
            <td className={tdClass}>
              <FormulaCell value={totals[i]} decimals={2} />
            </td>
          </tr>
        ))}
        <tr className={totalRowClass}>
          <td className={`${tdClass} text-[var(--text-primary)]`} colSpan={4}>Total</td>
          <td className={tdClass}>
            <span className="block text-right text-sm text-[var(--text-primary)] font-semibold px-2 py-0.5">
              {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </td>
        </tr>
      </tbody>
    </TableCard>
  )
}
