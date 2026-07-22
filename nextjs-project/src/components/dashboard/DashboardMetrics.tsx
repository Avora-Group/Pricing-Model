'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Calculator, TrendingUp } from 'lucide-react'
import { StatusBadge } from '@/components/quotes/StatusBadge'
import { FleetBoard, type CalendarSegment, type FleetTail } from './FleetBoard'
import { useCanViewCosts } from '@/providers/CostVisibilityProvider'

// ---- Types (mirror the dashboard payload) ----

interface MsnMetrics {
  msn: number
  aircraft_type: string
  mgh: string | null
  cycle_ratio: string | null
  crew_sets: string | null
  environment: string | null
  lease_type: string | null
  eur_per_bh: string | null
  period_months: string | null
  monthly_revenue: string | null
  monthly_cost: string | null
  monthly_profit: string | null
}

interface ProjectQuoteRef {
  quote_number: string
  status: string
  created_at: string | null
}

interface DashboardProject {
  id: number
  name: string
  status: string
  created_at: string | null
  created_by: string | null
  msn_count: number
  total_mgh: string | null
  period_months: number | null
  monthly_revenue: string | null
  monthly_cost: string | null
  monthly_profit: string | null
  total_revenue: string | null
  total_profit: string | null
  margin_percent: string | null
  eur_per_bh: string | null
  quote: ProjectQuoteRef | null
  msns: MsnMetrics[]
}

export interface DashboardData {
  projects: DashboardProject[]
  project_counts: { sent: number; signed: number; active: number; total: number }
  quote_counts: {
    draft: number; sent: number; signed: number; active: number; completed: number; rejected: number; total: number
  }
  averages: { eur_per_bh: string | null; margin_percent: string | null }
  calendar: CalendarSegment[]
  fleet: FleetTail[]
  /** Server-rendered date (YYYY-MM-DD) so the board's today line hydrates cleanly. */
  today: string
}

// ---- Formatting ----

const n = (v: string | null | undefined) =>
  v === null || v === undefined || v === '' ? null : Number(v)

