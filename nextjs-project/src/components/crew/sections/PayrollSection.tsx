'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { fmt, fmtInt } from '@/lib/format'
import { thBase, tdBase, tdLabel, tdComputed, borderRow } from '@/components/ui/table-styles'
import type { PayrollRow } from '@/stores/crew-config-store'

export interface PayrollSectionProps {
  payroll: PayrollRow[]
  socialSecurity: number[]
  averageAC: number
  onUpdatePayroll: (idx: number, field: keyof PayrollRow, value: number | null) => void
  onSetAverageAC: (v: number) => void
}

export function PayrollSection({
  payroll,
  socialSecurity,
  averageAC,
  onUpdatePayroll,
  onSetAverageAC,
}: PayrollSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Payroll data June 2025</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">F2S</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-secondary)] bg-gray-100/40 dark:bg-gray-800/40">
              <th className={`${thBase} text-left`}>Position</th>
              <th className={`${thBase} text-right`}>Gross Salary, EUR</th>
              <th className={`${thBase} text-right`}>Benefits, EUR</th>
              <th className={`${thBase} text-right`}>Social security, BGN</th>
              <th className={`${thBase} text-right`}>Per diem rate - FD, EUR</th>
              <th className={`${thBase} text-right`}>Per diem rate - NFD, EUR</th>
              <th className={`${thBase} text-right`}>Per BH Perdiem EUR</th>
            </tr>
          </thead>
          <tbody>
            {payroll.map((row, i) => (
              <tr key={i} className={borderRow}>
                <td className={tdLabel}>{row.position}</td>
                <td className={`${tdBase} text-right`}>
                  <EditableCell value={row.grossSalary} onChange={v => onUpdatePayroll(i, 'grossSalary', v)} />
                </td>
                <td className={`${tdBase} text-right`}>
                  <EditableCell value={row.benefits} onChange={v => onUpdatePayroll(i, 'benefits', v)} />
                </td>
                <td className={tdComputed}>{fmt(socialSecurity[i])}</td>
                <td className={`${tdBase} text-right`}>
                  <EditableCell value={row.perDiemFD} onChange={v => onUpdatePayroll(i, 'perDiemFD', v)} decimals={0} formatFn={v => fmtInt(v)} />
                </td>
                <td className={`${tdBase} text-right`}>
                  <EditableCell value={row.perDiemNFD} onChange={v => onUpdatePayroll(i, 'perDiemNFD', v)} decimals={0} formatFn={v => fmtInt(v)} />
                </td>
                <td className={`${tdBase} text-right`}>
                  {i <= 1 ? (
                    <EditableCell value={row.perBhPerdiem} onChange={v => onUpdatePayroll(i, 'perBhPerdiem', v)} decimals={0} formatFn={v => fmtInt(v)} />
                  ) : (
                    <span className="av-num text-[var(--text-muted)]">{fmtInt(row.perBhPerdiem)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-[var(--border-secondary)] bg-gray-100/30 dark:bg-gray-800/30 flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-tertiary)]">Average AC:</span>
        <EditableCell value={averageAC} onChange={v => onSetAverageAC(v ?? 1)} />
      </div>
    </div>
  )
}
