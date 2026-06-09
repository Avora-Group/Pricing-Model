'use client'

import { useState, useRef, useEffect, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import {
  createAircraftAction,
  type CreateAircraftState,
} from '@/app/actions/aircraft'

const FIXED_RATE_FIELDS = [
  { field: 'lease_rent_usd', label: 'Lease Rent (USD/mo)' },
  { field: 'six_year_check_usd', label: '6-Year Check (USD/mo)' },
  { field: 'twelve_year_check_usd', label: '12-Year Check (USD/mo)' },
  { field: 'ldg_usd', label: 'Landing Gear (USD/mo)' },
]

const VARIABLE_RATE_FIELDS = [
  { field: 'apu_rate_usd', label: 'APU Rate (USD/engine)' },
  { field: 'llp1_rate_usd', label: 'LLP #1 Rate (USD/engine)' },
  { field: 'llp2_rate_usd', label: 'LLP #2 Rate (USD/engine)' },
]

const ESCALATION_FIELDS = [
  { field: 'epr_escalation', label: 'EPR Escalation' },
  { field: 'llp_escalation', label: 'LLP Escalation' },
  { field: 'af_apu_escalation', label: 'AF+APU Escalation' },
]

export function CreateAircraftDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  const [state, formAction, isPending] = useActionState(createAircraftAction, {})

  // On success, close dialog and redirect
  useEffect(() => {
    if (state.success && state.msn) {
      setIsOpen(false)
      dialogRef.current?.close()
      router.push(`/aircraft/${state.msn}`)
    }
  }, [state.success, state.msn, router])

  const openDialog = () => {
    setIsOpen(true)
    dialogRef.current?.showModal()
  }

  const closeDialog = () => {
    setIsOpen(false)
    dialogRef.current?.close()
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={16} />
        Add Aircraft
      </button>

      <dialog
        ref={dialogRef}
        className="bg-white dark:bg-gray-900 border border-[var(--border-secondary)] rounded-xl p-0 w-full max-w-lg backdrop:bg-black/60"
        onClose={() => setIsOpen(false)}
      >
        {isOpen && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Add New Aircraft
              </h2>
              <button
                onClick={closeDialog}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error banner */}
            {state.error && (
              <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                {state.error}
              </div>
            )}

            <form action={formAction} className="space-y-5">
              {/* Aircraft Identity */}
              <div>
                <h3 className="text-sm font-medium text-[var(--text-tertiary)] mb-3">
                  Aircraft Identity
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">
                      MSN *
                    </label>
                    <input
                      type="number"
                      name="msn"
                      required
                      placeholder="e.g. 3055"
                      className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">
                      Type
                    </label>
                    <select
                      name="aircraft_type"
                      defaultValue="A320"
                      className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="A320">A320</option>
                      <option value="A321">A321</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">
                      Registration
                    </label>
                    <input
                      type="text"
                      name="registration"
                      placeholder="e.g. TC-UNA"
                      className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Fixed Monthly Rates */}
              <RateFieldGroup title="Fixed Monthly Rates" fields={FIXED_RATE_FIELDS} />

              {/* Variable Rates */}
              <RateFieldGroup title="Variable Rates (per engine)" fields={VARIABLE_RATE_FIELDS} />

              {/* Escalation Rates */}
              <RateFieldGroup title="Escalation Rates" fields={ESCALATION_FIELDS} />

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-gray-400 text-white font-medium rounded-md transition-colors"
                >
                  {isPending ? 'Creating...' : 'Create Aircraft'}
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isPending}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)] rounded-md border border-[var(--border-secondary)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </dialog>
    </>
  )
}

function RateFieldGroup({
  title,
  fields,
}: {
  title: string
  fields: { field: string; label: string }[]
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-[var(--text-tertiary)] mb-3">{title}</h3>
      <div className="space-y-2">
        {fields.map(({ field, label }) => (
          <div
            key={field}
            className="grid grid-cols-[1fr_150px] gap-2 items-center"
          >
            <span className="text-sm text-[var(--text-secondary)]">{label}</span>
            <input
              type="number"
              step="any"
              name={field}
              placeholder="0.00"
              className="px-2 py-1 text-sm text-right bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
