# Phase 2: Aircraft Master Data - Research

**Researched:** 2026-03-05
**Domain:** PostgreSQL schema design, FastAPI CRUD APIs, Excel data import, Next.js data tables
**Confidence:** HIGH

## Summary

Phase 2 introduces the first real data domain into the ACMI Pricing Platform. The core challenge is modeling aircraft cost data faithfully from the Excel workbook -- particularly the EPR (Engine Performance Restoration) matrices, which vary per-MSN in both the number of rows and the cycle ratio steps. The workbook audit reveals 11 MSNs with fixed monthly rates (Lease Rent, 6Y Check, 12Y Check, LDG), variable per-engine rates (APU, LLP #1, LLP #2), three escalation percentages (EPR, LLP, AF+APU), and per-MSN EPR lookup tables mapping cycle ratio x environment (Benign/Hot) to EPR rate. EPR tables range from 5 to 15 rows per MSN and require linear interpolation when the input cycle ratio falls between defined steps.

The existing codebase establishes clear patterns: raw SQL via asyncpg, BaseRepository for query helpers, Pydantic schemas for validation, FastAPI routers with dependency injection, and a mock-DB conftest for testing. Phase 2 extends these patterns to a new `aircraft` domain module. The frontend uses Next.js 16 with Server Components (for data fetching), Server Actions (for mutations), Tailwind CSS for styling, and Zustand for client state. The `apiFetch` utility handles client-side requests, while Server Actions use `API_URL` for server-to-server calls.

All monetary values must use PostgreSQL `NUMERIC` (which asyncpg returns as Python `Decimal`) per the project decision to never use floating-point for money. The seed script reads the Excel workbook using openpyxl and populates the database. Future admin uploads use a simplified CSV/Excel template, not the complex multi-sheet workbook format.

**Primary recommendation:** Design three tables (`aircraft`, `aircraft_rates`, `epr_matrix_rows`) with the rates table storing both USD originals and EUR-converted values, then build a standard CRUD module following the existing users/auth pattern exactly.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Per MSN, store these cost parameters:**
  - **Fixed monthly rates (USD):** Lease Rent, 6Y Check, 12Y Check, LDG
  - **Variable rates (USD, per engine):** APU rate, LLP #1 rate, LLP #2 rate
  - **EPR matrix:** Per-MSN table mapping cycle ratio x environment (Benign/Hot) to EPR rate. Each MSN has different cycle ratio steps and different numbers of rows. System must interpolate between rows when cycle ratio falls between defined values.
  - **Escalation rates (%):** EPR escalation, LLP escalation, AF+APU escalation -- per MSN
- **Currency handling:** Store original USD values (contracts with lessors are in USD). Two exchange rates: adjustable rate (used for pricing) and live USD/EUR rate (for FX exposure comparison). All pricing outputs in EUR using the adjustable rate.
- **11 MSNs initially:** 3055, 3378, 3461, 3570, 3605, 4247, 5228, 5931, 1932, 1960, 1503 -- fleet will grow over time
- **Aircraft identity fields:** MSN, aircraft type (all A320 family currently), registration
- **Aircraft list page:** Table columns: MSN, type, registration, all fixed rates shown in both USD and EUR side by side. Click a row to navigate to aircraft detail page.
- **Initial load:** Python seed script reads the provided Excel file (`UNA Pricing Model 1 year.xlsx`) and populates the database with all 11 aircraft and their complete cost data including EPR matrices
- **Future additions:** Admin uploads via simple standardized Excel/CSV template through the web UI -- not the complex multi-sheet format
- **EPR matrix entry:** Both UI entry (admin adds/edits rows through web app) and Excel upload supported for EPR tables

### Claude's Discretion
- Aircraft list: search implementation (filter-as-you-type vs search button), pagination approach
- Aircraft detail page: layout structure (sections vs tabs vs single table), edit flow (immediate save vs draft)
- EPR matrix editing UX (inline cell editing vs form modal)
- Escalation rates: whether to show/edit on detail page
- Upload merge behavior (upsert vs replace)
- Detail page USD/EUR display approach

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACFT-01 | System stores aircraft records imported from Excel (MSN, type, registration, cost parameters) | Database schema design (3 tables), openpyxl seed script pattern, Excel workbook audit completed with exact data locations |
| ACFT-02 | User can view list of aircraft with search by MSN or registration | Aircraft list API endpoint with query parameter filtering, frontend table component with filter-as-you-type |
| ACFT-03 | User can view aircraft detail with associated cost data | Aircraft detail API with joined rates + EPR data, detail page layout with sections for fixed/variable/EPR/escalation |
| ACFT-04 | Admin can update aircraft cost parameters | Admin-gated PUT/PATCH endpoints for rates and EPR rows, Server Action mutation pattern from existing auth module |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| asyncpg | 0.30.0 | PostgreSQL queries returning Decimal for NUMERIC columns | Already in project, returns Python Decimal for NUMERIC types by default |
| FastAPI | 0.115.6 | API framework with dependency injection | Already in project, established router/dependency pattern |
| Pydantic | 2.10.4 | Request/response schema validation | Already in project, supports Decimal fields natively |
| openpyxl | 3.1.x | Read Excel workbook for seed script | Standard Python Excel library, already installed for workbook inspection |
| Next.js | 16.1.6 | Frontend with Server Components for data fetching | Already in project, App Router pattern established |
| Tailwind CSS | 4.x | Styling with dark theme | Already in project, AeroVista style established |
| Zustand | 5.0.11 | Client-side state (search filters, UI state) | Already in project, sidebar store pattern established |
| python-multipart | 0.0.20 | File upload parsing for FastAPI UploadFile | Already in project (required by FastAPI for form data) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| csv (stdlib) | builtin | Parse uploaded CSV template files | Admin CSV upload endpoint |
| io (stdlib) | builtin | BytesIO wrapper for uploaded Excel files | Admin Excel upload endpoint |
| bisect (stdlib) | builtin | Efficient lookup in sorted EPR ratio arrays | EPR interpolation in pricing engine (Phase 3, but tables stored now) |
| decimal (stdlib) | builtin | Decimal arithmetic for monetary values | All rate calculations and conversions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| openpyxl | pandas | Pandas is overkill for reading a single workbook; openpyxl is lighter and already sufficient |
| Raw SQL | SQLAlchemy | Project decision is raw SQL via asyncpg -- no ORM |
| Server Actions | React Query | Project already uses Server Actions pattern; React Query would add complexity |

**Installation:**
```bash
# openpyxl is the only new dependency (if not already in requirements.txt)
pip install openpyxl==3.1.5
```

## Architecture Patterns

### Recommended Project Structure
```
fastapi-project/
├── app/
│   ├── aircraft/
│   │   ├── __init__.py
│   │   ├── repository.py     # AircraftRepository extends BaseRepository
│   │   ├── router.py         # /aircraft routes (list, detail, update, upload)
│   │   ├── schemas.py        # Pydantic models for request/response
│   │   └── service.py        # Business logic (EUR conversion, upload parsing)
│   └── main.py               # Add aircraft router include
├── migrations/
│   └── 002_create_aircraft.sql  # aircraft + aircraft_rates + epr_matrix_rows tables
├── scripts/
│   └── seed_aircraft.py      # One-time Excel import script
└── tests/
    ├── conftest.py            # Extend MockConnection for aircraft tables
    └── test_aircraft.py       # ACFT-01 through ACFT-04 tests

nextjs-project/
└── src/
    ├── app/
    │   ├── (dashboard)/
    │   │   └── aircraft/
    │   │       ├── page.tsx           # Aircraft list (Server Component)
    │   │       └── [msn]/
    │   │           └── page.tsx       # Aircraft detail (Server Component)
    │   └── actions/
    │       └── aircraft.ts            # Server Actions for mutations
    ├── components/
    │   └── aircraft/
    │       ├── AircraftTable.tsx       # Client component: sortable table with search
    │       ├── AircraftDetail.tsx      # Client component: detail view with edit
    │       ├── RatesSection.tsx        # Fixed + variable rates display/edit
    │       ├── EprMatrixTable.tsx      # EPR matrix display/edit
    │       └── AircraftUpload.tsx      # CSV/Excel upload component
    └── lib/
        └── api.ts                     # Existing apiFetch utility (reuse)
```

### Pattern 1: Database Schema Design

**What:** Three normalized tables for aircraft identity, cost rates, and EPR matrix data
**When to use:** Always -- this is the core data model for Phase 2

```sql
-- Source: Derived from Excel workbook audit of 'A ' sheet

-- Aircraft identity (one row per MSN)
CREATE TABLE IF NOT EXISTS aircraft (
    id              SERIAL PRIMARY KEY,
    msn             INTEGER NOT NULL UNIQUE,
    aircraft_type   TEXT NOT NULL DEFAULT 'A320',
    registration    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aircraft_msn ON aircraft(msn);

-- Cost rates per aircraft (one row per MSN)
-- Stores USD originals; EUR values computed on read using adjustable rate
CREATE TABLE IF NOT EXISTS aircraft_rates (
    id                      SERIAL PRIMARY KEY,
    aircraft_id             INTEGER NOT NULL UNIQUE REFERENCES aircraft(id) ON DELETE CASCADE,
    -- Fixed monthly rates (USD)
    lease_rent_usd          NUMERIC(12,2) NOT NULL,
    six_year_check_usd      NUMERIC(12,2) NOT NULL,
    twelve_year_check_usd   NUMERIC(12,2) NOT NULL,
    ldg_usd                 NUMERIC(12,2) NOT NULL,
    -- Variable rates per engine (USD)
    apu_rate_usd            NUMERIC(10,4) NOT NULL,
    llp1_rate_usd           NUMERIC(10,4) NOT NULL,
    llp2_rate_usd           NUMERIC(10,4) NOT NULL,
    -- Escalation rates (stored as decimal fractions, e.g., 0.05 = 5%)
    epr_escalation          NUMERIC(6,4) NOT NULL DEFAULT 0,
    llp_escalation          NUMERIC(6,4) NOT NULL DEFAULT 0,
    af_apu_escalation       NUMERIC(6,4) NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EPR matrix rows (variable number per aircraft)
CREATE TABLE IF NOT EXISTS epr_matrix_rows (
    id              SERIAL PRIMARY KEY,
    aircraft_id     INTEGER NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
    cycle_ratio     NUMERIC(6,4) NOT NULL,
    benign_rate     NUMERIC(10,2) NOT NULL,
    hot_rate        NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(aircraft_id, cycle_ratio)
);

CREATE INDEX IF NOT EXISTS idx_epr_matrix_aircraft ON epr_matrix_rows(aircraft_id, cycle_ratio);
```

**Key design decisions:**
- EUR values are NOT stored -- they are computed on read using the adjustable exchange rate. This avoids data staleness when the rate changes.
- The exchange rates themselves (adjustable rate, live rate) belong to a system-level config, not per-aircraft. They will be stored in a `pricing_config` table in Phase 3. For Phase 2, a hardcoded default (0.85 USD/EUR as seen in the Excel) is sufficient for display.
- NUMERIC with explicit precision/scale avoids asyncpg serialization issues with unscaled NUMERIC columns.
- EPR matrix uses a composite unique constraint on (aircraft_id, cycle_ratio) to prevent duplicate ratio entries.
- Variable rates store per-engine values (not totals) -- the pricing engine in Phase 3 multiplies by number of engines.

### Pattern 2: Repository Pattern (following UserRepository)

**What:** AircraftRepository extending BaseRepository with typed query methods
**When to use:** All database access for aircraft data

```python
# Source: Follows existing app/users/repository.py pattern
from __future__ import annotations
from decimal import Decimal
from app.db.base_repository import BaseRepository


class AircraftRepository(BaseRepository):
    """Repository for aircraft, rates, and EPR matrix operations."""

    async def list_aircraft(self, search: str | None = None) -> list[dict]:
        """List all aircraft with their rates, optionally filtered by MSN or registration."""
        query = """
            SELECT a.id, a.msn, a.aircraft_type, a.registration,
                   r.lease_rent_usd, r.six_year_check_usd,
                   r.twelve_year_check_usd, r.ldg_usd,
                   r.apu_rate_usd, r.llp1_rate_usd, r.llp2_rate_usd
            FROM aircraft a
            LEFT JOIN aircraft_rates r ON r.aircraft_id = a.id
        """
        if search:
            query += """
                WHERE a.msn::TEXT ILIKE $1
                   OR a.registration ILIKE $1
            """
            query += " ORDER BY a.msn"
            return await self.fetch_many(query, f"%{search}%")
        query += " ORDER BY a.msn"
        return await self.fetch_many(query)

    async def fetch_by_msn(self, msn: int) -> dict | None:
        """Fetch aircraft with full rates by MSN."""
        return await self.fetch_one("""
            SELECT a.*, r.lease_rent_usd, r.six_year_check_usd,
                   r.twelve_year_check_usd, r.ldg_usd,
                   r.apu_rate_usd, r.llp1_rate_usd, r.llp2_rate_usd,
                   r.epr_escalation, r.llp_escalation, r.af_apu_escalation
            FROM aircraft a
            LEFT JOIN aircraft_rates r ON r.aircraft_id = a.id
            WHERE a.msn = $1
        """, msn)

    async def fetch_epr_matrix(self, aircraft_id: int) -> list[dict]:
        """Fetch EPR matrix rows for an aircraft, ordered by cycle ratio."""
        return await self.fetch_many("""
            SELECT cycle_ratio, benign_rate, hot_rate
            FROM epr_matrix_rows
            WHERE aircraft_id = $1
            ORDER BY cycle_ratio
        """, aircraft_id)

    async def update_rates(self, aircraft_id: int, **fields) -> dict | None:
        """Update cost rate fields for an aircraft."""
        # Dynamic SET clause pattern from UserRepository.update_user
        if not fields:
            return None
        set_parts = []
        args = []
        for i, (key, value) in enumerate(fields.items(), start=1):
            set_parts.append(f"{key} = ${i}")
            args.append(value)
        set_parts.append("updated_at = NOW()")
        set_clause = ", ".join(set_parts)
        args.append(aircraft_id)
        id_param = f"${len(args)}"
        return await self.fetch_one(
            f"UPDATE aircraft_rates SET {set_clause} WHERE aircraft_id = {id_param} RETURNING *",
            *args,
        )
```

### Pattern 3: Server Component Data Fetching (Aircraft List Page)

**What:** Next.js Server Component fetches data from FastAPI, passes to client component for interactivity
**When to use:** Aircraft list and detail pages

```typescript
// Source: Follows existing layout.tsx session check pattern
// app/(dashboard)/aircraft/page.tsx - Server Component
import { cookies } from 'next/headers'
import { AircraftTable } from '@/components/aircraft/AircraftTable'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

async function getAircraft() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  const res = await fetch(`${API_URL}/aircraft`, {
    headers: { Cookie: `access_token=${token}` },
    cache: 'no-store', // Always fetch fresh data
  })
  if (!res.ok) return []
  return res.json()
}

export default async function AircraftPage() {
  const aircraft = await getAircraft()
  return <AircraftTable aircraft={aircraft} />
}
```

### Pattern 4: Server Actions for Mutations

**What:** Server Actions handle form submissions (rate updates, file uploads) following existing auth pattern
**When to use:** Admin operations that modify data

```typescript
// Source: Follows existing app/actions/auth.ts pattern
'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export async function updateRatesAction(msn: number, formData: FormData) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  const body: Record<string, number> = {}
  for (const [key, value] of formData.entries()) {
    if (value) body[key] = Number(value)
  }

  const res = await fetch(`${API_URL}/aircraft/${msn}/rates`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `access_token=${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: 'Update failed' }))
    return { error: data.detail }
  }

  revalidatePath(`/aircraft/${msn}`)
  return { success: true }
}
```

### Pattern 5: EUR Conversion on Read

**What:** Compute EUR values from stored USD using adjustable exchange rate, applied at API response time
**When to use:** All endpoints that return monetary values

```python
# In the service layer or router
from decimal import Decimal

