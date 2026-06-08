'use client'

import { useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { usePricingStore } from '@/stores/pricing-store'
import { MsnInputRow } from './MsnInputRow'
import { SummaryTable } from './SummaryTable'
import { SaveQuoteDialog } from '@/components/quotes/SaveQuoteDialog'
import { useCalculation } from './hooks/useCalculation'
import { useAddAircraft } from './hooks/useAddAircraft'
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
  } = usePricingStore()

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

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
      {lastError && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-200 text-sm">
          {lastError}
        </div>
      )}

      {/* Project header and global inputs */}
      <div className="av-panel p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Untitled Project"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div className="w-[120px]">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              USD/EUR Rate
            </label>
            <input
              type="number"
              step="0.0001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              readOnly={isViewer}
              tabIndex={isViewer ? -1 : undefined}
              className={`w-full border rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none ${
                isViewer
                  ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 cursor-default'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:border-indigo-400'
              }`}
            />
          </div>
          <div className="w-[100px]">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              BH:FH
            </label>
            <input
              type="number"
              step="0.01"
              value={bhFhRatio}
              onChange={(e) => setBhFhRatio(e.target.value)}
              readOnly={isViewer}
              tabIndex={isViewer ? -1 : undefined}
              className={`w-full border rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none ${
                isViewer
                  ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 cursor-default'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:border-indigo-400'
              }`}
            />
          </div>
          <div className="w-[100px]">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              APU FH:FH
            </label>
            <input
              type="number"
              step="0.01"
              value={apuFhRatio}
              onChange={(e) => setApuFhRatio(e.target.value)}
              readOnly={isViewer}
              tabIndex={isViewer ? -1 : undefined}
              className={`w-full border rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none ${
                isViewer
                  ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 cursor-default'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:border-indigo-400'
              }`}
            />
          </div>
          {isCalculating && (
            <div className="text-xs text-indigo-600 dark:text-indigo-400 pb-2">Calculating...</div>
          )}
          {!isViewer && (
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={msnResults.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={12} />
              Save as Quote
            </button>
          )}
          {savedNotice && (
            <div className="text-xs text-green-400 pb-2">
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
              <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                MSN Inputs ({msnInputs.length})
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedAircraft}
                  onChange={(e) => setSelectedAircraft(e.target.value)}
                  className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 text-xs text-gray-900 dark:text-gray-100 focus:border-indigo-400 focus:outline-none"
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
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
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
