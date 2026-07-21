import { SectionHeader } from 'nextjs-project'

/** Uppercase cyan group label used between config-table sections. */
export function Default() {
  return <SectionHeader title="Maintenance Personnel" />
}

/** Stacked sections as the Crew page uses them. */
export function Stacked() {
  return (
    <div style={{ maxWidth: 420 }}>
      <SectionHeader title="Payroll" />
      <div className="av-panel" style={{ height: 44 }} />
      <SectionHeader title="Other Crew Cost" />
      <div className="av-panel" style={{ height: 44 }} />
    </div>
  )
}
