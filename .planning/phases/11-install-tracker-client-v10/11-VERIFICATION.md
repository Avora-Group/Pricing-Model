---
phase: 11-install-tracker-client-v10
verified: 2026-10-01T07:25:15Z
status: human_needed
score: 4/4 roadmap success criteria verified (16/16 plan truths verified)
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
  - nextjs-project/scripts/normalize-tracker-lock.mjs
  - nextjs-project/vercel-install.sh
  - nextjs-project/vercel.json
covered_digest: "v2:sha256:da098d65ddb63da3189101dfb4a87b2c237cce474e8803d582a086d6c956122f"
behavior_unverified: 0
overrides_applied: 0
unverified_prohibitions: 3 # judgment-tier; non-authoritative verdicts below, all three "not violated" from evidence; flagged for human sign-off, not a gap
human_verification:
  - test: "Sign off the three judgment-tier must_haves.prohibitions (no real-HOME run of vercel-install.sh, no other env file made trackable, no push)"
    expected: "Agree with the evidence-based verdicts below: all three NOT violated"
    why_human: "judgment-tier prohibitions are non-authoritative when judged by an LLM; the framework requires explicit human resolution, never a silent pass. unverified-prohibition - human review recommended"
---

# Phase 11: Install tracker-client v10 Verification Report

**Phase Goal:** ACMI's frontend depends on `@avora/tracker-client` v10 and builds locally, with the install script the Vercel build needs and the env manifest already in the tree.
**Verified:** 2026-10-01T07:25:15Z
**Status:** human_needed (sole reason: three judgment-tier prohibitions flagged for human sign-off; no gaps, no blockers)
**Re-verification:** No, initial verification

## Goal Achievement

All four ROADMAP success criteria hold in the actual tree and were re-run by the verifier, not read from the SUMMARYs. The goal is achieved. The only open items are the prohibition sign-off and non-blocking quality follow-ups from the code review.

### Observable Truths (ROADMAP success criteria, the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | In `nextjs-project/`, `npm ci && npm run build` passes on a clean tree, dependency resolved over `git+https` to `a369f81` | VERIFIED | Tree clean (only untracked `.planning/milestone.lock`). Verifier ran `npm ci`: exit 0, 22.8 s. `npm run build`: exit 0 on the 2nd and 3rd run (Next.js 16.1.6, 16/16 static pages). The 1st run failed on a `next/font/google` (Inter) fetch error; see Behavioral Spot-Checks. Installed `node_modules/@avora/tracker-client` is 10.0.0 with `dialog/`, `token/`, `server/`. Lock `resolved` = `git+https://github.com/Avora-Group/tracker-client.git#a369f81a51c88d6b82fec3c05537a13da862f769`. `git status` identical before and after (npm ci's postinstall left the lockfile unchanged). |
| 2 | `grep -c git+ssh package-lock.json` is `0`; lockfile diff touches only the tracker-client entry | VERIFIED | `grep -c git+ssh` printed `0`. `git diff 495bf59 HEAD -- package-lock.json` is 9 added lines, 0 deleted: the root dependency line, the `node_modules/@avora/tracker-client` block (version 10.0.0, resolved, engines) and the root `"hasInstallScript": true`. No other package entry changed. The `hasInstallScript` line is the mechanical effect of the new `postinstall` (D-06) and the plan documents it as expected, not D-14 drift. Read as "no other package changes" (DEP-01 wording) it holds. |
| 3 | `installCommand` is `bash vercel-install.sh`; script writes git credentials from `TRACKER_REPO_TOKEN` for all three GitHub URL forms before `npm install`; `git ls-files --eol vercel-install.sh` shows `i/lf` | VERIFIED | `vercel.json`: only `installCommand` changed (`npm install` -> `bash vercel-install.sh`). `git ls-files --eol`: `i/lf w/lf`. Index mode `100644`, blob `fbb9185f...` equals HR's. Script read in full: credentials file + `credential.helper store`, then `insteadOf` for `https://github.com/`, `ssh://git@github.com/` (`--add`) and `git@github.com:` (`--add`), `npm install` is the last command; empty/unset token exits 1 with the ERROR text. Verifier re-ran the plan harness in a throwaway HOME / `GIT_CONFIG_GLOBAL`: `HARNESS-OK` (exit 1 on unset and on empty token, no files written on those paths, exit 0 with token, credentials line correct, helper `store`, exactly the three values on one key, token never printed, real global config unchanged). |
| 4 | `.env.example` tracked despite `.env*`; names only; every `process.env` name under `src/` plus the five named variables | VERIFIED | `git ls-files .env.example` lists it; `git check-ignore -q` on it exits 1 (not ignored); `.gitignore` adds exactly `!.env.example` directly under `.env*`. Verifier's own scan of `src/` found `API_URL, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI, AZURE_TENANT_ID, NEXT_PUBLIC_API_URL, NODE_ENV`, with no bracket/destructured reads. File holds 11 variable lines, all `NAME=` with empty value (0 non-blank), covers all of them but `NODE_ENV` plus `TRACKER_API_SCOPE, TRACKER_RT_KEY, NEXT_PUBLIC_TRACKER_API_URL, NEXT_PUBLIC_TRACKER_URL, TRACKER_REPO_TOKEN`. No BOM, no CR, four 79-code-point headings, `i/lf`. Only values anywhere are three public `# Value:` comments (tracker client-id scope, two public URLs). `NODE_ENV` is excluded by locked decision D-09 because the framework sets it; the roadmap's literal "every name" is read with that exception. Noted, not a gap. |

