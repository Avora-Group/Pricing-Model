# Phase 6: Project Schema Foundation - Research

**Researched:** 2026-06-05
**Domain:** PostgreSQL schema evolution via idempotent raw-SQL migrations (asyncpg) + Pydantic schema exposure, in a shipped FastAPI app
**Confidence:** HIGH (grounded in direct reads of migrations 003/004/006/007, the migration runner, ProjectRepository, pricing schemas, projects router, and the test conftest MockConnection)

## Summary

Phase 6 is a pure data-layer foundation phase: add a project lifecycle status (`potential`/`signed`) and provenance tracking (`signed_at`, `status_source`) to `pricing_projects`, and add a nullable `quotes.project_id` FK linking quotes to projects. No new behavior ships in this phase — it creates the columns that Phases 7, 9, and 10 build on. There is no CONTEXT.md for this phase, so no locked user decisions constrain the research; the relevant constraints come from PROJECT.md decisions (recorded in STATE.md) and the prior v2.0 ARCHITECTURE/PITFALLS research.

The codebase has a well-established idempotent migration pattern: raw `.sql` files in `fastapi-project/migrations/`, applied in sorted filename order at startup by `run_migrations()` in `app/main.py`, tracked in a `_migrations` table under a `pg_advisory_lock(1)`, each file run inside its own transaction. Migrations 006 and 007 are the canonical analogs for this phase — they use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` to evolve existing tables idempotently. Existing rows are backfilled cleanly by column DEFAULTs (every existing project becomes `potential`, every existing quote gets `project_id = NULL`), so no data-migration step is required.

**Primary recommendation:** Ship two new idempotent migrations — `008_add_project_status.sql` (status + status_source + signed_at + supporting index on `pricing_projects`) and `009_link_quotes_to_projects.sql` (nullable `project_id` FK + index on `quotes`) — following the 006/007 ALTER-with-IF-NOT-EXISTS convention. Expose the new columns on `ProjectResponse` (and its response constructors in `projects.py`) so downstream phases can read status. Add fixtures/handlers to the test conftest only where the dynamic SELECT/UPDATE handlers don't already cover the new columns. Do not add any auto-sign or status-mutation behavior in this phase (that is Phase 7/9).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROJ-01 | Every pricing project has a status of `potential` or `signed` (new projects default to `potential`) | Migration `008` adds `status TEXT NOT NULL DEFAULT 'potential' CHECK (status IN ('potential','signed'))` to `pricing_projects`. DEFAULT backfills all existing rows; CHECK enforces the two-state domain. `ProjectResponse` gains a `status` field. `create_project` relies on the column DEFAULT (no code change needed to default to potential). |
| PROJ-05 | Status changes record provenance: `signed_at` timestamp and whether the change was automatic or manual (manual overrides never overwritten by automation) | Migration `008` adds `status_source TEXT NOT NULL DEFAULT 'manual' CHECK (status_source IN ('automatic','manual'))` and `signed_at TIMESTAMPTZ` (nullable). This phase only *creates* the provenance columns; the *enforcement* logic ("manual never overwritten by automation") is implemented in Phase 7 (auto-sign) and Phase 9 (manual control). The schema must make that enforcement possible — i.e. the provenance columns exist and `ProjectRepository.update_project(**fields)` (already generic) can write them. |

**Scope boundary:** PROJ-02 (manual control UI/endpoint), PROJ-03 (wiring project_id through save), and PROJ-04 (auto-sign on accept) are explicitly **out of this phase** (Phases 7 and 9). Phase 6 delivers columns + read exposure + green tests only. The `quotes.project_id` *column* is added here (foundation) even though PROJ-03's *wiring* lands in Phase 7 — the column must exist before Phase 7 can use it, and adding it here keeps all schema changes in the foundation phase.
</phase_requirements>

## Standard Stack

No new libraries. This phase uses the existing, version-pinned stack exactly as-is.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 15+ | `ALTER TABLE`, `CHECK`, FK, partial/regular indexes | Established project DB; raw SQL migrations |
| asyncpg | (pinned in requirements) | Driver; returns `NUMERIC`→`Decimal`, runs migration SQL | Existing data-access driver |
| Pydantic | v2 (FastAPI) | `ProjectResponse` schema exposure of new columns | Existing response models |
| pytest | 8.3.4 | Test runner (`asyncio_mode = auto`) | Existing suite |
| pytest-asyncio | 0.25.2 | Async test support | Existing |
| httpx | 0.28.1 | `AsyncClient` + `ASGITransport` integration tests | Existing |

### Supporting
| Component | Where | Purpose | When to Use |
|-----------|-------|---------|-------------|
| `run_migrations()` | `app/main.py:17` | Applies new `008`/`009` `.sql` on startup under advisory lock | Automatically — just drop the files in `migrations/` |
| `ProjectRepository.update_project(**fields)` | `app/pricing/repository.py:175` | Generic dynamic UPDATE; already supports writing arbitrary columns incl. new status fields | No new repo method strictly required for writes |
| `MockConnection` | `tests/conftest.py:90` | In-memory DB for tests; routes by table | Must keep working with new columns/queries |

**Installation:** None. No `pip install`, no `package.json` change.

## Architecture Patterns

### Migration file convention (verified from 003/004/006/007)
```
fastapi-project/migrations/
├── 001_create_users.sql
├── ...
├── 007_azure_auth.sql        ← last applied
├── 008_add_project_status.sql      ← NEW
└── 009_link_quotes_to_projects.sql ← NEW
```

Rules observed in the existing files (all HIGH confidence — read directly):
- **Filename:** `NNN_snake_case_description.sql`, zero-padded 3-digit prefix, sorted lexicographically by `sorted(migrations_dir.glob("*.sql"))`. `008`/`009` sort correctly after `007`.
- **Idempotency primitives:** `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, and for constraints the `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` pair (migration 006).
- **Transaction wrapping:** the runner wraps each file in `async with conn.transaction()` and records it in `_migrations`. Files themselves do NOT contain `BEGIN/COMMIT` — do not add them.
- **Header comment:** each migration opens with a `-- Migration NNN: ...` comment and a short purpose line (003 has an extended NUMERIC precision legend). Match this style.
- **Money/precision:** monetary columns use explicit `NUMERIC(p,s)`. No money columns are added in this phase, so this is informational only.

