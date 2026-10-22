import { create } from 'zustand'
import { deepEqual } from '@/lib/deep-equal'

// ---- Types ----

export interface PayrollRow {
  position: string
  grossSalary: number
  benefits: number
  perDiemFD: number
  perDiemNFD: number
  perBhPerdiem: number
}

export interface CostRow {
  item: string
  amount: number | null
}

export interface TrainingRow {
  item: string
  amount: number | null
}

// ---- Initial data from "Crew Cost.xlsx" ----

const INITIAL_PAYROLL: PayrollRow[] = [
  { position: 'Flight-pilot, Instructor', grossSalary: 6036.31, benefits: 178, perDiemFD: 310, perDiemNFD: 60, perBhPerdiem: 11 },
  { position: 'Co-pilot', grossSalary: 4480.45, benefits: 178, perDiemFD: 210, perDiemNFD: 60, perBhPerdiem: 5 },
  { position: 'Cabin Attendant / Steward(ess)', grossSalary: 1222.50, benefits: 178, perDiemFD: 100, perDiemNFD: 60, perBhPerdiem: 0 },
  { position: 'Cabin Attendant / Steward(ess)', grossSalary: 1222.50, benefits: 178, perDiemFD: 100, perDiemNFD: 60, perBhPerdiem: 0 },
  { position: 'Cabin Attendant / Steward(ess)', grossSalary: 1222.50, benefits: 178, perDiemFD: 100, perDiemNFD: 60, perBhPerdiem: 0 },
  { position: 'Cabin Attendant / Steward(ess)', grossSalary: 1222.50, benefits: 178, perDiemFD: 100, perDiemNFD: 60, perBhPerdiem: 0 },
  { position: 'Senior Cabin Attendant / Senior Steward(ess)', grossSalary: 1396.34, benefits: 178, perDiemFD: 115, perDiemNFD: 60, perBhPerdiem: 0 },
  { position: 'Senior Steward Instructor', grossSalary: 1572.73, benefits: 178, perDiemFD: 125, perDiemNFD: 60, perBhPerdiem: 0 },
]

const INITIAL_OTHER_COST: CostRow[] = [
  { item: 'Uniforms', amount: 110000 },
  { item: 'Travel costs', amount: 90000 },
  { item: 'Insurance validations', amount: null },
  { item: 'Crew Validation', amount: null },
  { item: 'Buffet (Overtime for emp.)', amount: 60000 },
  { item: 'Postholders', amount: null },
  { item: 'Accomodation', amount: 60000 },
]

const INITIAL_TRAINING: TrainingRow[] = [
  { item: 'Sim training permanent crew', amount: 264000 },
  { item: 'Sim training seasonal crew', amount: 0 },
  { item: 'Scandlearn permanent crew', amount: 60000 },
  { item: 'Scandlearn seasonal crew', amount: 0 },
  { item: 'CC training', amount: 120000 },
  { item: 'Upgrades in the company', amount: 30000 },
]

/** The Crew page tables — what quotes snapshot and the company defaults hold. */
export interface CrewConfigData {
  payroll: PayrollRow[]
  otherCost: CostRow[]
  training: TrainingRow[]
  averageAC: number
  fdDays: number
  nfdDays: number
}

const BUILT_IN_DEFAULTS: CrewConfigData = {
  payroll: INITIAL_PAYROLL,
  otherCost: INITIAL_OTHER_COST,
  training: INITIAL_TRAINING,
  averageAC: 10.17,
  fdDays: 18,
  nfdDays: 10,
}

/** Company defaults: the saved Crew page (see applyCompanyDefaults), else the
 *  built-in seed above. New quotes and resetToDefaults start from these. */
let companyDefaults: CrewConfigData = BUILT_IN_DEFAULTS

export function getCrewDefaults(): CrewConfigData {
  return companyDefaults
}

export function pickCrewConfig(s: CrewConfigData): CrewConfigData {
  const { payroll, otherCost, training, averageAC, fdDays, nfdDays } = s
  return { payroll, otherCost, training, averageAC, fdDays, nfdDays }
}

const sameConfig = (a: CrewConfigData, b: CrewConfigData) => deepEqual(pickCrewConfig(a), pickCrewConfig(b))

/** True when the store holds exactly the company defaults (no unsaved edits). */
export function isCrewAtDefaults(s: CrewConfigData): boolean {
  return sameConfig(s, companyDefaults)
}

// ---- Store ----

interface CrewConfigStore extends CrewConfigData {

  updatePayroll: (idx: number, field: keyof PayrollRow, value: number) => void
  updateOtherCost: (idx: number, value: number | null) => void
  updateTraining: (idx: number, value: number | null) => void
  setAverageAC: (v: number) => void
  setFdDays: (v: number) => void
  setNfdDays: (v: number) => void
  /** Restore payroll/costs/training and the scalar fields to the company defaults. */
  resetToDefaults: () => void
  /** Replace the company defaults; the store follows only if it held the old ones. */
  setCompanyDefaults: (defaults: CrewConfigData) => void
  loadFromSnapshot: (snapshot: {
    payroll: PayrollRow[]
    otherCost: CostRow[]
    training: TrainingRow[]
    averageAC: number
    fdDays: number
    nfdDays: number
  }) => void
}

export const useCrewConfigStore = create<CrewConfigStore>()((set, get) => ({
  ...BUILT_IN_DEFAULTS,

  updatePayroll: (idx, field, value) =>
    set((s) => ({
      payroll: s.payroll.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    })),

  updateOtherCost: (idx, value) =>
    set((s) => ({
      otherCost: s.otherCost.map((r, i) => (i === idx ? { ...r, amount: value } : r)),
    })),

  updateTraining: (idx, value) =>
    set((s) => ({
      training: s.training.map((r, i) => (i === idx ? { ...r, amount: value } : r)),
    })),

  setAverageAC: (v) => set({ averageAC: v }),
  setFdDays: (v) => set({ fdDays: v }),
  setNfdDays: (v) => set({ nfdDays: v }),

  resetToDefaults: () => set({ ...companyDefaults }),

  setCompanyDefaults: (defaults) => {
    if (sameConfig(defaults, companyDefaults)) {
      companyDefaults = defaults
      return
    }
    const wasAtDefaults = isCrewAtDefaults(get())
    companyDefaults = pickCrewConfig(defaults)
    if (wasAtDefaults) set({ ...companyDefaults })
  },

  loadFromSnapshot: (snapshot) => set({ ...snapshot }),
}))
