# Phase 3: Pricing Engine - Research

**Researched:** 2026-03-05
**Domain:** ACMI pricing calculation engine, P&L statement replication, config versioning, multi-MSN project model
**Confidence:** HIGH

## Summary

Phase 3 is the most formula-intensive phase of the entire project. It transforms the static aircraft cost data from Phase 2 into a live P&L calculation engine that replicates the Excel workbook "UNA Pricing Model 1 year.xlsx" exactly. The phase spans seven cost components (Aircraft, Crew, Maintenance, Insurance, DOC, Other COGS, Overhead), each with distinct sub-formulas, and combines them into a full revenue/cost P&L statement per MSN or aggregated across a project.

The existing codebase provides a solid foundation: asyncpg with raw SQL, BaseRepository pattern, Pydantic schemas with Decimal types, FastAPI dependency injection with admin gating, and a Next.js 16 frontend with Server Components, Server Actions, Zustand, and Tailwind CSS. The pricing engine extends these patterns with new database tables (pricing_config, crew_config, project/session tables), a pure-Python calculation service using only `decimal.Decimal`, and a frontend P&L view that replaces the current pricing placeholder page. The Dashboard placeholder also becomes the Summary/operational inputs page.

The critical technical challenge is **exact formula replication** -- the web app must produce identical numbers to the Excel workbook given the same inputs. This requires a full audit of all relevant Excel sheets (Summary, UNA Project by AC, Revenue Forecast, Cost Forecast, A, C, M/I/Overhead & Other COGS), extraction of every formula, and automated test fixtures comparing engine output to known Excel results. The config versioning requirement (CONF-02, CONF-03) adds a second dimension: pricing configurations must be versioned so that saved quotes (Phase 4) reference the exact config snapshot used at creation time.

**Primary recommendation:** Build a pure-Python pricing service with zero external dependencies (only stdlib `decimal`), backed by versioned config tables, with automated test fixtures extracted from the Excel workbook to verify exact numerical match.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **A (Aircraft):** All-inclusive component -- Lease Rent + all MR rates (6Y Check, 12Y Check, LDG, EPR, LLP, APU). All aircraft cost data already stored in Phase 2 tables.
- **C (Crew):** Two sub-components:
  - **Fixed:** Pilot salaries + cabin crew salaries multiplied by crew sets (from Summary/Dashboard). Training cost = total budget / average active fleet (monthly). Uniform cost = same pattern.
  - **Variable:** Per diems = rate from C sheet x crew sets. Accommodation/travel = monthly rate per aircraft from C sheet (total budget / average active fleet).
  - **A320 vs A321 differences:** A321 has 1 senior + 4 regular cabin attendants; A320 has 1 senior + 3 regular cabin attendants.
  - **Lease type input:** Wet (pilots + full cabin crew), Damp (pilots only), Moist (pilots + 1 senior attendant, no regular). Lease type affects crew cost only, not other components.
- **M (Maintenance):** Two sub-components:
  - **Fixed:** Line maintenance, base maintenance, personnel salary, c-check, training -- monthly rates taken from M/I/Overhead sheet. Personnel salary and training have per-aircraft calculation formulas.
  - **Variable:** Spare parts rate (from sheet) x BH (input from dashboard). Per diems amount taken directly from sheet.
- **I (Insurance):** Fixed USD amount converted to EUR using the adjustable exchange rate.
- **DOC (Direct Operating Costs):** Total budget / average active fleet.
- **Other COGS:** From M/I/Overhead & Other COGS sheet.
- **Overhead:** Total budget / average active fleet.
- **P&L structure (NOT a calculator):** The pricing page is a full P&L statement -- both revenue and cost sides, replicating the "UNA Project by AC" sheet structure exactly. Revenue = EUR/BH rate x block hours. Costs = all 7 components calculated. P&L = Revenue - Costs.
- **Revenue forecast and Cost forecast sheets** contain all calculation formulas that feed into the P&L.
- **The "Pricing Calculator" sidebar item should be renamed to "P&L" or similar.**
- **Project-based pricing:** A pricing project can include multiple MSNs (a client may want 2+ aircraft). Dashboard/Summary page has operational inputs per MSN -- each MSN has its own MGH, Cycle Ratio, Environment, Period. Each can have different values. P&L page has MSN switcher to view P&L for a specific MSN, OR total project P&L (all MSNs combined). Margin input produces final EUR/BH rate.
- **Crew sidebar page:** Crew cost assumptions need their own dedicated page on the sidebar. Must show all crew cost parameters: salaries (pilot, senior attendant, regular attendant), per diem rates, accommodation rates, training budgets, uniform budgets. Parameters differ by aircraft type (A320 vs A321 cabin crew composition). All assumptions admin-editable through the UI.
- **Dashboard = Summary sheet:** Dashboard should replicate the Excel Summary sheet layout. Contains per-MSN operational inputs (MGH, Cycle Ratio, Environment, Period, Lease Type). Shows the adjustable USD/EUR exchange rate as a global project input. Shows summary statistics derived from the P&L calculations.
- **Exchange rate & configuration:** Adjustable USD/EUR exchange rate global for the project, set on the Dashboard. All EUR calculations use this rate. All cost assumptions editable: crew salaries, per diem rates, insurance amounts, spare parts rates, maintenance rates, DOC budgets, overhead budgets. Admin-only permissions for now. Exchange rate stored in DB (replacing hardcoded Decimal("0.85") from Phase 2).
- **Excel formula replication:** Exact match required. Full audit of all 7 sheets. Automated test fixtures. Revenue forecast sheet and Cost forecast sheet contain the calculation formulas; UNA Project by AC is the P&L output.

