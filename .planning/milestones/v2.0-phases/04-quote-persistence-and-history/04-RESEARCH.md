# Phase 4: Quote Persistence and History - Research

**Researched:** 2026-03-09
**Domain:** Quote persistence (PostgreSQL JSONB snapshots), Quote management (CRUD + status workflow), PDF generation (Python), Sensitivity analysis (charting), Frontend list/detail pages
**Confidence:** HIGH

## Summary

Phase 4 transforms the ACMI Pricing Platform from a stateless calculation tool into a persistent quote management system. The core technical challenge is capturing the full application state (all 3 Zustand stores + calculated results + monthly P&L arrays) as an immutable snapshot that can be faithfully restored later, even if underlying configs have changed. The existing codebase provides a strong foundation: versioned configs, typed Pydantic schemas, raw SQL via asyncpg, and Server Action patterns all extend naturally to quote operations.

The database design uses a hybrid approach: normalized columns for searchable/filterable quote metadata (client name, status, quote number, dates) with JSONB columns for the bulky snapshot data (monthly P&L arrays, config snapshots, MSN input arrays). This avoids schema explosion while keeping queries fast for the list view. The sensitivity analysis feature is a self-contained calculation page that reuses the existing `/pricing/calculate` endpoint, varying one parameter across 5 data points and displaying results in a table plus a Recharts line chart.

**Primary recommendation:** Build quotes as a new `app/quotes/` FastAPI module (router, repository, schemas, service) alongside a migration 004 for the `quotes` and `quote_msn_snapshots` tables. Use JSONB for monthly P&L data and config snapshots. PDF generation and quote detail view layout are BLOCKED pending the user's Excel summary file -- plan those as a separate wave that can slot in later.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Quote snapshot depth -- FULL APP STATE**: When a user saves a quote, capture EVERYTHING: Dashboard inputs + summary, full monthly P&L breakdown, all crew cost assumptions, all aircraft cost parameters, all pricing config values, exchange rate, margin. Loading a saved quote populates ALL tabs. Both per-MSN and total project results stored. Schema stores full denormalized data.
- **Quote editability -- FORK BEHAVIOR**: Loading a saved quote populates all tabs as an editable working copy. Changes create a NEW quote when saved -- the original quote remains immutable.
- **Quote detail view layout -- WAITING FOR EXCEL**: Blocked until user shares Excel summary file. Planning cannot proceed for this layout.
- **PDF export -- BLOCKED**: Content and layout depend on Excel summary file. Server-side Python generation (reportlab or weasyprint). Blocked until file received.
- **Sensitivity analysis**: User can vary any single input from a dropdown. Fixed 5 data points: -20%, -10%, base, +10%, +20%. Display both comparison table and line chart. Separate page (/sensitivity) with sidebar nav item.
- **Quote workflow & status**: Status values: Draft, Sent, Accepted, Rejected -- purely informational labels. Only creator or admin can change status. Auto-generated quote numbers with user-chosen client code prefix + sequential number (e.g., EZJ-001). No notes field.

### Claude's Discretion
- Database schema design for quote snapshots (how to efficiently store full app state)
- Quote list page: search/filter UI, sorting options, pagination approach
- Sensitivity analysis: chart library choice, which parameters to include in dropdown
- PDF: Python library choice (reportlab vs weasyprint), template design
- Quote number format details (separator, padding, prefix validation)
- How to serialize monthly P&L arrays for storage (JSONB vs normalized tables)

