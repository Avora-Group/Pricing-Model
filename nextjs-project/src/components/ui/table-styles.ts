/**
 * Shared CSS class constants for config table components.
 *
 * Extracted from CrewConfigTable to ensure consistent styling
 * across Crew, Costs, and any future config tables.
 */

/** Base header cell style */
export const thBase =
  'px-3 py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider'

/** Base data cell style */
export const tdBase = 'px-3 py-1.5 text-sm'

/** Numeric right-aligned data cell */
export const tdNum = `${tdBase} text-right av-num text-[var(--text-primary)]`

/** Label data cell (left-aligned descriptive text) */
export const tdLabel = `${tdBase} text-[var(--text-secondary)]`

/** Computed/formula data cell (right-aligned, muted) */
export const tdComputed = `${tdBase} text-right av-num text-[var(--text-tertiary)]`

/** Standard row border */
export const borderRow = 'border-b border-gray-200/60 dark:border-gray-800/60'
