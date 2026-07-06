'use client'

import { useEffect, useState } from 'react'
import { Plus, Save, Download, AlertTriangle } from 'lucide-react'
import { usePricingStore } from '@/stores/pricing-store'
import type { MsnInput } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { MsnInputRow } from './MsnInputRow'
import { SummaryTable } from './SummaryTable'
import { SaveQuoteDialog } from '@/components/quotes/SaveQuoteDialog'
import { useCalculation } from './hooks/useCalculation'
import { useAddAircraft } from './hooks/useAddAircraft'
import { downloadCalculationWorkbook } from '@/lib/excel-export'
import type { AircraftOption } from '@/lib/api-converters'
import { useCanViewCosts } from '@/providers/CostVisibilityProvider'

interface DashboardSummaryProps {
  aircraftList: AircraftOption[]
  isViewer?: boolean
}

/** Missing / implausible inputs for an MSN, surfaced as a warning on its tab. */
function msnIssues(i: MsnInput): string[] {
  const num = (s?: string) => parseFloat(s || '0')
  const rate = i.seasonalityEnabled
    ? Math.max(num(i.summer?.acmiRate), num(i.winter?.acmiRate))
    : num(i.acmiRate)
  const mgh = i.seasonalityEnabled
    ? Math.max(num(i.summer?.mgh), num(i.winter?.mgh))
    : num(i.mgh)
  const issues: string[] = []
  if (!(rate > 0)) issues.push('ACMI rate not set')
  if (!(mgh > 0)) issues.push('MGH not set')
  if (!(i.crewSets > 0)) issues.push('Crew sets not set')
  return issues
}

