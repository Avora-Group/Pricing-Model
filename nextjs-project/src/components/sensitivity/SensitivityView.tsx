'use client'

import { useEffect, useState } from 'react'
import { computeMsnPnlSummarySeasonal } from '@/lib/pnl-engine'
import { reconstructEngineInputs, type QuoteEngineInputs } from '@/lib/quote-financials'
import { listQuotesAction, getQuoteAction } from '@/app/actions/quotes'
import { SENSITIVITY_PARAMS } from './ParameterPicker'
import { SensitivityChart, type DataPoint } from './SensitivityChart'
import { SensitivityTable } from './SensitivityTable'
import { useCanViewCosts } from '@/providers/CostVisibilityProvider'

interface ProjectOption {
  id: number
  label: string
}

// Five sweep points centered on the base value, stepped by the chosen interval.
const OFFSETS = [-2, -1, 0, 1, 2]

const labelCls = 'text-[10px] uppercase tracking-[0.07em]'

export function SensitivityView() {
  const canViewCosts = useCanViewCosts()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [engine, setEngine] = useState<QuoteEngineInputs | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)

  const [selectedParam, setSelectedParam] = useState('mgh')
  const paramInfo = SENSITIVITY_PARAMS.find((p) => p.key === selectedParam)!
  const [interval, setIntervalValue] = useState(String(paramInfo.defaultInterval))

  const [results, setResults] = useState<DataPoint[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the project list once
  useEffect(() => {
    listQuotesAction({ limit: 100 }).then((res) => {
      if ('error' in res) return
      setProjects(
        res.items.map((q) => ({
          id: q.id,
          label: `${q.client_name} · ${q.quote_number}`,
        })),
      )
    })
  }, [])

  // When the parameter changes, reset the interval to its sensible default
  function handleParamChange(key: string) {
    setSelectedParam(key)
    const p = SENSITIVITY_PARAMS.find((x) => x.key === key)
    if (p) setIntervalValue(String(p.defaultInterval))
    setResults(null)
  }

  // Load the chosen project's data (non-destructive — held locally, not the store)
  async function handleProjectChange(idStr: string) {
    setResults(null)
    setError(null)
    setEngine(null)
    if (!idStr) {
      setProjectId(null)
      return
    }
    const id = Number(idStr)
    setProjectId(id)
    setLoadingProject(true)
    const res = await getQuoteAction(id)
    setLoadingProject(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    const inputs = reconstructEngineInputs(res)
    if (!inputs || inputs.msnInputs.length === 0) {
      setError('This quote has no saved configuration to analyze.')
      return
    }
    setEngine(inputs)
  }

  function baseValue(eng: QuoteEngineInputs): number {
    const ms = eng.msnInputs
    if (ms.length === 0) return 0
    const avg = (f: (m: (typeof ms)[number]) => number) =>
      ms.reduce((s, m) => s + f(m), 0) / ms.length
    switch (selectedParam) {
      case 'mgh':
        return avg((m) => parseFloat(m.mgh) || 0)
      case 'cycleRatio':
        return avg((m) => parseFloat(m.cycleRatio) || 0)
      case 'acmiRate':
        return avg((m) => parseFloat(m.acmiRate) || 0)
      default:
        return 0
    }
  }

  function handleRunAnalysis() {
    if (!engine) return
    const step = parseFloat(interval)
    if (!step || step <= 0) {
      setError('Enter a positive interval.')
      return
    }
    setIsLoading(true)
    setError(null)
    setResults(null)

    try {
      const base = baseValue(engine)
      if (base === 0) {
        setError(`Base value for ${paramInfo.label} is 0 in this project.`)
        setIsLoading(false)
        return
      }

      const dataPoints: DataPoint[] = OFFSETS.map((k) => {
        const paramValue = Math.max(0, base + k * step)
        let totalCost = 0
        let totalBh = 0
        let totalNetProfit = 0

        for (const m of engine.msnInputs) {
          const clone = { ...m }
          if (selectedParam === 'mgh') clone.mgh = paramValue.toString()
          else if (selectedParam === 'cycleRatio') clone.cycleRatio = paramValue.toString()
          else if (selectedParam === 'acmiRate') clone.acmiRate = paramValue.toString()

          const s = computeMsnPnlSummarySeasonal(clone, engine.crew, engine.costs, engine.exRate)
          totalCost += s.totalCost
          totalBh += s.totalBh
          totalNetProfit += s.netProfit
        }

        return {
          label: k === 0 ? 'Base' : k > 0 ? `+${k}` : `${k}`,
          paramValue,
          eurPerBh: totalBh > 0 ? totalCost / totalBh : 0,
          netProfit: totalNetProfit,
        }
      })

      setResults(dataPoints)
    } catch {
      setError('An unexpected error occurred during analysis.')
    } finally {
      setIsLoading(false)
    }
  }

  // Sensitivity is a cost / profit analysis tool — hidden for users without
  // naked-cost permission (server also omits the underlying config data).
  if (!canViewCosts) {
    return (
      <div className="av-panel p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="av-redacted" aria-label="Hidden — insufficient permission">
            ••••••••
          </span>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Sensitivity analysis is hidden — your account does not have permission
            to view naked costs and margins.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="av-panel">
        <div className="av-card-b">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ color: 'var(--muted)' }}>Project</label>
              <select
                value={projectId ?? ''}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="av-input min-w-[220px]"
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ color: 'var(--muted)' }}>Parameter</label>
              <select
                value={selectedParam}
                onChange={(e) => handleParamChange(e.target.value)}
                className="av-input"
              >
                {SENSITIVITY_PARAMS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ color: 'var(--muted)' }}>
                Interval{paramInfo.unit ? ` (${paramInfo.unit})` : ''}
              </label>
              <input
                type="number"
                value={interval}
                onChange={(e) => setIntervalValue(e.target.value)}
                step="any"
                min="0"
                className="av-input av-num text-right w-[120px]"
              />
            </div>

            <button
              onClick={handleRunAnalysis}
              disabled={isLoading || !engine}
              className="av-btn av-btn-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Calculating…' : 'Run analysis'}
            </button>
          </div>
          {engine && (
            <p className="text-[11px] mt-3" style={{ color: 'var(--muted)' }}>
              {engine.msnInputs.length} MSN · sweeping {paramInfo.label} by ±2 steps of {interval || '—'}
              {paramInfo.unit ? ` ${paramInfo.unit}` : ''} around the project base.
            </p>
          )}
        </div>
      </div>

      {!projectId && !loadingProject && (
        <div className="av-panel">
          <div className="av-card-b text-center text-sm" style={{ color: 'var(--muted)', padding: '2rem' }}>
            Choose a project, pick a parameter, set an interval, then run the analysis.
          </div>
        </div>
      )}
      {loadingProject && (
        <div className="av-panel">
          <div className="av-card-b text-center text-sm" style={{ color: 'var(--muted)', padding: '2rem' }}>Loading project…</div>
        </div>
      )}

      {error && (
        <div
          className="rounded-lg p-4"
          style={{ background: 'var(--neg-soft)', border: '1px solid var(--neg)' }}
        >
          <p className="text-sm" style={{ color: 'var(--neg)' }}>{error}</p>
        </div>
      )}

      {results && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SensitivityChart data={results} paramLabel={paramInfo.label} />
          <SensitivityTable data={results} paramLabel={paramInfo.label} paramUnit={paramInfo.unit} />
        </div>
      )}
    </div>
  )
}
