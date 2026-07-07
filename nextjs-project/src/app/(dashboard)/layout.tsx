import { Sidebar } from '@/components/sidebar/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomTabBar } from '@/components/navigation/BottomTabBar'
import { CostVisibilityProvider } from '@/providers/CostVisibilityProvider'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

async function getUser(
  token: string,
): Promise<{ role: string; email?: string; canViewCosts: boolean; canViewNaked: boolean }> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return { role: 'user', canViewCosts: false, canViewNaked: false }
    const user = await res.json()
    const role = user.role ?? 'user'
    return {
      role,
      email: user.email,
      // Base cost figures: admins and users (viewers restricted).
      canViewCosts: role === 'admin' || role === 'user',
      // Naked rates: admins implicitly; 'user' role only if granted; never viewers.
      canViewNaked: role === 'admin' || (role === 'user' && Boolean(user.can_view_costs)),
    }
  } catch {
    return { role: 'user', canViewCosts: false, canViewNaked: false }
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defense-in-depth: verify session in layout, not just middleware
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const { role: userRole, email: userEmail, canViewCosts, canViewNaked } = await getUser(session.token)

  return (
    <CostVisibilityProvider value={{ canViewCosts, canViewNaked }}>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
        <Sidebar userRole={userRole} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar userEmail={userEmail} userRole={userRole} />
          <main className="flex-1 overflow-auto p-4 md:p-6 pb-18 md:pb-6">{children}</main>
        </div>
        <BottomTabBar userRole={userRole} />
      </div>
    </CostVisibilityProvider>
  )
}
