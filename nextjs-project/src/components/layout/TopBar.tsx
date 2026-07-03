'use client'

import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'
import { LogOut } from 'lucide-react'

interface TopBarProps {
  userEmail?: string
  userRole?: string
}

// Route → breadcrumb (group › page)
const ROUTES: Record<string, { group: string; page: string }> = {
  dashboard: { group: 'Workspace', page: 'Dashboard' },
  calculation: { group: 'Workspace', page: 'Pricing Workspace' },
  pnl: { group: 'Workspace', page: 'Profit & Loss' },
  sensitivity: { group: 'Workspace', page: 'Sensitivity' },
  quotes: { group: 'Workspace', page: 'Quotes' },
  aircraft: { group: 'Reference Data', page: 'Aircraft Fleet' },
  crew: { group: 'Reference Data', page: 'Crew Costs' },
  costs: { group: 'Reference Data', page: 'Cost Assumptions' },
  admin: { group: 'Reference Data', page: 'Admin' },
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  user: 'Pricing',
  viewer: 'Viewer',
}

function initials(email?: string): string {
  if (!email) return 'AV'
  const name = email.split('@')[0]
  const parts = name.split(/[.\-_]/).filter(Boolean)
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return chars.toUpperCase()
}

export function TopBar({ userEmail, userRole = 'user' }: TopBarProps) {
  const pathname = usePathname()
  const key = pathname.split('/').filter(Boolean)[0] ?? 'dashboard'
  const crumb = ROUTES[key] ?? { group: 'Workspace', page: 'Dashboard' }

  return (
    <header
      className="h-[62px] flex items-center gap-4 px-6 shrink-0 sticky top-0 z-30"
      style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--muted)' }}>
        <span>{crumb.group}</span>
        <span style={{ color: 'var(--muted-2)' }}>›</span>
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>
          {crumb.page}
        </span>
      </div>

      <div className="flex-1" />

      {/* Status pill */}
      <div
        className="hidden md:flex items-center gap-2 text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
        style={{ color: 'var(--teal)', background: 'var(--pos-soft)' }}
      >
        <span
          className="w-[7px] h-[7px] rounded-full"
          style={{ background: 'var(--teal)', animation: 'avPulse 2s infinite' }}
        />
        System operational
      </div>

      {/* User */}
      <div className="flex items-center gap-2.5 pl-4" style={{ borderLeft: '1px solid var(--line)' }}>
        <div
          className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold text-white"
          style={{ background: 'var(--navy)' }}
        >
          {initials(userEmail)}
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {userEmail?.split('@')[0] ?? 'Avora User'}
          </div>
          <div className="text-[10.5px]" style={{ color: 'var(--muted)' }}>
            {ROLE_LABEL[userRole] ?? 'Pricing'}
          </div>
        </div>
        <form action={logoutAction} className="ml-1">
          <button
            type="submit"
            className="flex items-center gap-1.5 text-[13px] transition-colors"
            style={{ color: 'var(--muted)' }}
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  )
}