### Deferred Ideas (OUT OF SCOPE)
- Quote cloning/duplication as explicit action (v2 -- QUOT-07) -- fork behavior covers the use case
- Notes/attachments on quotes (v2 -- QUOT-08) -- user explicitly declined for v1
- Multi-parameter sensitivity (vary 2+ inputs simultaneously) -- v1 does single-parameter only
- Quote versioning (multiple versions of same quote number) -- v1 uses fork-to-new approach
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUOT-01 | User can save a completed pricing calculation as a named quote with client name | Database schema (quotes table), SaveQuote Server Action, QuoteRepository.create() |
| QUOT-02 | Saved quotes are immutable (original calculation preserved exactly as generated) | JSONB snapshot columns store full denormalized state; no FK references to mutable configs; immutability enforced by never exposing UPDATE on snapshot columns |
| QUOT-03 | User can view list of saved quotes with search and filter (by client, date, MSN) | Quote list page with server-side filtering, QuoteRepository.list_quotes() with WHERE clauses, pagination |
| QUOT-04 | User can view full detail of a saved quote including all component breakdowns | Quote detail view loads JSONB snapshots into Zustand stores, reuses PnlTable/SummaryTable/MsnSwitcher components. BLOCKED: layout depends on Excel summary file |
| QUOT-05 | User can set quote status: Draft, Sent, Accepted, Rejected | Status column on quotes table, updateStatus Server Action, permission check (creator or admin) |
| QUOT-06 | User can export a quote as PDF with professional formatting | BLOCKED: PDF content/layout depends on Excel summary file. WeasyPrint recommended for HTML-to-PDF. FastAPI endpoint returns StreamingResponse |
| SENS-01 | User can vary a single input parameter and see how the EUR/BH rate changes | Sensitivity page with parameter dropdown, calls existing /pricing/calculate 5 times with -20%/-10%/base/+10%/+20% variants |
| SENS-02 | Sensitivity results display as a comparison table or chart | Recharts LineChart for visual trend + HTML table for exact numbers, both on /sensitivity page |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL JSONB | 15+ | Store monthly P&L arrays and config snapshots | Native to existing DB; avoids schema explosion for variable-length arrays; indexed with GIN if needed |
| asyncpg | 0.30.0 | Raw SQL with JSONB support | Already in stack; supports `json.dumps()` for JSONB inserts via custom codec or `::jsonb` cast |
| recharts | 3.x | Sensitivity analysis line chart | React-native SVG charts; component-based API fits existing pattern; lightweight; works with 'use client' |
| weasyprint | 68.1 | PDF generation from HTML/CSS | HTML/CSS approach matches web dev skills; no headless browser needed; good CSS support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.577.0 | Icons for quote list/detail UI | Already installed; use FileText, Search, Filter, Download, ChevronDown icons |
| zustand | 5.0.11 | State management for quote loading | Already installed; quote load populates existing stores |
| zod | 4.3.6 | Form validation for save quote dialog | Already installed; validate client name, prefix |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WeasyPrint | ReportLab | ReportLab gives finer control but requires Python-coded layouts; WeasyPrint uses HTML/CSS which is faster to develop and maintain for this team |
| Recharts | Chart.js (react-chartjs-2) | Chart.js is canvas-based, larger bundle; Recharts is SVG, React-native, lighter for a single line chart |
| JSONB snapshots | Fully normalized tables | Normalized gives better queryability but would require 6+ new tables for monthly P&L data; JSONB is appropriate for write-once/read-whole audit snapshots |

**Installation:**
```bash
# Frontend
cd nextjs-project && npm install recharts

# Backend
cd fastapi-project && pip install weasyprint
# Add to requirements.txt: weasyprint==68.1
```

## Architecture Patterns

### Recommended Project Structure
```
fastapi-project/
  app/
    quotes/
      __init__.py
      repository.py    # QuoteRepository(BaseRepository) + QuoteNumberRepository
      router.py        # /quotes endpoints (CRUD, status, PDF)
      schemas.py       # Pydantic schemas for quote data
      service.py       # Quote number generation, snapshot assembly
  migrations/
    004_create_quotes.sql

nextjs-project/
  src/
    app/
      (dashboard)/
        quotes/
          page.tsx           # Quote list (Server Component)
        quotes/[id]/
          page.tsx           # Quote detail (Server Component)
        sensitivity/
          page.tsx           # Sensitivity analysis page
      actions/
        quotes.ts            # Server Actions for quote CRUD
    components/
      quotes/
        QuoteList.tsx        # Client component: filterable table
        QuoteDetail.tsx      # Client component: renders loaded quote
        SaveQuoteDialog.tsx  # Client component: save dialog with client name, prefix
        StatusBadge.tsx      # Status pill (Draft/Sent/Accepted/Rejected)
      sensitivity/
        SensitivityChart.tsx # Recharts line chart (client component)
        SensitivityTable.tsx # Comparison table
        ParameterPicker.tsx  # Dropdown to select which parameter to vary
    stores/
      pricing-store.ts       # Existing -- add loadFromQuote() action
      crew-config-store.ts   # Existing -- add loadFromSnapshot() action
      costs-config-store.ts  # Existing -- add loadFromSnapshot() action
```

