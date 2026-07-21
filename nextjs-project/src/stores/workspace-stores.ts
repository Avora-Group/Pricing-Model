import { usePricingStore } from './pricing-store'
import { useCrewConfigStore } from './crew-config-store'
import { useCostsConfigStore } from './costs-config-store'

/**
 * Point-in-time copy of the three workspace stores (pricing + crew/costs
 * config). Zustand's setState produces a new state object on every write, so
 * holding the old getState() reference is a stable snapshot. Action function
 * references are stable across writes, which makes restoring via setState a
 * pure data rollback.
 */
export interface WorkspaceSnapshot {
  pricing: ReturnType<typeof usePricingStore.getState>
  crew: ReturnType<typeof useCrewConfigStore.getState>
  costs: ReturnType<typeof useCostsConfigStore.getState>
}

export function snapshotWorkspaceStores(): WorkspaceSnapshot {
  return {
    pricing: usePricingStore.getState(),
    crew: useCrewConfigStore.getState(),
    costs: useCostsConfigStore.getState(),
  }
}

export function restoreWorkspaceStores(snap: WorkspaceSnapshot): void {
  usePricingStore.setState(snap.pricing)
  useCrewConfigStore.setState(snap.crew)
  useCostsConfigStore.setState(snap.costs)
}

/** Blank slate: pricing cleared, crew/costs config back to company defaults. */
export function resetWorkspaceStores(): void {
  usePricingStore.getState().reset()
  useCrewConfigStore.getState().resetToDefaults()
  useCostsConfigStore.getState().resetToDefaults()
}
