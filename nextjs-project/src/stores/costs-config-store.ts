import { create } from 'zustand'

// ---- Types ----

export interface MaintPersonnel {
  name: string
  engineers: number
  perDiem: number
  days: number
}

export interface MaintCostItem {
  name: string
  perMonthPerAc: number
  mapping: string
}

export interface InsuranceItem {
  msn: number
  priceUsd: number
}

export interface DocItem {
  name: string
  total: number
  mapping: string
}

export interface OtherCogsItem {
  name: string
  perMonth: number
  mapping: string
  hasTotal?: boolean
  total?: number
}

export interface OverheadItem {
  name: string
  total: number
  mapping: string
}

// ---- Initial data from Excel ----

const INITIAL_MAINT_PERSONNEL: MaintPersonnel[] = [
  { name: 'B2 - Avionics', engineers: 2, perDiem: 150, days: 31 },
  { name: 'B1 - Mechanic', engineers: 1, perDiem: 130, days: 31 },
  { name: 'General', engineers: 1, perDiem: 75, days: 31 },
]

const INITIAL_MAINT_COSTS: MaintCostItem[] = [
  { name: 'Line Maintenance - Internal', perMonthPerAc: 22000, mapping: 'Line Maintenance' },
  { name: 'Line Maintenance - 3rd Party', perMonthPerAc: 10000, mapping: 'Line Maintenance' },
  { name: 'Aircraft Maintenance - Internal (AD-HOC)', perMonthPerAc: 0, mapping: 'Line Maintenance' },
  { name: 'C-Check', perMonthPerAc: 13636.4, mapping: 'Maintenance C-Check' },
  { name: 'Maintenance Personnel Salary', perMonthPerAc: 10038.36, mapping: 'Maintenance personnel - salary' },
  { name: 'Tires/Wheels', perMonthPerAc: 0, mapping: '' },
  { name: 'Spare Parts KPI (Per BH)', perMonthPerAc: 231, mapping: '' },
  { name: 'Capital Maintenance', perMonthPerAc: 10000, mapping: 'Base Maintenance' },
  { name: 'Accomodation & Travel M', perMonthPerAc: 3000, mapping: 'Accomodation & Travel M' },
  { name: 'Trainning', perMonthPerAc: 37.5, mapping: 'Trainning' },
]

const INITIAL_INSURANCE: InsuranceItem[] = [
  { msn: 3378, priceUsd: 13111 },
  { msn: 4247, priceUsd: 19128 },
  { msn: 3055, priceUsd: 13019 },
  { msn: 3461, priceUsd: 14269 },
  { msn: 3605, priceUsd: 16583 },
  { msn: 5228, priceUsd: 23138 },
  { msn: 5931, priceUsd: 16500 },
  { msn: 1932, priceUsd: 16197 },
  { msn: 1960, priceUsd: 16197 },
  { msn: 3570, priceUsd: 14654 },
  { msn: 1503, priceUsd: 18704 },
]

const INITIAL_DOC: DocItem[] = [
  { name: 'Fuel', total: 154666.70, mapping: 'Fuel' },
  { name: 'Handling', total: 119675.72, mapping: 'Handling' },
  { name: 'Navigation', total: 23204.46, mapping: 'Navigation' },
  { name: 'Airport Charges', total: 52516.09, mapping: 'Airport Charges' },
]

const INITIAL_OTHER_COGS: OtherCogsItem[] = [
  { name: 'Commission - Third Party Summer', perMonth: 0, mapping: 'Commissions' },
  { name: 'Commission - Third Party Winter', perMonth: 0, mapping: 'Commissions' },
  { name: 'Commission - MXC', perMonth: 42, mapping: 'Commissions' },
  { name: 'Other Fixed', perMonth: 0, mapping: 'Other Fixed', hasTotal: true, total: 87864.36 },
  { name: 'Technical', perMonth: 0, mapping: 'Technical', hasTotal: true, total: 970898 },
]