### Pattern 1: JSONB Snapshot Storage
**What:** Store full app state as denormalized JSONB in the quotes table, with normalized metadata columns for search/filter.
**When to use:** When data is written once and read as a whole (audit trail / immutable snapshots).
**Example:**
```sql
-- Hybrid: normalized metadata + JSONB bulk data
CREATE TABLE quotes (
    id                  SERIAL PRIMARY KEY,
    quote_number        TEXT NOT NULL UNIQUE,    -- "EZJ-001"
    client_name         TEXT NOT NULL,
    client_code         TEXT NOT NULL,           -- "EZJ"
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
    -- Searchable metadata (normalized)
    exchange_rate       NUMERIC(8,4) NOT NULL,
    margin_percent      NUMERIC(6,4) NOT NULL,
    total_eur_per_bh    NUMERIC(12,4),           -- Final rate for quick display
    msn_list            INTEGER[] NOT NULL,       -- Array of MSNs for filtering
    period_start        TEXT,                     -- Earliest period start
    period_end          TEXT,                     -- Latest period end
    -- Full state snapshots (JSONB)
    pricing_config_snapshot  JSONB NOT NULL,      -- Full pricing config at save time
    crew_config_snapshot     JSONB NOT NULL,      -- Full crew config at save time
    costs_config_snapshot    JSONB NOT NULL,      -- Full costs config at save time
    dashboard_state          JSONB NOT NULL,      -- Project name, exchange rate, margin, ratios
    -- Ownership & timestamps
    created_by          INTEGER NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Pattern 2: Per-MSN Snapshot with Monthly P&L
**What:** Store per-MSN results in a child table, each with JSONB for monthly data.
**When to use:** When quotes contain variable numbers of MSNs, each with its own monthly P&L.
**Example:**
```sql
CREATE TABLE quote_msn_snapshots (
    id              SERIAL PRIMARY KEY,
    quote_id        INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    msn             INTEGER NOT NULL,
    aircraft_type   TEXT NOT NULL,
    aircraft_id     INTEGER NOT NULL,
    -- MSN-level inputs (denormalized from MsnInput)
    msn_input       JSONB NOT NULL,              -- Full MsnInput object
    -- Calculated results
    breakdown       JSONB NOT NULL,              -- ComponentBreakdown
    monthly_pnl     JSONB NOT NULL,              -- Full monthly P&L array data
    -- Quick-access columns
    monthly_cost    NUMERIC(12,2),
    monthly_revenue NUMERIC(12,2),
    UNIQUE(quote_id, msn)
);
```

### Pattern 3: Quote Number Generation
**What:** Auto-generate unique quote numbers with client code prefix + sequential counter.
**When to use:** Every quote save.
**Example:**
```python
async def generate_quote_number(self, client_code: str) -> str:
    """Generate next sequential quote number for a client code.

    Uses SELECT ... FOR UPDATE to prevent race conditions.
    Example: EZJ-001, EZJ-002, RYR-001
    """
    client_code = client_code.upper().strip()
    row = await self.fetch_one(
        """SELECT quote_number FROM quotes
           WHERE client_code = $1
           ORDER BY created_at DESC LIMIT 1
           FOR UPDATE""",
        client_code,
    )
    if row:
        last_seq = int(row["quote_number"].split("-")[-1])
        next_seq = last_seq + 1
    else:
        next_seq = 1
    return f"{client_code}-{next_seq:03d}"
