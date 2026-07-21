# Pricing Workspace Redesign ("Ticket Deck") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the shared Pricing Workspace into the approved "Variant B ticket deck" layout: unified toolbar, horizontal 5-cluster input deck, slim verdict strip, waterfall+sensitivity charts row, fixed-column breakdown table.

**Architecture:** Pure presentation restructure of three components (`DashboardSummary`, `MsnInputRow`, `SummaryTable`) plus new `av-*` CSS in `globals.css`. All state, hooks, calculation, draft/save/gating logic is untouched — JSX and CSS only.

**Tech Stack:** Next.js 16 / React 19 client components, Tailwind 4 + custom `av-*` CSS variables system.

**Spec:** `docs/superpowers/specs/2026-07-21-workspace-redesign-design.md`
**Visual reference:** `design-mockups/workspace-redesign/variant-b.html` (open in browser; its `<style>` block is the geometry source)

## Global Constraints

- No changes to: `pricing-store.ts`, `useAddAircraft.ts`, `useCalculation.ts`, `SaveQuoteDialog.tsx`, `NewQuoteModal.tsx`, `CostDetailPopover.tsx`, any `lib/` file except none. Behavior tests: draft flow, save gating, hover popovers, cost-visibility gating must be untouched by construction (JSX moves, handlers stay identical).
- All new CSS uses `var(--*)` tokens only — dark mode must work with zero extra rules.
- Verification per task: `cd C:\Projects\acmi-app\nextjs-project && npm run build` → "Compiled successfully". No test runner exists.
- Duration display format changes to exactly `365d · 12.0mo` (days no space, `·` separator, months one decimal).
- All toolbar controls are 34px tall, radius 8. Deck fields 28px, deck sliders: 4px track / 13px thumb. Breakdown numeric columns: 132 / 148 / 92 / 62 px.
- Commit messages imperative + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- File paths relative to `C:\Projects\acmi-app\nextjs-project` unless noted.

---

### Task 1: CSS foundation (additive)

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: every `av-*` class Tasks 2–4 reference. Purely additive except the `.av-ac-tab` tightening (its only consumers are `DashboardSummary` tabs and `MsnSwitcher` — both look correct denser).

- [ ] **Step 1: Tighten `.av-ac-tab` to the unified 34px control geometry**

Replace:

```css
.av-ac-tab { display: flex; align-items: center; gap: 9px; padding: 9px 14px; border-radius: 10px; background: var(--card); border: 1px solid var(--line); font-size: 13px; font-weight: 600; color: var(--ink-2); transition: .15s; cursor: pointer; }
```

with:

```css
.av-ac-tab { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 13px; border-radius: 8px; background: var(--card); border: 1px solid var(--line); font-size: 12.5px; font-weight: 600; color: var(--ink-2); transition: .15s; cursor: pointer; }
```

- [ ] **Step 2: Append the ticket-deck class block**

At the end of `globals.css`, before the responsive section (`/* ============ Responsive ...`), add:

```css
/* ============================================================
   Ticket-deck workspace (2026-07 redesign — spec 2026-07-21,
   visual reference design-mockups/workspace-redesign/variant-b.html)
   ============================================================ */

/* toolbar — one row, every control 34px/r8 */
.av-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.av-toolbar .sp { flex: 1; }
.av-addgrp { display: inline-flex; align-items: stretch; height: 34px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--card-2); }
.av-addgrp select { border: 0; background: transparent; color: var(--ink); font-size: 12.5px; font-weight: 600; padding: 0 10px; outline: none; cursor: pointer; }
.av-addgrp button { border: 0; border-left: 1px solid var(--line); background: var(--card); color: var(--cyan-ink); font-weight: 700; font-size: 12.5px; padding: 0 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.av-addgrp button:disabled { color: var(--muted-2); cursor: not-allowed; }
.av-tb-rate { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700; color: var(--muted); }
.av-tb-rate input { width: 64px; height: 34px; border: 1px solid var(--line); border-radius: 8px; padding: 0 8px; background: var(--card-2); color: var(--ink); font-size: 12px; }

/* ticket deck — horizontal input band */
.av-deck { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.av-deck-grid { display: grid; grid-template-columns: minmax(150px, .8fr) 1.2fr 1.2fr 1fr 1.2fr; }
.av-cluster { padding: 12px 16px 14px; border-right: 1px solid var(--line-2); min-width: 0; }
.av-cluster:last-child { border-right: 0; }
.av-cluster-t { font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 800; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
.av-deck-seasons { display: flex; gap: 2px; padding: 6px 16px 0; border-bottom: 1px solid var(--line-2); }
.av-deck-seasons button { border: 0; background: none; padding: 6px 14px; font-size: 11.5px; font-weight: 700; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
.av-deck-seasons button.on { color: var(--cyan-ink); border-bottom-color: var(--cyan); }

/* compact slider field */
.av-sf label { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--ink-2); margin-bottom: 3px; }
.av-sf .chip { width: 58px; height: 20px; text-align: right; font-size: 12px; font-weight: 700; color: var(--cyan-ink); background: var(--cyan-soft); border: 0; border-radius: 5px; padding: 0 6px; outline: none; }
.av-sf input[type="range"] { width: 100%; -webkit-appearance: none; appearance: none; height: 4px; border-radius: 3px; background: var(--line); outline: none; margin: 0; }
.av-sf input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 13px; height: 13px; border-radius: 50%; background: var(--cyan); border: 2px solid var(--card); box-shadow: 0 1px 4px rgba(0,123,242,.4); cursor: pointer; }
.av-sf input[type="range"]::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; background: var(--cyan); border: 2px solid var(--card); cursor: pointer; }

/* compact labeled field */
.av-nf label { display: block; font-size: 9.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
.av-nf input, .av-nf select, .av-ro { width: 100%; height: 28px; border: 1px solid var(--line); border-radius: 7px; padding: 0 8px; background: var(--card-2); color: var(--ink); font-size: 12px; }
.av-nf input:focus, .av-nf select:focus { outline: none; border-color: var(--cyan); background: var(--card); box-shadow: 0 0 0 3px var(--cyan-soft); }
.av-ro { display: flex; align-items: center; background: var(--line-2); color: var(--ink-2); border-style: dashed; white-space: nowrap; overflow: hidden; }
.av-nf .av-seg { height: 28px; padding: 2px; }
.av-nf .av-seg button { padding: 0; font-size: 11px; }
.av-gd2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
.av-mt8 { margin-top: 8px; }

/* toggle chips (seasonality / FC coverage) */
.av-chip-t { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; border: 1px solid var(--line); color: var(--muted); cursor: pointer; background: none; white-space: nowrap; }
.av-chip-t.on { background: var(--cyan-soft); border-color: var(--cyan); color: var(--cyan-ink); }

/* verdict strip */
.av-strip { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); display: flex; align-items: stretch; overflow: hidden; flex-wrap: wrap; }
.av-strip .m { padding: 12px 20px; border-right: 1px solid var(--line-2); min-width: 170px; }
.av-strip .m .l { font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 800; display: flex; align-items: baseline; gap: 8px; }
.av-strip .m .v { font-size: 23px; font-weight: 800; letter-spacing: -.5px; margin-top: 3px; color: var(--brand); }
.dark .av-strip .m .v { color: var(--ink); }
.av-strip .m .v.pos { color: var(--pos); }
.av-strip .m .v.neg { color: var(--neg); }
.av-strip .m .s { font-size: 10.5px; color: var(--muted); margin-top: 1px; }
.av-strip .flag { flex: 1; display: flex; align-items: center; padding: 10px 20px; font-size: 12px; font-weight: 600; min-width: 220px; }
.av-strip .scope { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 8px 14px; border-left: 1px solid var(--line-2); background: var(--card-2); }
.av-strip .scope .av-seg { height: 26px; padding: 2px; }
.av-strip .scope .av-seg button { padding: 0 10px; flex: unset; font-size: 11px; }

/* charts row */
.av-duo { display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px; align-items: stretch; }

/* sensitivity rail */
.av-sens-rail { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; }
.av-sens-row { display: grid; grid-template-columns: 52px 1fr 64px; align-items: center; gap: 10px; border: 1px solid var(--line-2); border-radius: 8px; padding: 7px 10px; }
.av-sens-row.cur { border-color: var(--cyan); background: var(--cyan-soft); box-shadow: 0 0 0 1px var(--cyan); }
.av-sens-row .rr { font-size: 12px; font-weight: 700; color: var(--brand); }
.dark .av-sens-row .rr { color: var(--ink); }
.av-sens-row .bar { height: 6px; border-radius: 3px; background: var(--line-2); overflow: hidden; }
.av-sens-row .bar i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--cyan), #0056d6); }
.av-sens-row .mv { text-align: right; font-size: 12px; font-weight: 800; }
```

- [ ] **Step 3: Add responsive rules for the new layout**

Inside the existing `@media (max-width: 1024px)` block, add:

```css
  .av-deck-grid { grid-template-columns: 1fr 1fr; }
  .av-cluster { border-right: 0; border-bottom: 1px solid var(--line-2); }
  .av-duo { grid-template-columns: 1fr; }
```

Inside the existing `@media (max-width: 640px)` block, add:

```css
  .av-deck-grid { grid-template-columns: 1fr; }
  .av-strip { flex-direction: column; }
  .av-strip .m { border-right: 0; border-bottom: 1px solid var(--line-2); }
  .av-strip .scope { border-left: 0; flex-direction: row; }
```

- [ ] **Step 4: Build**

Run: `cd C:\Projects\acmi-app\nextjs-project && npm run build` — expected: Compiled successfully.

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/app/globals.css
git commit -m "Workspace redesign: ticket-deck CSS foundation (toolbar, deck, strip, rail)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: DashboardSummary — unified toolbar + column layout

**Files:**
- Modify: `src/components/pricing/DashboardSummary.tsx`

**Interfaces:**
- Consumes: Task 1 classes (`av-toolbar`, `av-addgrp`, `av-tb-rate`).
- Produces: the page skeleton Task 3/4 slot into: error strip → toolbar → deck region (full width) → results region (full width). `MsnInputRow` temporarily renders full-width with its old internals (transitional until Task 3).

- [ ] **Step 1: Pull `setExchangeRate` from the store**

In the store destructure, after `exchangeRate,` the fields already include everything needed; add `setExchangeRate,` after `updateMsnInput,`:

```tsx
    removeMsnInput,
    updateMsnInput,
    setExchangeRate,
    setSelectedMsn,
```

- [ ] **Step 2: Replace the action row + tabs block with the unified toolbar**

Replace everything from `{/* Action row */}` down to the end of the `{/* Aircraft tabs + add-aircraft picker */}` block (the `</div>` closing `av-ac-tabs`) with:

```tsx
      {/* Unified toolbar: tabs + add picker · rate + actions */}
      <div className="av-toolbar">
        {msnInputs.map((input) => {
          const active = input.msn === activeMsn
          const margin = marginByMsn.get(input.msn)
          const issues = msnIssues(input)
          return (
            <button
              key={input.msn}
              onClick={() => setActiveMsn(input.msn)}
              title={issues.length ? `Check inputs: ${issues.join(' · ')}` : undefined}
              className={`av-ac-tab${active ? ' active' : ''}${input.isDraft ? ' draft' : ''}`}
            >
              <span className="av-num">MSN {input.msn}</span>
              <span className="ty">{input.aircraftType}</span>
              {input.isDraft && <span className="draft-badge">Draft</span>}
              {issues.length > 0 ? (
                <AlertTriangle size={12} style={{ color: 'var(--amber)' }} />
              ) : margin !== undefined ? (
                <span className={`av-num ty ${margin >= 0 ? 'av-pos' : 'av-neg'}`}>
                  {margin >= 0 ? '+' : ''}{(margin * 100).toFixed(1)}%
                </span>
              ) : null}
            </button>
          )
        })}
        <span className="av-addgrp">
          <select
            value={draft ? String(draft.aircraftId) : ''}
            onChange={(e) => handleSelectAircraft(e.target.value)}
            aria-label="Select aircraft"
          >
            <option value="">Select aircraft…</option>
            {availableAircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>
                MSN {ac.msn} · {ac.aircraft_type}
                {ac.registration ? ` (${ac.registration})` : ''}
              </option>
            ))}
          </select>
          <button onClick={commitDraft} disabled={!draft}>
            <Plus size={13} />
            Add
          </button>
        </span>

        <span className="sp" />

        <span className="flex items-center gap-3 text-xs">
          {isCalculating && <span style={{ color: 'var(--cyan-ink)' }}>Calculating…</span>}
          {isEditing && (
            <span className="px-2 py-1 rounded-md av-num" style={{ color: 'var(--cyan-ink)', background: 'var(--cyan-soft)' }}>
              Editing {editingQuoteNumber}
            </span>
          )}
          {savedNotice && <span style={{ color: 'var(--pos)' }}>Saved: {savedNotice}</span>}
        </span>

        <label className="av-tb-rate">
          USD/EUR
          <input
            type="number"
            step="0.0001"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            readOnly={isViewer}
            tabIndex={isViewer ? -1 : undefined}
            className="av-num"
          />
        </label>
        {isEditing && !isViewer && (
          <button onClick={() => reset()} className="av-btn av-btn-ghost !text-xs !h-[34px] !py-0">
            New quote
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={committedCount === 0 || isExporting}
          title="Download the calculation as an Excel workbook (Calculation, P&L, Aircraft, Crew, Costs)"
          className="av-btn av-btn-ghost !text-xs !h-[34px] !py-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={12} />
          {isExporting ? 'Preparing…' : 'Excel'}
        </button>
        {!isViewer && (
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={committedCount === 0 || msnResults.length === 0}
            className="av-btn av-btn-cyan !text-xs !h-[34px] !py-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={12} />
            {isEditing ? 'Update Quote' : 'Save as Quote'}
          </button>
        )}
      </div>
```

(The `exchangeRate` value is already destructured. Note the toolbar absorbs: calculating hint, editing badge, saved notice, New quote, Excel, Save — the entire old action row. The old action row markup must be deleted, not left duplicated.)

- [ ] **Step 3: Replace the work grid with a column flow**

Replace:

```tsx
      {/* Work grid: inputs (left) · live results (right) */}
      <div className="av-work-grid">
        <div className="av-panel overflow-hidden">
          {activeInput ? (
            <MsnInputRow
              key={activeInput.msn}
              input={activeInput}
              onUpdate={updateMsnInput}
              onRemove={removeMsnInput}
              aircraftList={aircraftList}
              usedMsns={msnInputs.map((i) => i.msn)}
            />
          ) : (
            <p className="text-xs text-center py-10" style={{ color: 'var(--muted)' }}>
              No aircraft added yet. Select an aircraft above to begin pricing.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <SummaryTable aircraftList={aircraftList} editable={!isViewer} />
        </div>
      </div>
```

with:

```tsx
      {/* Ticket deck (inputs, full width) above live results */}
      {activeInput ? (
        <MsnInputRow
          key={activeInput.msn}
          input={activeInput}
          onUpdate={updateMsnInput}
          onRemove={removeMsnInput}
          aircraftList={aircraftList}
          usedMsns={msnInputs.map((i) => i.msn)}
        />
      ) : (
        <div className="av-panel">
          <p className="text-xs text-center py-10" style={{ color: 'var(--muted)' }}>
            No aircraft added yet. Select an aircraft above to begin pricing.
          </p>
        </div>
      )}

      <div className="min-w-0">
        <SummaryTable aircraftList={aircraftList} editable={!isViewer} />
      </div>
```

