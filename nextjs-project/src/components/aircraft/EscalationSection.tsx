'use client'

import { useState, useActionState, useEffect } from 'react'
import { updateRatesAction, type UpdateRatesState } from '@/app/actions/aircraft'

export interface EscalationRow {
  label: string
  /** Rate field name on the update endpoint (e.g. "epr_escalation"). */
  field: string
  /** Decimal rate as stored (0.05 = 5%). */
  value: string | number | null
}

interface EscalationSectionProps {
  title: string
  rows: EscalationRow[]
  msn: number
  canEdit: boolean
}

function formatEscalation(value: string | number | null): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return `${(num * 100).toFixed(1)}%`
}

/** Stored decimal → editable percent string (0.055 → "5.5"). */
function toPercentInput(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return ''
  return String(Math.round(num * 100 * 10000) / 10000)
}

/** Editable percent string → stored decimal string ("5.5" → "0.055"). */
function toDecimal(percent: string): string {
  const num = parseFloat(percent)
  if (isNaN(num)) return ''
  return String(Math.round(num * 10000) / 1_000_000)
}

export function EscalationSection({ title, rows, msn, canEdit }: EscalationSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const boundAction = async (prevState: UpdateRatesState, formData: FormData) => {
    return updateRatesAction(msn, prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(boundAction, {})

  // Depend on the state object, not state.success: each dispatch returns a
  // fresh object, so consecutive successful saves each close the form.
  useEffect(() => {
    if (state.success) {
      setIsEditing(false)
      setEditValues({})
    }
  }, [state])

  const handleEdit = () => {
    const values: Record<string, string> = {}
    for (const row of rows) {
      values[row.field] = toPercentInput(row.value)
    }
    setEditValues(values)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValues({})
  }

  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>{title}</h2>
        {canEdit && !isEditing && (
          <button onClick={handleEdit} className="av-btn av-btn-ghost !py-1.5 !px-3">
            Edit
          </button>
        )}
      </div>

      <div className="av-card-b">
        {state.error && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-[13px]"
            style={{ background: 'var(--neg-soft)', color: 'var(--neg)', border: '1px solid color-mix(in srgb, var(--neg) 30%, transparent)' }}
          >
            {state.error}
          </div>
        )}

        {isEditing ? (
          <form action={formAction}>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_150px] gap-2 text-[11px] px-1" style={{ color: 'var(--muted)' }}>
                <span>Parameter</span>
                <span className="text-right">Rate (%)</span>
              </div>
              {rows.map((row) => (
                <div key={row.field} className="grid grid-cols-[1fr_150px] gap-2 items-center">
                  <span className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>{row.label}</span>
                  {/* Visible input is in percent; the hidden field carries the
                      decimal the rates endpoint stores (5.5 → 0.055). */}
                  <input
                    type="number"
                    step="0.1"
                    value={editValues[row.field] ?? ''}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [row.field]: e.target.value }))
                    }
                    aria-label={`${row.label} (%)`}
                    className="av-input av-num text-right !py-1.5"
                  />
                  <input type="hidden" name={row.field} value={toDecimal(editValues[row.field] ?? '')} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" disabled={isPending} className="av-btn av-btn-cyan disabled:opacity-60">
                {isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="av-btn av-btn-ghost disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-1">
            <div
              className="grid grid-cols-[1fr_120px] gap-2 text-[11px] px-1 pb-1.5 mb-1"
              style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line-2)' }}
            >
              <span>Parameter</span>
              <span className="text-right">Rate</span>
            </div>
            {rows.map((row) => (
              <div key={row.field} className="grid grid-cols-[1fr_120px] gap-2 py-1.5 px-1">
                <span className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>{row.label}</span>
                <span className="text-[13.5px] text-right av-num" style={{ color: 'var(--ink-2)' }}>
                  {formatEscalation(row.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
