'use client'

import { useState, useRef, useEffect, useActionState } from 'react'
import { UserPlus, X } from 'lucide-react'
import {
  createUserAction,
  type CreateUserState,
} from '@/app/actions/admin'

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'admin', label: 'Admin' },
]

export function CreateUserDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(createUserAction, {} as CreateUserState)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      setTimeout(() => {
        setIsOpen(false)
        dialogRef.current?.close()
      }, 1500)
    }
  }, [state.success])

  const openDialog = () => {
    setIsOpen(true)
    dialogRef.current?.showModal()
  }

  const closeDialog = () => {
    setIsOpen(false)
    dialogRef.current?.close()
  }

  return (
    <>
      <button onClick={openDialog} className="av-btn av-btn-primary">
        <UserPlus size={15} />
        Invite User
      </button>

      <dialog
        ref={dialogRef}
        className="av-panel p-0 w-full max-w-sm backdrop:bg-black/60"
        onClose={() => setIsOpen(false)}
      >
        {isOpen && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                Invite User
              </h2>
              <button
                onClick={closeDialog}
                aria-label="Close"
                className="p-1 rounded-md transition-colors"
                style={{ color: 'var(--muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Success banner */}
            {state.success && (
              <div
                className="mb-4 px-3 py-2 rounded text-sm"
                style={{
                  color: 'var(--pos)',
                  background: 'var(--pos-soft)',
                  border: '1px solid color-mix(in srgb, var(--pos) 30%, transparent)',
                }}
              >
                User invited successfully
              </div>
            )}

            {/* Error banner */}
            {state.error && (
              <div
                className="mb-4 px-3 py-2 rounded text-sm"
                style={{
                  color: 'var(--neg)',
                  background: 'var(--neg-soft)',
                  border: '1px solid color-mix(in srgb, var(--neg) 30%, transparent)',
                }}
              >
                {state.error}
              </div>
            )}

            <form ref={formRef} action={formAction} className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--ink-2)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  placeholder="John Doe"
                  className="av-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--ink-2)' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="colleague@company.com"
                  className="av-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--ink-2)' }}>
                  Role
                </label>
                <select
                  name="role"
                  defaultValue="user"
                  className="av-input w-full"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-2)' }}>
                  Viewer: read-only access to Dashboard and Quotes only
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ink-2)' }}>
                  <input
                    type="checkbox"
                    name="can_view_costs"
                    className="av-checkbox"
                  />
                  Can view naked costs
                </label>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-2)' }}>
                  Grants visibility of cost build-up, profit, and margins. Admins always have access.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="av-btn av-btn-primary disabled:opacity-60"
                >
                  {isPending ? 'Inviting...' : 'Invite'}
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isPending}
                  className="av-btn av-btn-ghost disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </dialog>
    </>
  )
}
