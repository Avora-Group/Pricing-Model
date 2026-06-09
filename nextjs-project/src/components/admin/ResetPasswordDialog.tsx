'use client'

import { useState, useRef, useEffect, useActionState } from 'react'
import { KeyRound, X } from 'lucide-react'
import {
  resetPasswordAction,
  type ResetPasswordState,
} from '@/app/actions/admin'

interface ResetPasswordDialogProps {
  userId: number
  userName: string
}

export function ResetPasswordDialog({ userId, userName }: ResetPasswordDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const boundAction = resetPasswordAction.bind(null, userId)
  const [state, formAction, isPending] = useActionState(boundAction, {} as ResetPasswordState)

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
        className="p-1.5 text-[var(--text-tertiary)] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        title="Reset password"
      >
        <KeyRound size={15} />
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
                Reset Password
              </h2>
              <button
                onClick={closeDialog}
                className="p-1 text-[var(--text-tertiary)] hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Set a new password for <span className="font-medium text-[var(--text-primary)]">{userName}</span>
            </p>

            {/* Success banner */}
            {state.success && (
              <div className="mb-4 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
                Password reset successfully
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
                  New Password
                </label>
                <input
                  type="password"
                  name="new_password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  required
                  minLength={8}
                  placeholder="Repeat password"
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-[var(--border-secondary)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-gray-400 text-white font-medium rounded-md transition-colors"
                >
                  {isPending ? 'Resetting...' : 'Reset Password'}
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
