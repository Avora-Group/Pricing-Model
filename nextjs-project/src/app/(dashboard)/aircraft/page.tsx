import { cookies } from 'next/headers'
import { AircraftTable } from '@/components/aircraft/AircraftTable'
import { CreateAircraftDialog } from '@/components/aircraft/CreateAircraftDialog'
import type { Aircraft } from '@/components/aircraft/AircraftTable'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

async function getAircraft(): Promise<Aircraft[]> {
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

async function getIsAdmin(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.role === 'admin'
  } catch {
    return false
  }
}

export default async function AircraftPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  const [aircraft, isAdmin] = await Promise.all([
    getAircraft(),
    token ? getIsAdmin(token) : Promise.resolve(false),
  ])

  return (
    <div className="space-y-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="av-page-title">Aircraft Fleet</h1>
          <p className="av-page-sub">
            Master data and cost parameters — feeds the pricing model
          </p>
        </div>
        {isAdmin && <CreateAircraftDialog />}
      </div>
      <AircraftTable aircraft={aircraft} />
    </div>
  )
}
