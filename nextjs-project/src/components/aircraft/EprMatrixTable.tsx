'use client'

import { useState, useActionState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  updateEprMatrixAction,
  type UpdateEprMatrixState,
} from '@/app/actions/aircraft'
import { formatValue, formatRatio } from '@/lib/format'

export interface EprMatrixRow {
  cycle_ratio: string
  benign_rate: string
  hot_rate: string
}

interface EprMatrixTableProps {
  eprMatrix: EprMatrixRow[]
  msn: number
  isAdmin: boolean
}

export function EprMatrixTable({ eprMatrix, msn, isAdmin }: EprMatrixTableProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editRows, setEditRows] = useState<EprMatrixRow[]>([])

  const boundAction = async (
    prevState: UpdateEprMatrixState,
    formData: FormData
  ) => {
    return updateEprMatrixAction(msn, prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(boundAction, {})

  useEffect(() => {
    if (state.success) {
      setIsEditing(false)
      setEditRows([])
    }
  }, [state.success])

  const handleEdit = () => {
    setEditRows(eprMatrix.map((r) => ({ ...r })))
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditRows([])
  }

  const handleRowChange = (
    index: number,
    field: keyof EprMatrixRow,
    value: string
  ) => {
    setEditRows((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleAddRow = () => {
    setEditRows((prev) => [
      ...prev,
      { cycle_ratio: '', benign_rate: '', hot_rate: '' },
    ])
  }

  const handleDeleteRow = (index: number) => {
    setEditRows((prev) => prev.filter((_, i) => i !== index))
  }

  // Empty state
  if (!isEditing && (!eprMatrix || eprMatrix.length === 0)) {
    return (
      <div className="av-panel">
        <div className="av-panel-h">
          <h2>EPR Matrix</h2>
          {isAdmin && (
            <button onClick={handleEdit} className="av-btn av-btn-ghost !py-1.5 !px-3">
              Edit
            </button>
          )}
        </div>
        <div className="av-card-b">
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No EPR matrix data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>EPR Matrix</h2>
        {isAdmin && !isEditing && (
          <button onClick={handleEdit} className="av-btn av-btn-ghost !py-1.5 !px-3">
            Edit
          </button>
        )}
      </div>

      {/* Error banner */}
      {state.error && (
        <div className="av-card-b" style={{ paddingBottom: 0 }}>
          <div
            className="px-3 py-2 rounded-lg text-[13px]"
            style={{ background: 'var(--neg-soft)', color: 'var(--neg)', border: '1px solid color-mix(in srgb, var(--neg) 30%, transparent)' }}
          >
            {state.error}
          </div>
        </div>
      )}

      {isEditing ? (
        <form action={formAction} className="av-card-b">
          {/* Hidden input with serialised rows */}
          <input type="hidden" name="rows" value={JSON.stringify(editRows)} />

          <div className="overflow-x-auto">
            <table className="av-tbl">
              <thead>
                <tr>
                  <th className="av-th">Cycle Ratio</th>
                  <th className="av-th r">Benign Rate</th>
                  <th className="av-th r">Hot Rate</th>
                  <th className="av-th w-10" />
                </tr>
              </thead>
              <tbody>
                {editRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="av-td">
                      <input
                        type="number"
                        step="any"
                        value={row.cycle_ratio}
                        onChange={(e) =>
                          handleRowChange(idx, 'cycle_ratio', e.target.value)
                        }
                        placeholder="0.00"
                        className="av-input av-num !py-1.5"
                      />
                    </td>
                    <td className="av-td">
                      <input
                        type="number"
                        step="any"
                        value={row.benign_rate}
                        onChange={(e) =>
                          handleRowChange(idx, 'benign_rate', e.target.value)
                        }
                        placeholder="0.00"
                        className="av-input av-num text-right !py-1.5"
                      />
                    </td>
                    <td className="av-td">
                      <input
                        type="number"
                        step="any"
                        value={row.hot_rate}
                        onChange={(e) =>
                          handleRowChange(idx, 'hot_rate', e.target.value)
                        }
                        placeholder="0.00"
                        className="av-input av-num text-right !py-1.5"
                      />
                    </td>
                    <td className="av-td text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 rounded transition-colors"
                        style={{ color: 'var(--muted)' }}
                        title="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add row button */}
          <button
            type="button"
            onClick={handleAddRow}
            className="av-ac-add mt-3 !text-[13px]"
          >
            <Plus size={14} />
            Add Row
          </button>

          {/* Save / Cancel */}
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
        <div className="overflow-x-auto">
          <table className="av-tbl">
            <thead>
              <tr>
                <th className="av-th">Cycle Ratio</th>
                <th className="av-th r">Benign Rate</th>
                <th className="av-th r">Hot Rate</th>
              </tr>
            </thead>
            <tbody>
              {eprMatrix.map((row, idx) => (
                <tr key={idx}>
                  <td className="av-td av-num" style={{ color: 'var(--ink-2)' }}>
                    {formatRatio(row.cycle_ratio)}
                  </td>
                  <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>
                    {formatValue(row.benign_rate)}
                  </td>
                  <td className="av-td r av-num" style={{ color: 'var(--ink-2)' }}>
                    {formatValue(row.hot_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