```

### Pattern 4: Sensitivity Calculation (Client-Side)
**What:** Vary a single parameter across 5 data points and display results.
**When to use:** On the /sensitivity page.
**Example:**
```typescript
// Sensitivity parameters the user can select
const SENSITIVITY_PARAMS = [
  { key: 'mgh', label: 'Monthly Guaranteed Hours', unit: 'BH' },
  { key: 'exchangeRate', label: 'USD/EUR Exchange Rate', unit: '' },
  { key: 'marginPercent', label: 'Margin %', unit: '%' },
  { key: 'cycleRatio', label: 'Cycle Ratio', unit: '' },
  { key: 'crewSets', label: 'Crew Sets', unit: '' },
  { key: 'bhFhRatio', label: 'BH:FH Ratio', unit: '' },
  { key: 'apuFhRatio', label: 'APU FH:FH Ratio', unit: '' },
] as const

const STEPS = [-0.20, -0.10, 0, 0.10, 0.20]

// For each step: modify the selected parameter, call calculatePnlAction, collect final_rate_per_bh
```

### Pattern 5: Loading Quote into Stores (Fork Behavior)
**What:** Populate all 3 Zustand stores from a saved quote's JSONB snapshots.
**When to use:** When user opens a saved quote (fork for editing).
**Example:**
```typescript
// In pricing-store.ts, add:
loadFromQuote: (quoteData: QuoteSnapshot) => set({
  projectId: null, // New working copy, not linked to original
  projectName: quoteData.dashboardState.projectName,
  exchangeRate: quoteData.dashboardState.exchangeRate,
  marginPercent: quoteData.dashboardState.marginPercent,
  bhFhRatio: quoteData.dashboardState.bhFhRatio,
  apuFhRatio: quoteData.dashboardState.apuFhRatio,
  msnInputs: quoteData.msnInputs,
  msnResults: quoteData.msnResults,
  totalResult: quoteData.totalResult,
}),
```

### Anti-Patterns to Avoid
- **Storing FK references instead of denormalized data:** If a config changes after quote save, FK-referenced data changes too. Always snapshot the actual values.
- **Storing Decimal as float in JSONB:** Python `json.dumps` will convert Decimal to float, losing precision. Use a custom encoder that converts Decimal to string.
- **Computing monthly P&L on quote load:** The P&L must be the exact values from save time. Store computed monthly data, do not recalculate.
- **Modifying original quotes:** No UPDATE endpoint should touch snapshot data. Status is the only mutable field on a quote.
- **Using the same page component for list and detail:** Separate pages (/quotes and /quotes/[id]) with distinct Server Components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/canvas chart | Recharts `<LineChart>` | Responsive, accessible, handles axes/tooltips/legends automatically |
| PDF generation | Custom PDF byte manipulation | WeasyPrint `HTML(string=html).write_pdf()` | HTML/CSS is familiar; handles pagination, fonts, layout automatically |
| Quote number uniqueness | Application-level locking | PostgreSQL `FOR UPDATE` + sequential query | DB-level locking handles concurrent saves correctly |
| JSONB serialization | Manual dict building | Custom `DecimalEncoder(json.JSONEncoder)` | One encoder class handles all Decimal-to-string conversion |
| Date/time formatting | `strftime` chains | PostgreSQL `to_char()` or Python `isoformat()` | Consistent timezone-aware formatting |

**Key insight:** The heaviest custom work in this phase is the snapshot assembly (gathering state from 3 stores + calculated results into a single save payload) and the quote loading logic (deserializing JSONB back into typed store state). Everything else leverages existing libraries or patterns.

## Common Pitfalls

### Pitfall 1: Decimal Precision Loss in JSONB
**What goes wrong:** Python's `json.dumps()` converts `Decimal("185000.00")` to `185000.0` (float), losing precision and potentially introducing floating-point artifacts.
**Why it happens:** `json.dumps()` does not natively handle `Decimal` types.
**How to avoid:** Create a custom JSON encoder:
```python
import json
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return str(o)  # Store as string to preserve precision
        return super().default(o)

