---
phase: 11
review: 11-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "vercel-install.sh fails on a second run and prints the token to the log"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Running the install script outside Vercel truncates credentials and hijacks all GitHub auth"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The postinstall normalizer skips most npm commands, so the lockfile can still get git+ssh"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Copying .env.example as instructed defeats the localhost:8000 fallback it documents"
  - id: IN-01
    severity: info
    disposition: open
    title: "The token ends up in three plaintext places, one of them redundant"
  - id: IN-02
    severity: info
    disposition: open
    title: "The credentials file is world-readable until chmod runs"
  - id: IN-03
    severity: info
    disposition: open
    title: "A failed write can leave a truncated lockfile while the install reports success"
  - id: IN-04
    severity: info
    disposition: open
    title: "The `insteadOf` rewrite covers all of github.com, not just the tracker-client repo"
open: 4
total: 8
recorded: 2026-10-01T07:38:02.177Z
---

# Phase 11: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 11-REVIEW-FIX.md |
| WR-02 | warning | fixed | 11-REVIEW-FIX.md |
| WR-03 | warning | fixed | 11-REVIEW-FIX.md |
| WR-04 | warning | fixed | 11-REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
