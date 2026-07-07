/**
 * Partial-month proration utilities.
 *
 * Computes day fractions for first/last months when a project starts or ends
 * mid-month. Pure functions — no React, no side effects.
 */

/** Per-month day information for proration */
export interface MonthDayInfo {
  activeDays: number // How many days the MSN operates in this month
  totalDays: number  // Total calendar days in the month (28-31)
}

/** Number of calendar days in a given month/year */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Parse a period string that may be YYYY-MM or YYYY-MM-DD.
 * Returns { year, month, day } where day defaults to -1 if YYYY-MM (no day component).
 */
export function parsePeriod(period: string | null | undefined): {
  year: number
  month: number
  day: number
  hasDay: boolean
} {
  if (!period) return { year: NaN, month: NaN, day: 1, hasDay: false }
  const parts = period.split('-').map(Number)
  const hasDay = parts.length >= 3 && !isNaN(parts[2])
  return {
    year: parts[0],
    month: parts[1],
    day: hasDay ? parts[2] : 1,
    hasDay,
  }
}

/**
 * Build MonthDayInfo[] for a month range given start/end period strings.
 *
 * For YYYY-MM format (backward compat): all months are full (activeDays === totalDays).
 * For YYYY-MM-DD format: first month starts at startDay, last month ends at endDay.
 * Middle months are always full.
 */
export function buildMonthDayInfos(
  months: { year: number; month: number }[],
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
): MonthDayInfo[] {
  const start = parsePeriod(periodStart)
  const end = parsePeriod(periodEnd)

  return months.map((m, i) => {
    const total = daysInMonth(m.year, m.month)
    let active = total // default: full month

    const isFirst = i === 0
    const isLast = i === months.length - 1

    // Single-month period with both day components
    if (isFirst && isLast && start.hasDay && end.hasDay) {
      active = end.day - start.day + 1
    } else {
      if (isFirst && start.hasDay && start.day > 1) {
        // Partial first month: from startDay to end of month
        active = total - start.day + 1
      }
      if (isLast && end.hasDay && end.day < total) {
        // Partial last month: from 1st to endDay
        active = end.day
      }
    }

    return { activeDays: Math.max(1, active), totalDays: total }
  })
}
