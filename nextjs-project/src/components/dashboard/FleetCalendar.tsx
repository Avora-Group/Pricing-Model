'use client'

import { useMemo, useState } from 'react'

/** One MSN's occupation by a client over a YYYY-MM..YYYY-MM span. */
export interface CalendarSegment {
  msn: number
  aircraftType: string | null
  client: string
  status: string // sent | signed | active
  start: string // YYYY-MM
  end: string // YYYY-MM
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// active = green, signed = blue, sent = amber (a distinct third colour)
const STATUS_TEXT: Record<string, string> = {
  active: 'text-emerald-700 dark:text-emerald-400',
  signed: 'text-blue-700 dark:text-blue-400',
  sent: 'text-amber-700 dark:text-amber-400',
}
const STATUS_CELL: Record<string, string> = {
  active: 'bg-emerald-50 dark:bg-emerald-900/20',
  signed: 'bg-blue-50 dark:bg-blue-900/20',
  sent: 'bg-amber-50 dark:bg-amber-900/20',
}

export function FleetCalendar({ segments }: { segments: CalendarSegment[] }) {
  // Years spanned by any segment
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const s of segments) {
      const sy = parseInt(s.start.slice(0, 4), 10)
      const ey = parseInt(s.end.slice(0, 4), 10)
      if (!isNaN(sy) && !isNaN(ey)) for (let y = sy; y <= ey; y++) set.add(y)
    }
    return [...set].sort((a, b) => a - b)
  }, [segments])

  const [year, setYear] = useState<number>(() => {
    const now = new Date().getFullYear()
    if (years.includes(now)) return now
    return years[0] ?? now
  })

  // Group segments by MSN (sorted ascending)
  const rows = useMemo(() => {
    const byMsn = new Map<number, { aircraftType: string | null; segs: CalendarSegment[] }>()
    for (const s of segments) {
      if (!byMsn.has(s.msn)) byMsn.set(s.msn, { aircraftType: s.aircraftType, segs: [] })
      byMsn.get(s.msn)!.segs.push(s)
    }
    return [...byMsn.entries()].sort((a, b) => a[0] - b[0]).map(([msn, v]) => ({ msn, ...v }))
  }, [segments])

  const ym = (m: number) => `${year}-${String(m).padStart(2, '0')}`

  if (segments.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-[13px] text-[var(--text-tertiary)]">
        No committed aircraft yet. Sent, signed and active deals appear here by month.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Active</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Signed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Sent</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-[var(--border-secondary)]" /> TBD</span>
        </div>
        <div className="flex items-center gap-2">
          {years.length > 1 && (
            <button
              onClick={() => setYear((y) => Math.max(years[0], y - 1))}
              disabled={year <= years[0]}
              className="px-2 py-1 rounded-md border border-[var(--border-secondary)] text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--bg-tertiary)]"
            >‹</button>
          )}
          <span className="av-num text-sm font-semibold min-w-[44px] text-center">{year}</span>
          {years.length > 1 && (
            <button
              onClick={() => setYear((y) => Math.min(years[years.length - 1], y + 1))}
              disabled={year >= years[years.length - 1]}
              className="px-2 py-1 rounded-md border border-[var(--border-secondary)] text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--bg-tertiary)]"
            >›</button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
              <th className="av-th sticky left-0 bg-[var(--bg-secondary)] z-10">MSN</th>
              {MONTHS.map((m) => (
                <th key={m} className="av-th text-center min-w-[92px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.msn} className="border-b border-[var(--border-primary)] last:border-0">
                <td className="px-3.5 py-2 sticky left-0 bg-[var(--bg-primary)] z-10 border-r border-[var(--border-primary)] whitespace-nowrap">
                  <span className="av-msn">{row.msn}</span>
                  {row.aircraftType && (
                    <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">{row.aircraftType}</span>
                  )}
                </td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const key = ym(m)
                  const covering = row.segs.filter((s) => s.start <= key && key <= s.end)
                  const cellTint = covering.length === 1 ? STATUS_CELL[covering[0].status] ?? '' : ''
                  return (
                    <td key={m} className={`px-2 py-2 text-center align-middle border-r border-[var(--border-primary)] last:border-r-0 ${cellTint}`}>
                      {covering.length === 0 ? (
                        <span className="text-[var(--text-muted)] italic text-[11px]">TBD</span>
                      ) : (
                        <span className="leading-tight">
                          {covering.map((c, idx) => (
                            <span key={`${c.client}-${idx}`}>
                              {idx > 0 && <span className="text-[var(--text-muted)]"> / </span>}
                              <span className={`font-medium ${STATUS_TEXT[c.status] ?? ''}`}>{c.client}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
