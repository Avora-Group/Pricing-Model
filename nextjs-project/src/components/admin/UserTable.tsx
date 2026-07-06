'use client'

import { useTransition } from 'react'
import type { User } from '@/app/actions/admin'
import { updateRoleAction, updateCostAccessAction } from '@/app/actions/admin'
import { ResetPasswordDialog } from './ResetPasswordDialog'

const ROLES = ['admin', 'user', 'viewer'] as const

// Permanent admins — kept in sync with the backend `protected_admin_emails`
// setting. Their role cannot be changed (also enforced server-side).
const PROTECTED_ADMIN_EMAILS = ['abukhair.alpyspayev@avora.aero']

function isProtectedAdmin(email: string): boolean {
  return PROTECTED_ADMIN_EMAILS.includes(email.toLowerCase())
}

const rolePillClass: Record<string, string> = {
  admin: 'av-pill av-pill-signed',
  viewer: 'av-pill av-pill-draft',
  user: 'av-pill av-pill-sent',
}

interface UserTableProps {
  users: User[]
}

function RoleSelect({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition()

  // Permanent admins cannot be demoted — show a fixed pill, no dropdown.
  if (isProtectedAdmin(user.email)) {
    return (
      <span
        className={`${rolePillClass.admin} capitalize`}
        title="Permanent admin — role cannot be changed"
      >
        admin
      </span>
    )
  }

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
      className={`cursor-pointer border-0 capitalize focus:outline-none ${
        isPending ? 'opacity-50' : ''
      } ${rolePillClass[user.role] ?? rolePillClass.user}`}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  )
}

function CostAccessToggle({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition()
  // Admins implicitly always have access — the toggle is fixed on & disabled.
  const isAdmin = user.role === 'admin'
  const enabled = isAdmin || user.can_view_costs

  const handleToggle = () => {
    if (isAdmin) return
    startTransition(async () => {
      await updateCostAccessAction(user.id, !user.can_view_costs)
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isAdmin || isPending}
      aria-pressed={enabled}
      title={isAdmin ? 'Admins always have cost access' : 'Toggle naked-cost visibility'}
      className={`av-pill ${enabled ? 'av-pill-active' : 'av-pill-draft'} ${
        isAdmin ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
      } ${isPending ? 'opacity-50' : ''}`}
    >
      <span className="d" />
      {enabled ? 'Costs: On' : 'Costs: Off'}
    </button>
  )
}

export function UserTable({ users }: UserTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="av-tbl">
        <thead>
          <tr>
            <th className="av-th">Name</th>
            <th className="av-th">Email</th>
            <th className="av-th hidden sm:table-cell">Role</th>
            <th className="av-th hidden sm:table-cell">Status</th>
            <th className="av-th hidden sm:table-cell">Cost access</th>
            <th className="av-th r">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className="av-td font-semibold" style={{ color: 'var(--ink)' }}>
                {user.full_name || '—'}
              </td>
              <td className="av-td" style={{ color: 'var(--ink-2)' }}>
                {user.email}
              </td>
              <td className="av-td hidden sm:table-cell">
                <RoleSelect user={user} />
              </td>
              <td className="av-td hidden sm:table-cell">
                <span className={`av-pill ${user.is_active ? 'av-pill-active' : 'av-pill-rejected'}`}>
                  <span className="d" />
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="av-td hidden sm:table-cell">
                <CostAccessToggle user={user} />
              </td>
              <td className="av-td r">
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
        <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
          No users found
        </div>
      )}
    </div>
  )
}
