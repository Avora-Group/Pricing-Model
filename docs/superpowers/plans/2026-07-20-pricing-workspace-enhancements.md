# Pricing Workspace Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a New Quote modal to the Quotes page, draft-aircraft loading on dropdown select, cursor-following hover popups for cost breakdowns, and an auto-calculated Duration field.

**Architecture:** Frontend-only changes in `nextjs-project` (Next.js 16 App Router, React 19, Zustand, Tailwind 4 + custom `av-*` CSS). The Pricing Workspace (`DashboardSummary`) is reused verbatim inside a modal; drafts are ordinary `MsnInput`s with an `isDraft` flag so all calc paths work unchanged; the drill-down popover becomes a self-positioning hover tooltip.

**Tech Stack:** TypeScript, React 19 client components, Zustand stores, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-20-pricing-workspace-enhancements-design.md`

## Global Constraints

- No backend/API changes. No new dependencies.
- No test runner exists in `nextjs-project` — verification per task is `npm run build` (type-check + lint) run from `C:\Projects\acmi-app\nextjs-project`, expected to end with "Compiled successfully". Manual UI verification checklist is the final task.
- Match existing code style: CSS variables (`var(--ink)` etc.), `av-*` utility classes, single quotes, no semicolons where the file omits them.
- All file paths below are relative to `C:\Projects\acmi-app\nextjs-project` unless prefixed with `docs/`.
- Duration format is exactly `365 d / 12.0 mo` (months = days ÷ 30.4375, one decimal).
- Modal size is exactly 75vw × 80vh.
- Commit messages: imperative style matching repo history (e.g. "Quotes: add New Quote modal opening the Pricing Workspace"), each ending with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.

**Deviation from spec (approved rationale):** Spec §3 said parents track `onMouseMove`. `SummaryTable`/`PnlTable` recompute all pricing on every render, so per-pixel state updates would jank. Instead the popover itself follows the cursor via a document-level `mousemove` listener with direct style mutation; parents only set state on `mouseenter`/`mouseleave`. Same UX, no re-render storm.

**Deviation from spec:** Spec §2 said add a `commitDraft` store action; the existing `patchMsnInput(msn, { isDraft: false })` already does this, so no new store action is added (DRY).

---

### Task 1: Duration field in the Term section

**Files:**
- Modify: `src/components/pricing/MsnInputRow.tsx`

**Interfaces:**
- Consumes: `SeasonInput.periodStart` / `periodEnd` (strings, `YYYY-MM` or `YYYY-MM-DD`), existing `startDateValue` / `endDateValue` helpers in the same file.
- Produces: nothing used by later tasks (pure display).

- [ ] **Step 1: Add the `durationText` helper**

In `src/components/pricing/MsnInputRow.tsx`, directly below the existing `endDateValue` function (~line 159), add:

```tsx
/** Human-readable term length, e.g. "365 d / 12.0 mo". Em dash when dates are
 *  incomplete or inverted. Days are inclusive; months = days / 30.4375. */
function durationText(start: string | null | undefined, end: string | null | undefined): string {
  const s = startDateValue(start)
  const e = endDateValue(end)
  if (s.length < 10 || e.length < 10) return '—'
  const sd = new Date(s)
  const ed = new Date(e)
  if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || ed < sd) return '—'
  const days = Math.round((ed.getTime() - sd.getTime()) / 86_400_000) + 1
  const months = days / 30.4375
  return `${days} d / ${months.toFixed(1)} mo`
}
```

- [ ] **Step 2: Render the Duration field in the Term block**

In the same file, inside `RateControls`, find the Term block:

```tsx
      <div className="av-in-sec-t" style={{ marginTop: 18 }}>Term</div>
      <div className="av-field-row">
        <NumField label="Start date" type="date" value={startDateValue(data.periodStart)} onChange={(v) => onChange('periodStart', v)} />
        <NumField label="End date" type="date" value={endDateValue(data.periodEnd)} onChange={(v) => onChange('periodEnd', v)} />
      </div>
```

and add a Duration row after the date row so the block becomes:

```tsx
      <div className="av-in-sec-t" style={{ marginTop: 18 }}>Term</div>
      <div className="av-field-row">
        <NumField label="Start date" type="date" value={startDateValue(data.periodStart)} onChange={(v) => onChange('periodStart', v)} />
        <NumField label="End date" type="date" value={endDateValue(data.periodEnd)} onChange={(v) => onChange('periodEnd', v)} />
      </div>
      <div className="av-field-row" style={{ marginTop: 12 }}>
        <div>
          <label className="text-[10px] font-semibold leading-none mb-1 block" style={{ color: 'var(--muted)' }}>
            Duration
          </label>
          <div className={inputCls} style={{ background: 'var(--card-2)', color: 'var(--ink-2)', cursor: 'default' }}>
            {durationText(data.periodStart, data.periodEnd)}
          </div>
        </div>
        <div />
      </div>
