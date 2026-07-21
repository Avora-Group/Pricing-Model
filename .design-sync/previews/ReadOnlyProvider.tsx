import { EditableCell, ReadOnlyProvider } from 'nextjs-project'

/** Same cells, editable vs viewer-locked — the provider flips the whole subtree. */
export function EditableVsReadOnly() {
  const row = (label: string, cells: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
      <span style={{ width: 130, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
      {cells}
    </div>
  )
  return (
    <div>
      {row('Admin (editable)', (
        <ReadOnlyProvider readOnly={false}>
          <EditableCell value={6036.31} onChange={() => {}} />
          <EditableCell value={178} onChange={() => {}} decimals={0} />
        </ReadOnlyProvider>
      ))}
      {row('Viewer (locked)', (
        <ReadOnlyProvider readOnly>
          <EditableCell value={6036.31} onChange={() => {}} />
          <EditableCell value={178} onChange={() => {}} decimals={0} />
        </ReadOnlyProvider>
      ))}
    </div>
  )
}