# Phase 2 default -- will move to pricing_config table in Phase 3
DEFAULT_ADJ_RATE = Decimal("0.85")  # USD to EUR (from Excel cell C2)

def apply_eur_conversion(rates: dict, adj_rate: Decimal = DEFAULT_ADJ_RATE) -> dict:
    """Add EUR equivalents to a rates dict."""
    usd_fields = [
        "lease_rent_usd", "six_year_check_usd", "twelve_year_check_usd",
        "ldg_usd", "apu_rate_usd", "llp1_rate_usd", "llp2_rate_usd"
    ]
    result = dict(rates)
    for field in usd_fields:
        if field in result and result[field] is not None:
            eur_field = field.replace("_usd", "_eur")
            result[eur_field] = result[field] * adj_rate
    return result
```

### Anti-Patterns to Avoid
- **Storing EUR values in the database:** EUR values depend on the adjustable exchange rate, which can change. Always compute on read.
- **Using FLOAT for monetary columns:** Project mandate is NUMERIC/Decimal only. asyncpg returns Decimal for NUMERIC, which Pydantic serializes correctly.
- **Putting EPR matrix in a JSON column:** Tempting but prevents efficient querying, indexing, and validation. Use a proper normalized table.
- **Building separate routers for rates/EPR/escalation:** Keep it in one `aircraft` router module -- the data is always accessed in context of an aircraft record.
- **Using client-side fetch for initial page load:** Use Server Components for the initial data fetch (SSR), client components only for interactivity (search filtering, edit forms).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel parsing | Custom cell-by-cell reader | openpyxl with `data_only=True` | Handles formulas, merged cells, data types correctly |
| CSV parsing | Manual string splitting | Python stdlib `csv.DictReader` | Handles quoting, escaping, edge cases |
| File upload handling | Raw request body parsing | FastAPI `UploadFile` with `python-multipart` | Async file handling, temp file management, size limits |
| Decimal serialization in JSON | Custom JSON encoder | Pydantic `Decimal` field type | Pydantic v2 handles Decimal->JSON serialization automatically |
| Search/filter debouncing | setTimeout/clearTimeout | Simple 300ms debounce utility or `useDeferredValue` | React 19 has `useDeferredValue` built in for search input deferral |

**Key insight:** The most complex "don't hand-roll" item is the EPR interpolation logic, but it is deliberately kept simple (Python stdlib `bisect` + linear interpolation formula) because the domain requires exact reproducibility with the Excel workbook. Using scipy or numpy would be overkill and add unnecessary dependencies.

## Common Pitfalls

### Pitfall 1: NUMERIC Precision Without Scale
**What goes wrong:** asyncpg serializes unscaled NUMERIC values in scientific notation (e.g., 10000 becomes 1E+4), which breaks JSON responses.
**Why it happens:** PostgreSQL NUMERIC without precision/scale allows arbitrary precision, and asyncpg's serializer uses scientific notation for large round numbers.
**How to avoid:** Always define NUMERIC columns with explicit precision and scale: `NUMERIC(12,2)` for dollar amounts, `NUMERIC(6,4)` for rates/percentages.
**Warning signs:** Numbers appearing as "1E+4" in API responses or Decimal("1E+4") in Python.

### Pitfall 2: Server-to-Server Cookie Forwarding
**What goes wrong:** Server Components/Actions fetching from FastAPI don't automatically include the httpOnly cookie.
**Why it happens:** Server-side fetch runs in Node.js, not the browser. The httpOnly cookie exists only in the browser's cookie jar.
**How to avoid:** Read the cookie from Next.js `cookies()` API and manually forward it in the `Cookie` header of server-side fetch calls, as shown in Pattern 3.
**Warning signs:** 401 errors when Server Components try to fetch protected API routes.

### Pitfall 3: EPR Matrix Row Count Variance
**What goes wrong:** Assuming all EPR tables have the same number of rows or the same cycle ratio steps.
**Why it happens:** The Excel workbook has EPR tables ranging from 5 rows (MSN 3055: ratios 1.0-3.0) to 15 rows (MSN 3378: ratios 0.62-4.0). Some start at 0.5, others at 0.62, 0.86, or 0.99.
**How to avoid:** The epr_matrix_rows table must support variable numbers of rows per aircraft. Never hardcode ratio steps. The UI must render dynamically based on actual data.
**Warning signs:** EPR tables displaying empty rows or missing data for certain aircraft.

### Pitfall 4: Exchange Rate Hardcoding
**What goes wrong:** Hardcoding the USD/EUR rate everywhere instead of centralizing it.
**Why it happens:** Phase 2 needs EUR display but Phase 3 introduces the full pricing config table with the adjustable rate.
**How to avoid:** Define a single constant/config source for the adjustable rate in Phase 2 (e.g., in `app/config.py` or a dedicated exchange rate helper). Phase 3 will migrate this to the database-backed config.
**Warning signs:** Multiple hardcoded `0.85` values scattered across codebase.

### Pitfall 5: Mock DB Extension Complexity
**What goes wrong:** The existing MockConnection only handles `users` table queries. Adding aircraft/rates/EPR queries makes it unwieldy.
**Why it happens:** The mock routes queries based on string matching (e.g., `"WHERE EMAIL"` in query). Aircraft queries are structurally different.
**How to avoid:** Extend the MockConnection to route queries to table-specific handlers based on table name detection (e.g., detect `FROM aircraft` vs `FROM users`). Consider refactoring to a more data-driven approach if the mock becomes too complex.
**Warning signs:** Tests passing for users but failing for aircraft with cryptic "no rows returned" errors.

### Pitfall 6: Decimal Serialization in JSON Responses
**What goes wrong:** Python `Decimal` values fail to serialize to JSON, or lose precision when converted to float.
**Why it happens:** The default JSON encoder doesn't handle Decimal. Converting to float loses precision.
**How to avoid:** Pydantic v2 handles Decimal serialization natively when you type schema fields as `Decimal`. FastAPI uses Pydantic's serializer. Ensure all response models use `Decimal` type, not `float`.
**Warning signs:** `TypeError: Object of type Decimal is not JSON serializable` or precision loss in API responses.

## Code Examples

### Excel Seed Script Structure

```python
# Source: Derived from Excel workbook audit
# scripts/seed_aircraft.py
import asyncio
from decimal import Decimal
import openpyxl
import asyncpg

