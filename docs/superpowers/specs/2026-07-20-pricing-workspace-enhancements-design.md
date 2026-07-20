# Pricing Workspace Enhancements — Design

**Date:** 2026-07-20
**Status:** Approved
**Scope:** Frontend only (`nextjs-project`). No backend/API changes.

Four related changes to the Quotes page and Pricing Workspace:

1. "New Quote" button on the Quotes page opening the Pricing Workspace in a centered modal.
2. Load the pricing engine on aircraft dropdown selection (draft aircraft), with "Add aircraft" committing the draft.
3. Convert cost-breakdown drill-down popups from click to cursor-following hover, in both the Cost Breakdown table and the monthly P&L table.
4. Auto-calculated "Duration" field in the Term subsection.

---

## 1 · New Quote modal on the Quotes page

**Decision:** Reuse the full existing `DashboardSummary` workspace component inside a modal overlay — one source of truth; Save/Update already lives inside it. The `/calculation` sidebar page is untouched.

### Components

- **`src/app/(dashboard)/quotes/page.tsx`**
  - Also fetch the aircraft list (same fetch as `calculation/page.tsx`: `GET {API_URL}/aircraft` with the access-token cookie, `cache: 'no-store'`).
  - Pass `aircraftList` into `QuoteList`.

- **`src/components/quotes/QuoteList.tsx`**
  - New prop: `aircraftList: AircraftOption[]`.
  - "New Quote" button (Plus icon, `av-btn av-btn-cyan`) in the panel header, rendered only when `!isViewer`.
  - Opens `NewQuoteModal`. After a save inside the modal, calls `useRouter().refresh()` so the server-rendered list re-fetches.

- **New: `src/components/quotes/NewQuoteModal.tsx`**
  - `fixed inset-0 z-50` backdrop (`bg-black/50`) + centered panel:
    - Width exactly `75vw`, height exactly `80vh` (`style={{ width: '75vw', height: '80vh' }}`), `av-panel` styling, internal `overflow-y: auto` body.
  - Header bar: title "New Quote — Pricing Workspace" + ✕ close button.
  - Body renders `<DashboardSummary aircraftList={aircraftList} isViewer={false} onSaved={...} />`.
  - On open (mount): calls `usePricingStore.getState().reset()` — fresh blank workspace every time.
  - Close paths: ✕ button or Escape key. **No backdrop-click close** (protects half-entered inputs).
  - On save: `onSaved` → `router.refresh()` + close modal.

- **`src/components/pricing/DashboardSummary.tsx`**
  - New optional prop `onSaved?: (quoteNumber: string) => void`, invoked from the existing `SaveQuoteDialog.onSaved` callback (in addition to the current saved-notice behaviour).

### Notes

- Crew/costs config Zustand stores self-seed with Excel defaults at module load, so the engine computes correctly inside the modal without visiting Crew/Costs pages first.
- `reset()` clears only pricing state (project, MSN inputs, results, editing state) — config stores are untouched.

---

## 2 · Draft aircraft: engine loads on dropdown select

**Decision:** Represent the draft as a normal `MsnInput` with an `isDraft: true` flag inside `msnInputs`. All existing calculation/rendering paths work unchanged; only Total-Project aggregation and the tab visuals special-case drafts. One draft at a time.

### Store — `src/stores/pricing-store.ts`

- `MsnInput` gains `isDraft?: boolean` (absent/false = committed).
- New action `commitDraft(msn: number)` — sets `isDraft: false` on that input.
- Draft is derived state: `msnInputs.find((i) => i.isDraft)`. No separate draft slot.

### Hook — `src/components/pricing/hooks/useAddAircraft.ts`

- Extract the `MsnInput` builder (defaults, aircraft rates, naked rates, EPR matrix — current body of `handleAddAircraft`) into a pure `buildMsnInput(ac, bhFhRatio, apuFhRatio)` function.
- Expose:
  - `selectAircraft(aircraftId: string)` — removes any existing draft (`removeMsnInput`), builds a new input with `isDraft: true`, `addMsnInput`s it. Returns the new MSN so the caller can focus its tab.
  - `commitDraft()` — calls the store's `commitDraft` for the current draft.
  - `draft` — the current draft input (or `null`).
  - `availableAircraft` — excludes only **committed** MSNs (`!isDraft`). The draft's aircraft stays in the list so the dropdown's `value` binding to it remains valid; selecting a different aircraft replaces the draft.

### UI — `src/components/pricing/DashboardSummary.tsx`

- Dropdown `onChange` → `selectAircraft(id)`; the draft's tab is auto-selected (`setActiveMsn`) and the results scope (`setSelectedMsn`) follows, so the editor + live results show immediately.
- Dropdown `value` binds to the draft's aircraft id (empty when no draft).
- **Add aircraft** button → `commitDraft()`; enabled only while a draft exists. After commit, dropdown resets to empty.
- Draft tab rendering: existing tab plus `draft` class — dashed border + a small "Draft" badge. Removing the draft tab (existing ✕ in `MsnInputRow`) discards it.

