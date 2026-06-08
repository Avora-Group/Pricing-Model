'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Calculator, TrendingUp } from 'lucide-react'
import { StatusBadge } from '@/components/quotes/StatusBadge'

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

// ---- Ribbon ----

function Ribbon({ data }: { data: DashboardData }) {
  const { project_counts, projects } = data
  let signedValue = 0
  let pipelineValue = 0
  let committedMsn = 0
  let rateWeightSum = 0
  let rateWeight = 0
  let sumRev = 0
  let sumProfit = 0
  for (const p of projects) {
    const rev = n(p.total_revenue) ?? 0
    if (COMMITTED.has(p.status)) {
      signedValue += rev
      committedMsn += p.msn_count
      const rate = n(p.eur_per_bh)
      const mgh = n(p.total_mgh)
      if (rate && mgh) {
        rateWeightSum += rate * mgh
        rateWeight += mgh
      }
      sumRev += rev
      sumProfit += n(p.total_profit) ?? 0
    } else if (p.status === 'sent') {
      pipelineValue += rev
    }
  }
  const avgRate = rateWeight > 0 ? String(rateWeightSum / rateWeight) : null
  const avgMargin = sumRev > 0 ? String((sumProfit / sumRev) * 100) : null

  const Chip = ({ count, label, dot }: { count: number; label: string; dot: string }) => (
    <div className="flex items-baseline gap-1.5">
      <span className={`w-2 h-2 rounded-full self-center shrink-0 ${dot}`} />
      <span className="text-lg font-semibold tabular-nums">{count}</span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</span>
    </div>
  )

  return (
    <div className="flex flex-wrap border border-[var(--border-primary)] rounded-xl bg-[var(--bg-primary)] overflow-hidden shadow-sm">
      <div className="px-[18px] py-3.5 flex-1 min-w-[260px] border-r border-[var(--border-primary)]">
        <div className="text-[10px] tracking-[0.1em] uppercase text-[var(--text-muted)] mb-2">
          Pipeline · {project_counts.total} projects
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          <Chip count={project_counts.active} label="active" dot="av-dot-active" />
          <Chip count={project_counts.signed} label="signed" dot="av-dot-signed" />
          <Chip count={project_counts.sent} label="sent" dot="av-dot-sent" />
        </div>
      </div>
      <div className="px-[18px] py-3.5 flex-1 min-w-[180px] border-r border-[var(--border-primary)]">
        <div className="text-[10px] tracking-[0.1em] uppercase text-[var(--text-muted)] mb-1.5">Signed contract value</div>
        <div className="text-[22px] font-semibold tracking-tight">{eurM(signedValue)}</div>
        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{eurM(pipelineValue)} in pipeline</div>
      </div>
      <div className="px-[18px] py-3.5 flex-1 min-w-[160px] border-r border-[var(--border-primary)]">
        <div className="text-[10px] tracking-[0.1em] uppercase text-[var(--text-muted)] mb-1.5">Avg rate · signed &amp; active</div>
        <div className="text-[22px] font-semibold tracking-tight av-num">
          {num(avgRate)}<span className="text-xs text-[var(--text-muted)] font-medium ml-1">€/BH</span>
        </div>
        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{num(avgMargin, 1)}% blended margin</div>
      </div>
      <div className="px-[18px] py-3.5 min-w-[150px]">
        <div className="text-[10px] tracking-[0.1em] uppercase text-[var(--text-muted)] mb-1.5">Fleet committed</div>
        <div className="text-[22px] font-semibold tracking-tight av-num">{committedMsn}<span className="text-xs text-[var(--text-muted)] font-medium ml-1">MSN</span></div>
        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">on signed & active deals</div>
      </div>
    </div>
  )
}

// ---- Expanded detail ----

function Metric({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</div>
      <div className={`av-num text-sm font-semibold mt-0.5 ${cls}`}>{value}</div>
    </div>
  )
}

const thCls = 'text-left text-[10px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-semibold px-3.5 py-2'
const tdCls = 'px-3.5 py-2.5 text-[12.5px]'

