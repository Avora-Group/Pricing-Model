import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AircraftDetail } from '@/components/aircraft/AircraftDetail'
import type { AircraftDetailData } from '@/components/aircraft/AircraftDetail'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

async function getAircraftDetail(msn: string, token: string): Promise<AircraftDetailData | null> {
  try {
    const res = await fetch(`${API_URL}/aircraft/${msn}`, {
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

async function getCanEdit(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const data = await res.json()
    // Editors are admins and users (everyone except viewers).
    return data.role === 'admin' || data.role === 'user'
  } catch {
    return false
  }
}

export default async function AircraftDetailPage({
  params,
}: {
  params: Promise<{ msn: string }>
}) {
  const { msn } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    notFound()
  }

  const [aircraft, canEdit] = await Promise.all([
    getAircraftDetail(msn, token),
    getCanEdit(token),
  ])

  if (!aircraft) {
    notFound()
  }

  return (
    <div className="space-y-[18px]">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>
        <Link href="/aircraft" className="av-link">
          Aircraft
        </Link>
        <span style={{ color: 'var(--muted-2)' }}>›</span>
        <span style={{ color: 'var(--ink-2)' }}>MSN {msn}</span>
      </nav>

      <AircraftDetail aircraft={aircraft} canEdit={canEdit} />
    </div>
  )
}
