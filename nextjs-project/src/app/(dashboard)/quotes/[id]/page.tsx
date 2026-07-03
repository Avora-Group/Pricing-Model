import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { QuoteDetailResponse } from '@/app/actions/quotes'
import { QuoteDetailClient } from './QuoteDetailClient'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

async function getQuoteDetail(
  id: string,
  token: string
): Promise<QuoteDetailResponse | null> {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    notFound()
  }

  const quote = await getQuoteDetail(id, token)

  if (!quote) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
        <Link href="/quotes" className="av-link">
          Quotes
        </Link>
        <span>/</span>
        <span className="av-num" style={{ color: 'var(--ink-2)' }}>{quote.quote_number}</span>
      </nav>

      <QuoteDetailClient quote={quote} />
    </div>
  )
}
