# Sandbox Pricing Workspace & In-Dialog Quote Editing — Design

**Date:** 2026-07-21
**Status:** Approved (pending spec review)

## Context

Quotes are now created and updated exclusively on the Quotes page (via the New Quote
dialog). The Pricing Workspace (`/calculation`) still behaves like the primary quote
editor: quote data hydrated by the quote detail page leaks into it ("Editing Q-xxx"),
the detail page's Edit button redirects to it, and opening the New Quote dialog wipes
its state (with a confirm dialog warning about exactly that).

All workspace UI (`DashboardSummary` and children) reads three module-level zustand
stores — `pricing-store`, `crew-config-store`, `costs-config-store`. They are
in-memory (no persist), so a browser refresh already clears them; state only survives
client-side navigation. That shared-store design is the root cause of every
interference above.

## Decisions (agreed with user)

1. **Sandbox keeps "Save as Quote"** — it can create new quotes, never update one.
2. **Reset on refresh + leak guard** — sandbox state survives round-trips to
   P&L/Sensitivity; browser refresh resets it (already true); arriving with quote
   data hydrated elsewhere auto-clears the workspace.
3. **Edit entry points: both** — Quotes-list rows get an Edit action and the quote
   detail page's Edit button opens the same dialog in place. No redirect to
   `/calculation`.
4. **Isolation via snapshot & restore** — keep global stores; the dialog snapshots
   workspace state on open and restores it on close. No context-scoped store
   refactor.

## Design

### 1. Pricing Workspace (`/calculation`) becomes a sandbox

`DashboardSummary` gets a new `sandbox?: boolean` prop; `calculation/page.tsx` passes
`sandbox` (the New Quote dialog does not).

When `sandbox` is true:

- **Leak guard** — a mount-only effect: if `usePricingStore.getState().editingQuoteId
  !== null`, reset all three stores (`reset()` + `resetToDefaults()` ×2). Quote data
  hydrated by the detail page or a dashboard P&L deep-link can never appear in the
  sandbox. (Viewing a quote already overwrote any sandbox state, so nothing of value
  is lost by the reset.)
- **Reset button** — an icon button using lucide `RefreshCw` (the same circular-arrows
  icon as the aircraft-swap control), rendered immediately after the add-aircraft
  group (`av-addgrp`) in the toolbar. Click resets all three stores. No confirm —
  same semantics as F5. `title`/`aria-label`: "Reset workspace". Styled like the
  toolbar ghost buttons.

Independent of `sandbox`:

- The `isEditing && !isViewer` **"New quote" toolbar button is removed** (dead flow —
  the workspace never enters edit mode anymore). The "Editing Q-xxx" badge logic
  stays; it can only render inside the edit dialog now.
- "Save as Quote" and Excel export stay unchanged. In the sandbox `editingQuoteId`
  is always null, so saving always creates a new quote.
- Page subtitle updated to signal the sandbox nature, e.g. "Sandbox — enter
  commercial assumptions and experiment; resets on refresh".

### 2. New Quote dialog: snapshot & restore

`NewQuoteModal` currently resets the global stores on open, destroying workspace
state. New behavior:

- **On open** (transition to `isOpen`): snapshot `usePricingStore.getState()`,
  `useCrewConfigStore.getState()`, `useCostsConfigStore.getState()` into a ref, then
  prepare the stores (blank slate for new-quote mode; hydration for edit mode, §3).
  Store actions are stable references, so snapshotting the whole state object and
  restoring via `useXStore.setState(snap)` is safe — no field picking.
  Guard with a ref so React strict-mode's double effect can't snapshot the
  already-reset state.
- **On close** (transition away from `isOpen`, and on unmount while open): restore
  all three snapshots, clear the ref. Applies whether the dialog was cancelled or
  saved — the workspace never notices the dialog existed.
- **Stale-write guard in `useCalculation`**: the debounce timer is cleared on
  unmount, but an already-in-flight `calculatePnlAction` can resolve after the
  dialog closed and write results over the restored state. Add an alive-ref
  (cleanup sets it false; skip `setResults`/`setIsCalculating`/`setLastError` when
  unmounted).
- `QuoteList.handleNewQuote` loses its "this clears the workspace" `window.confirm`
  — the button just opens the dialog.

### 3. Edit mode for the dialog

- **Shared hydration function** — extract the store-population logic from
  `useQuoteHydration` into an exported `hydrateStoresFromQuote(quote:
  QuoteDetailResponse)` in the same file. The hook keeps its signature/behavior
  and delegates to it; the dialog calls it directly.
