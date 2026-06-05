# Deferred Items — Phase 06

## Pre-existing test-suite breakage: `/auth/login` removed (Azure SSO migration)

**Discovered during:** Plan 06-01, Task 2 (TDD RED run).

**Issue:** Every API-level test in `tests/test_pricing.py` (and likely other suites)
uses a `_login()` helper that POSTs to `/auth/login` with username/password. That
endpoint no longer exists — `app/auth/router.py` exposes only `/auth/logout`,
`/auth/azure`, and `/auth/me` after the Azure SSO migration (commit 356d0d8).
All login-based tests fail with `404 Not Found` on login, before reaching any
assertions. This is unrelated to Phase 6 changes.

**Evidence:** `test_get_pricing_config`, `test_add_msn_input`, `test_create_project`,
`test_list_projects`, `test_get_project_detail` all fail at
`_login(...) -> assert resp.status_code == 200` with `404`.

**Scope decision:** Out of scope for plan 06-01 (does not stem from this plan's
changes). NOT fixed here. The new repository-level test `test_project_status_update`
(which bypasses `_login`) passes and proves PROJ-05 round-trip.

**Recommendation:** A dedicated maintenance task should update the test auth helper
to mint a session via the Azure flow (or a test-only auth override) so the API-level
project tests can run again. Until then, the status/provenance assertions added in
06-01 to `test_create_project`/`test_list_projects`/`test_get_project_detail` are
present and correct but cannot execute past the login gate.

**Plan 06-02 addendum:** The new test `tests/test_quotes.py::test_quote_project_id_nullable`
(PROJ-03 foundation — proves a null-`project_id` quote is valid) mirrors the existing
`test_create_quote` and is blocked by the same `/auth/login` 404. Full-suite count went
from baseline 38 failed / 83 passed to 39 failed / 83 passed — the single delta is this
new test, failing only at the login gate, never reaching its `project_id` assertion. No
previously-passing test regressed. This test will pass once the auth helper is restored.
