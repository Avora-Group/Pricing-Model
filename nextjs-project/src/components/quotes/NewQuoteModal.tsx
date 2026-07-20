'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { usePricingStore } from '@/stores/pricing-store'
import { useCrewConfigStore } from '@/stores/crew-config-store'
import { useCostsConfigStore } from '@/stores/costs-config-store'
import { DashboardSummary } from '@/components/pricing/DashboardSummary'
import type { AircraftOption } from '@/lib/api-converters'

interface NewQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the new quote number after a successful save. */
  onSaved: (quoteNumber: string) => void
  aircraftList: AircraftOption[]
}

/**
 * "New Quote" — the full Pricing Workspace in a centered overlay
 * (75vw × 80vh). Opens with a blank slate (store reset) each time.
 * Closes on ✕ or Escape only — no backdrop-click close, so half-entered
 * inputs aren't lost to a stray click.
 */
export function NewQuoteModal({ isOpen, onClose, onSaved, aircraftList }: NewQuoteModalProps) {
  // Fully clean slate on every open: pricing state cleared and crew/costs
  // config restored to company defaults, so a previously viewed quote's
  // snapshot (loaded into those global config stores) no longer leaks in.
  useEffect(() => {
    if (!isOpen) return
    usePricingStore.getState().reset()
    useCrewConfigStore.getState().resetToDefaults()
    useCostsConfigStore.getState().resetToDefaults()
  }, [isOpen])

  // Close on Escape — unless the nested Save Quote dialog is on top.
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-dialog="save-quote"]')) return
      onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="av-panel flex flex-col overflow-hidden"
        style={{ width: '75vw', height: '80vh', boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}
      >
        {/* Header */}
        <div className="av-panel-h shrink-0">
          <h2>New Quote — Pricing Workspace</h2>
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

        {/* Workspace body */}
        <div className="flex-1 overflow-y-auto p-[18px]">
          <DashboardSummary aircraftList={aircraftList} isViewer={false} onSaved={onSaved} />
        </div>
      </div>
    </div>
  )
}
