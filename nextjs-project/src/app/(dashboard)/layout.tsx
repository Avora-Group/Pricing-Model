import { Sidebar } from '@/components/sidebar/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomTabBar } from '@/components/navigation/BottomTabBar'
import { CostVisibilityProvider } from '@/providers/CostVisibilityProvider'
import { getSession } from '@/lib/session'
import { CompanyDefaultsLoader } from '@/components/config/CompanyDefaultsLoader'
import { fetchAssumptions } from '@/app/actions/assumptions'
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

  const [{ role: userRole, email: userEmail, canViewCosts, canViewNaked }, savedAssumptions] = await Promise.all([
    getUser(session.token),
    fetchAssumptions(),
  ])

  return (
    <CostVisibilityProvider value={{ canViewCosts, canViewNaked }}>
      <CompanyDefaultsLoader saved={savedAssumptions} />
      {/* h-dvh (not h-screen/100vh) so the shell tracks the real viewport as the
          iOS Safari URL bar collapses. Only <main> scrolls; the BottomTabBar is
          an in-flow sibling below it, so scroll content ends above the bar
          instead of hiding behind a fixed overlay. */}
      <div className="flex h-dvh overflow-hidden" style={{ background: 'var(--bg)' }}>
        <Sidebar userEmail={userEmail} userRole={userRole} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar userEmail={userEmail} userRole={userRole} />
          <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
          <BottomTabBar userRole={userRole} />
        </div>
      </div>
    </CostVisibilityProvider>
  )
}
