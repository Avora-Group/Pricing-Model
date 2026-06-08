import { SensitivityView } from '@/components/sensitivity/SensitivityView'

export default function SensitivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="av-page-title">Sensitivity Analysis</h1>
        <p className="av-page-sub">
          Sweep a single parameter around a saved project to see the impact on cost and profit
        </p>
      </div>
      <SensitivityView />
    </div>
  )
}