```

(`inputCls` is the existing module-level constant `'av-input av-num !py-1.5 !text-xs w-full'` — rendering it on a `div` gives the input look without editability.)

- [ ] **Step 3: Build**

Run: `cd C:\Projects\acmi-app\nextjs-project && npm run build`
Expected: Compiled successfully, no type or lint errors.

- [ ] **Step 4: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/components/pricing/MsnInputRow.tsx
git commit -m "Term section: auto-calculated Duration field (days / months)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Hover popover, positioned at the cursor

**Files:**
- Rewrite: `src/components/pricing/CostDetailPopover.tsx`
- Modify: `src/components/pricing/SummaryTable.tsx`
- Modify: `src/components/pricing/PnlTable.tsx`

**Interfaces:**
- Produces: `LineDetailPopover` with props `{ title: string; monthLabel: string; items: BreakdownItem[]; params?: ParamItem[]; cursor: { x: number; y: number } }`. `BreakdownItem` / `ParamItem` exports unchanged. **No more `anchorRect` / `onClose` props.** Both consumers must be updated in this same task or the build breaks.

- [ ] **Step 1: Rewrite `CostDetailPopover.tsx`**

Replace the entire file content with:

```tsx
'use client'

import { useLayoutEffect, useRef } from 'react'
import { fmt } from '@/lib/format'

export interface BreakdownItem {
  label: string
  value: number
  formula?: string
}

export interface ParamItem {
  label: string
  value: number
  decimals?: number
}

interface LineDetailPopoverProps {
  title: string
  monthLabel: string
  items: BreakdownItem[]
  params?: ParamItem[]
  /** Cursor position (clientX/clientY) at hover start; the popover then
   *  follows the cursor itself via a document mousemove listener. */
  cursor: { x: number; y: number }
}

const OFFSET = 16 // px gap between cursor and popover
const MARGIN = 8 // px minimum distance from viewport edges

/**
 * Hover tooltip showing a cost line's build-up. Pointer-events are disabled so
 * it never traps the mouse; it repositions itself directly (no React state) on
 * every mousemove to avoid re-rendering the heavy parent tables, flipping
 * left/above the cursor near the right/bottom viewport edges.
 */
