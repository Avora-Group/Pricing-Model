'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface Aircraft {
  id: number
  msn: number
  aircraft_type: string
  registration: string | null
  lease_rent_usd: string
  six_year_check_usd: string
  twelve_year_check_usd: string
  ldg_usd: string
  lease_rent_eur: string
  six_year_check_eur: string
  twelve_year_check_eur: string
  ldg_eur: string
}

function formatRate(value: string | number | null): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

type SortKey = 'msn' | 'aircraft_type'

export function AircraftTable({ aircraft }: { aircraft: Aircraft[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('msn')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = aircraft.filter((a) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const msnMatch = a.msn.toString().includes(q)
    const regMatch = a.registration?.toLowerCase().includes(q) ?? false
    return msnMatch || regMatch
  })

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'msn') return (a.msn - b.msn) * dir
    return a.aircraft_type.localeCompare(b.aircraft_type) * dir
  })

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div>
        <input
          type="text"
          placeholder="Search by MSN or registration..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg overflow-x-auto">
        <table className="min-w-[400px] w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th onClick={() => handleSort('msn')} className="text-left px-4 py-3 text-[var(--text-primary)] font-semibold cursor-pointer select-none">MSN{sortIndicator('msn')}</th>
              <th onClick={() => handleSort('aircraft_type')} className="text-left px-4 py-3 text-[var(--text-primary)] font-semibold cursor-pointer select-none">Type{sortIndicator('aircraft_type')}</th>
              <th className="text-left px-4 py-3 text-[var(--text-primary)] font-semibold">Registration</th>
              <th className="text-right px-4 py-3 text-[var(--text-primary)] font-semibold hidden md:table-cell">Lease Rent (USD)</th>
              <th className="text-right px-4 py-3 text-[var(--text-primary)] font-semibold hidden md:table-cell">Lease Rent (EUR)</th>
              <th className="text-right px-4 py-3 text-[var(--text-primary)] font-semibold hidden md:table-cell">6Y Check (USD)</th>
              <th className="text-right px-4 py-3 text-[var(--text-primary)] font-semibold hidden md:table-cell">6Y Check (EUR)</th>
              <th className="text-right px-4 py-3 text-[var(--text-primary)] font-semibold hidden md:table-cell">12Y Check (USD)</th>
              <th className="text-right px-4 py-3 text-[var(--text-primary)] font-semibold hidden md:table-cell">12Y Check (EUR)</th>
              <th className="text-right px-4 py-3 text-[var(--text-primary)] font-semibold hidden md:table-cell">LDG (USD)</th>
              <th className="text-right px-4 py-3 text-[var(--text-primary)] font-semibold hidden md:table-cell">LDG (EUR)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No aircraft found
                </td>
              </tr>
            ) : (
              sorted.map((a) => (
                <tr key={a.id} className="border-b border-[var(--border-primary)]/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/aircraft/${a.msn}`}
                      className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      {a.msn}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{a.aircraft_type}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{a.registration ?? '-'}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-right hidden md:table-cell">{formatRate(a.lease_rent_usd)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-right hidden md:table-cell">{formatRate(a.lease_rent_eur)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-right hidden md:table-cell">{formatRate(a.six_year_check_usd)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-right hidden md:table-cell">{formatRate(a.six_year_check_eur)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-right hidden md:table-cell">{formatRate(a.twelve_year_check_usd)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-right hidden md:table-cell">{formatRate(a.twelve_year_check_eur)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-right hidden md:table-cell">{formatRate(a.ldg_usd)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-right hidden md:table-cell">{formatRate(a.ldg_eur)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
