import { PnlView } from '@/components/pricing/PnlView'

export default function PnlPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="av-page-title">Profit &amp; Loss</h1>
        <p className="av-page-sub">Monthly financial statement per MSN or total project</p>
      </div>
      <PnlView />
    </div>
  )
}
