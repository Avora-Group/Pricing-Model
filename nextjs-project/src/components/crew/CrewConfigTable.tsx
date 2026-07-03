'use client'

import { useCallback, useMemo } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import { useCrewConfigStore, type PayrollRow } from '@/stores/crew-config-store'
import { PayrollSection } from './sections/PayrollSection'
import { OtherCostTrainingSection } from './sections/OtherCostTrainingSection'
import { PerDiemSummarySection } from './sections/PerDiemSummarySection'

// ──────────────────────────────────────────────────────
// Main component (thin orchestrator)
// ──────────────────────────────────────────────────────

export function CrewConfigTable() {
  // ── State from Zustand store (all yellow editable cells) ──
  const payroll = useCrewConfigStore(s => s.payroll)
  const otherCost = useCrewConfigStore(s => s.otherCost)
  const training = useCrewConfigStore(s => s.training)
  const averageAC = useCrewConfigStore(s => s.averageAC)
  const fdDays = useCrewConfigStore(s => s.fdDays)
  const nfdDays = useCrewConfigStore(s => s.nfdDays)

  // ── Store actions ──
  const storeUpdatePayroll = useCrewConfigStore(s => s.updatePayroll)
  const storeUpdateOtherCost = useCrewConfigStore(s => s.updateOtherCost)
  const storeUpdateTraining = useCrewConfigStore(s => s.updateTraining)
  const setAverageAC = useCrewConfigStore(s => s.setAverageAC)
  const setFdDays = useCrewConfigStore(s => s.setFdDays)
  const setNfdDays = useCrewConfigStore(s => s.setNfdDays)

  // ── MGH from dashboard (green cells: Per BH Perdiem x MGH) ──
  const msnInputs = usePricingStore((s) => s.msnInputs)
  const mgh = useMemo(() => {
    if (msnInputs.length > 0 && msnInputs[0].mgh) {
      const val = parseFloat(msnInputs[0].mgh)
      if (!isNaN(val) && val > 0) return val
    }
    return 240
  }, [msnInputs])

  // ── Payroll update helper ──
  const updatePayroll = useCallback((idx: number, field: keyof PayrollRow, value: number | null) => {
    storeUpdatePayroll(idx, field, value ?? 0)
  }, [storeUpdatePayroll])

  // ── Computed: Social Security = Gross Salary + Benefits (formula: E = C + D) ──
  const socialSecurity = useMemo(() =>
    payroll.map(r => r.grossSalary + r.benefits),
    [payroll]
  )

  // ── Computed: Other Cost Per Month = Amount / Average_AC / 12 ──
  const otherCostPerMonth = useMemo(() =>
    otherCost.map(r => {
      if (r.amount === null || r.amount === 0 || averageAC === 0) return null
      return r.amount / averageAC / 12
    }),
    [otherCost, averageAC]
  )

  // ── Computed: Training Per Month = Amount / Average_AC / 12 ──
  const trainingPerMonth = useMemo(() =>
    training.map(r => {
      if (r.amount === null || r.amount === 0 || averageAC === 0) return null
      return r.amount / averageAC / 12
    }),
    [training, averageAC]
  )

  // ── Per Diem formulas (from Excel) ──
  const perDiem = useMemo(() => {
    const p = payroll
    const pilotFD = (p[0].perDiemFD + p[1].perDiemFD) * fdDays
    const pilotNFD = (p[0].perDiemNFD + p[1].perDiemNFD) * nfdDays

    const bhBonusFD = p[0].perBhPerdiem * mgh
    const bhBonusNFD = p[1].perBhPerdiem * mgh

    const a321FD = (p[2].perDiemFD + p[3].perDiemFD + p[4].perDiemFD + p[5].perDiemFD + p[6].perDiemFD) * fdDays
    const a321NFD = (p[2].perDiemNFD + p[3].perDiemNFD + p[4].perDiemNFD + p[5].perDiemNFD + p[6].perDiemNFD) * nfdDays

    const a320FD = (p[3].perDiemFD + p[4].perDiemFD + p[5].perDiemFD + p[6].perDiemFD) * fdDays
    const a320NFD = (p[3].perDiemNFD + p[4].perDiemNFD + p[5].perDiemNFD + p[6].perDiemNFD) * nfdDays

    const moistFD = fdDays * p[6].perDiemFD
    const moistNFD = nfdDays * p[6].perDiemNFD

    return {
      pilotFD, pilotNFD,
      bhBonusFD, bhBonusNFD,
      a321FD, a321NFD,
      a320FD, a320NFD,
      moistFD, moistNFD,
      pilotTotal: pilotFD + pilotNFD,
      bhBonusTotal: bhBonusFD + bhBonusNFD,
      a321Total: a321FD + a321NFD,
      a320Total: a320FD + a320NFD,
      moistTotal: moistFD + moistNFD,
    }
  }, [payroll, fdDays, nfdDays, mgh])

  // ──────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────

  return (
    <div className="space-y-[18px]">
      {/* Legend bar */}
      <div
        className="flex flex-wrap items-center gap-5 px-4 py-2.5 rounded-xl text-[12px]"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--muted)' }}
      >
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: 'var(--cyan-soft)', border: '1px solid var(--cyan)' }} />
          Editable
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: 'var(--pos-soft)', border: '1px solid var(--pos)' }} />
          BH rate &times; MGH ({mgh}h {msnInputs.length > 0 ? 'from Dashboard' : '— add MSN in Dashboard'})
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: 'var(--line-2)', border: '1px solid var(--line)' }} />
          Calculated
        </span>
      </div>

      {/* TABLE 1: Payroll */}
      <PayrollSection
        payroll={payroll}
        socialSecurity={socialSecurity}
        averageAC={averageAC}
        onUpdatePayroll={updatePayroll}
        onSetAverageAC={setAverageAC}
      />

      {/* TABLES 2 & 3: Other Cost + Training side by side */}
      <OtherCostTrainingSection
        otherCost={otherCost}
        training={training}
        otherCostPerMonth={otherCostPerMonth}
        trainingPerMonth={trainingPerMonth}
        onUpdateOtherCost={storeUpdateOtherCost}
        onUpdateTraining={storeUpdateTraining}
      />

      {/* TABLE 4: Per Diem Summary */}
      <PerDiemSummarySection
        fdDays={fdDays}
        nfdDays={nfdDays}
        perDiem={perDiem}
        onSetFdDays={setFdDays}
        onSetNfdDays={setNfdDays}
      />
    </div>
  )
}