export function LineDetailPopover({
  title,
  monthLabel,
  items,
  params,
  cursor,
}: LineDetailPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const place = (x: number, y: number) => {
      const { width, height } = el.getBoundingClientRect()
      let left = x + OFFSET
      let top = y + OFFSET
      if (left + width > window.innerWidth - MARGIN) left = x - OFFSET - width
      if (top + height > window.innerHeight - MARGIN) top = y - OFFSET - height
      el.style.left = `${Math.max(MARGIN, left)}px`
      el.style.top = `${Math.max(MARGIN, top)}px`
    }
    place(cursor.x, cursor.y)
    const onMove = (e: MouseEvent) => place(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [cursor.x, cursor.y])

  const total = items.reduce((s, i) => s + i.value, 0)

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg shadow-xl w-[320px] text-xs pointer-events-none"
      style={{ top: cursor.y + OFFSET, left: cursor.x + OFFSET, background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      {/* Header */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>
          {title}
        </span>
      </div>

      {/* Month label */}
      <div className="px-3 py-1.5" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line-2)' }}>
        {monthLabel}
      </div>

      {/* Breakdown items */}
      <div className="px-3 py-2 space-y-1.5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--ink-2)' }}>{item.label}</span>
              <span className="av-num" style={{ color: 'var(--ink)' }}>{fmt(item.value, 0)}</span>
            </div>
            {item.formula && (
              <div className="text-[10px] av-num pl-2 mt-0.5" style={{ color: 'var(--muted)' }}>
                {item.formula}
              </div>
            )}
          </div>
        ))}

        <div
          className="pt-1.5 flex justify-between items-center font-semibold"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <span style={{ color: 'var(--ink)' }}>Total</span>
          <span className="av-num" style={{ color: 'var(--ink)' }}>{fmt(total, 0)}</span>
        </div>
      </div>

      {/* Parameters */}
      {params && params.length > 0 && (
        <div
          className="px-3 py-2 rounded-b-lg"
          style={{ borderTop: '1px solid var(--line)', background: 'var(--card-2)' }}
        >
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Parameters</div>
          <div className={`grid gap-2 text-[11px] ${params.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {params.map((p) => (
              <div key={p.label}>
                <span style={{ color: 'var(--muted)' }}>{p.label}</span>
                <span className="ml-1 av-num" style={{ color: 'var(--ink)' }}>
                  {fmt(p.value, p.decimals ?? 1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

(Removed: `X` icon, click-outside handler, Escape handler, `anchorRect`, `onClose`. Added: `cursor` prop, `pointer-events-none`, self-following placement with edge flipping.)

- [ ] **Step 2: Convert `SummaryTable.tsx` to hover**

Four edits:

**(a)** Change the drill state (~line 400) from:

```tsx
  const [drill, setDrill] = useState<{ cat: string; rect: DOMRect } | null>(null)
```

to:

```tsx
  const [drill, setDrill] = useState<{ cat: string; x: number; y: number } | null>(null)
```

**(b)** Cost lines rows (~line 1005) — replace:

```tsx
              {canViewCosts && costLines.map((r) => (
                <tr
                  key={r.n}
                  className="sub cursor-pointer"
                  onClick={r.drillKey ? (e) => setDrill({ cat: r.drillKey!, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }) : undefined}
                  title={r.drillKey ? 'Click to see the build-up' : undefined}
                >
```

with:

```tsx
              {canViewCosts && costLines.map((r) => (
                <tr
                  key={r.n}
                  className="sub"
                  onMouseEnter={r.drillKey ? (e) => setDrill({ cat: r.drillKey!, x: e.clientX, y: e.clientY }) : undefined}
                  onMouseLeave={r.drillKey ? () => setDrill(null) : undefined}
                >
```

**(c)** The ACMI cost row (~line 1024) and the Overhead row (~line 1052) — replace each row's opener:

```tsx
                <tr
                  className="total cursor-pointer"
                  onClick={(e) => setDrill({ cat: 'acmiCost', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                  title="Click to see the build-up"
                >
```

becomes:

```tsx
                <tr
                  className="total"
                  onMouseEnter={(e) => setDrill({ cat: 'acmiCost', x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setDrill(null)}
                >
```

and:

```tsx
                <tr
                  className="sub cursor-pointer"
                  onClick={(e) => setDrill({ cat: 'overhead', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                  title="Click to see the build-up"
                >
```

becomes:

```tsx
                <tr
                  className="sub"
                  onMouseEnter={(e) => setDrill({ cat: 'overhead', x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setDrill(null)}
                >
```

**(d)** The popover render at the bottom (~line 1102) — replace:

```tsx
      {drill && (() => {
        const cfg = buildDrill(drill.cat)
        if (!cfg) return null
        return (
          <LineDetailPopover
            title={cfg.title}
            monthLabel={`Per month${isPerBh ? ' · per BH' : ''}${currency === 'usd' ? ' · USD' : ''}`}
            items={cfg.items}
            anchorRect={drill.rect}
            onClose={() => setDrill(null)}
          />
        )
      })()}
```

with:

```tsx
      {drill && (() => {
        const cfg = buildDrill(drill.cat)
        if (!cfg) return null
        return (
          <LineDetailPopover
            title={cfg.title}
            monthLabel={`Per month${isPerBh ? ' · per BH' : ''}${currency === 'usd' ? ' · USD' : ''}`}
            items={cfg.items}
            cursor={{ x: drill.x, y: drill.y }}
          />
        )
      })()}
```

- [ ] **Step 3: Convert `PnlTable.tsx` to hover**

Four edits:

**(a)** Change `PopoverState` (~line 232) from:

```tsx
interface PopoverState {
  rowKey: string
  monthIndex: number
  anchorRect: DOMRect
}
```

to:

```tsx
interface PopoverState {
  rowKey: string
  monthIndex: number
  x: number
  y: number
}
```

**(b)** Remove the now-unused `closePopover` callback (~line 270): delete the line

```tsx
  const closePopover = useCallback(() => setPopover(null), [])
```

(`useCallback` stays imported — `toggleGroup` still uses it.)

**(c)** The clickable monthly cells (~line 745) — replace:

```tsx
                    {(vals ?? []).map((v, mi) => (
                      <td
                        key={mi}
                        className={`text-right px-3 py-1 av-num text-[var(--ink-2)] ${dataColWidth} ${valColor(v)} ${p.clickable ? 'cursor-pointer hover:underline hover:text-[var(--cyan-ink)]' : ''}`}
                        onClick={p.clickable ? (e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setPopover({ rowKey: p.key, monthIndex: mi, anchorRect: rect })
                        } : undefined}
                      >
                        {fmt(v, 0)}
                      </td>
                    ))}
```

with:

```tsx
                    {(vals ?? []).map((v, mi) => (
                      <td
                        key={mi}
                        className={`text-right px-3 py-1 av-num text-[var(--ink-2)] ${dataColWidth} ${valColor(v)} ${p.clickable ? 'hover:underline hover:text-[var(--cyan-ink)]' : ''}`}
                        onMouseEnter={p.clickable ? (e) => {
                          setPopover({ rowKey: p.key, monthIndex: mi, x: e.clientX, y: e.clientY })
                        } : undefined}
                        onMouseLeave={p.clickable ? () => setPopover(null) : undefined}
                      >
                        {fmt(v, 0)}
                      </td>
                    ))}
```

(The `hover:underline hover:text-[var(--cyan-ink)]` affordance stays so users can see which cells have detail; only `cursor-pointer` goes.)

**(d)** The popover render at the bottom (~line 886) — replace:

```tsx
        return (
          <LineDetailPopover
            title={cfg.title}
            monthLabel={months[popover.monthIndex]?.label ?? ''}
            items={cfg.items}
            params={cfg.params}
            anchorRect={popover.anchorRect}
            onClose={closePopover}
          />
        )
```

with:

```tsx
        return (
          <LineDetailPopover
            title={cfg.title}
            monthLabel={months[popover.monthIndex]?.label ?? ''}
            items={cfg.items}
            params={cfg.params}
            cursor={{ x: popover.x, y: popover.y }}
          />
        )
```

- [ ] **Step 4: Build**

Run: `cd C:\Projects\acmi-app\nextjs-project && npm run build`
Expected: Compiled successfully. In particular no unused-variable lint error (the `X` import and `closePopover` were removed along with their uses).

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/components/pricing/CostDetailPopover.tsx nextjs-project/src/components/pricing/SummaryTable.tsx nextjs-project/src/components/pricing/PnlTable.tsx
git commit -m "Cost breakdowns: hover popover following the cursor (was click-anchored)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Draft aircraft — engine loads on dropdown select

**Files:**
- Modify: `src/stores/pricing-store.ts`
- Rewrite: `src/components/pricing/hooks/useAddAircraft.ts`
- Modify: `src/components/pricing/DashboardSummary.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `MsnInput.isDraft?: boolean` (absent/false = committed); `useAddAircraft(aircraftList, msnInputs, bhFhRatio, apuFhRatio)` returns `{ draft: MsnInput | null; selectAircraft(aircraftId: string): number | null; discardDraft(): void; commitDraft(): void; availableAircraft: AircraftOption[] }`; exported pure `buildMsnInput(ac: AircraftOption, bhFhRatio: string, apuFhRatio: string): MsnInput`. Task 4 relies on `isDraft`.

- [ ] **Step 1: Add `isDraft` to `MsnInput`**

In `src/stores/pricing-store.ts`, inside the `MsnInput` interface, after the `fixedCostCoverageMonths: string` line (~line 78), add:

```ts
  // Draft: created when an aircraft is picked from the dropdown, before "Add
  // aircraft" commits it. Excluded from Total-Project aggregation and quote
  // snapshots until committed (isDraft set false).
  isDraft?: boolean
```

- [ ] **Step 2: Rewrite `useAddAircraft.ts`**

Replace the entire file content with:

```ts
import { useMemo, useCallback } from 'react'
import { usePricingStore } from '@/stores/pricing-store'
import type { MsnInput } from '@/stores/pricing-store'
import type { AircraftOption } from '@/lib/api-converters'

/** Build a fresh MsnInput from an aircraft's master data with pricing defaults. */
export function buildMsnInput(
  ac: AircraftOption,
  bhFhRatio: string,
  apuFhRatio: string,
): MsnInput {
  // Default: 1st of current month to last day of 12th month ahead
  const now = new Date()
  const startYear = now.getFullYear()
  const startMonth = now.getMonth() + 1 // 1-indexed
  const defaultStart = `${startYear}-${String(startMonth).padStart(2, '0')}-01`
  const endDate = new Date(startYear, startMonth - 1 + 12, 0) // last day of 12th month ahead
  const endYear = endDate.getFullYear()
  const endMonth = endDate.getMonth() + 1
  const endDay = endDate.getDate()
  const defaultEnd = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  return {
    aircraftId: ac.id,
    msn: ac.msn,
    aircraftType: ac.aircraft_type,
    registration: ac.registration,
    mgh: '350',
    cycleRatio: '1.0',
    environment: 'benign',
    periodStart: defaultStart,
    periodEnd: defaultEnd,
    leaseType: 'wet',
    crewSets: 4,
    rateCurrency: 'eur',
    acmiRate: '0',
    excessBh: '0',
    excessHourRate: '0',
    bhFhRatio: bhFhRatio,
    apuFhRatio: apuFhRatio,
    // Aircraft rates from Aircraft tab (EUR, fixed)
    leaseRentEur: ac.lease_rent_eur ?? '0',
    sixYearCheckEur: ac.six_year_check_eur ?? '0',
    twelveYearCheckEur: ac.twelve_year_check_eur ?? '0',
    ldgEur: ac.ldg_eur ?? '0',
    // Aircraft rates from Aircraft tab (USD, variable per engine)
    apuRateUsd: ac.apu_rate_usd ?? '0',
    llp1RateUsd: ac.llp1_rate_usd ?? '0',
    llp2RateUsd: ac.llp2_rate_usd ?? '0',
    // EPR matrix from Aircraft tab
    eprMatrix: (ac.epr_matrix ?? []).map((r) => ({
      cycleRatio: parseFloat(r.cycle_ratio),
      benignRate: parseFloat(r.benign_rate),
      hotRate: parseFloat(r.hot_rate),
    })),
    // Naked rates (present only for cost-access users + aircraft with naked data)
    hasNakedRates: Boolean(ac.has_naked_rates),
    nakedLeaseRentEur: ac.naked_lease_rent_eur ?? undefined,
    nakedSixYearCheckEur: ac.naked_six_year_check_eur ?? undefined,
    nakedTwelveYearCheckEur: ac.naked_twelve_year_check_eur ?? undefined,
    nakedLdgEur: ac.naked_ldg_eur ?? undefined,
    nakedApuRateUsd: ac.naked_apu_rate_usd ?? undefined,
    nakedLlp1RateUsd: ac.naked_llp1_rate_usd ?? undefined,
    nakedLlp2RateUsd: ac.naked_llp2_rate_usd ?? undefined,
    nakedEprMatrix: (ac.naked_epr_matrix ?? []).map((r) => ({
      cycleRatio: parseFloat(r.cycle_ratio),
      benignRate: parseFloat(r.benign_rate),
      hotRate: parseFloat(r.hot_rate),
    })),
    // Seasonality (off by default)
    seasonalityEnabled: false,
    // Fixed cost coverage (off by default)
    fixedCostCoverageEnabled: false,
    fixedCostCoveragePercent: '50',
    fixedCostCoverageMonths: '6',
  }
}

/**
 * Draft-aircraft selection logic.
 *
 * Selecting an aircraft from the dropdown immediately creates a *draft*
 * MsnInput (isDraft: true) so the pricing engine runs live and the user can
 * tune parameters. "Add aircraft" commits the draft into a permanent tab.
 * At most one draft exists at a time; selecting a different aircraft
 * replaces it.
 */
export function useAddAircraft(
  aircraftList: AircraftOption[],
  msnInputs: MsnInput[],
  bhFhRatio: string,
  apuFhRatio: string,
) {
  const { addMsnInput, removeMsnInput, patchMsnInput } = usePricingStore()

  const draft = useMemo(() => msnInputs.find((i) => i.isDraft) ?? null, [msnInputs])

  // Exclude committed MSNs only — the draft's aircraft stays listed so the
  // dropdown's value binding to it remains valid.
  const availableAircraft = useMemo(
    () => aircraftList.filter((ac) => !msnInputs.some((i) => !i.isDraft && i.msn === ac.msn)),
    [aircraftList, msnInputs],
  )

  /** Replace the current draft (if any) with a new draft for this aircraft.
   *  Returns the draft's MSN, or null when the id is unknown or the MSN is
   *  already committed. */
  const selectAircraft = useCallback((aircraftId: string): number | null => {
    const ac = aircraftList.find((a) => a.id === Number(aircraftId))
    if (!ac) return null
    if (msnInputs.some((i) => !i.isDraft && i.msn === ac.msn)) return null
    const current = msnInputs.find((i) => i.isDraft)
    if (current?.msn === ac.msn) return current.msn // same aircraft re-selected
    if (current) removeMsnInput(current.msn)
    addMsnInput({ ...buildMsnInput(ac, bhFhRatio, apuFhRatio), isDraft: true })
    return ac.msn
  }, [aircraftList, msnInputs, bhFhRatio, apuFhRatio, addMsnInput, removeMsnInput])

  /** Discard the current draft (dropdown returns to the placeholder). */
  const discardDraft = useCallback(() => {
    const current = msnInputs.find((i) => i.isDraft)
    if (current) removeMsnInput(current.msn)
  }, [msnInputs, removeMsnInput])

  /** Commit the draft: it becomes a permanent aircraft tab. */
  const commitDraft = useCallback(() => {
    const current = msnInputs.find((i) => i.isDraft)
    if (current) patchMsnInput(current.msn, { isDraft: false })
  }, [msnInputs, patchMsnInput])

  return { draft, selectAircraft, discardDraft, commitDraft, availableAircraft }
}
```

- [ ] **Step 3: Wire the draft flow into `DashboardSummary.tsx`**

Five edits:

**(a)** Add `setSelectedMsn` to the store destructure (~line 40):

```tsx
  const {
    projectName,
    exchangeRate,
    marginPercent,
    rateBasis,
    bhFhRatio,
    apuFhRatio,
    msnInputs,
    msnResults,
    isCalculating,
    lastError,
    removeMsnInput,
    updateMsnInput,
    setSelectedMsn,
    editingQuoteNumber,
    reset,
  } = usePricingStore()
```

**(b)** Replace the hook usage (~line 117):

```tsx
  // Aircraft addition logic
  const {
    selectedAircraft,
    setSelectedAircraft,
    handleAddAircraft,
    availableAircraft,
  } = useAddAircraft(aircraftList, msnInputs, bhFhRatio, apuFhRatio)
```

with:

```tsx
  // Draft-aircraft selection logic
  const {
    draft,
    selectAircraft,
    discardDraft,
    commitDraft,
    availableAircraft,
  } = useAddAircraft(aircraftList, msnInputs, bhFhRatio, apuFhRatio)
```

**(c)** Replace `handleAddAndSelect` (~line 135):

```tsx
  // Add an aircraft, then jump to its tab.
  function handleAddAndSelect() {
    const picked = availableAircraft.find((a) => String(a.id) === String(selectedAircraft))
    handleAddAircraft()
    if (picked) setActiveMsn(picked.msn)
  }
```

with:

```tsx
  // Selecting from the dropdown creates a live draft; jump to its tab and
  // point the results scope at it so the engine output shows immediately.
  function handleSelectAircraft(id: string) {
    if (!id) {
      discardDraft()
      return
    }
    const msn = selectAircraft(id)
    if (msn !== null) {
      setActiveMsn(msn)
      setSelectedMsn(msn)
    }
  }
```

**(d)** Draft-aware tab rendering — in the tabs map (~line 212), change the `className` line:

```tsx
              className={`av-ac-tab${active ? ' active' : ''}`}
```

to:

```tsx
              className={`av-ac-tab${active ? ' active' : ''}${input.isDraft ? ' draft' : ''}`}
```

and add a Draft badge after the aircraft-type span. Replace:

```tsx
              <span className="av-num">MSN {input.msn}</span>
              <span className="ty">{input.aircraftType}</span>
```

with:

```tsx
              <span className="av-num">MSN {input.msn}</span>
              <span className="ty">{input.aircraftType}</span>
              {input.isDraft && <span className="draft-badge">Draft</span>}
```

**(e)** Rewire the picker controls (~line 236). Replace:

```tsx
          <select
            value={selectedAircraft}
            onChange={(e) => setSelectedAircraft(e.target.value)}
            className="av-input !py-2"
          >
            <option value="">Select aircraft…</option>
            {availableAircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>
                MSN {ac.msn} · {ac.aircraft_type}
                {ac.registration ? ` (${ac.registration})` : ''}
              </option>
            ))}
          </select>
          <button onClick={handleAddAndSelect} disabled={!selectedAircraft} className="av-ac-add disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={14} />
            Add aircraft
          </button>
```

with:

```tsx
          <select
            value={draft ? String(draft.aircraftId) : ''}
            onChange={(e) => handleSelectAircraft(e.target.value)}
            className="av-input !py-2"
          >
            <option value="">Select aircraft…</option>
            {availableAircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>
                MSN {ac.msn} · {ac.aircraft_type}
                {ac.registration ? ` (${ac.registration})` : ''}
              </option>
            ))}
          </select>
          <button onClick={commitDraft} disabled={!draft} className="av-ac-add disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={14} />
            Add aircraft
          </button>
```

- [ ] **Step 4: Draft tab CSS**

In `src/app/globals.css`, directly after the `.av-ac-add:hover` rule (line ~317), add:

```css
/* draft aircraft tab — selected from the dropdown but not yet added */
.av-ac-tab.draft { border-style: dashed; border-color: var(--amber); }
.av-ac-tab.draft.active { background: var(--card); color: var(--ink-2); border-color: var(--amber); }
.av-ac-tab .draft-badge { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--amber); }
```

(The `.draft.active` override keeps the dashed amber identity visible instead of the solid navy active fill.)

- [ ] **Step 5: Build**

Run: `cd C:\Projects\acmi-app\nextjs-project && npm run build`
Expected: Compiled successfully. (`useState` may now be unused in `useAddAircraft.ts` — it was removed from the import list in the rewrite; verify no unused-import lint errors.)

- [ ] **Step 6: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/stores/pricing-store.ts nextjs-project/src/components/pricing/hooks/useAddAircraft.ts nextjs-project/src/components/pricing/DashboardSummary.tsx nextjs-project/src/app/globals.css
git commit -m "Workspace: dropdown selection creates a live draft aircraft; Add aircraft commits it

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Exclude drafts from Total Project, quote snapshots, and Save

**Files:**
- Modify: `src/components/pricing/SummaryTable.tsx`
- Modify: `src/components/pricing/PnlTable.tsx`
- Modify: `src/components/quotes/SaveQuoteDialog.tsx`
- Modify: `src/components/pricing/DashboardSummary.tsx`

**Interfaces:**
- Consumes: `MsnInput.isDraft` from Task 3.
- Produces: nothing new — behavioral change only.

- [ ] **Step 1: `SummaryTable.tsx` — filter drafts out of Total-Project aggregation**

Two edits:

**(a)** Find (~line 623):

```tsx
  // ── Total Project (all MSNs aggregated, with proration) — uses season filter ──
  const filteredMsnData = perMsnData.map(getFilteredMsn)

  const totalProjectDuration = numAc === 1
    ? filteredMsnData[0].duration
    : Math.max(...filteredMsnData.map((d) => d.duration))
```

Replace with:

```tsx
  // ── Total Project (all MSNs aggregated, with proration) — uses season filter ──
  // Drafts are excluded: they only appear in their own single-MSN scope until
  // committed via "Add aircraft".
  const draftMsnSet = new Set(msnInputs.filter((i) => i.isDraft).map((i) => i.msn))
  const filteredMsnData = perMsnData
    .filter((d) => !draftMsnSet.has(d.msn))
    .map(getFilteredMsn)

  const totalProjectDuration = filteredMsnData.length === 0
    ? 0
    : filteredMsnData.length === 1
      ? filteredMsnData[0].duration
      : Math.max(...filteredMsnData.map((d) => d.duration))
```

(Note the duration branch keys off `filteredMsnData.length`, not `numAc` — `numAc` counts the draft. `activeRaw`/`activeMsn` above stay on the unfiltered `perMsnData` so the draft's own scope still renders. All downstream total-view consumers — `totalMgh`, `totOf`, `totalAcmiWeighted`, `scopeParts`, `sensMgh` — already read `filteredMsnData` and reduce to 0/empty safely when it's empty.)

**(b)** No other edits: the empty-state guard `if (msnInputs.length === 0)` intentionally still counts the draft (a draft-only workspace shows the live tables, scoped to the draft).

- [ ] **Step 2: `PnlTable.tsx` — filter drafts out of the total-project view**

Three edits:

**(a)** After the `msnInputs` selector (~line 245: `const msnInputs = usePricingStore((s) => s.msnInputs)`), add:

```tsx
  // Total-project scope excludes drafts (uncommitted dropdown selections).
  const committedInputs = msnInputs.filter((i) => !i.isDraft)
```

**(b)** In the period-determination `else` branch (~line 327), replace:

```tsx
    // Total project view
    if (msnInputs.length > 0) {
      hasData = true
      // Period: earliest start to latest end across all MSNs (accounting for seasonality)
      const allPeriods = msnInputs.map(getEffectivePeriod)
      periodStart = allPeriods.reduce((min, p) => (p.start < min ? p.start : min), allPeriods[0].start)
      periodEnd = allPeriods.reduce((max, p) => (p.end > max ? p.end : max), allPeriods[0].end)
    }
```

with:

```tsx
    // Total project view — committed MSNs only
    if (msnInputs.length > 0) {
      hasData = true
      if (committedInputs.length > 0) {
        // Period: earliest start to latest end across all MSNs (accounting for seasonality)
        const allPeriods = committedInputs.map(getEffectivePeriod)
        periodStart = allPeriods.reduce((min, p) => (p.start < min ? p.start : min), allPeriods[0].start)
        periodEnd = allPeriods.reduce((max, p) => (p.end > max ? p.end : max), allPeriods[0].end)
      }
      // Draft-only: periodStart/periodEnd stay '' and the 12-month fallback
      // below produces an all-zero statement.
    }
```

**(c)** In the total-project computation loop (~line 377), replace:

```tsx
    for (const input of msnInputs) {
```

with:

```tsx
    for (const input of committedInputs) {
```

- [ ] **Step 3: `SaveQuoteDialog.tsx` — exclude drafts from snapshots**

Replace (~line 97):

```tsx
      // Build msn_snapshots array: combine msnInputs with matching msnResults
      const msn_snapshots = pricingState.msnInputs.map((input) => {
```

with:

```tsx
      // Build msn_snapshots array: combine msnInputs with matching msnResults.
      // Drafts (uncommitted dropdown selections) never enter a saved quote.
      const msn_snapshots = pricingState.msnInputs
        .filter((input) => !input.isDraft)
        .map((input) => {
```

(Keep the rest of the `.map()` body and its closing `})` unchanged.)

- [ ] **Step 4: `DashboardSummary.tsx` — disable Save without a committed aircraft**

**(a)** After the `activeInput` line (~line 142: `const activeInput = msnInputs.find((i) => i.msn === activeMsn) ?? null`), add:

```tsx
  // Save requires at least one committed (non-draft) aircraft.
  const committedCount = msnInputs.filter((i) => !i.isDraft).length
```

**(b)** Change the Save button's disabled condition (~line 200):

```tsx
              disabled={msnResults.length === 0}
```

to:

```tsx
              disabled={committedCount === 0 || msnResults.length === 0}
```

- [ ] **Step 5: Build**

Run: `cd C:\Projects\acmi-app\nextjs-project && npm run build`
Expected: Compiled successfully.

- [ ] **Step 6: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/components/pricing/SummaryTable.tsx nextjs-project/src/components/pricing/PnlTable.tsx nextjs-project/src/components/quotes/SaveQuoteDialog.tsx nextjs-project/src/components/pricing/DashboardSummary.tsx
git commit -m "Drafts: exclude from Total Project aggregation, quote snapshots, and Save gating

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: New Quote modal on the Quotes page

**Files:**
- Modify: `src/components/pricing/DashboardSummary.tsx`
- Modify: `src/components/quotes/SaveQuoteDialog.tsx`
- Create: `src/components/quotes/NewQuoteModal.tsx`
- Modify: `src/components/quotes/QuoteList.tsx`
- Modify: `src/app/(dashboard)/quotes/page.tsx`

**Interfaces:**
- Consumes: `DashboardSummary` props from Task 3/4 state; `AircraftOption` from `@/lib/api-converters`.
- Produces: `DashboardSummary` gains `onSaved?: (quoteNumber: string) => void`; `NewQuoteModal` with props `{ isOpen: boolean; onClose: () => void; onSaved: (quoteNumber: string) => void; aircraftList: AircraftOption[] }`; `QuoteList` gains `aircraftList?: AircraftOption[]`.

- [ ] **Step 1: `DashboardSummary.tsx` — add the `onSaved` prop**

**(a)** Extend the props interface (~line 18):

```tsx
interface DashboardSummaryProps {
  aircraftList: AircraftOption[]
  isViewer?: boolean
  /** Called after a quote is saved/updated — lets a hosting modal close + refresh. */
  onSaved?: (quoteNumber: string) => void
}
```

**(b)** Update the signature (~line 39):

```tsx
export function DashboardSummary({ aircraftList, isViewer = false, onSaved }: DashboardSummaryProps) {
```

**(c)** Forward it from the save dialog callback (~line 284):

```tsx
      <SaveQuoteDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSaved={(quoteNumber) => {
          setSavedNotice(quoteNumber)
          setTimeout(() => setSavedNotice(null), 5000)
          onSaved?.(quoteNumber)
        }}
      />
```

- [ ] **Step 2: `SaveQuoteDialog.tsx` — add a DOM marker for nested-dialog Escape handling**

Change the root overlay div (~line 150):

```tsx
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
```

to:

```tsx
    <div data-dialog="save-quote" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
```

(The New Quote modal's Escape handler checks this marker so Escape doesn't close the whole workspace while the save dialog is on top.)

- [ ] **Step 3: Create `src/components/quotes/NewQuoteModal.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { usePricingStore } from '@/stores/pricing-store'
import { DashboardSummary } from '@/components/pricing/DashboardSummary'
import type { AircraftOption } from '@/lib/api-converters'

interface NewQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the new quote number after a successful save. */
  onSaved: (quoteNumber: string) => void
  aircraftList: AircraftOption[]
}

/**
 * "New Quote" — the full Pricing Workspace in a centered overlay
 * (75vw × 80vh). Opens with a blank slate (store reset) each time.
 * Closes on ✕ or Escape only — no backdrop-click close, so half-entered
 * inputs aren't lost to a stray click.
 */
export function NewQuoteModal({ isOpen, onClose, onSaved, aircraftList }: NewQuoteModalProps) {
  // Fresh blank workspace on every open.
  useEffect(() => {
    if (isOpen) usePricingStore.getState().reset()
  }, [isOpen])

  // Close on Escape — unless the nested Save Quote dialog is on top.
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-dialog="save-quote"]')) return
      onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="av-panel flex flex-col overflow-hidden"
        style={{ width: '75vw', height: '80vh', boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}
      >
        {/* Header */}
        <div className="av-panel-h shrink-0">
          <h2>New Quote — Pricing Workspace</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Workspace body */}
        <div className="flex-1 overflow-y-auto p-[18px]">
          <DashboardSummary aircraftList={aircraftList} isViewer={false} onSaved={onSaved} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `QuoteList.tsx` — New Quote button + modal**

Four edits:

**(a)** Imports (~lines 3-8). Replace:

```tsx
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Search, Trash2 } from 'lucide-react'
```

with:

```tsx
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Trash2, Plus } from 'lucide-react'
import { NewQuoteModal } from './NewQuoteModal'
import type { AircraftOption } from '@/lib/api-converters'
```

**(b)** Props (~line 10):

```tsx
interface QuoteListProps {
  initialQuotes: { items: QuoteListItem[]; total: number }
  financials?: Record<number, { totalMgh: string | null; eurPerBh: string | null }>
  isViewer?: boolean
  aircraftList?: AircraftOption[]
}
```

and the signature (~line 28):

```tsx
export function QuoteList({ initialQuotes, financials = {}, isViewer = false, aircraftList = [] }: QuoteListProps) {
```

**(c)** State — after the `debounceRef` line (~line 37), add:

```tsx
  const [showNewQuote, setShowNewQuote] = useState(false)
  const router = useRouter()
```

**(d)** Header button — in the `av-panel-h` header, after the closing `</select>` of the status filter (~line 173), add:

```tsx
          {!isViewer && (
            <button
              type="button"
              onClick={() => setShowNewQuote(true)}
              className="av-btn av-btn-cyan !text-xs !py-1.5"
            >
              <Plus size={12} />
              New Quote
            </button>
          )}
```

**(e)** Modal — at the end of the component's root `<div className="space-y-4">`, after the closing `</div>` of the `av-panel` block (just before the root div's `</div>`), add:

```tsx
      <NewQuoteModal
        isOpen={showNewQuote}
        onClose={() => setShowNewQuote(false)}
        aircraftList={aircraftList}
        onSaved={() => {
          setShowNewQuote(false)
          // The list is client state seeded from a server prop — re-fetch it
          // directly, and refresh the route so server-computed financials update.
          fetchQuotes(search, statusFilter)
          router.refresh()
        }}
      />
```

- [ ] **Step 5: `quotes/page.tsx` — fetch and pass the aircraft list**

Three edits:

**(a)** Add the import (~line 4):

```tsx
import type { AircraftOption } from '@/lib/api-converters'
```

**(b)** Add the fetcher after `getUserRole` (~line 63):

```tsx
async function getAircraftList(token: string): Promise<AircraftOption[]> {
  try {
    const res = await fetch(`${API_URL}/aircraft`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
```

**(c)** Extend the fetch fan-out and prop pass (~line 69). Replace:

```tsx
  const [initialQuotes, role] = token
    ? await Promise.all([getQuotes(token), getUserRole(token)])
    : [{ items: [], total: 0 }, 'user']
```

with:

```tsx
  const [initialQuotes, role, aircraftList] = token
    ? await Promise.all([getQuotes(token), getUserRole(token), getAircraftList(token)])
    : [{ items: [], total: 0 }, 'user', [] as AircraftOption[]]
```

and the `<QuoteList>` render:

```tsx
      <QuoteList
        initialQuotes={initialQuotes}
        financials={financials}
        isViewer={role === 'viewer'}
        aircraftList={aircraftList}
      />
```

- [ ] **Step 6: Build**

Run: `cd C:\Projects\acmi-app\nextjs-project && npm run build`
Expected: Compiled successfully.

- [ ] **Step 7: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/components/pricing/DashboardSummary.tsx nextjs-project/src/components/quotes/SaveQuoteDialog.tsx nextjs-project/src/components/quotes/NewQuoteModal.tsx nextjs-project/src/components/quotes/QuoteList.tsx "nextjs-project/src/app/(dashboard)/quotes/page.tsx"
git commit -m "Quotes: New Quote button opens the Pricing Workspace in a 75vw x 80vh modal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Manual UI verification

**Files:** none (verification only)

- [ ] **Step 1: Start the app** (backend + frontend; see repo root — frontend: `npm run dev` in `nextjs-project`, FastAPI backend must be running for aircraft/quote data)

- [ ] **Step 2: Verify against this checklist**

1. **New Quote modal:** Quotes page shows a "New Quote" button (hidden for viewer role). Clicking opens a centered panel ~75% of viewport width, ~80% height, titled "New Quote — Pricing Workspace", with a blank workspace (no aircraft, empty project name). Escape and ✕ close it; clicking the dark backdrop does NOT. With the Save dialog open on top, Escape does not close the workspace modal. Saving a quote closes the modal and the new quote appears in the list.
2. **Draft aircraft:** In the workspace (modal or /calculation), picking an aircraft in the dropdown immediately creates a dashed amber tab with a "Draft" badge, opens its input editor, and the summary panel computes live. Changing the dropdown replaces the draft. Choosing "Select aircraft…" discards it. "Add aircraft" turns the tab solid (badge gone) and resets the dropdown. With one committed + one draft aircraft, the Total scope excludes the draft's numbers (compare Cost breakdown totals with and without the draft committed). "Save as Quote" is disabled when only a draft exists; a saved quote never contains the draft MSN.
3. **Hover popups:** On the Cost breakdown table, hovering Aircraft/Crew/Maintenance/Insurance/DOC/ACMI cost/Overhead rows shows the build-up popup next to the cursor, following it; moving off the row hides it. No click needed; ✕ is gone. Near the right/bottom screen edges the popup flips to the other side of the cursor. Same behavior on the P&L page's detail cells (e.g. Pilot Per Diem monthly cells).
4. **Duration:** In the Term section, with Start 2026-08-01 and End 2027-07-31 the Duration field reads `365 d / 12.0 mo`. Clearing a date shows `—`. Works on both Summer/Winter tabs when seasonality is on.

- [ ] **Step 3: Fix anything found, re-verify, commit fixes**