function eur(v: string | null | undefined, digits = 0): string {
  const x = n(v)
  if (x === null || isNaN(x)) return '—'
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(x)} €`
}
function eurM(v: number): string {
  return `€${(v / 1_000_000).toLocaleString('en-GB', { maximumFractionDigits: 2 })}M`
}
function num(v: string | null | undefined, digits = 0): string {
  const x = n(v)
  if (x === null || isNaN(x)) return '—'
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(x)
}
function profitClass(v: string | null | undefined): string {
  const x = n(v)
  if (x === null || isNaN(x) || x === 0) return ''
  return x > 0 ? 'av-pos' : 'av-neg'
}
function signed(v: string | null | undefined, digits = 0): string {
  const x = n(v)
  if (x === null || isNaN(x)) return '—'
  const s = eur(v, digits)
  return x > 0 ? `+${s}` : s
}
function shortDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

// Signed contract value, average rate, and fleet committed reflect only
// signed + active deals (not completed/sent).
const COMMITTED = new Set(['active', 'signed'])

interface Rollup {
  signedValue: number
  pipelineValue: number
  /** Total committed value split by status, for the pipeline flow strip. */
  signedOnlyValue: number
  activeValue: number
  /** Distinct MSNs on committed deals (an MSN on two deals counts once). */
  committedMsn: number
  avgRate: string | null
  avgMargin: string | null
  monthlyRevenue: number
  monthlyProfit: number
  lifetimeProfit: number
}

function rollup(data: DashboardData): Rollup {
  let signedValue = 0
  let pipelineValue = 0
  let signedOnlyValue = 0
  let activeValue = 0
  let rateWeightSum = 0
  let rateWeight = 0
  let sumRev = 0
  let sumProfit = 0
  let monthlyRevenue = 0
  let monthlyProfit = 0
  let lifetimeProfit = 0
  const committedMsns = new Set<number>()
  for (const p of data.projects) {
    const rev = n(p.total_revenue) ?? 0
    if (COMMITTED.has(p.status)) {
      signedValue += rev
      if (p.status === 'active') activeValue += rev
      else signedOnlyValue += rev
      for (const m of p.msns) committedMsns.add(m.msn)
      const rate = n(p.eur_per_bh)
      const mgh = n(p.total_mgh)
      if (rate && mgh) {
        rateWeightSum += rate * mgh
        rateWeight += mgh
      }
      sumRev += rev
      sumProfit += n(p.total_profit) ?? 0
      monthlyRevenue += n(p.monthly_revenue) ?? 0
      monthlyProfit += n(p.monthly_profit) ?? 0
      lifetimeProfit += n(p.total_profit) ?? 0
    } else if (p.status === 'sent') {
      pipelineValue += rev
    }
  }
  return {
    signedValue,
    pipelineValue,
    signedOnlyValue,
    activeValue,
    committedMsn: committedMsns.size,
    avgRate: rateWeight > 0 ? String(rateWeightSum / rateWeight) : null,
    avgMargin: sumRev > 0 ? String((sumProfit / sumRev) * 100) : null,
    monthlyRevenue,
    monthlyProfit,
    lifetimeProfit,
  }
}

// ---- KPI band ----

function KpiBand({ data, r, canViewCosts }: { data: DashboardData; r: Rollup; canViewCosts: boolean }) {
  const fleetTotal = data.fleet.length
  const available = fleetTotal > 0 ? Math.max(0, fleetTotal - r.committedMsn) : null
  return (
    <div className="av-kpi-row">
      <div className="av-kpi k-navy">
        <div className="lab">Committed value</div>
        <div className="val av-num">{eurM(r.signedValue)}</div>
        <div className="sub">
          signed &amp; active
          {canViewCosts && <> · {eurM(r.lifetimeProfit)} lifetime profit</>}
        </div>
      </div>
      <div className="av-kpi k-navy">
        <div className="lab">Avg rate</div>
        <div className="val av-num">
          {num(r.avgRate)} <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>€/BH</span>
        </div>
        <div className="sub">{canViewCosts ? `${num(r.avgMargin, 1)}% blended margin` : 'signed & active deals'}</div>
      </div>
      <div className="av-kpi k-green">
        <div className="lab">Fleet committed</div>
        <div className="val av-num">
          {r.committedMsn}
          {fleetTotal > 0 && <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}> of {fleetTotal} MSN</span>}
        </div>
        <div className="sub">{available !== null ? `${available} tails available` : 'on signed & active deals'}</div>
      </div>
      <div className="av-kpi k-green">
        <div className="lab">Monthly run-rate</div>
        <div className="val av-num">{eur(String(r.monthlyRevenue))}</div>
        {canViewCosts ? (
          <div className={`sub av-num ${r.monthlyProfit >= 0 ? 'av-pos' : 'av-neg'}`}>
            {signed(String(r.monthlyProfit))} profit / mo
          </div>
        ) : (
          <div className="sub">committed revenue</div>
        )}
      </div>
    </div>
  )
}

// ---- Charts ----

const STATUS_FILL: Record<string, string> = {
  active: 'av-hbar-fill',
  signed: 'av-hbar-fill sig',
  sent: 'av-hbar-fill snt',
}

function RevenueByClient({ data }: { data: DashboardData }) {
  const rows = data.projects
    .map((p) => ({ name: p.name, status: p.status, rev: n(p.monthly_revenue) ?? 0 }))
    .filter((x) => x.rev > 0)
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 7)
  const max = Math.max(...rows.map((x) => x.rev), 1)

  return (
    <div className="av-panel">
      <div className="av-panel-h"><h2>Monthly revenue by client</h2></div>
      <div className="av-card-b">
        {rows.length === 0 ? (
          <div className="text-center py-6 text-[13px]" style={{ color: 'var(--muted)' }}>No revenue yet.</div>
        ) : (
          rows.map((x) => (
            <div className="av-hbar-row" key={x.name}>
              <div className="nm" title={x.name}>{x.name}</div>
              <div className="av-hbar-track">
                <div className={STATUS_FILL[x.status] ?? 'av-hbar-fill'} style={{ width: `${(x.rev / max) * 100}%` }} />
              </div>
              <div className="vl av-num">{eur(String(x.rev))}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function PipelineFlow({ data, r }: { data: DashboardData; r: Rollup }) {
  const stages = [
    { label: 'Draft', count: data.quote_counts.draft, value: null as string | null, color: 'var(--muted)' },
    { label: 'Sent', count: data.project_counts.sent, value: eurM(r.pipelineValue), color: '#18B4D8' },
    { label: 'Signed', count: data.project_counts.signed, value: eurM(r.signedOnlyValue), color: '#3f56b0' },
    { label: 'Active', count: data.project_counts.active, value: eurM(r.activeValue), color: '#2cc39c' },
  ]
  return (
    <div className="av-panel flex flex-col">
      <div className="av-panel-h"><h2>Pipeline flow</h2><span className="av-hint">count · open value</span></div>
      <div className="av-flow">
        {stages.map((s) => (
          <div className="av-flow-stage" key={s.label}>
            <div className="c av-num" style={{ color: s.color }}>{s.count}</div>
            <div className="l">{s.label}</div>
            <div className="v av-num">{s.value ?? '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Expanded detail ----

function Metric({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="av-dstat">
      <div className="l">{label}</div>
      <div className={`v av-num ${cls}`}>{value}</div>
    </div>
  )
}

function ProjectDetail({ p, canViewCosts }: { p: DashboardProject; canViewCosts: boolean }) {
  return (
    <div className="av-detail-inner">
      <div className="av-detail-stats">
        <Metric label="Mo. revenue" value={eur(p.monthly_revenue)} />
        {canViewCosts && <Metric label="Mo. cost" value={eur(p.monthly_cost)} />}
        {canViewCosts && <Metric label="Mo. profit" value={signed(p.monthly_profit)} cls={profitClass(p.monthly_profit)} />}
        <Metric label="Period" value={p.period_months ? `${p.period_months} mo` : '—'} />
        <Metric label="Total revenue" value={eur(p.total_revenue)} />
        {canViewCosts && <Metric label="Total profit" value={signed(p.total_profit)} cls={profitClass(p.total_profit)} />}
      </div>

      {p.msns.length > 0 && (
        <div className="overflow-x-auto av-panel" style={{ boxShadow: 'none' }}>
          <table className="av-tbl">
            <thead>
              <tr>
                <th className="av-th">MSN</th>
                <th className="av-th">Type</th>
                <th className="av-th r">MGH</th>
                <th className="av-th r">FH:FC</th>
                <th className="av-th r">Crew</th>
                <th className="av-th">Env</th>
                <th className="av-th">Lease</th>
                <th className="av-th r">€/BH</th>
                <th className="av-th r">Mo. revenue</th>
                {canViewCosts && <th className="av-th r">Mo. profit</th>}
              </tr>
            </thead>
            <tbody>
              {p.msns.map((m) => (
                <tr key={m.msn}>
                  <td className="av-td"><span className="av-msn">{m.msn}</span></td>
                  <td className="av-td" style={{ color: 'var(--ink-2)' }}>{m.aircraft_type}</td>
                  <td className="av-td r av-num">{num(m.mgh)}</td>
                  <td className="av-td r av-num">{num(m.cycle_ratio, 2)}</td>
                  <td className="av-td r av-num">{num(m.crew_sets, 1)}</td>
                  <td className="av-td capitalize" style={{ color: 'var(--ink-2)' }}>{m.environment ?? '—'}</td>
                  <td className="av-td capitalize" style={{ color: 'var(--ink-2)' }}>{m.lease_type ?? '—'}</td>
                  <td className="av-td r av-num">{num(m.eur_per_bh)}</td>
                  <td className="av-td r av-num">{eur(m.monthly_revenue)}</td>
                  {canViewCosts && <td className={`av-td r av-num ${profitClass(m.monthly_profit)}`}>{signed(m.monthly_profit)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.quote ? (
        <div className="flex flex-wrap items-center gap-3 text-[11px] mt-3.5" style={{ color: 'var(--muted)' }}>
          <span>Quote <span className="av-num" style={{ color: 'var(--ink-2)' }}>{p.quote.quote_number}</span></span>
          <StatusBadge status={p.quote.status} />
          <span>{shortDate(p.quote.created_at)}</span>
          {p.created_by && <span>by {p.created_by}</span>}
          <div className="flex items-center gap-2 ml-auto">
            <Link href={`/quotes/${p.id}`} className="av-btn av-btn-ghost !py-1 !px-2.5 !text-[12px]">
              <Calculator size={13} /> Open
            </Link>
            <Link href={`/quotes/${p.id}?go=pnl`} className="av-btn av-btn-ghost !py-1 !px-2.5 !text-[12px]">
              <TrendingUp size={13} /> P&amp;L
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-[11px] mt-3.5" style={{ color: 'var(--muted)' }}>
          No quote linked yet — metrics appear once a quote is saved for this project.
        </div>
      )}
    </div>
  )
}

// ---- Main ----

export function DashboardMetrics({ data }: { data: DashboardData }) {
  const canViewCosts = useCanViewCosts()
  const r = rollup(data)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="space-y-[18px]">
      <KpiBand data={data} r={r} canViewCosts={canViewCosts} />

      {/* Signature: fleet deployment board */}
      <div className="av-panel">
        <div className="av-panel-h">
          <h2>Fleet deployment · next 12 months</h2>
          <span className="av-hint">dashed = quoted, not yet signed</span>
        </div>
        <FleetBoard segments={data.calendar} fleet={data.fleet} today={data.today} />
      </div>

      <div className="dash-charts grid gap-[18px]">
        <PipelineFlow data={data} r={r} />
        <RevenueByClient data={data} />
      </div>

      <div className="av-panel">
        <div className="av-panel-h">
          <h2>Projects</h2>
          <span className="av-hint">expand a row for per-MSN detail</span>
        </div>

        {data.projects.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
            No projects yet. Save a quote from the Pricing Workspace — its client becomes a project here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="av-tbl">
              <thead>
                <tr>
                  <th className="av-th" style={{ width: 28 }}></th>
                  <th className="av-th">Client</th>
                  <th className="av-th">Status</th>
                  <th className="av-th r">MSN</th>
                  <th className="av-th r">MGH</th>
                  <th className="av-th r">€/BH</th>
                  <th className="av-th r">Mo. revenue</th>
                  {canViewCosts && <th className="av-th r">Mo. profit</th>}
                  {canViewCosts && <th className="av-th r">Total profit</th>}
                  <th className="av-th r">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <FragmentRow key={p.id} p={p} open={expanded.has(p.id)} onToggle={() => toggle(p.id)} canViewCosts={canViewCosts} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function FragmentRow({ p, open, onToggle, canViewCosts }: { p: DashboardProject; open: boolean; onToggle: () => void; canViewCosts: boolean }) {
  return (
    <>
      <tr onClick={onToggle} className={`av-exp-row ${open ? 'open' : ''}`} style={open ? { background: 'var(--hover)' } : undefined}>
        <td className="av-td">
          <ChevronRight size={13} className="av-exp-chev" />
        </td>
        <td className="av-td">
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>{p.name}</span>
          {p.quote && <span className="av-num block text-[10.5px] mt-px" style={{ color: 'var(--muted)' }}>{p.quote.quote_number}</span>}
        </td>
        <td className="av-td"><StatusBadge status={p.status} /></td>
        <td className="av-td r av-num">{p.msn_count}</td>
        <td className="av-td r av-num">{num(p.total_mgh)}</td>
        <td className="av-td r av-num">{num(p.eur_per_bh)}</td>
        <td className="av-td r av-num">{eur(p.monthly_revenue)}</td>
        {canViewCosts && <td className={`av-td r av-num ${profitClass(p.monthly_profit)}`}>{signed(p.monthly_profit)}</td>}
        {canViewCosts && <td className={`av-td r av-num ${profitClass(p.total_profit)}`}>{signed(p.total_profit)}</td>}
        <td className="av-td r av-num whitespace-nowrap" style={{ color: 'var(--muted)' }}>{shortDate(p.created_at)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10} className="av-detail-cell">
            <ProjectDetail p={p} canViewCosts={canViewCosts} />
          </td>
        </tr>
      )}
    </>
  )
}
