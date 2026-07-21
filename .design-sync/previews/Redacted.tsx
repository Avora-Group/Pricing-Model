import { Redacted } from 'nextjs-project'

/** The hatched redaction pill, standalone. */
export function Standalone() {
  return <Redacted />
}

/** In context: cost figures hidden from users without cost-view permission. */
export function InCostTable() {
  return (
    <table className="av-bd-tbl" style={{ maxWidth: 460 }}>
      <tbody>
        <tr className="head">
          <td>Line</td>
          <td className="r">EUR / month</td>
        </tr>
        <tr>
          <td><span className="cat">Total revenue</span></td>
          <td className="r av-num">1,225,000</td>
        </tr>
        <tr className="sub">
          <td>Aircraft (lease + reserves)</td>
          <td className="r"><Redacted /></td>
        </tr>
        <tr className="sub">
          <td>Crew</td>
          <td className="r"><Redacted /></td>
        </tr>
        <tr className="total">
          <td>Net profit</td>
          <td className="r"><Redacted /></td>
        </tr>
      </tbody>
    </table>
  )
}
