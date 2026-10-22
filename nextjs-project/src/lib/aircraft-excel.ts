/**
 * Excel round-trip for the Aircraft tab: an "Aircraft" sheet with one row per
 * MSN (fleet switch, USD rates, escalations; naked columns for naked-access
 * users) and an "EPR" sheet with every EPR matrix row. Import diffs the file
 * against the current fleet and produces the bulk-import payload.
 */
import ExcelJS from 'exceljs'
import {
  styleHeader,
  markInput,
  markLocked,
  cellNumber,
  cellText,
  headerColumns,
  type ImportChange,
} from '@/lib/config-excel'
import type { AircraftImportItem } from '@/app/actions/aircraft'

interface EprRowApi {
  cycle_ratio: string | number
  benign_rate: string | number
  hot_rate: string | number
}

/** Aircraft as the list endpoint returns it. */
export interface AircraftRecord {
  msn: number
  aircraft_type: string
  registration: string | null
  is_active?: boolean
  has_naked_rates?: boolean
  epr_matrix?: EprRowApi[]
  naked_epr_matrix?: EprRowApi[]
  [field: string]: unknown
}

const RATE_FIELDS: { key: string; label: string }[] = [
  { key: 'lease_rent_usd', label: 'Lease rent, USD/mo' },
  { key: 'six_year_check_usd', label: '6Y check, USD/mo' },
  { key: 'twelve_year_check_usd', label: '12Y check, USD/mo' },
  { key: 'ldg_usd', label: 'Landing gear, USD/mo' },
  { key: 'apu_rate_usd', label: 'APU rate, USD/APU FH' },
  { key: 'llp1_rate_usd', label: 'LLP #1 rate, USD/FC' },
  { key: 'llp2_rate_usd', label: 'LLP #2 rate, USD/FC' },
  { key: 'epr_escalation', label: 'EPR escalation' },
  { key: 'llp_escalation', label: 'LLP escalation' },
  { key: 'af_apu_escalation', label: 'AF/APU escalation' },
]

const fieldsFor = (naked: boolean) =>
  naked
    ? [...RATE_FIELDS, ...RATE_FIELDS.map((f) => ({ key: `naked_${f.key}`, label: `Naked ${f.label}` }))]
    : RATE_FIELDS

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const same = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-9)

type Matrix = { cycle_ratio: number; benign_rate: number; hot_rate: number }[]

const toMatrix = (rows: EprRowApi[] | undefined): Matrix =>
  (rows ?? [])
    .map((r) => ({ cycle_ratio: Number(r.cycle_ratio), benign_rate: Number(r.benign_rate), hot_rate: Number(r.hot_rate) }))
    .sort((a, b) => a.cycle_ratio - b.cycle_ratio)

const sameMatrix = (a: Matrix, b: Matrix) =>
  a.length === b.length &&
  a.every((r, i) => same(r.cycle_ratio, b[i].cycle_ratio) && same(r.benign_rate, b[i].benign_rate) && same(r.hot_rate, b[i].hot_rate))

