import { cookies } from 'next/headers'
import { CostsConfigTable } from '@/components/costs/CostsConfigTable'
import { ReadOnlyProvider } from '@/components/ui/ReadOnlyContext'
import { AssumptionsBar } from '@/components/config/AssumptionsBar'
import { fetchAssumptions } from '@/app/actions/assumptions'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

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

export default async function CostsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  const [canEdit, saved] = await Promise.all([
    token ? getCanEdit(token) : Promise.resolve(false),
    fetchAssumptions(),
  ])

  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="av-page-title">Cost Assumptions</h1>
        <p className="av-page-sub">
          {canEdit
            ? 'Maintenance, insurance, DOC, other COGS and overhead drivers'
            : 'Maintenance, insurance, DOC, other COGS and overhead drivers — read-only'}
        </p>
      </div>
      <AssumptionsBar kind="costs" canEdit={canEdit} savedAt={saved.costs?.updated_at ?? null} />
      <ReadOnlyProvider readOnly={!canEdit}>
        <CostsConfigTable />
      </ReadOnlyProvider>
    </div>
  )
}