### Claude's Discretion
- How to structure the pricing_config and crew_config database tables
- API endpoint design for the pricing calculation
- How to implement real-time calculation updates (server-side vs client-side)
- P&L table styling and responsive layout
- How to handle the multi-MSN project data model (inline vs separate project entity)
- Test fixture format and number of test scenarios
- How to audit and extract Excel formulas programmatically vs manually

### Deferred Ideas (OUT OF SCOPE)
- Live USD/EUR rate comparison (showing FX exposure vs adjustable rate) -- noted in Phase 2, can add as enhancement
- Sensitivity analysis (vary one input, see how rate changes) -- Phase 4 already covers SENS-01, SENS-02
- Admin granting edit permissions to other users -- future auth enhancement (role-based access beyond admin/user)

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRIC-01 | User can enter pricing inputs: MGH, Cycle Ratio, Environment, Period, MSN | Dashboard/Summary page with per-MSN input forms; Zustand store for real-time state; project data model with MSN entries |
| PRIC-02 | System calculates per-BH cost for each component: Aircraft, Crew, Maintenance, Insurance, DOC, Other COGS, Overhead | Pure-Python pricing service with Decimal arithmetic; 7 component calculators; formula replication from Excel audit |
| PRIC-03 | User can enter margin percentage and see final EUR/BH rate | Margin input on P&L page; `final_rate = cost_per_bh / (1 - margin)` or `cost_per_bh * (1 + margin)` depending on Excel formula; real-time recalculation |
| PRIC-04 | Calculation results update in real-time as inputs change | Client-side calculation with debounced API calls; Zustand for input state; no page refresh needed |
| PRIC-05 | Calculation output matches Excel workbook exactly (verified with test fixtures) | Excel formula audit; hardcoded test fixtures with known inputs/outputs; pytest parametrized tests comparing engine output to expected values |
| PRIC-06 | All monetary calculations use Decimal precision (never floating-point) | Python `decimal.Decimal` throughout service layer; PostgreSQL `NUMERIC` for all monetary columns; Pydantic Decimal fields |
| CONF-01 | Admin can view and update base rates and pricing parameters via admin page | Crew config page + admin page for M/I/Overhead parameters; admin-gated PUT endpoints; Server Action mutation pattern |
| CONF-02 | Pricing config changes are versioned (old quotes reference the config version they were created with) | Versioned config table with auto-incrementing version_id and created_at; quotes store config_version_id FK |
| CONF-03 | System prevents config changes from altering previously saved quotes | Append-only config pattern: new version = INSERT new row, never UPDATE existing; quotes reference immutable version row |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| asyncpg | 0.30.0 | PostgreSQL queries returning Decimal for NUMERIC columns | Already in project; returns Python Decimal for NUMERIC types by default |
| FastAPI | 0.115.6 | API framework with dependency injection | Already in project; established router/dependency pattern |
| Pydantic | 2.10.4 | Request/response schema validation with Decimal | Already in project; supports Decimal fields natively |
| decimal (stdlib) | builtin | All pricing arithmetic | Python stdlib; no external dependency; exact decimal arithmetic |
| Next.js | 16.1.6 | Frontend with Server Components and App Router | Already in project; data fetching + Server Actions established |
| Tailwind CSS | 4.x | Styling -- dark theme P&L tables | Already in project; AeroVista style established |
| Zustand | 5.0.11 | Client state for pricing inputs, MSN switcher, real-time form state | Already in project; persist middleware for sidebar |
| Zod | 4.3.6 | Client-side input validation before API call | Already in project; form validation |
| lucide-react | 0.577.0 | Icons for sidebar nav items (Crew page) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openpyxl | 3.1.5 | Read Excel workbook for formula audit and test fixture extraction | Seed script and test fixture generation only |
| bisect (stdlib) | builtin | EPR matrix interpolation lookup | When cycle ratio falls between defined steps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side calculation | Client-side JS calculation | Server-side ensures Decimal precision; client-side gives instant UX. **Recommendation: Hybrid -- calculate on server via API, debounce client calls for real-time feel** |
| Append-only config versioning | Temporal tables / SCD Type 2 | Append-only is simpler, sufficient for config versioning with < 100 versions expected |
| Zustand for pricing form state | React useState / useReducer | Zustand already in project; persist middleware could save draft projects; consistent with existing sidebar store pattern |

**Installation:**
```bash
# No new packages needed -- all libraries already in project
# Backend: asyncpg, fastapi, pydantic, openpyxl already in requirements.txt
# Frontend: next, react, zustand, zod, lucide-react already in package.json
```

## Architecture Patterns

### Recommended Project Structure

#### Backend
```
fastapi-project/
├── app/
│   ├── pricing/
│   │   ├── __init__.py
│   │   ├── repository.py      # PricingConfigRepository, CrewConfigRepository
│   │   ├── service.py          # Pure calculation engine (all 7 components)
│   │   ├── schemas.py          # Pydantic models for inputs/outputs
│   │   └── router.py           # /pricing endpoints
│   ├── aircraft/               # Existing -- pricing reads from these tables
│   │   └── ...
│   └── main.py                 # Add pricing router
├── migrations/
│   └── 003_create_pricing_config.sql
├── scripts/
│   └── seed_pricing_config.py  # Seed from Excel C, M/I/Overhead sheets
└── tests/
    ├── test_pricing_service.py # Unit tests for calculation engine
    ├── test_pricing_fixtures.py # Excel-verified test fixtures
    └── test_pricing.py          # Integration tests for API endpoints
```

