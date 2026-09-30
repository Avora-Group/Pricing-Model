# Phase 3: Pricing Engine - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Formula-accurate EUR/BH calculation across all seven ACMI cost components (A, C, M, I, DOC, Other COGS, Overhead) with full P&L statement matching the Excel workbook exactly. Project-based pricing (multiple MSNs per client), Dashboard as Summary page with per-MSN operational inputs, and P&L page replicating "UNA Project by AC" sheet structure. Crew cost assumptions managed on a dedicated sidebar page. All cost assumptions admin-editable through the UI.

</domain>

<decisions>
## Implementation Decisions

### Cost component structure
- **A (Aircraft):** All-inclusive component — Lease Rent + all MR rates (6Y Check, 12Y Check, LDG, EPR, LLP, APU). All aircraft cost data already stored in Phase 2 tables.
- **C (Crew):** Two sub-components:
  - **Fixed:** Pilot salaries + cabin crew salaries multiplied by crew sets (from Summary/Dashboard). Training cost = total budget / average active fleet (monthly). Uniform cost = same pattern.
  - **Variable:** Per diems = rate from C sheet × crew sets. Accommodation/travel = monthly rate per aircraft from C sheet (total budget / average active fleet).
  - **A320 vs A321 differences:** A321 has 1 senior + 4 regular cabin attendants; A320 has 1 senior + 3 regular cabin attendants.
  - **Lease type input:** Wet (pilots + full cabin crew), Damp (pilots only), Moist (pilots + 1 senior attendant, no regular). Lease type affects crew cost only, not other components.
- **M (Maintenance):** Two sub-components:
  - **Fixed:** Line maintenance, base maintenance, personnel salary, c-check, training — monthly rates taken from M/I/Overhead sheet. Personnel salary and training have per-aircraft calculation formulas.
  - **Variable:** Spare parts rate (from sheet) × BH (input from dashboard). Per diems amount taken directly from sheet.
- **I (Insurance):** Fixed USD amount converted to EUR using the adjustable exchange rate.
- **DOC (Direct Operating Costs):** Total budget / average active fleet.
- **Other COGS:** From M/I/Overhead & Other COGS sheet.
- **Overhead:** Total budget / average active fleet.

### P&L structure (NOT a calculator)
- **The pricing page is a full P&L statement** — both revenue and cost sides, replicating the "UNA Project by AC" sheet structure exactly.
- Revenue = EUR/BH rate × block hours. Costs = all 7 components calculated. P&L = Revenue - Costs.
- **Revenue forecast and Cost forecast sheets** contain all calculation formulas that feed into the P&L.
- The "Pricing Calculator" sidebar item should be renamed to "P&L" or similar.

### Project-based pricing
- A pricing project can include **multiple MSNs** (a client may want 2+ aircraft).
- **Dashboard/Summary page:** Operational inputs per MSN — each MSN has its own MGH, Cycle Ratio, Environment, Period. Each can have different values.
- **P&L page:** MSN switcher to view P&L for a specific MSN, OR total project P&L (all MSNs combined).
- Margin input produces final EUR/BH rate.

### Crew sidebar page
- Crew cost assumptions need their own dedicated page on the sidebar (like Aircraft has its own page).
- Must show all crew cost parameters: salaries (pilot, senior attendant, regular attendant), per diem rates, accommodation rates, training budgets, uniform budgets.
- Parameters differ by aircraft type (A320 vs A321 cabin crew composition).
- All assumptions admin-editable through the UI.

### Dashboard = Summary sheet
- Dashboard should replicate the Excel Summary sheet layout.
- Contains per-MSN operational inputs (MGH, Cycle Ratio, Environment, Period, Lease Type).
- Shows the adjustable USD/EUR exchange rate as a global project input.
- Shows summary statistics derived from the P&L calculations.

### Exchange rate & configuration
- **Adjustable USD/EUR exchange rate:** Global for the project, set on the Dashboard. All EUR calculations use this rate.
- **All cost assumptions editable:** Crew salaries, per diem rates, insurance amounts, spare parts rates, maintenance rates, DOC budgets, overhead budgets — everything from the Excel sheets must be editable through the UI.
- **Admin-only permissions for now:** Admin controls all cost assumption edits. Admin can grant access to other users in the future.
- Exchange rate also stored in DB (replacing the hardcoded Decimal("0.85") from Phase 2).

