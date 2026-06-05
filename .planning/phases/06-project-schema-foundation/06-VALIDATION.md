---
phase: 6
slug: project-schema-foundation
status: draft
nyquist_compliant: false
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
| (filled by planner) | | | PROJ-01 | unit | pytest | ❌ W0 | ⬜ pending |
| (filled by planner) | | | PROJ-05 | unit | pytest | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Mock DB conftest updated: `_handle_projects_insert` setdefaults for `status`, `status_source`, `signed_at`
- [ ] Test stubs for project status defaults and provenance columns (PROJ-01, PROJ-05)
- [ ] Manual migration idempotency gate: run migrations twice against real Postgres (mock DB cannot cover this)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration idempotency (double-run) | PROJ-01, PROJ-05 | Migrations only run at app startup against real Postgres; mock DB cannot exercise SQL files | Apply 008 + 009 twice against a real database; second run must be a no-op with no errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
