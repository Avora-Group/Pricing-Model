---
phase: 11-install-tracker-client-v10
plan: 02
subsystem: infra
tags: [npm, tracker-client, vercel, lockfile, env-manifest, gitignore]

# Dependency graph
requires:
  - phase: 11-install-tracker-client-v10 (plan 01)
    provides: "Clean tree, green D-13 baseline, proven LOCK check, human-approved package source (v10 -> a369f81)"
provides:
  - "@avora/tracker-client 10.0.0 installed from git+https://github.com/Avora-Group/tracker-client.git#v10, lockfile pinned to a369f81 over git+https"
  - "postinstall lock normalizer (HR's file verbatim) keeping the lockfile free of git+ssh"
  - "vercel-install.sh (HR's variant verbatim) and vercel.json installCommand pointing at it"
  - "Tracked, name-only nextjs-project/.env.example with eleven names in four groups"
  - "One local phase commit f20debf holding exactly the seven files"
affects: [phase-12, phase-13, phase-14-push, SHIP-03]

# Actuals (#2632)
actuals:
  tokens: 2781    # chars/4 over the realized diff of f20debf (11125 chars)
  tasks: 3
  commits: 1      # MEASURED: git rev-list --count 91005b5..HEAD at SUMMARY write
plan_head_before: 91005b5088b3f10633022da1727b3de9aff6cdbf
plan_head_after: f20debfd71cb786837d2cc695b5bb6421b620e3a

# Tech tracking
tech-stack:
  added: ["@avora/tracker-client 10.0.0 (private git dependency, commit a369f81)"]
  patterns:
    - "Private GitHub dependency named over git+https; postinstall rewrites npm's SSH-form lock entry back to git+https"
    - "Vercel installCommand delegates to a script that builds token credentials and three insteadOf rewrites from TRACKER_REPO_TOKEN"
    - "Name-only .env.example tracked via a single !.env.example negation under .env*"

key-files:
  created:
    - nextjs-project/scripts/normalize-tracker-lock.mjs
    - nextjs-project/vercel-install.sh
    - nextjs-project/.env.example
  modified:
    - nextjs-project/package.json
    - nextjs-project/package-lock.json
    - nextjs-project/vercel.json
    - nextjs-project/.gitignore

key-decisions:
  - "tracker-client v10 installed and locked to a369f81 over git+https; the lockfile diff is additions only (9 0, hasInstallScript added), no D-14 retry needed"
  - "HR's normalize-tracker-lock.mjs and vercel-install.sh copied byte for byte (blobs 1e657b8, fbb9185); header text about CI kept per D-07/D-02"
  - "Phase work shipped as one sentence-style local commit f20debf on main; nothing pushed (origin/main still 7c9993d)"

patterns-established:
  - "LOCK check (UNRELATED-ENTRIES-UNCHANGED + LOCK-OK) as the gate for any later lockfile change in ACMI"
  - "Install-script harness: HOME and GIT_CONFIG_GLOBAL in a mktemp dir, real global config compared before/after"

requirements-completed: [DEP-01, DEP-02, DEP-03]

coverage:
  - id: D1
    description: "@avora/tracker-client 10.0.0 installs from the pinned commit; lockfile resolves git+https #a369f81, zero git+ssh, no unrelated entry changed; npm ci && npm run build exit 0 on the committed tree"
    requirement: "DEP-01"
    verification:
      - kind: other
        ref: "Task 1 verify (TRACER-OK): hashes, LOCK check, installed version and dialog/token/server dirs, npm run build"
        status: pass
      - kind: other
        ref: "Task 3 final gate (FINAL-GATE-OK): npm ci && npm run build && git diff --exit-code on the seven files"
        status: pass
      - kind: other
        ref: "Task 3 LOCK check with LOCK_BASE=f20debf~1 (LOCK-COMMITTED-OK)"
        status: pass
    human_judgment: false
  - id: D2
    description: "vercel.json installCommand is bash vercel-install.sh; the script is HR's blob, i/lf mode 100644, fails with exit 1 when the token is unset or empty, writes credentials and exactly three insteadOf values with a token, never prints it, and leaves the real global git config unchanged"
    requirement: "DEP-02"
    verification:
      - kind: other
        ref: "Task 2 install-script harness (HARNESS-OK)"
        status: pass
      - kind: other
        ref: "Task 2 CONFIG verify (CONFIG-OK) and Task 3 COMMIT-OK (i/lf, 100644 fbb9185)"
        status: pass
    human_judgment: false
  - id: D3
    description: "nextjs-project/.env.example is tracked through !.env.example and lists eleven blank names in four groups, in D-11 order, with the three Value comments"
    requirement: "DEP-03"
    verification:
      - kind: other
        ref: "Task 2 ENV gate (ENV-OK) inside CONFIG-OK; git ls-files nextjs-project/.env.example lists it; i/lf in the index"
        status: pass
    human_judgment: false
  - id: D4
    description: "The real Vercel install with TRACKER_REPO_TOKEN set (first exercised by the Phase 14 deploy)"
    requirement: "DEP-02"
    verification: []
    human_judgment: true
    rationale: "Only a real Vercel build with the PAT configured proves the private fetch works there; it cannot run before Phase 14 sets the variable and pushes"

