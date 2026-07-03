'use client'

import { createContext, useContext } from 'react'

/**
 * Naked-cost visibility context.
 *
 * Holds whether the current user may see naked cost / profit / margin figures
 * (admins and users with `can_view_costs`). This is a *cosmetic* gate only —
 * the server is the security boundary and omits the sensitive fields for
 * unpermitted users. Components use `useCanViewCosts()` to hide cost UI so the
 * page doesn't render em-dash / NaN storms for already-omitted data.
 */
const CostVisibilityContext = createContext<boolean>(false)

export function CostVisibilityProvider({
  value,
  children,
}: {
  value: boolean
  children: React.ReactNode
}) {
  return (
    <CostVisibilityContext.Provider value={value}>
      {children}
    </CostVisibilityContext.Provider>
  )
}

/** Returns true when the current user may see naked cost / profit / margin. */
export function useCanViewCosts(): boolean {
  return useContext(CostVisibilityContext)
}
