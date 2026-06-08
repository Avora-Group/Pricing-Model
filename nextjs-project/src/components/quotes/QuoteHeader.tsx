'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Calculator, TrendingUp } from 'lucide-react'
import { StatusBadge } from '@/components/quotes/StatusBadge'

interface QuoteHeaderProps {
  quoteNumber: string
  clientName: string
  status: string
  createdAt: string
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function QuoteHeader({ quoteNumber, clientName, status, createdAt }: QuoteHeaderProps) {
  const router = useRouter()

  return (
    <>
      {/* Quote header card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {quoteNumber}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-gray-700 dark:text-gray-300">{clientName}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Created {formatDate(createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push('/quotes')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Quotes
            </button>
            <button
              onClick={() => router.push('/calculation')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <Calculator size={14} />
              Go to Calculation
            </button>
            <button
              onClick={() => router.push('/pnl')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <TrendingUp size={14} />
              Go to P&amp;L
            </button>
            <button
              onClick={() => router.push('/calculation')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 transition-colors"
            >
              <ExternalLink size={14} />
              Fork and Edit
            </button>
          </div>
        </div>
      </div>

      {/* Fork info banner */}
      <div className="bg-indigo-50 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700 rounded-lg p-3 text-sm text-indigo-700 dark:text-indigo-200">
        You are viewing a saved quote. Any changes will create a new quote when
        saved (fork behavior). Click &quot;Fork and Edit in Calculation&quot; to modify
        this quote as a new working copy.
      </div>
    </>
  )
}
