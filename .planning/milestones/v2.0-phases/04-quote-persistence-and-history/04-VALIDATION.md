---
phase: 4
slug: quote-persistence-and-history
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 4 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend), vitest or manual (frontend) |
| **Config file** | fastapi-project/pyproject.toml |
| **Quick run command** | `cd /Users/abu/Documents/Claud/fastapi-project && python -m pytest tests/ -x -q --timeout=10` |
| **Full suite command** | `cd /Users/abu/Documents/Claud/fastapi-project && python -m pytest tests/ -v --timeout=30` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd /Users/abu/Documents/Claud/fastapi-project && python -m pytest tests/ -x -q --timeout=10`
- **After every plan wave:** Run `cd /Users/abu/Documents/Claud/fastapi-project && python -m pytest tests/ -v --timeout=30`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 | QUOT-01, QUOT-02 | unit | `python -c "from app.quotes.schemas import SaveQuoteRequest, QuoteListItem"` | N/A (import check) | pending |
| 04-01-T2 | 01 | 1 | QUOT-01, QUOT-02 | unit | `pytest tests/test_quotes.py -x -q` (RED stubs) | Created by Plan 01 | pending |
| 04-02-T1 | 02 | 1 | SENS-01, SENS-02 | compile | `npx tsc --noEmit` (sensitivity components) | N/A (compile check) | pending |
| 04-02-T2 | 02 | 1 | SENS-01, SENS-02 | compile | `npx tsc --noEmit` (sensitivity page + action) | N/A (compile check) | pending |
| 04-03-T1 | 03 | 2 | QUOT-03, QUOT-04, QUOT-05 | unit | `python -c "from app.quotes.router import router"` + route count check | N/A (import check) | pending |
| 04-03-T2 | 03 | 2 | QUOT-03, QUOT-04, QUOT-05 | integration | `pytest tests/test_quotes.py -x -q` (GREEN) | Created by Plan 01, updated by Plan 03 | pending |
| 04-04-T1 | 04 | 3 | QUOT-01, QUOT-03 | compile | `npx tsc --noEmit` (actions + store extensions) | N/A (compile check) | pending |
| 04-04-T2 | 04 | 3 | QUOT-01, QUOT-03 | compile | `npx tsc --noEmit` (SaveQuoteDialog, QuoteList, page) | N/A (compile check) | pending |
| 04-04-T3 | 04 | 3 | QUOT-04 | compile | `npx tsc --noEmit` (quote detail page) | N/A (compile check) | pending |
| 04-04-CP | 04 | 3 | QUOT-01,03,04,05 + SENS-01,02 | manual | Human verify checkpoint (11 steps) | N/A | pending |

**Note on QUOT-06 (PDF export):** Deferred to post-phase. BLOCKED pending Excel summary file and company branding assets from user. Not covered by any plan in this phase. See 04-CONTEXT.md deferred section for unblock conditions.

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `tests/test_quotes.py` -- created by Plan 01 Task 2 as RED stubs, turned GREEN by Plan 03 Task 2. Covers QUOT-01 through QUOT-05 (save, list with search/status/MSN filter, detail, status update, immutability, permissions).

No additional Wave 0 test files needed. Frontend plans use `npx tsc --noEmit` as automated verification. Sensitivity analysis (Plan 02) is frontend-only with compile checks; full behavioral verification happens in the Plan 04 human checkpoint.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quote detail view renders all tabs | QUOT-04 | Visual layout verification | Open saved quote, verify Dashboard/P&L/Crew/Aircraft/Costs tabs populated |
| Quote list filtering and sorting | QUOT-03 | UI interaction patterns | Filter by client, sort by date, verify results |
| Sensitivity chart renders correctly | SENS-02 | Visual chart verification | Select param, click Run Analysis, verify 5-row table + Recharts line chart with 5 data points |
| Fork behavior on quote load | QUOT-02 | Multi-step user flow | Load quote, modify input, save as new, verify original unchanged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
