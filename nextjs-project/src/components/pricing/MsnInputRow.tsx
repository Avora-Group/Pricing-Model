'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { X, RefreshCw } from 'lucide-react'
import type { MsnInput, SeasonInput } from '@/stores/pricing-store'
import { usePricingStore } from '@/stores/pricing-store'
import type { AircraftOption } from '@/lib/api-converters'

interface MsnInputRowProps {
  input: MsnInput
  onUpdate: (msn: number, field: keyof MsnInput, value: string | number | boolean) => void
  onRemove: (msn: number) => void
  aircraftList: AircraftOption[]
  usedMsns: number[]
}

/** Compact slider: 18px label row (name + editable value chip + optional inline seg) over a thin track. */
function Sf({
  label,
  value,
  min,
  max,
  step,
  onChange,
  extra,
}: {
  label: string
  value: string | number
  min: number
  max: number
  step: number
  onChange: (v: string) => void
  extra?: ReactNode
}) {
  const v = String(value)
  return (
    <div className="av-sf">
      <label>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{label}{extra}</span>
        <input type="number" step={step} value={v} onChange={(e) => onChange(e.target.value)} className="chip av-num" />
      </label>
      <input type="range" min={min} max={max} step={step} value={Number(v) || 0} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** Compact labeled field (number or date). */
function Nf({
  label,
  value,
  step = '0.01',
  type = 'number',
  onChange,
}: {
  label: string
  value: string
  step?: string
  type?: 'number' | 'date'
  onChange: (v: string) => void
}) {
  return (
    <div className="av-nf">
      <label>{label}</label>
      <input type={type} step={type === 'number' ? step : undefined} value={value} onChange={(e) => onChange(e.target.value)} className="av-num" />
    </div>
  )
}

/** Compact segmented control under an av-nf label. */
function Sg({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="av-nf">
      <label>{label}</label>
      <div className="av-seg">
        {options.map((o) => (
          <button key={o.value} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Tiny inline segmented toggle for slider label rows. */
function MiniSeg({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <span className="av-seg" style={{ height: 18, padding: 2, flex: 'unset' }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          style={{ padding: '0 6px', fontSize: 9.5 }}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

const ENV_OPTS = [
  { value: 'benign', label: 'Benign' },
  { value: 'hot', label: 'Hot' },
]
const LEASE_OPTS = [
  { value: 'wet', label: 'Wet' },
  { value: 'damp', label: 'Damp' },
  { value: 'moist', label: 'Moist' },
]
const MGH_MODE_OPTS = [
  { value: 'month', label: '/mo' },
  { value: 'period', label: '/per' },
]
const CURRENCY_OPTS = [
  { value: 'eur', label: 'EUR' },
  { value: 'usd', label: 'USD' },
]

function startDateValue(v: string | null | undefined) {
  if (!v) return ''
  return v.length === 7 ? `${v}-01` : v
}
function endDateValue(v: string | null | undefined) {
  if (!v) return ''
  if (v.length > 7) return v
  const [y, m] = v.split('-').map(Number)
  if (!y || !m) return v
  const lastDay = new Date(y, m, 0).getDate()
  return `${v}-${String(lastDay).padStart(2, '0')}`
}

/** Human-readable term length, e.g. "365 days · 12.0 months". Em dash when dates
 *  are incomplete or inverted. Days are inclusive; months = days / 30.4375. */
function durationText(start: string | null | undefined, end: string | null | undefined): string {
  const s = startDateValue(start)
  const e = endDateValue(end)
  if (s.length < 10 || e.length < 10) return '—'
  const sd = new Date(s)
  const ed = new Date(e)
  if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || ed < sd) return '—'
  const days = Math.round((ed.getTime() - sd.getTime()) / 86_400_000) + 1
  const months = days / 30.4375
  return `${days} days · ${months.toFixed(1)} months`
}

/** Utilisation / Rate / Term clusters for one season (or the flat case). */
function SeasonClusters({
  data,
  currencyLabel,
  rateCurrency,
  onCurrencyChange,
  mghMode,
  onMghModeChange,
  onChange,
}: {
  data: SeasonInput
  currencyLabel: string
  rateCurrency: string
  onCurrencyChange: (v: string) => void
  mghMode: 'month' | 'period'
  onMghModeChange: (v: string) => void
  onChange: (field: keyof SeasonInput, value: string | number) => void
}) {
  const isPeriod = mghMode === 'period'
  return (
    <>
      <div className="av-cluster">
        <div className="av-cluster-t">Utilisation</div>
        <Sf
          label={isPeriod ? 'Guaranteed BH (period)' : 'Min guaranteed hours'}
          value={data.mgh}
          min={0}
          max={isPeriod ? 5000 : 700}
          step={5}
          onChange={(v) => onChange('mgh', v)}
          extra={<MiniSeg value={mghMode} options={MGH_MODE_OPTS} onChange={onMghModeChange} />}
        />
        <div className="av-gd2 av-mt8">
          <Nf label="Excess hours" value={String(data.excessBh)} onChange={(v) => onChange('excessBh', v)} />
          <Nf label="FH : FC" value={String(data.cycleRatio)} step="0.05" onChange={(v) => onChange('cycleRatio', v)} />
        </div>
      </div>

      <div className="av-cluster">
        <div className="av-cluster-t">Rate</div>
        <Sf
          label={`ACMI rate · ${currencyLabel}/BH`}
          value={data.acmiRate}
          min={0}
          max={8000}
          step={25}
          onChange={(v) => onChange('acmiRate', v)}
          extra={<MiniSeg value={rateCurrency} options={CURRENCY_OPTS} onChange={onCurrencyChange} />}
        />
        <div className="av-gd2 av-mt8">
          <Nf label={`Excess rate (${currencyLabel})`} value={String(data.excessHourRate)} onChange={(v) => onChange('excessHourRate', v)} />
          <div />
        </div>
      </div>

      <div className="av-cluster">
        <div className="av-cluster-t">Term</div>
        <div className="av-gd2">
          <Nf label="Start" type="date" value={startDateValue(data.periodStart)} onChange={(v) => onChange('periodStart', v)} />
          <Nf label="End" type="date" value={endDateValue(data.periodEnd)} onChange={(v) => onChange('periodEnd', v)} />
        </div>
        <div className="av-nf av-mt8">
          <label>Duration</label>
          <div className="av-ro av-num">{durationText(data.periodStart, data.periodEnd)}</div>
        </div>
      </div>
    </>
  )
}

export function MsnInputRow({ input, onUpdate, onRemove, aircraftList, usedMsns }: MsnInputRowProps) {
  const [showSwap, setShowSwap] = useState(false)
  const [activeTab, setActiveTab] = useState<'summer' | 'winter'>('summer')
  const { swapMsnAircraft, toggleSeasonality, updateSeasonInput } = usePricingStore()

  const swapOptions = aircraftList.filter((ac) => ac.msn === input.msn || !usedMsns.includes(ac.msn))
  const currencyLabel = input.rateCurrency?.toUpperCase() || 'EUR'

  const handleSwap = (aircraftId: string) => {
    const ac = aircraftList.find((a) => a.id === Number(aircraftId))
    if (!ac || ac.msn === input.msn) {
      setShowSwap(false)
      return
    }
    swapMsnAircraft(input.msn, {
      aircraftId: ac.id,
      msn: ac.msn,
      aircraftType: ac.aircraft_type,
      registration: ac.registration,
      leaseRentEur: ac.lease_rent_eur ?? '0',
      sixYearCheckEur: ac.six_year_check_eur ?? '0',
      twelveYearCheckEur: ac.twelve_year_check_eur ?? '0',
      ldgEur: ac.ldg_eur ?? '0',
      apuRateUsd: ac.apu_rate_usd ?? '0',
      llp1RateUsd: ac.llp1_rate_usd ?? '0',
      llp2RateUsd: ac.llp2_rate_usd ?? '0',
      eprMatrix: (ac.epr_matrix ?? []).map((r) => ({
        cycleRatio: parseFloat(r.cycle_ratio),
        benignRate: parseFloat(r.benign_rate),
        hotRate: parseFloat(r.hot_rate),
      })),
    })
    setShowSwap(false)
  }

  const seasonal = input.seasonalityEnabled && input.summer && input.winter
  const seasonData = seasonal ? (activeTab === 'summer' ? input.summer! : input.winter!) : (input as unknown as SeasonInput)
  const onSeasonChange = seasonal
    ? (field: keyof SeasonInput, value: string | number) => updateSeasonInput(input.msn, activeTab, field, value)
    : (field: keyof SeasonInput, value: string | number) => onUpdate(input.msn, field as keyof MsnInput, value)

  return (
    <div className="av-deck">
      {seasonal && (
        <div className="av-deck-seasons">
          <button className={activeTab === 'summer' ? 'on' : ''} onClick={() => setActiveTab('summer')}>Summer</button>
          <button className={activeTab === 'winter' ? 'on' : ''} onClick={() => setActiveTab('winter')}>Winter</button>
        </div>
      )}
      <div className="av-deck-grid">
        {/* ── Aircraft meta ── */}
        <div className="av-cluster">
          <div className="av-cluster-t">
            Aircraft
            <button onClick={() => onRemove(input.msn)} aria-label={`Remove MSN ${input.msn}`} style={{ color: 'var(--muted)', background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>MSN {input.msn}</span>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-2)' }}>{input.aircraftType}</span>
            {input.registration && <span className="text-[10.5px]" style={{ color: 'var(--muted)' }}>({input.registration})</span>}
            {showSwap ? (
              <select
                autoFocus
                defaultValue={String(input.aircraftId)}
                onChange={(e) => handleSwap(e.target.value)}
                onBlur={() => setShowSwap(false)}
                className="av-input !py-0.5 !text-[11px]"
              >
                {swapOptions.map((ac) => (
                  <option key={ac.id} value={ac.id}>
                    MSN {ac.msn} - {ac.aircraft_type}{ac.registration ? ` (${ac.registration})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <button onClick={() => setShowSwap(true)} className="p-0.5 rounded transition-colors" style={{ color: 'var(--muted)', background: 'none', border: 0, cursor: 'pointer' }} aria-label="Change aircraft" title="Change aircraft">
                <RefreshCw size={11} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 av-mt8" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`av-chip-t${input.seasonalityEnabled ? ' on' : ''}`}
              onClick={() => toggleSeasonality(input.msn, !input.seasonalityEnabled)}
              aria-pressed={input.seasonalityEnabled}
            >
              Seasonality
            </button>
            <button
              type="button"
              className={`av-chip-t${input.fixedCostCoverageEnabled ? ' on' : ''}`}
              onClick={() => onUpdate(input.msn, 'fixedCostCoverageEnabled', !input.fixedCostCoverageEnabled)}
              aria-pressed={input.fixedCostCoverageEnabled}
            >
              FC Coverage
            </button>
          </div>
        </div>

        {/* ── Utilisation / Rate / Term (season-scoped when seasonality on) ── */}
        <SeasonClusters
          data={seasonData}
          currencyLabel={currencyLabel}
          rateCurrency={input.rateCurrency ?? 'eur'}
          onCurrencyChange={(v) => onUpdate(input.msn, 'rateCurrency', v)}
          mghMode={input.mghMode ?? 'month'}
          onMghModeChange={(v) => onUpdate(input.msn, 'mghMode', v)}
          onChange={onSeasonChange}
        />

        {/* ── Operation (shared across seasons) ── */}
        <div className="av-cluster">
          <div className="av-cluster-t">Operation</div>
          <Sf label="Crew sets" value={input.crewSets} min={0.5} max={8} step={0.5} onChange={(v) => onUpdate(input.msn, 'crewSets', parseFloat(v) || 1)} />
          <div className="av-gd2 av-mt8">
            <Sg label="Environment" value={input.environment} options={ENV_OPTS} onChange={(v) => onUpdate(input.msn, 'environment', v)} />
            <Sg label="Lease type" value={input.leaseType} options={LEASE_OPTS} onChange={(v) => onUpdate(input.msn, 'leaseType', v)} />
          </div>
          {input.fixedCostCoverageEnabled && (
            <div className="av-gd2 av-mt8">
              <Nf label="Coverage %" value={String(input.fixedCostCoveragePercent)} step="1" onChange={(v) => onUpdate(input.msn, 'fixedCostCoveragePercent', v)} />
              <Nf label="Coverage months" value={String(input.fixedCostCoverageMonths)} step="1" onChange={(v) => onUpdate(input.msn, 'fixedCostCoverageMonths', v)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
