'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Calculator, TrendingUp } from 'lucide-react'
import { StatusBadge } from '@/components/quotes/StatusBadge'
import { thBase, tdBase, tdNum, borderRow } from '@/components/ui/table-styles'

// ---- Types (mirror /pricing/dashboard response) ----

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
  project_counts: {
    sent: number
    signed: number
    active: number
    completed: number
    total: number
  }
  quote_counts: {
    draft: number
    sent: number
    signed: number
    active: number
    completed: number
    rejected: number
    total: number
  }
  averages: {
    eur_per_bh: string | null
    margin_percent: string | null
  }
}

// ---- Formatting ----

const STATUS_DOT: Record<string, string> = {
  sent: 'bg-blue-500 dark:bg-blue-400',
  signed: 'bg-indigo-500 dark:bg-indigo-400',
  active: 'bg-emerald-500 dark:bg-emerald-400',
  completed: 'bg-teal-500 dark:bg-teal-400',
}

function eur(value: string | null | undefined, digits = 0): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = Number(value)
  if (isNaN(num)) return '—'
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(num)} €`
}

function num(value: string | null | undefined, digits = 0): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (isNaN(n)) return '—'
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(n)
}

function profitClass(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  if (isNaN(n) || n === 0) return ''
  return n > 0
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'
}

function shortDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ---- Summary strip ----

function CountEntry({
  count,
  label,
  dot,
}: {
  count: number
  label: string
  dot?: string
}) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      {dot && <span className={`w-2 h-2 rounded-full self-center shrink-0 ${dot}`} />}
      <span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {count}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </span>
    </div>
  )
}

function SummaryStrip({ data }: { data: DashboardData }) {
  const { project_counts, quote_counts, averages } = data
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
      <div className="flex flex-wrap items-stretch divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-800">
        {/* Projects */}
        <div className="px-4 py-3 flex-1 min-w-[240px]">
          <div className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
            Projects · {project_counts.total}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <CountEntry count={project_counts.active} label="active" dot={STATUS_DOT.active} />
            <CountEntry count={project_counts.signed} label="signed" dot={STATUS_DOT.signed} />
            <CountEntry count={project_counts.sent} label="sent" dot={STATUS_DOT.sent} />
            <CountEntry count={project_counts.completed} label="completed" dot={STATUS_DOT.completed} />
          </div>
        </div>
        {/* Quotes */}
        <div className="px-4 py-3 flex-[1.4] min-w-[300px]">
          <div className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
            Quotes · {quote_counts.total}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <CountEntry count={quote_counts.draft} label="draft" />
            <CountEntry count={quote_counts.sent} label="sent" />
            <CountEntry count={quote_counts.signed} label="signed" />
            <CountEntry count={quote_counts.active} label="active" />
            <CountEntry count={quote_counts.completed} label="completed" />
            <CountEntry count={quote_counts.rejected} label="rejected" />
          </div>
        </div>
        {/* Averages */}
        <div className="px-4 py-3 min-w-[200px]">
          <div className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
            Fleet averages
          </div>
          <div className="flex gap-5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular-nums font-mono text-gray-900 dark:text-gray-100">
                {num(averages.eur_per_bh)}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                €/BH
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular-nums font-mono text-gray-900 dark:text-gray-100">
                {num(averages.margin_percent, 1)}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                % margin
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Expanded project detail ----

function Metric({
  label,
  value,
  valueClass = '',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className={`text-sm font-mono tabular-nums mt-0.5 text-gray-900 dark:text-gray-100 ${valueClass}`}>
        {value}
      </div>
    </div>
  )
}

function ProjectDetail({ p }: { p: DashboardProject }) {
  return (
    <div className="px-10 py-4 space-y-4">
      {/* Financials */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-6 gap-y-3">
        <Metric label="Mo. revenue" value={eur(p.monthly_revenue)} />
        <Metric label="Mo. cost" value={eur(p.monthly_cost)} />
        <Metric
          label="Mo. profit"
          value={eur(p.monthly_profit)}
          valueClass={profitClass(p.monthly_profit)}
        />
        <Metric label="Period" value={p.period_months ? `${p.period_months} mo` : '—'} />
        <Metric label="Total revenue" value={eur(p.total_revenue)} />
        <Metric
          label="Total profit"
          value={eur(p.total_profit)}
          valueClass={profitClass(p.total_profit)}
        />
      </div>

      {/* Per-MSN utilization */}
      {p.msns.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr className={borderRow}>
                <th className={`${thBase} text-left`}>MSN</th>
                <th className={`${thBase} text-left`}>Type</th>
                <th className={`${thBase} text-right`}>MGH</th>
                <th className={`${thBase} text-right`}>FH:FC</th>
                <th className={`${thBase} text-right`}>Crew sets</th>
                <th className={`${thBase} text-left`}>Env</th>
                <th className={`${thBase} text-left`}>Lease</th>
                <th className={`${thBase} text-right`}>€/BH</th>
                <th className={`${thBase} text-right`}>Mo. revenue</th>
                <th className={`${thBase} text-right`}>Mo. profit</th>
              </tr>
            </thead>
            <tbody>
              {p.msns.map((m) => (
                <tr key={m.msn} className={borderRow}>
                  <td className={`${tdBase} font-mono text-gray-900 dark:text-gray-100`}>
                    {m.msn}
                  </td>
                  <td className={`${tdBase} text-gray-700 dark:text-gray-300`}>
                    {m.aircraft_type}
                  </td>
                  <td className={tdNum}>{num(m.mgh)}</td>
                  <td className={tdNum}>{num(m.cycle_ratio, 2)}</td>
                  <td className={tdNum}>{num(m.crew_sets, 1)}</td>
                  <td className={`${tdBase} text-gray-700 dark:text-gray-300 capitalize`}>
                    {m.environment ?? '—'}
                  </td>
                  <td className={`${tdBase} text-gray-700 dark:text-gray-300 capitalize`}>
                    {m.lease_type ?? '—'}
                  </td>
                  <td className={tdNum}>{num(m.eur_per_bh)}</td>
                  <td className={tdNum}>{eur(m.monthly_revenue)}</td>
                  <td className={`${tdNum} ${profitClass(m.monthly_profit)}`}>
                    {eur(m.monthly_profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Source quote + navigation */}
      {p.quote ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Quote{' '}
            <span className="font-mono text-gray-700 dark:text-gray-300">
              {p.quote.quote_number}
            </span>
          </span>
          <StatusBadge status={p.quote.status} />
          <span>{shortDate(p.quote.created_at)}</span>
          {p.created_by && <span>by {p.created_by}</span>}
          <div className="flex items-center gap-2 ml-auto">
            <Link
              href={`/quotes/${p.id}?go=calculation`}
              className="flex items-center gap-1.5 px-2.5 py-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Calculator size={13} />
              Calculation
            </Link>
            <Link
              href={`/quotes/${p.id}?go=pnl`}
              className="flex items-center gap-1.5 px-2.5 py-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <TrendingUp size={13} />
              P&amp;L
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          No quote linked yet — metrics appear once a quote is saved for this project.
        </div>
      )}
    </div>
  )
}

// ---- Main ----

export function DashboardMetrics({ data }: { data: DashboardData }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <SummaryStrip data={data} />

      {/* Projects */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Projects</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            click a row for revenue, utilization and profit detail
          </span>
        </div>
        {data.projects.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            No projects yet. Save a quote from the Calculation page —{' '}
            its client becomes a project here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${borderRow} bg-gray-50 dark:bg-gray-900/60`}>
                  <th className={`${thBase} text-left w-8`} />
                  <th className={`${thBase} text-left`}>Client</th>
                  <th className={`${thBase} text-left`}>Status</th>
                  <th className={`${thBase} text-right`}>MSNs</th>
                  <th className={`${thBase} text-right`}>MGH</th>
                  <th className={`${thBase} text-right`}>€/BH</th>
                  <th className={`${thBase} text-right`}>Mo. revenue</th>
                  <th className={`${thBase} text-right`}>Mo. profit</th>
                  <th className={`${thBase} text-right`}>Total profit</th>
                  <th className={`${thBase} text-right`}>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <ProjectRows
                    key={p.id}
                    p={p}
                    isOpen={expanded.has(p.id)}
                    onToggle={() => toggle(p.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectRows({
  p,
  isOpen,
  onToggle,
}: {
  p: DashboardProject
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`${borderRow} cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
          isOpen ? 'bg-gray-50 dark:bg-gray-800/40' : ''
        }`}
      >
        <td className={`${tdBase} text-gray-400`}>
          <ChevronRight
            size={14}
            className={`transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
          />
        </td>
        <td className={`${tdBase} font-medium text-gray-900 dark:text-gray-100`}>
          {p.name}
        </td>
        <td className={tdBase}>
          <StatusBadge status={p.status} />
        </td>
        <td className={tdNum}>{p.msn_count}</td>
        <td className={tdNum}>{num(p.total_mgh)}</td>
        <td className={tdNum}>{num(p.eur_per_bh)}</td>
        <td className={tdNum}>{eur(p.monthly_revenue)}</td>
        <td className={`${tdNum} ${profitClass(p.monthly_profit)}`}>
          {eur(p.monthly_profit)}
        </td>
        <td className={`${tdNum} ${profitClass(p.total_profit)}`}>
          {eur(p.total_profit)}
        </td>
        <td className={`${tdNum} text-gray-500 dark:text-gray-400 whitespace-nowrap`}>
          {shortDate(p.created_at)}
        </td>
      </tr>
      {isOpen && (
        <tr className={`${borderRow} bg-gray-50/60 dark:bg-gray-950/40`}>
          <td colSpan={10} className="p-0">
            <ProjectDetail p={p} />
          </td>
        </tr>
      )}
    </>
  )
}
