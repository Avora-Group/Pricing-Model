---
phase: 11-install-tracker-client-v10
plan: 01
subsystem: infra
tags: [git, gitignore, npm, baseline, tracker-client, package-legitimacy]

# Dependency graph
requires: []
provides:
  - "Root .gitignore rule for the GSD SDK's .planning/state.json, in its own local commit (39e3b6e)"
  - "Recorded D-13 baseline: npm ci and npm run build pass on the untouched nextjs-project/ tree"
  - "LOCK check proven on the untouched lockfile (UNRELATED-ENTRIES-UNCHANGED, LOCK-DRIFT)"
  - "Human-confirmed package source: Avora-Group/tracker-client tag v10 peels to a369f81"
affects: [11-02, phase-11, phase-14-push]

# Actuals (#2632)
actuals:
  tokens: 75      # chars/4 over the realized code diff (.gitignore, 298 chars of diff)
  tasks: 2
  commits: 1      # MEASURED: git rev-list --count 495bf59..HEAD at SUMMARY write
plan_head_before: 495bf59fe368cb240d3100709b8e811384780f5a
plan_head_after: 39e3b6eabd87ab271b0eca828ba1b0c5dbfb2701

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repo-level chore commits use ACMI's sentence-style subject and the repo identity; GSD planning commits keep docs(NN-PP) form"

key-files:
  created: []
  modified:
    - .gitignore

key-decisions:
  - "Ignore .planning/state.json rather than commit it: it is SDK machine state, STATE.md is the tracked record (D-12)"
  - "Package source for plan 11-02 confirmed by the user ('approved'): @avora/tracker-client from Avora-Group/tracker-client tag v10 at a369f81 (D-01)"
  - "Status allowlist also tolerates .planning/milestone.lock, a GSD session lock; it is not added to .gitignore"
  - "Plan ran sequentially on the main working tree, no worktree isolation"

patterns-established:
  - "Status allowlist filter: clean means nothing outside GSD's own planning files for the phase"
  - "Tag probe over SSH (git ls-remote git@github.com:...) as the source evidence for the private package"

requirements-completed: []  # DEP-01 advanced, not completed: plan 11-02 installs the package
requirements-advanced: [DEP-01]

coverage:
  - id: D1
    description: ".planning/state.json is ignored by the root .gitignore, in one separate three-line local commit with the repo identity and a Co-Authored-By trailer"
    verification:
      - kind: other
        ref: "Task 1 GATES-OK verify command (check-ignore, numstat 3 0, author, subject, trailer, not ancestor of origin/main, status allowlist)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Untouched nextjs-project/ tree installs and builds (D-13 baseline)"
    verification:
      - kind: other
        ref: "cd nextjs-project && npm ci && npm run build (both exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Package source confirmed by a human before plan 11-02 installs it (D-01)"
    requirement: "DEP-01"
    verification:
      - kind: manual_procedural
        ref: "git ls-remote git@github.com:Avora-Group/tracker-client.git refs/tags/v10 refs/tags/v10^{} -> a369f81; user reply 'approved' on 2026-10-01"
        status: pass
    human_judgment: true
    rationale: "Package-legitimacy gate (blocking-human): only a human can confirm this is the intended private repository and tag"

# Metrics
duration: 17min
completed: 2026-10-01
status: complete
---

# Phase 11 Plan 01: Clean tree, baseline and package-source gate Summary

**`.planning/state.json` ignored in a single local chore commit (39e3b6e), the untouched frontend proven to `npm ci` and build, and the user approved `@avora/tracker-client` at tag v10 / a369f81 as the package plan 11-02 installs**

## Performance

- **Duration:** 17 min wall clock, including the wait at the blocking-human checkpoint
- **Started:** 2026-10-01T06:47:21Z (phase begin recorded in STATE.md)
- **Completed:** 2026-10-01T07:04:09Z
- **Tasks:** 2 of 2
- **Files modified:** 1 (`.gitignore`)

## Accomplishments

- The root `.gitignore` gained three lines (empty line, `# GSD SDK machine state (STATE.md is the tracked record)`, `.planning/state.json`) in commit `39e3b6e`, which changes nothing else. `git check-ignore -v .planning/state.json` resolves to `.gitignore:24`.
- Baseline (D-13) in `nextjs-project/` on a tree with no phase change: `npm ci` exit 0 in 25 s (added 499 packages), `npm run build` exit 0 in 24 s (Next.js 16.1.6 Turbopack, 16/16 static pages). `git status` was identical before and after, and `git diff --stat HEAD -- nextjs-project` is empty.
- The LOCK check printed `UNRELATED-ENTRIES-UNCHANGED` then `LOCK-DRIFT` on the untouched lockfile, as documented. Plan 11-02 can rely on it.
- The tag probe showed v10 at the pinned commit, and the user approved the package source.

## Recorded facts (plan `<output>`)

