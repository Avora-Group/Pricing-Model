'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  FileText,
  Plane,
  Settings,
  ChevronLeft,
  DollarSign,
  BarChart3,
  Calculator,
} from 'lucide-react'
import { useSidebarStore } from '@/stores/sidebar-store'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const navSections = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/calculation', label: 'Pricing Workspace', icon: Calculator },
      { href: '/pnl', label: 'P&L', icon: TrendingUp },
      { href: '/sensitivity', label: 'Sensitivity', icon: BarChart3 },
      { href: '/quotes', label: 'Quotes', icon: FileText },
    ],
  },
  {
    label: 'Reference',
    items: [
      { href: '/aircraft', label: 'Aircraft', icon: Plane },
      { href: '/crew', label: 'Crew', icon: Users },
      { href: '/costs', label: 'Costs', icon: DollarSign },
      { href: '/admin', label: 'Admin', icon: Settings },
    ],
  },
]

const viewerAllowedHrefs = new Set(['/dashboard', '/calculation', '/quotes'])

interface SidebarProps {
  userRole?: string
}

export function Sidebar({ userRole = 'user' }: SidebarProps) {
  const { isCollapsed, toggle } = useSidebarStore()
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => setMounted(true), [])
  const collapsed = mounted ? isCollapsed : false

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-[208px]'
      } av-rail transition-all duration-300 h-screen hidden md:flex flex-col shrink-0 border-r av-rail-bd`}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 h-[57px] px-4 border-b av-rail-bd">
        {!collapsed ? (
          /* Rail is always dark navy → use the white wordmark in both themes */
          <img
            src="/fly2sky_logo_white.png"
            alt="Fly2Sky JSC"
            className="h-[24px] w-auto object-contain shrink-0"
          />
        ) : (
          <div
            className="w-[28px] h-[28px] rounded-lg grid place-items-center shrink-0 font-extrabold text-[10px] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
            style={{ background: 'var(--cyan)' }}
          >
            F2S
          </div>
        )}
        <button
          onClick={toggle}
          className="ml-auto p-1 rounded-md hover:bg-white/10 transition-colors text-current"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            size={16}
            className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
        {navSections.map((section) => {
          const items = section.items.filter(({ href }) => {
            // Admin tab is admin-only; users have all other rights.
            if (href === '/admin') return userRole === 'admin'
            return userRole !== 'viewer' || viewerAllowedHrefs.has(href)
          })
          if (items.length === 0) return null
          return (
            <div key={section.label}>
              {!collapsed && (
                <div className="text-[10px] tracking-[0.12em] uppercase opacity-45 px-2.5 pt-3.5 pb-1.5">
                  {section.label}
                </div>
              )}
              {items.map(({ href, label, icon: Icon }) => {
                const isActive = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`av-rail-link flex items-center gap-3 px-2.5 py-[7px] rounded-lg transition-colors text-[12.5px] font-medium ${
                      isActive ? 'active' : ''
                    }`}
                  >
                    <Icon size={15} className="av-rail-ico shrink-0 opacity-80" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t av-rail-bd px-3 py-3 space-y-3">
        {!collapsed && <ThemeToggle />}
        {!collapsed && (
          <div className="px-1.5 leading-tight">
            <div className="text-[11px] font-semibold" style={{ color: 'var(--rail-ink)' }}>
              Fly2Sky JSC
            </div>
            <div className="text-[9.5px] opacity-55">ACMI &amp; wet-lease pricing</div>
          </div>
        )}
      </div>
    </aside>
  )
}