#### Frontend
```
nextjs-project/src/
├── app/(dashboard)/
│   ├── dashboard/
│   │   └── page.tsx            # Summary page (replace placeholder)
│   ├── pnl/                    # Renamed from /pricing
│   │   └── page.tsx            # P&L statement view
│   ├── crew/                   # New sidebar page
│   │   └── page.tsx            # Crew cost assumptions
│   └── aircraft/               # Existing
├── components/
│   ├── pricing/
│   │   ├── DashboardSummary.tsx    # Per-MSN input grid
│   │   ├── MsnInputRow.tsx         # Single MSN operational inputs
│   │   ├── PnlTable.tsx            # P&L statement table
│   │   ├── MsnSwitcher.tsx         # MSN/Total project toggle
│   │   └── MarginInput.tsx         # Margin % input with rate display
│   └── crew/
│       └── CrewConfigTable.tsx     # Admin-editable crew parameters
├── stores/
│   ├── sidebar-store.ts        # Existing
│   └── pricing-store.ts        # Pricing inputs, selected MSN, project state
└── app/actions/
    ├── pricing.ts              # Server Actions for config updates
    └── aircraft.ts             # Existing
```

### Pattern 1: Pure Calculation Service (No Side Effects)

**What:** A stateless Python module that takes structured inputs and returns calculated outputs using only `decimal.Decimal`. No database calls, no I/O -- pure functions.

**When to use:** All pricing calculations. The service receives pre-fetched data (aircraft rates, config values, operational inputs) and returns the full P&L breakdown.

**Example:**
```python
# fastapi-project/app/pricing/service.py
from __future__ import annotations
from decimal import Decimal
from dataclasses import dataclass

@dataclass
class PricingInputs:
    """Operational inputs for a single MSN pricing calculation."""
    msn: int
    mgh: Decimal              # Monthly Guaranteed Hours
    cycle_ratio: Decimal      # Flight cycles per flight hour
    environment: str          # "benign" or "hot"
    period_months: int        # Contract period in months
    lease_type: str           # "wet", "damp", or "moist"
    exchange_rate: Decimal    # USD/EUR adjustable rate

@dataclass
class AircraftCosts:
    """Aircraft cost data fetched from DB (Phase 2 tables)."""
    lease_rent_usd: Decimal
    six_year_check_usd: Decimal
    twelve_year_check_usd: Decimal
    ldg_usd: Decimal
    apu_rate_usd: Decimal
    llp1_rate_usd: Decimal
    llp2_rate_usd: Decimal
    epr_escalation: Decimal
    llp_escalation: Decimal
    af_apu_escalation: Decimal
    epr_matrix: list[tuple[Decimal, Decimal, Decimal]]  # (cycle_ratio, benign, hot)

@dataclass
class PricingConfig:
    """All non-aircraft pricing parameters from config tables."""
    # Crew
    pilot_salary_monthly: Decimal
    senior_attendant_salary_monthly: Decimal
    regular_attendant_salary_monthly: Decimal
    crew_per_diem_rate: Decimal
    accommodation_monthly_budget: Decimal
    training_total_budget: Decimal
    uniform_total_budget: Decimal
    average_active_fleet: Decimal
    # Maintenance
    line_maintenance_monthly: Decimal
    base_maintenance_monthly: Decimal
    personnel_salary_monthly: Decimal
    c_check_monthly: Decimal
    maintenance_training_monthly: Decimal
    spare_parts_rate: Decimal
    maintenance_per_diem: Decimal
    # Insurance
    insurance_usd: Decimal
    # DOC
    doc_total_budget: Decimal
    # Other COGS
    other_cogs_monthly: Decimal
    # Overhead
    overhead_total_budget: Decimal

@dataclass
class ComponentBreakdown:
    """Per-BH cost breakdown for all 7 components."""
    aircraft_eur_per_bh: Decimal
    crew_eur_per_bh: Decimal
    maintenance_eur_per_bh: Decimal
    insurance_eur_per_bh: Decimal
    doc_eur_per_bh: Decimal
    other_cogs_eur_per_bh: Decimal
    overhead_eur_per_bh: Decimal

    @property
    def total_cost_per_bh(self) -> Decimal:
        return (self.aircraft_eur_per_bh + self.crew_eur_per_bh +
                self.maintenance_eur_per_bh + self.insurance_eur_per_bh +
                self.doc_eur_per_bh + self.other_cogs_eur_per_bh +
                self.overhead_eur_per_bh)


def calculate_pricing(
    inputs: PricingInputs,
    aircraft: AircraftCosts,
    config: PricingConfig,
) -> ComponentBreakdown:
    """Calculate per-BH cost for all 7 ACMI components.

    All arithmetic uses Decimal. Returns EUR/BH breakdown.
    This is a pure function with no side effects.
    """
    bh = inputs.mgh  # Block hours per month
    rate = inputs.exchange_rate

    # A: Aircraft component
    aircraft_eur = _calc_aircraft(inputs, aircraft, rate)

    # C: Crew component
    crew_eur = _calc_crew(inputs, config, rate)

    # M: Maintenance component
    maintenance_eur = _calc_maintenance(inputs, config, rate)

    # I: Insurance
    insurance_eur = (config.insurance_usd * rate) / bh

    # DOC
    doc_eur = (config.doc_total_budget / config.average_active_fleet) / bh

    # Other COGS
    other_cogs_eur = config.other_cogs_monthly / bh

    # Overhead
    overhead_eur = (config.overhead_total_budget / config.average_active_fleet) / bh

    return ComponentBreakdown(
        aircraft_eur_per_bh=aircraft_eur,
        crew_eur_per_bh=crew_eur,
        maintenance_eur_per_bh=maintenance_eur,
        insurance_eur_per_bh=insurance_eur,
        doc_eur_per_bh=doc_eur,
        other_cogs_eur_per_bh=other_cogs_eur,
        overhead_eur_per_bh=overhead_eur,
    )
```

### Pattern 2: Config Versioning (Append-Only)

