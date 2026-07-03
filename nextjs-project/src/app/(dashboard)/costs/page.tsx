import { CostsConfigTable } from '@/components/costs/CostsConfigTable'

export default function CostsPage() {
  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="av-page-title">Cost Assumptions</h1>
        <p className="av-page-sub">
          Maintenance, insurance, DOC, other COGS and overhead drivers
        </p>
      </div>
      <CostsConfigTable />
    </div>
  )
}
