# Phase 4: Quote Persistence and History - Context

**Gathered:** 2026-03-09
**Status:** Blocked -- waiting for Excel summary file

<domain>
## Phase Boundary

Save, retrieve, and manage pricing quotes as auditable records. Users can save a completed pricing calculation as a named quote, view it later with full fidelity (all tabs populated), change its status, and run sensitivity analysis on any input parameter. Quotes are immutable snapshots -- loading a quote creates an editable working copy (fork), and changes produce new quotes.

</domain>

<decisions>
## Implementation Decisions

### Quote snapshot depth -- FULL APP STATE
- **When a user saves a quote, capture EVERYTHING:** Dashboard inputs + summary, full monthly P&L breakdown, all crew cost assumptions, all aircraft cost parameters, all pricing config values, exchange rate, margin.
- **Loading a saved quote populates ALL tabs:** Dashboard (inputs + summary), P&L (full financial statement), Crew (cost assumptions), Aircraft (cost parameters), Costs (pricing config). The user sees the exact state of the app at the time the quote was created.
- **Both per-MSN and total project results stored.** Quote detail can show individual MSN P&L or total project (same MSN switcher behavior as current P&L page).
- **Schema implication:** Quote record stores full denormalized data -- not just FK references to configs (since we need to display everything without recalculation). This means storing: all MsnInput values, all MsnPnlResult values, ComponentBreakdown, monthly P&L arrays, crew config snapshot, pricing config snapshot, aircraft cost snapshot.

### Quote editability -- FORK BEHAVIOR
- Loading a saved quote populates all tabs as an **editable working copy**.
- User can freely modify inputs (MGH, margin, exchange rate, etc.) and see recalculated results.
- Changes create a **NEW quote** when saved -- the original quote remains immutable.
- This is "fork" behavior: open existing -> modify -> save as new. Original never changes.

### Quote detail view layout -- WAITING FOR EXCEL
- The quote detail view (how saved quotes display their summary) depends on an Excel summary file the user will share.
- **Planning is BLOCKED** until this file is received.
- Once received, the layout will match the Excel summary structure exactly.

### Sensitivity analysis
- **Parameters:** User can vary **any single input** from a dropdown (MGH, margin, exchange rate, cycle ratio, period length, etc.).
- **Steps:** Fixed 5 data points: -20%, -10%, base value, +10%, +20% from current input value.
- **Display:** Both a comparison table (exact numbers) and a line chart (visual trend) on the same page.
- **Location:** Separate page (/sensitivity) with its own sidebar nav item.
- **How it works:** Pick a parameter, system calculates 5 variants, shows how the final EUR/BH rate changes across the range.

### Quote workflow & status
- **Status values:** Draft, Sent, Accepted, Rejected -- **purely informational labels**. No hard locks or system-enforced gating.
- **Permissions:** Only the quote **creator** or an **admin** can change a quote's status. Other users can view but not modify.
- **Quote numbers:** Auto-generated with **user-chosen client code prefix** + sequential number (e.g., EZJ-001, RYR-002). System ensures uniqueness.
- **No notes field.** Quote data speaks for itself.

### Claude's Discretion
- Database schema design for quote snapshots (how to efficiently store full app state)
- Quote list page: search/filter UI, sorting options, pagination approach
- Sensitivity analysis: chart library choice, which parameters to include in dropdown
- Quote number format details (separator, padding, prefix validation)
- How to serialize monthly P&L arrays for storage (JSONB vs normalized tables)

</decisions>

<specifics>
## Specific Ideas

- "I want to have a full monthly P&L, not only that. Whenever I choose a quote, I want all the tabs to be filled with the data from that quote."
- "I want to have dashboard with inputs and summary filled out, I want to have a full P&L from that quote, I want to have all the cost assumptions from crew tab, aircraft tab, costs tab."
- "I want it to look like summary from the excel file that I will share" (for quote detail view)
- "I want to look like summary table that I will share in excel" (for PDF export)
- Quote numbers: auto-generated with client code prefix (e.g., EZJ-001)
- Status is for tracking only, no functional locks

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pricing-store.ts` -- Full MsnInput, MsnPnlResult, ComponentBreakdown types. Quote save captures this entire store state.
- `crew-config-store.ts`, `costs-config-store.ts` -- Config stores that need to be snapshot into quotes.
- `PnlTable.tsx` -- P&L rendering component. Quote detail view reuses this in read-only or fork mode.
- `MsnSwitcher.tsx` -- MSN toggle. Reusable in quote detail view.
- `pricing_projects` + `project_msn_inputs` tables -- Existing input storage. Quotes extend this with frozen outputs.
- `pricing_config`, `crew_config` tables -- Versioned configs with FK references. Quote stores the config values directly (denormalized) for full fidelity.
- Server Actions pattern (`app/actions/pricing.ts`) -- Quote CRUD actions follow same pattern.
- `BaseRepository` + domain repos -- Quote repository extends same base class.
- Pydantic schemas with Decimal types -- Quote schemas follow same precision patterns.

### Established Patterns
- Zustand stores with string-typed Decimal values (no floats)
- Server Components for initial data fetch -> client components for interaction
- Server Actions with cookie auth + error union returns
- Append-only versioned configs (is_current flag)
- AeroVista dark theme: bg-gray-900, gray-800 borders, gray-100 text
- Raw SQL via asyncpg with BaseRepository

### Integration Points
- Database: New `quotes` and `quote_msn_snapshots` tables (plus possibly JSONB columns for monthly data)
- API: New `/quotes` routes alongside existing `/pricing` and `/aircraft`
- Frontend: Replace quotes placeholder page, add /sensitivity page, add sidebar nav items
- Sidebar: Add "Sensitivity" nav item, "Quotes" already exists
- Quote loading: Populates pricing-store, crew-config-store, costs-config-store from saved data

</code_context>

<deferred>
## Deferred Ideas

- Quote cloning/duplication as explicit action (v2 -- QUOT-07) -- fork behavior covers the use case for now
- Notes/attachments on quotes (v2 -- QUOT-08) -- user explicitly declined notes for v1
- Multi-parameter sensitivity (vary 2+ inputs simultaneously) -- v1 does single-parameter only
- Quote versioning (multiple versions of same quote number) -- v1 uses fork-to-new approach instead
- **PDF export (QUOT-06)** -- BLOCKED pending Excel summary file and company branding assets from user. The API has a 501 stub endpoint at GET /quotes/{id}/pdf ready for implementation. **Unblock conditions:** (1) User provides the Excel summary file that defines PDF layout, (2) User provides company logo and branding details. Once both are received, create a new plan implementing PDF generation with WeasyPrint server-side in FastAPI. This can be done as a standalone plan in Phase 4 or Phase 5.

</deferred>

<blockers>
## Blockers

- **BLOCKING (QUOT-06 deferred):** Excel summary file needed from user before implementing PDF export. The 501 stub endpoint exists and is ready. Once the file and branding assets are received, PDF generation can be implemented as a standalone plan.
- **BLOCKING:** Company logo and branding details needed for PDF export.

</blockers>

---

*Phase: 04-quote-persistence-and-history*
*Context gathered: 2026-03-09*
