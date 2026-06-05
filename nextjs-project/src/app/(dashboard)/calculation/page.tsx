import { cookies } from 'next/headers'
import { DashboardSummary } from '@/components/pricing/DashboardSummary'
import type { AircraftOption } from '@/lib/api-converters'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

async function getAircraftList(): Promise<AircraftOption[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return []

  try {
    const res = await fetch(`${API_URL}/aircraft`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
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
  const [aircraftList, isViewer] = await Promise.all([
    getAircraftList(),
    getIsViewer(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Configure MSN inputs and view pricing summary
        </p>
      </div>
      <DashboardSummary aircraftList={aircraftList} isViewer={isViewer} />
    </div>
  )
}