- [ ] **Step 4: Build** — `npm run build` → Compiled successfully. (Transitional look is expected: old editor internals full-width until Task 3.)

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/components/pricing/DashboardSummary.tsx
git commit -m "Workspace redesign: unified toolbar (tabs + fused add + rate + actions), column layout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: MsnInputRow — the ticket deck

**Files:**
- Rewrite: `src/components/pricing/MsnInputRow.tsx`

**Interfaces:**
- Consumes: Task 1 deck classes; unchanged props `{ input, onUpdate, onRemove, aircraftList, usedMsns }`; store actions `swapMsnAircraft`, `toggleSeasonality`, `updateSeasonInput` (unchanged signatures).
- Produces: `av-deck` full-width band. Duration format `365d · 12.0mo`.

- [ ] **Step 1: Replace the entire file** with:

```tsx
'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { X, RefreshCw } from 'lucide-react'
import type { MsnInput, SeasonInput } from '@/stores/pricing-store'
import { usePricingStore } from '@/stores/pricing-store'
import type { AircraftOption } from '@/lib/api-converters'

interface MsnInputRowProps {
  input: MsnInput
  onUpdate: (msn: number, field: keyof MsnInput, value: string | number | boolean) => void
  onRemove: (msn: number) => void
  aircraftList: AircraftOption[]
  usedMsns: number[]
}

/** Compact slider: 18px label row (name + editable value chip + optional inline seg) over a thin track. */
function Sf({
  label,
  value,
  min,
  max,
  step,
  onChange,
  extra,
}: {
  label: string
  value: string | number
  min: number
  max: number
  step: number
  onChange: (v: string) => void
  extra?: ReactNode
}) {
  const v = String(value)
  return (
    <div className="av-sf">
      <label>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{label}{extra}</span>
        <input type="number" step={step} value={v} onChange={(e) => onChange(e.target.value)} className="chip av-num" />
      </label>
      <input type="range" min={min} max={max} step={step} value={Number(v) || 0} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** Compact labeled field (number or date). */
function Nf({
  label,
  value,
  step = '0.01',
  type = 'number',
  onChange,
}: {
  label: string
  value: string
  step?: string
  type?: 'number' | 'date'
  onChange: (v: string) => void
}) {
  return (
    <div className="av-nf">
      <label>{label}</label>
      <input type={type} step={type === 'number' ? step : undefined} value={value} onChange={(e) => onChange(e.target.value)} className="av-num" />
    </div>
  )
}

/** Compact segmented control under an av-nf label. */
function Sg({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="av-nf">
      <label>{label}</label>
      <div className="av-seg">
        {options.map((o) => (
          <button key={o.value} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Tiny inline segmented toggle for slider label rows. */
function MiniSeg({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <span className="av-seg" style={{ height: 18, padding: 2, flex: 'unset' }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          style={{ padding: '0 6px', fontSize: 9.5 }}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

const ENV_OPTS = [
  { value: 'benign', label: 'Benign' },
  { value: 'hot', label: 'Hot' },
]
const LEASE_OPTS = [
  { value: 'wet', label: 'Wet' },
  { value: 'damp', label: 'Damp' },
  { value: 'moist', label: 'Moist' },
]
const MGH_MODE_OPTS = [
  { value: 'month', label: '/mo' },
  { value: 'period', label: '/per' },
]
const CURRENCY_OPTS = [
  { value: 'eur', label: 'EUR' },
  { value: 'usd', label: 'USD' },
]

function startDateValue(v: string | null | undefined) {
  if (!v) return ''
  return v.length === 7 ? `${v}-01` : v
}
function endDateValue(v: string | null | undefined) {
  if (!v) return ''
  if (v.length > 7) return v
  const [y, m] = v.split('-').map(Number)
  if (!y || !m) return v
  const lastDay = new Date(y, m, 0).getDate()
  return `${v}-${String(lastDay).padStart(2, '0')}`
}

/** Human-readable term length, e.g. "365d · 12.0mo". Em dash when dates are
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
  return `${days}d · ${months.toFixed(1)}mo`
}

/** Utilisation / Rate / Term clusters for one season (or the flat case). */
function SeasonClusters({
  data,
  currencyLabel,
  rateCurrency,
  onCurrencyChange,
  mghMode,
  onMghModeChange,
  onChange,
}: {
  data: SeasonInput
  currencyLabel: string
  rateCurrency: string
  onCurrencyChange: (v: string) => void
  mghMode: 'month' | 'period'
  onMghModeChange: (v: string) => void
  onChange: (field: keyof SeasonInput, value: string | number) => void
}) {
  const isPeriod = mghMode === 'period'
  return (
    <>
      <div className="av-cluster">
        <div className="av-cluster-t">Utilisation</div>
        <Sf
          label={isPeriod ? 'Guaranteed BH (period)' : 'Min guaranteed hours'}
          value={data.mgh}
          min={0}
          max={isPeriod ? 5000 : 700}
          step={5}
          onChange={(v) => onChange('mgh', v)}
          extra={<MiniSeg value={mghMode} options={MGH_MODE_OPTS} onChange={onMghModeChange} />}
        />
        <div className="av-gd2 av-mt8">
          <Nf label="Excess hours" value={String(data.excessBh)} onChange={(v) => onChange('excessBh', v)} />
          <Nf label="FH : FC" value={String(data.cycleRatio)} step="0.05" onChange={(v) => onChange('cycleRatio', v)} />
        </div>
      </div>

      <div className="av-cluster">
        <div className="av-cluster-t">Rate</div>
        <Sf
          label={`ACMI rate · ${currencyLabel}/BH`}
          value={data.acmiRate}
          min={0}
          max={8000}
          step={25}
          onChange={(v) => onChange('acmiRate', v)}
          extra={<MiniSeg value={rateCurrency} options={CURRENCY_OPTS} onChange={onCurrencyChange} />}
        />
        <div className="av-gd2 av-mt8">
          <Nf label={`Excess rate (${currencyLabel})`} value={String(data.excessHourRate)} onChange={(v) => onChange('excessHourRate', v)} />
          <div />
        </div>
      </div>

      <div className="av-cluster">
        <div className="av-cluster-t">Term</div>
        <div className="av-gd2">
          <Nf label="Start" type="date" value={startDateValue(data.periodStart)} onChange={(v) => onChange('periodStart', v)} />
          <Nf label="End" type="date" value={endDateValue(data.periodEnd)} onChange={(v) => onChange('periodEnd', v)} />
        </div>
        <div className="av-nf av-mt8">
          <label>Duration</label>
          <div className="av-ro av-num">{durationText(data.periodStart, data.periodEnd)}</div>
        </div>
      </div>
    </>
  )
}

export function MsnInputRow({ input, onUpdate, onRemove, aircraftList, usedMsns }: MsnInputRowProps) {
  const [showSwap, setShowSwap] = useState(false)
  const [activeTab, setActiveTab] = useState<'summer' | 'winter'>('summer')
  const { swapMsnAircraft, toggleSeasonality, updateSeasonInput } = usePricingStore()

  const swapOptions = aircraftList.filter((ac) => ac.msn === input.msn || !usedMsns.includes(ac.msn))
  const currencyLabel = input.rateCurrency?.toUpperCase() || 'EUR'

  const handleSwap = (aircraftId: string) => {
    const ac = aircraftList.find((a) => a.id === Number(aircraftId))
    if (!ac || ac.msn === input.msn) {
      setShowSwap(false)
      return
    }
    swapMsnAircraft(input.msn, {
      aircraftId: ac.id,
      msn: ac.msn,
      aircraftType: ac.aircraft_type,
      registration: ac.registration,
      leaseRentEur: ac.lease_rent_eur ?? '0',
      sixYearCheckEur: ac.six_year_check_eur ?? '0',
      twelveYearCheckEur: ac.twelve_year_check_eur ?? '0',
      ldgEur: ac.ldg_eur ?? '0',
      apuRateUsd: ac.apu_rate_usd ?? '0',
      llp1RateUsd: ac.llp1_rate_usd ?? '0',
      llp2RateUsd: ac.llp2_rate_usd ?? '0',
      eprMatrix: (ac.epr_matrix ?? []).map((r) => ({
        cycleRatio: parseFloat(r.cycle_ratio),
        benignRate: parseFloat(r.benign_rate),
        hotRate: parseFloat(r.hot_rate),
      })),
    })
    setShowSwap(false)
  }

  const seasonal = input.seasonalityEnabled && input.summer && input.winter
  const seasonData = seasonal ? (activeTab === 'summer' ? input.summer! : input.winter!) : (input as unknown as SeasonInput)
  const onSeasonChange = seasonal
    ? (field: keyof SeasonInput, value: string | number) => updateSeasonInput(input.msn, activeTab, field, value)
    : (field: keyof SeasonInput, value: string | number) => onUpdate(input.msn, field as keyof MsnInput, value)

  return (
    <div className="av-deck">
      {seasonal && (
        <div className="av-deck-seasons">
          <button className={activeTab === 'summer' ? 'on' : ''} onClick={() => setActiveTab('summer')}>Summer</button>
          <button className={activeTab === 'winter' ? 'on' : ''} onClick={() => setActiveTab('winter')}>Winter</button>
        </div>
      )}
      <div className="av-deck-grid">
        {/* ── Aircraft meta ── */}
        <div className="av-cluster">
          <div className="av-cluster-t">
            Aircraft
            <button onClick={() => onRemove(input.msn)} aria-label={`Remove MSN ${input.msn}`} style={{ color: 'var(--muted)', background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>MSN {input.msn}</span>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-2)' }}>{input.aircraftType}</span>
            {input.registration && <span className="text-[10.5px]" style={{ color: 'var(--muted)' }}>({input.registration})</span>}
            {showSwap ? (
              <select
                autoFocus
                defaultValue={String(input.aircraftId)}
                onChange={(e) => handleSwap(e.target.value)}
                onBlur={() => setShowSwap(false)}
                className="av-input !py-0.5 !text-[11px]"
              >
                {swapOptions.map((ac) => (
                  <option key={ac.id} value={ac.id}>
                    MSN {ac.msn} - {ac.aircraft_type}{ac.registration ? ` (${ac.registration})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <button onClick={() => setShowSwap(true)} className="p-0.5 rounded transition-colors" style={{ color: 'var(--muted)', background: 'none', border: 0, cursor: 'pointer' }} aria-label="Change aircraft" title="Change aircraft">
                <RefreshCw size={11} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 av-mt8" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`av-chip-t${input.seasonalityEnabled ? ' on' : ''}`}
              onClick={() => toggleSeasonality(input.msn, !input.seasonalityEnabled)}
            >
              Seasonality
            </button>
            <button
              type="button"
              className={`av-chip-t${input.fixedCostCoverageEnabled ? ' on' : ''}`}
              onClick={() => onUpdate(input.msn, 'fixedCostCoverageEnabled', !input.fixedCostCoverageEnabled)}
            >
              FC Coverage
            </button>
          </div>
        </div>

        {/* ── Utilisation / Rate / Term (season-scoped when seasonality on) ── */}
        <SeasonClusters
          data={seasonData}
          currencyLabel={currencyLabel}
          rateCurrency={input.rateCurrency ?? 'eur'}
          onCurrencyChange={(v) => onUpdate(input.msn, 'rateCurrency', v)}
          mghMode={input.mghMode ?? 'month'}
          onMghModeChange={(v) => onUpdate(input.msn, 'mghMode', v)}
          onChange={onSeasonChange}
        />

        {/* ── Operation (shared across seasons) ── */}
        <div className="av-cluster">
          <div className="av-cluster-t">Operation</div>
          <Sf label="Crew sets" value={input.crewSets} min={0.5} max={8} step={0.5} onChange={(v) => onUpdate(input.msn, 'crewSets', parseFloat(v) || 1)} />
          <div className="av-gd2 av-mt8">
            <Sg label="Environment" value={input.environment} options={ENV_OPTS} onChange={(v) => onUpdate(input.msn, 'environment', v)} />
            <Sg label="Lease type" value={input.leaseType} options={LEASE_OPTS} onChange={(v) => onUpdate(input.msn, 'leaseType', v)} />
          </div>
          {input.fixedCostCoverageEnabled && (
            <div className="av-gd2 av-mt8">
              <Nf label="Coverage %" value={String(input.fixedCostCoveragePercent)} step="1" onChange={(v) => onUpdate(input.msn, 'fixedCostCoveragePercent', v)} />
              <Nf label="Coverage months" value={String(input.fixedCostCoverageMonths)} step="1" onChange={(v) => onUpdate(input.msn, 'fixedCostCoverageMonths', v)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

(Behavior preserved: same store actions, same seasonal virtual-input flow — `SeasonClusters` binds to summer/winter via `updateSeasonInput` exactly like the old `RateControls`; the flat case routes to `onUpdate` with the same field names. The old checkbox toggles become `av-chip-t` buttons with identical handlers.)

- [ ] **Step 2: Build** — `npm run build` → Compiled successfully. Watch for unused-import lint (old file's imports all still used except none — verify).

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/components/pricing/MsnInputRow.tsx
git commit -m "Workspace redesign: MsnInputRow becomes the horizontal ticket deck

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: SummaryTable — verdict strip, charts row, fixed-column table

**Files:**
- Modify: `src/components/pricing/SummaryTable.tsx`

**Interfaces:**
- Consumes: Task 1 classes (`av-strip`, `av-duo`, `av-sens-rail`); all existing computed values (`mNetProfit`, `netMargin`, `flag`, `wfBars`, `sens`, `costLines`, etc. — unchanged).
- Produces: nothing new for later tasks. Old exchange-rate input and standalone controls panel REMOVED (toolbar owns the rate since Task 2).

- [ ] **Step 1: Remove the scope/display controls panel**

Delete the entire first panel block — from `{/* ── Scope + display controls ── */}` through its closing `</div>` (the block containing the Total/MSN seg, season filter, USD/EUR input, currency seg, and basis seg). The scope/basis segs reappear in the strip (Step 2), the season filter in the waterfall header (Step 3), currency seg in the strip scope box, and the rate input already lives in the toolbar.

- [ ] **Step 2: Replace the verdict panel with the strip**

Replace the entire `{/* ── Verdict ── */}` panel block with:

```tsx
      {/* ── Verdict strip ── */}
      <div className="av-strip">
        {canViewCosts && (
          <div className="m">
            <div className="l">
              <span className="whitespace-nowrap">Net profit · mo</span>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                readOnly={!editable}
                placeholder="Untitled project"
                className="av-num bg-transparent border-0 p-0 focus:outline-none font-semibold normal-case tracking-normal"
                style={{ color: 'var(--ink-2)', fontSize: 11, minWidth: 0, flex: '1 1 auto', letterSpacing: 0 }}
                title="Project name"
              />
            </div>
            <div className={`v av-num${mNetProfit < 0 ? ' neg' : ' pos'}`}>{fmt(cur(mNetProfit), 0)} {bdUnit}</div>
            <div className="s av-num">
              {periodMonths > 0
                ? `${fmt(cur(projectNet), 0)} over ${periodMonths}-mo term`
                : 'Set a contract term to see project total'}
            </div>
          </div>
        )}
        {canViewCosts && (
          <div className="m">
            <div className="l">Net margin</div>
            <div className="v av-num" style={{ color: marginTone(netMargin) }}>{(netMargin * 100).toFixed(1)}%</div>
            <div className="s av-num">GP margin {(gpMargin * 100).toFixed(1)}%</div>
          </div>
        )}
        <div className="m">
          <div className="l">Revenue · mo</div>
          <div className="v av-num">{fmt(cur(mRevenue), 0)} {bdUnit}</div>
          <div className="s av-num">{fmt(mBhActual, 0)} BH · {fmt(mFc, 0)} cycles</div>
        </div>
        {canViewCosts && <div className={`flag ${flag.cls}`}>{flag.text}</div>}
        <div className="scope">
          <div className="av-seg">
            <button className={selectedMsn === null ? 'on' : ''} onClick={() => setSelectedMsn(null)}>Total</button>
            {msnInputs.map((input) => (
              <button key={input.msn} className={selectedMsn === input.msn ? 'on' : ''} onClick={() => setSelectedMsn(input.msn)}>
                <span className="av-num">{input.msn}</span>
              </button>
            ))}
          </div>
          <div className="av-seg">
            {(['eur', 'usd'] as const).map((c) => (
              <button key={c} className={currency === c ? 'on' : ''} onClick={() => setCurrency(c)}>{c.toUpperCase()}</button>
            ))}
            {canViewNaked && (['current', 'naked'] as const).map((b) => (
              <button key={b} className={rateBasis === b ? 'on' : ''} onClick={() => setRateBasis(b)} style={{ textTransform: 'capitalize' }}>{b}</button>
            ))}
          </div>
        </div>
      </div>
```

Note: the `av-vf-good/thin/loss` classes style the `flag` cell's colors — they set `background`/`color` and compose with `.av-strip .flag` layout. The store destructure keeps `projectName`, `setProjectName`, `setExchangeRate` is now UNUSED here — remove `setExchangeRate` (and `globalExchangeRate` stays, it feeds `exchangeRate` parsing).

- [ ] **Step 3: Wrap waterfall + sensitivity in the duo grid, move the season filter**

Replace the waterfall panel block and the standalone sensitivity panel block (currently separated by the cost-breakdown panel — REORDER: duo goes immediately after the strip, breakdown after the duo) with:

```tsx
      {/* ── Charts: waterfall + sensitivity rail side by side ── */}
      {canViewCosts && (
        <div className="av-duo">
          <div className="av-panel">
            <div className="av-panel-h">
              <h2>ACMI cost build-up · monthly</h2>
              <span className="flex items-center gap-2">
                {msnInputs.some((i) => i.seasonalityEnabled) && (
                  <span className="av-seg" style={{ flex: 'unset', height: 24, padding: 2 }}>
                    {(['total', 'summer', 'winter'] as const).map((f) => (
                      <button key={f} className={seasonFilter === f ? 'on' : ''} onClick={() => setSeasonFilter(f)} style={{ padding: '0 10px', fontSize: 10.5 }}>
                        {f === 'total' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </span>
                )}
                <span className="av-hint">Revenue → cost stack → net</span>
              </span>
            </div>
            <div className="av-wf">
              {wfBars.map((s, i) => (
                <div className="av-wf-col" key={i}>
                  <div
                    className={`av-wf-bar ${s.cls}${s.neg ? ' isneg' : ''}`}
                    style={{ height: `${s.barH}%`, marginBottom: `${s.floatBottom}%` }}
                  >
                    <span className="av-wf-val av-num">{compact(s.v)}</span>
                  </div>
                  <div className="av-wf-lab">{s.lab}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="av-panel">
            <div className="av-panel-h">
              <h2>Rate sensitivity</h2>
              <span className="av-hint">net margin @ ±150/BH</span>
            </div>
            <div className="av-sens-rail">
              {(() => {
                const maxM = Math.max(...sens.map((s) => s.m), 0.001)
                return sens.map((s, i) => (
                  <div className={`av-sens-row${s.cur ? ' cur' : ''}`} key={i}>
                    <span className="rr av-num">{fmt(s.rate, 0)}</span>
                    <span className="bar"><i style={{ width: `${Math.max(0, (s.m / maxM) * 100)}%` }} /></span>
                    <span className="mv av-num" style={{ color: marginTone(s.m) }}>{(s.m * 100).toFixed(0)}%</span>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
```

Then update the waterfall geometry classes in `globals.css` (same task, same commit) — replace the `/* waterfall */` block's first two rules:

```css
.av-wf { display: flex; align-items: flex-end; gap: 14px; height: 172px; padding: 30px 18px 0; margin: 0 0 12px; position: relative; }
.av-wf-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; position: relative; min-width: 0; z-index: 1; }
```

and change `.av-wf-bar { … max-width: 64px; … }` to `max-width: 46px;` and `border-radius: 5px 5px 0 0` to `4px 4px 0 0`, and add after the `.av-wf` rule:

```css
.av-wf::before { content: ""; position: absolute; left: 18px; right: 18px; top: 33%; height: 1px; background: var(--line-2); }
.av-wf::after { content: ""; position: absolute; left: 18px; right: 18px; bottom: 26px; height: 1px; background: var(--line); }
```

(The `::after` acts as the baseline above the label row; `av-wf-lab` stays.)

- [ ] **Step 4: Fix the breakdown table columns**

In the cost-breakdown panel, add a `<colgroup>` immediately after `<table className="av-bd-tbl">`:

```tsx
            <colgroup>
              <col />
              <col style={{ width: 132 }} />
              <col style={{ width: 148 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 62 }} />
            </colgroup>
```

and in `globals.css` update the `.av-bd-tbl` block:

```css
.av-bd-tbl { width: 100%; border-collapse: collapse; table-layout: fixed; }
.av-bd-tbl td { padding: 8px 14px; font-size: 12.5px; border-bottom: 1px solid var(--line-2); }
.av-bd-tbl td.r { text-align: right; font-weight: 600; }
.av-bd-tbl td.pct { text-align: right; color: var(--muted); font-size: 11px; }
.av-bd-tbl tr.head td { font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 800; background: var(--card-2); white-space: nowrap; padding: 7px 14px; }
.av-bd-tbl tr.total td { font-weight: 800; color: var(--brand); border-top: 1.5px solid var(--line); background: var(--card-2); }
.dark .av-bd-tbl tr.total td { color: var(--ink); }
.av-bd-tbl tr.sub td:first-child { padding-left: 30px; color: var(--ink-2); }
.av-bd-tbl .cat { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
.av-bd-tbl .cat .sw { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
```

Also change the header row's `% REV` cell content from `% rev` (line-wrapped in the old narrow col) — it stays `% rev` but no longer wraps thanks to `white-space: nowrap`.

- [ ] **Step 5: Build** — `npm run build` → Compiled successfully. Lint: `setExchangeRate` no longer destructured in SummaryTable; the old `wfSteps`→`wfBars` computation and all other logic untouched.

- [ ] **Step 6: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/components/pricing/SummaryTable.tsx nextjs-project/src/app/globals.css
git commit -m "Workspace redesign: verdict strip, charts duo (waterfall + sensitivity rail), fixed-column breakdown

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: CSS cleanup + responsive sweep

**Files:**
- Modify: `src/app/globals.css`, possibly none else.

- [ ] **Step 1: Grep for superseded class usage**

For each of: `av-work-grid`, `av-ac-add`, `av-verdict-top`, `av-vcell`, `av-verdict-flag` (bare — `av-vf-*` STAY, the strip flag uses them), `av-sens-grid`, `av-sens-cell`, `av-in-sec`, `av-in-sec-t`, `av-field-row`, `av-slider`, `av-proj-bar`, `av-pb-field`:

Run: `cd C:\Projects\acmi-app\nextjs-project && grep -rn "<class>" src/ --include="*.tsx" --include="*.ts"`

Delete from `globals.css` ONLY the classes with zero `.tsx` hits. Expected removable after Tasks 2–4: `av-work-grid`, `av-ac-add`, `av-verdict-top`, `av-vcell`, `av-sens-grid`, `av-sens-cell`, `av-in-sec`, `av-in-sec-t`, `av-slider` — but the grep is authoritative, not this list (`av-field`/`av-input` are used by Crew/Costs/Aircraft pages — keep; `av-verdict-flag` keep if the strip flag JSX still references it, else fold its padding into `.av-strip .flag`). Also delete the now-dead responsive references to removed classes inside the two media queries (e.g. `.av-work-grid { grid-template-columns: 1fr; }`).

- [ ] **Step 2: Re-run the design-sync CSS build** (keeps the synced DS stylesheet current)

Run: `cd C:\Projects\acmi-app && bash .design-sync/build-css.sh` — expected: `wrote nextjs-project/.ds-css/acmi.css`. (No upload — next `/design-sync` picks it up.)

- [ ] **Step 3: Build** — `npm run build` → Compiled successfully.

- [ ] **Step 4: Commit**

```bash
cd C:\Projects\acmi-app
git add nextjs-project/src/app/globals.css
git commit -m "Workspace redesign: remove superseded CSS (grep-verified unused)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Browser verification

**Files:** none (verification only; fix-ups commit as they're found)

- [ ] **Step 1: With the local stack running** (Docker API + `npm run dev`), verify in Chrome:

1. **Toolbar**: tabs, fused select+Add (one outline, aligned heights), USD/EUR input, Excel + Save buttons all 34px; draft tab dashed amber; editing badge/saved notice appear inline; error banner above when triggered.
2. **Deck**: 5 clusters with hairline dividers; compact sliders with editable value chips; `/mo·/per` and `EUR·USD` mini-segs work; Term shows `365d · 12.0mo`; FC Coverage chip reveals %/months fields; Seasonality chip reveals Summer/Winter strip and per-season binding works; swap + remove work; empty state when no aircraft.
3. **Strip**: metrics + inline project name editable; flag colors by margin tone; scope segs switch Total/MSN; EUR/USD and Current/Naked toggles work; viewer/cost-gated variants correct.
4. **Charts**: waterfall labels have headroom, gridlines behind bars, floating cascade intact; sensitivity rail highlights current rate, bars proportional.
5. **Breakdown**: columns 132/148/92/62 clustered right; single-line headers; hover popovers still work on rows.
6. **Modal + /calculation** both render the new layout; dark mode clean; 1024px and 640px breakpoints reflow per spec.

- [ ] **Step 2: Fix anything found, re-verify, commit fixes.**