**What:** Pricing config table uses append-only inserts. Each "update" creates a new version row. A `current_version` view or latest-version query provides the active config. Quotes reference a specific version_id.

**When to use:** All config tables that affect pricing calculations (pricing_config, crew_config).

**Example:**
```sql
-- Migration 003: Pricing config with versioning
CREATE TABLE pricing_config (
    id              SERIAL PRIMARY KEY,
    version         INTEGER NOT NULL DEFAULT 1,
    -- Exchange rate
    exchange_rate   NUMERIC(8,4) NOT NULL DEFAULT 0.85,
    -- Insurance
    insurance_usd   NUMERIC(12,2) NOT NULL,
    -- DOC
    doc_total_budget NUMERIC(12,2) NOT NULL,
    -- Overhead
    overhead_total_budget NUMERIC(12,2) NOT NULL,
    -- Other COGS
    other_cogs_monthly NUMERIC(12,2) NOT NULL,
    -- Maintenance parameters
    line_maintenance_monthly NUMERIC(12,2) NOT NULL,
    base_maintenance_monthly NUMERIC(12,2) NOT NULL,
    personnel_salary_monthly NUMERIC(12,2) NOT NULL,
    c_check_monthly NUMERIC(12,2) NOT NULL,
    maintenance_training_monthly NUMERIC(12,2) NOT NULL,
    spare_parts_rate NUMERIC(10,4) NOT NULL,
    maintenance_per_diem NUMERIC(12,2) NOT NULL,
    -- Fleet size for budget calculations
    average_active_fleet NUMERIC(4,1) NOT NULL DEFAULT 11,
    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      INTEGER REFERENCES users(id),
    is_current      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Only one row can be current at a time
CREATE UNIQUE INDEX idx_pricing_config_current
    ON pricing_config (is_current) WHERE is_current = TRUE;

CREATE TABLE crew_config (
    id              SERIAL PRIMARY KEY,
    version         INTEGER NOT NULL DEFAULT 1,
    aircraft_type   TEXT NOT NULL DEFAULT 'A320',
    -- Salaries
    pilot_salary_monthly NUMERIC(12,2) NOT NULL,
    senior_attendant_salary_monthly NUMERIC(12,2) NOT NULL,
    regular_attendant_salary_monthly NUMERIC(12,2) NOT NULL,
    -- Variable costs
    per_diem_rate   NUMERIC(10,2) NOT NULL,
    accommodation_monthly_budget NUMERIC(12,2) NOT NULL,
    training_total_budget NUMERIC(12,2) NOT NULL,
    uniform_total_budget NUMERIC(12,2) NOT NULL,
    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      INTEGER REFERENCES users(id),
    is_current      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Each aircraft_type can have one current config
CREATE UNIQUE INDEX idx_crew_config_current
    ON crew_config (aircraft_type, is_current) WHERE is_current = TRUE;
```

```python
# Repository pattern for versioned config
class PricingConfigRepository(BaseRepository):
    async def get_current(self) -> dict | None:
        return await self.fetch_one(
            "SELECT * FROM pricing_config WHERE is_current = TRUE"
        )

    async def create_version(self, **fields) -> dict:
        """Create new config version. Marks previous as non-current."""
        # Get current max version
        current = await self.get_current()
        new_version = (current["version"] + 1) if current else 1

        # Mark old as non-current
        if current:
            await self.execute(
                "UPDATE pricing_config SET is_current = FALSE WHERE id = $1",
                current["id"],
            )

        # Insert new version
        # ... dynamic INSERT with new_version ...
        return new_row

    async def get_version(self, version_id: int) -> dict | None:
        """Get a specific config version (for quote reconstruction)."""
        return await self.fetch_one(
            "SELECT * FROM pricing_config WHERE id = $1", version_id
        )
```

### Pattern 3: Multi-MSN Project Model

**What:** A project groups multiple MSNs with per-MSN operational inputs. The project itself holds global settings (exchange rate, margin). Each MSN entry holds its own MGH, cycle ratio, environment, period, and lease type.

**When to use:** Dashboard/Summary page data model and P&L aggregation.

**Example:**
```sql
-- Pricing projects (session-based, not yet saved as quotes)
CREATE TABLE pricing_projects (
    id              SERIAL PRIMARY KEY,
    name            TEXT,
    exchange_rate   NUMERIC(8,4) NOT NULL DEFAULT 0.85,
    margin_percent  NUMERIC(6,4) DEFAULT 0,
    config_version_id INTEGER REFERENCES pricing_config(id),
    crew_config_version_id INTEGER REFERENCES crew_config(id),
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-MSN operational inputs within a project
CREATE TABLE project_msn_inputs (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES pricing_projects(id) ON DELETE CASCADE,
    aircraft_id     INTEGER NOT NULL REFERENCES aircraft(id),
    mgh             NUMERIC(8,2) NOT NULL,        -- Monthly Guaranteed Hours
    cycle_ratio     NUMERIC(6,4) NOT NULL,         -- Flight cycles per flight hour
    environment     TEXT NOT NULL CHECK (environment IN ('benign', 'hot')),
    period_months   INTEGER NOT NULL DEFAULT 12,
    lease_type      TEXT NOT NULL DEFAULT 'wet'
                    CHECK (lease_type IN ('wet', 'damp', 'moist')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, aircraft_id)
);
```

### Pattern 4: Hybrid Real-Time Calculation

**What:** Pricing inputs are managed in a Zustand store on the client. When inputs change, a debounced API call sends all inputs to the server, which calculates using Decimal precision and returns the full P&L breakdown. The UI updates immediately with loading states.

**When to use:** Dashboard input changes, margin changes, MSN operational input changes.

