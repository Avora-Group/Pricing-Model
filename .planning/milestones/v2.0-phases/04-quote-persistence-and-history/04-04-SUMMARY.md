---
phase: 04-quote-persistence-and-history
plan: 04
subsystem: ui
tags: [nextjs, zustand, server-actions, quote-management, save-dialog, fork-behavior, status-badge]

# Dependency graph
requires:
  - phase: 04-quote-persistence-and-history
    plan: 03
    provides: Quote API router with 5 endpoints (save, list, detail, status update, PDF stub)
  - phase: 03-pricing-engine
    plan: 04
    provides: Pricing store with MsnInput, MsnPnlResult, ComponentBreakdown types
provides:
  - 4 Server Actions for quote CRUD (saveQuoteAction, listQuotesAction, getQuoteAction, updateQuoteStatusAction)
  - SaveQuoteDialog component gathering all 3 store snapshots synchronously
  - QuoteList component with search, status filter, and inline status update
  - Quote detail page with fork behavior loading all Zustand stores from snapshots
  - Store extensions: loadFromQuote on pricing-store, loadFromSnapshot on crew/costs stores
  - DashboardSummary "Save as Quote" button
affects: [quote-pdf-export, phase-05-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [Store snapshot gathering via getState() for quote save, Fork behavior via loadFromQuote/loadFromSnapshot to populate stores from saved quote data, Server Component with cookie forwarding for quote detail page]

key-files:
  created:
    - nextjs-project/src/app/actions/quotes.ts
    - nextjs-project/src/components/quotes/StatusBadge.tsx
    - nextjs-project/src/components/quotes/SaveQuoteDialog.tsx
    - nextjs-project/src/components/quotes/QuoteList.tsx
    - nextjs-project/src/app/(dashboard)/quotes/[id]/page.tsx
    - nextjs-project/src/app/(dashboard)/quotes/[id]/QuoteDetailClient.tsx
  modified:
    - nextjs-project/src/stores/pricing-store.ts
    - nextjs-project/src/stores/crew-config-store.ts
    - nextjs-project/src/stores/costs-config-store.ts
    - nextjs-project/src/app/(dashboard)/quotes/page.tsx
    - nextjs-project/src/components/pricing/DashboardSummary.tsx

key-decisions:
  - "SaveQuoteDialog reads from all 3 stores synchronously via getState() -- no async needed since Zustand stores are synchronous"
  - "QuoteDetailClient populates stores in useEffect on mount, enabling all existing tab pages to reflect loaded quote data"
  - "Fork behavior: loadFromQuote sets projectId=null so saving creates a new quote, preserving original immutability"
  - "MSN data reconstruction: quote_msn_snapshots contain both msn_input dict and breakdown/monthly_pnl for full round-trip"
  - "QuoteList status update: show dropdown for all users, let API enforce creator-or-admin permission with error toast on failure"

patterns-established:
  - "Store snapshot pattern: gather full state from multiple Zustand stores via getState() for persistence payloads"
  - "Quote fork pattern: load stores from saved snapshot, nullify projectId, user edits and saves as new quote"
  - "Server Component quote detail: fetch with cookie forwarding, pass to client component for store hydration"

requirements-completed: [QUOT-01, QUOT-03, QUOT-04, QUOT-05]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 4 Plan 4: Quote Frontend Management Summary

**Full quote management UI with save dialog, filterable quote list, detail page with fork behavior, and status management across all 3 Zustand stores**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T16:51:26Z
- **Completed:** 2026-03-09T16:56:47Z
- **Tasks:** 3 (of 4 -- checkpoint pending)
- **Files modified:** 11

## Accomplishments
- 4 Server Actions for quote CRUD operations (save, list, get, updateStatus) following existing pricing.ts pattern
- SaveQuoteDialog gathers full state from pricing, crew-config, and costs-config stores synchronously and builds complete quote payload with MSN snapshots
- QuoteList with debounced search, status filter dropdown, and inline status change dropdown
- Quote detail page at /quotes/[id] that loads all 3 Zustand stores from saved snapshot data, enabling all existing tabs (P&L, Crew, Costs) to reflect the loaded quote
- DashboardSummary gains "Save as Quote" button that opens dialog when calculation results exist
- Quotes page replaced from placeholder to fully functional Server Component with initial data fetch

## Task Commits

Each task was committed atomically:

1. **Task 1: Server Actions and store loadFromQuote/loadFromSnapshot actions** - `c61bce9` (feat)
2. **Task 2: SaveQuoteDialog, QuoteList, StatusBadge, and quote list page** - `4d3cea3` (feat)
3. **Task 3: Quote detail page with fork behavior** - `204a781` (feat)

## Files Created/Modified
- `nextjs-project/src/app/actions/quotes.ts` - 4 Server Actions for quote CRUD following existing auth/fetch pattern
- `nextjs-project/src/components/quotes/StatusBadge.tsx` - Colored pill badge for draft/sent/accepted/rejected statuses
- `nextjs-project/src/components/quotes/SaveQuoteDialog.tsx` - Modal dialog with client name/code inputs, gathers all 3 store snapshots
- `nextjs-project/src/components/quotes/QuoteList.tsx` - Filterable table with search, status filter, inline status update
- `nextjs-project/src/app/(dashboard)/quotes/page.tsx` - Server Component replacing placeholder, fetches initial quotes
- `nextjs-project/src/app/(dashboard)/quotes/[id]/page.tsx` - Server Component for quote detail with cookie forwarding
- `nextjs-project/src/app/(dashboard)/quotes/[id]/QuoteDetailClient.tsx` - Client component loading stores from snapshots, showing header/metrics/MSN breakdown
- `nextjs-project/src/stores/pricing-store.ts` - Added loadFromQuote action to PricingStore interface and implementation
- `nextjs-project/src/stores/crew-config-store.ts` - Added loadFromSnapshot action
- `nextjs-project/src/stores/costs-config-store.ts` - Added loadFromSnapshot action
- `nextjs-project/src/components/pricing/DashboardSummary.tsx` - Added "Save as Quote" button and SaveQuoteDialog integration

## Decisions Made
- SaveQuoteDialog uses synchronous getState() from all 3 Zustand stores to gather the complete quote snapshot -- no async needed since Zustand stores are synchronous
- QuoteDetailClient reconstructs MsnInput and MsnPnlResult arrays from quote_msn_snapshots, and computes totalResult by averaging per-MSN breakdowns
- Fork behavior implemented by setting projectId=null in loadFromQuote -- editing and saving from Dashboard creates a new quote
- QuoteList shows status dropdown for all users, relying on API's creator-or-admin permission check, with error toast on unauthorized attempts
- Quote detail page uses "Fork and Edit on Dashboard" button that navigates to /dashboard with stores already populated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing Link import in QuoteDetailClient**
- **Found during:** Task 3
- **Issue:** QuoteDetailClient used `<Link>` component for navigation hints but was missing the import from next/link
- **Fix:** Added `import Link from 'next/link'` to the client component
- **Files modified:** `nextjs-project/src/app/(dashboard)/quotes/[id]/QuoteDetailClient.tsx`
- **Verification:** TypeScript compiles clean after fix
- **Committed in:** `204a781` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Simple missing import, no scope creep.

## Issues Encountered
None beyond the missing import documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full quote management flow operational: save from Dashboard, browse quotes, open with all data loaded, status management
- Checkpoint pending: human verification of the complete flow
- PDF export deferred (QUOT-06) pending Excel summary file from user
- Fork behavior ready: editing a loaded quote and saving creates a new quote

## Self-Check: PASSED

All 11 files verified present. All 3 task commits (c61bce9, 4d3cea3, 204a781) found in git log.

---
*Phase: 04-quote-persistence-and-history*
*Completed: 2026-03-09*
