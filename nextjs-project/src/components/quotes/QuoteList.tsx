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
      {/* Search and filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search quotes..."
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Status error toast */}
      {statusError && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md p-2 text-sm text-red-700 dark:text-red-200">
          {statusError}
        </div>
      )}

      {/* Table */}
      {quotes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-sm">
            No quotes found. Create a pricing calculation on the Dashboard and
            save it as a quote.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
          <table className="min-w-[500px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                <th onClick={() => handleSort('quote_number')} className="text-left px-4 py-3 font-medium cursor-pointer select-none">Quote #{sortIndicator('quote_number')}</th>
                <th onClick={() => handleSort('client_name')} className="text-left px-4 py-3 font-medium cursor-pointer select-none">Client{sortIndicator('client_name')}</th>
                <th onClick={() => handleSort('status')} className="text-left px-4 py-3 font-medium cursor-pointer select-none">Status{sortIndicator('status')}</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Rate</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">MSNs</th>
                <th onClick={() => handleSort('created_at')} className="text-left px-4 py-3 font-medium cursor-pointer select-none">Created{sortIndicator('created_at')}</th>
                {!isViewer && (
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedQuotes.map((q) => (
                <tr
                  key={q.id}
                  className="border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotes/${q.id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-600 dark:text-indigo-300 font-medium"
                    >
                      {q.quote_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{q.client_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-mono hidden sm:table-cell">
                    {q.exchange_rate ? `${parseFloat(q.exchange_rate).toFixed(4)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                    {q.msn_list?.length
                      ? q.msn_list.join(', ')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatDate(q.created_at)}
                  </td>
                  {!isViewer && (
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <select
                          value={q.status}
                          onChange={(e) => handleStatusUpdate(q.id, e.target.value)}
                          className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:border-indigo-400 focus:outline-none"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(q.id, q.quote_number)}
                            disabled={deletingId === q.id}
                            title="Delete quote"
                            className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
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

          {/* Footer with total */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
            Showing {quotes.length} of {total} quotes
          </div>
        </div>
      )}
    </div>
  )
}
