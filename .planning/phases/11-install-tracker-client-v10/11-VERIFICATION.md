---
phase: 11-install-tracker-client-v10
verified: 2026-10-01T09:10:00Z
status: passed
score: 4/4 roadmap success criteria verified (plan truths: 14 satisfied as written, 5 satisfied in intent via documented review-fix deviations, 0 failed)
covered_files:
  - .gitignore
  - .planning/phases/11-install-tracker-client-v10/11-01-PLAN.md
  - .planning/phases/11-install-tracker-client-v10/11-01-SUMMARY.md
  - .planning/phases/11-install-tracker-client-v10/11-02-PLAN.md
  - .planning/phases/11-install-tracker-client-v10/11-02-SUMMARY.md
  - nextjs-project/.env.example
  - nextjs-project/.gitignore
  - nextjs-project/package-lock.json
  - nextjs-project/package.json
  - nextjs-project/scripts/check-tracker-lock.mjs
  - nextjs-project/scripts/normalize-tracker-lock.mjs
  - nextjs-project/tests/dep01-lock.test.mjs
  - nextjs-project/tests/dep02-install-script.test.mjs
  - nextjs-project/tests/dep03-env-manifest.test.mjs
  - nextjs-project/vercel-install.sh
  - nextjs-project/vercel.json
covered_digest: "v2:sha256:e03aebcd25a20a61b1ea3ca1babfc3c02e52e4c10825e009cad18d8f2b6a09af"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/4 roadmap criteria (16/16 plan truths)
  reason: "Previous report was stale: covered source files changed after it (WR-01..WR-04 review fixes e0baf40, 99dc259, f6eef54; Nyquist tests 277e60b)."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  human_items_resolved:
    - "Three judgment-tier prohibitions signed off PASS by the user in 11-UAT.md on 2026-10-01 (evidence re-checked at 93e2039); re-checked again here at c5eee6d, no contradicting evidence"
deferred:
  - truth: "The real Vercel build fetches the private dependency with TRACKER_REPO_TOKEN through bash vercel-install.sh"
    addressed_in: "Phase 14"
    evidence: "Phase 14 'Deploy and production UAT' sets TRACKER_REPO_TOKEN (SHIP-03) and does the gated push to main; the install script cannot meet real GitHub auth on Vercel before that. Planned scope, not a Phase 11 gap."
---

# Phase 11: Install tracker-client v10 Verification Report

**Phase Goal:** ACMI's frontend depends on `@avora/tracker-client` v10 and builds locally, with the install script the Vercel build needs and the env manifest already in the tree.
**Verified:** 2026-10-01T09:10:00Z (HEAD `c5eee6d`)
**Status:** passed
**Re-verification:** Yes. The earlier `human_needed` report was stale after the review fixes. Every ROADMAP criterion and plan must-have was re-checked against the current tree, including the build, the lockfile, the install script (in a sandbox) and the Nyquist tests.

## Goal Achievement

The goal is achieved at HEAD. The dependency installs from the pinned commit, the app builds, the Vercel install script exists and is wired into `vercel.json`, and the env manifest is tracked. The review fixes changed how the install script and `.env.example` are written but not what they deliver. None breaks a roadmap criterion or a requirement.

