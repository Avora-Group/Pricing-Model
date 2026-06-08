import type { MsnPnlSummary } from '@/lib/pnl-engine'
import type { QuoteMsnSnapshot } from '@/app/actions/quotes'

interface QuoteMsnTableProps {
  msnSnapshots: QuoteMsnSnapshot[]
  msnSummaries: MsnPnlSummary[]
}

const fmtNum = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtDec = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function QuoteMsnTable({ msnSnapshots, msnSummaries }: QuoteMsnTableProps) {
  // Compute totals across all MSNs
  const totals = msnSummaries.reduce(
    (acc, s) => ({
      totalRevenue: acc.totalRevenue + s.totalRevenue,
      totalCost: acc.totalCost + s.totalCost,
      netProfit: acc.netProfit + s.netProfit,
      totalBh: acc.totalBh + s.totalBh,
    }),
    { totalRevenue: 0, totalCost: 0, netProfit: 0, totalBh: 0 },
  )
  const totalAcmiCostPerBh = totals.totalBh > 0 ? totals.totalCost / totals.totalBh : 0
  const totalAcmiRatePerBh = totals.totalBh > 0 ? totals.totalRevenue / totals.totalBh : 0

  return (
    <div className="av-panel">
      <div className="av-panel-h"><h2>MSN breakdown</h2></div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] border-collapse">
        <thead>
          <tr>
            <th className="av-th">MSN</th>
            <th className="av-th">Type</th>
            <th className="av-th text-right">ACMI rate/BH</th>
            <th className="av-th text-right">ACMI cost/BH</th>
            <th className="av-th text-right">Net profit</th>
          </tr>
        </thead>
        <tbody>
          {msnSnapshots.map((snap, idx) => {
            const summary = msnSummaries[idx]
            if (!summary) return null

            return (
              <tr key={snap.id} className="hover:bg-[var(--bg-secondary)]">
                <td className="av-td"><span className="av-msn">{snap.msn}</span></td>
                <td className="av-td text-[var(--text-secondary)]">{snap.aircraft_type}</td>
                <td className="av-td av-num text-right font-medium text-[var(--av-accent-ink)]">{fmtDec(summary.acmiRatePerBh)}</td>
                <td className="av-td av-num text-right text-[var(--text-secondary)]">{fmtNum(summary.acmiCostPerBh)}</td>
                <td className={`av-td av-num text-right ${summary.netProfit >= 0 ? 'av-pos' : 'av-neg'}`}>{fmtNum(summary.netProfit)}</td>
              </tr>
            )
          })}
          {msnSummaries.length > 1 && (
            <tr className="bg-[var(--bg-secondary)] [&>td]:border-t-2 [&>td]:border-[var(--border-secondary)]">
              <td className="av-td font-semibold">Total</td>
              <td className="av-td text-[var(--text-muted)]">{msnSummaries.length} A/C</td>
              <td className="av-td av-num text-right font-semibold text-[var(--av-accent-ink)]">{fmtDec(totalAcmiRatePerBh)}</td>
              <td className="av-td av-num text-right font-semibold">{fmtNum(totalAcmiCostPerBh)}</td>
              <td className={`av-td av-num text-right font-semibold ${totals.netProfit >= 0 ? 'av-pos' : 'av-neg'}`}>{fmtNum(totals.netProfit)}</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
