# Workspace Sensitivity Integration — Design

**Date:** 2026-07-22
**Status:** Approved (in-conversation)

## Goal

Fold the standalone Sensitivity page into the Pricing Workspace so sensitivity
sweeps run against the live workspace inputs, support multiple parameters per
run, and free the verdict strip's right corner by moving the view toggles into
the input deck.

## 1. Scope toggles move to the ticket deck

The verdict-strip `.scope` block (Total/MSN selector, EUR/USD, Current/Naked)
becomes a sixth "View" cluster in `MsnInputRow`, right of Operation.

- `MsnInputRow` reads `selectedMsn`/`setSelectedMsn`, `rateBasis`/`setRateBasis`
  and the MSN list from `usePricingStore`; `canViewNaked` gates the basis seg.
- `currency` (today local `useState` in `SummaryTable`) lifts into
  `pricing-store` as `displayCurrency: 'eur' | 'usd'` (+ setter, reset with
  `initialState`), shared by both components.
- The viewer-only Summer/Winter seg (shown when `!canViewCosts`) stays in the
  strip — viewers keep their filter; the strip otherwise holds only metrics +
  the verdict flag.
- `av-deck-grid` CSS gains a sixth column; `av-strip .scope` styles are reused
  or adapted for the deck cluster.
- When no aircraft is loaded the deck placeholder shows instead — the toggles
  are meaningless then anyway (charts/table also empty).

## 2. Charts row: narrower build-up chart + sensitivity setup panel

- `.av-duo` changes `1.5fr 1fr` → `1fr 1fr`.
- The Rate Sensitivity rail panel is deleted, replaced by a "Sensitivity" setup
  panel (`SensitivitySetupPanel`): one row per parameter — MGH, Cycle Ratio,
  ACMI Rate — each with an include toggle, its live base value for the current
  scope, and a step-interval input (defaults 10 BH / 0.25 / 100 €/BH).
  Below: Run button + hint ("±2 steps per selected parameter"). Run disabled
  while calculating, with no committed aircraft, or with no parameter selected.
- Panel sits inside the existing `canViewCosts` gate.

## 3. Sweep semantics — combined, live, multi-MSN-correct

- Five steps (−2 … +2). At each step every selected parameter shifts by
  `step × interval`, applied as a **delta to each MSN's own base value**
  (clamped ≥ 0). This fixes two old-page defects: the old sweep overwrote all
  MSNs with one absolute averaged value, and ignored seasonal aircraft.
  Seasonal MSNs get the delta applied to both summer and winter blocks.
- Sweep runs client-side via `computeMsnPnlSummarySeasonal` with
  `CrewStoreData`/`CostsStoreData` taken live from the config stores and the
  workspace exchange rate.
- Scope: respects the Total/MSN toggle — Total sweeps all committed MSNs
  (drafts excluded, same as the charts); an MSN scope sweeps only that MSN.
- Per step outputs: swept parameter values, cost €/BH, net profit (project
  total), margin (netProfit / totalRevenue).

## 4. Results panel — full width below the charts row

`SweepResultsPanel` renders after Run: the existing `SensitivityChart`
(net profit vs step) beside a table with dynamic columns —
Step | one column per swept parameter | Cost/BH | Net profit | Margin.
Base row highlighted. A fingerprint of the swept inputs is captured at run
time; when it drifts, the panel shows an "inputs changed — re-run" notice
instead of silently stale numbers.

State (selected params, intervals, results) lives in a
`useSensitivitySweep` hook instantiated in `SummaryTable`, which renders both
panels. The old single-param `SensitivityTable` is superseded; the old
`ParameterPicker` dies with its page, `SENSITIVITY_PARAMS` moves into the new
hook module.

## 5. Standalone page removal

Delete: `app/(dashboard)/sensitivity/page.tsx`, `SensitivityView.tsx`,
`ParameterPicker.tsx`, `SensitivityTable.tsx`, and the unused
`app/actions/sensitivity.ts`. Remove nav entries from `Sidebar` and
`BottomTabBar` and the `sensitivity` breadcrumb from `TopBar`. `SensitivityChart`
survives (used by the results panel).

## Verification

Typecheck (`tsc --noEmit`), production build, and a manual pass in the dev app:
toggles work from the deck, sweep with 1 and 3 parameters, seasonal MSN sweep,
MSN-scope sweep, stale notice after editing an input, viewer/no-cost gating.
