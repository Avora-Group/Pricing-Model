# Phase 7: Project Status Backend & Auto-Sign - Research

**Researched:** 2026-06-05
**Domain:** Transactional multi-table writes in FastAPI + asyncpg (raw SQL), provenance-guarded status automation, end-to-end quote→project linkage through a Next.js Server Action stack
**Confidence:** HIGH (grounded in direct reads of the live quotes router/repo, pricing repo, get_db, schemas, conftest MockConnection, the frontend save flow, and the Phase 6 summaries; asyncpg transaction semantics verified against official docs)

## Summary

Phase 7 turns the Phase 6 foundation (columns exist, nothing writes them) into live behavior: a saved quote carries its `project_id` end-to-end (PROJ-03), and accepting a linked quote flips its project to `signed` atomically, idempotently, escalation-only, and only when a human hasn't already taken over the status (PROJ-04). All the plumbing this needs already exists — `quotes.project_id` (migration 009), `status`/`status_source`/`signed_at` on `pricing_projects` (migration 008), the generic `ProjectRepository.update_project(**fields)`, and asyncpg's `connection.transaction()` on the pool connection that `get_db` yields. The work is wiring and one correctness-critical transactional hook, not invention.

Two non-obvious realities surfaced in the codebase reads and must shape the plan. First, the **manual-override guard cannot be `status_source <> 'manual'`** as earlier docs assumed: migration 008 defaults `status_source = 'manual'` for *every* project including brand-new untouched ones, so that guard would block auto-sign for all projects, failing success criteria 2. The correct, currently-expressible rule is **auto-sign fires only when `status = 'potential'`** (escalation-only + idempotent fall out of this for free), and a *manual* status action (Phase 9) is what sets `status_source='manual'` on a project that is *already* the way the user wants it — meaning the guard that actually protects a human decision is "don't touch a project that isn't `potential`." Auto-sign writes `status='signed', status_source='automatic', signed_at=NOW()`. Second, the **frontend never creates a persisted project today**: `setProjectId` and `createProjectAction` exist but are called nowhere, so `pricing-store.projectId` is effectively always `null`, and `SaveQuoteDialog` omits it from the payload anyway. PROJ-03's wiring must add `project_id` to every layer (Pydantic schema, INSERT, action type, dialog payload), but the plan must decide how a real `projectId` gets into the store — either accept that it stays null until a project-persistence flow exists (Phase 9 territory), or add a minimal "ensure project exists on save" step. This is the single biggest scoping decision for the phase.

**Primary recommendation:** Wire `project_id` through `SaveQuoteRequest` → `create_quote` INSERT → `quotes.ts` payload type → `SaveQuoteDialog` (sending `pricingState.projectId`, which respects the `loadFromQuote` fork that nulls it). Put auto-sign inside the existing `PATCH /quotes/{id}/status` handler wrapped in `async with db.transaction():`, guarded by `quote.project_id is not None AND project.status == 'potential' AND new_status == 'accepted'`. Test everything at the **repository/handler level with the `mock_db` fixture** (like `test_project_status_update`), never through the broken `_login()` helper. Add `transaction()` support to `MockConnection` (a no-op async context manager) so the handler runs under test.

## Standard Stack

No new libraries. Phase 7 uses the existing pinned stack exactly as-is.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| asyncpg | (pinned in requirements) | `connection.transaction()` async-context atomic write; raw SQL | Existing driver; transaction confirmed on pool connection |
| FastAPI | (pinned) | `PATCH /quotes/{id}/status` handler, `Depends(get_db)` | Existing router pattern |
| Pydantic | v2 | `SaveQuoteRequest.project_id` optional field | Existing request schemas |
| PostgreSQL | 15+ | `quotes.project_id` FK + `pricing_projects.status` (already shipped) | Migrations 008/009 already applied |
| pytest / pytest-asyncio | 8.3.4 / 0.25.2 (`asyncio_mode=auto`) | Repository + handler tests via `mock_db` | Existing suite; `test_project_status_update` is the template |
| Next.js | 14 (App Router) | Server Action `saveQuoteAction` cookie-forwarding fetch | Existing actions in `app/actions/quotes.ts` |
| Zustand | (pinned) | `pricing-store.projectId` already tracked | Existing session store |

