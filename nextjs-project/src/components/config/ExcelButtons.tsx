'use client'

import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { ImportPreviewDialog, type ImportPreview } from './ImportPreviewDialog'

/**
 * Export / Import Excel buttons. Import reads the chosen file into a preview
 * (via `prepareImport`); nothing is written until the preview is applied.
 */
export function ExcelButtons({
  onExport,
  prepareImport,
  canImport,
}: {
  onExport: () => Promise<void>
  prepareImport: (file: File) => Promise<ImportPreview>
  canImport: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runExport() {
    setBusy('export')
    setError(null)
    try {
      await onExport()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy('import')
    setError(null)
    try {
      setPreview(await prepareImport(file))
    } catch {
      setError('Could not read that file — is it an .xlsx exported from this page?')
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      {error && <span className="text-xs" style={{ color: 'var(--neg)' }}>{error}</span>}
      <button
        onClick={runExport}
        disabled={busy !== null}
        title="Download the current values as an Excel template"
        className="av-btn av-btn-ghost !text-xs !h-[34px] !py-0 disabled:opacity-50"
      >
        <Download size={12} />
        {busy === 'export' ? 'Preparing…' : 'Export Excel'}
      </button>
      {canImport && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            title="Upload an edited template — you'll review the changes before they're applied"
            className="av-btn av-btn-ghost !text-xs !h-[34px] !py-0 disabled:opacity-50"
          >
            <Upload size={12} />
            {busy === 'import' ? 'Reading…' : 'Import Excel'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </>
      )}
      <ImportPreviewDialog preview={preview} onClose={() => setPreview(null)} />
    </>
  )
}
