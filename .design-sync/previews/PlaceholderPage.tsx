import { PlaceholderPage } from 'nextjs-project'

/** Empty-state page for a section that isn't built yet. */
export function ComingSoon() {
  return (
    <div style={{ minHeight: 220, display: 'flex', background: 'var(--bg)', borderRadius: 12 }}>
      <PlaceholderPage
        title="Reports"
        description="Quarterly utilisation and margin reports are coming in the next release."
      />
    </div>
  )
}
