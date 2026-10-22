import { useCrewConfigStore, type CrewConfigData } from '@/stores/crew-config-store'
import { useCostsConfigStore, type CostsConfigData } from '@/stores/costs-config-store'
import { setDefaultRatios } from '@/stores/pricing-store'
import type { SavedAssumptions } from '@/app/actions/assumptions'

/** Costs page defaults as saved: the cost tables plus the BH:FH and APU FH:FH
 *  ratios edited on the same page (they live in the pricing store). */
export type CostsDefaultsData = CostsConfigData & { bhFhRatio?: string; apuFhRatio?: string }

/** Install saved Crew / Costs defaults. Stores holding the previous defaults
 *  follow; stores holding a quote's snapshot or unsaved edits are left alone. */
export function applyCompanyDefaults(saved: SavedAssumptions): void {
  if (saved.crew) {
    useCrewConfigStore.getState().setCompanyDefaults(saved.crew.data as unknown as CrewConfigData)
  }
  if (saved.costs) {
    const { bhFhRatio, apuFhRatio, ...costs } = saved.costs.data as unknown as CostsDefaultsData
    useCostsConfigStore.getState().setCompanyDefaults(costs)
    if (bhFhRatio && apuFhRatio) setDefaultRatios({ bhFhRatio, apuFhRatio })
  }
}
