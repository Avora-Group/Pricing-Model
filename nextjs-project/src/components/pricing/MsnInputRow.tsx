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
const selectCls = 'av-input !py-1.5 !text-xs w-full'
const labelCls = 'text-[10px] font-semibold leading-none mb-1 block text-[var(--muted)]'

/** Reusable per-season field grid */
function SeasonFields({
  data,
  onFieldChange,
  currencyLabel,
}: {
  data: SeasonInput
  onFieldChange: (field: keyof SeasonInput, value: string | number) => void
  currencyLabel: string
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {/* MGH */}
      <div>
        <label className={labelCls}>MGH</label>
        <input
          type="number"
          step="0.01"
          value={data.mgh}
          onChange={(e) => onFieldChange('mgh', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Cycle Ratio */}
      <div>
        <label className={labelCls}>FH:FC</label>
        <input
          type="number"
          step="0.0001"
          value={data.cycleRatio}
          onChange={(e) => onFieldChange('cycleRatio', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* ACMI Rate */}
      <div>
        <label className={labelCls}>ACMI Rate ({currencyLabel})</label>
        <input
          type="number"
          step="0.01"
          value={data.acmiRate}
          onChange={(e) => onFieldChange('acmiRate', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Excess Hour Rate */}
      <div>
        <label className={labelCls}>Excess Rate ({currencyLabel})</label>
        <input
          type="number"
          step="0.01"
          value={data.excessHourRate}
          onChange={(e) => onFieldChange('excessHourRate', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Period Start */}
      <div>
        <label className={labelCls}>Start Date</label>
        <input
          type="date"
          value={data.periodStart.length === 7 ? `${data.periodStart}-01` : data.periodStart}
          onChange={(e) => onFieldChange('periodStart', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Period End */}
      <div>
        <label className={labelCls}>End Date</label>
        <input
          type="date"
          value={(() => {
            if (data.periodEnd.length > 7) return data.periodEnd
            const [y, m] = data.periodEnd.split('-').map(Number)
            const lastDay = new Date(y, m, 0).getDate()
            return `${data.periodEnd}-${String(lastDay).padStart(2, '0')}`
          })()}
          onChange={(e) => onFieldChange('periodEnd', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Excess BH */}
      <div>
        <label className={labelCls}>Excess Hour</label>
        <input
          type="number"
          step="0.01"
          value={data.excessBh}
          onChange={(e) => onFieldChange('excessBh', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Crew Sets */}
      <div>
        <label className={labelCls}>Crew</label>
        <input
          type="number"
          min={0.5}
          step="0.1"
          value={data.crewSets}
          onChange={(e) => onFieldChange('crewSets', parseFloat(e.target.value) || 1)}
          className={inputCls}
        />
      </div>
    </div>
  )
}

export function MsnInputRow({ input, onUpdate, onRemove, aircraftList, usedMsns }: MsnInputRowProps) {
  const [showSwap, setShowSwap] = useState(false)
  const [activeTab, setActiveTab] = useState<'summer' | 'winter'>('summer')
  const { swapMsnAircraft, toggleSeasonality, updateSeasonInput } = usePricingStore()

  // Aircraft available for swap: not already used, or is the current one
  const swapOptions = aircraftList.filter(
    (ac) => ac.msn === input.msn || !usedMsns.includes(ac.msn)
  )

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

  const handleSeasonFieldChange = (season: 'summer' | 'winter', field: keyof SeasonInput, value: string | number) => {
    updateSeasonInput(input.msn, season, field, value)
  }

  return (
    <div>
      {/* Inputs header */}
      <div className="flex items-center justify-between gap-2 px-[18px] py-3.5 flex-wrap" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
            MSN {input.msn}
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
            {input.aircraftType}
          </span>
          {input.registration && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              ({input.registration})
            </span>
          )}
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
                  MSN {ac.msn} - {ac.aircraft_type}
                  {ac.registration ? ` (${ac.registration})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setShowSwap(true)}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--muted)' }}
              aria-label="Change aircraft"
              title="Change aircraft"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Seasonality toggle */}
          <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={input.seasonalityEnabled}
              onChange={(e) => toggleSeasonality(input.msn, e.target.checked)}
              className="w-3 h-3 rounded"
              style={{ accentColor: 'var(--cyan)' }}
            />
            Seasonality
          </label>
          {/* Rate currency toggle */}
          <div className="av-seg" style={{ flex: 'unset' }}>
            <button className={input.rateCurrency === 'eur' ? 'on' : ''} onClick={() => onUpdate(input.msn, 'rateCurrency', 'eur')} style={{ padding: '4px 9px' }}>
              EUR
            </button>
            <button className={input.rateCurrency === 'usd' ? 'on' : ''} onClick={() => onUpdate(input.msn, 'rateCurrency', 'usd')} style={{ padding: '4px 9px' }}>
              USD
            </button>
          </div>
          {/* Fixed Cost Coverage toggle */}
          <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={input.fixedCostCoverageEnabled}
              onChange={(e) => onUpdate(input.msn, 'fixedCostCoverageEnabled', e.target.checked)}
              className="w-3 h-3 rounded"
              style={{ accentColor: 'var(--cyan)' }}
            />
            FC Coverage
          </label>
          <button
            onClick={() => onRemove(input.msn)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--muted)' }}
            aria-label={`Remove MSN ${input.msn}`}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="av-in-sec">
      {/* Seasonal tabs or flat inputs */}
      {input.seasonalityEnabled && input.summer && input.winter ? (
        <>
          {/* Tab bar */}
          <div className="av-seg mb-3" style={{ flex: 'unset', maxWidth: 200 }}>
            <button className={activeTab === 'summer' ? 'on' : ''} onClick={() => setActiveTab('summer')}>
              Summer
            </button>
            <button className={activeTab === 'winter' ? 'on' : ''} onClick={() => setActiveTab('winter')}>
              Winter
            </button>
          </div>

          {/* Per-season fields */}
          <SeasonFields
            data={activeTab === 'summer' ? input.summer : input.winter}
            onFieldChange={(field, value) => handleSeasonFieldChange(activeTab, field, value)}
            currencyLabel={input.rateCurrency?.toUpperCase() || 'EUR'}
          />

          {/* Shared fields below tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--line-2)' }}>
            {/* Environment */}
            <div>
              <label className={labelCls}>Environment</label>
              <select
                value={input.environment}
                onChange={(e) => onUpdate(input.msn, 'environment', e.target.value)}
                className={selectCls}
              >
                <option value="benign">Benign</option>
                <option value="hot">Hot</option>
              </select>
            </div>

            {/* Lease Type */}
            <div>
              <label className={labelCls}>Lease Type</label>
              <select
                value={input.leaseType}
                onChange={(e) => onUpdate(input.msn, 'leaseType', e.target.value)}
                className={selectCls}
              >
                <option value="wet">Wet</option>
                <option value="damp">Damp</option>
                <option value="moist">Moist</option>
              </select>
            </div>
          </div>
        </>
      ) : (
        /* Non-seasonal: original flat input grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* MGH */}
          <div>
            <label className={labelCls}>MGH</label>
            <input
              type="number"
              step="0.01"
              value={input.mgh}
              onChange={(e) => onUpdate(input.msn, 'mgh', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Cycle Ratio */}
          <div>
            <label className={labelCls}>FH:FC</label>
            <input
              type="number"
              step="0.0001"
              value={input.cycleRatio}
              onChange={(e) => onUpdate(input.msn, 'cycleRatio', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* ACMI Rate */}
          <div>
            <label className={labelCls}>ACMI Rate ({input.rateCurrency?.toUpperCase() || 'EUR'})</label>
            <input
              type="number"
              step="0.01"
              value={input.acmiRate}
              onChange={(e) => onUpdate(input.msn, 'acmiRate', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Excess Hour Rate */}
          <div>
            <label className={labelCls}>Excess Rate ({input.rateCurrency?.toUpperCase() || 'EUR'})</label>
            <input
              type="number"
              step="0.01"
              value={input.excessHourRate}
              onChange={(e) => onUpdate(input.msn, 'excessHourRate', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Period Start */}
          <div>
            <label className={labelCls}>Start Date</label>
            <input
              type="date"
              value={input.periodStart.length === 7 ? `${input.periodStart}-01` : input.periodStart}
              onChange={(e) => onUpdate(input.msn, 'periodStart', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Period End */}
          <div>
            <label className={labelCls}>End Date</label>
            <input
              type="date"
              value={(() => {
                if (input.periodEnd.length > 7) return input.periodEnd
                // YYYY-MM → append last day of month
                const [y, m] = input.periodEnd.split('-').map(Number)
                const lastDay = new Date(y, m, 0).getDate()
                return `${input.periodEnd}-${String(lastDay).padStart(2, '0')}`
              })()}
              onChange={(e) => onUpdate(input.msn, 'periodEnd', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Excess BH */}
          <div>
            <label className={labelCls}>Excess Hour</label>
            <input
              type="number"
              step="0.01"
              value={input.excessBh}
              onChange={(e) => onUpdate(input.msn, 'excessBh', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Environment */}
          <div>
            <label className={labelCls}>Environment</label>
            <select
              value={input.environment}
              onChange={(e) => onUpdate(input.msn, 'environment', e.target.value)}
              className={selectCls}
            >
              <option value="benign">Benign</option>
              <option value="hot">Hot</option>
            </select>
          </div>

          {/* Crew Sets */}
          <div>
            <label className={labelCls}>Crew</label>
            <input
              type="number"
              min={0.5}
              step="0.1"
              value={input.crewSets}
              onChange={(e) => onUpdate(input.msn, 'crewSets', parseFloat(e.target.value) || 1)}
              className={inputCls}
            />
          </div>

          {/* Lease Type */}
          <div>
            <label className={labelCls}>Lease Type</label>
            <select
              value={input.leaseType}
              onChange={(e) => onUpdate(input.msn, 'leaseType', e.target.value)}
              className={selectCls}
            >
              <option value="wet">Wet</option>
              <option value="damp">Damp</option>
              <option value="moist">Moist</option>
            </select>
          </div>
        </div>
      )}

      {/* Fixed Cost Coverage inputs (shown when FC Coverage is toggled on) */}
      {input.fixedCostCoverageEnabled && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--line-2)' }}>
          <div>
            <label className={labelCls}>Coverage %</label>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              value={input.fixedCostCoveragePercent}
              onChange={(e) => onUpdate(input.msn, 'fixedCostCoveragePercent', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Coverage Months</label>
            <input
              type="number"
              step="1"
              min="1"
              max="12"
              value={input.fixedCostCoverageMonths}
              onChange={(e) => onUpdate(input.msn, 'fixedCostCoverageMonths', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
