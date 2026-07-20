'use client'

import { useLayoutEffect, useRef } from 'react'
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
  /** Cursor position (clientX/clientY) at hover start; the popover then
   *  follows the cursor itself via a document mousemove listener. */
  cursor: { x: number; y: number }
}

const OFFSET = 16 // px gap between cursor and popover
const MARGIN = 8 // px minimum distance from viewport edges

/**
 * Hover tooltip showing a cost line's build-up. Pointer-events are disabled so
 * it never traps the mouse; it repositions itself directly (no React state) on
 * every mousemove to avoid re-rendering the heavy parent tables, flipping
 * left/above the cursor near the right/bottom viewport edges.
 */
export function LineDetailPopover({
  title,
  monthLabel,
  items,
  params,
  cursor,
}: LineDetailPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const place = (x: number, y: number) => {
      const { width, height } = el.getBoundingClientRect()
      let left = x + OFFSET
      let top = y + OFFSET
      if (left + width > window.innerWidth - MARGIN) left = x - OFFSET - width
      if (top + height > window.innerHeight - MARGIN) top = y - OFFSET - height
      el.style.left = `${Math.max(MARGIN, left)}px`
      el.style.top = `${Math.max(MARGIN, top)}px`
    }
    place(cursor.x, cursor.y)
    const onMove = (e: MouseEvent) => place(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [cursor.x, cursor.y])

  const total = items.reduce((s, i) => s + i.value, 0)

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg shadow-xl w-[320px] text-xs pointer-events-none"
      style={{ top: cursor.y + OFFSET, left: cursor.x + OFFSET, background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      {/* Header */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>
          {title}
        </span>
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
