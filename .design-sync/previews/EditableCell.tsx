import { useState } from 'react'
import { EditableCell, ReadOnlyProvider } from 'nextjs-project'

/** Click-to-edit numeric cell (cyan chip = editable affordance). */
export function Editable() {
  const [rate, setRate] = useState<number | null>(3500)
  return <EditableCell value={rate} onChange={setRate} decimals={0} />
}

/** Custom formatter — currency display with two decimals. */
export function CurrencyFormat() {
  const [salary, setSalary] = useState<number | null>(6036.31)
  return (
    <EditableCell
      value={salary}
      onChange={setSalary}
      formatFn={(v) => (v === null ? '—' : `€ ${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)}
    />
  )
}

/** Nullable value — empty input commits null, shown as a dash. */
export function NullableEmpty() {
  const [v, setV] = useState<number | null>(null)
  return <EditableCell value={v} onChange={setV} allowNull />
}

/** Read-only context (non-admin viewers): renders as a plain static figure. */
export function ReadOnlyViewer() {
  return (
    <ReadOnlyProvider readOnly>
      <EditableCell value={1222.5} onChange={() => {}} decimals={2} />
    </ReadOnlyProvider>
  )
}
