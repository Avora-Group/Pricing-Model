'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { fmt } from '@/lib/format'

export interface BreakdownItem {
  label: string
  value: number
  formula?: string
}

export interface ParamItem {
  label: string
  value: number
  decimals?: number
}

interface LineDetailPopoverProps {
  title: string
  monthLabel: string
  items: BreakdownItem[]
  params?: ParamItem[]
  anchorRect: DOMRect
  onClose: () => void
}

export function LineDetailPopover({
  title,
  monthLabel,
  items,
  params,
  anchorRect,
  onClose,
}: LineDetailPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const total = items.reduce((s, i) => s + i.value, 0)

  // Position below the clicked cell
  const top = anchorRect.bottom + 4
  const left = Math.max(8, anchorRect.left - 120)

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg shadow-xl w-[320px] text-xs"
      style={{ top, left, background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>
          {title}
        </span>
        <button
          onClick={onClose}
          className="transition-colors"
          style={{ color: 'var(--muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Month label */}
      <div className="px-3 py-1.5" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line-2)' }}>
        {monthLabel}
      </div>

      {/* Breakdown items */}
      <div className="px-3 py-2 space-y-1.5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--ink-2)' }}>{item.label}</span>
              <span className="av-num" style={{ color: 'var(--ink)' }}>{fmt(item.value, 0)}</span>
            </div>
            {item.formula && (
              <div className="text-[10px] av-num pl-2 mt-0.5" style={{ color: 'var(--muted)' }}>
                {item.formula}
              </div>
            )}
          </div>
        ))}

        <div
          className="pt-1.5 flex justify-between items-center font-semibold"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <span style={{ color: 'var(--ink)' }}>Total</span>
          <span className="av-num" style={{ color: 'var(--ink)' }}>{fmt(total, 0)}</span>
        </div>
      </div>

      {/* Parameters */}
      {params && params.length > 0 && (
        <div
          className="px-3 py-2 rounded-b-lg"
          style={{ borderTop: '1px solid var(--line)', background: 'var(--card-2)' }}
        >
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Parameters</div>
          <div className={`grid gap-2 text-[11px] ${params.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {params.map((p) => (
              <div key={p.label}>
                <span style={{ color: 'var(--muted)' }}>{p.label}</span>
                <span className="ml-1 av-num" style={{ color: 'var(--ink)' }}>
                  {fmt(p.value, p.decimals ?? 1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