# Usage in repository:
json.dumps(snapshot_data, cls=DecimalEncoder)
```
**Warning signs:** Numbers appearing as `185000.0` instead of `"185000.00"` in JSONB columns.

### Pitfall 2: asyncpg JSONB Type Handling
**What goes wrong:** asyncpg does not automatically serialize Python dicts to JSONB. Passing a dict directly to a `$1` parameter for a JSONB column raises a type error.
**Why it happens:** asyncpg requires explicit JSON serialization.
**How to avoid:** Two options:
1. Cast in SQL: `$1::jsonb` and pass `json.dumps(data, cls=DecimalEncoder)` as a string parameter.
2. Set a type codec on the connection: `await conn.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')`.
Option 1 is simpler and fits the existing raw SQL pattern.
**Warning signs:** `asyncpg.exceptions.DataError: invalid input for query argument $1: ...`

### Pitfall 3: Stale Store State on Quote Save
**What goes wrong:** User modifies Crew tab values but the save payload captures the old values because the costs-config-store was not included in the snapshot.
**Why it happens:** The save action must gather state from ALL 3 stores (pricing, crew-config, costs-config) at the exact moment of save.
**How to avoid:** The save action explicitly reads `usePricingStore.getState()`, `useCrewConfigStore.getState()`, `useCostsConfigStore.getState()` synchronously and assembles the complete payload.
**Warning signs:** Loaded quote shows different cost values than what was visible at save time.

### Pitfall 4: Quote Number Race Conditions
**What goes wrong:** Two users saving quotes for the same client code simultaneously get the same sequence number.
**Why it happens:** Without row-level locking, both SELECT the same max sequence before INSERT.
**How to avoid:** Use `SELECT ... FOR UPDATE` to lock the row while generating the next number, or use a separate `quote_sequences` table with `UPDATE ... RETURNING`.
**Warning signs:** Unique constraint violations on `quote_number`.

### Pitfall 5: Recharts in Server Components
**What goes wrong:** Importing Recharts in a Server Component causes "Super expression must either be null or a function" error.
**Why it happens:** Recharts uses browser APIs (D3.js, DOM) that are not available during server rendering.
**How to avoid:** Always mark Recharts wrapper components with `'use client'` directive. Pass data from Server Components as props.
**Warning signs:** Build errors or hydration mismatches related to Recharts.

### Pitfall 6: Large JSONB Payloads
**What goes wrong:** Storing 12 months of full P&L data per MSN across 11 MSNs creates large JSONB documents, potentially causing slow inserts or reads.
**Why it happens:** Each MSN has ~60 line items x 12 months = 720 values, times 11 MSNs = ~8000 values per quote.
**How to avoid:** This is actually manageable -- a few KB per quote. PostgreSQL TOAST compression handles JSONB > 2KB transparently. No special optimization needed for this data volume. Monitor if quote save exceeds 100ms.
**Warning signs:** Quote save or load taking > 500ms.

## Code Examples

### Save Quote -- Server Action Pattern
```typescript
// src/app/actions/quotes.ts
'use server'
import { cookies } from 'next/headers'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export async function saveQuoteAction(payload: {
  client_name: string
  client_code: string
  dashboard_state: object       // From pricing-store
  pricing_config_snapshot: object // From costs-config-store
  crew_config_snapshot: object   // From crew-config-store
  costs_config_snapshot: object  // From costs-config-store
  msn_snapshots: Array<{
    msn: number
    aircraft_type: string
    aircraft_id: number
    msn_input: object           // Full MsnInput
    breakdown: object           // ComponentBreakdown
    monthly_pnl: object         // Full monthly data record
  }>
}): Promise<{ id: number; quote_number: string } | { error: string }> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Save failed' }))
      return { error: data.detail ?? 'Save failed' }
    }
    return res.json()
  } catch {
    return { error: 'Network error' }
  }
}
```