### Aggregation — exclude drafts from Total Project

- `SummaryTable.tsx` and `PnlTable.tsx`: wherever the **total-project** view iterates `msnInputs`, use `msnInputs.filter((i) => !i.isDraft)`. Single-MSN views (including viewing the draft itself) unchanged.
- `useCalculation` continues to send all inputs (draft included) so the draft's own results compute; the server calc treats it like any MSN. Only client-side Total aggregation filters drafts.
- Quote saving (`SaveQuoteDialog`) snapshots `msnInputs` — drafts are **excluded** from `msn_snapshots` (filter `!isDraft`) so an uncommitted draft never enters a saved quote.
- The "Save as Quote" button in `DashboardSummary` is disabled unless at least one **committed** (non-draft) MSN exists — otherwise a draft-only session could save an empty quote.

### CSS — `globals.css`

- `.av-ac-tab.draft` — dashed 1px border in the amber/muted accent, plus badge styling.

---

## 3 · Hover popups, positioned at the cursor

**Decision:** `LineDetailPopover` becomes a passive, cursor-following tooltip. Both consumers switch from click to hover.

### `src/components/pricing/CostDetailPopover.tsx`

- Props change: `anchorRect: DOMRect` and `onClose: () => void` are replaced by `cursor: { x: number; y: number }`.
- Remove: ✕ button, click-outside handler, Escape handler.
- Add: `pointer-events: none` on the root (never traps the mouse).
- Positioning: place at `cursor + 16px` offset (right/below). Measure the rendered box with `useLayoutEffect` + ref; if it would overflow the right or bottom viewport edge, flip to the left of / above the cursor. Clamp to ≥8px from every edge.

### `src/components/pricing/SummaryTable.tsx`

- Cost-breakdown rows (`costLines`, ACMI cost, Overhead): replace `onClick` with
  - `onMouseEnter` / `onMouseMove` → `setDrill({ cat, x: e.clientX, y: e.clientY })`
  - `onMouseLeave` → `setDrill(null)`
- Remove `cursor-pointer` and the "Click to see the build-up" titles (hover discoverability replaces them).

### `src/components/pricing/PnlTable.tsx`

- Clickable monthly cells (`CLICKABLE_ROWS`): same conversion — `PopoverState` becomes `{ rowKey, monthIndex, x, y }`, updated on `onMouseEnter`/`onMouseMove`, cleared on `onMouseLeave`. `getDetailConfig` unchanged.
- Keep the `hover:underline`-style affordance on hoverable cells so users can tell which cells have detail.

### Touch devices

- Hover-only is acceptable here (desktop-first internal tool). No click fallback in scope.

---

## 4 · Term "Duration" field

### `src/components/pricing/MsnInputRow.tsx`

- In `RateControls`' Term block, add a read-only **Duration** field below Start/End dates (both seasonal and non-seasonal paths — `RateControls` covers both).
- Computation, from `data.periodStart` / `data.periodEnd` (normalised via the existing `startDateValue`/`endDateValue` helpers):
  - `days` = inclusive day count: `(end − start) / 86_400_000 + 1`.
  - `months` = `days / 30.4375`, shown to one decimal.
- Format: **`365 d / 12.0 mo`**. Shows `—` when either date is missing/invalid or end < start.
- Rendered with the same label style as `NumField` but as a non-editable value (no input element).
- No store changes; purely derived display.

---

## Error handling

- Modal: Escape/✕ close discards in-progress state silently (matches existing app conventions; the store keeps the state anyway until the next modal open resets it).
- Draft with invalid inputs: existing `msnIssues` warning badge applies to draft tabs too.
- Popover: if `getDetailConfig`/`buildDrill` returns null, nothing renders (unchanged).
- Duration: guard against null/absent/short date strings (this codebase has had crashes from null periods — reuse the defensive parsing style of `startDateValue`/`endDateValue`).

## Testing

- No test infrastructure exists in `nextjs-project` (no test runner configured); verification is by `npm run build` (type-check + lint) and manual UI verification of:
  1. Quotes → New Quote → panel is 75vw×80vh, blank workspace, save closes + refreshes list.
  2. Dropdown select → draft tab appears (dashed, badge), engine computes; Add aircraft → tab becomes permanent; Total Project excludes the draft until committed.
  3. Hovering cost-breakdown rows and P&L monthly cells shows the popup at the cursor, following it, flipping at viewport edges; leaving hides it.
  4. Term shows `365 d / 12.0 mo` style duration, updating live as dates change; `—` for incomplete dates.
