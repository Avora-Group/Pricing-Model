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
      <button
        onClick={openDialog}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition-colors"
      >
        <UserPlus size={15} />
        Invite User
      </button>

      <dialog
        ref={dialogRef}
        className="bg-white dark:bg-gray-900 border border-[var(--border-secondary)] rounded-xl p-0 w-full max-w-sm backdrop:bg-black/60"
        onClose={() => setIsOpen(false)}
      >
        {isOpen && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Invite User
              </h2>
              <button
                onClick={closeDialog}
                className="p-1 text-[var(--text-tertiary)] hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Success banner */}
            {state.success && (
              <div className="mb-4 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
                User invited successfully
              </div>
            )}

            {/* Error banner */}
            {state.error && (
              <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                {state.error}
              </div>
            )}

            <form ref={formRef} action={formAction} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  placeholder="John Doe"
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Role
                </label>
                <select
                  name="role"
                  defaultValue="user"
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Viewer: read-only access to Dashboard and Quotes only
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-gray-400 text-white font-medium rounded-md transition-colors"
                >
                  {isPending ? 'Inviting...' : 'Invite'}
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isPending}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)] rounded-md border border-[var(--border-secondary)] transition-colors"
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
