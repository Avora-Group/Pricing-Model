'use client'

import { useRouter } from 'next/navigation'
import { ExcelButtons } from '@/components/config/ExcelButtons'
import { fmtValue } from '@/components/config/ImportPreviewDialog'
import { buildAircraftWorkbook, parseAircraftWorkbook, type AircraftRecord } from '@/lib/aircraft-excel'
import { downloadWorkbook, readWorkbook } from '@/lib/config-excel'
import { importAircraftAction } from '@/app/actions/aircraft'
import { useCanViewNaked } from '@/providers/CostVisibilityProvider'

/** Aircraft tab Excel round-trip: export the fleet's rates, import an edited copy. */
export function AircraftExcel({ fleet, canEdit }: { fleet: AircraftRecord[]; canEdit: boolean }) {
  const router = useRouter()
  const canViewNaked = useCanViewNaked()
  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ExcelButtons
        canImport={canEdit}
        onExport={() => downloadWorkbook(buildAircraftWorkbook(fleet, canViewNaked), `Aircraft-costs-${stamp}.xlsx`)}
        prepareImport={async (file) => {
          const result = parseAircraftWorkbook(fleet, canViewNaked, await readWorkbook(file))
          return {
            fileName: file.name,
            errors: result.errors,
            changes: result.changes.map((c) => ({
              ...c,
              from: c.field === 'In fleet' ? (c.from ? 'Yes' : 'No') : fmtValue(c.from),
              to: c.field === 'In fleet' ? (c.to ? 'Yes' : 'No') : fmtValue(c.to),
            })),
            apply: async () => {
              const res = await importAircraftAction(result.items)
              if (res.error) return res.error
              router.refresh()
              return null
            },
          }
        }}
      />
    </div>
  )
}
