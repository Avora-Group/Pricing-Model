import { FormulaCell } from 'nextjs-project'

/** Computed figure, two decimals (the default). Width-constrained like a table cell. */
export function Default() {
  return (
    <div style={{ width: 120 }}>
      <FormulaCell value={11960.5} />
    </div>
  )
}

/** Whole-number display for counts and hours. */
export function WholeNumber() {
  return (
    <div style={{ width: 120 }}>
      <FormulaCell value={350} decimals={0} />
    </div>
  )
}

/** Column of derived figures as a config table renders them. */
export function InColumn() {
  return (
    <div style={{ width: 140, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 0' }}>
      <FormulaCell value={6036.31} />
      <FormulaCell value={4480.45} />
      <FormulaCell value={1222.5} />
    </div>
  )
}