### Quote Repository -- JSONB Insert
```python
# app/quotes/repository.py
import json
from decimal import Decimal
from app.db.base_repository import BaseRepository


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that converts Decimal to string for precision preservation."""
    def default(self, o):
        if isinstance(o, Decimal):
            return str(o)
        return super().default(o)


class QuoteRepository(BaseRepository):
    async def create_quote(
        self,
        quote_number: str,
        client_name: str,
        client_code: str,
        created_by: int,
        exchange_rate: Decimal,
        margin_percent: Decimal,
        total_eur_per_bh: Decimal | None,
        msn_list: list[int],
        period_start: str | None,
        period_end: str | None,
        pricing_config_snapshot: dict,
        crew_config_snapshot: dict,
        costs_config_snapshot: dict,
        dashboard_state: dict,
    ) -> dict:
        return await self.fetch_one(
            """INSERT INTO quotes (
                quote_number, client_name, client_code, created_by,
                exchange_rate, margin_percent, total_eur_per_bh,
                msn_list, period_start, period_end,
                pricing_config_snapshot, crew_config_snapshot,
                costs_config_snapshot, dashboard_state
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb
            ) RETURNING *""",
            quote_number, client_name, client_code, created_by,
            exchange_rate, margin_percent, total_eur_per_bh,
            msn_list, period_start, period_end,
            json.dumps(pricing_config_snapshot, cls=DecimalEncoder),
            json.dumps(crew_config_snapshot, cls=DecimalEncoder),
            json.dumps(costs_config_snapshot, cls=DecimalEncoder),
            json.dumps(dashboard_state, cls=DecimalEncoder),
        )
```

### Sensitivity Analysis -- Recharts Chart
```typescript
// src/components/sensitivity/SensitivityChart.tsx
'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface DataPoint {
  label: string      // "-20%", "-10%", "Base", "+10%", "+20%"
  paramValue: number  // Actual parameter value at this step
  eurPerBh: number    // Resulting EUR/BH rate
}

export function SensitivityChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" stroke="#9CA3AF" fontSize={12} />
          <YAxis stroke="#9CA3AF" fontSize={12} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
            labelStyle={{ color: '#F3F4F6' }}
          />
          <ReferenceLine x="Base" stroke="#6366F1" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="eurPerBh"
            stroke="#818CF8"
            strokeWidth={2}
            dot={{ fill: '#818CF8', r: 4 }}
            name="EUR/BH"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### Quote List -- Server Component with Filters
```typescript
// src/app/(dashboard)/quotes/page.tsx
import { cookies } from 'next/headers'
import { QuoteList } from '@/components/quotes/QuoteList'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

