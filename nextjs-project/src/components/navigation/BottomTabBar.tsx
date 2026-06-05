'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  Settings,
  MoreHorizontal,
  Plane,
  Users,
  DollarSign,
  BarChart3,
  Calculator,
  X,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const primaryTabs = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calculation', label: 'Calculation', icon: Calculator },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/admin', label: 'Admin', icon: Settings },
]

const moreItems = [
  { href: '/pnl', label: 'P&L', icon: TrendingUp },
  { href: '/aircraft', label: 'Aircraft', icon: Plane },
  { href: '/crew', label: 'Crew', icon: Users },
  { href: '/costs', label: 'Costs', icon: DollarSign },
  { href: '/sensitivity', label: 'Sensitivity', icon: BarChart3 },
]

const viewerAllowedHrefs = new Set(['/dashboard', '/calculation', '/quotes'])

interface BottomTabBarProps {
  userRole: string
}

export function BottomTabBar({ userRole }: BottomTabBarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isViewer = userRole === 'viewer'

  const visibleTabs = isViewer
    ? primaryTabs.filter((t) => viewerAllowedHrefs.has(t.href))
    : primaryTabs

  const visibleMoreItems = isViewer
    ? moreItems.filter((t) => viewerAllowedHrefs.has(t.href))
    : moreItems

  const showMore = !isViewer // viewers have no "more" items

  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href))

  return (
    <>
      {/* Backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <div className="fixed bottom-14 left-0 right-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="mx-2 mb-1 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                More
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {visibleMoreItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-gray-800'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Theme
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-14">
          {visibleTabs.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] mt-0.5 font-medium">{label}</span>
              </Link>
            )
          })}
          {showMore && (
            <button
              onClick={() => setMoreOpen((prev) => !prev)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isMoreActive || moreOpen
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <MoreHorizontal size={20} />
              <span className="text-[10px] mt-0.5 font-medium">More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