export function DashboardSummary({ aircraftList, isViewer = false }: DashboardSummaryProps) {
  const {
    projectName,
    exchangeRate,
    marginPercent,
    rateBasis,
    bhFhRatio,
    apuFhRatio,
    msnInputs,
    msnResults,
    isCalculating,
    lastError,
    setProjectName,
    setExchangeRate,
    setRateBasis,
    setBhFhRatio,
    setApuFhRatio,
    removeMsnInput,
    updateMsnInput,
    patchMsnInput,
    editingQuoteNumber,
    reset,
  } = usePricingStore()
  const isEditing = editingQuoteNumber !== null

  // Naked cost basis toggle is only available to users with cost access.
  const canViewCosts = useCanViewCosts()
  // Guard: if a non-cost-access user somehow has naked selected, fall back.
  const effectiveBasis: 'current' | 'naked' =
    canViewCosts && rateBasis === 'naked' ? 'naked' : 'current'

  // Full crew & costs config — needed to build the formula-driven Excel export.
  const crewConfig = useCrewConfigStore()
  const costsConfig = useCostsConfigStore()

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Master-detail: which MSN bookmark tab is open.
  const [activeMsn, setActiveMsn] = useState<number | null>(null)

  async function handleExport() {
    if (msnInputs.length === 0 || isExporting) return
    setIsExporting(true)
    setExportError(null)
    try {
      await downloadCalculationWorkbook({
        projectName,
        exchangeRate: parseFloat(exchangeRate || '0.85'),
        marginPercent: parseFloat(marginPercent || '0'),
        bhFhRatio: parseFloat(bhFhRatio || '1.2'),
        apuFhRatio: parseFloat(apuFhRatio || '0.7'),
        msnInputs,
        crew: {
          payroll: crewConfig.payroll,
          otherCost: crewConfig.otherCost,
          training: crewConfig.training,
          averageAC: crewConfig.averageAC,
          fdDays: crewConfig.fdDays,
          nfdDays: crewConfig.nfdDays,
        },
        costs: {
          maintPersonnel: costsConfig.maintPersonnel,
          maintCosts: costsConfig.maintCosts,
          insurance: costsConfig.insurance,
          doc: costsConfig.doc,
          otherCogs: costsConfig.otherCogs,
          overhead: costsConfig.overhead,
          avgAc: costsConfig.avgAc,
        },
      })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Backfill naked rates onto MSNs loaded from a saved quote (which don't carry
  // them) using the current aircraft master data. Only for cost-access users;
  // aircraft without naked data get flagged so we don't re-patch every render.
  useEffect(() => {
    if (!canViewCosts) return
    for (const input of msnInputs) {
      if (input.hasNakedRates !== undefined) continue
      const ac =
        aircraftList.find((a) => a.id === input.aircraftId) ??
        aircraftList.find((a) => a.msn === input.msn)
      if (!ac) continue
      patchMsnInput(input.msn, {
        hasNakedRates: Boolean(ac.has_naked_rates),
        nakedLeaseRentEur: ac.naked_lease_rent_eur ?? undefined,
        nakedSixYearCheckEur: ac.naked_six_year_check_eur ?? undefined,
        nakedTwelveYearCheckEur: ac.naked_twelve_year_check_eur ?? undefined,
        nakedLdgEur: ac.naked_ldg_eur ?? undefined,
        nakedApuRateUsd: ac.naked_apu_rate_usd ?? undefined,
        nakedLlp1RateUsd: ac.naked_llp1_rate_usd ?? undefined,
        nakedLlp2RateUsd: ac.naked_llp2_rate_usd ?? undefined,
        nakedEprMatrix: (ac.naked_epr_matrix ?? []).map((r) => ({
          cycleRatio: parseFloat(r.cycle_ratio),
          benignRate: parseFloat(r.benign_rate),
          hotRate: parseFloat(r.hot_rate),
        })),
      })
    }
  }, [msnInputs, aircraftList, canViewCosts, patchMsnInput])

  // Debounced calculation side-effect
  useCalculation(msnInputs, exchangeRate, marginPercent, effectiveBasis)

  // Aircraft addition logic
  const {
    selectedAircraft,
    setSelectedAircraft,
    handleAddAircraft,
    availableAircraft,
  } = useAddAircraft(aircraftList, msnInputs, bhFhRatio, apuFhRatio)

  // Keep the open tab valid; default to the most recently added aircraft.
  useEffect(() => {
    if (msnInputs.length === 0) {
      if (activeMsn !== null) setActiveMsn(null)
      return
    }
    if (activeMsn === null || !msnInputs.some((i) => i.msn === activeMsn)) {
      setActiveMsn(msnInputs[msnInputs.length - 1].msn)
    }
  }, [msnInputs, activeMsn])

  // Add an aircraft, then jump to its tab.
  function handleAddAndSelect() {
    const picked = availableAircraft.find((a) => String(a.id) === String(selectedAircraft))
    handleAddAircraft()
    if (picked) setActiveMsn(picked.msn)
  }

  const activeInput = msnInputs.find((i) => i.msn === activeMsn) ?? null

  // Per-MSN monthly margin, for the tab badges.
  const marginByMsn = new Map<number, number>()
  for (const r of msnResults) {
    const rev = parseFloat(r.monthlyRevenue || '0')
    const pnl = parseFloat(r.monthlyPnl || '0')
    marginByMsn.set(r.msn, rev > 0 ? pnl / rev : 0)
  }

  return (
    <div className="space-y-[18px]">
      {/* Error banner */}
      {(lastError || exportError) && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--neg-soft)', color: 'var(--neg)', border: '1px solid var(--neg)' }}
        >
          {lastError ?? exportError}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-xs">
          {isCalculating && (
            <span style={{ color: 'var(--cyan-ink)' }}>Calculating…</span>
          )}
          {isEditing && (
            <span
              className="px-2 py-1 rounded-md av-num"
              style={{ color: 'var(--cyan-ink)', background: 'var(--cyan-soft)' }}
            >
              Editing {editingQuoteNumber}
            </span>
          )}
          {savedNotice && (
            <span style={{ color: 'var(--pos)' }}>Saved: {savedNotice}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing && !isViewer && (
            <button onClick={() => reset()} className="av-btn av-btn-ghost !text-xs !py-1.5">
              New quote
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={msnInputs.length === 0 || isExporting}
            title="Download the calculation as an Excel workbook (Calculation, P&L, Aircraft, Crew, Costs)"
            className="av-btn av-btn-ghost !text-xs !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            {isExporting ? 'Preparing…' : 'Download Excel'}
          </button>
          {!isViewer && (
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={msnResults.length === 0}
              className="av-btn av-btn-cyan !text-xs !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={12} />
              {isEditing ? 'Update Quote' : 'Save as Quote'}
            </button>
          )}
        </div>
      </div>

      {/* Project bar — name + global assumptions */}
      <div className="av-proj-bar">
        <div className="av-pb-field name">
          <label>Project name</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Untitled project"
            className="av-input"
          />
        </div>
        <div className="av-pb-field small">
          <label>USD / EUR</label>
          <input
            type="number"
            step="0.0001"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            readOnly={isViewer}
            tabIndex={isViewer ? -1 : undefined}
            className="av-input av-num"
          />
        </div>
        <div className="av-pb-field small">
          <label>BH : FH</label>
          <input
            type="number"
            step="0.01"
            value={bhFhRatio}
            onChange={(e) => setBhFhRatio(e.target.value)}
            readOnly={isViewer}
            tabIndex={isViewer ? -1 : undefined}
            className="av-input av-num"
          />
        </div>
        <div className="av-pb-field small">
          <label>APU FH : FH</label>
          <input
            type="number"
            step="0.01"
            value={apuFhRatio}
            onChange={(e) => setApuFhRatio(e.target.value)}
            readOnly={isViewer}
            tabIndex={isViewer ? -1 : undefined}
            className="av-input av-num"
          />
        </div>

        {/* Cost basis toggle — cost-access users only. Naked prices the 6 MSNs
            that have naked rates on their reduced cost basis. */}
        {canViewCosts && (
          <div className="av-pb-field small">
            <label>Cost basis</label>
            <div className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--line)' }}>
              {(['current', 'naked'] as const).map((basis) => {
                const active = effectiveBasis === basis
                return (
                  <button
                    key={basis}
                    type="button"
                    onClick={() => setRateBasis(basis)}
                    className="px-3 py-1.5 text-[12.5px] capitalize transition-colors"
                    style={{
                      background: active ? 'var(--cyan)' : 'transparent',
                      color: active ? 'var(--on-cyan, #fff)' : 'var(--ink-2)',
                      fontWeight: active ? 600 : 400,
                    }}
                    aria-pressed={active}
                  >
                    {basis}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Aircraft tabs + add-aircraft picker */}
      <div className="av-ac-tabs">
        {msnInputs.map((input) => {
          const active = input.msn === activeMsn
          const margin = marginByMsn.get(input.msn)
          const issues = msnIssues(input)
          return (
            <button
              key={input.msn}
              onClick={() => setActiveMsn(input.msn)}
              title={issues.length ? `Check inputs: ${issues.join(' · ')}` : undefined}
              className={`av-ac-tab${active ? ' active' : ''}`}
            >
              <span className="av-num">MSN {input.msn}</span>
              <span className="ty">{input.aircraftType}</span>
              {issues.length > 0 ? (
                <AlertTriangle size={12} style={{ color: 'var(--amber)' }} />
              ) : margin !== undefined ? (
                <span className={`av-num ty ${margin >= 0 ? 'av-pos' : 'av-neg'}`}>
                  {margin >= 0 ? '+' : ''}{(margin * 100).toFixed(1)}%
                </span>
              ) : null}
            </button>
          )
        })}
        <div className="flex items-center gap-2 ml-1.5">
          <select
            value={selectedAircraft}
            onChange={(e) => setSelectedAircraft(e.target.value)}
            className="av-input !py-2"
          >
            <option value="">Select aircraft…</option>
            {availableAircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>
                MSN {ac.msn} · {ac.aircraft_type}
                {ac.registration ? ` (${ac.registration})` : ''}
              </option>
            ))}
          </select>
          <button onClick={handleAddAndSelect} disabled={!selectedAircraft} className="av-ac-add disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={14} />
            Add aircraft
          </button>
        </div>
      </div>

      {/* Work grid: inputs (left) · live results (right) */}
      <div className="av-work-grid">
        <div className="av-panel overflow-hidden">
          {activeInput ? (
            <MsnInputRow
              key={activeInput.msn}
              input={activeInput}
              onUpdate={updateMsnInput}
              onRemove={removeMsnInput}
              aircraftList={aircraftList}
              usedMsns={msnInputs.map((i) => i.msn)}
            />
          ) : (
            <p className="text-xs text-center py-10" style={{ color: 'var(--muted)' }}>
              No aircraft added yet. Select an aircraft above to begin pricing.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <SummaryTable />
        </div>
      </div>

      {/* Save Quote Dialog */}
      <SaveQuoteDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSaved={(quoteNumber) => {
          setSavedNotice(quoteNumber)
          setTimeout(() => setSavedNotice(null), 5000)
        }}
      />
    </div>
  )
}