export function buildAircraftWorkbook(fleet: AircraftRecord[], canViewNaked: boolean): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  const fields = fieldsFor(canViewNaked)

  const info = wb.addWorksheet('Read me')
  info.columns = [{ width: 110 }]
  ;[
    'Aircraft cost parameters',
    `Exported ${new Date().toISOString().slice(0, 10)} from the ACMI pricing app.`,
    '',
    'Change the values in the blue cells, then import this file on the Aircraft tab.',
    '"In fleet" = Yes/No: No switches the aircraft off (hidden from pricing and the dashboard).',
    'EPR sheet: each MSN + basis block replaces that aircraft\'s whole EPR matrix; rows can be added or removed.',
    'Aircraft are matched by MSN and can\'t be added here — create new aircraft on the Aircraft tab first.',
    'Nothing is changed until you review the preview and confirm.',
  ].forEach((line, i) => {
    info.getCell(i + 1, 1).value = line
    if (i === 0) info.getCell(1, 1).font = { bold: true, size: 14 }
  })

  const ws = wb.addWorksheet('Aircraft')
  ws.columns = [{ width: 10 }, { width: 8 }, { width: 14 }, { width: 10 }, ...fields.map(() => ({ width: 20 }))]
  styleHeader(ws.addRow(['MSN', 'Type', 'Registration', 'In fleet', ...fields.map((f) => f.label)]))
  for (const a of fleet) {
    const r = ws.addRow([a.msn, a.aircraft_type, a.registration ?? '', a.is_active === false ? 'No' : 'Yes', ...fields.map((f) => num(a[f.key]))])
    ;[1, 2, 3].forEach((c) => markLocked(r.getCell(c)))
    markInput(r.getCell(4))
    fields.forEach((_, i) => {
      markInput(r.getCell(i + 5))
      r.getCell(i + 5).numFmt = '#,##0.00##'
    })
  }
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]

  const epr = wb.addWorksheet('EPR')
  epr.columns = [{ width: 10 }, { width: 10 }, { width: 14 }, { width: 18 }, { width: 18 }]
  styleHeader(epr.addRow(['MSN', 'Basis', 'Cycle ratio', 'Benign rate, USD', 'Hot rate, USD']))
  for (const a of fleet) {
    const blocks: [string, EprRowApi[] | undefined][] = [['current', a.epr_matrix]]
    if (canViewNaked && a.has_naked_rates) blocks.push(['naked', a.naked_epr_matrix])
    for (const [basis, rows] of blocks) {
      for (const m of toMatrix(rows)) {
        const r = epr.addRow([a.msn, basis, m.cycle_ratio, m.benign_rate, m.hot_rate])
        ;[1, 2, 3, 4, 5].forEach((c) => markInput(r.getCell(c)))
      }
    }
  }
  epr.views = [{ state: 'frozen', ySplit: 1 }]
  return wb
}

/** Cell-level EPR differences, keyed by cycle ratio (added/removed rows show — on one side). */
function eprChanges(msn: number, basis: string, before: Matrix, next: Matrix): ImportChange[] {
  const out: ImportChange[] = []
  const label = basis === 'naked' ? 'Naked EPR' : 'EPR'
  const ratios = [...new Set([...before, ...next].map((r) => r.cycle_ratio))].sort((a, b) => a - b)
  for (const cr of ratios) {
    const b = before.find((r) => same(r.cycle_ratio, cr))
    const n = next.find((r) => same(r.cycle_ratio, cr))
    for (const [key, name] of [['benign_rate', 'benign'], ['hot_rate', 'hot']] as const) {
      const from = b ? b[key] : null
      const to = n ? n[key] : null
      if (!same(from, to)) {
        const note = !b ? ' (new row)' : !n ? ' (row removed)' : ''
        out.push({ section: 'EPR', item: `MSN ${msn}`, field: `${label} @ ${cr} · ${name}${note}`, from, to })
      }
    }
  }
  return out
}

export interface AircraftImportResult {
  items: AircraftImportItem[]
  changes: ImportChange[]
  errors: string[]
}