**Example:**
```typescript
// stores/pricing-store.ts
import { create } from 'zustand'

interface MsnInput {
  aircraftId: number
  msn: number
  mgh: string          // String to preserve decimal precision
  cycleRatio: string
  environment: 'benign' | 'hot'
  periodMonths: number
  leaseType: 'wet' | 'damp' | 'moist'
}

interface PricingStore {
  projectId: number | null
  exchangeRate: string
  marginPercent: string
  msnInputs: MsnInput[]
  selectedMsn: number | null   // null = total project view
  pnlResult: PnlResult | null
  isCalculating: boolean
  // Actions
  setExchangeRate: (rate: string) => void
  setMarginPercent: (margin: string) => void
  updateMsnInput: (msn: number, field: string, value: string) => void
  setSelectedMsn: (msn: number | null) => void
  addMsn: (msn: number, aircraftId: number) => void
  removeMsn: (msn: number) => void
}
```

```typescript
// Debounced API call pattern in a component
import { useEffect, useRef } from 'react'

function useCalculation(inputs: MsnInput[], exchangeRate: string) {
  const timerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      // Call server API for Decimal-precision calculation
      const result = await fetch('/api/pricing/calculate', {
        method: 'POST',
        body: JSON.stringify({ inputs, exchangeRate }),
      })
      // Update store with result
    }, 300) // 300ms debounce

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [inputs, exchangeRate])
}
```

### Anti-Patterns to Avoid

- **Client-side Decimal math:** JavaScript `Number` type is IEEE 754 double-precision float. Never do pricing arithmetic in JS. Always send inputs to the Python backend for Decimal calculation and return results. The client only displays.
- **Mutable config rows:** Never UPDATE a pricing_config row in-place. Always INSERT a new version. This ensures CONF-03 (old quotes remain accurate).
- **Hardcoded formulas without audit:** Every formula in the pricing service must trace back to a specific cell reference in the Excel workbook. Document the cell references in code comments.
- **Mixing float and Decimal:** A single `float()` conversion in the calculation chain poisons the entire result. Use `Decimal(str(value))` everywhere, never `Decimal(float_value)`.
- **Monolithic calculation function:** Split each cost component into its own function. This enables targeted testing and makes formula auditing tractable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic | Custom rounding logic | Python `decimal.Decimal` with `quantize()` | Handles banker's rounding, arbitrary precision, and context management |
| EPR interpolation | Custom binary search | `bisect.bisect_left` from stdlib | O(log n) lookup in sorted cycle ratio list; handles edge cases |
| Form debouncing | Manual setTimeout management | `useRef` + `setTimeout` pattern (no library needed) | Simple enough not to need use-debounce; consistent with zero-dependency frontend approach |
| Config versioning | Custom trigger system | Append-only table with `is_current` flag | PostgreSQL partial unique index enforces single current row per category |
| USD-to-EUR conversion | Inline multiplication everywhere | Extend existing `apply_eur_conversion()` pattern | Already established in Phase 2; centralized rate application |

**Key insight:** The pricing engine's complexity is in the business logic (Excel formula replication), not in infrastructure. No new libraries are needed. The challenge is accuracy, not technology.

## Common Pitfalls

### Pitfall 1: Float Contamination in Decimal Chain
**What goes wrong:** A single `float()` conversion anywhere in the calculation pipeline introduces IEEE 754 rounding errors that compound across the 7 components, causing the final EUR/BH rate to differ from the Excel reference by fractions of a cent.
**Why it happens:** Python operators silently promote Decimal to float when mixed. JSON deserialization returns float by default. asyncpg returns Decimal for NUMERIC, but careless dict manipulation can introduce float.
**How to avoid:** Use `Decimal(str(value))` for all conversions. Pydantic schemas with `Decimal` type enforce this at API boundaries. Add a unit test that asserts `isinstance(result, Decimal)` for every calculated field.
**Warning signs:** Test fixtures pass with `assertAlmostEqual` but fail with `assertEqual`. Values end in ...00000001 or ...99999999.

### Pitfall 2: EPR Matrix Interpolation Edge Cases
**What goes wrong:** Cycle ratio input exactly matches a matrix row (no interpolation needed), or falls outside the matrix range (below minimum or above maximum), or the matrix has only one row.
**Why it happens:** Linear interpolation assumes the input is between two known points. Edge cases require clamping or extrapolation rules matching what the Excel workbook does.
**How to avoid:** Document the Excel's exact behavior for edge cases. Use `bisect.bisect_left` for lookup. Clamp to nearest boundary if outside range (verify this matches Excel). Test with exact match, below-min, above-max, and between-rows inputs.
**Warning signs:** `IndexError` or `ZeroDivisionError` in interpolation. Unexpected NaN or infinity values.

### Pitfall 3: Crew Cost Varies by Aircraft Type AND Lease Type
**What goes wrong:** A320 and A321 have different cabin crew compositions. Wet/Damp/Moist lease types include different crew categories. The cross-product of (aircraft_type x lease_type) creates 6 possible crew configurations, each with different total salary calculations.
**Why it happens:** Developers assume a single crew cost formula. The Excel has conditional logic based on both aircraft type and lease type.
**How to avoid:** Build a crew composition lookup: `{(type, lease_type): {pilots: N, senior: N, regular: N}}`. Calculate salaries from composition, not from hardcoded headcounts.
**Warning signs:** Crew costs identical for wet vs damp pricing. A321 crew costs same as A320.

### Pitfall 4: Division by Block Hours When BH is Zero or Very Small
**What goes wrong:** Per-BH cost calculation divides total monthly cost by MGH (monthly guaranteed hours). If user enters 0 or a very small number, the result is infinity or an astronomically large per-BH rate.
**Why it happens:** No input validation on MGH field. Division by zero is not caught.
**How to avoid:** Validate MGH > 0 at the API boundary (Pydantic validator). Set a reasonable minimum (e.g., 50 BH/month). Return a clear error if MGH is invalid, not a calculation result.
**Warning signs:** `DivisionByZero` exception. Extremely large EUR/BH values.