### Observable Truths (ROADMAP success criteria, the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | In `nextjs-project/`, `npm ci && npm run build` passes on a clean tree, dependency resolved over `git+https` to `a369f81` | VERIFIED | Verifier ran `GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0 npm ci`: exit 0, 27 s. Installed `node_modules/@avora/tracker-client` is `10.0.0` with `dialog/`, `server/`, `token/`. `npm run build`: exit 0 (the new `prebuild` guard ran and passed first, then Next.js 16.1.6 Turbopack finished). `git status --short` after both shows only the untracked GSD file `.planning/milestone.lock`; no tracked file changed. Lock `resolved` is `git+https://github.com/Avora-Group/tracker-client.git#a369f81a51c88d6b82fec3c05537a13da862f769`; the dep01 test asserts the same. |
| 2 | `grep -c git+ssh package-lock.json` is `0`; lockfile diff touches only the tracker-client entry | VERIFIED | `grep -c 'git+ssh'` printed `0`, also after the fresh `npm ci`. `git diff 495bf59 HEAD --numstat -- nextjs-project/package-lock.json` is `9 0`: the root dependency line, the `node_modules/@avora/tracker-client` block and the root `hasInstallScript`, which is the mechanical effect of the new `postinstall` (D-06) and documented as expected, not D-14 drift. The lockfile was last touched by `f20debf`; no review fix changed it. No other package entry changed. |
| 3 | `installCommand` is `bash vercel-install.sh`; the script writes git credentials from `TRACKER_REPO_TOKEN` for all three GitHub URL forms before `npm install`; `git ls-files --eol vercel-install.sh` shows `i/lf` | VERIFIED (mechanism changed by WR-01/WR-02, intent holds) | `vercel.json` differs from `495bf59` only in `installCommand` (`1 1`). `git ls-files --eol`: `i/lf w/crlf` (working copy CRLF from autocrlf; the index is LF, which is what Vercel checks out). Script read in full at HEAD: it exits 1 with `ERROR: TRACKER_REPO_TOKEN is not set` on an unset or empty token, writes the token once (printf builtin, umask 077) into a mktemp creds file, sets `credential.helper` (empty reset, then `store --file`), adds two `insteadOf` rewrites (`ssh://git@github.com/` and `git@github.com:` to `https://github.com/`), and `npm install` is the last command. Independent sandbox run by the verifier (fake HOME/USERPROFILE/XDG, stub `npm` first on PATH, fake token): exit 0; `git ls-remote --get-url` resolves all three forms (`https://`, `ssh://git@`, `git@github.com:`) to `https://github.com/Avora-Group/tracker-client.git`; `git credential fill` for `github.com` returns `username=x-access-token` from the store; the fake token appears 0 times in the output; the fake HOME stayed empty; the temp git dir was removed. So credentials from `TRACKER_REPO_TOKEN` apply to all three URL forms before `npm install`. See "Plan must-haves that referenced the old form". |
| 4 | `.env.example` tracked despite `.env*`; names only; every `process.env` name under `src/` plus the five named variables | VERIFIED (WR-04 deviation, intent holds) | `git ls-files` lists `nextjs-project/.env.example`; `git check-ignore -q` on it exits 1 (not ignored); `nextjs-project/.gitignore` adds `!.env.example` (`2 0`). The verifier's scan of `src/` finds `API_URL, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI, AZURE_TENANT_ID, NEXT_PUBLIC_API_URL, NODE_ENV`. The manifest names all but `NODE_ENV` (excluded by D-09, the framework sets it) plus `TRACKER_API_SCOPE`, `TRACKER_RT_KEY`, `NEXT_PUBLIC_TRACKER_API_URL`, `NEXT_PUBLIC_TRACKER_URL`, `TRACKER_REPO_TOKEN`: all 11 names present, in the planned order and four groups. Nine are uncommented blank `NAME=` lines; `API_URL` and `NEXT_PUBLIC_API_URL` are present as commented lines `# NAME=http://localhost:8000` (WR-04). No secret value anywhere; the only values are the three public `# Value:` comments and the non-secret localhost default. `i/lf`. |

### Plan must-haves that referenced the old form (judged against the review fixes)

| Plan must-have | Current state | Judgment |
|----------------|---------------|----------|
| `vercel-install.sh` is HR's blob `fbb9185f` unchanged (D-02, D-07 spirit) | Blob is now `3d456e6`, rewritten in `e0baf40` | Deliberate, documented deviation (11-REVIEW-FIX WR-01/WR-02). The hash was a means for "HR's known-good script", not the goal. DEP-02 and ROADMAP criterion 3 require behavior (credentials from the token, all three URL forms, before `npm install`, LF), and that behavior holds and is covered by the dep02 test (11-VALIDATION says the test replaces the hash gate). The fix removes real hazards the review proved (a second run failing and echoing the token; a local run overwriting `~/.git-credentials`). Not a gap. Note for later: the four Avora apps no longer hold one identical script, so the fix should be ported to the sibling apps. |
| "Exactly three values on the one `url.<token-https>.insteadOf` key" | Two `insteadOf` values on `url."https://github.com/".insteadOf`, no token in any key | Satisfied in intent. The `https://` form needs no rewrite because the store supplies the token on GitHub's auth challenge; the two SSH forms are rewritten. Sandbox run proves all three resolve to token-authenticated HTTPS. The dep02 test asserts exactly the two rewrites. |
| Credentials file and rewrites are written before `npm install`, which is the last command | Same ordering, creds in a temp dir | Satisfied. |
| Unset or empty token exits 1 with the ERROR text, writes nothing, does not run `npm install` | Unchanged; the dep02 tests assert exit 1, stderr message and that `npm` is never called | Satisfied. |
| `.env.example`: eleven blank `NAME=` lines, every variable line matches `^[A-Z0-9_]+=$` | Nine blank lines, two commented `# NAME=http://localhost:8000` | Deliberate, documented deviation (WR-04, f6eef54). A blank `API_URL=` copied to `.env.local` sets `""` and breaks the code's `??` default; the review proved it. All 11 names remain listed, no secret value, and DEP-03 says "lists every variable name ... name-only". The commented lines carry only the public localhost default. Not a gap. |
| Normalizer byte-for-byte HR's (`1e657b8d`); `package.json` blob `6fefee4b` | Normalizer still `1e657b8d` (untouched). `package.json` gained `"prebuild": "node scripts/check-tracker-lock.mjs"` (WR-03, `4 1` against baseline) and `scripts/check-tracker-lock.mjs` is a new file | Deliberate, documented addition. It does not remove any planned content, the dependency spec and `postinstall` are exactly as planned, and the guard closes the review's finding that the normalizer skips most npm commands. D-06's note in 11-CONTEXT.md was updated. Not a gap. |
| "Exactly one commit holds the phase work: the seven named files" | `f20debf` holds exactly those seven. Later `fix(11)`/`test(11)` commits are review fixes and Nyquist tests | Satisfied for the phase commit; later commits are the review/validation workflow. |

