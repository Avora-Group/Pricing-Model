'use client'

import { fmt } from '@/lib/format'

/**
 * Read-only formula/computed cell — displays a formatted number without editing.
 */
export function FormulaCell({
  value,
  decimals = 2,
  className = '',
}: {
  value: number
  decimals?: number
  className?: string
}) {
  const display = fmt(value, decimals)
  return (
    <span
      className={`block text-right text-sm text-[var(--text-secondary)] px-2 py-0.5 ${className}`}
    >
      {display}
    </span>
  )
}

/**
 * Section header used to separate table groups (e.g. "Maintenance Personnel").
 */
export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-6 mb-2">
      <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
        {title}
      </h3>
    </div>
  )
}

/**
 * Card wrapper for config tables with rounded border and scroll support.
 */
export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">{children}</table>
      </div>
    </div>
  )
}
