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
        className={`w-full rounded px-2 py-0.5 text-sm text-right av-num focus:outline-none ${className}`}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--cyan)',
          color: 'var(--ink)',
          boxShadow: '0 0 0 3px var(--cyan-soft)',
        }}
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer px-2 py-0.5 rounded transition-colors av-num inline-block min-w-[60px] text-right ${className}`}
      style={{ background: 'var(--cyan-soft)', border: '1px solid var(--cyan)', color: 'var(--ink)' }}
      title="Click to edit"
    >
      {displayValue}
    </span>
  )
}
