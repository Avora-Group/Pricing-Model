'use client'

import { createContext, useContext } from 'react'

/**
 * Cost / naked visibility context.
 *
 * Two independent gates:
 *  - `canViewCosts`  — base current-rate cost / margin / profit figures.
 *    Visible to admins and users; hidden from viewers.
 *  - `canViewNaked`  — the reduced "naked" cost basis, its toggle, and any
 *    naked-derived figures. Admins implicitly; other users only when granted
 *    `can_view_costs`. Strictly narrower than `canViewCosts`.
 *
 * These are *cosmetic* gates — the server is the security boundary and omits
 * the corresponding fields for unpermitted users. Components use the hooks to
 * hide UI so the page doesn't render em-dash / NaN storms for omitted data.
 */
interface CostVisibility {
  canViewCosts: boolean
  canViewNaked: boolean
}

const CostVisibilityContext = createContext<CostVisibility>({
  canViewCosts: false,
  canViewNaked: false,
})

export function CostVisibilityProvider({
  value,
  children,
}: {
  value: CostVisibility
  children: React.ReactNode
}) {
  return (
    <CostVisibilityContext.Provider value={value}>
      {children}
    </CostVisibilityContext.Provider>
  )
}

/** True when the user may see base current-rate cost / margin / profit. */
export function useCanViewCosts(): boolean {
  return useContext(CostVisibilityContext).canViewCosts
}

/** True when the user may see naked rates / the naked cost basis toggle. */
export function useCanViewNaked(): boolean {
  return useContext(CostVisibilityContext).canViewNaked
}