# Metrics
duration: 5min
completed: 2026-10-01
status: complete
---

# Phase 11 Plan 02: Install tracker-client v10 for the Vercel build Summary

**@avora/tracker-client 10.0.0 installed from `git+https://...tracker-client.git#v10` and locked to a369f81 over git+https, with HR's postinstall lock normalizer and token-based `vercel-install.sh` wired into `vercel.json`, a tracked eleven-name `.env.example`, all in one local commit `f20debf`**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-01T07:07:49Z
- **Completed:** 2026-10-01T07:12:54Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `package.json` gained exactly two edits by hand (numstat `3 1`, blob `6fefee4`): `@avora/tracker-client` as the first dependency and the `postinstall` script. `npm install` added one package in 12 s, and the normalizer rewrote the lock entry to git+https straight after.
- `package-lock.json` diff is additions only, numstat `9 0`, including the root `"hasInstallScript": true`. The LOCK check printed `UNRELATED-ENTRIES-UNCHANGED` / `LOCK-OK` after the install, after the final `npm ci`, and against the committed state with `LOCK_BASE=f20debf~1`.
- `scripts/normalize-tracker-lock.mjs` and `vercel-install.sh` are HR's files byte for byte (blobs `1e657b8…` and `fbb9185…`), both `i/lf`, mode `100644`.
- `vercel.json` changed only `installCommand` to `bash vercel-install.sh` (numstat `1 1`, blob `36698d6`).
- `.gitignore` gained the comment and `!.env.example` on lines 35-36 (numstat `2 0`); `.env*` still ignores every other env file.
- `.env.example` (75 lines, UTF-8 without a BOM, `i/lf`) passed the ENV gate: eleven blank names in D-11 order, three `# Value:` lines, four 79-code-point headings.

## Recorded facts (plan `<output>`)

| Item | Value |
|------|-------|
| Phase commit | `f20debfd71cb786837d2cc695b5bb6421b620e3a`, subject `Tracker embed: install tracker-client v10 for the Vercel build`, author `avoradevops <devops@avora.aero>`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, 7 files |
| HEAD at start | `91005b5088b3f10633022da1727b3de9aff6cdbf` (branch `main`) |
| origin/main at start | `7c9993dcd777f89d1fc0e8c884731f2ecf27fe04` |
| HEAD at end (code) | `f20debfd71cb786837d2cc695b5bb6421b620e3a`, followed only by this plan's `docs(11-02)` planning commit |
| origin/main at end | `7c9993dcd777f89d1fc0e8c884731f2ecf27fe04` (unchanged; `f20debf` is not an ancestor; nothing pushed) |
| Lockfile numstat | `9 0`; `hasInstallScript` was added |
| D-14 retry | Not needed |
| Install (`npm install`, Task 1) | exit 0, 13 s, added 1 package |
| Final gate | `FINAL-GATE-OK`: `npm ci` exit 0 in 22 s (added 500 packages), `npm run build` exit 0 in 21 s (Next.js 16.1.6, 16/16 static pages), working tree equal to the index for all seven files |
| Harness output | `HARNESS-OK` |
| Dev server | Not stopped. The probe printed nothing, so no process was killed. |

## Task Commits

The plan's `<commit_policy>` (D-15 to D-17) replaces GSD's per-task commits with one phase commit:

1. **Task 1: tracker-client v10 installs from the pinned commit and the app still builds (tracer)** - no commit (TRACER-OK)
2. **Task 2: Vercel install path and env manifest** - no commit (CONFIG-OK, HARNESS-OK)
3. **Task 3: Stage the seven files, prove they install and build, make the one commit** - `f20debf` (ACMI sentence-style subject)

**Plan metadata:** the `docs(11-02)` planning commit that adds this SUMMARY and the STATE.md, ROADMAP.md and REQUIREMENTS.md updates

## Files Created/Modified

