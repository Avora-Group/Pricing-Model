'use client'

import { usePricingStore } from '@/stores/pricing-store'

export function MsnSwitcher() {
  const msnInputs = usePricingStore((s) => s.msnInputs)
  const selectedMsn = usePricingStore((s) => s.selectedMsn)
  const setSelectedMsn = usePricingStore((s) => s.setSelectedMsn)

  if (msnInputs.length === 0) return null

  return (
    <div className="av-ac-tabs">
      <button
        onClick={() => setSelectedMsn(null)}
        className={`av-ac-tab ${selectedMsn === null ? 'active' : ''}`}
      >
        Total Project
      </button>
      {msnInputs.map((input) => (
        <button
          key={input.msn}
          onClick={() => setSelectedMsn(input.msn)}
          className={`av-ac-tab ${selectedMsn === input.msn ? 'active' : ''}${input.isDraft ? ' draft' : ''}`}
        >
          <span>MSN <span className="av-num">{input.msn}</span></span>
          {input.registration && <span className="ty">{input.registration}</span>}
          {input.isDraft && <span className="draft-badge">Draft</span>}
        </button>
      ))}
    </div>
  )
}