### Pitfall 5: Config Version Race Condition
**What goes wrong:** Admin updates pricing config while a user is in the middle of creating a quote. The quote's calculation uses the old config, but when saved (Phase 4), it references the new config version.
**Why it happens:** The config version is fetched at calculation time, not at quote creation time.
**How to avoid:** Fetch and lock the config_version_id when the pricing project is created. Store it on the project row. All calculations for that project use the stored version, even if a new version is created meanwhile.
**Warning signs:** Recalculating a quote gives different results than the original. Saved quotes show different numbers than when first calculated.

### Pitfall 6: JSON Serialization Loses Decimal Precision
**What goes wrong:** FastAPI's default JSON serializer converts Decimal to float, losing precision. `Decimal("0.1")` becomes `0.1` (float) in JSON, which is actually `0.100000000000000005551115...`.
**Why it happens:** Python's `json` module doesn't handle Decimal natively. FastAPI uses `jsonable_encoder` which converts Decimal to float.
**How to avoid:** Pydantic v2 serializes Decimal as string by default when using `model_dump(mode="json")`. Verify this behavior in tests. Alternatively, configure FastAPI's JSON encoder. The existing aircraft endpoints already work correctly with Decimal fields, so follow the same pattern.
**Warning signs:** API responses have floating-point artifacts. Frontend displays numbers like `157250.00000000001`.

## Code Examples

### EPR Rate Interpolation
```python
# Source: Excel A sheet formula + bisect stdlib
from bisect import bisect_left
from decimal import Decimal

def interpolate_epr(
    matrix: list[tuple[Decimal, Decimal]],  # [(cycle_ratio, rate), ...]
    target_cr: Decimal,
) -> Decimal:
    """Look up EPR rate by cycle ratio with linear interpolation.

    Matrix must be sorted by cycle_ratio ascending.
    If target_cr is below min or above max, clamp to boundary rate.
    If target_cr exactly matches a row, return that row's rate.
    Otherwise, linearly interpolate between the two nearest rows.
    """
    if not matrix:
        raise ValueError("EPR matrix is empty")

    ratios = [row[0] for row in matrix]
    rates = [row[1] for row in matrix]

    # Clamp to boundaries
    if target_cr <= ratios[0]:
        return rates[0]
    if target_cr >= ratios[-1]:
        return rates[-1]

    # Find insertion point
    idx = bisect_left(ratios, target_cr)

    # Exact match
    if ratios[idx] == target_cr:
        return rates[idx]

    # Linear interpolation between idx-1 and idx
    cr_low, rate_low = ratios[idx - 1], rates[idx - 1]
    cr_high, rate_high = ratios[idx], rates[idx]

    fraction = (target_cr - cr_low) / (cr_high - cr_low)
    return rate_low + fraction * (rate_high - rate_low)
```

### Crew Cost Calculation with Lease Type
```python
# Source: Excel C sheet formulas
from decimal import Decimal

# Crew composition by (aircraft_type, lease_type)
CREW_COMPOSITION = {
    ("A320", "wet"):   {"pilots": 2, "senior": 1, "regular": 3},
    ("A320", "damp"):  {"pilots": 2, "senior": 0, "regular": 0},
    ("A320", "moist"): {"pilots": 2, "senior": 1, "regular": 0},
    ("A321", "wet"):   {"pilots": 2, "senior": 1, "regular": 4},
    ("A321", "damp"):  {"pilots": 2, "senior": 0, "regular": 0},
    ("A321", "moist"): {"pilots": 2, "senior": 1, "regular": 0},
}

def calc_crew_cost_per_bh(
    aircraft_type: str,
    lease_type: str,
    crew_sets: int,  # From Summary/Dashboard input
    config: PricingConfig,
    mgh: Decimal,
) -> Decimal:
    """Calculate total crew cost per block hour in EUR.

    Fixed = salaries * crew_sets + training + uniform
    Variable = per_diems * crew_sets + accommodation
    Total / MGH = EUR/BH
    """
    comp = CREW_COMPOSITION.get((aircraft_type, lease_type))
    if not comp:
        raise ValueError(f"Unknown crew config: {aircraft_type}/{lease_type}")

    total_crew = (
        comp["pilots"] * config.pilot_salary_monthly +
        comp["senior"] * config.senior_attendant_salary_monthly +
        comp["regular"] * config.regular_attendant_salary_monthly
    ) * crew_sets

    training = config.training_total_budget / config.average_active_fleet
    uniform = config.uniform_total_budget / config.average_active_fleet

    fixed = total_crew + training + uniform

    per_diems = config.crew_per_diem_rate * Decimal(str(
        comp["pilots"] + comp["senior"] + comp["regular"]
    )) * Decimal(str(crew_sets))
    accommodation = config.accommodation_monthly_budget / config.average_active_fleet

    variable = per_diems + accommodation

    return (fixed + variable) / mgh
```

