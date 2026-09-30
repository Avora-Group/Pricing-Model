---
phase: 04-quote-persistence-and-history
plan: 02
subsystem: ui
tags: [recharts, sensitivity, line-chart, pricing, next.js, server-actions]

requires:
  - phase: 03-pricing-engine
    provides: calculatePnlAction server action, usePricingStore Zustand store, sidebar navigation
provides:
  - Sensitivity analysis page at /sensitivity
  - Recharts LineChart visualization of EUR/BH rate trends
  - Server-side sensitivity calculation varying 5 pricing parameters across 5 data points
  - ParameterPicker component with 5 configurable parameters
  - SensitivityTable comparison table with change-from-base calculations
affects: [04-quote-persistence-and-history]

tech-stack:
  added: [recharts]
  patterns: [server-action-based sensitivity calculation, parallel pricing variation]

key-files:
  created:
    - nextjs-project/src/components/sensitivity/ParameterPicker.tsx
    - nextjs-project/src/components/sensitivity/SensitivityChart.tsx
    - nextjs-project/src/components/sensitivity/SensitivityTable.tsx
    - nextjs-project/src/components/sensitivity/SensitivityView.tsx
    - nextjs-project/src/app/actions/sensitivity.ts
    - nextjs-project/src/app/(dashboard)/sensitivity/page.tsx
  modified:
    - nextjs-project/src/components/sidebar/Sidebar.tsx
    - nextjs-project/package.json

key-decisions:
  - "Excluded bhFhRatio and apuFhRatio from sensitivity parameters -- they are frontend-only values not in the /pricing/calculate API request"
  - "Sensitivity uses sequential calculatePnlAction calls (5 per analysis run) rather than parallel to avoid API overload"
  - "Base value for per-MSN parameters (mgh, cycleRatio, crewSets) uses average across all MSNs"

patterns-established:
  - "Sensitivity variation pattern: clone base inputs, modify single parameter by step factor, call existing calculatePnlAction"
  - "Recharts dark theme: CartesianGrid #374151, axis #9CA3AF, indigo line #818CF8, tooltip bg-gray-800"

requirements-completed: [SENS-01, SENS-02]

duration: 3min
completed: 2026-03-09
---

# Phase 04 Plan 02: Sensitivity Analysis Summary

**Sensitivity page with Recharts line chart and comparison table varying 5 pricing parameters across -20% to +20% range**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T16:35:24Z
- **Completed:** 2026-03-09T16:38:18Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Sensitivity analysis page accessible at /sensitivity with Recharts LineChart and comparison table
- Server action runs 5 pricing calculations with varied parameter values (-20%, -10%, base, +10%, +20%)
- ParameterPicker dropdown supports mgh, exchangeRate, marginPercent, cycleRatio, and crewSets
- Sidebar updated with Sensitivity nav item (BarChart3 icon) between Quotes and Aircraft

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Recharts and create sensitivity components** - `95f5b12` (feat)
2. **Task 2: Sensitivity page, Server Action, and sidebar update** - `b9e3da9` (feat)

## Files Created/Modified
- `nextjs-project/src/components/sensitivity/ParameterPicker.tsx` - Dropdown to select which parameter to vary (5 params)
- `nextjs-project/src/components/sensitivity/SensitivityChart.tsx` - Recharts LineChart with AeroVista dark theme
- `nextjs-project/src/components/sensitivity/SensitivityTable.tsx` - Comparison table with change-from-base calculations
- `nextjs-project/src/components/sensitivity/SensitivityView.tsx` - Client orchestrator: reads store, calls action, renders chart + table
- `nextjs-project/src/app/actions/sensitivity.ts` - Server action calling calculatePnlAction 5 times with varied inputs
- `nextjs-project/src/app/(dashboard)/sensitivity/page.tsx` - Sensitivity page route
- `nextjs-project/src/components/sidebar/Sidebar.tsx` - Added Sensitivity nav item with BarChart3 icon
- `nextjs-project/package.json` - Added recharts dependency

## Decisions Made
- Excluded bhFhRatio and apuFhRatio from sensitivity parameters since they are frontend-only values not sent to the /pricing/calculate API
- Used sequential server action calls (not parallel) for the 5 data points to avoid overwhelming the API
- Base value for per-MSN parameters uses the average across all configured MSNs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter TypeScript types**
- **Found during:** Task 1 (SensitivityChart creation)
- **Issue:** Recharts Tooltip `formatter` and `labelFormatter` props have strict ValueType | undefined typing that rejects number/string parameter types
- **Fix:** Used `any` type annotation with eslint-disable comment for the formatter callback
- **Files modified:** nextjs-project/src/components/sensitivity/SensitivityChart.tsx
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 95f5b12 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type annotation fix for Recharts compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sensitivity analysis complete, users can evaluate pricing impact of parameter changes
- Ready for remaining Phase 4 plans (quote persistence, history)

## Self-Check: PASSED

All 7 created files verified present on disk. Both task commits (95f5b12, b9e3da9) verified in git log.

---
*Phase: 04-quote-persistence-and-history*
*Completed: 2026-03-09*