### Excel formula replication
- **Exact match required:** The web application must produce identical numbers to the Excel workbook when given the same inputs. No approximations.
- **Full audit of all 7 sheets:** Summary, UNA Project by AC, Rev forecast, Cost forecast, A, C, M/I/Overhead & Other COGS — complete formula extraction before coding.
- **Automated test fixtures:** Create test cases from the Excel with specific inputs, record expected outputs, verify the engine matches exactly.
- Revenue forecast sheet and Cost forecast sheet contain the calculation formulas; UNA Project by AC is the P&L output.

### Claude's Discretion
- How to structure the pricing_config and crew_config database tables
- API endpoint design for the pricing calculation
- How to implement real-time calculation updates (server-side vs client-side)
- P&L table styling and responsive layout
- How to handle the multi-MSN project data model (inline vs separate project entity)
- Test fixture format and number of test scenarios
- How to audit and extract Excel formulas programmatically vs manually

</decisions>

<specifics>
## Specific Ideas

- "I need you to copy the exact structure of P&L table from UNA project by AC excel sheet to web application"
- "Revenue forecast and cost forecast sheets are used for all calculations that are made and then transferred to P&L to have a full picture of a financial statement"
- "We don't need pricing calculator tab on sidebar, instead of that I would like to see P&L like UNA project by AC sheet"
- "Dashboard should look like Summary sheet"
- "There should be a switcher where you can choose MSN or you can choose total project"
- "In the dashboard put inputs for each MSN and then when we go to P&L we can choose to see performance of specific MSN or total project"
- Per diems and fixed salaries differ for A320 and A321 cabin crew
- Wet/Damp/Moist lease type selection as a pricing input
- "All the cost assumptions should be editable in case of any changes in the future"
- Spare parts cost = rate from M/I sheet × BH amount (dashboard input)
- Insurance is fixed USD amount, converted to EUR
- Personnel salary and training in M component have per-aircraft calculation formulas

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AircraftRepository.fetch_by_msn()` — Load aircraft rates + escalation for A component calculation
- `AircraftRepository.fetch_epr_matrix()` — EPR lookup table for cycle-based rate calculation
- `apply_eur_conversion()` in aircraft/service.py — EUR conversion pattern with Decimal precision (will extend to pricing)
- `DEFAULT_ADJ_RATE = Decimal("0.85")` — Current hardcoded rate, Phase 3 moves to DB
- Server Actions pattern (actions/aircraft.ts) — Form mutation pattern for pricing config updates
- Server Components for data fetching with cookie forwarding — Reuse for P&L page
- `require_admin` dependency — Gate cost assumption edits

### Established Patterns
- Raw SQL via asyncpg with BaseRepository — extend for PricingConfigRepository, CrewConfigRepository
- Pydantic schemas with Decimal types — all monetary fields typed precisely
- Service layer for business logic — pricing calculation engine goes here
- AeroVista dark theme with Tailwind CSS — P&L table styling
- Zustand for client state — MSN switcher state, form inputs

### Integration Points
- Database: New tables needed (pricing_config, crew_config, possibly project/session tables)
- API: New /pricing routes alongside existing /aircraft and /auth
- Frontend: Replace pricing placeholder page with P&L view, update Dashboard from placeholder to Summary
- Sidebar: Rename "Pricing" to "P&L", add "Crew" nav item
- Aircraft data: Pricing engine consumes aircraft_rates and epr_matrix_rows tables directly

</code_context>

<deferred>
## Deferred Ideas

- Live USD/EUR rate comparison (showing FX exposure vs adjustable rate) — noted in Phase 2, can add as enhancement
- Sensitivity analysis (vary one input, see how rate changes) — Phase 4 already covers SENS-01, SENS-02
- Admin granting edit permissions to other users — future auth enhancement (role-based access beyond admin/user)

</deferred>

---

*Phase: 03-pricing-engine*
*Context gathered: 2026-03-05*
