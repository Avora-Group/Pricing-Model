'use client'

import { usePricingStore } from '@/stores/pricing-store'
import { MsnSwitcher } from './MsnSwitcher'
import { PnlTable } from './PnlTable'

export function PnlView() {
  const msnInputs = usePricingStore((s) => s.msnInputs)
  const lastError = usePricingStore((s) => s.lastError)

  if (msnInputs.length === 0) {
    return (
      <div className="av-panel p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Configure MSNs on the Calculation page to see P&amp;L calculations
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {lastError && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--neg-soft)', border: '1px solid var(--neg)', color: 'var(--neg)' }}
        >
          {lastError}
        </div>
      )}
      <MsnSwitcher />
      <PnlTable />
    </div>
  )
}
