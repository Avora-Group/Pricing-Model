/**
 * Excel round-trip for the Crew and Costs pages.
 *
 * Export writes one sheet per table (plus a Settings sheet for scalars) with
 * the current values; import reads the same layout back and reports every
 * changed value for a preview before anything is applied. Rows are matched by
 * their "#" and name together, so repeated names (four cabin attendant rows)
 * stay unambiguous and a reordered or renamed row is reported, not guessed.
 */
import ExcelJS from 'exceljs'
import type { CrewConfigData } from '@/stores/crew-config-store'
import type { CostsDefaultsData } from '@/lib/company-defaults'

// ---- Spec types ----

type Row = Record<string, unknown>

export interface FieldSpec {
  key: string
  label: string
  /** Blank cell allowed (stored as null). */
  nullable?: boolean
  /** Field only editable on some rows (others export blank and are ignored). */
  appliesTo?: (row: Row) => boolean
}

export interface TableSpec<C> {
  sheet: string
  /** Column header for the row's identifying name. */
  nameLabel: string
  nameOf: (row: Row) => string
  fields: FieldSpec[]
  rows: (config: C) => Row[]
  withRows: (config: C, rows: Row[]) => C
}

export interface ScalarSpec<C> {
  key: string
  label: string
  get: (config: C) => number
  set: (config: C, value: number) => C
}

export interface WorkbookSpec<C> {
  title: string
  tables: TableSpec<C>[]
  scalars: ScalarSpec<C>[]
}

export interface ImportChange {
  section: string
  item: string
  field: string
  from: number | null
  to: number | null
}

export interface ImportResult<C> {
  config: C
  changes: ImportChange[]
  errors: string[]
}

// ---- Specs ----

const table = <C,>(t: TableSpec<C>) => t

export const CREW_WORKBOOK: WorkbookSpec<CrewConfigData> = {
  title: 'Crew cost assumptions',
  tables: [
    table<CrewConfigData>({
      sheet: 'Payroll',
      nameLabel: 'Position',
      nameOf: (r) => String(r.position),
      fields: [
        { key: 'grossSalary', label: 'Gross salary, EUR' },
        { key: 'benefits', label: 'Benefits, EUR' },
        { key: 'perDiemFD', label: 'Per diem FD, EUR' },
        { key: 'perDiemNFD', label: 'Per diem NFD, EUR' },
        { key: 'perBhPerdiem', label: 'Per BH per diem, EUR' },
      ],
      rows: (c) => c.payroll as unknown as Row[],
      withRows: (c, rows) => ({ ...c, payroll: rows as unknown as CrewConfigData['payroll'] }),
    }),
    table<CrewConfigData>({
      sheet: 'Other cost',
      nameLabel: 'Item',
      nameOf: (r) => String(r.item),
      fields: [{ key: 'amount', label: 'Amount, EUR', nullable: true }],
      rows: (c) => c.otherCost as unknown as Row[],
      withRows: (c, rows) => ({ ...c, otherCost: rows as unknown as CrewConfigData['otherCost'] }),
    }),
    table<CrewConfigData>({
      sheet: 'Training',
      nameLabel: 'Item',
      nameOf: (r) => String(r.item),
      fields: [{ key: 'amount', label: 'Amount, EUR', nullable: true }],
      rows: (c) => c.training as unknown as Row[],
      withRows: (c, rows) => ({ ...c, training: rows as unknown as CrewConfigData['training'] }),
    }),
  ],
  scalars: [
    { key: 'averageAC', label: 'Average A/C', get: (c) => c.averageAC, set: (c, v) => ({ ...c, averageAC: v }) },
    { key: 'fdDays', label: 'FD days', get: (c) => c.fdDays, set: (c, v) => ({ ...c, fdDays: v }) },
    { key: 'nfdDays', label: 'NFD days', get: (c) => c.nfdDays, set: (c, v) => ({ ...c, nfdDays: v }) },
  ],
}

