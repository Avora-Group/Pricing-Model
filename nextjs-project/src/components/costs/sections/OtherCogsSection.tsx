'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { FormulaCell, TableCard } from '@/components/ui/TableParts'
import type { OtherCogsItem } from '@/stores/costs-config-store'

const thClass = 'text-left px-3 py-2 text-[var(--text-tertiary)] font-medium text-[10px] uppercase tracking-wider'
const tdClass = 'px-3 py-1.5 text-sm text-[var(--text-secondary)]'
const tdLabelClass = 'px-3 py-1.5 text-sm text-[var(--text-secondary)] pl-4'
const trHover = 'hover:bg-gray-100/20 dark:bg-gray-800/20'

export interface OtherCogsSectionProps {
  data: OtherCogsItem[]
  onUpdate: (idx: number, field: 'perMonth' | 'total', value: number) => void
}

export function OtherCogsSection({ data, onUpdate }: OtherCogsSectionProps) {
  return (
    <TableCard>
      <thead>
        <tr className="border-b border-[var(--border-secondary)]">
          <th className={`${thClass} w-[260px]`}>Name</th>
          <th className={`${thClass} w-[160px] text-right`}>Total</th>
          <th className={`${thClass} w-[160px] text-right`}>Per Month / Per A/C</th>
          <th className={`${thClass} w-[160px]`}>P&L Mapping</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => (
          <tr key={i} className={trHover}>
            <td className={tdLabelClass}>{item.name}</td>
            <td className={tdClass}>
              {item.hasTotal ? (
                <EditableCell
                  value={item.total ?? 0}
                  onChange={(v) => onUpdate(i, 'total', v ?? 0)}
                  allowNull={false}
                  decimals={2}
                />
              ) : (
                <span className="block text-right text-sm text-[var(--text-muted)] px-2 py-0.5">&mdash;</span>
              )}
            </td>
            <td className={tdClass}>
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
            <td className={`${tdClass} text-[var(--text-muted)] text-xs`}>{item.mapping}</td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  )
}
