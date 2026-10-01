---
phase: 12
review: 12-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "A copied tracker_rt can be renewed indefinitely, because the sliding JWE exp is \"capped\" only by a forgeable access_token"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The rotation re-seal skips the TRACKER_RT_MAX_LENGTH guard, so an oversized rotated cookie is silently dropped by the browser"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The OAuth flow has no state nonce and no PKCE, so login CSRF now also plants the attacker's refresh token in tracker_rt"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "Whether parseTrackerRtKey accepts standard base64 depends on the runtime"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "The shared cookie option objects are mutable exports"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "No behavioural test covers the 200 and rotation path, and the HTTP smoke is outside the test glob"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "Two helper tests test NextResponse, not the callback"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "Pre-existing callback logs write id_token claims and Entra's raw error body"
open: 0
total: 8
recorded: 2026-10-01T13:42:14.045Z
---

# Phase 12: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 12-REVIEW-FIX.md |
| WR-02 | warning | fixed | 12-REVIEW-FIX.md |
| WR-03 | warning | fixed | 12-REVIEW-FIX.md |
| IN-01 | info | fixed | 12-REVIEW-FIX.md |
| IN-02 | info | fixed | 12-REVIEW-FIX.md |
| IN-03 | info | fixed | 12-REVIEW-FIX.md |
| IN-04 | info | fixed | 12-REVIEW-FIX.md |
| IN-05 | info | fixed | 12-REVIEW-FIX.md |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
