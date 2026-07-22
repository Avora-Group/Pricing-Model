'use client'

import { useState } from 'react'
import {
  LineDetailPopover,
  type BreakdownItem,
  type ParamItem,
} from '@/components/pricing/CostDetailPopover'
import { useCanViewCosts } from '@/providers/CostVisibilityProvider'

/** One MSN's occupation by a client over a YYYY-MM..YYYY-MM span. */
export interface CalendarSegment {
  msn: number
  aircraftType: string | null
  client: string
  status: string // sent | signed | active
  start: string // YYYY-MM
  end: string // YYYY-MM
  eurPerBh?: string | null
  // Per-MSN deal detail for the hover popover (cost fields absent for viewers).
  quoteNumber?: string | null
  mgh?: string | null
  cycleRatio?: string | null
  crewSets?: string | null
  periodMonths?: string | null
  monthlyRevenue?: string | null
  monthlyCost?: string | null
  monthlyProfit?: string | null
}

export interface FleetTail {
  msn: number
  aircraft_type: string | null
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const COMMITTED = new Set(['active', 'signed'])

interface BoardSeg {
  key: string
  status: string
  label: string
  /** Clipped month offsets within the 12-month window. */
  m0: number
  m1: number // exclusive
  src: CalendarSegment
}

interface BoardRow {
  msn: number
  type: string | null
  segs: BoardSeg[]
  /** Committed share of the window (0..1), or null when nothing is committed. */
  util: number | null
  pending: boolean
}

function fmtRate(v: string | null | undefined): string | null {
  const x = v === null || v === undefined || v === '' ? NaN : Number(v)
  if (isNaN(x) || x <= 0) return null
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(x)
}

/**
 * Fleet deployment board: one Gantt row per tail across the next 12 months.
 * Committed deals (signed/active) render solid; sent quotes render dashed and
 * do not count toward utilisation. Tails with nothing booked stay visible as
 * "available" — idle capacity is information, not noise.
 */
/** "2026-07" → "Jul 2026" for the popover's period line. */
function fmtYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return `${MONTH_LABELS[m - 1]} ${y}`
}

