import { CrewConfigTable } from '@/components/crew/CrewConfigTable'

export default function CrewPage() {
  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="av-page-title">Crew Cost Assumptions</h1>
        <p className="av-page-sub">Payroll, per-diem and training parameters</p>
      </div>
      <CrewConfigTable />
    </div>
  )
}
