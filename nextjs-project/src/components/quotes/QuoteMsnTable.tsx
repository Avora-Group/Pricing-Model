'use client'

import type { MsnPnlSummary } from '@/lib/pnl-engine'
import type { QuoteMsnSnapshot } from '@/app/actions/quotes'
import { useCanViewCosts } from '@/providers/CostVisibilityProvider'
import { Redacted } from '@/components/common/Redacted'

interface QuoteMsnTableProps {
  msnSnapshots: QuoteMsnSnapshot[]
  msnSummaries: MsnPnlSummary[]
}

const fmtNum = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtDec = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function QuoteMsnTable({ msnSnapshots, msnSummaries }: QuoteMsnTableProps) {
  const canViewCosts = useCanViewCosts()
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

  // Per-BH figures for the summary report (revenue/cost/profit divided by
  // total block hours). Falls back to 0 when there are no block hours.
  const perBh = (v: number) => (totals.totalBh > 0 ? v / totals.totalBh : 0)

  return (
    <>
      {/* Summary report — Project Total + Per BH, mirrors the pricing workspace */}
      <div className="av-panel">
        <div className="av-panel-h"><h2>Summary report</h2></div>
        <div className="overflow-x-auto">
          <table className="av-bd-tbl">
            <thead>
              <tr className="head">
                <td>Line item</td>
                <td className="r">Project total</td>
                <td className="r">Per BH</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Revenue</td>
                <td className="r av-num">{fmtNum(totals.totalRevenue)}</td>
                <td className="r av-num">{fmtDec(perBh(totals.totalRevenue))}</td>
              </tr>
              {canViewCosts && (
                <tr>
                  <td>Cost</td>
                  <td className="r av-num">{fmtNum(totals.totalCost)}</td>
                  <td className="r av-num">{fmtDec(perBh(totals.totalCost))}</td>
                </tr>
              )}
              {canViewCosts && (
                <tr className="total">
                  <td>Net profit</td>
                  <td className={`r av-num ${totals.netProfit >= 0 ? 'av-pos' : 'av-neg'}`}>{fmtNum(totals.netProfit)}</td>
                  <td className={`r av-num ${totals.netProfit >= 0 ? 'av-pos' : 'av-neg'}`}>{fmtDec(perBh(totals.netProfit))}</td>
                </tr>
              )}
              <tr className="sub">
                <td>Block hours</td>
                <td className="r av-num">{fmtNum(totals.totalBh)}</td>
                <td className="r av-num">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="av-panel">
        <div className="av-panel-h"><h2>MSN breakdown</h2></div>
        <div className="overflow-x-auto">
          <table className="av-tbl">
            <thead>
              <tr>
                <th className="av-th">MSN</th>
                <th className="av-th">Type</th>
                <th className="av-th r">ACMI rate/BH</th>
                {canViewCosts && <th className="av-th r">ACMI cost/BH</th>}
                {canViewCosts && <th className="av-th r">Net profit</th>}
              </tr>
            </thead>
            <tbody>
              {msnSnapshots.map((snap, idx) => {
                const summary = msnSummaries[idx]
                if (!summary) return null

                return (
                  <tr key={snap.id}>
                    <td className="av-td"><span className="av-msn">{snap.msn}</span></td>
                    <td className="av-td" style={{ color: 'var(--ink-2)' }}>{snap.aircraft_type}</td>
                    <td className="av-td av-num r font-medium" style={{ color: 'var(--cyan-ink)' }}>{fmtDec(summary.acmiRatePerBh)}</td>
                    {canViewCosts && <td className="av-td av-num r" style={{ color: 'var(--ink-2)' }}>{fmtNum(summary.acmiCostPerBh)}</td>}
                    {canViewCosts && <td className={`av-td av-num r ${summary.netProfit >= 0 ? 'av-pos' : 'av-neg'}`}>{fmtNum(summary.netProfit)}</td>}
                  </tr>
                )
              })}
              {msnSummaries.length > 1 && (
                <tr style={{ background: 'var(--card-2)' }}>
                  <td className="av-td font-semibold" style={{ borderTop: '1.5px solid var(--line)' }}>Total</td>
                  <td className="av-td" style={{ color: 'var(--muted)', borderTop: '1.5px solid var(--line)' }}>{msnSummaries.length} A/C</td>
                  <td className="av-td av-num r font-semibold" style={{ color: 'var(--cyan-ink)', borderTop: '1.5px solid var(--line)' }}>{fmtDec(totalAcmiRatePerBh)}</td>
                  {canViewCosts && <td className="av-td av-num r font-semibold" style={{ borderTop: '1.5px solid var(--line)' }}>{fmtNum(totalAcmiCostPerBh)}</td>}
                  {canViewCosts && <td className={`av-td av-num r font-semibold ${totals.netProfit >= 0 ? 'av-pos' : 'av-neg'}`} style={{ borderTop: '1.5px solid var(--line)' }}>{fmtNum(totals.netProfit)}</td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
