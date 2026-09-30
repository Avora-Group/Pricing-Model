---
phase: 1
slug: foundation-and-authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + httpx (async test client for FastAPI) |
| **Config file** | `fastapi-project/pytest.ini` — Wave 0 installs |
| **Quick run command** | `pytest fastapi-project/tests/ -x -q` |
| **Full suite command** | `pytest fastapi-project/tests/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest fastapi-project/tests/ -x -q`
- **After every plan wave:** Run `pytest fastapi-project/tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | integration | `pytest fastapi-project/tests/test_auth.py::test_login_success -x` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-01 | integration | `pytest fastapi-project/tests/test_auth.py::test_login_unknown_email -x` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | AUTH-01 | integration | `pytest fastapi-project/tests/test_auth.py::test_login_wrong_password -x` | ❌ W0 | ⬜ pending |
| 01-02-01 | 01 | 1 | AUTH-02 | integration | `pytest fastapi-project/tests/test_auth.py::test_get_me_with_valid_cookie -x` | ❌ W0 | ⬜ pending |
| 01-02-02 | 01 | 1 | AUTH-02 | integration | `pytest fastapi-project/tests/test_auth.py::test_get_me_no_cookie -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01 | 1 | AUTH-03 | integration | `pytest fastapi-project/tests/test_auth.py::test_logout_clears_cookie -x` | ❌ W0 | ⬜ pending |
| 01-04-01 | 01 | 1 | AUTH-04 | integration | `pytest fastapi-project/tests/test_users.py::test_create_user_as_admin -x` | ❌ W0 | ⬜ pending |
| 01-04-02 | 01 | 1 | AUTH-04 | integration | `pytest fastapi-project/tests/test_users.py::test_create_user_forbidden -x` | ❌ W0 | ⬜ pending |
| 01-05-01 | 02 | 1 | UI-01 | manual | Visual check in browser | N/A | ⬜ pending |
| 01-05-02 | 02 | 1 | UI-05 | manual | Visual check in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `fastapi-project/pytest.ini` — pytest configuration
- [ ] `fastapi-project/tests/__init__.py` — test package
- [ ] `fastapi-project/tests/conftest.py` — async test client fixture, test DB setup
- [ ] `fastapi-project/tests/test_auth.py` — covers AUTH-01, AUTH-02, AUTH-03
- [ ] `fastapi-project/tests/test_users.py` — covers AUTH-04
- [ ] Framework install: `pip install pytest pytest-asyncio httpx` added to requirements.txt

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar renders all 5 nav items | UI-01 | Visual layout verification | Open app, verify sidebar shows Dashboard, Pricing, Quotes, Aircraft, Admin |
| Login page matches AeroVista dark card style | UI-05 | Visual style verification | Compare login page with AeroVista reference screenshot |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