### Supporting
| Component | Where | Purpose | When to Use |
|-----------|-------|---------|-------------|
| `ProjectRepository.update_project(project_id, **fields)` | `app/pricing/repository.py:175` | Generic dynamic UPDATE incl. `status`/`status_source`/`signed_at` + auto `updated_at=NOW()` | Auto-sign write — NO new repo method needed |
| `ProjectRepository.get_project(id)` | `app/pricing/repository.py:162` | Read project to check current `status` for the guard | Inside the auto-sign hook |
| `QuoteRepository.update_status` / `get_quote` | `app/quotes/repository.py:200,186` | Existing status write; `get_quote` already runs in the handler for the ownership check and returns all columns incl. `project_id` | Reuse; `project_id` is free (no extra query) |
| `get_db` | `app/db/database.py:55` | Yields a pool connection (NOT a pre-opened transaction) | Wrap auto-sign writes in `async with db.transaction():` |
| `MockConnection` | `tests/conftest.py:90` | In-memory DB; routes by table; dynamic SET/INSERT parsing | Must gain `transaction()` no-op + project_id round-trip |

**Installation:** None. No `pip install`, no `package.json` change.

## Architecture Patterns

### Where each layer changes (verified file-by-file)

| Layer | File | Change | Verified current state |
|-------|------|--------|------------------------|
| Request schema | `app/quotes/schemas.py:25` `SaveQuoteRequest` | Add `project_id: int \| None = None` | Currently has no project_id field |
| INSERT | `app/quotes/repository.py:35` `create_quote` | Add `project_id` param + column in INSERT VALUES | INSERT lists 14 columns, no project_id |
| Save handler | `app/quotes/router.py:82` `save_quote` | Pass `project_id=body.project_id` to `create_quote` | Currently doesn't reference project_id |
| Status handler | `app/quotes/router.py:238` `update_quote_status` | Add transactional auto-sign hook after `update_status` | Currently just updates quote status, returns |
| Action type | `nextjs-project/src/app/actions/quotes.ts:9` `SaveQuotePayload` | Add `project_id?: number \| null` | No project_id in payload type |
| Dialog payload | `nextjs-project/src/components/quotes/SaveQuoteDialog.tsx:97` | Add `project_id: pricingState.projectId` to `saveQuoteAction({...})` | Builds payload from 3 stores, omits projectId |
| Mock DB | `tests/conftest.py` `_handle_quotes_insert` / `MockConnection` | `project_id` already setdefaults to None (line 1019); ADD `transaction()` no-op CM; the real `create_quote` INSERT now carrying `project_id` flows through the dynamic column parser automatically | Insert handler parses columns dynamically; NO transaction() method exists |

### Pattern 1: Transactional auto-sign hook in the status handler (PROJ-04)
**What:** After the quote's status is updated to `accepted`, conditionally promote the linked project to `signed` in the SAME transaction, so quote-accepted and project-signed commit or roll back together.
**When to use:** This is the one multi-table write the milestone introduces — the highest-correctness-risk integration point.
**Where:** Inside `update_quote_status` in `app/quotes/router.py`, after the ownership check (which already loaded `quote` via `repo.get_quote`, so `quote["project_id"]` is available with no extra query).
**Example:**
```python
# Source: app/quotes/router.py update_quote_status (existing handler) +
#         asyncpg docs (connection.transaction() as async CM, verified 2026-06-05)
from app.pricing.repository import ProjectRepository

# ... ownership check already ran; `quote` is loaded, `body.status` validated ...

async with db.transaction():                       # get_db yields a pool conn, not an open txn
    updated = await repo.update_status(quote_id, body.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Quote not found")

    if body.status == "accepted" and quote.get("project_id") is not None:
        project_repo = ProjectRepository(db)
        project = await project_repo.get_project(quote["project_id"])
        # Guard: escalation-only + idempotent + manual-override-safe (see Pitfall 1)
        if project and project["status"] == "potential":
            await project_repo.update_project(
                quote["project_id"],
                status="signed",
                status_source="automatic",
                signed_at=datetime.now(timezone.utc),
            )
```
> `datetime`/`timezone` import needed in the router. `ProjectRepository` and `QuoteRepository` share the same `db` connection inside the `async with` block, so both writes are in one transaction. On any raised exception the whole block rolls back — quote status will NOT have flipped.

