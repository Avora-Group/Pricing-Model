'use client'

import { useState } from 'react'
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

const inputCls = 'av-input av-num !py-1.5 !text-xs w-full'
const labelCls = 'text-[12.5px] font-semibold'

/** Slider with an inline editable value — dynamic input, precise when needed. */
function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: string | number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: string) => void
}) {
  const v = String(value)
  return (
    <div className="av-field">
      <div className="fl">
        <label style={{ color: 'var(--ink-2)' }}>{label}</label>
        <span className="flex items-center gap-1">
          <input
            type="number"
            step={step}
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="av-num"
            style={{
              width: 74,
              textAlign: 'right',
              border: '1px solid var(--line)',
              borderRadius: 6,
              padding: '2px 7px',
              background: 'var(--card-2)',
              color: 'var(--cyan-ink)',
              fontWeight: 700,
              fontSize: 13,
            }}
          />
          {unit && <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        className="av-slider"
        min={min}
        max={max}
        step={step}
        value={Number(v) || 0}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/** Segmented toggle for a small set of options. */
function SegField({
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
    <div className="av-field">
      <div className="fl"><label style={{ color: 'var(--ink-2)' }}>{label}</label></div>
      <div className="av-seg">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={value === o.value ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Precise number field (kept for ratios / dates / small values). */
function NumField({
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
    <div>
      <label className="text-[10px] font-semibold leading-none mb-1 block" style={{ color: 'var(--muted)' }}>
        {label}
      </label>
      <input type={type} step={type === 'number' ? step : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
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

function startDateValue(v: string) {
  return v.length === 7 ? `${v}-01` : v
}
function endDateValue(v: string) {
  if (v.length > 7) return v
  const [y, m] = v.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${v}-${String(lastDay).padStart(2, '0')}`
}

/** Utilisation + rate + term controls for one season (or the flat, non-seasonal case). */
function RateControls({
  data,
  currencyLabel,
  onChange,
}: {
  data: SeasonInput
  currencyLabel: string
  onChange: (field: keyof SeasonInput, value: string | number) => void
}) {
  return (
    <>
      <div className="av-in-sec-t">Utilisation &amp; rate</div>
      <SliderField label="Min guaranteed hours" value={data.mgh} min={0} max={700} step={5} unit="BH/mo" onChange={(v) => onChange('mgh', v)} />
      <SliderField label={`ACMI rate`} value={data.acmiRate} min={0} max={8000} step={25} unit={`${currencyLabel}/BH`} onChange={(v) => onChange('acmiRate', v)} />
      <div className="av-field-row">
        <NumField label="FH : FC" value={String(data.cycleRatio)} step="0.0001" onChange={(v) => onChange('cycleRatio', v)} />
        <NumField label={`Excess rate (${currencyLabel})`} value={String(data.excessHourRate)} onChange={(v) => onChange('excessHourRate', v)} />
      </div>
      <div className="av-field-row" style={{ marginTop: 12 }}>
        <NumField label="Excess hours" value={String(data.excessBh)} onChange={(v) => onChange('excessBh', v)} />
        <div />
      </div>

      <div className="av-in-sec-t" style={{ marginTop: 18 }}>Term</div>
      <div className="av-field-row">
        <NumField label="Start date" type="date" value={startDateValue(data.periodStart)} onChange={(v) => onChange('periodStart', v)} />
        <NumField label="End date" type="date" value={endDateValue(data.periodEnd)} onChange={(v) => onChange('periodEnd', v)} />
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

  const handleSeasonFieldChange = (season: 'summer' | 'winter', field: keyof SeasonInput, value: string | number) =>
    updateSeasonInput(input.msn, season, field, value)

  return (
    <div>
      {/* Inputs header */}
      <div className="flex items-center justify-between gap-2 px-[18px] py-3.5 flex-wrap" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>MSN {input.msn}</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{input.aircraftType}</span>
          {input.registration && <span className="text-xs" style={{ color: 'var(--muted)' }}>({input.registration})</span>}
          {showSwap ? (
            <select
              autoFocus
              defaultValue={String(input.aircraftId)}
              onChange={(e) => handleSwap(e.target.value)}
              onBlur={() => setShowSwap(false)}
              className="av-input !py-1 !text-xs"
            >
              {swapOptions.map((ac) => (
                <option key={ac.id} value={ac.id}>
                  MSN {ac.msn} - {ac.aircraft_type}{ac.registration ? ` (${ac.registration})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <button onClick={() => setShowSwap(true)} className="p-1 rounded transition-colors" style={{ color: 'var(--muted)' }} aria-label="Change aircraft" title="Change aircraft">
              <RefreshCw size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={input.seasonalityEnabled} onChange={(e) => toggleSeasonality(input.msn, e.target.checked)} className="w-3 h-3 rounded" style={{ accentColor: 'var(--cyan)' }} />
            Seasonality
          </label>
          <div className="av-seg" style={{ flex: 'unset' }}>
            <button className={input.rateCurrency === 'eur' ? 'on' : ''} onClick={() => onUpdate(input.msn, 'rateCurrency', 'eur')} style={{ padding: '4px 9px' }}>EUR</button>
            <button className={input.rateCurrency === 'usd' ? 'on' : ''} onClick={() => onUpdate(input.msn, 'rateCurrency', 'usd')} style={{ padding: '4px 9px' }}>USD</button>
          </div>
          <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={input.fixedCostCoverageEnabled} onChange={(e) => onUpdate(input.msn, 'fixedCostCoverageEnabled', e.target.checked)} className="w-3 h-3 rounded" style={{ accentColor: 'var(--cyan)' }} />
            FC Coverage
          </label>
          <button onClick={() => onRemove(input.msn)} className="p-1 rounded transition-colors" style={{ color: 'var(--muted)' }} aria-label={`Remove MSN ${input.msn}`}>
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="av-in-sec">
        {input.seasonalityEnabled && input.summer && input.winter ? (
          <>
            <div className="av-seg mb-3" style={{ flex: 'unset', maxWidth: 200 }}>
              <button className={activeTab === 'summer' ? 'on' : ''} onClick={() => setActiveTab('summer')}>Summer</button>
              <button className={activeTab === 'winter' ? 'on' : ''} onClick={() => setActiveTab('winter')}>Winter</button>
            </div>

            <RateControls
              data={activeTab === 'summer' ? input.summer : input.winter}
              currencyLabel={currencyLabel}
              onChange={(field, value) => handleSeasonFieldChange(activeTab, field, value)}
            />

            {/* Shared operation controls */}
            <div className="av-in-sec-t" style={{ marginTop: 18 }}>Operation</div>
            <SliderField label="Crew complements" value={input.crewSets} min={0.5} max={8} step={0.5} unit="sets" onChange={(v) => onUpdate(input.msn, 'crewSets', parseFloat(v) || 1)} />
            <SegField label="Operating environment" value={input.environment} options={ENV_OPTS} onChange={(v) => onUpdate(input.msn, 'environment', v)} />
            <SegField label="Lease type" value={input.leaseType} options={LEASE_OPTS} onChange={(v) => onUpdate(input.msn, 'leaseType', v)} />
          </>
        ) : (
          <>
            <RateControls
              data={input as unknown as SeasonInput}
              currencyLabel={currencyLabel}
              onChange={(field, value) => onUpdate(input.msn, field as keyof MsnInput, value)}
            />

            <div className="av-in-sec-t" style={{ marginTop: 18 }}>Operation</div>
            <SliderField label="Crew complements" value={input.crewSets} min={0.5} max={8} step={0.5} unit="sets" onChange={(v) => onUpdate(input.msn, 'crewSets', parseFloat(v) || 1)} />
            <SegField label="Operating environment" value={input.environment} options={ENV_OPTS} onChange={(v) => onUpdate(input.msn, 'environment', v)} />
            <SegField label="Lease type" value={input.leaseType} options={LEASE_OPTS} onChange={(v) => onUpdate(input.msn, 'leaseType', v)} />
          </>
        )}

        {/* Fixed Cost Coverage inputs */}
        {input.fixedCostCoverageEnabled && (
          <div className="av-field-row" style={{ marginTop: 18 }}>
            <NumField label="Coverage %" value={String(input.fixedCostCoveragePercent)} step="1" onChange={(v) => onUpdate(input.msn, 'fixedCostCoveragePercent', v)} />
            <NumField label="Coverage months" value={String(input.fixedCostCoverageMonths)} step="1" onChange={(v) => onUpdate(input.msn, 'fixedCostCoverageMonths', v)} />
          </div>
        )}
      </div>
    </div>
  )
}
