'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban, FileSignature, Radar, Zap } from 'lucide-react'
import { updateProjectStatusAction } from '@/app/actions/pricing'

// ---- Types (mirror /pricing/dashboard response) ----

interface LatestQuote {
  quote_number: string
  client_name: string
  status: string
  total_eur_per_bh: string | null
}

interface DashboardProject {
  id: number
  name: string | null
  status: string
  status_source: string
  signed_at: string | null
  created_at: string | null
  created_by: string | null
  msn_count: number
  total_mgh: string | null
  period_months: number | null
  margin_percent: string | null
  latest_quote: LatestQuote | null
  contract_value: string | null
}

export interface DashboardData {
  projects: DashboardProject[]
  project_counts: {
    potential: number
    signed: number
    active: number
    total: number
  }
  quote_counts: {
    draft: number
    sent: number
    accepted: number
    rejected: number
    total: number
  }
  averages: {
    eur_per_bh: string | null
    margin_percent: string | null
  }
}

// ---- Styling helpers ----

const PROJECT_STATUSES = ['potential', 'signed', 'active'] as const
type ProjectStatus = (typeof PROJECT_STATUSES)[number]

const STATUS_STYLES: Record<string, string> = {
  potential:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  signed:
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
  active:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
}

function formatEur(value: string | null): string {
  if (value === null || value === '') return '—'
  const num = Number(value)
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatNumber(value: string | null, digits = 0): string {
  if (value === null || value === '') return '—'
  const num = Number(value)
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: digits,
  }).format(num)
}

function formatDate(dateStr: string | null): string {
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

// ---- Components ----

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sublabel?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  accent: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        <Icon size={18} className={accent} />
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sublabel}</div>
      )}
    </div>
  )
}

function StatusSelect({
  project,
  disabled,
  onChanged,
}: {
  project: DashboardProject
  disabled: boolean
  onChanged: () => void
}) {
  const [updating, setUpdating] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as ProjectStatus
    if (next === project.status) return
    setUpdating(true)
    const result = await updateProjectStatusAction(project.id, next)
    setUpdating(false)
    if (!('error' in result)) onChanged()
  }

  if (disabled) {
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
          STATUS_STYLES[project.status] ?? STATUS_STYLES.potential
        }`}
      >
        {project.status}
      </span>
    )
  }

  return (
    <select
      value={project.status}
      onChange={handleChange}
      disabled={updating}
      className={`text-xs font-medium capitalize rounded-full px-2 py-1 border-0 cursor-pointer focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:opacity-50 ${
        STATUS_STYLES[project.status] ?? STATUS_STYLES.potential
      }`}
    >
      {PROJECT_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          {s}
        </option>
      ))}
    </select>
  )
}

export function DashboardMetrics({
  data,
  isViewer,
}: {
  data: DashboardData
  isViewer: boolean
}) {
  const router = useRouter()
  const { projects, project_counts, quote_counts, averages } = data

  const pipelineValue = projects
    .filter((p) => p.status === 'potential' && p.contract_value)
    .reduce((sum, p) => sum + Number(p.contract_value), 0)
  const signedValue = projects
    .filter((p) => (p.status === 'signed' || p.status === 'active') && p.contract_value)
    .reduce((sum, p) => sum + Number(p.contract_value), 0)

  return (
    <div className="space-y-6">
      {/* Project status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Projects"
          value={project_counts.total}
          sublabel={`${quote_counts.total} quotes saved`}
          icon={FolderKanban}
          accent="text-gray-400"
        />
        <StatCard
          label="Potential"
          value={project_counts.potential}
          sublabel={pipelineValue > 0 ? `${formatEur(String(pipelineValue))} in pipeline` : 'Pipeline'}
          icon={Radar}
          accent="text-amber-500"
        />
        <StatCard
          label="Signed"
          value={project_counts.signed}
          sublabel={signedValue > 0 ? `${formatEur(String(signedValue))} committed` : 'Contracts won'}
          icon={FileSignature}
          accent="text-indigo-500"
        />
        <StatCard
          label="Active"
          value={project_counts.active}
          sublabel="In operation"
          icon={Zap}
          accent="text-emerald-500"
        />
      </div>

      {/* Averages + quote pipeline strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Pricing Averages
          </span>
          <div className="mt-3 flex items-end gap-8">
            <div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {averages.eur_per_bh ? `${formatNumber(averages.eur_per_bh)} €/BH` : '—'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avg EUR per block hour</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {averages.margin_percent ? `${formatNumber(averages.margin_percent, 1)}%` : '—'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avg margin</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Quotes by Status
          </span>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(['draft', 'sent', 'accepted', 'rejected'] as const).map((s) => (
              <div key={s} className="text-center">
                <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {quote_counts[s]}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Projects</h2>
        </div>
        {projects.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            No projects yet. Save a quote from the Calculation page to create your first project.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-800">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium text-right">MSNs</th>
                  <th className="px-4 py-2.5 font-medium text-right">MGH</th>
                  <th className="px-4 py-2.5 font-medium text-right">EUR/BH</th>
                  <th className="px-4 py-2.5 font-medium text-right">Contract Value</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                      {p.name || 'Untitled Project'}
                      {p.latest_quote && (
                        <span className="block text-xs text-gray-400 dark:text-gray-500">
                          {p.latest_quote.quote_number}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusSelect
                        project={p}
                        disabled={isViewer}
                        onChanged={() => router.refresh()}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                      {p.latest_quote?.client_name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {p.msn_count}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {formatNumber(p.total_mgh)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {formatNumber(p.latest_quote?.total_eur_per_bh ?? null)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatEur(p.contract_value)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
