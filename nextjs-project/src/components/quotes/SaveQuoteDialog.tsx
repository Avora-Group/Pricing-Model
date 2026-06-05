'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { usePricingStore } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { saveQuoteAction } from '@/app/actions/quotes'
import { createProjectAction } from '@/app/actions/pricing'

interface SaveQuoteDialogProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (quoteNumber: string) => void
}

export function SaveQuoteDialog({ isOpen, onClose, onSaved }: SaveQuoteDialogProps) {
  const [clientName, setClientName] = useState('')
  const [clientCode, setClientCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const codeValid = /^[A-Z]{2,4}$/.test(clientCode)
  const nameValid = clientName.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameValid || !codeValid) return

    setError(null)
    setSaving(true)

    try {
      // Gather snapshot from all 3 stores synchronously
      const pricingState = usePricingStore.getState()
      const crewState = useCrewConfigStore.getState()
      const costsState = useCostsConfigStore.getState()

      // Ensure the working session has a backing project so the quote is
      // attributable on the Dashboard (status starts as 'potential')
      let projectId = pricingState.projectId
      if (!projectId) {
        const projectName =
          pricingState.projectName.trim() || clientName.trim()
        const created = await createProjectAction(projectName)
        if (!('error' in created)) {
          projectId = created.id
          usePricingStore.getState().setProjectId(created.id)
        }
      }

      // Build dashboard_state from pricing store
      const dashboard_state = {
        projectName: pricingState.projectName,
        exchangeRate: pricingState.exchangeRate,
        marginPercent: pricingState.marginPercent,
        bhFhRatio: pricingState.bhFhRatio,
        apuFhRatio: pricingState.apuFhRatio,
      }

      // Build crew_config_snapshot
      const crew_config_snapshot = {
        payroll: crewState.payroll,
        otherCost: crewState.otherCost,
        training: crewState.training,
        averageAC: crewState.averageAC,
        fdDays: crewState.fdDays,
        nfdDays: crewState.nfdDays,
      }

      // Build costs_config_snapshot
      const costs_config_snapshot = {
        maintPersonnel: costsState.maintPersonnel,
        maintCosts: costsState.maintCosts,
        insurance: costsState.insurance,
        doc: costsState.doc,
        otherCogs: costsState.otherCogs,
        overhead: costsState.overhead,
        avgAc: costsState.avgAc,
      }

      // Build pricing_config_snapshot from pricing store global params
      const pricing_config_snapshot = {
        exchangeRate: pricingState.exchangeRate,
        marginPercent: pricingState.marginPercent,
        bhFhRatio: pricingState.bhFhRatio,
        apuFhRatio: pricingState.apuFhRatio,
      }

      // Build msn_snapshots array: combine msnInputs with matching msnResults
      const msn_snapshots = pricingState.msnInputs.map((input) => {
        const result = pricingState.msnResults.find((r) => r.msn === input.msn)
        return {
          msn: input.msn,
          aircraft_type: input.aircraftType,
          aircraft_id: input.aircraftId,
          msn_input: { ...input },
          breakdown: result?.breakdown ?? {},
          monthly_pnl: result
            ? {
                monthlyCost: result.monthlyCost,
                monthlyRevenue: result.monthlyRevenue,
                monthlyPnl: result.monthlyPnl,
              }
            : {},
        }
      })

      const result = await saveQuoteAction({
        client_name: clientName.trim(),
        client_code: clientCode,
        project_id: projectId ?? null,
        dashboard_state,
        pricing_config_snapshot,
        crew_config_snapshot,
        costs_config_snapshot,
        msn_snapshots,
      })

      if ('error' in result) {
        setError(result.error)
        setSaving(false)
        return
      }

      // Success
      onSaved(result.quote_number)
      setClientName('')
      setClientCode('')
      onClose()
    } catch {
      setError('Unexpected error saving quote')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Save as Quote</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. EasyJet"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-400 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Code <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. EZJ (2-4 letters)"
              maxLength={4}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-400 focus:outline-none"
            />
            {clientCode.length > 0 && !codeValid && (
              <p className="text-xs text-red-400 mt-1">
                Code must be 2-4 uppercase letters
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md p-2 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!nameValid || !codeValid || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
