import { cookies } from 'next/headers'
import { Users } from 'lucide-react'
import { listUsersAction } from '@/app/actions/admin'
import { UserTable } from '@/components/admin/UserTable'
import { CreateUserDialog } from '@/components/admin/CreateUserDialog'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

async function getIsAdmin(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const user = await res.json()
    return user.role === 'admin'
  } catch {
    return false
  }
}

export default async function AdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return (
      <div className="p-6 text-[var(--text-tertiary)]">
        Not authenticated
      </div>
    )
  }

  const isAdmin = await getIsAdmin(token)

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-tertiary)]">
        <Users size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm mt-1">Admin privileges required to view this page.</p>
      </div>
    )
  }

  const result = await listUsersAction()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            User Management
          </h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Manage user accounts and reset passwords
          </p>
        </div>
        <CreateUserDialog />
      </div>

      {result.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {result.error}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <UserTable users={result.users ?? []} />
        </div>
      )}
    </div>
  )
}
