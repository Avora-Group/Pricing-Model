# Pricing Workspace Redesign ("Ticket Deck") — Design

**Date:** 2026-07-21
**Status:** Approved (Variant B mockup chosen)
**Visual source of truth:** `design-mockups/workspace-redesign/variant-b.html` (rendered on the compiled `av-*` stylesheet; `variant-a.html` kept for reference). The mockup's `<style>` block is the draft CSS for the new classes below.
**Scope:** The shared workspace UI — `DashboardSummary` + `MsnInputRow` + `SummaryTable` — applies everywhere it renders (New Quote modal and `/calculation`). Frontend only; **zero changes** to stores, hooks, calculation logic, draft/commit flow, save flow, P&L page, quote detail.

## Layout architecture (top to bottom)

### 1 · Toolbar (replaces the action row + aircraft-tabs row)
One row, all controls 34px tall / radius 8:
- Left: aircraft tabs (existing semantics incl. draft styling — dashed amber + badge, warning icon, margin badge) + **fused add-aircraft group**: `<select>` and `+ Add` button inside ONE bordered container (`av-addgrp`) — select borderless on `--card-2`, button segment separated by a hairline, cyan-ink text. Same draft-selection behavior as today.
- Right: `USD/EUR` labeled rate input (moves out of SummaryTable's controls panel), `⬇ Excel` ghost button, `Save as Quote` primary (cyan). "Editing Q-xxx" badge, saved notice, and "Calculating…" hint render inline left of the actions. "New quote" reset button (edit mode) stays with the actions.
- Error banner (`lastError` / export error): full-width strip **above** the toolbar, unchanged styling.
- The modal's own header (`NewQuoteModal`) is already slim — unchanged.

### 2 · Ticket deck (MsnInputRow becomes a horizontal band)
`av-deck`: card containing a 5-column cluster grid (`grid-template-columns: minmax(150px,.8fr) 1.2fr 1.2fr 1fr 1.2fr`), hairline-divided (`border-right: 1px solid var(--line-2)`):

| Cluster | Contents |
|---|---|
| **Aircraft** | MSN + type bold, registration muted; swap (existing RefreshCw→select swap flow); `Seasonality` + `FC Coverage` toggle chips (`av-chip-t`, active = cyan-soft); remove ✕ |
| **Utilisation** | MGH compact slider (label row: name + cyan value chip; thin 4px track) with `/mo·/period` mini-seg inline in the label row; below: `Excess hours` + `FH : FC` compact fields (2-col) |
| **Rate** | ACMI rate compact slider with `EUR·USD` mini-seg in label row; below: `Excess rate` field + (blank or currency-dependent unit hint) |
| **Term** | `Start` + `End` date fields (2-col); below full-width: `Duration` read-only (`av-ro`: dashed border, `--line-2` bg, `365d · 12mo` compact format — change `durationText` output from `365 d / 12.0 mo` to `365d · 12.0mo`) |
| **Operation** | Crew sets compact slider; below: Environment seg + Lease seg (2-col). FC Coverage enabled → `Coverage %` + `Months` fields appear below (cluster grows; row wraps within cluster) |

- **Compact slider** (`av-sf`): label row 18px (11px label left, value chip right — value chip is the editable number input styled as a chip), 4px track, 13px thumb. Replaces the tall `SliderField` layout in this component only.
- **Compact field** (`av-nf`): 9.5px uppercase label, 28–30px input.
- **Seasonality ON:** slim `Summer | Winter` tab strip (`av-deck-seasons`) spanning the deck top (under a hairline); Utilisation/Rate/Term clusters bind to the active season (existing `updateSeasonInput` flow), Operation stays shared. Same virtual-input data flow as today.
- **No aircraft:** deck area renders the existing "Select an aircraft above to begin pricing" empty-state card.

### 3 · Verdict strip (from SummaryTable)
`av-strip`: single horizontal card — metric cells (hairline-divided, min-width 170px): **Net profit · mo** (project-name inline input stays in this cell's label row), **Net margin**, **Revenue · mo**; then the verdict flag (`av-vf-*` tones) stretching to fill; right cap (`--card-2`, hairline-left): stacked compact segs — `Total | <msn>…` scope and `Current | Naked` (cost-access users only). Cost-gated cells keep `Redacted`/hidden behavior exactly as today (no-cost users: profit/margin cells hidden, revenue remains).

### 4 · Charts row
`av-duo` grid `1.5fr 1fr`:
- **Waterfall**: 30px top padding (value-label headroom), baseline rule (`border-bottom: 1px solid var(--line)`), two horizontal gridlines at 33%/66% (`--line-2`, behind bars), bar `max-width: 46px`, radius 4px top, floating cascade preserved (existing math), value labels 10px above each bar, label row 9.5px under the baseline. Height ~172px.
- **Rate sensitivity → horizontal rail** (`av-sens-rail`): one row per rate step (7 steps, ±150/BH as today): `rate | margin-bar | margin%` grid row (52px / flex / 64px), 6px cyan-gradient bar with width proportional to net margin (relative to the max in the band, clamped ≥ 0), current rate row highlighted (cyan border + soft bg). Margin % colored by `marginTone`. Replaces `av-sens-grid` cells.
- Season filter seg (`All | Summer | Winter`, only when a seasonal MSN exists) moves into the waterfall panel header right slot.

### 5 · Cost breakdown table
`av-bd-tbl` upgraded: `table-layout: fixed` + `<colgroup>` — LINE auto, EUR/MONTH 132px, PROJECT TOTAL 148px, PER BH 92px, % REV 62px; row padding 8px 14px (head 7px); head font 9.5px/800, single-line (`% rev` not wrapped); sub-rows indent 30px; total rows keep band + 1.5px top rule. Hover drill popovers unchanged. On ≤640px the table keeps its 560px min-width scroll behavior.

## CSS strategy

New classes added to `globals.css` (names: `av-toolbar`, `av-ctl`, `av-addgrp`, `av-deck`, `av-cluster`, `av-cluster-t`, `av-sf`, `av-nf`, `av-ro`, `av-chip-t`, `av-deck-seasons`, `av-strip`, `av-duo`, `av-sens-rail` + modifiers), geometry copied from the mockup's style block. Existing classes reused wherever they already match (`av-panel`, `av-panel-h`, `av-seg`, `av-pill`, `av-vf-*`, `av-btn`…). Superseded classes (`av-work-grid`, `av-ac-add`, `av-verdict-top`/`av-vcell`, `av-wf*` old geometry, `av-sens-grid`/`av-sens-cell`, `av-in-sec*`, old `av-field` usage *within these three components only*) are removed **only after a repo-wide grep confirms no other consumer** (crew/costs/aircraft pages share some `av-field`/`av-input` styles — those stay).

## Behaviors preserved (explicit non-goals)

Draft select/commit/discard; add/swap/remove aircraft; seasonality data flow; FC coverage inputs; `useCalculation` debounce; Save/Update quote + dialog; Excel export gating (`committedCount`); viewer read-only mode; cost-visibility gating (`canViewCosts`/`canViewNaked`); hover popovers (both tables); responsive breakpoints philosophy (1024/640); dark mode (all new CSS uses tokens only).

## Responsive

- ≤1024px: deck → `grid-template-columns: 1fr 1fr` (clusters wrap, Aircraft cluster spans full row first); `av-duo` → single column; strip metrics wrap (flag drops below metrics, full-width).
- ≤640px: deck single column; strip single column; toolbar wraps (actions row below tabs).

## Edge states

- Empty workspace → deck empty-state card (existing copy).
- `isCalculating` → existing 60% opacity on results region + "Calculating…" hint in toolbar.
- Draft-only totals, redaction, `—` placeholders: unchanged logic.

## Testing

`npm run build` per task + browser verification against the running local stack (Docker API + `npm run dev`), using the New Quote modal and `/calculation`, light + dark, desktop + 1024/640 widths. The mockup pages remain the visual reference.
