import { TableCard } from 'nextjs-project'

/** Config table in its scrollable card shell (av-panel + table). */
export function CrewPayroll() {
  return (
    <div style={{ maxWidth: 560 }}>
      <TableCard>
        <thead>
          <tr>
            <th className="av-th">Position</th>
            <th className="av-th r">Gross Salary</th>
            <th className="av-th r">Per Diem FD</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="av-td">Flight-pilot, Instructor</td>
            <td className="av-td av-num r">6,036.31</td>
            <td className="av-td av-num r">310</td>
          </tr>
          <tr>
            <td className="av-td">Co-pilot</td>
            <td className="av-td av-num r">4,480.45</td>
            <td className="av-td av-num r">210</td>
          </tr>
          <tr>
            <td className="av-td">Cabin Attendant</td>
            <td className="av-td av-num r">1,222.50</td>
            <td className="av-td av-num r">100</td>
          </tr>
        </tbody>
      </TableCard>
    </div>
  )
}
