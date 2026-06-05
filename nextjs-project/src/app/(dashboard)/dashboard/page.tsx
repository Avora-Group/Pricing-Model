import { cookies } from 'next/headers'
import { DashboardMetrics, type DashboardData } from '@/components/dashboard/DashboardMetrics'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

const EMPTY_DATA: DashboardData = {
  projects: [],
  project_counts: { potential: 0, signed: 0, active: 0, total: 0 },
  quote_counts: { draft: 0, sent: 0, accepted: 0, rejected: 0, total: 0 },
  averages: { eur_per_bh: null, margin_percent: null },
}

async function getDashboardData(): Promise<DashboardData> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return EMPTY_DATA

  try {
    const res = await fetch(`${API_URL}/pricing/dashboard`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return EMPTY_DATA
    return res.json()
  } catch {
    return EMPTY_DATA
  }
}

async function getIsViewer(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return false

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const user = await res.json()
    return user.role === 'viewer'
  } catch {
    return false
  }
}

export default async function DashboardPage() {
  const [data, isViewer] = await Promise.all([getDashboardData(), getIsViewer()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Project pipeline and portfolio overview
        </p>
      </div>
      <DashboardMetrics data={data} isViewer={isViewer} />
    </div>
  )
}