- **`NewQuoteModal` gains `editQuote?: QuoteDetailResponse | null`.** When set, the
  open-effect hydrates from the quote instead of resetting to blank. Header title:
  `Edit {quote_number} — Pricing Workspace` (else `New Quote — Pricing Workspace`).
  The save button already flips to "Update Quote" via `editingQuoteNumber` in the
  store; `SaveQuoteDialog`'s edit-in-place path is reused unchanged.
- **Quotes list** (`QuoteList`): each row's action cell gains an Edit button
  (pencil icon, non-viewer only, next to Open/Delete). Click → `getQuoteAction(id)`
  (already exists) → on success, open the dialog with the detail; on error, surface
  it in the existing `statusError` banner. Disable the button while fetching.
  `onSaved` keeps today's behavior (close, re-fetch list, `router.refresh()`).
- **Detail page** (`QuoteDetailClient` + `QuoteHeader`): `QuoteHeader`'s Edit button
  becomes an `onEdit` callback prop (no `router.push('/calculation')`). The client
  renders the dialog with `editQuote={quote}` and the page's `aircraftList`.
  "Go to Calculation" button and the "Click Edit to open this quote in
  Calculation…" info banner are removed; Back and "Go to P&L" stay. `onSaved` →
  close + `router.refresh()`; the fresh `quote` prop re-runs `useQuoteHydration`,
  overwriting the restored (stale) snapshot with updated data. A brief flash of
  pre-update numbers between restore and re-hydration is acceptable.
- `QuoteDetailClient` drops the `go === 'calculation'` deep-link handling
  (`go=pnl` stays).

### 4. Dashboard ripple

`DashboardMetrics`' per-project "Calc" link (`/quotes/{id}?go=calculation`) would be
instantly wiped by the leak guard. It becomes a plain link to `/quotes/{id}` (the
detail page shows the same calculation summary cards); rename the label to "Open".
The "P&L" deep-link stays. Note: visiting the Calculation page after inspecting a
quote's P&L clears that loaded view — consistent with the sandbox model.

## Files touched

| File | Change |
|---|---|
| `src/app/(dashboard)/calculation/page.tsx` | pass `sandbox`; subtitle |
| `src/components/pricing/DashboardSummary.tsx` | leak guard, reset button, remove "New quote" button, `sandbox` prop |
| `src/components/pricing/hooks/useCalculation.ts` | alive-ref stale-write guard |
| `src/components/quotes/NewQuoteModal.tsx` | snapshot/restore, `editQuote` mode, title |
| `src/components/quotes/QuoteList.tsx` | drop confirm, row Edit action, dialog wiring |
| `src/components/quotes/hooks/useQuoteHydration.ts` | extract `hydrateStoresFromQuote` |
| `src/app/(dashboard)/quotes/[id]/QuoteDetailClient.tsx` | dialog-based edit, drop `go=calculation`, drop banner |
| `src/components/quotes/QuoteHeader.tsx` | `onEdit` prop, remove "Go to Calculation" |
| `src/components/dashboard/DashboardMetrics.tsx` | repoint "Calc" → "Open" (`/quotes/{id}`) |

No backend or server-action changes (`getQuoteAction` already exists).

## Error handling

- Edit fetch failure → `statusError` banner on the list; detail page already holds
  its quote, so no fetch is needed there.
- Viewer role: Edit buttons hidden (`isViewer` already flows into both components);
  the dialog remains unreachable for viewers.
- Calculation errors inside the dialog surface via the existing error banner in
  `DashboardSummary`; they are wiped along with the rest of the state on close.

## Testing

No frontend test harness exists; verification is `npm run lint` + `npm run build`
plus this manual checklist:

1. Sandbox: build a calc on `/calculation` → visit P&L → return: state intact.
   F5: state gone.
2. Sandbox: view a quote detail → go to Calculation: workspace is blank (no
   "Editing" badge).
3. Reset button clears aircraft, rates, and crew/costs overrides in one click.
4. Quotes page: build sandbox state → open New Quote → add aircraft → close →
   Calculation page still shows the sandbox state.
5. New Quote → save: quote appears in list; workspace untouched.
6. List row Edit → dialog opens pre-filled → Update Quote → list and detail show
   updated values; no redirect anywhere.
7. Detail page Edit → same dialog, in place; after update the detail page shows
   fresh numbers.
8. Dashboard: "Open" goes to quote detail; "P&L" still loads the quote into P&L.
9. Viewer role sees no Edit / New Quote / Reset controls.
