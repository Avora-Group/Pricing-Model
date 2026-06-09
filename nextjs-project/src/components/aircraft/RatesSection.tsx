'use client'

import { useState, useActionState, useEffect } from 'react'
import { updateRatesAction, type UpdateRatesState } from '@/app/actions/aircraft'

export interface RateRow {
  label: string
  usd: string | number
  eur: string | number
  field: string
}

interface RatesSectionProps {
  title: string
  rates: RateRow[]
  msn: number
  isAdmin: boolean
}

function formatValue(value: string | number | null): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export function RatesSection({ title, rates, msn, isAdmin }: RatesSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const boundAction = async (prevState: UpdateRatesState, formData: FormData) => {
    return updateRatesAction(msn, prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(boundAction, {})

  useEffect(() => {
    if (state.success) {
      setIsEditing(false)
      setEditValues({})
    }
  }, [state.success])

  const handleEdit = () => {
    const values: Record<string, string> = {}
    for (const rate of rates) {
      values[rate.field] = typeof rate.usd === 'string' ? rate.usd : String(rate.usd)
    }
    setEditValues(values)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValues({})
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        {isAdmin && !isEditing && (
          <button
            onClick={handleEdit}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)] rounded-md border border-[var(--border-secondary)] transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {state.error && (
        <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {state.error}
        </div>
      )}

      {isEditing ? (
        <form action={formAction}>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_150px] gap-2 text-xs text-[var(--text-muted)] px-1">
              <span>Parameter</span>
              <span className="text-right">USD Value</span>
            </div>
            {rates.map((rate) => (
              <div key={rate.field} className="grid grid-cols-[1fr_150px] gap-2 items-center">
                <span className="text-sm text-[var(--text-secondary)]">{rate.label}</span>
                <input
                  type="number"
                  step="any"
                  name={rate.field}
                  value={editValues[rate.field] ?? ''}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, [rate.field]: e.target.value }))
                  }
                  className="px-2 py-1 text-sm text-right bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-gray-400 text-white rounded-md transition-colors"
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="px-4 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)] rounded-md border border-[var(--border-secondary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_120px_120px] gap-2 text-xs text-[var(--text-muted)] px-1 pb-1 border-b border-[var(--border-primary)]">
            <span>Parameter</span>
            <span className="text-right">USD</span>
            <span className="text-right">EUR</span>
          </div>
          {rates.map((rate) => (
            <div
              key={rate.field}
              className="grid grid-cols-[1fr_120px_120px] gap-2 py-1.5 px-1"
            >
              <span className="text-sm text-[var(--text-secondary)]">{rate.label}</span>
              <span className="text-sm text-[var(--text-secondary)] text-right">{formatValue(rate.usd)}</span>
              <span className="text-sm text-[var(--text-tertiary)] text-right">{formatValue(rate.eur)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
