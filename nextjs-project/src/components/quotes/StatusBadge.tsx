'use client'

// Maps a quote/project status to its pill modifier + legend dot color.
const STATUS: Record<string, { cls: string; dot: string }> = {
  draft: { cls: 'av-pill-draft', dot: 'transparent' },
  sent: { cls: 'av-pill-sent', dot: 'oklch(0.62 0.13 245)' },
  signed: { cls: 'av-pill-signed', dot: 'var(--av-accent)' },
  active: { cls: 'av-pill-active', dot: 'var(--av-pos)' },
  completed: { cls: 'av-pill-completed', dot: 'oklch(0.55 0.07 200)' },
  accepted: { cls: 'av-pill-signed', dot: 'var(--av-accent)' }, // legacy alias of signed
  rejected: { cls: 'av-pill-rejected', dot: 'var(--av-neg)' },
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase()
  const s = STATUS[key] ?? STATUS.draft
  const label = key.charAt(0).toUpperCase() + key.slice(1)

  return (
    <span className={`av-pill ${s.cls}`}>
      {s.dot !== 'transparent' && (
        <span className="av-pdot" style={{ background: s.dot }} />
      )}
      {label}
    </span>
  )
}
