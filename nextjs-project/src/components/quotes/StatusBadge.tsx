'use client'

// Maps a quote/project status to its pill modifier.
const STATUS: Record<string, string> = {
  draft: 'av-pill-draft',
  sent: 'av-pill-sent',
  signed: 'av-pill-signed',
  active: 'av-pill-active',
  completed: 'av-pill-completed',
  accepted: 'av-pill-signed', // legacy alias of signed
  rejected: 'av-pill-rejected',
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase()
  const cls = STATUS[key] ?? STATUS.draft
  const label = key.charAt(0).toUpperCase() + key.slice(1)

  return (
    <span className={`av-pill ${cls}`}>
      <span className="d" />
      {label}
    </span>
  )
}
