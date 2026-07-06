'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Signals that editable config cells (see {@link EditableCell}) should render
 * as static, non-editable values. Used to make the Crew and Costs config tables
 * read-only for non-admin users, matching the Aircraft page — the underlying
 * save endpoints are admin-only, so non-admins could never persist edits anyway.
 */
const ReadOnlyContext = createContext(false)

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext)
}

export function ReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean
  children: ReactNode
}) {
  return <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>
}
