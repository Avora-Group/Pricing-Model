---
phase: 3
slug: pricing-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.4 + pytest-asyncio 0.25.2 |
| **Config file** | None (uses defaults) |
| **Quick run command** | `python3 -m pytest fastapi-project/tests/test_pricing_service.py -x` |
| **Full suite command** | `python3 -m pytest fastapi-project/tests/ -x` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python3 -m pytest fastapi-project/tests/test_pricing_service.py -x`
- **After every plan wave:** Run `python3 -m pytest fastapi-project/tests/ -x`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PRIC-02 | unit | `python3 -m pytest fastapi-project/tests/test_pricing_service.py::TestComponentCalculations -x` | Wave 0 | pending |
| 03-01-02 | 01 | 1 | PRIC-06 | unit | `python3 -m pytest fastapi-project/tests/test_pricing_service.py::TestDecimalPrecision -x` | Wave 0 | pending |
| 03-01-03 | 01 | 1 | PRIC-05 | unit | `python3 -m pytest fastapi-project/tests/test_pricing_fixtures.py -x` | Wave 0 | pending |
| 03-01-04 | 01 | 1 | CONF-01 | integration | `python3 -m pytest fastapi-project/tests/test_pricing.py::test_update_config_admin -x` | Wave 0 | pending |
| 03-01-05 | 01 | 1 | CONF-02 | integration | `python3 -m pytest fastapi-project/tests/test_pricing.py::test_config_versioning -x` | Wave 0 | pending |
| 03-01-06 | 01 | 1 | CONF-03 | integration | `python3 -m pytest fastapi-project/tests/test_pricing.py::test_config_immutability -x` | Wave 0 | pending |
| 03-02-01 | 02 | 2 | PRIC-01 | integration | `python3 -m pytest fastapi-project/tests/test_pricing.py::test_calculate_with_valid_inputs -x` | Wave 0 | pending |
| 03-02-02 | 02 | 2 | PRIC-03 | unit | `python3 -m pytest fastapi-project/tests/test_pricing_service.py::test_margin_calculation -x` | Wave 0 | pending |
| 03-03-01 | 03 | 3 | PRIC-04 | manual-only | Manual: change input in browser, verify P&L updates within 1s | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `fastapi-project/tests/test_pricing_service.py` — stubs for PRIC-02, PRIC-03, PRIC-05, PRIC-06
- [ ] `fastapi-project/tests/test_pricing_fixtures.py` — stubs for PRIC-05 with Excel-verified data
- [ ] `fastapi-project/tests/test_pricing.py` — stubs for PRIC-01, CONF-01, CONF-02, CONF-03
- [ ] Mock DB handlers for pricing_config, crew_config, pricing_projects, project_msn_inputs in conftest.py

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time P&L update on input change | PRIC-04 | UX behavior — requires browser interaction | 1. Open P&L page 2. Change MGH input 3. Verify P&L recalculates within 1s without page reload |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