EXCEL_PATH = "UNA Pricing Model 1 year.xlsx"

# Data from Excel 'A ' sheet, rows 81-93 (USD summary table)
# This is the authoritative source for per-MSN rates
AIRCRAFT_DATA = {
    3378: {"lease_rent": 185000, "six_year": 14334.75, "twelve_year": 7513.065,
           "ldg": 4864.5, "apu": 53.82, "llp1": 341.775, "llp2": 353.13495},
    4247: {"lease_rent": 185000, "six_year": 15414.465, "twelve_year": 8419.323,
           "ldg": 4333.725, "apu": 60.049, "llp1": 360.22, "llp2": 360.22},
    # ... remaining 9 MSNs from rows 83-93
}

# EPR tables from rows 34-50, 68-80, etc. -- variable per MSN
EPR_TABLES = {
    3055: [
        # (cycle_ratio, benign, hot)
        (1.0, 448.22, 672.33),
        (1.5, 319.07, 478.61),
        (2.0, 273.49, 410.23),
        (2.25, 258.30, 387.44),
        (2.5, 250.70, 376.05),
        (3.0, 243.10, 364.65),
    ],
    3378: [
        (0.62, 669.32, 870.73),
        (0.80, 576.65, 750.79),
        # ... rows through 4.0
    ],
    # ... per MSN
}