export function FleetBoard({
  segments,
  fleet,
  today,
}: {
  segments: CalendarSegment[]
  fleet: FleetTail[]
  today: string // YYYY-MM-DD, fixed on the server so SSR and hydration agree
}) {
  const canViewCosts = useCanViewCosts()
  const [hover, setHover] = useState<{ seg: CalendarSegment; x: number; y: number } | null>(null)
  const [y0, mo0, d0] = today.split('-').map(Number)
  const monthIndex = (ym: string) => {
    const [y, m] = ym.split('-').map(Number)
    if (!y || !m) return NaN
    return (y - y0) * 12 + (m - mo0)
  }

  // Union of the aircraft fleet and any MSN that appears on a deal.
  const types = new Map<number, string | null>()
  for (const t of fleet) types.set(t.msn, t.aircraft_type)
  for (const s of segments) if (!types.has(s.msn)) types.set(s.msn, s.aircraftType)

  const rows: BoardRow[] = [...types.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([msn, type]) => {
      const covered = new Array<boolean>(12).fill(false)
      let pending = false
      const segs: BoardSeg[] = []
      segments
        .filter((s) => s.msn === msn)
        .forEach((s, i) => {
          const m0 = Math.max(0, monthIndex(s.start))
          const m1 = Math.min(12, monthIndex(s.end) + 1)
          if (isNaN(m0) || isNaN(m1) || m1 <= m0) return
          if (COMMITTED.has(s.status)) {
            for (let m = m0; m < m1; m++) covered[m] = true
          } else {
            pending = true
          }
          const rate = fmtRate(s.eurPerBh)
          segs.push({
            key: `${s.client}-${i}`,
            status: s.status,
            // Rate fits only on longer segments; the client name always leads.
            label: rate && m1 - m0 >= 4 ? `${s.client} · ${rate} €/BH` : s.client,
            m0,
            m1,
            src: s,
          })
        })
      // Committed segments render after (= above) dashed sent ones, so an
      // overlapping quote's label never bleeds through a firm deal.
      segs.sort((a, b) => Number(COMMITTED.has(a.status)) - Number(COMMITTED.has(b.status)))
      const committedMonths = covered.filter(Boolean).length
      return { msn, type, segs, util: committedMonths > 0 ? committedMonths / 12 : null, pending }
    })

  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
        No aircraft in the fleet yet. Tails appear here with their committed and quoted periods.
      </div>
    )
  }

  const endIdx = mo0 - 1 + 11
  const windowLabel = `${MONTH_LABELS[mo0 - 1]} ${y0} → ${MONTH_LABELS[endIdx % 12]} ${y0 + Math.floor(endIdx / 12)}`
  const daysInMonth = new Date(y0, mo0, 0).getDate()
  const todayLeft = (((d0 - 1) / daysInMonth) / 12) * 100
  const pct = (m: number) => `${(m / 12) * 100}%`

  return (
    <div className="overflow-x-auto">
      <div className="av-fb">
        <div className="av-fb-axis">
          <span className="av-hint">{windowLabel}</span>
          <div className="av-fb-months">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i}>{MONTH_LABELS[(mo0 - 1 + i) % 12]}</span>
            ))}
          </div>
          <span />
        </div>

        {rows.map((row) => (
          <div className="av-fb-row" key={row.msn}>
            <div className="av-fb-tail">
              <span className="av-msn">{row.msn}</span>
              {row.type && <span className="ty">{row.type}</span>}
            </div>
            <div className={`av-fb-track${row.segs.length === 0 ? ' idle' : ''}`}>
              <div className="av-fb-today" style={{ left: `${todayLeft}%` }}>
                {row === rows[0] && <i>today</i>}
              </div>
              {row.segs.map((s) => (
                <div
                  key={s.key}
                  className={`av-fb-seg ${COMMITTED.has(s.status) ? s.status : 'sent'}`}
                  style={{ left: pct(s.m0), width: pct(s.m1 - s.m0) }}
                  onMouseEnter={(e) => setHover({ seg: s.src, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                >
                  {s.label}
                </div>
              ))}
            </div>
            <div className="av-fb-util av-num">
              {row.util !== null ? (
                `${Math.round(row.util * 100)}%`
              ) : (
                <span className="idle">{row.pending ? 'pending' : 'available'}</span>
              )}
            </div>
          </div>
        ))}

        <div className="av-fb-legend">
          <span><span className="d" style={{ background: '#2cc39c' }} />Active</span>
          <span><span className="d" style={{ background: '#3f56b0' }} />Signed</span>
          <span>
            <span
              className="d"
              style={{ background: 'color-mix(in srgb, #18B4D8 20%, transparent)', border: '1.5px dashed #18B4D8', width: 8, height: 8 }}
            />
            Quoted / sent
          </span>
          <span style={{ marginLeft: 'auto' }}>Utilisation = committed share of the next 12 months</span>
        </div>
      </div>

      {/* Deal detail popover — same component as the quote cost breakdown */}
      {hover && (() => {
        const s = hover.seg
        const numOf = (v: string | null | undefined) => {
          const x = v === null || v === undefined || v === '' ? NaN : Number(v)
          return isNaN(x) ? null : x
        }
        const rev = numOf(s.monthlyRevenue)
        const cost = numOf(s.monthlyCost)
        const items: BreakdownItem[] = []
        if (rev !== null) items.push({ label: 'Monthly revenue', value: rev })
        if (canViewCosts && cost !== null) items.push({ label: 'Monthly cost', value: -cost })
        if (items.length === 0) return null
        const params: ParamItem[] = []
        const push = (label: string, v: string | null | undefined, decimals = 0) => {
          const x = numOf(v)
          if (x !== null) params.push({ label, value: x, decimals })
        }
        push('MGH', s.mgh)
        push('€/BH', s.eurPerBh)
        push('FH:FC', s.cycleRatio, 2)
        push('Crew', s.crewSets, 1)
        push('Term mo', s.periodMonths)
        const statusLabel = s.status.charAt(0).toUpperCase() + s.status.slice(1)
        return (
          <LineDetailPopover
            title={`${s.client} — MSN ${s.msn}${s.quoteNumber ? ` · ${s.quoteNumber}` : ''}`}
            monthLabel={`${statusLabel} · ${fmtYm(s.start)} → ${fmtYm(s.end)} · per month, EUR`}
            items={items}
            params={params}
            cursor={{ x: hover.x, y: hover.y }}
          />
        )
      })()}
    </div>
  )
}
