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
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>{title}</h2>
        {isAdmin && !isEditing && (
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
                <span className="text-right">USD Value</span>
              </div>
              {rates.map((rate) => (
                <div key={rate.field} className="grid grid-cols-[1fr_150px] gap-2 items-center">
                  <span className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>{rate.label}</span>
                  <input
                    type="number"
                    step="any"
                    name={rate.field}
                    value={editValues[rate.field] ?? ''}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [rate.field]: e.target.value }))
                    }
                    className="av-input av-num text-right !py-1.5"
                  />
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
              className="grid grid-cols-[1fr_120px_120px] gap-2 text-[11px] px-1 pb-1.5 mb-1"
              style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line-2)' }}
            >
              <span>Parameter</span>
              <span className="text-right">USD</span>
              <span className="text-right">EUR</span>
            </div>
            {rates.map((rate) => (
              <div
                key={rate.field}
                className="grid grid-cols-[1fr_120px_120px] gap-2 py-1.5 px-1"
              >
                <span className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>{rate.label}</span>
                <span className="text-[13.5px] text-right av-num" style={{ color: 'var(--ink-2)' }}>{formatValue(rate.usd)}</span>
                <span className="text-[13.5px] text-right av-num" style={{ color: 'var(--muted)' }}>{formatValue(rate.eur)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
