# Phase 2: Aircraft Master Data - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Aircraft records with MSN, type, registration, and all cost parameters (fixed rates, variable rates, EPR matrices, escalation rates) stored in the database and browsable by users. Admin can update cost parameters. Data initially seeded from Excel, with admin upload for future additions. This phase provides the aircraft data that the pricing engine (Phase 3) consumes.

</domain>

<decisions>
## Implementation Decisions

### Data model (from Excel audit)
- **Per MSN, store these cost parameters:**
  - **Fixed monthly rates (USD):** Lease Rent, 6Y Check, 12Y Check, LDG
  - **Variable rates (USD, per engine):** APU rate, LLP #1 rate, LLP #2 rate
  - **EPR matrix:** Per-MSN table mapping cycle ratio × environment (Benign/Hot) → EPR rate. Each MSN has different cycle ratio steps and different numbers of rows. System must interpolate between rows when cycle ratio falls between defined values.
  - **Escalation rates (%):** EPR escalation, LLP escalation, AF+APU escalation — per MSN
- **Currency handling:** Store original USD values (contracts with lessors are in USD). Two exchange rates: adjustable rate (used for pricing) and live USD/EUR rate (for FX exposure comparison). All pricing outputs in EUR using the adjustable rate.
- **11 MSNs initially:** 3055, 3378, 3461, 3570, 3605, 4247, 5228, 5931, 1932, 1960, 1503 — fleet will grow over time
- **Aircraft identity fields:** MSN, aircraft type (all A320 family currently), registration

### Aircraft list page
- Table columns: MSN, type, registration, all fixed rates shown in both USD and EUR side by side
- Click a row to navigate to aircraft detail page

### Data import flow
- **Initial load:** Python seed script reads the provided Excel file (`UNA Pricing Model 1 year.xlsx`) and populates the database with all 11 aircraft and their complete cost data including EPR matrices
- **Future additions:** Admin uploads via simple standardized Excel/CSV template through the web UI — not the complex multi-sheet format
- **EPR matrix entry:** Both UI entry (admin adds/edits rows through web app) and Excel upload supported for EPR tables

### Claude's Discretion
- Aircraft list: search implementation (filter-as-you-type vs search button), pagination approach
- Aircraft detail page: layout structure (sections vs tabs vs single table), edit flow (immediate save vs draft)
- EPR matrix editing UX (inline cell editing vs form modal)
- Escalation rates: whether to show/edit on detail page
- Upload merge behavior (upsert vs replace)
- Detail page USD/EUR display approach

</decisions>

<specifics>
## Specific Ideas

- "Use the Excel as the base for the pricing — it contains all the formula and all the cost parameters you need"
- FX rate exposure is commercially important — the team wants to see the difference between what they're pricing at (adjustable rate) and reality (live rate)
- EPR is the most complex parameter — it's a per-MSN lookup matrix that depends on cycle ratio input AND environment (Benign vs Hot), with interpolation between defined steps
- LLP is calculated as rate × flight cycles; EPR is looked up from matrix by cycle ratio and multiplied by FH
- 6Y, 12Y, LDG, and lease rent are fixed monthly — not dependent on flying hours or cycles

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseRepository` (fastapi-project/app/db/base_repository.py): Extend for AircraftRepository with fetch_one, fetch_many, execute helpers
- `UserRepository` (fastapi-project/app/users/repository.py): Pattern to follow — raw SQL queries, Pydantic schemas for validation
- `PlaceholderPage` (nextjs-project/src/components/ui/PlaceholderPage.tsx): Currently shows "Aircraft master data and cost parameters arrive in Phase 2" — will be replaced with real aircraft list
- Auth middleware and `get_current_user` dependency: Protect all aircraft API routes
- `require_admin` dependency: Gate admin-only operations (create, update, upload)

### Established Patterns
- Raw SQL via asyncpg (no ORM) — all queries hand-written
- Pydantic schemas for request/response validation
- Service layer for business logic between router and repository
- AeroVista-style dark theme, Tailwind CSS, Zustand for state
- Server Actions pattern for form submissions

### Integration Points
- Database: New `aircraft`, `aircraft_rates`, and `epr_matrix` tables (extend existing schema)
- API: New `/aircraft` routes mounted in main.py alongside existing `/auth` and `/admin/users`
- Frontend: Replace aircraft placeholder page with real list/detail pages
- Sidebar: Aircraft nav item already exists and links to `/aircraft`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-aircraft-master-data*
*Context gathered: 2026-03-05*
