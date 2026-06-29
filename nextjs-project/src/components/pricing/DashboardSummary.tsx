'use client'

import { useState } from 'react'
import { Plus, Save, Download } from 'lucide-react'
import { usePricingStore } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { MsnInputRow } from './MsnInputRow'
import { SummaryTable } from './SummaryTable'
import { SaveQuoteDialog } from '@/components/quotes/SaveQuoteDialog'
import { useCalculation } from './hooks/useCalculation'
import { useAddAircraft } from './hooks/useAddAircraft'
import { downloadCalculationWorkbook } from '@/lib/excel-export'
import type { AircraftOption } from '@/lib/api-converters'

interface DashboardSummaryProps {
  aircraftList: AircraftOption[]
  isViewer?: boolean
}

export function DashboardSummary({ aircraftList, isViewer = false }: DashboardSummaryProps) {
  const {
    projectName,
    exchangeRate,
    marginPercent,
    bhFhRatio,
    apuFhRatio,
    msnInputs,
    msnResults,
    isCalculating,
    lastError,
    setProjectName,
    setExchangeRate,
    setBhFhRatio,
    setApuFhRatio,
    removeMsnInput,
    updateMsnInput,
    editingQuoteNumber,
    reset,
  } = usePricingStore()
  const isEditing = editingQuoteNumber !== null

  // Full crew & costs config — needed to build the formula-driven Excel export.
  const crewConfig = useCrewConfigStore()
  const costsConfig = useCostsConfigStore()

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

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

  // Debounced calculation side-effect
  useCalculation(msnInputs, exchangeRate, marginPercent)

  // Aircraft addition logic
  const {
    selectedAircraft,
    setSelectedAircraft,
    handleAddAircraft,
    availableAircraft,
  } = useAddAircraft(aircraftList, msnInputs, bhFhRatio, apuFhRatio)

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {(lastError || exportError) && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-200 text-sm">
          {lastError ?? exportError}
        </div>
      )}

      {/* Project header and global inputs */}
      <div className="av-panel p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Untitled Project"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div className="w-[120px]">
            <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1">
              USD/EUR Rate
            </label>
            <input
              type="number"
              step="0.0001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              readOnly={isViewer}
              tabIndex={isViewer ? -1 : undefined}
              className={`w-full border rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none ${
                isViewer
                  ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 cursor-default'
                  : 'bg-gray-100 dark:bg-gray-800 border-[var(--border-secondary)] focus:border-indigo-400'
              }`}
            />
          </div>
          <div className="w-[100px]">
            <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1">
              BH:FH
            </label>
            <input
              type="number"
              step="0.01"
              value={bhFhRatio}
              onChange={(e) => setBhFhRatio(e.target.value)}
              readOnly={isViewer}
              tabIndex={isViewer ? -1 : undefined}
              className={`w-full border rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none ${
                isViewer
                  ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 cursor-default'
                  : 'bg-gray-100 dark:bg-gray-800 border-[var(--border-secondary)] focus:border-indigo-400'
              }`}
            />
          </div>
          <div className="w-[100px]">
            <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1">
              APU FH:FH
            </label>
            <input
              type="number"
              step="0.01"
              value={apuFhRatio}
              onChange={(e) => setApuFhRatio(e.target.value)}
              readOnly={isViewer}
              tabIndex={isViewer ? -1 : undefined}
              className={`w-full border rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none ${
                isViewer
                  ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 cursor-default'
                  : 'bg-gray-100 dark:bg-gray-800 border-[var(--border-secondary)] focus:border-indigo-400'
              }`}
            />
          </div>
          {isCalculating && (
            <div className="text-xs text-indigo-600 dark:text-indigo-400 pb-2">Calculating...</div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={msnInputs.length === 0 || isExporting}
              title="Download the calculation as an Excel workbook (Calculation, P&L, Aircraft, Crew, Costs)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={12} />
              {isExporting ? 'Preparing...' : 'Download Excel'}
            </button>
          </div>
          {!isViewer && (
            <div className="flex items-center gap-2">
              {isEditing && (
                <>
                  <span className="text-[11px] text-[var(--av-accent-ink)] bg-[var(--av-accent-soft)] px-2 py-1 rounded-md">
                    Editing {editingQuoteNumber}
                  </span>
                  <button
                    onClick={() => reset()}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    New quote
                  </button>
                </>
              )}
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={msnResults.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={12} />
                {isEditing ? 'Update Quote' : 'Save as Quote'}
              </button>
            </div>
          )}
          {savedNotice && (
            <div className="text-xs text-[var(--av-pos)] pb-2">
              Saved: {savedNotice}
            </div>
          )}
        </div>
      </div>

      {/* Side-by-side: Summary (left) + MSN Inputs (right) */}
      <div className="flex flex-col md:flex-row gap-4 md:items-start">
        {/* Left: Summary Table */}
        <div className="w-full md:w-[380px] md:shrink-0">
          <SummaryTable />
        </div>

        {/* Right: MSN Inputs */}
        <div className="flex-1 min-w-0">
          <div className="av-panel p-3">
            {/* Header + Add Aircraft */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                MSN Inputs ({msnInputs.length})
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedAircraft}
                  onChange={(e) => setSelectedAircraft(e.target.value)}
                  className="bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">Select aircraft...</option>
                  {availableAircraft.map((ac) => (
                    <option key={ac.id} value={ac.id}>
                      MSN {ac.msn} - {ac.aircraft_type}
                      {ac.registration ? ` (${ac.registration})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddAircraft}
                  disabled={!selectedAircraft}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
            </div>

            {/* MSN cards */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {msnInputs.map((input) => (
                <MsnInputRow
                  key={input.msn}
                  input={input}
                  onUpdate={updateMsnInput}
                  onRemove={removeMsnInput}
                  aircraftList={aircraftList}
                  usedMsns={msnInputs.map((i) => i.msn)}
                />
              ))}
            </div>

            {msnInputs.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-6">
                No aircraft added yet. Select an aircraft above to begin pricing.
              </p>
            )}
          </div>
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