### Plan must-haves (11-01, 11-02), not covered by the four criteria above

| Truth | Status | Evidence |
|-------|--------|----------|
| `.planning/state.json` ignored in its own commit (3 lines), before phase changes | VERIFIED | Commit `39e3b6e`: `.gitignore` only, `+3 -0`, author `avoradevops <devops@avora.aero>`, sentence-style subject. |
| `package.json`: tracker-client first dependency by hand, spec `...#v10`, only other change is `postinstall` | VERIFIED | Diff: 3 insertions, 1 deletion, exactly those two edits. Blob `6fefee4`. |
| `normalize-tracker-lock.mjs` byte for byte HR's | VERIFIED | `git hash-object` = `1e657b8d363aad7e1721cb34653563b2e8740a80`, `i/lf`. |
| `vercel-install.sh` is HR's unchanged | VERIFIED | blob `fbb9185f9f1ed1146c2b82e500d96c283b7ed498`. |
| Exactly one commit holds the phase work: seven named files, sentence-style subject, repo identity, Co-Authored-By last line | VERIFIED | `f20debf`: 7 files, `+172 -2`, subject `Tracker embed: install tracker-client v10 for the Vercel build`, author `avoradevops`, trailer present. Later commits are `docs(...)` planning only. |
| Local only; no `.github/`; no Docker change | VERIFIED | `origin/main` = `7c9993d`; `f20debf` and `39e3b6e` are not ancestors of it (`merge-base --is-ancestor` exit 1). No `.github/`. No Docker file in the diff. |
| Package source confirmed by a human before install (D-01) | VERIFIED | 11-01-SUMMARY records the tag probe (`v10^{}` = `a369f81...`) and the user's "approved". |

