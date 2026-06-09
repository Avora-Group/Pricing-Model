'use client'

import { useTransition } from 'react'
import type { User } from '@/app/actions/admin'
import { updateRoleAction } from '@/app/actions/admin'
import { ResetPasswordDialog } from './ResetPasswordDialog'

const ROLES = ['admin', 'user', 'viewer'] as const

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  viewer: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  user: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

interface UserTableProps {
  users: User[]
}

function RoleSelect({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition()

  const handleChange = (newRole: string) => {
    startTransition(async () => {
      await updateRoleAction(user.id, newRole)
    })
  }

  return (
    <select
      value={user.role}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className={`px-2 py-0.5 rounded text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
        isPending ? 'opacity-50' : ''
      } ${roleBadgeClass[user.role] ?? roleBadgeClass.user}`}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  )
}

export function UserTable({ users }: UserTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
            <th className="py-3 px-4 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              Name
            </th>
            <th className="py-3 px-4 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              Email
            </th>
            <th className="py-3 px-4 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider hidden sm:table-cell">
              Role
            </th>
            <th className="py-3 px-4 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider hidden sm:table-cell">
              Status
            </th>
            <th className="py-3 px-4 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {users.map((user) => (
            <tr
              key={user.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td className="py-3 px-4 text-[var(--text-primary)] font-medium">
                {user.full_name || '—'}
              </td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                {user.email}
              </td>
              <td className="py-3 px-4 hidden sm:table-cell">
                <RoleSelect user={user} />
              </td>
              <td className="py-3 px-4 hidden sm:table-cell">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    user.is_active
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}
                >
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <ResetPasswordDialog
                  userId={user.id}
                  userName={user.full_name || user.email}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
          No users found
        </div>
      )}
    </div>
  )
}