### P&L API Endpoint
```python
# Source: Established FastAPI patterns from aircraft router
from fastapi import APIRouter, Depends
from app.db.database import get_db
from app.auth.dependencies import get_current_user, require_admin
from app.pricing.repository import PricingConfigRepository, CrewConfigRepository
from app.aircraft.repository import AircraftRepository

router = APIRouter(prefix="/pricing", tags=["pricing"])

@router.post("/calculate")
async def calculate_pnl(
    body: CalculateRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Calculate P&L for one or more MSNs.

    Accepts operational inputs per MSN and returns full component breakdown.
    All calculations use Decimal precision server-side.
    """
    pricing_repo = PricingConfigRepository(db)
    crew_repo = CrewConfigRepository(db)
    aircraft_repo = AircraftRepository(db)

    config = await pricing_repo.get_current()
    crew_configs = {
        "A320": await crew_repo.get_current("A320"),
        "A321": await crew_repo.get_current("A321"),
    }

    results = []
    for msn_input in body.msn_inputs:
        aircraft = await aircraft_repo.fetch_by_msn(msn_input.msn)
        epr_rows = await aircraft_repo.fetch_epr_matrix(aircraft["id"])
        # ... build dataclasses, call calculate_pricing() ...
        results.append(breakdown)

    return {"msn_results": results, "total": aggregate(results)}
```

### Versioned Config Update (Admin Only)
```python
@router.put("/config")
async def update_pricing_config(
    body: UpdatePricingConfigRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Update pricing configuration (admin only).

    Creates a new version (append-only). Previous version preserved
    for quote immutability (CONF-02, CONF-03).
    """
    repo = PricingConfigRepository(db)
    new_version = await repo.create_version(
        created_by=current_user["id"],
        **body.model_dump(exclude_none=True),
    )
    return new_version
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormState` (React) | `useActionState` (React 19) | React 19 / Next.js 15+ | Already adopted in Phase 1; continue using for config update forms |
| Hardcoded exchange rate | DB-backed `pricing_config.exchange_rate` | Phase 3 (this phase) | Replaces `DEFAULT_ADJ_RATE = Decimal("0.85")` in aircraft/service.py |
| Placeholder Dashboard | Summary/Inputs page | Phase 3 (this phase) | Dashboard becomes operational hub for pricing inputs |
| Placeholder Pricing page | Full P&L statement | Phase 3 (this phase) | Replicates "UNA Project by AC" Excel sheet |

**Deprecated/outdated:**
- `DEFAULT_ADJ_RATE` in `aircraft/service.py`: Phase 3 moves this to DB. The aircraft service should accept rate as parameter (already supports `adj_rate` parameter in `apply_eur_conversion`).

## Database Schema Design

### New Tables (Migration 003)

| Table | Purpose | Versioned? | Row Count |
|-------|---------|------------|-----------|
| `pricing_config` | Exchange rate, insurance, DOC, overhead, maintenance parameters | Yes (append-only) | ~1-10 versions |
| `crew_config` | Crew salaries, per diems, accommodation, training, uniforms | Yes (append-only, per aircraft_type) | ~2-20 versions (A320 + A321) |
| `pricing_projects` | Multi-MSN project with global settings | No (mutable) | Grows with usage |
| `project_msn_inputs` | Per-MSN operational inputs within a project | No (mutable) | N per project |

### Column Types
- All monetary: `NUMERIC(12,2)` for dollar amounts, `NUMERIC(10,4)` for rates
- Exchange rate: `NUMERIC(8,4)` -- e.g., 0.8500
- Percentages/ratios: `NUMERIC(6,4)` -- e.g., 0.0500 for 5%
- Fleet size: `NUMERIC(4,1)` -- e.g., 11.0
- Block hours: `NUMERIC(8,2)` -- e.g., 350.00

### Relationship to Existing Tables
```
aircraft (Phase 2) ──────────┐
aircraft_rates (Phase 2) ────┤
epr_matrix_rows (Phase 2) ───┤
                              ├── pricing calculation reads from all
pricing_config (Phase 3) ────┤
crew_config (Phase 3) ───────┘

pricing_projects (Phase 3) ──┬── project_msn_inputs (Phase 3)
                              │       └── aircraft_id FK → aircraft
                              ├── config_version_id FK → pricing_config
                              └── crew_config_version_id FK → crew_config
```

## Sidebar Navigation Updates

Current sidebar items:
```
Dashboard  →  Dashboard (Summary/Inputs) -- replace placeholder
Pricing    →  P&L                        -- rename + replace placeholder
Quotes     →  Quotes                     -- unchanged (Phase 4)
Aircraft   →  Aircraft                   -- unchanged
Admin      →  Admin                      -- unchanged
```

New sidebar item to add:
```
Crew       →  /crew                      -- new page for crew cost assumptions
```

Position: Between P&L and Quotes (or between Dashboard and P&L, matching the logical flow: inputs on Dashboard, crew assumptions, then P&L output).

## Open Questions

1. **Exact Excel formula audit status**
   - What we know: The CONTEXT.md describes the 7 components at a structural level. The seed script has extracted A sheet data. STATE.md notes "Excel workbook has not been reviewed" as a blocker.
   - What's unclear: The exact cell references and formulas for Revenue Forecast, Cost Forecast, C sheet, and M/I/Overhead & Other COGS sheet have not been extracted yet. The precise margin formula (additive vs multiplicative) is not confirmed.
   - Recommendation: The first plan task should be a full Excel formula audit using openpyxl to extract all formulas from the 7 sheets. This audit produces the specification for the calculation engine. Without it, implementation will be based on assumptions that may not match the workbook.

2. **Crew sets input source**
   - What we know: Crew cost depends on "crew sets" multiplied by salaries. The Summary/Dashboard has this input.
   - What's unclear: Is "crew sets" a per-MSN input or a global project input? How does it relate to the number of aircraft?
   - Recommendation: Model crew_sets as a per-MSN input in `project_msn_inputs` table (alongside MGH, cycle ratio, etc.). Verify with Excel audit.

3. **Average active fleet calculation**
   - What we know: DOC, Overhead, Training, Uniform all divide total budget by "average active fleet" to get per-aircraft monthly cost.
   - What's unclear: Is average_active_fleet a config parameter set by admin, or calculated from the number of MSNs in the project?
   - Recommendation: Store as a config parameter in `pricing_config` (editable by admin). Default to 11 (current fleet size). The Excel likely hardcodes this.