**Score:** 4/4 roadmap criteria, all plan truths verified; 0 present-but-behavior-unverified (the script's behavior-dependent truths are backed by the executed harness).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `nextjs-project/package.json` | dep spec + postinstall | VERIFIED | contains both strings |
| `nextjs-project/package-lock.json` | pinned entry, git+https | VERIFIED | one resolved entry at `a369f81`, 0 `git+ssh` |
| `nextjs-project/scripts/normalize-tracker-lock.mjs` | 39 lines, HTTPS constant | VERIFIED | 39 lines, blob match |
| `nextjs-project/vercel-install.sh` | 43 lines, three rewrites | VERIFIED | 43 lines, `insteadOf` x3 |
| `nextjs-project/vercel.json` | installCommand | VERIFIED | |
| `nextjs-project/.env.example` | 11 names, tracked | VERIFIED | |
| `nextjs-project/.gitignore` | `!.env.example` | VERIFIED | |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` scripts.postinstall | `scripts/normalize-tracker-lock.mjs` | npm lifecycle | WIRED | pattern present; script exists; ran during the verifier's `npm ci` with no lockfile change |
| `vercel.json` installCommand | `vercel-install.sh` | Vercel runs in Root Directory `nextjs-project` | WIRED | script sits beside `vercel.json` in `nextjs-project/` |
| `vercel-install.sh` | `TRACKER_REPO_TOKEN` -> credentials + three `insteadOf` | git config | WIRED | harness confirms |
| lock entry | tracker-client commit `a369f81` | `resolved` over git+https | WIRED | |
| `.gitignore` | `.env.example` | negation after `.env*` | WIRED | file is tracked and not ignored; other env files still ignored (an untracked, ignored local env file shows as `!!` in `git status --ignored`, and `git status` lists no env file as untracked) |

### Data-Flow Trace (Level 4)

Not applicable: the phase renders no dynamic data and nothing imports the package yet (by design, Phases 12 and 13).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Clean install | `npm ci` in `nextjs-project/` | exit 0, 22.8 s | PASS |
| Build with dependency | `npm run build` | exit 0 on runs 2 and 3; run 1 exit 1 | PASS (see note) |
| Install script behavior | plan harness, throwaway HOME | `HARNESS-OK` | PASS |
| Lockfile has no SSH URL | `grep -c git+ssh package-lock.json` | `0` | PASS |
| Real global git config untouched | count of `x-access-token` / `insteadof` entries in `git config --global --list` | 0 / 0 | PASS |

Note on the failed first build: it came straight after `npm ci` and failed with `module-not-found` errors under `[next]/internal/font/google/inter_...`. That is the `next/font/google` Inter download failing on a network hiccup. The font import is in `src/app/layout.tsx` and predates this phase (`git diff 495bf59 HEAD -- nextjs-project/src` is empty). Two consecutive builds on the same tree then passed. Judged environmental, not phase-caused. It is a real fragility (the build depends on fetching Google Fonts), pre-existing and outside this phase.

### Probe Execution

No probes declared; step skipped (no `probe-*.sh` in `scripts/`).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEP-01 | 11-01, 11-02 | tracker-client v10 pinned to the `v10` tag; lockfile resolves over git+https to `a369f81`, no git+ssh, no other package changes | SATISFIED | Criteria 1 and 2 above |
| DEP-02 | 11-02 | `installCommand` = `bash vercel-install.sh`; script writes credentials for all three URL forms before `npm install`; LF | SATISFIED locally | Criterion 3. The real Vercel install is first exercised in Phase 14 and is explicitly out of scope. |
| DEP-03 | 11-02 | new `.env.example`, name-only, existing names + the five new ones | SATISFIED | Criterion 4 |

No orphaned requirements: REQUIREMENTS.md maps exactly DEP-01, DEP-02, DEP-03 to Phase 11, and the plans claim all three.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` markers in any phase-modified file (the files are config, a shell script, a copied normalizer and a manifest). No stubs.

### Code review findings (11-REVIEW.md): gap or follow-up?

Judged individually against the success criteria and must-haves. None breaks one, so none is a gap. All eight stay "open" as quality follow-ups.

| Finding | Breaks a criterion or must-have? | Verdict |
|---------|----------------------------------|---------|
| WR-01: second run in the same HOME exits 5 and echoes the token | No. SC3 requires credentials for three URL forms before `npm install`, which holds, and Vercel uses a fresh HOME per build. The must-have "HR's variant unchanged" in fact requires the script to stay as is. The token leak into logs on a re-run is a real hardening item. | Follow-up. Fix by changing HR's file in all apps together (D-07 wants one identical file), so raise it with the shared script rather than patch ACMI alone. |
| WR-02: no guard against running outside Vercel | No. This is the hazard prohibition 1 was written for, and it was respected. | Follow-up, same as WR-01. |
| WR-03: postinstall runs only on a bare `npm install` | No. SC2 (`git+ssh` count is 0) holds on the committed lockfile and was re-checked after a fresh `npm ci`. D-06's "after any later npm install" is overstated, as the review proved, but Phase 12 adds no dependency (`jose` is present). | Follow-up. Practical rule for Phases 12 to 14: run a bare `npm install` after any dependency change and re-check `grep -c git+ssh`. Consider a `prebuild` guard. Worth doing before Phase 14's push. |
| WR-04: copying `.env.example` leaves blank `NEXT_PUBLIC_API_URL=` / `API_URL=` lines, which defeat the `??` fallback to `localhost:8000` | No. SC4 and DEP-03 require names only, and the plan fixed blank values (D-10). The comments say "when unset", but a verbatim copy sets the empty string. | Follow-up, and the one worth fixing soonest: it is a local-dev trap from the moment Phase 12 starts. A small doc fix (comment out the two API lines) is enough. |
| IN-01 to IN-04 | No | Hardening notes, not blocking. |

### Prohibitions (must_haves.prohibitions, judgment tier)

Non-authoritative verdicts from evidence. Each carries the flag `unverified-prohibition - human review recommended`. None is silently passed.

| # | Prohibition | Verifier verdict (non-authoritative) | Evidence |
|---|-------------|--------------------------------------|----------|
| 1 | MUST NOT run `vercel-install.sh` against a real HOME or real global git config | Not violated | The real global git config holds 0 `x-access-token` and 0 `insteadof` entries. A real run would have set `credential.helper store` and three `insteadOf` values, and the plan's harness compares the real config before and after. The verifier's own harness run also left it unchanged. Absence of a past run cannot be proven, only shown to be consistent with. |
| 2 | MUST NOT make any env file other than `.env.example` trackable | Not violated | The only `.gitignore` change is the exact line `!.env.example`. `git ls-files` lists no env file except `.env.example`. The only other env file in `nextjs-project/` shows as ignored (`!!`) in `git status --ignored`, and the review separately confirmed that `.env.production` and `.env.example.local` stay ignored. The verifier never read the secret file. |
| 3 | MUST NOT push any commit of this phase | Not violated | `origin/main` and `origin/HEAD` are `7c9993d`. `f20debf` and `39e3b6e` are not ancestors of it. The reflog shows only local commits. |

### Human Verification Required

#### 1. Sign off the three prohibitions

**Test:** Read the three verdicts above. Optionally check `git log origin/main..HEAD` and `git config --global --list` yourself.
**Expected:** Agree that none was violated.
**Why human:** Judgment-tier prohibitions need explicit human resolution. This is the only item holding the status at `human_needed`. If you accept the verdicts, the phase is complete with 3 flagged prohibitions.

### Gaps Summary

No gaps. The phase goal is achieved: the dependency is installed from the pinned commit over git+https, the lockfile is clean, the Vercel install script and `installCommand` are in place, and the env manifest is tracked and name-only. Remaining work is outside the phase: the live Vercel install (Phase 14) and the review follow-ups above.

---

_Verified: 2026-10-01T07:25:15Z_
_Verifier: Claude (gsd-verifier)_
