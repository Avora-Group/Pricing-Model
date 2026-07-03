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
    <div className="space-y-[18px]">
      {/* Search input */}
      <div>
        <input
          type="text"
          placeholder="Search by MSN or registration..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="av-input"
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* Table */}
      <div className="av-panel">
        <div className="av-panel-h">
          <h2>Fleet reference data</h2>
          <span className="av-hint av-num">{sorted.length} aircraft</span>
        </div>
        <div className="overflow-x-auto">
          <table className="av-tbl min-w-[400px]">
            <thead>
              <tr>
                <th onClick={() => handleSort('msn')} className="av-th cursor-pointer select-none">MSN{sortIndicator('msn')}</th>
                <th onClick={() => handleSort('aircraft_type')} className="av-th cursor-pointer select-none">Type{sortIndicator('aircraft_type')}</th>
                <th className="av-th">Registration</th>
                <th className="av-th r hidden md:table-cell">Lease Rent (USD)</th>
                <th className="av-th r hidden md:table-cell">Lease Rent (EUR)</th>
                <th className="av-th r hidden md:table-cell">6Y Check (USD)</th>
                <th className="av-th r hidden md:table-cell">6Y Check (EUR)</th>
                <th className="av-th r hidden md:table-cell">12Y Check (USD)</th>
                <th className="av-th r hidden md:table-cell">12Y Check (EUR)</th>
                <th className="av-th r hidden md:table-cell">LDG (USD)</th>
                <th className="av-th r hidden md:table-cell">LDG (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="av-td text-center" style={{ padding: '32px 14px', color: 'var(--muted)' }}>
                    No aircraft found
                  </td>
                </tr>
              ) : (
                sorted.map((a) => (
                  <tr key={a.id}>
                    <td className="av-td">
                      <Link href={`/aircraft/${a.msn}`} className="av-link av-num">
                        {a.msn}
                      </Link>
                    </td>
                    <td className="av-td"><span className="chip">{a.aircraft_type}</span></td>
                    <td className="av-td" style={{ color: 'var(--ink-2)' }}>{a.registration ?? '-'}</td>
                    <td className="av-td r av-num hidden md:table-cell" style={{ color: 'var(--ink-2)' }}>{formatRate(a.lease_rent_usd)}</td>
                    <td className="av-td r av-num hidden md:table-cell" style={{ color: 'var(--ink-2)' }}>{formatRate(a.lease_rent_eur)}</td>
                    <td className="av-td r av-num hidden md:table-cell" style={{ color: 'var(--ink-2)' }}>{formatRate(a.six_year_check_usd)}</td>
                    <td className="av-td r av-num hidden md:table-cell" style={{ color: 'var(--ink-2)' }}>{formatRate(a.six_year_check_eur)}</td>
                    <td className="av-td r av-num hidden md:table-cell" style={{ color: 'var(--ink-2)' }}>{formatRate(a.twelve_year_check_usd)}</td>
                    <td className="av-td r av-num hidden md:table-cell" style={{ color: 'var(--ink-2)' }}>{formatRate(a.twelve_year_check_eur)}</td>
                    <td className="av-td r av-num hidden md:table-cell" style={{ color: 'var(--ink-2)' }}>{formatRate(a.ldg_usd)}</td>
                    <td className="av-td r av-num hidden md:table-cell" style={{ color: 'var(--ink-2)' }}>{formatRate(a.ldg_eur)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