export function parseAircraftWorkbook(
  fleet: AircraftRecord[],
  canViewNaked: boolean,
  wb: ExcelJS.Workbook,
): AircraftImportResult {
  const errors: string[] = []
  const changes: ImportChange[] = []
  const byMsn = new Map(fleet.map((a) => [a.msn, a]))
  const items = new Map<number, AircraftImportItem>()
  const itemFor = (msn: number) => {
    if (!items.has(msn)) items.set(msn, { msn, rates: {} })
    return items.get(msn)!
  }

  const ws = wb.getWorksheet('Aircraft')
  if (!ws) {
    errors.push('Sheet "Aircraft" is missing.')
  } else {
    const cols = headerColumns(ws)
    const msnCol = cols.get('msn')
    const fleetCol = cols.get('in fleet')
    if (msnCol === undefined) errors.push('Aircraft: the "MSN" column is required.')
    const fieldCols = fieldsFor(canViewNaked)
      .map((f) => ({ ...f, col: cols.get(f.label.toLowerCase()) }))
      .filter((f) => f.col !== undefined)
    if (msnCol !== undefined) {
      ws.eachRow((row, n) => {
        if (n === 1) return
        const m = cellNumber(row.getCell(msnCol).value)
        if (!m.ok || m.value === null) return
        const msn = m.value
        const current = byMsn.get(msn)
        if (!current) {
          errors.push(`Aircraft row ${n}: MSN ${msn} is not in the fleet — create it on the Aircraft tab first.`)
          return
        }
        if (fleetCol !== undefined) {
          const text = cellText(row.getCell(fleetCol).value).trim().toLowerCase()
          const active = ['yes', 'y', 'true', '1', 'on'].includes(text)
            ? true
            : ['no', 'n', 'false', '0', 'off'].includes(text)
              ? false
              : null
          if (active === null) errors.push(`MSN ${msn} · In fleet: "${text}" — use Yes or No.`)
          else if (active !== (current.is_active !== false)) {
            itemFor(msn).is_active = active
            changes.push({ section: 'Aircraft', item: `MSN ${msn}`, field: 'In fleet', from: current.is_active === false ? 0 : 1, to: active ? 1 : 0 })
          }
        }
        for (const f of fieldCols) {
          const cell = cellNumber(row.getCell(f.col!).value)
          const before = num(current[f.key])
          if (!cell.ok) {
            errors.push(`MSN ${msn} · ${f.label}: "${cellText(row.getCell(f.col!).value)}" is not a number.`)
            continue
          }
          if (cell.value === null) {
            if (before !== null) errors.push(`MSN ${msn} · ${f.label}: blank — values can be changed but not cleared.`)
            continue
          }
          if (!same(before, cell.value)) {
            itemFor(msn).rates[f.key] = cell.value
            changes.push({ section: 'Aircraft', item: `MSN ${msn}`, field: f.label, from: before, to: cell.value })
          }
        }
      })
    }
  }

  const epr = wb.getWorksheet('EPR')
  if (!epr) {
    errors.push('Sheet "EPR" is missing.')
  } else {
    const cols = headerColumns(epr)
    const need = ['msn', 'basis', 'cycle ratio', 'benign rate, usd', 'hot rate, usd']
    const missing = need.filter((h) => !cols.has(h))
    if (missing.length) {
      errors.push(`EPR: missing column(s) ${missing.join(', ')}.`)
    } else {
      const blocks = new Map<string, Matrix>()
      epr.eachRow((row, n) => {
        if (n === 1) return
        const vals = need.slice(2).map((h) => cellNumber(row.getCell(cols.get(h)!).value))
        const m = cellNumber(row.getCell(cols.get('msn')!).value)
        const basis = cellText(row.getCell(cols.get('basis')!).value).trim().toLowerCase()
        if (!m.ok || m.value === null) {
          if (vals.some((v) => v.ok && v.value !== null)) errors.push(`EPR row ${n}: MSN is missing.`)
          return
        }
        if (!byMsn.has(m.value)) {
          errors.push(`EPR row ${n}: MSN ${m.value} is not in the fleet.`)
          return
        }
        if (basis !== 'current' && basis !== 'naked') {
          errors.push(`EPR row ${n}: Basis must be "current" or "naked".`)
          return
        }
        if (basis === 'naked' && !canViewNaked) return
        if (vals.some((v) => !v.ok || v.value === null)) {
          errors.push(`EPR row ${n} (MSN ${m.value}): cycle ratio, benign and hot rate must all be numbers.`)
          return
        }
        const key = `${m.value}|${basis}`
        if (!blocks.has(key)) blocks.set(key, [])
        const [cr, benign, hot] = vals.map((v) => (v as { value: number }).value)
        blocks.get(key)!.push({ cycle_ratio: cr, benign_rate: benign, hot_rate: hot })
      })
      for (const [key, rows] of blocks) {
        const [msnText, basis] = key.split('|')
        const msn = Number(msnText)
        const next = [...rows].sort((a, b) => a.cycle_ratio - b.cycle_ratio)
        const dupes = next.some((r, i) => i > 0 && same(r.cycle_ratio, next[i - 1].cycle_ratio))
        if (dupes) {
          errors.push(`EPR MSN ${msn} (${basis}): a cycle ratio appears twice.`)
          continue
        }
        const current = byMsn.get(msn)!
        const before = toMatrix(basis === 'naked' ? current.naked_epr_matrix : current.epr_matrix)
        if (!sameMatrix(before, next)) {
          if (basis === 'naked') itemFor(msn).naked_epr_matrix = next
          else itemFor(msn).epr_matrix = next
          changes.push(...eprChanges(msn, basis, before, next))
        }
      }
    }
  }

  return { items: [...items.values()], changes, errors }
}
