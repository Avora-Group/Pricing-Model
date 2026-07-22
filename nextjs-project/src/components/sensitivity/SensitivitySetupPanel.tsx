'use client'

import { fmt } from '@/lib/format'
import { SWEEP_PARAMS, type SweepParamKey } from './useSensitivitySweep'

interface SensitivitySetupPanelProps {
  selected: Set<SweepParamKey>
  intervals: Record<string, string>
  /** Live base value per parameter for the current scope. */
  bases: Record<string, number>
  scopeLabel: string
  onToggle: (key: SweepParamKey) => void
  onInterval: (key: SweepParamKey, value: string) => void
  onRun: () => void
  disabled: boolean
  error: string | null
}

export function SensitivitySetupPanel({
  selected,
  intervals,
  bases,
  scopeLabel,
  onToggle,
  onInterval,
  onRun,
  disabled,
  error,
}: SensitivitySetupPanelProps) {
  return (
    <div className="av-panel flex flex-col">
      <div className="av-panel-h">
        <h2>Sensitivity</h2>
        <span className="av-hint">combined sweep · ±2 steps</span>
      </div>
      <div className="flex-1 flex flex-col gap-2 p-[14px_16px]">
        {SWEEP_PARAMS.map((p) => {
          const on = selected.has(p.key)
          return (
            <div
              key={p.key}
              className="grid grid-cols-[1fr_auto_92px] items-center gap-2 rounded-lg px-2.5 py-2"
              style={{
                border: `1px solid ${on ? 'var(--cyan)' : 'var(--line-2)'}`,
                background: on ? 'var(--cyan-soft)' : 'transparent',
              }}
            >
              <button
                type="button"
                className={`av-chip-t${on ? ' on' : ''}`}
                style={{ justifySelf: 'start' }}
                onClick={() => onToggle(p.key)}
                aria-pressed={on}
              >
                {p.label}
              </button>
              <span className="text-[10.5px] av-num" style={{ color: 'var(--muted)' }}>
                base {fmt(bases[p.key] ?? 0, p.key === 'cycleRatio' ? 2 : 0)}
              </span>
              <label className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={intervals[p.key]}
                  onChange={(e) => onInterval(p.key, e.target.value)}
                  disabled={!on}
                  aria-label={`${p.label} interval${p.unit ? ` (${p.unit})` : ''}`}
                  className="av-input av-num text-right w-full !py-1 disabled:opacity-40"
                />
                {p.unit && <span className="shrink-0">{p.unit}</span>}
              </label>
            </div>
          )
        })}

        {error && (
          <p className="text-[11px]" style={{ color: 'var(--neg)' }}>{error}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="text-[10.5px]" style={{ color: 'var(--muted)' }}>
            Shifts each selected parameter by ±2 steps of its interval · scope: {scopeLabel}
          </span>
          <button
            onClick={onRun}
            disabled={disabled}
            className="av-btn av-btn-cyan !text-xs shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run analysis
          </button>
        </div>
      </div>
    </div>
  )
}