# Escalation rates from rows 14-16 (top-level) or per-MSN sections
ESCALATION_RATES = {
    3055: {"epr": 0.05, "llp": 0.08, "af_apu": 0.03},
    3378: {"epr": 0.03, "llp": 0.085, "af_apu": 0.035},
    # ...
}

async def seed(database_url: str):
    conn = await asyncpg.connect(database_url)
    try:
        for msn, data in AIRCRAFT_DATA.items():
            # Insert aircraft
            row = await conn.fetchrow(
                "INSERT INTO aircraft (msn) VALUES ($1) "
                "ON CONFLICT (msn) DO UPDATE SET updated_at = NOW() "
                "RETURNING id", msn
            )
            aircraft_id = row["id"]
            esc = ESCALATION_RATES.get(msn, {"epr": 0, "llp": 0, "af_apu": 0})
            # Insert rates
            await conn.execute("""
                INSERT INTO aircraft_rates (
                    aircraft_id, lease_rent_usd, six_year_check_usd,
                    twelve_year_check_usd, ldg_usd, apu_rate_usd,
                    llp1_rate_usd, llp2_rate_usd,
                    epr_escalation, llp_escalation, af_apu_escalation
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                ON CONFLICT (aircraft_id) DO UPDATE SET
                    lease_rent_usd = EXCLUDED.lease_rent_usd,
                    six_year_check_usd = EXCLUDED.six_year_check_usd,
                    twelve_year_check_usd = EXCLUDED.twelve_year_check_usd,
                    ldg_usd = EXCLUDED.ldg_usd,
                    apu_rate_usd = EXCLUDED.apu_rate_usd,
                    llp1_rate_usd = EXCLUDED.llp1_rate_usd,
                    llp2_rate_usd = EXCLUDED.llp2_rate_usd,
                    epr_escalation = EXCLUDED.epr_escalation,
                    llp_escalation = EXCLUDED.llp_escalation,
                    af_apu_escalation = EXCLUDED.af_apu_escalation,
                    updated_at = NOW()
            """, aircraft_id,
                Decimal(str(data["lease_rent"])),
                Decimal(str(data["six_year"])),
                Decimal(str(data["twelve_year"])),
                Decimal(str(data["ldg"])),
                Decimal(str(data["apu"])),
                Decimal(str(data["llp1"])),
                Decimal(str(data["llp2"])),
                Decimal(str(esc["epr"])),
                Decimal(str(esc["llp"])),
                Decimal(str(esc["af_apu"])),
            )
            # Insert EPR matrix rows
            for ratio, benign, hot in EPR_TABLES.get(msn, []):
                await conn.execute("""
                    INSERT INTO epr_matrix_rows (aircraft_id, cycle_ratio, benign_rate, hot_rate)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (aircraft_id, cycle_ratio) DO UPDATE SET
                        benign_rate = EXCLUDED.benign_rate,
                        hot_rate = EXCLUDED.hot_rate
                """, aircraft_id,
                    Decimal(str(ratio)),
                    Decimal(str(benign)),
                    Decimal(str(hot)),
                )
    finally:
        await conn.close()
