'use client'

import { applyCompanyDefaults } from '@/lib/company-defaults'
import type { SavedAssumptions } from '@/app/actions/assumptions'

/** Timestamps of the defaults last installed (they are app-wide, like the stores). */
let appliedKey: string | null = null

/**
 * Installs the saved Crew / Costs defaults into the config stores. Runs during
 * render (before any child mounts or hydrates a quote) so pages render the
 * saved values from the first paint and server and client markup agree.
 * Re-applies only when a save changes the timestamps.
 */
export function CompanyDefaultsLoader({ saved }: { saved: SavedAssumptions }) {
  const key = `${saved.crew?.updated_at ?? ''}|${saved.costs?.updated_at ?? ''}`
  if (appliedKey !== key) {
    applyCompanyDefaults(saved)
    appliedKey = key
  }
  return null
}