async function fetchQuotes(search?: string, status?: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return []

  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)

  const res = await fetch(
    `${API_URL}/quotes?${params.toString()}`,
    { headers: { Cookie: `access_token=${token}` }, cache: 'no-store' }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function QuotesPage({ searchParams }: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const params = await searchParams
  const quotes = await fetchQuotes(params.search, params.status)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-100">Quotes</h1>
      <QuoteList quotes={quotes} />
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate quote_inputs + quote_outputs tables | JSONB snapshot columns | PostgreSQL 12+ JSONB maturity | Simpler schema, atomic snapshots |
| ReportLab Python-coded PDFs | WeasyPrint HTML/CSS-to-PDF | WeasyPrint 50+ (2022) | Faster development, reuse web skills |
| Chart.js with wrapper | Recharts 3.x native React | Recharts 3.0 (2024) | Better React integration, SSR-safe with 'use client' |
| Float for monetary JSON | String-encoded Decimals in JSONB | Industry best practice | Prevents precision loss in audit trails |

**Deprecated/outdated:**
- `react-chartjs-2` older wrapper patterns -- Recharts 3.x is now the standard React charting choice
- ReportLab for HTML-like documents -- WeasyPrint is simpler when content is HTML-structured
- Normalized tables for audit snapshots -- JSONB is standard for write-once/read-whole patterns

## Open Questions

1. **Quote detail view layout**
   - What we know: User wants it to match an Excel summary file
   - What's unclear: The Excel file has not been shared yet
   - Recommendation: Build the quote save/load/list infrastructure first. Add the detail view layout as a follow-up task once the Excel file is received. The quote detail page can initially show the existing PnlTable + SummaryTable components as a functional fallback.

2. **PDF export content and branding**
   - What we know: Server-side Python (WeasyPrint), company branded, content matches Excel summary
   - What's unclear: Excel summary file not received; company logo and branding details not provided
   - Recommendation: Build the PDF endpoint skeleton (accepts quote ID, returns PDF StreamingResponse) with a placeholder template. Fill in the actual layout once the Excel file and branding assets arrive.

3. **Monthly P&L data size per quote**
   - What we know: ~60 line items x 12 months x up to 11 MSNs = ~8000 numeric values per quote
   - What's unclear: Whether this will cause any performance issues at scale (hundreds of quotes)
   - Recommendation: JSONB with TOAST compression handles this fine. Each quote snapshot is a few KB. No optimization needed for v1. Add a DB index on `quotes(client_name, created_at)` for list queries.

4. **Sensitivity analysis parameter list**
   - What we know: User wants to vary "any single input" from a dropdown
   - What's unclear: Exact list of parameters -- some make sense to vary (MGH, exchange rate, margin) while others are less meaningful (crew sets is discrete 1-5)
   - Recommendation: Include all continuous numeric parameters: MGH, exchange rate, margin %, cycle ratio, BH:FH ratio, APU FH:FH ratio. Exclude discrete/enum parameters (environment, lease type, aircraft type). For crew sets (integer), allow it but use integer steps instead of percentage steps.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.4 + pytest-asyncio 0.25.2 |
| Config file | `fastapi-project/tests/conftest.py` (MockConnection pattern) |
| Quick run command | `cd /Users/abu/Documents/Claud/fastapi-project && python -m pytest tests/test_quotes.py -x -q` |
| Full suite command | `cd /Users/abu/Documents/Claud/fastapi-project && python -m pytest tests/ -x -q` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUOT-01 | Save quote with client name | integration | `pytest tests/test_quotes.py::test_create_quote -x` | Wave 0 |
| QUOT-02 | Quote immutability (no update on snapshots) | integration | `pytest tests/test_quotes.py::test_quote_immutable -x` | Wave 0 |
| QUOT-03 | List quotes with search/filter | integration | `pytest tests/test_quotes.py::test_list_quotes_filtered -x` | Wave 0 |
| QUOT-04 | Quote detail with full breakdown | integration | `pytest tests/test_quotes.py::test_get_quote_detail -x` | Wave 0 |
| QUOT-05 | Status update (creator/admin only) | integration | `pytest tests/test_quotes.py::test_update_status -x` | Wave 0 |
| QUOT-06 | PDF export | integration | `pytest tests/test_quotes.py::test_pdf_export -x` | Wave 0 (BLOCKED -- placeholder) |
| SENS-01 | Sensitivity calculation 5 variants | unit | `pytest tests/test_sensitivity.py::test_sensitivity_calc -x` | Wave 0 |
| SENS-02 | Sensitivity response format | unit | `pytest tests/test_sensitivity.py::test_sensitivity_response -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /Users/abu/Documents/Claud/fastapi-project && python -m pytest tests/test_quotes.py -x -q`
- **Per wave merge:** `cd /Users/abu/Documents/Claud/fastapi-project && python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_quotes.py` -- covers QUOT-01 through QUOT-06
- [ ] `tests/test_sensitivity.py` -- covers SENS-01, SENS-02
- [ ] MockConnection handlers for `quotes` and `quote_msn_snapshots` tables in `conftest.py`
- [ ] Framework install: WeasyPrint (`pip install weasyprint`) -- may need system deps on macOS

## Database Schema Design (Detailed)

### Migration 004: `quotes` and `quote_msn_snapshots`

```sql
-- Migration 004: Create quotes and quote_msn_snapshots tables
-- Phase 4: Quote Persistence and History

-- Quote sequences for auto-numbering by client code
CREATE TABLE IF NOT EXISTS quote_sequences (
    client_code     TEXT PRIMARY KEY,
    last_seq        INTEGER NOT NULL DEFAULT 0
);

-- Main quotes table: metadata (normalized) + snapshots (JSONB)
CREATE TABLE IF NOT EXISTS quotes (
    id                      SERIAL PRIMARY KEY,
    quote_number            TEXT NOT NULL UNIQUE,
    client_name             TEXT NOT NULL,
    client_code             TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
    -- Quick-access metadata
    exchange_rate           NUMERIC(8,4) NOT NULL,
    margin_percent          NUMERIC(6,4) NOT NULL,
    total_eur_per_bh        NUMERIC(12,4),
    msn_list                INTEGER[] NOT NULL,
    period_start            TEXT,
    period_end              TEXT,
    -- Full state snapshots (JSONB, immutable after creation)
    pricing_config_snapshot JSONB NOT NULL,
    crew_config_snapshot    JSONB NOT NULL,
    costs_config_snapshot   JSONB NOT NULL,
    dashboard_state         JSONB NOT NULL,
    -- Ownership
    created_by              INTEGER NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_client ON quotes(client_code, created_at DESC);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created ON quotes(created_at DESC);
CREATE INDEX idx_quotes_msn_list ON quotes USING GIN(msn_list);

-- Per-MSN snapshot within a quote
CREATE TABLE IF NOT EXISTS quote_msn_snapshots (
    id              SERIAL PRIMARY KEY,
    quote_id        INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    msn             INTEGER NOT NULL,
    aircraft_type   TEXT NOT NULL,
    aircraft_id     INTEGER NOT NULL,
    msn_input       JSONB NOT NULL,
    breakdown       JSONB NOT NULL,
    monthly_pnl     JSONB NOT NULL,
    monthly_cost    NUMERIC(12,2),
    monthly_revenue NUMERIC(12,2),
    UNIQUE(quote_id, msn)
);

CREATE INDEX idx_quote_msn_snapshots_quote ON quote_msn_snapshots(quote_id);
```

### Key Schema Decisions
- **`quote_sequences` table**: Atomic counter per client code. `UPDATE quote_sequences SET last_seq = last_seq + 1 WHERE client_code = $1 RETURNING last_seq` is atomic and race-free.
- **`msn_list INTEGER[]`**: PostgreSQL native array allows `@>` (contains) operator for MSN filtering with GIN index.
- **`dashboard_state JSONB`**: Stores `{ projectName, exchangeRate, marginPercent, bhFhRatio, apuFhRatio }`.
- **No `updated_at`**: Quotes are immutable. Only `status` can change, and we do not need to track when.
- **`total_eur_per_bh`**: Denormalized for quick display in list view without parsing JSONB.
- **Client code validation**: 2-4 uppercase letters, validated in the API layer via Pydantic.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Full read of all existing stores (`pricing-store.ts`, `crew-config-store.ts`, `costs-config-store.ts`), repository patterns, router patterns, migration files, conftest.py mock patterns
- [asyncpg documentation](https://magicstack.github.io/asyncpg/current/usage.html) - JSONB type codec handling
- [PostgreSQL JSONB patterns](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/) - JSONB indexing and hybrid schema patterns

### Secondary (MEDIUM confidence)
- [recharts npm](https://www.npmjs.com/package/recharts) - Version 3.x, React-native SVG charts
- [WeasyPrint PyPI](https://pypi.org/project/weasyprint/) - Version 68.1, HTML/CSS to PDF
- [WeasyPrint vs ReportLab comparison](https://dev.to/claudeprime/generate-pdfs-in-python-weasyprint-vs-reportlab-ifi) - Development speed tradeoffs
- [Recharts with Next.js](https://app-generator.dev/docs/technologies/nextjs/integrate-recharts.html) - Client component requirement

### Tertiary (LOW confidence)
- [FastAPI + WeasyPrint async PDF](https://davidmuraya.com/blog/fastapi-create-secure-pdf/) - Endpoint pattern with StreamingResponse
- [PostgreSQL audit with JSONB](https://news.ycombinator.com/item?id=30615470) - Community discussion on JSONB for audit trails

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are either already installed (zustand, lucide, zod) or well-established (recharts, weasyprint, PostgreSQL JSONB)
- Architecture: HIGH - Schema design directly extends existing patterns (BaseRepository, versioned configs, Server Actions)
- Pitfalls: HIGH - Based on direct codebase analysis (Decimal handling, asyncpg JSONB, store synchronization)
- PDF/Detail view: LOW - BLOCKED by missing Excel summary file; placeholder approach recommended
- Sensitivity: MEDIUM - Straightforward reuse of existing calculate endpoint, but parameter list needs user validation

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 for stable patterns; PDF/detail view blocked until Excel file received

---
*Phase: 04-quote-persistence-and-history*
*Research completed: 2026-03-09*