- `nextjs-project/package.json` - tracker-client dependency (first entry) and `postinstall`
- `nextjs-project/package-lock.json` - tracker-client entry pinned to `a369f81` over git+https, root dependency, `hasInstallScript`
- `nextjs-project/scripts/normalize-tracker-lock.mjs` - postinstall rewrite of the SSH-form lock URL to git+https (HR verbatim)
- `nextjs-project/vercel-install.sh` - Vercel install step: credentials and three `insteadOf` rewrites from `TRACKER_REPO_TOKEN`, then `npm install` (HR verbatim)
- `nextjs-project/vercel.json` - `installCommand` is now `bash vercel-install.sh`
- `nextjs-project/.env.example` - name-only manifest, eleven names in four groups
- `nextjs-project/.gitignore` - `!.env.example` negation under `.env*`

## Decisions Made

- Followed the plan as written. All file contents were fixed by the plan or by HR's blobs; no discretionary change was made.

## Prohibitions (must_haves.prohibitions) - awaiting human review

1. **Never run `vercel-install.sh` against the real HOME or real global git config.** Awaiting human review. Evidence: the script was run only inside the harness with `HOME` and `GIT_CONFIG_GLOBAL` in a `mktemp -d` directory, and the harness confirmed the real `git config --global --list` was identical before and after.
2. **Never make any env file other than `.env.example` trackable.** Awaiting human review. Evidence: the only ignore change is the exact rule `!.env.example`; the untracked-file check in CONFIG-OK found nothing beyond the three new files; `git check-ignore -v` on a sample `.env.local.*`-style name still resolves to `.gitignore:34:.env*`; `.env.local` was never read or named on a command line.
3. **Never push any commit of this phase.** Awaiting human review. Evidence: no `git push` was run; `origin/main` is still `7c9993d` and `git merge-base --is-ancestor f20debf origin/main` exits 1.

## Deviations from Plan

**1. [Orchestrator decision] Status allowlist widened with `milestone\.lock`**
- **Found during:** Task 1, Step 1 (pre-flight), and every later use of the filter (Task 1/2 status checks, Task 3 COMMIT-OK verify)
- **Issue:** `.planning/milestone.lock` is GSD's untracked session lock; the plan's regex did not list it.
- **Fix:** Used `'^.. \.planning/(STATE\.md|ROADMAP\.md|REQUIREMENTS\.md|milestone\.lock|phases/11-install-tracker-client-v10/)'` everywhere the filter appears. The lock was never staged and not added to any `.gitignore`.
- **Files modified:** none

**2. [Orchestrator decision] No worktree isolation; commit on local `main`**
- **Found during:** dispatch
- **Issue:** The harness worktree would isolate the session's task-tracker repo, and GSD's executor refuses commits on `main` by default, while this plan's `commit_policy` puts the phase commit on local `main`.
- **Fix:** Ran sequentially on the main tree of `C:/Projects/acmi-app`; the root pin guard passed before the first write and before the commit. Nothing was pushed.

**3. [Commit policy] One phase commit instead of per-task commits**
- **Found during:** Tasks 1-3
- **Issue:** GSD's default is one `{type}(11-02)` commit per task; D-15/D-16 require a single sentence-style commit.
- **Fix:** Tasks 1 and 2 made no commit; Task 3 committed the seven files as `f20debf`.

---

**Total deviations:** 3, all procedural and directed by the orchestrator or the plan's own commit policy. None touches code.
**Impact on plan:** None on scope. Every plan check passed as written.

## Issues Encountered

None that blocked the plan. Already present before this plan and out of scope (same as the 11-01 baseline):
- `npm ci` reports 14 audit vulnerabilities (1 low, 4 moderate, 8 high, 1 critical) and several deprecated transitive packages.
- Next.js 16 warns that the `middleware` file convention is deprecated.

## User Setup Required

None for this plan. `TRACKER_REPO_TOKEN` must be set on the Vercel project `pricing-model` (Production and Preview) before any push; that is Phase 14 (SHIP-03).

## Next Phase Readiness

- Phase 11 plans are complete: DEP-01, DEP-02 and DEP-03 are met locally. Phase 12 can import `@avora/tracker-client/server` and `/token`.
- The real Vercel install is first exercised by the Phase 14 deploy; until `TRACKER_REPO_TOKEN` is on Vercel, any push to `main` fails the build by design.
- `main` is ahead of `origin/main` by the milestone's commits, including `f20debf`. Nothing is pushed until Phase 14.

## Self-Check: PASSED

- FOUND: `nextjs-project/scripts/normalize-tracker-lock.mjs`, `nextjs-project/vercel-install.sh`, `nextjs-project/.env.example`
- FOUND: commit `f20debf` (the only commit in `91005b5..f20debf`)
- Re-run after the commit: COMMIT-OK, LOCK-COMMITTED-OK, `origin/main` still `7c9993d`, status clean apart from `?? .planning/milestone.lock`

---
*Phase: 11-install-tracker-client-v10*
*Completed: 2026-10-01*
