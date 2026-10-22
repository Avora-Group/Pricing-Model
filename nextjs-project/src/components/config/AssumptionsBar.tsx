'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Undo2 } from 'lucide-react'
import {
  useCrewConfigStore,
  isCrewAtDefaults,
  pickCrewConfig,
  type CrewConfigData,
} from '@/stores/crew-config-store'
import {
  useCostsConfigStore,
  isCostsAtDefaults,
  pickCostsConfig,
} from '@/stores/costs-config-store'
import { usePricingStore, getDefaultRatios } from '@/stores/pricing-store'
import { applyCompanyDefaults, type CostsDefaultsData } from '@/lib/company-defaults'
import {
  CREW_WORKBOOK,
  COSTS_WORKBOOK,
  buildConfigWorkbook,
  parseConfigWorkbook,
  downloadWorkbook,
  readWorkbook,
  type WorkbookSpec,
} from '@/lib/config-excel'
import { saveAssumptionsAction } from '@/app/actions/assumptions'
import { ExcelButtons } from './ExcelButtons'
import { fmtValue } from './ImportPreviewDialog'

type Kind = 'crew' | 'costs'

/** Current page values as they would be saved. */
function currentData(kind: Kind): CrewConfigData | CostsDefaultsData {
  if (kind === 'crew') return pickCrewConfig(useCrewConfigStore.getState())
  const { bhFhRatio, apuFhRatio } = usePricingStore.getState()
  return { ...pickCostsConfig(useCostsConfigStore.getState()), bhFhRatio, apuFhRatio }
}

function loadIntoStores(kind: Kind, data: CrewConfigData | CostsDefaultsData) {
  if (kind === 'crew') {
    useCrewConfigStore.getState().loadFromSnapshot(data as CrewConfigData)
  } else {
    const { bhFhRatio, apuFhRatio, ...costs } = data as CostsDefaultsData
    useCostsConfigStore.getState().loadFromSnapshot(costs)
    if (bhFhRatio && apuFhRatio) usePricingStore.setState({ bhFhRatio, apuFhRatio })
  }
}

/**
 * Save bar for the Crew / Costs pages, which edit the company defaults that
 * new quotes start from. Shows whether the page differs from what is saved,
 * and offers Save / Discard and the Excel export → edit → import round-trip.
 */
export function AssumptionsBar({
  kind,
  canEdit,
  savedAt,
}: {
  kind: Kind
  canEdit: boolean
  savedAt: string | null
}) {
  const router = useRouter()
  const crew = useCrewConfigStore()
  const costs = useCostsConfigStore()
  const bhFhRatio = usePricingStore((s) => s.bhFhRatio)
  const apuFhRatio = usePricingStore((s) => s.apuFhRatio)
  const editingQuoteId = usePricingStore((s) => s.editingQuoteId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ratiosAtDefaults =
    bhFhRatio === getDefaultRatios().bhFhRatio && apuFhRatio === getDefaultRatios().apuFhRatio
  const dirty = kind === 'crew' ? !isCrewAtDefaults(crew) : !isCostsAtDefaults(costs) || !ratiosAtDefaults

  // Arriving from a quote leaves that quote's snapshot in the stores; this page
  // edits the company defaults, so show those instead.
  useEffect(() => {
    if (editingQuoteId === null) return
    if (kind === 'crew') useCrewConfigStore.getState().resetToDefaults()
    else {
      useCostsConfigStore.getState().resetToDefaults()
      usePricingStore.setState(getDefaultRatios())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(data: CrewConfigData | CostsDefaultsData): Promise<string | null> {
    const res = await saveAssumptionsAction(kind, data as unknown as Record<string, unknown>)
    if (res.error || !res.saved) return res.error ?? 'Save failed'
    // The saved document becomes the new defaults (ratios included for Costs),
    // so the page reads as clean without waiting for the refresh.
    applyCompanyDefaults(kind === 'crew' ? { crew: res.saved, costs: null } : { crew: null, costs: res.saved })
    router.refresh()
    return null
  }

  async function onSave() {
    setSaving(true)
    setError(null)
    setError(await save(currentData(kind)))
    setSaving(false)
  }

  function onDiscard() {
    if (kind === 'crew') useCrewConfigStore.getState().resetToDefaults()
    else {
      useCostsConfigStore.getState().resetToDefaults()
      usePricingStore.setState(getDefaultRatios())
    }
  }

  const spec = (kind === 'crew' ? CREW_WORKBOOK : COSTS_WORKBOOK) as WorkbookSpec<CrewConfigData | CostsDefaultsData>
  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl"
      style={{ background: 'var(--card)', border: `1px solid ${dirty ? 'var(--amber)' : 'var(--line)'}` }}
    >
      <div className="text-[13px] mr-auto">
        {dirty ? (
          <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Unsaved changes</span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>
            Company defaults for new quotes ·{' '}
            {savedAt ? `saved ${new Date(savedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : 'built-in values (never saved)'}
          </span>
        )}
        {error && <span className="ml-3" style={{ color: 'var(--neg)' }}>{error}</span>}
      </div>

      <ExcelButtons
        canImport={canEdit}
        onExport={() =>
          downloadWorkbook(buildConfigWorkbook(spec, currentData(kind)), `${kind === 'crew' ? 'Crew' : 'Costs'}-assumptions-${stamp}.xlsx`)
        }
        prepareImport={async (file) => {
          const result = parseConfigWorkbook(spec, currentData(kind), await readWorkbook(file))
          return {
            fileName: file.name,
            errors: result.errors,
            changes: result.changes.map((c) => ({ ...c, from: fmtValue(c.from), to: fmtValue(c.to) })),
            apply: async () => {
              loadIntoStores(kind, result.config)
              return save(result.config)
            },
          }
        }}
      />

      {canEdit && dirty && (
        <>
          <button onClick={onDiscard} disabled={saving} className="av-btn av-btn-ghost !text-xs !h-[34px] !py-0">
            <Undo2 size={12} />
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="av-btn av-btn-cyan !text-xs !h-[34px] !py-0 disabled:opacity-50"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save as defaults'}
          </button>
        </>
      )}
    </div>
  )
}
