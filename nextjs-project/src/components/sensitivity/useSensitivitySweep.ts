'use client'

import { useState } from 'react'
import {
  computeMsnPnlSummarySeasonal,
  type CrewStoreData,
  type CostsStoreData,
} from '@/lib/pnl-engine'
import { pickAircraftRates } from '@/lib/aircraft-rate-basis'
import type { MsnInput } from '@/stores/pricing-store'

export type SweepParamKey = 'mgh' | 'cycleRatio' | 'acmiRate'

export interface SweepParam {
  key: SweepParamKey
  label: string
  unit: string
  defaultInterval: number
}

export const SWEEP_PARAMS: SweepParam[] = [
  { key: 'mgh', label: 'MGH', unit: 'BH', defaultInterval: 10 },
  { key: 'cycleRatio', label: 'Cycle Ratio', unit: '', defaultInterval: 0.25 },
  { key: 'acmiRate', label: 'ACMI Rate', unit: '€/BH', defaultInterval: 100 },
]

// Five sweep points centered on the base: each selected parameter moves
// together by step × its interval (combined sweep).
const OFFSETS = [-2, -1, 0, 1, 2]

export interface SweepRow {
  label: string
  /** Display value per swept parameter (scope-average base + step × interval). */
  values: Record<string, number>
  eurPerBh: number
  netProfit: number
  margin: number
}

export interface SweepResult {
  rows: SweepRow[]
  params: SweepParam[]
  scopeLabel: string
  fingerprint: string
}

/** Everything the sweep math depends on — also the staleness fingerprint. */
export interface SweepEngineArgs {
  inputs: MsnInput[]
  crew: CrewStoreData
  costs: CostsStoreData
  exchangeRate: number
  useNaked: boolean
  scopeLabel: string
}

/** Scope-average effective base value for a parameter (seasonal MSNs
 *  contribute the mean of their summer/winter values). Display only —
 *  the sweep itself shifts each MSN's own base. */
export function paramBase(inputs: MsnInput[], key: SweepParamKey): number {
  if (inputs.length === 0) return 0
  const one = (m: MsnInput): number => {
    if (m.seasonalityEnabled && m.summer && m.winter) {
      return ((parseFloat(m.summer[key]) || 0) + (parseFloat(m.winter[key]) || 0)) / 2
    }
    return parseFloat(m[key]) || 0
  }
  return inputs.reduce((s, m) => s + one(m), 0) / inputs.length
}

/** Shift one parameter by a delta on the MSN's own base (seasonal: both
 *  seasons), clamped at zero. */
function applyDelta(m: MsnInput, key: SweepParamKey, delta: number): MsnInput {
  const shift = (v: string | undefined) =>
    String(Math.max(0, (parseFloat(v || '0') || 0) + delta))
  if (m.seasonalityEnabled && m.summer && m.winter) {
    return {
      ...m,
      summer: { ...m.summer, [key]: shift(m.summer[key]) },
      winter: { ...m.winter, [key]: shift(m.winter[key]) },
    }
  }
  return { ...m, [key]: shift(m[key]) }
}

/** The P&L engine always reads the current-basis rate fields, so the naked
 *  basis is honored by overlaying the resolved rates onto the clone (same
 *  resolution rules as the summary cards via pickAircraftRates). */
function overlayBasis(m: MsnInput, useNaked: boolean): MsnInput {
  if (!useNaked) return m
  const r = pickAircraftRates(m, true)
  return {
    ...m,
    leaseRentEur: String(r.leaseRentEur),
    sixYearCheckEur: String(r.sixYearCheckEur),
    twelveYearCheckEur: String(r.twelveYearCheckEur),
    ldgEur: String(r.ldgEur),
    apuRateUsd: String(r.apuRateUsd),
    llp1RateUsd: String(r.llp1RateUsd),
    llp2RateUsd: String(r.llp2RateUsd),
    eprMatrix: r.eprMatrix,
  }
}

export function useSensitivitySweep() {
  const [selected, setSelected] = useState<Set<SweepParamKey>>(new Set(['acmiRate']))
  const [intervals, setIntervals] = useState<Record<string, string>>(
    Object.fromEntries(SWEEP_PARAMS.map((p) => [p.key, String(p.defaultInterval)])),
  )
  const [result, setResult] = useState<SweepResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleParam(key: SweepParamKey) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setError(null)
  }

  function setIntervalFor(key: SweepParamKey, value: string) {
    setIntervals((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  function run(args: SweepEngineArgs) {
    const params = SWEEP_PARAMS.filter((p) => selected.has(p.key))
    if (args.inputs.length === 0) {
      setError('Add an aircraft before running a sweep.')
      return
    }
    if (params.length === 0) {
      setError('Select at least one parameter to sweep.')
      return
    }
    for (const p of params) {
      const step = parseFloat(intervals[p.key])
      if (!(step > 0)) {
        setError(`Enter a positive interval for ${p.label}.`)
        return
      }
    }
    setError(null)

    const bases = Object.fromEntries(
      params.map((p) => [p.key, paramBase(args.inputs, p.key)]),
    )
    const rows: SweepRow[] = OFFSETS.map((k) => {
      let cost = 0, bh = 0, net = 0, rev = 0
      for (const m of args.inputs) {
        let clone = overlayBasis(m, args.useNaked)
        for (const p of params) {
          clone = applyDelta(clone, p.key, k * parseFloat(intervals[p.key]))
        }
        const s = computeMsnPnlSummarySeasonal(clone, args.crew, args.costs, args.exchangeRate)
        cost += s.totalCost
        bh += s.totalBh
        net += s.netProfit
        rev += s.totalRevenue
      }
      return {
        label: k === 0 ? 'Base' : k > 0 ? `+${k}` : `${k}`,
        values: Object.fromEntries(
          params.map((p) => [p.key, Math.max(0, bases[p.key] + k * parseFloat(intervals[p.key]))]),
        ),
        eurPerBh: bh > 0 ? cost / bh : 0,
        netProfit: net,
        margin: rev > 0 ? net / rev : 0,
      }
    })

    setResult({
      rows,
      params,
      scopeLabel: args.scopeLabel,
      fingerprint: fingerprintOf(args),
    })
  }

  function isStale(args: SweepEngineArgs): boolean {
    return result !== null && result.fingerprint !== fingerprintOf(args)
  }

  return {
    selected,
    intervals,
    result,
    error,
    toggleParam,
    setIntervalFor,
    run,
    isStale,
    clear: () => setResult(null),
  }
}

function fingerprintOf(args: SweepEngineArgs): string {
  return JSON.stringify(args)
}
