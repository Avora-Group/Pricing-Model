'use client'

import { useMemo } from 'react'
import {
  useCostsConfigStore,
  type MaintPersonnel,
} from '@/stores/costs-config-store'
import { usePricingStore } from '@/stores/pricing-store'
import { EditableCell } from '@/components/ui/EditableCell'
import { MaintPersonnelSection } from './sections/MaintPersonnelSection'
import { MaintCostsSection } from './sections/MaintCostsSection'
import { InsuranceSection } from './sections/InsuranceSection'
import { DocSection } from './sections/DocSection'
import { OtherCogsSection } from './sections/OtherCogsSection'
import { OverheadSection } from './sections/OverheadSection'

// ---- Main Component (thin orchestrator) ----

export function CostsConfigTable() {
  // Zustand store state + actions
  const maintPersonnel = useCostsConfigStore((s) => s.maintPersonnel)
  const maintCosts = useCostsConfigStore((s) => s.maintCosts)
  const insurance = useCostsConfigStore((s) => s.insurance)
  const doc = useCostsConfigStore((s) => s.doc)
  const otherCogs = useCostsConfigStore((s) => s.otherCogs)
  const overhead = useCostsConfigStore((s) => s.overhead)
  const avgAc = useCostsConfigStore((s) => s.avgAc)

  const updateMaintPersonnel = useCostsConfigStore((s) => s.updateMaintPersonnel)
  const updateMaintCost = useCostsConfigStore((s) => s.updateMaintCost)
  const updateInsurance = useCostsConfigStore((s) => s.updateInsurance)
  const updateDoc = useCostsConfigStore((s) => s.updateDoc)
  const updateOtherCogs = useCostsConfigStore((s) => s.updateOtherCogs)
  const updateOverhead = useCostsConfigStore((s) => s.updateOverhead)
  const setAvgAc = useCostsConfigStore((s) => s.setAvgAc)

  // Global utilisation ratios live in the pricing store (shared with the
  // workspace) but are edited here alongside Average A/C.
  const bhFhRatio = usePricingStore((s) => s.bhFhRatio)
  const apuFhRatio = usePricingStore((s) => s.apuFhRatio)
  const setBhFhRatio = usePricingStore((s) => s.setBhFhRatio)
  const setApuFhRatio = usePricingStore((s) => s.setApuFhRatio)

  // ---- Computed values ----

  // Maintenance Personnel totals per row
  const maintPersonnelTotals = useMemo(
    () => maintPersonnel.map((p: MaintPersonnel) => p.engineers * p.perDiem * p.days),
    [maintPersonnel]
  )
  const maintPersonnelGrandTotal = useMemo(
    () => maintPersonnelTotals.reduce((s: number, v: number) => s + v, 0),
    [maintPersonnelTotals]
  )

  // Insurance total
  const insuranceTotal = useMemo(
    () => insurance.reduce((s, v) => s + v.priceUsd, 0),
    [insurance]
  )

  // DOC: Per month/Per AC = Total / avgAC / 12
  const docPerMonth = useMemo(
    () => doc.map((d) => (avgAc > 0 ? d.total / avgAc / 12 : 0)),
    [doc, avgAc]
  )

  // Other COGS: items with hasTotal compute perMonth from total
  const otherCogsComputed = useMemo(
    () =>
      otherCogs.map((item) => {
        if (item.hasTotal && item.total !== undefined) {
          if (item.name === 'Other Fixed') return { ...item, perMonth: item.total / 9 / 7 }
          if (item.name === 'Technical') return { ...item, perMonth: avgAc > 0 ? item.total / avgAc / 12 : 0 }
        }
        return item
      }),
    [otherCogs, avgAc]
  )

  // Overhead: Per Month = Total / avgAC / 12
  const overheadPerMonth = useMemo(
    () => overhead.map((o) => (avgAc > 0 ? o.total / avgAc / 12 : 0)),
    [overhead, avgAc]
  )
  const overheadTotalPerMonth = useMemo(
    () => overheadPerMonth.reduce((s, v) => s + v, 0),
    [overheadPerMonth]
  )

  // ---- Render ----

  return (
    <div className="space-y-[18px]">
      {/* Average AC - global input */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <label className="text-[13px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>Average A/C:</label>
        <EditableCell value={avgAc} onChange={(v) => setAvgAc(v ?? 0)} decimals={2} allowNull={false} className="w-28" />

        <label className="text-[13px] whitespace-nowrap ml-4" style={{ color: 'var(--muted)' }}>BH : FH:</label>
        <EditableCell
          value={parseFloat(bhFhRatio || '1.2')}
          onChange={(v) => setBhFhRatio(String(v ?? 0))}
          decimals={2}
          allowNull={false}
          className="w-24"
        />

        <label className="text-[13px] whitespace-nowrap ml-4" style={{ color: 'var(--muted)' }}>APU FH : FH:</label>
        <EditableCell
          value={parseFloat(apuFhRatio || '0.7')}
          onChange={(v) => setApuFhRatio(String(v ?? 0))}
          decimals={2}
          allowNull={false}
          className="w-24"
        />
      </div>

      {/* 1. Maintenance Personnel Cost */}
      <MaintPersonnelSection
        data={maintPersonnel}
        totals={maintPersonnelTotals}
        grandTotal={maintPersonnelGrandTotal}
        onUpdate={updateMaintPersonnel}
      />

      {/* 2. Maintenance Cost Assumptions */}
      <MaintCostsSection data={maintCosts} onUpdate={updateMaintCost} />

      {/* 3. Insurance */}
      <InsuranceSection data={insurance} total={insuranceTotal} onUpdate={updateInsurance} />

      {/* 4. DOC */}
      <DocSection data={doc} perMonth={docPerMonth} onUpdate={updateDoc} />

      {/* 5. Other COGS */}
      <OtherCogsSection data={otherCogsComputed} onUpdate={updateOtherCogs} />

      {/* 6. Overhead */}
      <OverheadSection
        data={overhead}
        perMonth={overheadPerMonth}
        totalPerMonth={overheadTotalPerMonth}
        onUpdate={updateOverhead}
      />
    </div>
  )
}