```

### FastAPI Router Structure

```python
# Source: Follows existing app/users/router.py pattern
from __future__ import annotations
from decimal import Decimal
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from app.db.database import get_db
from app.auth.dependencies import get_current_user, require_admin
from app.aircraft.repository import AircraftRepository
from app.aircraft.schemas import AircraftListResponse, AircraftDetailResponse, UpdateRatesRequest

router = APIRouter(prefix="/aircraft", tags=["aircraft"])

@router.get("", response_model=list[AircraftListResponse])
async def list_aircraft(
    search: str | None = Query(None, description="Search by MSN or registration"),
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all aircraft with rates."""
    repo = AircraftRepository(db)
    return await repo.list_aircraft(search)

@router.get("/{msn}", response_model=AircraftDetailResponse)
async def get_aircraft(
    msn: int,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get aircraft detail with full rates and EPR matrix."""
    repo = AircraftRepository(db)
    aircraft = await repo.fetch_by_msn(msn)
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    epr_rows = await repo.fetch_epr_matrix(aircraft["id"])
    return {**aircraft, "epr_matrix": epr_rows}

@router.put("/{msn}/rates", response_model=AircraftDetailResponse)
async def update_rates(
    msn: int,
    body: UpdateRatesRequest,
    db: asyncpg.Connection = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Update aircraft cost parameters (admin only)."""
    repo = AircraftRepository(db)
    aircraft = await repo.fetch_by_msn(msn)
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    await repo.update_rates(aircraft["id"], **fields)
    # Re-fetch to return updated data
    updated = await repo.fetch_by_msn(msn)
    epr_rows = await repo.fetch_epr_matrix(updated["id"])
    return {**updated, "epr_matrix": epr_rows}
```

### Pydantic Schemas with Decimal

```python
# Source: Follows existing app/users/schemas.py pattern
from __future__ import annotations
from decimal import Decimal
from pydantic import BaseModel

class AircraftListResponse(BaseModel):
    id: int
    msn: int
    aircraft_type: str
    registration: str | None
    lease_rent_usd: Decimal | None
    six_year_check_usd: Decimal | None
    twelve_year_check_usd: Decimal | None
    ldg_usd: Decimal | None

class EprMatrixRow(BaseModel):
    cycle_ratio: Decimal
    benign_rate: Decimal
    hot_rate: Decimal

class AircraftDetailResponse(BaseModel):
    id: int
    msn: int
    aircraft_type: str
    registration: str | None
    lease_rent_usd: Decimal | None
    six_year_check_usd: Decimal | None
    twelve_year_check_usd: Decimal | None
    ldg_usd: Decimal | None
    apu_rate_usd: Decimal | None
    llp1_rate_usd: Decimal | None
    llp2_rate_usd: Decimal | None
    epr_escalation: Decimal | None
    llp_escalation: Decimal | None
    af_apu_escalation: Decimal | None
    epr_matrix: list[EprMatrixRow]

class UpdateRatesRequest(BaseModel):
    lease_rent_usd: Decimal | None = None
    six_year_check_usd: Decimal | None = None
    twelve_year_check_usd: Decimal | None = None
    ldg_usd: Decimal | None = None
    apu_rate_usd: Decimal | None = None
    llp1_rate_usd: Decimal | None = None
    llp2_rate_usd: Decimal | None = None
    epr_escalation: Decimal | None = None
    llp_escalation: Decimal | None = None
    af_apu_escalation: Decimal | None = None
```

## Excel Workbook Data Map

Detailed audit of the `A ` sheet structure for the seed script:

| Location | Content | Notes |
|----------|---------|-------|
| C2 | ADJ USD/EUR rate: 0.85 | Default exchange rate |
| Row 6, C-M | MSN numbers (11 aircraft) | 3055, 3378, 3461, 3570, 3605, 4247, 5228, 5931, 1932, 1960, 1503 |
| Row 7, C-M | Lease Rent (EUR already converted) | Use rows 81-93 for USD originals |
| Rows 8-10 | 6Y/12Y/LDG (EUR) | Use rows 81-93 for USD originals |
| Rows 11-13 | APU/LLP1/LLP2 (EUR) | Use rows 81-93 for USD originals |
| Rows 14-16 | Escalation rates per MSN | EPR, LLP, AF+APU as decimals |
| **Rows 81-93** | **USD summary table** | **Authoritative source: MSN, Lease rent, 6Y, 12Y, LG, APU, LLP1, LLP2** |
| Rows 95-107 | EUR summary table | Computed from USD * adj_rate |
| Rows 34-50 (cols B-E) | EPR Table: MSN 3055 | 6 rows, ratios 1.0-3.0 |
| Rows 34-50 (cols G-J) | EPR Table: MSN 3378 | 15 rows, ratios 0.62-4.0 |
| Rows 34-50 (cols L-O) | EPR Table: MSN 3461 | 12 rows, ratios 0.99-3.5 |
| Rows 68-74 (cols B-E) | EPR Table: MSN 4023/3570 (section 2) | 5 rows, ratios 1.0-2.5 |
| Rows 68-74 (cols G-J) | EPR Table: MSN 4247 | 5 rows, ratios 1.0-2.5 |
| Rows 68-80 (cols L-O) | EPR Table: MSN 5228 | 12 rows, ratios 0.99-3.5 |
| Rows 34-44 (cols Q-T) | EPR Table: MSN 3570 | 8 rows, ratios 0.5-3.5 |
| Rows 68-75 (cols Q-T) | EPR Table: MSN 3605 | 6 rows, ratios 1.0-3.0 |
| Rows 36-49 (cols V-X) | EPR Table: MSN 1932 (2026) | 14 rows, ratios 0.86-4.0 |
| Rows 36-50 (cols Z-AB) | EPR Table: MSN 1960 | 15 rows, ratios 0.86-4.0 |
| Rows 38-48 (cols AD-AF) | EPR Table: MSN 1932/1960 (2025) | 11 rows, ratios 0.86-3.5 |
| Rows 70-82 (cols V-X) | EPR Table: MSN 1503 (2026) | 13 rows, ratios 0.86-3.5 |
| Rows 71-82 (cols AA-AC) | EPR Table: MSN 1503 (2025) | 12 rows, ratios 0.86-3.5 |
| Rows 86-98 (cols V-X) | EPR Table: MSN 5931 | 11 rows, ratios 0.99-3.5 |

**Important notes:**
- MSN 4023 appears in row 52 col B but is NOT in the 11 MSNs. It may be a separate aircraft or historical. The seed script should ignore it unless user clarifies.
- Some MSNs have 2025 and 2026 EPR tables. The seed should use the most current (2026 where available, 2025 otherwise).
- Rows 18-50 contain per-MSN detail blocks (3 MSNs per block), with rates in the original lessor contract values, while rows 81-93 contain the normalized USD summary. Use rows 81-93 as the authoritative source for rates.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pydantic v1 with `orm_mode` | Pydantic v2 with `model_dump()` | Pydantic 2.0 (2023) | Use `model_dump()` not `.dict()`, `model_validate()` not `parse_obj()` |
| `useFormState` (React) | `useActionState` (React 19) | React 19 (2024) | Project already uses correct API (Phase 1 login) |
| Next.js `getServerSideProps` | Server Components + async/await | Next.js 13+ App Router | Fetch data directly in async Server Components |
| `NEXT_PUBLIC_` env vars for API | Server Actions with `API_URL` | Next.js 14+ | Keep API URL server-only, use Server Actions for mutations |

**Deprecated/outdated:**
- `response_model_exclude` in FastAPI: Use Pydantic field exclude instead
- `json_encoders` in Pydantic Config: Pydantic v2 uses field-level serializers
- `asyncpg.connect()` for web apps: Use connection pool (`asyncpg.create_pool()`) -- project already does this

## Discretion Recommendations

Based on research, here are recommendations for the areas left to Claude's discretion:

| Area | Recommendation | Rationale |
|------|----------------|-----------|
| Search implementation | Filter-as-you-type with 300ms debounce | Only 11 MSNs; instant filtering is fast and better UX than a search button |
| Pagination | None initially | 11 aircraft; pagination adds complexity with no benefit. Add when fleet exceeds ~50 |
| Detail page layout | Sections (not tabs) | All data should be visible at once -- fixed rates section, variable rates section, escalation section, EPR matrix section |
| Edit flow | Immediate save per section | Simpler than draft mode; each section has its own save button. Uses Server Actions |
| EPR matrix editing | Inline cell editing | Small tables (5-15 rows); inline editing is fastest. Add/remove row buttons at bottom |
| Escalation rates | Show and edit on detail page | They are per-MSN and part of the cost parameters; natural place is the detail page |
| Upload merge behavior | Upsert (update existing, insert new) | More forgiving than replace; prevents accidental data loss |
| Detail page USD/EUR | Side-by-side columns | Consistent with list page design decision |

## Open Questions

1. **Aircraft type and registration source**
   - What we know: The Excel workbook stores MSN numbers but no explicit aircraft_type or registration columns. All are A320 family.
   - What's unclear: Where do registration strings come from? The Excel has lessor names and engine serial numbers but no registrations.
   - Recommendation: Seed with `aircraft_type = 'A320'` and `registration = NULL`. Admin can update registrations manually through the UI. Add a note in the seed script.

2. **Which EPR table year to use (2025 vs 2026)**
   - What we know: MSNs 1932, 1960, and 1503 have both 2025 and 2026 EPR tables in the workbook.
   - What's unclear: Should we store both, or only the most recent?
   - Recommendation: Store only the most current (2026 where available). The EPR table is a point-in-time lookup used for pricing; historical tables are not needed for v1. If needed later, add a `year` column to epr_matrix_rows.

3. **MSN 4023 in the workbook**
   - What we know: Row 52 col B shows MSN 4023, which is not in the confirmed 11 MSNs.
   - What's unclear: Is this a separate aircraft, a historical entry, or an error?
   - Recommendation: Ignore MSN 4023 in the seed. It is not in the confirmed list of 11 MSNs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.4 + pytest-asyncio 0.25.2 |
| Config file | None explicit (uses pytest defaults, auto mode for asyncio) |
| Quick run command | `pytest fastapi-project/tests/test_aircraft.py -x` |
| Full suite command | `pytest fastapi-project/tests/ -x` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACFT-01 | Aircraft records stored from import | integration | `pytest fastapi-project/tests/test_aircraft.py::test_seed_data_present -x` | No -- Wave 0 |
| ACFT-01 | Seed script populates all 11 MSNs | script test | `python fastapi-project/scripts/seed_aircraft.py --dry-run` | No -- Wave 0 |
| ACFT-02 | GET /aircraft returns aircraft list | integration | `pytest fastapi-project/tests/test_aircraft.py::test_list_aircraft -x` | No -- Wave 0 |
| ACFT-02 | GET /aircraft?search=3055 filters by MSN | integration | `pytest fastapi-project/tests/test_aircraft.py::test_search_aircraft_by_msn -x` | No -- Wave 0 |
| ACFT-02 | GET /aircraft?search=LZ filters by registration | integration | `pytest fastapi-project/tests/test_aircraft.py::test_search_aircraft_by_registration -x` | No -- Wave 0 |
| ACFT-03 | GET /aircraft/{msn} returns detail with rates and EPR | integration | `pytest fastapi-project/tests/test_aircraft.py::test_get_aircraft_detail -x` | No -- Wave 0 |
| ACFT-03 | GET /aircraft/{msn} returns 404 for unknown MSN | integration | `pytest fastapi-project/tests/test_aircraft.py::test_get_aircraft_not_found -x` | No -- Wave 0 |
| ACFT-04 | PUT /aircraft/{msn}/rates updates cost params (admin) | integration | `pytest fastapi-project/tests/test_aircraft.py::test_update_rates_as_admin -x` | No -- Wave 0 |
| ACFT-04 | PUT /aircraft/{msn}/rates returns 403 for non-admin | integration | `pytest fastapi-project/tests/test_aircraft.py::test_update_rates_forbidden -x` | No -- Wave 0 |
| ACFT-04 | Changes reflected immediately after update | integration | `pytest fastapi-project/tests/test_aircraft.py::test_update_rates_reflected -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest fastapi-project/tests/test_aircraft.py -x`
- **Per wave merge:** `pytest fastapi-project/tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `fastapi-project/tests/test_aircraft.py` -- covers ACFT-01 through ACFT-04
- [ ] Extend `fastapi-project/tests/conftest.py` -- add MockConnection handlers for aircraft/rates/EPR tables, add aircraft fixture data
- [ ] No new framework install needed -- pytest + pytest-asyncio already in requirements.txt

## Sources

### Primary (HIGH confidence)
- Excel workbook `UNA Pricing Model 1 year.xlsx` -- complete audit of 'A ' sheet structure, all 11 MSNs, all EPR tables, rate values, escalation rates
- Existing codebase (`fastapi-project/app/`) -- BaseRepository, UserRepository, router, schemas, auth dependencies, conftest patterns
- Existing codebase (`nextjs-project/src/`) -- Server Components, Server Actions, api.ts, session.ts, Sidebar, layout patterns

### Secondary (MEDIUM confidence)
- [asyncpg NUMERIC handling](https://github.com/MagicStack/asyncpg/issues/1113) -- NUMERIC precision requires explicit scale to avoid scientific notation
- [FastAPI file uploads](https://fastapi.tiangolo.com/tutorial/request-files/) -- UploadFile pattern for Excel/CSV upload
- [openpyxl documentation](https://openpyxl.readthedocs.io/) -- data_only=True for reading computed values
- [Next.js data fetching](https://nextjs.org/docs/app/getting-started/fetching-data) -- Server Components async/await pattern

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources (codebase + Excel workbook)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- entirely based on existing project dependencies, no new libraries except openpyxl
- Architecture: HIGH -- follows established patterns from Phase 1 (BaseRepository, router, schemas, Server Components)
- Pitfalls: HIGH -- verified against asyncpg documentation and existing codebase patterns
- Data model: HIGH -- derived from direct Excel workbook audit with specific cell references
- EPR matrix structure: HIGH -- audited all 11 MSNs' EPR tables with exact row counts and ratio ranges

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- no rapidly changing dependencies)
