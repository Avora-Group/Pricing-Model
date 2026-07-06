import { cookies } from 'next/headers'
import { QuoteList } from '@/components/quotes/QuoteList'
import type { QuoteListItem } from '@/app/actions/quotes'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

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
        isViewer={role === 'viewer'}
      />
    </div>
  )
}
