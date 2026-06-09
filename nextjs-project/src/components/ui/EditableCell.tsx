'use client'

import { useState } from 'react'
import { fmt } from '@/lib/format'

/**
 * Inline-editable numeric cell used across Crew and Costs config tables.
 *
 * Supports nullable values, custom format functions, and additional className.
 * Click to edit, Enter/blur to commit, Escape to cancel.
 */
export interface EditableCellProps {
  value: number | null
  onChange: (v: number | null) => void
  decimals?: number
  /** Custom display formatter. Falls back to fmt(value, decimals). */
  formatFn?: (v: number | null) => string
  className?: string
  /** When false, empty input commits 0 instead of null. Default: true. */
  allowNull?: boolean
}

export function EditableCell({
  value,
  onChange,
  decimals = 2,
  formatFn,
  className = '',
  allowNull = true,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const displayValue = formatFn
    ? formatFn(value)
    : value !== null
      ? fmt(value, decimals)
      : '-'

  const startEdit = () => {
    setDraft(value !== null ? String(value) : '')
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    if (draft.trim() === '') {
      onChange(allowNull ? null : 0)
    } else {
      const num = parseFloat(draft)
      if (!isNaN(num)) onChange(num)
    }
  }

  if (editing) {
    return (
      <input
        type="number"
        step="any"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className={`w-full bg-yellow-900/30 border border-yellow-600/50 rounded px-2 py-0.5 text-sm text-[var(--text-primary)] text-right av-num focus:border-yellow-400 focus:outline-none ${className}`}
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer px-2 py-0.5 rounded bg-yellow-900/20 border border-yellow-700/30 hover:border-yellow-500/50 hover:bg-yellow-900/30 transition-colors av-num text-[var(--text-primary)] inline-block min-w-[60px] text-right ${className}`}
      title="Click to edit"
    >
      {displayValue}
    </span>
  )
}