Unchanged and re-confirmed: `.planning/state.json` ignore commit `39e3b6e` (separate, 3 lines); the chore and phase commits are by `avoradevops <devops@avora.aero>` with a Co-Authored-By trailer (`f20debf` last line `Co-Authored-By: Claude Opus 5.5 ...`); `vercel.json` has only `installCommand` changed; no `.github/` directory; no Dockerfile or docker-compose change; `package.json` lists `@avora/tracker-client` first with spec `git+https://github.com/Avora-Group/tracker-client.git#v10`; the human package-source checkpoint (D-01) is recorded in 11-01-SUMMARY.

**Score:** 4/4 roadmap criteria verified; 0 failed, 0 present-but-behavior-unverified (the script's behavior is backed by the verifier's sandbox run and 5 passing dep02 tests).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | Real Vercel install of the private dependency with `TRACKER_REPO_TOKEN` | Phase 14 | Phase 14 sets the variable (SHIP-03) and does the gated first push. 11-VALIDATION lists it as a manual-only check "after Phase 14". Planned scope; local behavior is fully proven. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `nextjs-project/package.json` | dep spec, `postinstall` (plus `prebuild` from WR-03) | VERIFIED | Both required strings present; `prebuild` added by review fix |
| `nextjs-project/package-lock.json` | pin to `a369f81` over git+https | VERIFIED | one resolved entry, 0 `git+ssh` |
| `nextjs-project/scripts/normalize-tracker-lock.mjs` | postinstall normalizer, 39 lines | VERIFIED | blob `1e657b8d`, `i/lf` |
| `nextjs-project/scripts/check-tracker-lock.mjs` | prebuild guard (new, WR-03) | VERIFIED | exits 1 on a tracker SSH lock, 0 on the real lock; dep01 tests cover both |
| `nextjs-project/vercel-install.sh` | install script, token required, three URL forms, `npm install` last | VERIFIED | substantive, sandbox-proven, `i/lf` in index, mode 100644 |
| `nextjs-project/vercel.json` | `installCommand` override | VERIFIED | `bash vercel-install.sh` |
| `nextjs-project/.env.example` | 11 names, tracked | VERIFIED | see criterion 4 |
| `nextjs-project/.gitignore` | `!.env.example` | VERIFIED | exact rule under `.env*` |
| `nextjs-project/tests/*.test.mjs` | Nyquist tests (277e60b) | VERIFIED | 3 files, 22 tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` scripts.postinstall | `scripts/normalize-tracker-lock.mjs` | npm lifecycle | WIRED | ran during the verifier's `npm ci`, lockfile unchanged |
| `package.json` scripts.prebuild | `scripts/check-tracker-lock.mjs` | npm lifecycle before `build` | WIRED | ran and passed at the start of the verifier's `npm run build` |
| `vercel.json` installCommand | `vercel-install.sh` | Vercel runs in Root Directory `nextjs-project` | WIRED | script sits beside `vercel.json` |
| `vercel-install.sh` | `TRACKER_REPO_TOKEN` -> credential store + `insteadOf` | `GIT_CONFIG_GLOBAL` temp config | WIRED | sandbox run resolved all three URL forms and returned the stored credential |
| lock entry | tracker-client commit `a369f81` | `resolved`, git+https | WIRED | |
| `nextjs-project/.gitignore` | `.env.example` | negation after `.env*` | WIRED | tracked, not ignored; dep03 tests confirm `.env`, `.env.local`, `.env.production` stay ignored |

### Data-Flow Trace (Level 4)

Not applicable. The phase renders no dynamic data, and nothing imports the package yet (Phases 12 and 13 by design).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Clean install with dependency | `GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0 npm ci` in `nextjs-project/` | exit 0, 27 s, tracker-client 10.0.0 | PASS |
| Build | `npm run build` | exit 0, prebuild guard passed first | PASS |
| Nyquist tests | `cd nextjs-project && node --test "tests/*.test.mjs"` | 22 tests, 22 pass, 0 fail | PASS |
| Install script, sandboxed | own run, fake HOME + stub npm + fake token | exit 0; three URL forms resolve to HTTPS; credential returned; token in log 0 | PASS |
| Lockfile has no SSH URL | `grep -c git+ssh package-lock.json` | `0` | PASS |
| Real global git config untouched | count of `x-access-token` / `insteadof` in `git config --global --list` | 0 / 0 | PASS |

The first-verification build flake (a `next/font/google` Inter fetch failing once) did not recur; the build passed first time here.

### Probe Execution

No probes declared and no `scripts/*/tests/probe-*.sh` exist; skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEP-01 | 11-01, 11-02 | tracker-client v10 pinned to the `v10` tag; lockfile resolves over git+https to `a369f81`, no git+ssh, no other package changes | SATISFIED | Criteria 1 and 2; dep01 tests; `prebuild` guard |
| DEP-02 | 11-02 | `installCommand` = `bash vercel-install.sh`; script writes credentials from `TRACKER_REPO_TOKEN` for all three URL forms before `npm install`; LF | SATISFIED locally | Criterion 3. The credential mechanism is now store plus two rewrites rather than token-in-key rewrites, with the same coverage. The real Vercel install is Phase 14. |
| DEP-03 | 11-02 | new `.env.example`, name-only, every name read plus the five new ones | SATISFIED | Criterion 4; dep03 tests |

No orphaned requirements: REQUIREMENTS.md maps exactly DEP-01, DEP-02 and DEP-03 to Phase 11 (all marked Complete), and the plans claim all three (11-01: DEP-01; 11-02: DEP-01, DEP-02, DEP-03).

### Anti-Patterns Found

No `TBD`, `FIXME`, `XXX`, `TODO` or `HACK` markers in any phase-modified file. No stubs. No hardcoded-empty rendering; the blank `NAME=` lines are the intended manifest format.

### Code review (11-REVIEW.md) status

WR-01 to WR-04 are fixed (e0baf40, 99dc259, f6eef54). IN-01 to IN-04 remain `open` info items; IN-01, IN-02 and part of IN-04 were incidentally resolved by the WR-01/WR-02 rewrite per 11-REVIEW-FIX, and IN-03 (non-atomic lockfile write in the normalizer) is a hardening note. None breaks a criterion or requirement. `npm run lint` has 10 errors and 10 warnings, all in `src/` files this phase did not touch (equal to the baseline the roadmap cites for Phase 12).

### Prohibitions (must_haves.prohibitions, judgment tier)

Signed off by the user as PASS in 11-UAT.md on 2026-10-01 (evidence re-checked at `93e2039`). Re-checked at `c5eee6d` for contradicting evidence; there is none, so none is re-raised.

| # | Prohibition | Status | Evidence at HEAD |
|---|-------------|--------|------------------|
| 1 | MUST NOT run `vercel-install.sh` against a real HOME or real global git config | Not violated (human sign-off) | Real global config holds 0 `x-access-token` and 0 `insteadof` entries. The script now confines its own state to a temp `GIT_CONFIG_GLOBAL`. The verifier's own run used a fake HOME; the tests sandbox HOME, USERPROFILE and `GIT_CONFIG_GLOBAL`. |
| 2 | MUST NOT make any env file other than `.env.example` trackable | Not violated (human sign-off) | The only change to `nextjs-project/.gitignore` is the exact `!.env.example`. `git ls-files` shows only `fastapi-project/.env.example` (pre-existing) and `nextjs-project/.env.example`. dep03 tests confirm `.env`, `.env.local` and `.env.production` stay ignored. The verifier never read any real env file. |
| 3 | MUST NOT push any commit of this phase | Not violated (human sign-off) | `git ls-remote origin main` is still `7c9993d`; HEAD is 24 commits ahead; `f20debf` is not an ancestor of `origin/main`. |

### Human Verification Required

None. The single item from the prior report is resolved by the user's sign-off, and nothing since contradicts it. The real Vercel install is deferred to Phase 14, not a Phase 11 item.

### Gaps Summary

No gaps. The phase goal is achieved and remains achieved after the review fixes. Documented deviations from plan wording (install script no longer HR's blob, two rewrites instead of three, two commented API lines, an added `prebuild` guard) each keep the requirement's intent and are recorded in 11-REVIEW-FIX.md. Follow-ups outside this phase: port the hardened install script to the sibling Avora apps, and run the DEP-02 test on Linux once.

---

_Verified: 2026-10-01T09:10:00Z_
_Verifier: Claude (gsd-verifier)_
