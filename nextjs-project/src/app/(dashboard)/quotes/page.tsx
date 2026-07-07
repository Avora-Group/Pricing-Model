import { cookies } from 'next/headers'
import { QuoteList } from '@/components/quotes/QuoteList'
import type { QuoteListItem, QuoteDetailResponse } from '@/app/actions/quotes'
import { computeQuoteFinancials } from '@/lib/quote-financials'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

/** Per-quote MGH + ACMI rate, computed from the saved snapshot (same engine as
 *  the dashboard). Keyed by quote id. */
export type QuoteFinancialsMap = Record<number, { totalMgh: string | null; eurPerBh: string | null }>

async function getQuoteDetail(id: number, token: string): Promise<QuoteDetailResponse | null> {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getFinancials(items: QuoteListItem[], token: string): Promise<QuoteFinancialsMap> {
  const details = await Promise.all(items.map((q) => getQuoteDetail(q.id, token)))
  const map: QuoteFinancialsMap = {}
  items.forEach((q, i) => {
    const d = details[i]
    const f = d ? computeQuoteFinancials(d) : null
    map[q.id] = { totalMgh: f?.total_mgh ?? null, eurPerBh: f?.eur_per_bh ?? null }
  })
  return map
}

async function getQuotes(
  token: string
): Promise<{ items: QuoteListItem[]; total: number }> {
  try {
    const res = await fetch(`${API_URL}/quotes/?limit=50`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return { items: [], total: 0 }
    return res.json()
  } catch {
    return { items: [], total: 0 }
  }
}

async function getUserRole(token: string): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return 'user'
    const user = await res.json()
    return user.role ?? 'user'
  } catch {
    return 'user'
  }
}

export default async function QuotesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  const [initialQuotes, role] = token
    ? await Promise.all([getQuotes(token), getUserRole(token)])
    : [{ items: [], total: 0 }, 'user']

  const financials = token ? await getFinancials(initialQuotes.items, token) : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="av-page-title">Quotes</h1>
        <p className="av-page-sub">
          {initialQuotes.total > 0
            ? `${initialQuotes.total} saved quote${initialQuotes.total === 1 ? '' : 's'} · immutable snapshots`
            : 'No quotes yet'}
        </p>
      </div>
      <QuoteList
        initialQuotes={initialQuotes}
        financials={financials}
        isViewer={role === 'viewer'}
      />
    </div>
  )
}
