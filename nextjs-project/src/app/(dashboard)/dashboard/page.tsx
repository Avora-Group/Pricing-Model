import { cookies } from 'next/headers'
import { DashboardMetrics, type DashboardData } from '@/components/dashboard/DashboardMetrics'
import type { CalendarSegment } from '@/components/dashboard/FleetCalendar'
import { computeQuoteFinancials } from '@/lib/quote-financials'
import type { QuoteDetailResponse } from '@/app/actions/quotes'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

const EMPTY: DashboardData = {
  projects: [],
  project_counts: { sent: 0, signed: 0, active: 0, total: 0 },
  quote_counts: { draft: 0, sent: 0, signed: 0, active: 0, completed: 0, rejected: 0, total: 0 },
  averages: { eur_per_bh: null, margin_percent: null },
  calendar: [],
}

interface ProjectIdentity {
  id: number
  name: string
  status: string
  created_at: string | null
  created_by: string | null
  quote: { quote_number: string; status: string; created_at: string | null }
}

interface DashboardEnvelope {
  projects: ProjectIdentity[]
  project_counts: DashboardData['project_counts']
  quote_counts: DashboardData['quote_counts']
}

async function getJson<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function buildDashboard(token: string): Promise<DashboardData> {
  const envelope = await getJson<DashboardEnvelope>('/pricing/dashboard', token)
  if (!envelope) return EMPTY

  // Fetch each project's authoritative quote and compute financials with the
  // same P&L engine the P&L page uses (partial-month proration included).
  const quotes = await Promise.all(
    envelope.projects.map((p) =>
      getJson<QuoteDetailResponse>(`/quotes/${p.id}`, token),
    ),
  )

  const num = (v: string | null) => (v === null ? null : Number(v))

  const projects = envelope.projects.map((p, i) => {
    const quote = quotes[i]
    const fin = quote
      ? computeQuoteFinancials(quote)
      : null
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      created_at: p.created_at,
      created_by: p.created_by,
      quote: p.quote,
      msn_count: fin?.msn_count ?? 0,
      total_mgh: fin?.total_mgh ?? null,
      period_months: fin?.period_months ?? null,
      monthly_revenue: fin?.monthly_revenue ?? null,
      monthly_cost: fin?.monthly_cost ?? null,
      monthly_profit: fin?.monthly_profit ?? null,
      total_revenue: fin?.total_revenue ?? null,
      total_profit: fin?.total_profit ?? null,
      margin_percent:
        fin && num(fin.monthly_revenue) && num(fin.monthly_revenue)! !== 0
          ? String((num(fin.monthly_profit)! / num(fin.monthly_revenue)!) * 100)
          : null,
      eur_per_bh: fin?.eur_per_bh ?? null,
      msns: fin?.msns ?? [],
    }
  })

  // Fleet averages from the computed projects
  let rateWeightSum = 0
  let rateWeight = 0
  let sumRev = 0
  let sumProfit = 0
  for (const p of projects) {
    const rate = num(p.eur_per_bh)
    const mgh = num(p.total_mgh)
    if (rate && mgh) {
      rateWeightSum += rate * mgh
      rateWeight += mgh
    }
    const rev = num(p.total_revenue)
    const profit = num(p.total_profit)
    if (rev !== null) sumRev += rev
    if (profit !== null) sumProfit += profit
  }

  // Fleet calendar: one segment per MSN per project, by month span
  const calendar: CalendarSegment[] = []
  envelope.projects.forEach((p, i) => {
    const quote = quotes[i]
    if (!quote) return
    for (const snap of quote.msn_snapshots ?? []) {
      const mi = (snap.msn_input ?? {}) as Record<string, unknown>
      const start = String(mi.periodStart ?? mi.period_start ?? '').slice(0, 7)
      const end = String(mi.periodEnd ?? mi.period_end ?? '').slice(0, 7)
      if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) continue
      calendar.push({
        msn: snap.msn,
        aircraftType: snap.aircraft_type ?? null,
        client: p.name,
        status: p.status,
        start,
        end,
      })
    }
  })

  return {
    projects,
    project_counts: envelope.project_counts,
    quote_counts: envelope.quote_counts,
    averages: {
      eur_per_bh: rateWeight > 0 ? String(rateWeightSum / rateWeight) : null,
      margin_percent: sumRev > 0 ? String((sumProfit / sumRev) * 100) : null,
    },
    calendar,
  }
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  const data = token ? await buildDashboard(token) : EMPTY

  return (
    <div className="space-y-6">
      <div>
        <h1 className="av-page-title">Dashboard</h1>
        <p className="av-page-sub">Project pipeline and portfolio overview</p>
      </div>
      <DashboardMetrics data={data} />
    </div>
  )
}