const ratio = (key: 'bhFhRatio' | 'apuFhRatio', fallback: string): ScalarSpec<CostsDefaultsData> => ({
  key,
  label: key === 'bhFhRatio' ? 'BH : FH' : 'APU FH : FH',
  get: (c) => parseFloat(c[key] ?? fallback),
  set: (c, v) => ({ ...c, [key]: String(v) }),
})

export const COSTS_WORKBOOK: WorkbookSpec<CostsDefaultsData> = {
  title: 'Cost assumptions',
  tables: [
    table<CostsDefaultsData>({
      sheet: 'Maint personnel',
      nameLabel: 'Role',
      nameOf: (r) => String(r.name),
      fields: [
        { key: 'engineers', label: 'Engineers' },
        { key: 'perDiem', label: 'Per diem, EUR' },
        { key: 'days', label: 'Days' },
      ],
      rows: (c) => c.maintPersonnel as unknown as Row[],
      withRows: (c, rows) => ({ ...c, maintPersonnel: rows as unknown as CostsDefaultsData['maintPersonnel'] }),
    }),
    table<CostsDefaultsData>({
      sheet: 'Maint costs',
      nameLabel: 'Item',
      nameOf: (r) => String(r.name),
      fields: [{ key: 'perMonthPerAc', label: 'Per month / A/C, EUR (Spare Parts: per BH)' }],
      rows: (c) => c.maintCosts as unknown as Row[],
      withRows: (c, rows) => ({ ...c, maintCosts: rows as unknown as CostsDefaultsData['maintCosts'] }),
    }),
    table<CostsDefaultsData>({
      sheet: 'Insurance',
      nameLabel: 'MSN',
      nameOf: (r) => String(r.msn),
      fields: [{ key: 'priceUsd', label: 'Price, USD' }],
      rows: (c) => c.insurance as unknown as Row[],
      withRows: (c, rows) => ({ ...c, insurance: rows as unknown as CostsDefaultsData['insurance'] }),
    }),
    table<CostsDefaultsData>({
      sheet: 'DOC',
      nameLabel: 'Item',
      nameOf: (r) => String(r.name),
      fields: [{ key: 'total', label: 'Total, EUR' }],
      rows: (c) => c.doc as unknown as Row[],
      withRows: (c, rows) => ({ ...c, doc: rows as unknown as CostsDefaultsData['doc'] }),
    }),
    table<CostsDefaultsData>({
      sheet: 'Other COGS',
      nameLabel: 'Item',
      nameOf: (r) => String(r.name),
      fields: [
        { key: 'total', label: 'Total, EUR', appliesTo: (r) => Boolean(r.hasTotal) },
        { key: 'perMonth', label: 'Per month, EUR', appliesTo: (r) => !r.hasTotal },
      ],
      rows: (c) => c.otherCogs as unknown as Row[],
      withRows: (c, rows) => ({ ...c, otherCogs: rows as unknown as CostsDefaultsData['otherCogs'] }),
    }),
    table<CostsDefaultsData>({
      sheet: 'Overhead',
      nameLabel: 'Item',
      nameOf: (r) => String(r.name),
      fields: [{ key: 'total', label: 'Total, EUR' }],
      rows: (c) => c.overhead as unknown as Row[],
      withRows: (c, rows) => ({ ...c, overhead: rows as unknown as CostsDefaultsData['overhead'] }),
    }),
  ],
  scalars: [
    { key: 'avgAc', label: 'Average A/C', get: (c) => c.avgAc, set: (c, v) => ({ ...c, avgAc: v }) },
    ratio('bhFhRatio', '1.2'),
    ratio('apuFhRatio', '0.7'),
  ],
}

// ---- Shared cell helpers ----

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A93' } }
const INPUT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3FF' } }
const LOCKED_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

export function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.eachCell((c) => { c.fill = HEADER_FILL })
}

