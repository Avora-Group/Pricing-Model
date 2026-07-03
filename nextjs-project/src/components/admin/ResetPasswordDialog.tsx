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
        className="av-btn av-btn-ghost !py-1.5 !px-2.5"
        title="Reset password"
        aria-label="Reset password"
      >
        <KeyRound size={15} />
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
                Reset Password
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

            <p className="text-sm mb-4" style={{ color: 'var(--ink-2)' }}>
              Set a new password for <span className="font-medium" style={{ color: 'var(--ink)' }}>{userName}</span>
            </p>

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
                Password reset successfully
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
                  New Password
                </label>
                <input
                  type="password"
                  name="new_password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  className="av-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--ink-2)' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  required
                  minLength={8}
                  placeholder="Repeat password"
                  className="av-input w-full"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="av-btn av-btn-primary disabled:opacity-60"
                >
                  {isPending ? 'Resetting...' : 'Reset Password'}
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
