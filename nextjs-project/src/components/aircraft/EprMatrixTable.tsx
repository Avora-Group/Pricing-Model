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
      <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">EPR Matrix</h3>
          {isAdmin && (
            <button
              onClick={handleEdit}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)] rounded-md border border-[var(--border-secondary)] transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        <p className="text-[var(--text-muted)] text-sm">No EPR matrix data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">EPR Matrix</h3>
        {isAdmin && !isEditing && (
          <button
            onClick={handleEdit}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)] rounded-md border border-[var(--border-secondary)] transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* Error banner */}
      {state.error && (
        <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {state.error}
        </div>
      )}

      {isEditing ? (
        <form action={formAction}>
          {/* Hidden input with serialised rows */}
          <input type="hidden" name="rows" value={JSON.stringify(editRows)} />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left px-3 py-2 text-[var(--text-primary)] font-semibold">
                    Cycle Ratio
                  </th>
                  <th className="text-right px-3 py-2 text-[var(--text-primary)] font-semibold">
                    Benign Rate
                  </th>
                  <th className="text-right px-3 py-2 text-[var(--text-primary)] font-semibold">
                    Hot Rate
                  </th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {editRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-200/50 dark:border-gray-800/50"
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="any"
                        value={row.cycle_ratio}
                        onChange={(e) =>
                          handleRowChange(idx, 'cycle_ratio', e.target.value)
                        }
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="any"
                        value={row.benign_rate}
                        onChange={(e) =>
                          handleRowChange(idx, 'benign_rate', e.target.value)
                        }
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-sm text-right bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="any"
                        value={row.hot_rate}
                        onChange={(e) =>
                          handleRowChange(idx, 'hot_rate', e.target.value)
                        }
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-sm text-right bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--av-neg)] rounded transition-colors"
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
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-dashed border-[var(--border-secondary)] rounded-md transition-colors"
          >
            <Plus size={14} />
            Add Row
          </button>

          {/* Save / Cancel */}
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                <th className="text-left px-4 py-2 text-[var(--text-primary)] font-semibold">
                  Cycle Ratio
                </th>
                <th className="text-right px-4 py-2 text-[var(--text-primary)] font-semibold">
                  Benign Rate
                </th>
                <th className="text-right px-4 py-2 text-[var(--text-primary)] font-semibold">
                  Hot Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {eprMatrix.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-2 text-[var(--text-secondary)]">
                    {formatRatio(row.cycle_ratio)}
                  </td>
                  <td className="px-4 py-2 text-[var(--text-secondary)] text-right">
                    {formatValue(row.benign_rate)}
                  </td>
                  <td className="px-4 py-2 text-[var(--text-secondary)] text-right">
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