export function markInput(cell: ExcelJS.Cell): void {
  cell.fill = INPUT_FILL
}

export function markLocked(cell: ExcelJS.Cell): void {
  cell.fill = LOCKED_FILL
  cell.font = { color: { argb: 'FF666666' } }
}

/** Number in a cell: plain number, numeric text, or a formula's cached result. */
export function cellNumber(value: ExcelJS.CellValue): { ok: true; value: number | null } | { ok: false } {
  let v: unknown = value
  if (v && typeof v === 'object' && 'result' in (v as object)) v = (v as { result: unknown }).result
  if (v === null || v === undefined || v === '') return { ok: true, value: null }
  if (typeof v === 'number') return Number.isFinite(v) ? { ok: true, value: v } : { ok: false }
  if (typeof v === 'string') {
    const n = Number(v.replace(/[\s,€$]/g, ''))
    return v.trim() === '' ? { ok: true, value: null } : Number.isFinite(n) ? { ok: true, value: n } : { ok: false }
  }
  return { ok: false }
}

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'result' in (value as object)) return String((value as { result: unknown }).result ?? '')
  if (typeof value === 'object' && 'richText' in (value as object)) {
    return (value as { richText: { text: string }[] }).richText.map((t) => t.text).join('')
  }
  return String(value)
}

/** Header label → column number for row 1 of a sheet. */
export function headerColumns(ws: ExcelJS.Worksheet): Map<string, number> {
  const cols = new Map<string, number>()
  ws.getRow(1).eachCell((cell, col) => cols.set(cellText(cell.value).trim().toLowerCase(), col))
  return cols
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
const sameNumber = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 1e-9

export async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function readWorkbook(file: File): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  return wb
}

// ---- Export ----

export function buildConfigWorkbook<C>(spec: WorkbookSpec<C>, config: C): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()

  const info = wb.addWorksheet('Read me')
  info.columns = [{ width: 110 }]
  ;[
    spec.title,
    `Exported ${new Date().toISOString().slice(0, 10)} from the ACMI pricing app.`,
    '',
    'Change the values in the blue cells, then import this file on the same page.',
    'Do not rename sheets or columns, and do not change the "#" or name columns — rows are matched by them.',
    'Grey cells are not used by the import. Rows you leave unchanged are not touched.',
    'Nothing is changed until you review the preview and confirm.',
  ].forEach((line, i) => {
    info.getCell(i + 1, 1).value = line
    if (i === 0) info.getCell(1, 1).font = { bold: true, size: 14 }
  })

  for (const t of spec.tables) {
    const ws = wb.addWorksheet(t.sheet)
    ws.columns = [{ width: 6 }, { width: 46 }, ...t.fields.map(() => ({ width: 22 }))]
    styleHeader(ws.addRow(['#', t.nameLabel, ...t.fields.map((f) => f.label)]))
    t.rows(config).forEach((row, i) => {
      const r = ws.addRow([i + 1, t.nameOf(row), ...t.fields.map((f) => (f.appliesTo && !f.appliesTo(row) ? null : row[f.key] ?? null))])
      markLocked(r.getCell(1))
      markLocked(r.getCell(2))
      t.fields.forEach((f, fi) => {
        const cell = r.getCell(fi + 3)
        if (f.appliesTo && !f.appliesTo(row)) markLocked(cell)
        else markInput(cell)
        cell.numFmt = '#,##0.00'
      })
    })
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const settings = wb.addWorksheet('Settings')
  settings.columns = [{ width: 16 }, { width: 24 }, { width: 16 }]
  styleHeader(settings.addRow(['Key', 'Setting', 'Value']))
  for (const s of spec.scalars) {
    const r = settings.addRow([s.key, s.label, s.get(config)])
    markLocked(r.getCell(1))
    markLocked(r.getCell(2))
    markInput(r.getCell(3))
  }
  return wb
}

