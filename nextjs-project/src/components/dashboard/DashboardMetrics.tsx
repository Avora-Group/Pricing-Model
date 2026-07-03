'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Calculator, TrendingUp, List, CalendarDays } from 'lucide-react'
import { StatusBadge } from '@/components/quotes/StatusBadge'
import { FleetCalendar, type CalendarSegment } from './FleetCalendar'
import { useCanViewCosts } from '@/providers/CostVisibilityProvider'
import { Redacted } from '@/components/common/Redacted'

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
  let committedMsn = 0
  let rateWeightSum = 0
  let rateWeight = 0
  let sumRev = 0
  let sumProfit = 0
  let monthlyRevenue = 0
  let monthlyProfit = 0
  let lifetimeProfit = 0
  for (const p of data.projects) {
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
    committedMsn,
    avgRate: rateWeight > 0 ? String(rateWeightSum / rateWeight) : null,
    avgMargin: sumRev > 0 ? String((sumProfit / sumRev) * 100) : null,
    monthlyRevenue,
    monthlyProfit,
    lifetimeProfit,
  }
}

// ---- Hero ----

function Hero({ data, r, canViewCosts }: { data: DashboardData; r: Rollup; canViewCosts: boolean }) {
  const { project_counts } = data
  const totForBar = Math.max(project_counts.total, 1)
  const seg = (c: number) => `${(c / totForBar) * 100}%`

  return (
    <div className="av-hero">
      <div className="av-hero-grid">
        {/* Left */}
        <div>
          <div className="av-hero-eyebrow">Committed contract value</div>
          <div className="av-hero-val">{eurM(r.signedValue)}</div>
          <div className="av-hero-sub">
            <b>{project_counts.total}</b> projects in pipeline
            {canViewCosts && (
              <> · <b>{eurM(r.lifetimeProfit)}</b> lifetime profit committed</>
            )}
          </div>
          <div className="av-pipe-bar mt-4">
            <div className="av-pipe-seg" style={{ width: seg(project_counts.active), background: '#2cc39c' }} />
            <div className="av-pipe-seg" style={{ width: seg(project_counts.signed), background: '#3f56b0' }} />
            <div className="av-pipe-seg" style={{ width: seg(project_counts.sent), background: '#18B4D8' }} />
          </div>
          <div className="av-pipe-legend">
            <div className="pl"><span className="d" style={{ background: '#2cc39c' }} /> Active <b>{project_counts.active}</b></div>
            <div className="pl"><span className="d" style={{ background: '#3f56b0' }} /> Signed <b>{project_counts.signed}</b></div>
            <div className="pl"><span className="d" style={{ background: '#18B4D8' }} /> Sent <b>{project_counts.sent}</b></div>
          </div>
        </div>
        {/* Right */}
        <div className="av-hstat-grid">
          <div className="av-hstat">
            <div className="l">Avg rate · signed &amp; active</div>
            <div className="v av-num">{num(r.avgRate)}<span className="text-[13px] font-medium opacity-70"> €/BH</span></div>
            <div className="s">{canViewCosts ? `${num(r.avgMargin, 1)}% blended margin` : 'signed & active deals'}</div>
          </div>
          <div className="av-hstat">
            <div className="l">Fleet committed</div>
            <div className="v av-num">{r.committedMsn}<span className="text-[13px] font-medium opacity-70"> MSN</span></div>
            <div className="s">on signed &amp; active deals</div>
          </div>
          <div className="av-hstat">
            <div className="l">Monthly revenue</div>
            <div className="v av-num">{eur(String(r.monthlyRevenue))}</div>
            <div className="s">committed run-rate</div>
          </div>
          <div className="av-hstat">
            <div className="l">Monthly profit</div>
            <div className="v av-num" style={{ color: canViewCosts ? (r.monthlyProfit >= 0 ? '#5eead4' : '#fca5a5') : undefined }}>
              {canViewCosts ? eur(String(r.monthlyProfit)) : <Redacted />}
            </div>
            <div className="s">across committed deals</div>
          </div>
        </div>
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

function PipelineDonut({ data, r }: { data: DashboardData; r: Rollup }) {
  const { project_counts } = data
  const segs = [
    { label: 'Active', value: project_counts.active, color: '#2cc39c' },
    { label: 'Signed', value: project_counts.signed, color: '#3f56b0' },
    { label: 'Sent', value: project_counts.sent, color: '#18B4D8' },
  ]
  const total = segs.reduce((s, x) => s + x.value, 0) || 1
  const C = 2 * Math.PI * 54 // r=54
  let offset = 0

  return (
    <div className="av-panel">
      <div className="av-panel-h"><h2>Pipeline mix</h2></div>
      <div className="av-card-b">
        <div className="flex items-center gap-6">
          <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="54" fill="none" stroke="var(--line)" strokeWidth="16" />
              {segs.map((s) => {
                const len = (s.value / total) * C
                const el = (
                  <circle
                    key={s.label}
                    cx="70" cy="70" r="54" fill="none"
                    stroke={s.color} strokeWidth="16"
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 70 70)"
                    strokeLinecap="butt"
                  />
                )
                offset += len
                return el
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[26px] font-extrabold" style={{ color: 'var(--brand)' }}>{project_counts.total}</div>
              <div className="text-[10px] uppercase tracking-[0.08em] font-bold" style={{ color: 'var(--muted)' }}>Projects</div>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2.5">
            {segs.map((s) => (
              <div className="flex items-center gap-2.5 text-[12.5px]" key={s.label}>
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />
                <span className="font-semibold" style={{ color: 'var(--ink-2)', minWidth: 52 }}>{s.label}</span>
                <span className="ml-auto font-extrabold av-num" style={{ color: 'var(--brand)' }}>{s.value}</span>
              </div>
            ))}
            <div className="mt-2 pt-2.5 space-y-1" style={{ borderTop: '1px solid var(--line-2)' }}>
              <div className="flex justify-between text-[11.5px]">
                <span style={{ color: 'var(--muted)' }}>Signed value</span>
                <span className="font-bold av-num" style={{ color: 'var(--ink)' }}>{eurM(r.signedValue)}</span>
              </div>
              <div className="flex justify-between text-[11.5px]">
                <span style={{ color: 'var(--muted)' }}>Open pipeline</span>
                <span className="font-bold av-num" style={{ color: 'var(--ink)' }}>{eurM(r.pipelineValue)}</span>
              </div>
            </div>
          </div>
        </div>
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
            <Link href={`/quotes/${p.id}?go=calculation`} className="av-btn av-btn-ghost !py-1 !px-2.5 !text-[12px]">
              <Calculator size={13} /> Calculation
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

  const [view, setView] = useState<'list' | 'calendar'>('list')

  const SwitchBtn = ({ v, icon: Icon, label }: { v: 'list' | 'calendar'; icon: typeof List; label: string }) => (
    <button
      onClick={() => setView(v)}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
      style={
        view === v
          ? { background: 'var(--card)', color: 'var(--ink)', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
          : { color: 'var(--muted)' }
      }
    >
      <Icon size={13} /> {label}
    </button>
  )

  return (
    <div className="space-y-[18px]">
      <Hero data={data} r={r} canViewCosts={canViewCosts} />

      <div className="dash-charts grid gap-[18px]" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <RevenueByClient data={data} />
        <PipelineDonut data={data} r={r} />
      </div>

      <div className="av-panel">
        <div className="av-panel-h">
          <h2>{view === 'list' ? 'Projects' : 'Fleet calendar'}</h2>
          <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--line-2)' }}>
            <SwitchBtn v="list" icon={List} label="List" />
            <SwitchBtn v="calendar" icon={CalendarDays} label="Calendar" />
          </div>
        </div>

        {view === 'calendar' ? (
          <FleetCalendar segments={data.calendar} />
        ) : data.projects.length === 0 ? (
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
