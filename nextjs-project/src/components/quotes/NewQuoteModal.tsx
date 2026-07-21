'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  snapshotWorkspaceStores,
  restoreWorkspaceStores,
  resetWorkspaceStores,
} from '@/stores/workspace-stores'
import { hydrateStoresFromQuote } from './hooks/useQuoteHydration'
import { DashboardSummary } from '@/components/pricing/DashboardSummary'
import type { AircraftOption } from '@/lib/api-converters'
import type { QuoteDetailResponse } from '@/app/actions/quotes'

interface NewQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the quote number after a successful save/update. */
  onSaved: (quoteNumber: string) => void
  aircraftList: AircraftOption[]
  /** When set, the dialog edits this existing quote in place (stores are
   *  hydrated from it; saving updates the same quote). Otherwise it opens
   *  as a blank New Quote. */
  editQuote?: QuoteDetailResponse | null
}

/**
 * "New Quote" / "Edit Quote" — the full Pricing Workspace in a centered
 * overlay (75vw × 80vh). The three workspace stores are snapshotted when the
 * dialog opens and restored when it closes (saved or cancelled), so the
 * dialog never disturbs the sandbox Pricing Workspace. Closes on ✕ or
 * Escape only — no backdrop-click close, so half-entered inputs aren't lost
 * to a stray click.
 */
export function NewQuoteModal({
  isOpen,
  onClose,
  onSaved,
  aircraftList,
  editQuote = null,
}: NewQuoteModalProps) {
  // Stores are prepared in the effect below; gate the body on `ready` so
  // children first mount AFTER preparation (SaveQuoteDialog reads the
  // editing client name into useState at mount time). The effect-with-
  // cleanup shape is strict-mode safe: a double invoke restores the
  // snapshot before re-snapshotting, so the original state survives.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const snap = snapshotWorkspaceStores()
    if (editQuote) {
      hydrateStoresFromQuote(editQuote)
    } else {
      resetWorkspaceStores()
    }
    setReady(true)
    return () => {
      setReady(false)
      restoreWorkspaceStores(snap)
    }
  }, [isOpen, editQuote])

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
          <h2>
            {editQuote
              ? `Edit ${editQuote.quote_number} — Pricing Workspace`
              : 'New Quote — Pricing Workspace'}
          </h2>
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
          {ready && (
            <DashboardSummary aircraftList={aircraftList} isViewer={false} onSaved={onSaved} />
          )}
        </div>
      </div>
    </div>
  )
}
