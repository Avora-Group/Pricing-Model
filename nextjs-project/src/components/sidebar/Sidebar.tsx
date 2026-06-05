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

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calculation', label: 'Calculation', icon: Calculator },
  { href: '/pnl', label: 'P&L', icon: TrendingUp },
  { href: '/aircraft', label: 'Aircraft', icon: Plane },
  { href: '/crew', label: 'Crew', icon: Users },
  { href: '/costs', label: 'Costs', icon: DollarSign },
  { href: '/sensitivity', label: 'Sensitivity', icon: BarChart3 },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/admin', label: 'Admin', icon: Settings },
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

  // Before hydration, render expanded state to match server
  const collapsed = mounted ? isCollapsed : false

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } transition-all duration-300 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen hidden md:flex flex-col shrink-0`}
    >
      {/* Header with toggle */}
      <div className="flex items-center h-14 px-4 border-b border-gray-200 dark:border-gray-800">
        {!collapsed && (
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1">
            ACMI Pricing
          </span>
        )}
        <button
          onClick={toggle}
          className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            size={18}
            className={`transition-transform duration-300 ${
              collapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems
          .filter(({ href }) => userRole !== 'viewer' || viewerAllowedHrefs.has(href))
          .map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-gray-800'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Theme toggle footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-3">
        {!collapsed && <ThemeToggle />}
      </div>
    </aside>
  )
}