const INITIAL_OVERHEAD: OverheadItem[] = [
  { name: 'Personnel Cost - SS', total: 975146.71, mapping: 'Corporate Support Services - SS' },
  { name: 'Personnel Cost', total: 2558288.11, mapping: 'AM, FLT OPS, GROUND OPS, AVSEC, COMPLIANCE, CD, SAFETY, TRAINNING' },
  { name: 'Travel Expenses', total: 206415, mapping: 'Travel Expenses' },
  { name: 'Legal Expenses', total: 42600, mapping: 'Legal Expenses' },
  { name: 'License & Registration Cost', total: 0, mapping: 'License & Registration Cost' },
  { name: 'Admin Cost', total: 764579.49, mapping: 'Admin Cost' },
  { name: 'IT and Communications', total: 391737.45, mapping: 'Other O' },
  { name: 'Admin and General Expenses', total: 234710, mapping: 'Admin and General Expenses' },
  { name: 'Selling & Marketing Cost', total: 118298.94, mapping: 'Selling & Marketing Cost' },
]

// ---- Store ----

interface CostsConfigStore {
  maintPersonnel: MaintPersonnel[]
  maintCosts: MaintCostItem[]
  insurance: InsuranceItem[]
  doc: DocItem[]
  otherCogs: OtherCogsItem[]
  overhead: OverheadItem[]
  avgAc: number

  updateMaintPersonnel: (idx: number, field: keyof MaintPersonnel, value: number) => void
  updateMaintCost: (idx: number, value: number) => void
  updateInsurance: (idx: number, value: number) => void
  updateDoc: (idx: number, value: number) => void
  updateOtherCogs: (idx: number, field: 'perMonth' | 'total', value: number) => void
  updateOverhead: (idx: number, value: number) => void
  setAvgAc: (v: number) => void
  /** Restore all cost tables and the average-AC scalar to their seed defaults. */
  resetToDefaults: () => void
  loadFromSnapshot: (snapshot: {
    maintPersonnel: MaintPersonnel[]
    maintCosts: MaintCostItem[]
    insurance: InsuranceItem[]
    doc: DocItem[]
    otherCogs: OtherCogsItem[]
    overhead: OverheadItem[]
    avgAc: number
  }) => void
}

export const useCostsConfigStore = create<CostsConfigStore>()((set) => ({
  maintPersonnel: INITIAL_MAINT_PERSONNEL,
  maintCosts: INITIAL_MAINT_COSTS,
  insurance: INITIAL_INSURANCE,
  doc: INITIAL_DOC,
  otherCogs: INITIAL_OTHER_COGS,
  overhead: INITIAL_OVERHEAD,
  avgAc: 10.166667,

  updateMaintPersonnel: (idx, field, value) =>
    set((s) => ({
      maintPersonnel: s.maintPersonnel.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    })),

  updateMaintCost: (idx, value) =>
    set((s) => ({
      maintCosts: s.maintCosts.map((r, i) => (i === idx ? { ...r, perMonthPerAc: value } : r)),
    })),

  updateInsurance: (idx, value) =>
    set((s) => ({
      insurance: s.insurance.map((r, i) => (i === idx ? { ...r, priceUsd: value } : r)),
    })),

  updateDoc: (idx, value) =>
    set((s) => ({
      doc: s.doc.map((r, i) => (i === idx ? { ...r, total: value } : r)),
    })),

  updateOtherCogs: (idx, field, value) =>
    set((s) => ({
      otherCogs: s.otherCogs.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    })),

  updateOverhead: (idx, value) =>
    set((s) => ({
      overhead: s.overhead.map((r, i) => (i === idx ? { ...r, total: value } : r)),
    })),

  setAvgAc: (v) => set({ avgAc: v }),

  resetToDefaults: () =>
    set({
      maintPersonnel: INITIAL_MAINT_PERSONNEL,
      maintCosts: INITIAL_MAINT_COSTS,
      insurance: INITIAL_INSURANCE,
      doc: INITIAL_DOC,
      otherCogs: INITIAL_OTHER_COGS,
      overhead: INITIAL_OVERHEAD,
      avgAc: 10.166667,
    }),

  loadFromSnapshot: (snapshot) => set({ ...snapshot }),
}))