4. **P&L period structure**
   - What we know: The P&L should replicate "UNA Project by AC" sheet. Revenue = rate x BH. Cost = 7 components.
   - What's unclear: Does the P&L show monthly breakdown over the contract period, or just a single-month snapshot?
   - Recommendation: Start with single-month calculation (per-BH rates), which satisfies PRIC-02. The period_months input may affect escalation or contract-level totals. Verify with Excel audit.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.4 + pytest-asyncio 0.25.2 |
| Config file | None (uses defaults; asyncio_mode not configured explicitly) |
| Quick run command | `python3 -m pytest fastapi-project/tests/test_pricing_service.py -x` |
| Full suite command | `python3 -m pytest fastapi-project/tests/ -x` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRIC-01 | User can enter pricing inputs (MGH, CR, Env, Period, MSN) | integration | `python3 -m pytest fastapi-project/tests/test_pricing.py::test_calculate_with_valid_inputs -x` | Wave 0 |
| PRIC-02 | System calculates per-BH cost for all 7 components | unit | `python3 -m pytest fastapi-project/tests/test_pricing_service.py::TestComponentCalculations -x` | Wave 0 |
| PRIC-03 | User enters margin and sees final EUR/BH rate | unit | `python3 -m pytest fastapi-project/tests/test_pricing_service.py::test_margin_calculation -x` | Wave 0 |
| PRIC-04 | Results update in real-time as inputs change | manual-only | Manual: change input in browser, verify P&L updates within 1s | N/A -- UX behavior |
| PRIC-05 | Calculation matches Excel exactly (test fixtures) | unit | `python3 -m pytest fastapi-project/tests/test_pricing_fixtures.py -x` | Wave 0 |
| PRIC-06 | All calculations use Decimal (never float) | unit | `python3 -m pytest fastapi-project/tests/test_pricing_service.py::TestDecimalPrecision -x` | Wave 0 |
| CONF-01 | Admin can view/update config via admin page | integration | `python3 -m pytest fastapi-project/tests/test_pricing.py::test_update_config_admin -x` | Wave 0 |
| CONF-02 | Config changes are versioned | integration | `python3 -m pytest fastapi-project/tests/test_pricing.py::test_config_versioning -x` | Wave 0 |
| CONF-03 | Config changes don't alter saved quotes | integration | `python3 -m pytest fastapi-project/tests/test_pricing.py::test_config_immutability -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `python3 -m pytest fastapi-project/tests/test_pricing_service.py -x` (unit tests for calculation engine)
- **Per wave merge:** `python3 -m pytest fastapi-project/tests/ -x` (full suite including auth, aircraft, pricing)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `fastapi-project/tests/test_pricing_service.py` -- covers PRIC-02, PRIC-03, PRIC-05, PRIC-06
- [ ] `fastapi-project/tests/test_pricing_fixtures.py` -- covers PRIC-05 with Excel-verified data
- [ ] `fastapi-project/tests/test_pricing.py` -- covers PRIC-01, CONF-01, CONF-02, CONF-03
- [ ] `fastapi-project/migrations/003_create_pricing_config.sql` -- schema for new tables
- [ ] `fastapi-project/scripts/seed_pricing_config.py` -- seed from Excel C and M/I/Overhead sheets
- [ ] Mock DB handlers for pricing_config, crew_config, pricing_projects, project_msn_inputs in conftest.py

## Sources

### Primary (HIGH confidence)
- Existing codebase: `fastapi-project/app/aircraft/` -- established patterns for repository, service, schemas, router
- Existing codebase: `fastapi-project/tests/conftest.py` -- MockConnection pattern for in-memory testing
- Existing codebase: `fastapi-project/scripts/seed_aircraft.py` -- Excel data extraction pattern
- Existing codebase: `fastapi-project/migrations/002_create_aircraft.sql` -- NUMERIC precision conventions
- [Python decimal documentation](https://docs.python.org/3/library/decimal.html) -- Decimal arithmetic reference
- CONTEXT.md: User decisions on all 7 cost components, P&L structure, project model

### Secondary (MEDIUM confidence)
- [Real Python Decimal reference](https://realpython.com/ref/stdlib/decimal/) -- Decimal best practices
- [DEV Community: Mortgage Calculator Next.js](https://dev.to/wernerpj_purens_jaco/how-i-built-a-mortgage-calculator-that-actually-helps-people-save-200k-nextjs-real-math-44) -- Real-time calculation pattern
- [HackerNoon: Debounce in Next.js](https://hackernoon.com/how-to-use-debounce-in-nextjs) -- Debounce implementation
- [Stigg: Plan Versioning Guide](https://www.stigg.io/blog-posts/an-engineers-step-by-step-guide-to-plan-versioning) -- Config versioning pattern for SaaS
- [Hypirion: System-Versioned Tables in Postgres](https://hypirion.com/musings/implementing-system-versioned-tables-in-postgres) -- Append-only versioning pattern

### Tertiary (LOW confidence)
- Excel formula details for C, M/I/Overhead sheets -- not yet audited; exact formulas need extraction before implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed; all patterns established in Phases 1-2
- Architecture: HIGH -- follows existing module pattern exactly (repository/service/schema/router)
- Calculation engine: MEDIUM -- component structure is clear from CONTEXT.md, but exact Excel formulas not yet audited
- Config versioning: HIGH -- append-only pattern is well-understood and simple to implement
- Frontend P&L layout: MEDIUM -- structure clear, but exact table columns/rows depend on Excel audit
- Pitfalls: HIGH -- common Decimal/float issues well-documented; crew type/lease type cross-product identified

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain; no fast-moving dependencies)
