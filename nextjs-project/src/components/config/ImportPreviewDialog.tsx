'use client'

import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { MobileSheet } from '@/components/ui/MobileSheet'

export interface PreviewChange {
  section: string
  item: string
  field: string
  from: string
  to: string
}

export interface ImportPreview {
  fileName: string
  changes: PreviewChange[]
  errors: string[]
  /** Writes the import; resolves to an error message, or null on success. */
  apply: () => Promise<string | null>
}

/**
 * Review step for an Excel import: every value that would change (old → new)
 * and every problem found. Errors block Apply so a half-understood file never
 * gets written.
 */
export function ImportPreviewDialog({ preview, onClose }: { preview: ImportPreview | null; onClose: () => void }) {
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!preview) return null

  const blocked = preview.errors.length > 0
  const nothing = !blocked && preview.changes.length === 0

  async function apply() {
    if (!preview) return
    setApplying(true)
    setError(null)
    const err = await preview.apply()
    setApplying(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <MobileSheet
      isOpen
      onClose={onClose}
      title={`Import preview — ${preview.fileName}`}
      maxWidth="max-w-3xl"
      desktopStyle={{ maxHeight: '85vh' }}
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <span className="text-xs mr-auto" style={{ color: 'var(--neg)' }}>{error}</span>}
          <button onClick={onClose} className="av-btn av-btn-ghost !text-xs" disabled={applying}>
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={blocked || nothing || applying}
            className="av-btn av-btn-cyan !text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={12} />
            {applying ? 'Applying…' : `Apply ${preview.changes.length} change${preview.changes.length === 1 ? '' : 's'}`}
          </button>
        </div>
      }
    >
      <div className="p-[18px] space-y-4 text-[13px]">
        {blocked && (
          <div className="rounded-lg p-3 space-y-1" style={{ background: 'var(--neg-soft)', color: 'var(--neg)' }}>
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle size={13} />
              Fix these in the file and import again — nothing will be changed:
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {preview.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
        {nothing && <p style={{ color: 'var(--muted)' }}>The file matches the current values — nothing to change.</p>}
        {preview.changes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="av-tbl">
              <thead>
                <tr>
                  <th className="av-th">Section</th>
                  <th className="av-th">Row</th>
                  <th className="av-th">Field</th>
                  <th className="av-th r">Current</th>
                  <th className="av-th r">New</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((c, i) => (
                  <tr key={i}>
                    <td className="av-td" style={{ color: 'var(--muted)' }}>{c.section}</td>
                    <td className="av-td" style={{ fontWeight: 600 }}>{c.item}</td>
                    <td className="av-td">{c.field}</td>
                    <td className="av-td r av-num" style={{ color: 'var(--muted)' }}>{c.from}</td>
                    <td className="av-td r av-num" style={{ fontWeight: 700, color: 'var(--cyan-ink)' }}>{c.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MobileSheet>
  )
}

export const fmtValue = (v: number | null | boolean | undefined): string => {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return v.toLocaleString('en-US', { maximumFractionDigits: 6 })
}