// ---- Import ----

export function parseConfigWorkbook<C>(spec: WorkbookSpec<C>, current: C, wb: ExcelJS.Workbook): ImportResult<C> {
  let config = current
  const changes: ImportChange[] = []
  const errors: string[] = []

  for (const t of spec.tables) {
    const ws = wb.getWorksheet(t.sheet)
    if (!ws) {
      errors.push(`Sheet "${t.sheet}" is missing.`)
      continue
    }
    const cols = headerColumns(ws)
    const fieldCols = t.fields.map((f) => ({ f, col: cols.get(f.label.toLowerCase()) }))
    for (const { f, col } of fieldCols) {
      if (col === undefined) errors.push(`${t.sheet}: column "${f.label}" is missing.`)
    }
    const numCol = cols.get('#')
    const nameCol = cols.get(t.nameLabel.toLowerCase())
    if (numCol === undefined || nameCol === undefined) {
      errors.push(`${t.sheet}: the "#" and "${t.nameLabel}" columns are required.`)
      continue
    }

    const rows = t.rows(config).map((r) => ({ ...r }))
    ws.eachRow((wsRow, rowNumber) => {
      if (rowNumber === 1) return
      const num = cellNumber(wsRow.getCell(numCol).value)
      const name = cellText(wsRow.getCell(nameCol).value)
      if (!num.ok || num.value === null) {
        if (name.trim()) errors.push(`${t.sheet} row ${rowNumber}: "#" is missing or not a number.`)
        return
      }
      const idx = num.value - 1
      const target = rows[idx]
      if (!Number.isInteger(idx) || !target) {
        errors.push(`${t.sheet} row ${rowNumber}: #${num.value} does not exist on this page (rows can't be added by import).`)
        return
      }
      if (norm(name) !== norm(t.nameOf(target))) {
        errors.push(`${t.sheet} row ${rowNumber}: #${num.value} is "${t.nameOf(target)}" here but "${name}" in the file.`)
        return
      }
      for (const { f, col } of fieldCols) {
        if (col === undefined || (f.appliesTo && !f.appliesTo(target))) continue
        const cell = cellNumber(wsRow.getCell(col).value)
        const label = `${t.sheet} · ${t.nameOf(target)} · ${f.label}`
        if (!cell.ok) {
          errors.push(`${label}: "${cellText(wsRow.getCell(col).value)}" is not a number.`)
          continue
        }
        if (cell.value === null && !f.nullable) {
          errors.push(`${label}: value is blank.`)
          continue
        }
        const before = (target[f.key] ?? null) as number | null
        if (!sameNumber(before, cell.value)) {
          changes.push({ section: t.sheet, item: `#${idx + 1} ${t.nameOf(target)}`, field: f.label, from: before, to: cell.value })
          target[f.key] = cell.value
        }
      }
    })
    config = t.withRows(config, rows)
  }

  const settings = wb.getWorksheet('Settings')
  if (!settings) {
    errors.push('Sheet "Settings" is missing.')
  } else {
    const byKey = new Map<string, ExcelJS.CellValue>()
    settings.eachRow((r, n) => {
      if (n > 1) byKey.set(cellText(r.getCell(1).value).trim(), r.getCell(3).value)
    })
    for (const s of spec.scalars) {
      if (!byKey.has(s.key)) {
        errors.push(`Settings: "${s.label}" (${s.key}) is missing.`)
        continue
      }
      const cell = cellNumber(byKey.get(s.key) ?? null)
      if (!cell.ok || cell.value === null) {
        errors.push(`Settings · ${s.label}: value is blank or not a number.`)
        continue
      }
      const before = s.get(config)
      if (!sameNumber(before, cell.value)) {
        changes.push({ section: 'Settings', item: s.label, field: 'Value', from: before, to: cell.value })
        config = s.set(config, cell.value)
      }
    }
  }

  return { config, changes, errors }
}
