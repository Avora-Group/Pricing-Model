/**
 * MGH "per-period" distribution (30/360).
 *
 * When an MSN's `mghMode` is 'period', the entered MGH is the TOTAL block hours
 * for the whole term, distributed across the term's months by 30/360 day
 * weights (full month = 30 days; a start month counts 30 − startDay + 1; an end
 * month counts endDay capped at 30). The distributed month BH is final: it
 * drives revenue and BH-variable costs directly, with NO further calendar-day
 * proration. Fixed costs still prorate by actual calendar days as usual.
 *
 * In 'month' mode the per-month BH weight equals the calendar day fraction, so
 * BH-side and fixed costs prorate identically (the original behaviour).
 */

import { parsePeriod } from './pnl-proration'

/** 30/360 active-day count for one calendar month within [start, end] (0 if outside). */
export function thirty360DaysInMonth(
  year: number,
  month: number,
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number },
): number {
  const ym = year * 12 + month
  const sYm = start.year * 12 + start.month
  const eYm = end.year * 12 + end.month
  if (ym < sYm || ym > eYm) return 0
  const segStart = ym === sYm ? Math.min(Math.max(start.day, 1), 30) : 1
  const segEnd = ym === eYm ? Math.min(Math.max(end.day, 1), 30) : 30
  return Math.max(0, segEnd - segStart + 1)
}

/**
 * Normalised per-month BH weights (sum = 1) for a period, by 30/360 days.
 * `months` is the full month range the engine iterates. Returns an equal-length
 * array; months outside the period get weight 0.
 */
export function periodBhWeights(
  months: { year: number; month: number }[],
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number },
): number[] {
  const days = months.map((mo) => thirty360DaysInMonth(mo.year, mo.month, start, end))
  const total = days.reduce((s, d) => s + d, 0)
  if (total <= 0) return months.map(() => 0)
  return days.map((d) => d / total)
}

/**
 * Convenience: per-month BH weights from period start/end strings
 * (YYYY-MM or YYYY-MM-DD). A dateless start counts from day 1; a dateless end
 * counts to the end of the month (30 in 30/360).
 */
export function periodBhWeightsFromStrings(
  months: { year: number; month: number }[],
  startStr: string | null | undefined,
  endStr: string | null | undefined,
): number[] {
  if (!startStr || !endStr) return months.map(() => 0)
  const s = parsePeriod(startStr)
  const e = parsePeriod(endStr)
  if (!s.year || !e.year) return months.map(() => 0)
  return periodBhWeights(
    months,
    { year: s.year, month: s.month, day: s.hasDay ? s.day : 1 },
    { year: e.year, month: e.month, day: e.hasDay ? e.day : 30 },
  )
}
