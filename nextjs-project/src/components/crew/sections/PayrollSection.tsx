'use client'

import { EditableCell } from '@/components/ui/EditableCell'
import { fmt, fmtInt, fmtEur } from '@/lib/format'
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
  const loadedMonthlyBase = payroll.reduce((a, r) => a + r.grossSalary + r.benefits, 0)

  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>Payroll data June 2025</h2>
        <span className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>
          Average A/C:
          <EditableCell value={averageAC} onChange={v => onSetAverageAC(v ?? 1)} />
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="av-tbl">
          <thead>
            <tr>
              <th className="av-th">Position</th>
              <th className="av-th r">Gross salary, EUR</th>
              <th className="av-th r">Benefits, EUR</th>
              <th className="av-th r">Social security, BGN</th>
              <th className="av-th r">Per diem FD, EUR</th>
              <th className="av-th r">Per diem NFD, EUR</th>
              <th className="av-th r">Per BH Perdiem EUR</th>
            </tr>
          </thead>
          <tbody>
            {payroll.map((row, i) => (
              <tr key={i}>
                <td className="av-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.position}</td>
                <td className="av-td r">
                  <EditableCell value={row.grossSalary} onChange={v => onUpdatePayroll(i, 'grossSalary', v)} />
                </td>
                <td className="av-td r">
                  <EditableCell value={row.benefits} onChange={v => onUpdatePayroll(i, 'benefits', v)} />
                </td>
                <td className="av-td r av-num" style={{ color: 'var(--muted)' }}>{fmt(socialSecurity[i])}</td>
                <td className="av-td r">
                  <EditableCell value={row.perDiemFD} onChange={v => onUpdatePayroll(i, 'perDiemFD', v)} decimals={0} formatFn={v => fmtInt(v)} />
                </td>
                <td className="av-td r">
                  <EditableCell value={row.perDiemNFD} onChange={v => onUpdatePayroll(i, 'perDiemNFD', v)} decimals={0} formatFn={v => fmtInt(v)} />
                </td>
                <td className="av-td r">
                  {i <= 1 ? (
                    <EditableCell value={row.perBhPerdiem} onChange={v => onUpdatePayroll(i, 'perBhPerdiem', v)} decimals={0} formatFn={v => fmtInt(v)} />
                  ) : (
                    <span className="av-num" style={{ color: 'var(--muted)' }}>{fmtInt(row.perBhPerdiem)}</span>
                  )}
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--card-2)' }}>
              <td className="av-td" style={{ fontWeight: 800, color: 'var(--brand)' }}>Loaded monthly base</td>
              <td className="av-td r av-num" colSpan={6} style={{ fontWeight: 800, color: 'var(--brand)' }}>
                {fmtEur(loadedMonthlyBase, 2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