| Item | Value |
|------|-------|
| Chore commit | `39e3b6eabd87ab271b0eca828ba1b0c5dbfb2701`, subject `Ignore the GSD SDK's .planning/state.json`, author `avoradevops <devops@avora.aero>`, numstat `3 0` on `.gitignore` only, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` |
| HEAD at start | `495bf59fe368cb240d3100709b8e811384780f5a` (branch `main`) |
| origin/main at start | `7c9993dcd777f89d1fc0e8c884731f2ecf27fe04` |
| HEAD at end (code) | `39e3b6eabd87ab271b0eca828ba1b0c5dbfb2701`, followed only by this plan's `docs(11-01)` planning commit |
| origin/main at end | `7c9993dcd777f89d1fc0e8c884731f2ecf27fe04` (unchanged; `39e3b6e` is not an ancestor; nothing pushed) |
| `npm ci` | exit 0, 25 s |
| `npm run build` | exit 0, 24 s |
| Dev server | Not stopped. The probe printed nothing, so no process was killed. |
| Tag probe line 1 | `ddfd16609b2ed056bc07cbc8d6d57b6d8a1b5fd7	refs/tags/v10` |
| Tag probe line 2 | `a369f81a51c88d6b82fec3c05537a13da862f769	refs/tags/v10^{}` |
| Checkpoint reply | "approved" (the user, in the main session, 2026-10-01, after seeing the evidence above) |

The orchestrator re-ran the tag probe on its own and got the same two lines.

## Task Commits

1. **Task 1: Commit the state.json ignore rule, then prove the untouched tree builds (D-12, D-13)** - `39e3b6e` (chore, ACMI sentence-style subject per commit_policy)
2. **Task 2: Confirm the package source before plan 11-02 installs it (D-01)** - no commit (checkpoint:human-verify, gate blocking-human; user replied "approved")

**Plan metadata:** the `docs(11-01)` planning commit that adds this SUMMARY and the STATE.md and ROADMAP.md updates

## Files Created/Modified

- `.gitignore` - ignore rule for the GSD SDK's `.planning/state.json`

Nothing under `nextjs-project/` changed.

## Decisions Made

- Ignore `.planning/state.json` instead of committing it (D-12). This settles the STATE.md blocker "Untracked `.planning/state.json`".
- The user approved the package source: `@avora/tracker-client` from `git+https://github.com/Avora-Group/tracker-client.git#v10`, which resolves to `a369f81a51c88d6b82fec3c05537a13da862f769` (D-01).

## Deviations from Plan

**1. [Orchestrator decision] Status allowlist widened with `milestone\.lock`**
- **Found during:** Task 1, Step 1 (pre-flight)
- **Issue:** `.planning/milestone.lock` is a GSD session lock that the orchestrator's `state.begin-phase` creates. The plan's filter regex did not list it, so a clean tree would have counted as dirty.
- **Fix:** Added `milestone\.lock` to the allowlist regex for this run only. It was not added to `.gitignore` and is never staged.
- **Files modified:** none

**2. [Orchestrator decision] No worktree isolation**
- **Found during:** dispatch
- **Issue:** The harness worktree would isolate the session's task-tracker repo, not acmi-app, and the plan's precondition requires acmi-app's main working tree.
- **Fix:** Ran sequentially on the main tree of `C:/Projects/acmi-app`.

**3. [Commit policy] GSD's default protected-branch pre-commit check not applied**
- **Found during:** Task 1, Step 3
- **Issue:** GSD's executor refuses commits on `main` by default, but this plan's `commit_policy` (D-12, D-15) puts the commits on local `main` and never pushes.
- **Fix:** Committed on local `main` as the plan says. The root pin guard passed before the edit and before the commit. Nothing was pushed, and `39e3b6e` is not an ancestor of `origin/main`.

---

**Total deviations:** 3, all procedural. None touches code.
**Impact on plan:** None on scope. All plan checks passed as written.

## Issues Encountered

None that blocked the plan. Out of scope and already present before this plan, so not fixed:
- `npm ci` reports 14 audit vulnerabilities (1 low, 4 moderate, 8 high, 1 critical).
- Next.js 16 warns that the `middleware` file convention is deprecated.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness

- Plan 11-02 can start: the tree is clean apart from GSD's own planning files, the baseline is green, the LOCK check works, and the package source is approved.
- DEP-01 is not complete yet. Plan 11-02 does the install and should finish it.
- Still local: `main` is ahead of `origin/main` by the milestone's commits. The first push is Phase 14.

## Self-Check: PASSED

- FOUND: `.planning/phases/11-install-tracker-client-v10/11-01-SUMMARY.md`, `.gitignore`
- FOUND: commit `39e3b6e` (chore), planning commit `docs(11-01)`
- `git check-ignore -q .planning/state.json` exits 0. `git diff --stat HEAD -- nextjs-project` is empty. `origin/main` is still `7c9993d`.

---
*Phase: 11-install-tracker-client-v10*
*Completed: 2026-10-01*