### Pattern 1: Add a CHECK-constrained enum column with a DEFAULT (PROJ-01)
**What:** Add `status` as a `TEXT NOT NULL DEFAULT 'potential'` with a `CHECK (status IN (...))`. The DEFAULT backfills every existing row at `ADD COLUMN` time; the CHECK enforces the two-state domain. This mirrors how `quotes.status` and `project_msn_inputs.environment/lease_type` are modeled (004/003).
**When to use:** Whenever a new categorical column must apply to existing rows with a safe default.
**Example:**
```sql
-- Source: pattern from migrations/004_create_quotes.sql (quotes.status CHECK)
--         + migrations/006 (ALTER TABLE ADD with IF NOT EXISTS)
ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'potential'
    CHECK (status IN ('potential', 'signed'));
```
> Idempotency caveat (MEDIUM confidence — Postgres semantics): `ADD COLUMN IF NOT EXISTS` is fully idempotent, but the *inline CHECK constraint* it creates gets an auto-generated name and is only added when the column is added. On a re-run where the column already exists, the `IF NOT EXISTS` skips the whole clause, so the constraint is not duplicated. This is safe. If you instead split the constraint into a separate `ALTER TABLE ... ADD CONSTRAINT`, that statement is NOT idempotent on its own — use the `DROP CONSTRAINT IF EXISTS ... ; ADD CONSTRAINT ...` pair (migration 006 pattern) for any standalone named constraint.

### Pattern 2: Provenance columns (PROJ-05)
**What:** Add `status_source TEXT NOT NULL DEFAULT 'manual' CHECK (...)` and `signed_at TIMESTAMPTZ` (nullable — only set when a project becomes signed). Existing rows backfill to `status='potential'` / `status_source='manual'` / `signed_at=NULL`, which is the correct "never auto-touched" baseline.
**When to use:** When automation and humans both write the same field and the human must win.
**Example:**
```sql
ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS status_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (status_source IN ('automatic', 'manual'));
ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;  -- NULL until signed
CREATE INDEX IF NOT EXISTS idx_pricing_projects_status
  ON pricing_projects(status);
```
> **Naming note (MEDIUM confidence — reconcile during planning):** The phase success criteria and PROJ-05 say `status_source` with values "automatic vs manual." The earlier ARCHITECTURE.md proposed a boolean `status_overridden` instead. These model the same invariant two different ways. The success criteria for THIS phase explicitly name `status_source` (automatic/manual) + `signed_at`, so **follow the success criteria**: use `status_source` with the two string values. Flag that Phase 7's auto-sign guard (ARCHITECTURE.md step 4) must be rewritten to check `status_source <> 'manual'` instead of `not status_overridden`. Do not ship both columns.