function ProjectDetail({ p }: { p: DashboardProject }) {
  return (
    <div className="px-4 pb-[18px] pl-10 pt-4 space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-6 gap-y-3.5">
        <Metric label="Mo. revenue" value={eur(p.monthly_revenue)} />
        <Metric label="Mo. cost" value={eur(p.monthly_cost)} />
        <Metric label="Mo. profit" value={signed(p.monthly_profit)} cls={profitClass(p.monthly_profit)} />
        <Metric label="Period" value={p.period_months ? `${p.period_months} mo` : '—'} />
        <Metric label="Total revenue" value={eur(p.total_revenue)} />
        <Metric label="Total profit" value={signed(p.total_profit)} cls={profitClass(p.total_profit)} />
      </div>

      {p.msns.length > 0 && (
        <div className="border border-[var(--border-primary)] rounded-lg overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
                <th className={thCls}>MSN</th>
                <th className={thCls}>Type</th>
                <th className={`${thCls} text-right`}>MGH</th>
                <th className={`${thCls} text-right`}>FH:FC</th>
                <th className={`${thCls} text-right`}>Crew</th>
                <th className={thCls}>Env</th>
                <th className={thCls}>Lease</th>
                <th className={`${thCls} text-right`}>€/BH</th>
                <th className={`${thCls} text-right`}>Mo. revenue</th>
                <th className={`${thCls} text-right`}>Mo. profit</th>
              </tr>
            </thead>
            <tbody>
              {p.msns.map((m) => (
                <tr key={m.msn} className="border-b border-[var(--border-primary)] last:border-0">
                  <td className={tdCls}><span className="av-msn">{m.msn}</span></td>
                  <td className={`${tdCls} text-[var(--text-secondary)]`}>{m.aircraft_type}</td>
                  <td className={`${tdCls} av-num text-right`}>{num(m.mgh)}</td>
                  <td className={`${tdCls} av-num text-right`}>{num(m.cycle_ratio, 2)}</td>
                  <td className={`${tdCls} av-num text-right`}>{num(m.crew_sets, 1)}</td>
                  <td className={`${tdCls} text-[var(--text-secondary)] capitalize`}>{m.environment ?? '—'}</td>
                  <td className={`${tdCls} text-[var(--text-secondary)] capitalize`}>{m.lease_type ?? '—'}</td>
                  <td className={`${tdCls} av-num text-right`}>{num(m.eur_per_bh)}</td>
                  <td className={`${tdCls} av-num text-right`}>{eur(m.monthly_revenue)}</td>
                  <td className={`${tdCls} av-num text-right ${profitClass(m.monthly_profit)}`}>{signed(m.monthly_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.quote ? (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span>Quote <span className="av-num text-[var(--text-secondary)]">{p.quote.quote_number}</span></span>
          <StatusBadge status={p.quote.status} />
          <span>{shortDate(p.quote.created_at)}</span>
          {p.created_by && <span>by {p.created_by}</span>}
          <div className="flex items-center gap-2 ml-auto">
            <Link href={`/quotes/${p.id}?go=calculation`} className="flex items-center gap-1.5 px-2.5 py-1 text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--bg-tertiary)] transition-colors">
              <Calculator size={13} /> Calculation
            </Link>
            <Link href={`/quotes/${p.id}?go=pnl`} className="flex items-center gap-1.5 px-2.5 py-1 text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--bg-tertiary)] transition-colors">
              <TrendingUp size={13} /> P&amp;L
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-[var(--text-muted)]">
          No quote linked yet — metrics appear once a quote is saved for this project.
        </div>
      )}
    </div>
  )
}

// ---- Main ----

export function DashboardMetrics({ data }: { data: DashboardData }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="space-y-4">
      <Ribbon data={data} />

      <div className="border border-[var(--border-primary)] rounded-xl bg-[var(--bg-primary)] overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold">Projects</h2>
          <span className="text-[11px] text-[var(--text-muted)]">click a row for revenue, utilization and profit detail</span>
        </div>
        {data.projects.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px] text-[var(--text-tertiary)]">
            No projects yet. Save a quote from the Calculation page — its client becomes a project here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
                  <th className={`${thCls} w-7`}></th>
                  <th className={thCls}>Client</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} text-right`}>MSN</th>
                  <th className={`${thCls} text-right`}>MGH</th>
                  <th className={`${thCls} text-right`}>€/BH</th>
                  <th className={`${thCls} text-right`}>Mo. revenue</th>
                  <th className={`${thCls} text-right`}>Mo. profit</th>
                  <th className={`${thCls} text-right`}>Total profit</th>
                  <th className={`${thCls} text-right`}>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => {
                  const open = expanded.has(p.id)
                  return (
                    <FragmentRow key={p.id} p={p} open={open} onToggle={() => toggle(p.id)} />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function FragmentRow({ p, open, onToggle }: { p: DashboardProject; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-[var(--border-primary)] cursor-pointer hover:bg-[var(--bg-secondary)] ${open ? 'bg-[var(--bg-secondary)]' : ''}`}
      >
        <td className={`${tdCls} text-[var(--text-muted)]`}>
          <ChevronRight size={13} className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        </td>
        <td className={tdCls}>
          <span className="font-semibold">{p.name}</span>
          {p.quote && <span className="av-num block text-[10.5px] text-[var(--text-muted)] mt-px">{p.quote.quote_number}</span>}
        </td>
        <td className={tdCls}><StatusBadge status={p.status} /></td>
        <td className={`${tdCls} av-num text-right`}>{p.msn_count}</td>
        <td className={`${tdCls} av-num text-right`}>{num(p.total_mgh)}</td>
        <td className={`${tdCls} av-num text-right`}>{num(p.eur_per_bh)}</td>
        <td className={`${tdCls} av-num text-right`}>{eur(p.monthly_revenue)}</td>
        <td className={`${tdCls} av-num text-right ${profitClass(p.monthly_profit)}`}>{signed(p.monthly_profit)}</td>
        <td className={`${tdCls} av-num text-right ${profitClass(p.total_profit)}`}>{signed(p.total_profit)}</td>
        <td className={`${tdCls} av-num text-right text-[var(--text-muted)] whitespace-nowrap`}>{shortDate(p.created_at)}</td>
      </tr>
      {open && (
        <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <td colSpan={10} className="p-0">
            <ProjectDetail p={p} />
          </td>
        </tr>
      )}
    </>
  )
}