### Pattern 2: The manual-override guard, correctly (PROJ-04 criteria 3 & 4)
**What:** The guard that decides whether auto-sign fires. The naive `status_source <> 'manual'` is WRONG here (see Pitfall 1). Use the status itself.
**Rule (recommended, currently expressible with existing columns):**
> Auto-sign fires **iff** `new_status == 'accepted'` AND `quote.project_id IS NOT NULL` AND `project.status == 'potential'`.
- **Escalation-only (criterion 3):** only `potential → signed`; un-accept/reject paths never enter the `accepted` branch, so they never demote. ✓
- **Idempotent (criterion 2):** re-accepting an already-accepted quote whose project is already `signed` → `project.status != 'potential'` → guard skips the write. No error, no duplicate side effect. ✓
- **Manual-override-safe (criterion 4):** when Phase 9 lets a user manually set `signed` (or manually keep `potential` and later manually sign), the manual action stamps `status_source='manual'`. A manually-signed project is no longer `potential`, so auto-sign skips it — the human decision survives. A project a human deliberately left `potential` will still auto-sign on accept, which is the intended escalation, not an override violation. ✓ The provenance stamp (`status_source='automatic'`) records that THIS change was automatic (criterion 4's "stamped as automatic in provenance"). ✓

**Why not `status_source <> 'manual'`:** migration 008 defaults `status_source='manual'` for ALL existing and new projects (Phase 6 summary confirms `new_row.setdefault("status_source", "manual")`). That guard would be false for every project → auto-sign never fires → criterion 2 fails. The `status == 'potential'` guard is the correct, available signal because Phase 6 did NOT add a "was-manually-changed-after-creation" flag, and `status` alone cleanly distinguishes "nobody has signed this yet" from "already signed (by human or automation)."

### Pattern 3: project_id end-to-end wiring (PROJ-03)
**What:** Thread the optional `project_id` from the Zustand store through the Server Action to the INSERT, so a quote saved from a project persists its FK.
**Fork behavior (verified):** `pricing-store.loadFromQuote` sets `projectId: null` (line 293, comment "Fork: new working copy, not linked to original"). Sending `pricingState.projectId` from the dialog therefore automatically respects the fork — a forked quote saves with `project_id=null` (standalone), an in-project quote saves with its real id. No special-casing needed; just send the store value.
**Example:**
```python
# app/quotes/schemas.py — SaveQuoteRequest gains:
class SaveQuoteRequest(BaseModel):
    client_name: str
    client_code: str
    project_id: int | None = None        # NEW — optional; null for standalone/forked quotes
    dashboard_state: dict
    # ... unchanged ...
```
```python
# app/quotes/repository.py — create_quote signature + INSERT gain project_id (nullable):
#   add `project_id: int | None,` param,
#   add `project_id` to the column list and a `$N` placeholder + arg.
```
```typescript
// nextjs-project/src/app/actions/quotes.ts — SaveQuotePayload:
export interface SaveQuotePayload {
  client_name: string
  client_code: string
  project_id?: number | null     // NEW
  // ... unchanged ...
}
// SaveQuoteDialog.tsx — add to the saveQuoteAction({...}) object:
project_id: pricingState.projectId,   // null when forked or no persisted project
```

### Anti-Patterns to Avoid
- **Guarding auto-sign on `status_source <> 'manual'`** — defaults make it always-false; auto-sign would never fire. Guard on `status == 'potential'` instead.
- **Auto-sign as a Postgres trigger** — zero triggers exist in this codebase; the guard is trivial in Python and keeps the app-layer pattern.
- **Two HTTP round-trips (accept quote, then a separate "sign project" call)** — splits the invariant across the wire and lets the UI forget step 2. Couple it server-side in the status handler.
- **Forgetting the transaction wrapper** — without `async with db.transaction():` a crash between the two writes leaves an accepted quote with an un-signed project. Atomicity is the whole point.
- **Auto-demoting on reject/un-accept** — explicitly out of scope (REQUIREMENTS.md "Out of Scope": auto-reverting status). Escalation-only.
- **Making `quotes.project_id` NOT NULL or back-populating old quotes** — nullable by design; existing/standalone/forked quotes stay null.
- **Testing through `async_client` + `_login()`** — `_login` POSTs to the removed `/auth/login` (Azure SSO migration), 404s before assertions. Use `mock_db` repository/handler tests.
- **Overwriting `signed_at` on re-accept** — the `status == 'potential'` guard already prevents re-writing a signed project, preserving the original `signed_at` (matches Phase 6 "first-sign, not overwritten" intent).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic two-table write | Manual BEGIN/COMMIT strings, try/except rollback | `async with db.transaction():` on the `get_db` connection | asyncpg context manager commits on success, rolls back on exception (verified) |
| Updating project status fields | A new `set_signed()` repo method | Existing `ProjectRepository.update_project(id, status=..., status_source=..., signed_at=...)` | Already builds dynamic SET + `updated_at=NOW()`; round-trip proven by `test_project_status_update` |
| Reading the linked project id | A second query for the quote's project | `quote["project_id"]` from the `get_quote` already run for the ownership check | `get_quote` does `SELECT *`, returns project_id for free |
| Generating/parsing the quote INSERT in the mock | Bespoke project_id handling | `_handle_quotes_insert` dynamic column parser (already setdefaults `project_id=None`) | New INSERT column flows through automatically |
| Respecting the fork-vs-linked decision | A flag/branch in the dialog | Send `pricingState.projectId` (loadFromQuote already nulls it) | Single source of truth in the store |

**Key insight:** Every hard part — atomic multi-table writes, dynamic project updates, ownership-checked status handler, nullable FK column, mock column parsing — already exists. The only genuinely new code is ~10 lines of guarded auto-sign inside one handler, plus passing one optional field through four layers. Risk is in *correctness of the guard* and *transaction wrapping*, not in volume.

## Common Pitfalls

### Pitfall 1: The manual-override guard is inverted by the migration default
**What goes wrong:** Implementing the guard as `WHERE status_source <> 'manual'` (as ARCHITECTURE.md and the Phase 6 summary's forward-note suggested) makes auto-sign NEVER fire, because migration 008 defaults `status_source='manual'` for every project. Success criterion 2 silently fails — accepting a quote does nothing.
**Why it happens:** Phase 6 modeled provenance as `status_source` with default `'manual'` to mean "a human created this project," not "a human pinned this status." There is no separate "manually-changed-after-creation" signal in the schema. The earlier-doc guard conflated the two.
**How to avoid:** Guard on `project.status == 'potential'` (see Pattern 2). This is escalation-only, idempotent, and manual-safe all at once with the columns that exist. Write `status_source='automatic'` on the auto-sign so provenance records who made THIS change. Confirm during planning that Phase 9's manual control will (a) set `status_source='manual'` and (b) be allowed to set `signed` directly — both make the `potential`-guard correct.
**Warning signs:** A test "accept a linked quote → project signed" failing with the project still `potential`; any guard referencing `status_source` in the *fire* condition rather than only in the *stamp*.

### Pitfall 2: `get_db` yields a connection, not an open transaction
**What goes wrong:** Assuming the handler is already inside a transaction (it is not) and issuing two writes that commit independently — a crash between them leaves an accepted quote with an unsigned project.
**Why it happens:** `get_db` (`app/db/database.py:55`) does `async with pool.acquire() as connection: yield connection`. asyncpg connections are autocommit by default; each `execute` commits on its own.
**How to avoid:** Wrap both writes in `async with db.transaction():`. Verified against asyncpg docs: a pool-acquired connection supports `transaction()` as an async CM that commits on success / rolls back on exception. Raise `HTTPException` *inside* the block to force rollback if the quote vanished.
**Warning signs:** Partial state after an induced error in tests; no `transaction()` call in the status handler diff.

### Pitfall 3: `MockConnection` has no `transaction()` — handler tests will `AttributeError`
**What goes wrong:** Once the handler uses `async with db.transaction():`, any test exercising it through the mock raises `AttributeError: 'MockConnection' object has no attribute 'transaction'`.
**Why it happens:** `MockConnection` (conftest line 90) only implements `fetchrow`/`fetch`/`execute`. It was never asked to model transactions.
**How to avoid:** Add a no-op async context manager to `MockConnection`:
```python
# tests/conftest.py — inside class MockConnection
from contextlib import asynccontextmanager
def transaction(self):
    conn = self
    @asynccontextmanager
    async def _txn():
        yield conn        # no real atomicity needed; in-memory store is single-threaded
    return _txn()
```
The mock doesn't need real rollback — it just needs to let the `async with` block run. (If you want to assert rollback behavior, that's a real-DB/manual gate, not a mock test.)
**Warning signs:** `AttributeError` on `transaction`; tests passing only because they call the repository directly and never hit the handler's `async with`.

### Pitfall 4: Tests blocked by the removed `/auth/login` helper (38–39 pre-existing failures)
**What goes wrong:** Writing the new auto-sign/linkage tests as `async_client` HTTP tests that call `_login()` first — they 404 at login (Azure SSO removed `/auth/login`, commit 356d0d8) before reaching any assertion, so they appear to "fail" and add to the 38–39-failure baseline noise.
**Why it happens:** `_login()` POSTs to `/auth/login`, which no longer exists; the project migrated to Azure SSO with only `/auth/logout|/auth/azure|/auth/me`.
**How to avoid:** Follow `test_project_status_update` (test_pricing.py:254): instantiate the repository on `mock_db` and assert directly — no login. For the handler-level transaction/guard, either (a) call the handler logic via the repositories on `mock_db`, or (b) use FastAPI dependency overrides for `get_current_user` *and* `get_db` (the Phase 6-01 GREEN verification used exactly this to bypass the broken login). Do NOT depend on `_login`. The login-gate repair is logged in `deferred-items.md` and is out of scope.
**Warning signs:** New tests in the 404-failure cohort; a test importing/calling `_login`.

### Pitfall 5: project_id never reaches the store, so PROJ-03 links nothing in practice
**What goes wrong:** Wiring `project_id` through the payload and INSERT, but `pricingState.projectId` is always `null` because nothing in the UI ever calls `setProjectId` / `createProjectAction` (both verified unused). Every saved quote persists `project_id=null` and auto-sign can never fire — PROJ-04 looks broken even though the backend is correct.
**Why it happens:** The Calculation page is currently a pure client-side session; projects are created on the backend (`POST /pricing/projects` exists) but no UI flow invokes it or stores the returned id. Phase 6 only added the column.
**How to avoid:** Make this an explicit planning decision. Options:
- **(a) Minimal "ensure project on save":** in the save flow, if `projectId` is null, call `createProjectAction` first, `setProjectId(result.id)`, then save the quote with that id. Smallest change that makes PROJ-03/04 demonstrable end-to-end.
- **(b) Defer project-persistence to Phase 9** (manual status control likely introduces real project lifecycle UI) and have Phase 7 prove PROJ-03/04 at the API/repository level (a quote saved *with* a project_id links and auto-signs), accepting that the UI can't yet produce a non-null projectId.
Recommend deciding (a) vs (b) in `/gsd:discuss-phase` or at plan time; the backend work (schema/INSERT/guard/transaction) is identical either way and is independently verifiable.
**Warning signs:** Manual end-to-end test where "accept the quote" never signs a project because the saved quote has `project_id=null`; `grep setProjectId` shows only the store definition.

### Pitfall 6: `status_source` accepts only `'automatic'`/`'manual'` (not `'auto'`)
**What goes wrong:** Writing `status_source='auto'` (PITFALLS.md used `'auto'` in an early sketch) violates the CHECK constraint added by migration 008 (`CHECK (status_source IN ('automatic','manual'))`), raising on the real DB.
**Why it happens:** Two different spellings appear across the research docs; the shipped column uses `'automatic'`.
**How to avoid:** Use exactly `'automatic'`. Verified in the Phase 6 migration 008 and `test_project_status_update`.
**Warning signs:** `new row for relation "pricing_projects" violates check constraint` on a real DB; a test mock that doesn't enforce the CHECK masking it.

## Code Examples

### Auto-sign hook (complete, drop-in shape)
```python
# Source: app/quotes/router.py:238 update_quote_status (existing) — add imports + the block
from datetime import datetime, timezone
from app.pricing.repository import ProjectRepository

@router.patch("/{quote_id}/status")
async def update_quote_status(quote_id, body, current_user=Depends(get_current_user),
                              db=Depends(get_db)):
    repo = QuoteRepository(db)
    quote = await repo.get_quote(quote_id)               # already present
    if not quote:
        raise HTTPException(404, "Quote not found")
    if current_user["id"] != quote["created_by"] and current_user["role"] != "admin":
        raise HTTPException(403, "Only the quote creator or an admin can change status")

    async with db.transaction():                          # NEW: atomic boundary
        updated = await repo.update_status(quote_id, body.status)
        if not updated:
            raise HTTPException(404, "Quote not found")
        if body.status == "accepted" and quote.get("project_id") is not None:
            project_repo = ProjectRepository(db)
            project = await project_repo.get_project(quote["project_id"])
            if project and project["status"] == "potential":     # escalation-only + idempotent + manual-safe
                await project_repo.update_project(
                    quote["project_id"],
                    status="signed",
                    status_source="automatic",
                    signed_at=datetime.now(timezone.utc),
                )

    return {"id": updated["id"], "quote_number": updated["quote_number"],
            "status": updated["status"], "client_name": updated["client_name"]}
```

### Repository-level test (no login; mirrors test_project_status_update)
```python
# Source: pattern from tests/test_pricing.py:254 test_project_status_update
async def test_auto_sign_promotes_potential_project(mock_db):
    from app.pricing.repository import ProjectRepository
    from app.quotes.repository import QuoteRepository
    proj_repo = ProjectRepository(mock_db)
    q_repo = QuoteRepository(mock_db)

    project = await proj_repo.create_project(created_by=1, name="Deal")
    assert project["status"] == "potential"
    # ... create a quote with project_id=project["id"] via create_quote ...
    # ... invoke the auto-sign guard logic (handler or extracted helper) ...
    signed = await proj_repo.get_project(project["id"])
    assert signed["status"] == "signed"
    assert signed["status_source"] == "automatic"
    assert signed["signed_at"] is not None

async def test_auto_sign_idempotent_on_reaccept(mock_db):
    # accept twice -> second is a no-op (project already signed), no error
    ...

async def test_auto_sign_skips_when_no_project(mock_db):
    # quote.project_id is None -> project untouched
    ...
```
> If you extract the guard into a small helper (`maybe_autosign(db, quote, new_status)`) it becomes directly unit-testable on `mock_db` without HTTP and without `_login`. Recommended.

### MockConnection.transaction() shim
```python
# tests/conftest.py — add to class MockConnection (see Pitfall 3)
from contextlib import asynccontextmanager
def transaction(self):
    @asynccontextmanager
    async def _txn():
        yield self
    return _txn()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-sign guard `status_source <> 'manual'` (ARCHITECTURE.md / 06 summary note) | Guard `status == 'potential'` | This phase | Avoids the always-false guard the `'manual'` default would create; still satisfies criteria 2–4 |
| `quotes.project_id` exists but unwired | `project_id` flows schema→INSERT→action→dialog | This phase (PROJ-03) | Quotes attributable to a project |
| Quote acceptance only changes quote status | Acceptance also auto-signs linked project (atomic) | This phase (PROJ-04) | New cross-table invariant |
| `status_source` value `'auto'` (early sketch) | `'automatic'` (matches shipped CHECK) | Phase 6 shipped | Use `'automatic'` or violate the constraint |

**Deprecated/outdated:**
- The `status_overridden` boolean (superseded by `status_source` in Phase 6 — do not introduce).
- The `status_source <> 'manual'` fire-guard (superseded by the `status == 'potential'` guard — see Pitfall 1).

## Open Questions

1. **How does a real (non-null) `projectId` get into the store? (drives PROJ-03 end-to-end demonstrability)**
   - What we know: `setProjectId`/`createProjectAction` exist but are unused; `loadFromQuote` nulls it; `SaveQuoteDialog` omits it.
   - What's unclear: whether Phase 7 adds a minimal "ensure project on save" step or defers UI project-persistence to Phase 9.
   - Recommendation: Decide at plan/discuss time (Pitfall 5, options a/b). Backend work is identical regardless and independently verifiable at the API/repository layer.

2. **Will Phase 9's manual control set `status_source='manual'` and allow direct `signed`?**
   - What we know: the `status == 'potential'` guard depends on a manually-signed project no longer being `potential`.
   - What's unclear: Phase 9 isn't built; confirm its contract.
   - Recommendation: Document the assumption in this phase's plan so Phase 9 honors it. If Phase 9 ever needs to keep a project `potential` but block auto-sign (a deliberate "do not auto-sign" hold), a future explicit flag would be required — out of scope now.

3. **Should the save handler create per-MSN rows on the project, or is `project_id` purely a tag?**
   - What we know: Phase 7 requirements are linkage + auto-sign only; project MSN inputs are a separate concern (`project_msn_inputs`, used by Phase 10 metrics).
   - Recommendation: Scope Phase 7 to the FK tag + auto-sign; do not touch `project_msn_inputs`. Flag for Phase 10.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.4 + pytest-asyncio 0.25.2 (`asyncio_mode = auto`) |
| Config file | `fastapi-project/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd fastapi-project && python -m pytest tests/test_quotes.py -x -q` |
| Full suite command | `cd fastapi-project && python -m pytest -q` |

> Tests run against in-memory `MockConnection` (no Postgres). The `.sql` migrations are NOT run by the suite. The `_login()` API path is broken (Azure SSO) — new tests MUST use `mock_db` repository/handler patterns or dependency overrides, never `_login`. Baseline before this phase: ~38–39 failed / 83 passed (all pre-existing login-gate failures).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-03 | `create_quote(..., project_id=N)` persists `project_id` on the row | unit (repo) | `python -m pytest tests/test_quotes.py -k "project_id" -x` | ⚠️ extend `test_quote_project_id_nullable` (06-02) to also cover non-null |
| PROJ-03 | `SaveQuoteRequest` accepts optional `project_id` (default None) | unit (schema) | `python -m pytest tests/test_quotes.py -k "save_quote_schema or project_id" -x` | ❌ Wave 0 |
| PROJ-04 | Accepting a quote with `project_id` and `status='potential'` → project `signed`/`automatic`/`signed_at` set | unit (repo/handler) | `python -m pytest tests/test_quotes.py -k "auto_sign" -x` | ❌ Wave 0 |
| PROJ-04 | Re-accepting an already-accepted quote is a no-op (idempotent, no error) | unit | `python -m pytest tests/test_quotes.py -k "auto_sign_idempotent" -x` | ❌ Wave 0 |
| PROJ-04 | Quote with `project_id=None` → no project write | unit | `python -m pytest tests/test_quotes.py -k "auto_sign_skips" -x` | ❌ Wave 0 |
| PROJ-04 | Rejecting/un-accepting never demotes (`signed` stays `signed`) | unit | `python -m pytest tests/test_quotes.py -k "auto_sign_no_demote" -x` | ❌ Wave 0 |
| PROJ-04 | Manual-signed project (status already `signed`) is not re-stamped on accept | unit | `python -m pytest tests/test_quotes.py -k "auto_sign_respects_manual" -x` | ❌ Wave 0 |
| PROJ-04 | Atomic rollback: forced error leaves quote status unchanged | manual / real-DB | run against scratch Postgres; mock can't model rollback | ❌ Wave 0 (manual gate) |

### Sampling Rate
- **Per task commit:** `cd fastapi-project && python -m pytest tests/test_quotes.py -x -q`
- **Per wave merge:** `cd fastapi-project && python -m pytest -q` (expect baseline 38–39 pre-existing login failures unchanged + new auto-sign/linkage tests passing; assert zero NEW regressions)
- **Phase gate:** Full suite green except the documented pre-existing login-gate cohort; plus one manual real-DB run proving (a) `status_source='automatic'` passes the CHECK and (b) an induced error inside the transaction rolls back the quote-status write.

### Wave 0 Gaps
- [ ] `tests/conftest.py` — add `MockConnection.transaction()` no-op async context manager (required before any handler test that uses `async with db.transaction():`).
- [ ] `tests/test_quotes.py` — `test_create_quote_with_project_id` (repo): `create_quote(..., project_id=N)` round-trips N (extend/complement the existing nullable test).
- [ ] `tests/test_quotes.py` — `test_auto_sign_promotes_potential_project`, `test_auto_sign_idempotent_on_reaccept`, `test_auto_sign_skips_when_no_project`, `test_auto_sign_no_demote_on_reject`, `test_auto_sign_respects_manual_signed` — all on `mock_db`, no `_login`.
- [ ] (Recommended) Extract `maybe_autosign(db, quote, new_status)` helper so the guard is unit-testable without HTTP.
- [ ] Manual real-DB gate: verify `status_source='automatic'` write succeeds and transaction rollback leaves quote status unchanged.
- [ ] Framework install: none — all deps present.

## Sources

### Primary (HIGH confidence)
- `fastapi-project/app/quotes/router.py` — `save_quote` (no project_id today), `update_quote_status` (ownership check loads quote; no transaction/auto-sign today)
- `fastapi-project/app/quotes/repository.py` — `create_quote` 14-column INSERT (no project_id), `get_quote` `SELECT *`, `update_status`
- `fastapi-project/app/quotes/schemas.py` — `SaveQuoteRequest` (no project_id), `UpdateQuoteStatusRequest` allowed statuses
- `fastapi-project/app/pricing/repository.py` — `ProjectRepository.update_project(**fields)`, `get_project`, `create_project`
- `fastapi-project/app/db/database.py` — `get_db` yields a pool connection (autocommit; not a pre-opened txn); `_DecimalEncoder` JSONB codec
- `fastapi-project/app/main.py:45` — only existing `conn.transaction()` usage (migration runner)
- `fastapi-project/tests/conftest.py` — `MockConnection` (no `transaction()`), `_handle_quotes_insert` (project_id setdefault None), `_handle_projects_update`/`_select`/`_insert`, `mock_db`/`async_client`/`db_store` fixtures
- `fastapi-project/tests/test_pricing.py:254` — `test_project_status_update` (login-free repo test template)
- `nextjs-project/src/components/quotes/SaveQuoteDialog.tsx` — payload build, omits projectId
- `nextjs-project/src/app/actions/quotes.ts` — `SaveQuotePayload` (no project_id), `saveQuoteAction`, `updateQuoteStatusAction`
- `nextjs-project/src/stores/pricing-store.ts` — `projectId` state, `setProjectId` (unused), `loadFromQuote` nulls projectId (line 293)
- `nextjs-project/src/app/actions/pricing.ts` — `createProjectAction` (unused), project endpoints
- grep: `setProjectId`/`createProjectAction` callers — none in UI (confirms Pitfall 5)
- `.planning/phases/06-*/06-01-SUMMARY.md`, `06-02-SUMMARY.md` — shipped columns, `status_source` default `'manual'`, login-gate debt
- `.planning/REQUIREMENTS.md` (PROJ-03/04 + Out-of-Scope auto-revert), `.planning/STATE.md` (escalation-only, manual-sticky decisions)
- [asyncpg API — Connection.transaction() as async context manager; pool.acquire() + transaction; nested savepoints](https://magicstack.github.io/asyncpg/current/api/index.html) (HIGH — verified 2026-06-05)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` / `PITFALLS.md` — v2.0 integration map (note: their `status_overridden` boolean and `status_source <> 'manual'` guard are superseded; see State of the Art)

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack / wiring map: HIGH — every touched file read directly
- Auto-sign guard design: HIGH — derived from the actual migration 008 defaults + success criteria; the `status_source <> 'manual'` trap verified against Phase 6 summary
- Transaction pattern: HIGH — asyncpg `transaction()` on pool connection confirmed by official docs
- Test strategy: HIGH — `mock_db` template + login-gate debt verified in code and summaries
- Frontend projectId gap (Pitfall 5): HIGH — grep confirmed `setProjectId`/`createProjectAction` have no callers

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable internal codebase; 30 days)