### Pattern 3: Nullable FK to link tables without breaking existing rows (foundation for PROJ-03)
**What:** Add `quotes.project_id INTEGER REFERENCES pricing_projects(id)` — **nullable**, default `NO ACTION` on delete. Existing immutable quotes get `NULL` (valid). Standalone (project-less) quotes remain possible forever.
**When to use:** Linking an existing table to another without a backfill or NOT NULL.
**Example:**
```sql
-- Source: nullable FK pattern; pricing_projects PK from migrations/003
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES pricing_projects(id);
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);
```
> Idempotency caveat (MEDIUM confidence): like the inline CHECK, the FK constraint is created together with the column under `ADD COLUMN IF NOT EXISTS`, so a re-run skips it cleanly. Verified safe for the runner's "skip already-applied files" model anyway — `_migrations` ensures a file runs at most once; the `IF NOT EXISTS` guards are belt-and-suspenders for manual re-runs (which the 006 header comment shows is a supported workflow: `psql $DATABASE_URL -f .../006_*.sql`).

### Pattern 4: Expose new columns on the Pydantic response
**What:** Add `status`, `status_source`, `signed_at` to `ProjectResponse` and to the three places that *construct* it in `projects.py` (`create_project`, `list_projects`, `get_project`). Use `.get(...)` with defaults so a row missing the column (e.g. a mock or pre-migration row) doesn't 500.
**Example:**
```python
# app/pricing/schemas.py — ProjectResponse (lines 161-169)
class ProjectResponse(BaseModel):
    id: int
    name: str | None = None
    exchange_rate: Decimal
    margin_percent: Decimal
    config_version_id: int | None = None
    status: str = "potential"                 # NEW
    status_source: str = "manual"             # NEW
    signed_at: datetime | None = None         # NEW (import datetime)
    msn_inputs: list[MsnInputResponse] = []

# projects.py constructors — add to each ProjectResponse(...):
#   status=project.get("status", "potential"),
#   status_source=project.get("status_source", "manual"),
#   signed_at=project.get("signed_at"),
```
> The three constructors already use `project.get("name")`, `project.get("exchange_rate", Decimal("0.85"))` etc., so the `.get`-with-default style is the established convention — follow it exactly.

### Anti-Patterns to Avoid
- **Making `quotes.project_id` NOT NULL** — breaks every existing quote and all future standalone quotes (ARCHITECTURE.md, PITFALLS.md). Keep nullable.
- **Storing status in `dashboard_state` JSONB instead of a real column** — status must be a first-class column on `pricing_projects` (PROJECT.md single-source-of-truth decision). JSONB snapshots are immutable point-in-time records, never the live status.
- **Implementing auto-sign or status-mutation logic in this phase** — out of scope. PROJ-04 auto-sign is Phase 7; PROJ-02 manual control is Phase 9. This phase only creates columns + read exposure.
- **Adding `BEGIN/COMMIT` inside the migration `.sql`** — the runner already wraps each file in a transaction (`app/main.py:45`). Nested transaction statements will error.
- **Shipping both `status_source` and `status_overridden`** — pick `status_source` (per success criteria); see Pattern 2 note.
- **A data-migration UPDATE to backfill status** — unnecessary; the column DEFAULT backfills existing rows atomically at `ADD COLUMN` time.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Running/ordering/locking migrations | A custom runner, manual `psql` step in deploy | Existing `run_migrations()` in `app/main.py` | Already handles advisory lock, `_migrations` tracking, sorted order, per-file transaction |
| Backfilling status on existing projects | A separate `UPDATE pricing_projects SET status=...` migration step | Column `DEFAULT 'potential'` | DEFAULT applies to all existing rows automatically at ALTER time |
| Dynamic UPDATE of project fields | A new `set_status` repo method | Existing `ProjectRepository.update_project(project_id, **fields)` | Already builds a dynamic SET clause + `updated_at=NOW()`; works for status fields. (Even though no write happens this phase, downstream phases reuse it.) |
| Default project status in code | Setting `status='potential'` in `create_project` INSERT | Rely on the column DEFAULT | `create_project` omits the column → DB fills the default; less code, single source of truth |

**Key insight:** The hard parts (idempotent migration application, dynamic updates, response construction) all already exist. This phase is additive plumbing into proven machinery — the risk is in *consistency* (matching conventions, keeping the mock DB and tests green), not in invention.

