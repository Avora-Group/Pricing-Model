'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { TableCard } from '@/components/ui/TableParts'
import type { InsuranceItem } from '@/stores/costs-config-store'

const thClass = 'text-left px-3 py-2 text-[var(--text-tertiary)] font-medium text-[10px] uppercase tracking-wider'
const tdClass = 'px-3 py-1.5 text-sm text-[var(--text-secondary)]'
const tdLabelClass = 'px-3 py-1.5 text-sm text-[var(--text-secondary)] pl-4'
const trHover = 'hover:bg-gray-100/20 dark:bg-gray-800/20'
const totalRowClass = 'border-t border-[var(--border-secondary)] font-semibold'

export interface InsuranceSectionProps {
  data: InsuranceItem[]
  total: number
  onUpdate: (idx: number, value: number) => void
}

export function InsuranceSection({ data, total, onUpdate }: InsuranceSectionProps) {
  return (
    <TableCard>
      <thead>
        <tr className="border-b border-[var(--border-secondary)]">
          <th className={`${thClass} w-[200px]`}>MSN</th>
          <th className={`${thClass} w-[160px] text-right`}>Price, USD</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => (
          <tr key={i} className={trHover}>
            <td className={tdLabelClass}>{item.msn}</td>
            <td className={tdClass}>
              <EditableCell
                value={item.priceUsd}
                onChange={(v) => onUpdate(i, v ?? 0)}
                allowNull={false}
                decimals={0}
              />
            </td>
          </tr>
        ))}
        <tr className={totalRowClass}>
          <td className={`${tdClass} text-[var(--text-primary)]`}>Total</td>
          <td className={tdClass}>
            <span className="block text-right text-sm text-[var(--text-primary)] font-semibold px-2 py-0.5">
              {total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </td>
        </tr>
      </tbody>
    </TableCard>
  )
}
