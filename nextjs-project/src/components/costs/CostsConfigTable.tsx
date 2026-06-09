'use client'

import { useMemo } from 'react'
import {
  useCostsConfigStore,
  type MaintPersonnel,
} from '@/stores/costs-config-store'
import { EditableCell } from '@/components/ui/EditableCell'
import { SectionHeader } from '@/components/ui/TableParts'
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
    <div className="space-y-6">
      {/* Average AC - global input */}
      <div className="bg-white dark:bg-gray-900 border border-[var(--border-primary)] rounded-lg px-4 py-3 flex items-center gap-4">
        <label className="text-sm text-[var(--text-tertiary)] whitespace-nowrap">Average A/C:</label>
        <EditableCell value={avgAc} onChange={(v) => setAvgAc(v ?? 0)} decimals={2} allowNull={false} className="w-28" />
      </div>

      {/* 1. Maintenance Personnel Cost */}
      <SectionHeader title="Maintenance Personnel Cost" />
      <MaintPersonnelSection
        data={maintPersonnel}
        totals={maintPersonnelTotals}
        grandTotal={maintPersonnelGrandTotal}
        onUpdate={updateMaintPersonnel}
      />

      {/* 2. Maintenance Cost Assumptions */}
      <SectionHeader title="Maintenance Cost Assumptions" />
      <MaintCostsSection data={maintCosts} onUpdate={updateMaintCost} />

      {/* 3. Insurance */}
      <SectionHeader title="Insurance" />
      <InsuranceSection data={insurance} total={insuranceTotal} onUpdate={updateInsurance} />

      {/* 4. DOC */}
      <SectionHeader title="DOC (Direct Operating Cost)" />
      <DocSection data={doc} perMonth={docPerMonth} onUpdate={updateDoc} />

      {/* 5. Other COGS */}
      <SectionHeader title="Other COGS" />
      <OtherCogsSection data={otherCogsComputed} onUpdate={updateOtherCogs} />

      {/* 6. Overhead */}
      <SectionHeader title="Overhead" />
      <OverheadSection
        data={overhead}
        perMonth={overheadPerMonth}
        totalPerMonth={overheadTotalPerMonth}
        onUpdate={updateOverhead}
      />
    </div>
  )
}
