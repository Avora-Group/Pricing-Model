---
phase: 2
slug: aircraft-master-data
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.4 + pytest-asyncio 0.25.2 |
| **Config file** | fastapi-project/pytest.ini (asyncio_mode = auto) |
| **Quick run command** | `pytest fastapi-project/tests/test_aircraft.py -x` |
| **Full suite command** | `pytest fastapi-project/tests/ -x` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest fastapi-project/tests/test_aircraft.py -x`
- **After every plan wave:** Run `pytest fastapi-project/tests/ -x`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | ACFT-01 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_seed_data_present -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | ACFT-02 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_list_aircraft -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | ACFT-02 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_search_aircraft_by_msn -x` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | ACFT-02 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_search_aircraft_by_registration -x` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | ACFT-03 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_get_aircraft_detail -x` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | ACFT-03 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_get_aircraft_not_found -x` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | ACFT-04 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_update_rates_as_admin -x` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | ACFT-04 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_update_rates_forbidden -x` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | ACFT-04 | integration | `pytest fastapi-project/tests/test_aircraft.py::test_update_rates_reflected -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `fastapi-project/tests/test_aircraft.py` — stubs for ACFT-01 through ACFT-04
- [ ] `fastapi-project/tests/conftest.py` — extend MockConnection with aircraft/rates/EPR table handlers and fixture data
- [ ] No new framework install needed — pytest + pytest-asyncio already in requirements.txt

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aircraft list page renders with search | ACFT-02 | Frontend UI rendering | Navigate to /aircraft, verify table renders with all 11 MSNs, type search query |
| Aircraft detail page shows all cost data sections | ACFT-03 | Frontend layout verification | Click aircraft row, verify fixed/variable/EPR/escalation sections render |
| Admin edit saves and reflects immediately | ACFT-04 | Full-stack round-trip | Login as admin, edit a rate value, verify it updates on refresh |
| EUR conversion displays correctly | ACFT-02/03 | Visual verification of dual-currency display | Verify USD and EUR columns show side by side with correct conversion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
