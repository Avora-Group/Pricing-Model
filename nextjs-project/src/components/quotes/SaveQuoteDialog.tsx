'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { usePricingStore } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { saveQuoteAction, updateQuoteAction } from '@/app/actions/quotes'
import { createProjectAction } from '@/app/actions/pricing'

interface SaveQuoteDialogProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (quoteNumber: string) => void
}

export function SaveQuoteDialog({ isOpen, onClose, onSaved }: SaveQuoteDialogProps) {
  const editingQuoteId = usePricingStore((s) => s.editingQuoteId)
  const editingQuoteNumber = usePricingStore((s) => s.editingQuoteNumber)
  const editingClientName = usePricingStore((s) => s.editingClientName)
  const editingClientCode = usePricingStore((s) => s.editingClientCode)
  const isEditing = editingQuoteId !== null

  const [clientName, setClientName] = useState(editingClientName ?? '')
  const [clientCode, setClientCode] = useState(editingClientCode ?? '')
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

      // For a NEW quote, ensure a backing project (its dashboard identity).
      // When editing in place, keep the existing project link untouched.
      let projectId = pricingState.projectId
      if (!isEditing && !projectId) {
        const created = await createProjectAction(clientName.trim())
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

      const payload = {
        client_name: clientName.trim(),
        client_code: clientCode,
        project_id: projectId ?? null,
        dashboard_state,
        pricing_config_snapshot,
        crew_config_snapshot,
        costs_config_snapshot,
        msn_snapshots,
      }
      const result = isEditing
        ? await updateQuoteAction(editingQuoteId!, payload)
        : await saveQuoteAction(payload)

      if ('error' in result) {
        setError(result.error)
        setSaving(false)
        return
      }

      // Success
      onSaved(result.quote_number)
      if (!isEditing) {
        setClientName('')
        setClientCode('')
      }
      onClose()
    } catch {
      setError('Unexpected error saving quote')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="av-panel w-full max-w-md"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}
      >
        {/* Header */}
        <div className="av-panel-h">
          <h2>{isEditing ? `Update quote ${editingQuoteNumber ?? ''}` : 'Save as Quote'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="av-card-b">
          <div className="av-field">
            <div className="fl">
              <label htmlFor="quote-client-name">
                Client Name <span style={{ color: 'var(--neg)' }}>*</span>
              </label>
            </div>
            <input
              id="quote-client-name"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. EasyJet"
              className="av-input w-full"
              autoFocus
            />
          </div>

          <div className="av-field">
            <div className="fl">
              <label htmlFor="quote-client-code">
                Client Code <span style={{ color: 'var(--neg)' }}>*</span>
              </label>
            </div>
            <input
              id="quote-client-code"
              type="text"
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. EZJ (2-4 letters)"
              maxLength={4}
              className="av-input w-full"
            />
            {clientCode.length > 0 && !codeValid && (
              <p className="text-xs mt-1" style={{ color: 'var(--neg)' }}>
                Code must be 2-4 uppercase letters
              </p>
            )}
          </div>

          {error && (
            <div
              className="rounded-md p-2 text-sm mt-3"
              style={{ color: 'var(--neg)', background: 'var(--neg-soft)', border: '1px solid var(--neg)' }}
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="av-btn av-btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!nameValid || !codeValid || saving}
              className="av-btn av-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Quote' : 'Save Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
