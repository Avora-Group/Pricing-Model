import { StatusBadge } from 'nextjs-project'

/** The full quote/project lifecycle — one pill per status. */
export function Lifecycle() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <StatusBadge status="draft" />
      <StatusBadge status="sent" />
      <StatusBadge status="signed" />
      <StatusBadge status="active" />
      <StatusBadge status="completed" />
      <StatusBadge status="rejected" />
    </div>
  )
}

/** In context: a quote row cell as the Quotes table renders it. */
export function InTableRow() {
  return (
    <table className="av-tbl" style={{ maxWidth: 520 }}>
      <thead>
        <tr>
          <th className="av-th">Quote</th>
          <th className="av-th">Client</th>
          <th className="av-th">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="av-td"><span className="tlink av-num">EZJ-014</span></td>
          <td className="av-td" style={{ fontWeight: 600 }}>EasyJet</td>
          <td className="av-td"><StatusBadge status="active" /></td>
        </tr>
        <tr>
          <td className="av-td"><span className="tlink av-num">SWR-007</span></td>
          <td className="av-td" style={{ fontWeight: 600 }}>Swiss</td>
          <td className="av-td"><StatusBadge status="sent" /></td>
        </tr>
      </tbody>
    </table>
  )
}
