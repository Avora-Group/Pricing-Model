'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Search, Trash2 } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { listQuotesAction, updateQuoteStatusAction, deleteQuoteAction } from '@/app/actions/quotes'
import type { QuoteListItem } from '@/app/actions/quotes'

interface QuoteListProps {
  initialQuotes: { items: QuoteListItem[]; total: number }
  isAdmin?: boolean
  isViewer?: boolean
}

const STATUSES = ['draft', 'sent', 'signed', 'active', 'completed', 'rejected']

type QuoteSortKey = 'quote_number' | 'client_name' | 'status' | 'created_at'

export function QuoteList({ initialQuotes, isAdmin = false, isViewer = false }: QuoteListProps) {
  const [quotes, setQuotes] = useState(initialQuotes.items)
  const [total, setTotal] = useState(initialQuotes.total)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<QuoteSortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSort = (key: QuoteSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedQuotes = [...quotes].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortKey) {
      case 'quote_number':
        return a.quote_number.localeCompare(b.quote_number) * dir
      case 'client_name':
        return a.client_name.toLowerCase().localeCompare(b.client_name.toLowerCase()) * dir
      case 'status':
        return a.status.localeCompare(b.status) * dir
      case 'created_at':
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
      default:
        return 0
    }
  })

  const sortIndicator = (key: QuoteSortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''

  const fetchQuotes = useCallback(async (searchVal: string, statusVal: string) => {
    const params: { search?: string; status?: string; limit?: number } = { limit: 50 }
    if (searchVal.trim()) params.search = searchVal.trim()
    if (statusVal) params.status = statusVal

    const result = await listQuotesAction(params)
    if (!('error' in result)) {
      setQuotes(result.items)
      setTotal(result.total)
    }
  }, [])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchQuotes(val, statusFilter)
    }, 300)
  }

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val)
    fetchQuotes(search, val)
  }

  const handleStatusUpdate = async (quoteId: number, newStatus: string) => {
    setStatusError(null)
    const result = await updateQuoteStatusAction(quoteId, newStatus)
    if ('error' in result) {
      setStatusError(result.error)
      return
    }
    // Update local state
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q))
    )
  }

  const handleDelete = async (quoteId: number, quoteNumber: string) => {
    if (!window.confirm(`Delete quote ${quoteNumber}? This cannot be undone.`)) return
    setDeletingId(quoteId)
    setStatusError(null)
    const result = await deleteQuoteAction(quoteId)
    setDeletingId(null)
    if ('error' in result) {
      setStatusError(result.error)
      return
    }
    setQuotes((prev) => prev.filter((q) => q.id !== quoteId))
    setTotal((prev) => prev - 1)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      {statusError && (
        <div
          className="av-panel px-4 py-2 text-sm"
          style={{ color: 'var(--neg)', borderColor: 'var(--neg)' }}
        >
          {statusError}
        </div>
      )}

      <div className="av-panel">
        <div className="av-panel-h">
          <div>
            <h2>Quotes</h2>
          </div>
          <div className="relative">
            <Search
              size={15}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--muted)' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search client or quote no."
              aria-label="Search client or quote number"
              className="av-input pl-8"
              style={{ width: 240 }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            aria-label="Filter by status"
            className="av-input"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {quotes.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
            No quotes found. Build a pricing calculation and save it as a quote.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="av-tbl">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('quote_number')} className="av-th cursor-pointer select-none">Quote{sortIndicator('quote_number')}</th>
                    <th onClick={() => handleSort('client_name')} className="av-th cursor-pointer select-none">Client{sortIndicator('client_name')}</th>
                    <th onClick={() => handleSort('status')} className="av-th cursor-pointer select-none">Status{sortIndicator('status')}</th>
                    <th className="av-th r hidden sm:table-cell">USD/EUR</th>
                    <th className="av-th hidden sm:table-cell">MSN</th>
                    <th onClick={() => handleSort('created_at')} className="av-th r cursor-pointer select-none">Created{sortIndicator('created_at')}</th>
                    {!isViewer && <th className="av-th r hidden sm:table-cell">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedQuotes.map((q) => (
                    <tr key={q.id}>
                      <td className="av-td">
                        <Link href={`/quotes/${q.id}`} className="tlink av-num">
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="av-td font-semibold" style={{ color: 'var(--ink)' }}>{q.client_name}</td>
                      <td className="av-td"><StatusBadge status={q.status} /></td>
                      <td className="av-td av-num r hidden sm:table-cell" style={{ color: 'var(--ink-2)' }}>
                        {q.exchange_rate ? parseFloat(q.exchange_rate).toFixed(4) : '—'}
                      </td>
                      <td className="av-td hidden sm:table-cell">
                        {q.msn_list?.length ? (
                          <span className="flex flex-wrap gap-1">
                            {q.msn_list.slice(0, 4).map((m) => <span key={m} className="av-msn">{m}</span>)}
                            {q.msn_list.length > 4 && <span className="text-[11px] self-center" style={{ color: 'var(--muted)' }}>+{q.msn_list.length - 4}</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="av-td av-num r whitespace-nowrap" style={{ color: 'var(--muted)' }}>{formatDate(q.created_at)}</td>
                      {!isViewer && (
                        <td className="av-td r hidden sm:table-cell">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={q.status}
                              onChange={(e) => handleStatusUpdate(q.id, e.target.value)}
                              aria-label={`Status for ${q.quote_number}`}
                              className="av-input !py-1 !px-2 !text-xs"
                            >
                              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                            <Link href={`/quotes/${q.id}`} className="av-btn av-btn-ghost !py-1 !px-2.5 !text-[12px]">
                              Open
                            </Link>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDelete(q.id, q.quote_number)}
                                disabled={deletingId === q.id}
                                title="Delete quote"
                                aria-label={`Delete ${q.quote_number}`}
                                className="p-1 rounded transition-colors disabled:opacity-50"
                                style={{ color: 'var(--muted)' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-[18px] py-2.5 text-xs" style={{ color: 'var(--muted)', borderTop: '1px solid var(--line-2)' }}>
              Showing {quotes.length} of {total} quotes
            </div>
          </>
        )}
      </div>
    </div>
  )
}
