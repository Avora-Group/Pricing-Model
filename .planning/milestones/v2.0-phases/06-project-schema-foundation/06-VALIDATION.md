---
phase: 6
slug: project-schema-foundation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (existing, with in-memory MockConnection conftest) |
| **Config file** | fastapi-project/pytest.ini / conftest.py (existing) |
| **Quick run command** | `cd fastapi-project && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd fastapi-project && python -m pytest tests/ -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd fastapi-project && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd fastapi-project && python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| T1 migration 008 | 06-01 | 1 | PROJ-01, PROJ-05 | structural (grep) | `grep` asserts on migrations/008_add_project_status.sql | ✅ created in task | ⬜ pending |
| T2 Wave 0 tests + mock defaults | 06-01 | 1 | PROJ-01, PROJ-05 | integration | `python -m pytest tests/test_pricing.py -k "create_project or project_detail or list_projects or project_status_update" -q` | ❌ W0 (created here) | ⬜ pending |
| T3 ProjectResponse + constructors | 06-01 | 1 | PROJ-01, PROJ-05 | integration | `python -m pytest tests/test_pricing.py -k "create_project or project_detail or list_projects or project_status_update" -q` | ✅ (T2) | ⬜ pending |
| T1 migration 009 | 06-02 | 2 | PROJ-03 (foundation) | structural (grep) | `grep` asserts on migrations/009_link_quotes_to_projects.sql | ✅ created in task | ⬜ pending |
| T2 quotes null project_id | 06-02 | 2 | PROJ-03 (foundation) | integration | `python -m pytest tests/test_quotes.py -q` | ❌ W0 (created here) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Note: PROJ-03 is owned by Phase 7 in the roadmap traceability table; Phase 6 only lands the
> `quotes.project_id` column (foundation). The 06-02 tests prove the null-linkage foundation, not
> the save-flow wiring.

---

## Wave 0 Requirements

- [ ] Mock DB conftest updated: `_handle_projects_insert` setdefaults for `status`, `status_source`, `signed_at` (06-01 T2)
- [ ] Mock DB conftest updated: `_handle_quotes_insert` setdefault for `project_id` (06-02 T2)
- [ ] Test stubs for project status defaults and provenance columns — PROJ-01, PROJ-05 (06-01 T2)
- [ ] Test stub for nullable quote project_id — PROJ-03 foundation (06-02 T2)
- [ ] Manual migration idempotency gate: run 008 + 009 twice against real Postgres (mock DB cannot cover this)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 008 idempotency (double-run) | PROJ-01, PROJ-05 | Migrations only run at app startup against real Postgres; mock DB cannot exercise SQL files | Apply 008 twice against a real database; second run must be a no-op with no errors |
| Migration 009 idempotency (double-run) | PROJ-03 (foundation) | Same — SQL file not executed by the mock-DB test suite | Apply 009 twice against a real database; second run must be a no-op with no errors |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (per-task map filled by planner)