## Common Pitfalls

### Pitfall 1: Status automation overwrites a manual override (provenance design)
**What goes wrong:** A later phase's auto-sign unconditionally flips status, destroying a human decision.
**Why it happens:** No provenance column existed, so last-writer-wins.
**How to avoid (this phase's responsibility):** Create the provenance columns NOW with the right defaults — `status_source DEFAULT 'manual'`, `signed_at` nullable. Phase 7 then guards auto-writes with `WHERE status_source <> 'manual'`. Recovery cost is HIGH if provenance is missing (PITFALLS.md), LOW if added up front — which is exactly why it's foundation work. This phase does not implement the guard, but its schema must make the guard expressible.
**Warning signs:** Any temptation to ship `status` without `status_source`; any auto-sign code appearing in this phase.

### Pitfall 2: Mock DB (conftest) diverges from real schema → tests pass but prod breaks (or vice versa)
**What goes wrong:** New columns/queries don't round-trip through `MockConnection`, so either tests fail spuriously or they pass while masking a real bug.
**Why it happens:** The mock reimplements SQL semantics by hand, table by table.
**Analysis of actual conftest behavior (HIGH confidence — read directly):**
- **INSERT into `pricing_projects`** (`_handle_projects_insert`, line 754): parses column names from the INSERT statement and maps args positionally — so if `create_project` later inserts `status`, it flows through automatically. But `create_project` today does NOT insert status (it relies on the DB default), so the mock must also default it. The mock currently `setdefault`s `name/exchange_rate/margin_percent/config_*` — **add `new_row.setdefault("status", "potential")`, `setdefault("status_source", "manual")`, `setdefault("signed_at", None)`** so `ProjectResponse` construction in `create_project` finds them.
- **UPDATE on `pricing_projects`** (`_handle_projects_update`, line 789): parses the dynamic SET clause generically — writing `status`/`status_source`/`signed_at` via `update_project` already works with no change.
- **SELECT on `pricing_projects`** (`_handle_projects_select`, line 738): returns full stored rows; new keys pass through. No change needed beyond ensuring inserts set them.
- **INSERT into `quotes`** (`_handle_quotes_insert`, line 984): also parses columns dynamically — a `project_id` in the INSERT flows through. If `create_quote`'s INSERT isn't modified this phase (it isn't — wiring is Phase 7), no change needed, but consider `setdefault("project_id", None)` for forward-compat. **Do not** modify `_handle_quotes_update` (line 1020) — it only handles status and is unrelated.
**How to avoid:** Update the `pricing_projects` insert handler defaults; add a `test_*` fixture or assertions for the new fields; run the suite. Keep the mock's defaults exactly matching the SQL column DEFAULTs.
**Warning signs:** `ProjectResponse` validation error in `create_project` test (`status` field required but missing); a test asserting `status == 'potential'` getting `None`.

### Pitfall 3: Re-running migrations isn't actually idempotent
**What goes wrong:** A standalone named constraint or a non-guarded `ADD CONSTRAINT` errors on a second run.
**Why it happens:** `ADD COLUMN IF NOT EXISTS` is idempotent; a separate `ALTER TABLE ADD CONSTRAINT foo` is not.
**How to avoid:** Keep CHECK/FK constraints *inline* with the `ADD COLUMN IF NOT EXISTS` (so they're skipped together on re-run), exactly as shown in Patterns 1–3. If any constraint must be standalone, use migration 006's `DROP CONSTRAINT IF EXISTS x; ADD CONSTRAINT x ...` pair. Note the runner already prevents double-application via `_migrations`; the `IF NOT EXISTS` guards protect the documented manual `psql -f` re-run workflow.
**Warning signs:** `column "status" already exists` or `constraint "..." already exists` when running the file twice by hand.

### Pitfall 4: `signed_at` semantics undefined
**What goes wrong:** `signed_at` is set inconsistently (on create? on first sign? overwritten on re-sign?), confusing Phase 10's trend chart (DASH-06 reads `signed_at`).
**Why it happens:** This phase creates the column but the write rules live downstream.
**How to avoid:** Document the intended contract in the migration comment even though enforcement is later: `signed_at` is NULL for potential projects, set to the timestamp the project first transitions to `signed`, and (recommended) not overwritten on subsequent signs. Leave it nullable with no default. Flag for Phase 7/9 planning.
**Warning signs:** A non-null DEFAULT on `signed_at`; potential projects with a `signed_at` value.

## Code Examples

### Migration 008 (complete, idempotent)
```sql
-- Source: convention from migrations/004 (CHECK enum), 006 (idempotent ALTER + constraint), 007 (ADD COLUMN IF NOT EXISTS)
-- Migration 008: Add project lifecycle status + provenance to pricing_projects
-- Phase 6: Project Schema Foundation (PROJ-01, PROJ-05)
--
-- status: two-state lifecycle. Existing rows backfill to 'potential' via DEFAULT.
-- status_source: provenance so automation never overwrites a manual decision (enforced in later phases).
-- signed_at: timestamp a project first became 'signed' (NULL while potential).

ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'potential'
    CHECK (status IN ('potential', 'signed'));

ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS status_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (status_source IN ('automatic', 'manual'));

ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pricing_projects_status
  ON pricing_projects(status);
```

### Migration 009 (complete, idempotent)
```sql
-- Migration 009: Link quotes to projects via nullable FK
-- Phase 6: Project Schema Foundation (foundation for PROJ-03; wiring lands in Phase 7)
--
-- project_id is NULLABLE: existing quotes stay NULL (valid); standalone quotes remain possible.
-- ON DELETE defaults to NO ACTION so a linked quote blocks silent project deletion.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES pricing_projects(id);

CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);
```

### Mock DB handler delta (conftest)
```python
# tests/conftest.py — _handle_projects_insert (~line 772), add to the setdefault block:
new_row.setdefault("status", "potential")
new_row.setdefault("status_source", "manual")
new_row.setdefault("signed_at", None)
# (Optional forward-compat in _handle_quotes_insert ~line 1011:)
new_row.setdefault("project_id", None)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pricing_projects` has no status (scratch container) | `status` + provenance columns | This phase | Projects gain a lifecycle |
| `quotes` unlinked to projects | nullable `quotes.project_id` FK | This phase | Enables Phase 7 linkage + Phase 10 metrics |
| Boolean `status_overridden` (proposed in ARCHITECTURE.md) | `status_source` enum ('automatic'/'manual') per success criteria | This phase | Phase 7 guard must use `status_source <> 'manual'` |

**Deprecated/outdated:** The `status_overridden` boolean from the earlier ARCHITECTURE.md draft is superseded by `status_source` for this phase. Do not ship it.

## Open Questions

1. **`signed_at` write contract**
   - What we know: nullable, set when a project becomes signed, read by DASH-06 trend chart.
   - What's unclear: overwrite-on-re-sign vs first-sign-only; set on manual sign as well as auto-sign.
   - Recommendation: Phase 6 only creates the nullable column with no default. Document "set on first transition to signed, not overwritten" in the migration comment; lock the exact rule in Phase 7/9 planning.

2. **`status_source` vs `status_overridden` naming reconciliation**
   - What we know: success criteria + PROJ-05 mandate `status_source` (automatic/manual); ARCHITECTURE.md proposed `status_overridden` boolean.
   - What's unclear: nothing for this phase — follow the success criteria.
   - Recommendation: Use `status_source`. Add a note to Phase 7 planning that the auto-sign guard becomes `status_source <> 'manual'`.

3. **Does `create_project` need to set `status_source='manual'` explicitly?**
   - What we know: new projects default to `potential`/`manual` via column DEFAULTs.
   - What's unclear: whether a brand-new potential project's source is conceptually "manual" or "none."
   - Recommendation: DEFAULT `'manual'` is fine — a new project's status was set by a human creating it; automation only ever escalates to signed. No code change to `create_project`.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.4 + pytest-asyncio 0.25.2 (`asyncio_mode = auto`) |
| Config file | `fastapi-project/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd fastapi-project && python -m pytest tests/test_pricing.py -x -q` |
| Full suite command | `cd fastapi-project && python -m pytest -q` |

> Tests run against the in-memory `MockConnection` (no real Postgres needed). The migration `.sql` files are NOT executed by the test suite — they run only at app startup against a real DB. Therefore migration idempotency must be verified separately (see Wave 0).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | New project defaults to `status='potential'` in response | integration | `python -m pytest tests/test_pricing.py -k "create_project" -x` | ✅ (extend existing `test_create_project`) |
| PROJ-01 | `ProjectResponse` exposes `status` on GET detail/list | integration | `python -m pytest tests/test_pricing.py -k "project_detail or list_projects" -x` | ✅ (extend) |
| PROJ-05 | `status_source` defaults to `manual`, `signed_at` is null on new project | integration | `python -m pytest tests/test_pricing.py -k "create_project" -x` | ✅ (extend) |
| PROJ-05 | `update_project(status='signed', status_source='automatic', signed_at=...)` round-trips | unit/integration | `python -m pytest tests/test_pricing.py -k "project_status" -x` | ❌ Wave 0 (new test) |
| PROJ-03 (foundation) | A quote row can carry `project_id` and a null `project_id` is valid | integration | `python -m pytest tests/test_quotes.py -k "project_id" -x` | ❌ Wave 0 (new test) |
| Migration idempotency | `008`/`009` re-run without error on a real DB | manual-only | `psql $DATABASE_URL -f migrations/008_add_project_status.sql` (run twice) | ❌ Wave 0 — manual; mock DB cannot exercise `.sql` |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/test_pricing.py -x -q`
- **Per wave merge:** `python -m pytest -q` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`; plus a one-time manual double-run of `008`/`009` against a scratch Postgres to prove idempotency.

### Wave 0 Gaps
- [ ] `tests/test_pricing.py` — extend `test_create_project`, `test_get_project_detail`, `test_list_projects` to assert `status == 'potential'`, `status_source == 'manual'`, `signed_at is None`.
- [ ] `tests/test_pricing.py` — add `test_project_status_update` asserting `update_project` round-trips `status`/`status_source`/`signed_at` through `ProjectRepository`/mock.
- [ ] `tests/test_quotes.py` — add a test that a quote with `project_id=None` (existing path) still serializes, and (if a write path is touched) that `project_id` persists.
- [ ] `tests/conftest.py` — add `setdefault` for `status`/`status_source`/`signed_at` in `_handle_projects_insert` (and optional `project_id` in `_handle_quotes_insert`).
- [ ] Manual: run `008`/`009` twice against a real/scratch Postgres to prove `IF NOT EXISTS` idempotency (cannot be covered by the mock DB).
- [ ] Framework install: none — pytest/asyncio/httpx already pinned and present.

## Sources

### Primary (HIGH confidence)
- `fastapi-project/migrations/003_create_pricing_config.sql` — `pricing_projects`, `project_msn_inputs` schema; NUMERIC precision legend; CHECK enum pattern
- `fastapi-project/migrations/004_create_quotes.sql` — `quotes` schema; `status` CHECK enum; index conventions
- `fastapi-project/migrations/006_add_viewer_role.sql` — idempotent constraint swap (`DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`); manual `psql -f` re-run workflow noted in header
- `fastapi-project/migrations/007_azure_auth.sql` — `ALTER TABLE ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`
- `fastapi-project/app/main.py:17-51` — `run_migrations()`: advisory lock, `_migrations` table, sorted glob, per-file transaction
- `fastapi-project/app/pricing/repository.py:136-191` — `ProjectRepository`: `create_project` (omits status, relies on DEFAULT), generic `update_project(**fields)`
- `fastapi-project/app/pricing/schemas.py:145-188` — `ProjectResponse`, `MsnInputResponse`, request schemas
- `fastapi-project/app/pricing/routes/projects.py` — three `ProjectResponse` constructors using `.get(...)` defaults
- `fastapi-project/tests/conftest.py` — `MockConnection`, `_detect_table`, per-table insert/update/select handlers, `db_store` fixture
- `fastapi-project/pytest.ini` + `requirements` — pytest 8.3.4 / pytest-asyncio 0.25.2 / httpx 0.28.1
- `.planning/STATE.md` — v2.0 decisions (single source of truth, escalation-only auto-sign, manual overrides sticky)
- `.planning/REQUIREMENTS.md` — PROJ-01, PROJ-05 definitions
- `.planning/research/ARCHITECTURE.md` + `.planning/research/PITFALLS.md` — v2.0 integration map and pitfalls

### Secondary (MEDIUM confidence)
- PostgreSQL `ADD COLUMN IF NOT EXISTS` inline-constraint idempotency semantics (standard Postgres behavior; not independently re-verified against current docs this session)

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all components read directly
- Architecture / migration pattern: HIGH — four existing migrations + runner read directly
- Pitfalls: HIGH — conftest behavior verified line-by-line; provenance pitfall grounded in prior research
- Constraint idempotency edge cases: MEDIUM — relies on standard Postgres semantics not re-verified against live docs

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable internal codebase; 30 days)
