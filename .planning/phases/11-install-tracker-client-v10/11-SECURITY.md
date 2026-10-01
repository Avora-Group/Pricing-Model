---
phase: "11"
slug: "install-tracker-client-v10"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-01"
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (11-01-PLAN.md, 11-02-PLAN.md). Verified at ASVS L1 (grep depth) at HEAD 8c8657c, after the WR-01..WR-04 review fixes and the Nyquist tests (277e60b).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Vercel env -> build container | `TRACKER_REPO_TOKEN` (GitHub PAT) enters the build as an env var; since WR-01/02 `vercel-install.sh` writes it only to an owner-only creds file in a process-scoped `mktemp -d` dir | Secret (PAT) |
| Build container -> GitHub (private repo) | npm/git fetch `Avora-Group/tracker-client` over HTTPS with that credential | Secret (PAT), source code |
| Build output -> browser | Anything named `NEXT_PUBLIC_*` is inlined into the client bundle | Public |
| Working tree -> git history | Committed files, including `.env.example`, are readable by anyone with repo access | Internal |
| Local `main` -> `origin/main` | A push deploys production on Vercel | Release control |
| Developer machine -> private repo | Local installs and the tag probe use the developer's own SSH key | Developer credential |
| Agent -> developer's git setup / processes | Running the install script locally, or stopping processes before `npm ci` | Developer config |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-11-01 | Tampering | Staging for the chore commit | medium | mitigate | `39e3b6e` holds `.gitignore` only (1 file, numstat 3 0) | closed |
| T-11-02 | Elevation of Privilege | Push of local commits | high | mitigate | `origin/main` still `7c9993d`; `39e3b6e`, `f20debf`, `277e60b` not ancestors of it | closed |
| T-11-03 | Denial of Service | Stopping a process before `npm ci` | low | mitigate | Both summaries: the probe printed nothing, no process stopped | closed |
| T-11-04 | Repudiation | Authorship of the chore commit | low | mitigate | `avoradevops <devops@avora.aero>` + Co-Authored-By trailer on `39e3b6e` | closed |
| T-11-05 | Information Disclosure | `TRACKER_REPO_TOKEN` naming | high | mitigate | 0 `NEXT_PUBLIC_TRACKER_REPO_TOKEN` hits in `nextjs-project`; 0 reads under `src/`; `tests/dep03-env-manifest.test.mjs` asserts the name is not NEXT_PUBLIC_ | closed |
| T-11-06 | Information Disclosure | `vercel-install.sh` -> build logs | high | mitigate | No `set -x`/xtrace; token written with the `printf` builtin to a umask-077 file, never echoed (line 21 echoes the variable name only); `tests/dep02-install-script.test.mjs` asserts a probe token appears in neither stdout, stderr nor any git config value. The original hash gate (HR blob `fbb9185`) no longer applies after WR-01/02; the test replaces it | closed |
| T-11-07 | Information Disclosure | `.env.example` and phase commits | high | mitigate | 0 `ghp_…`/`github_pat_` patterns in `git log -p 495bf59..HEAD -- nextjs-project`; dep03 test asserts no uncommented assignment carries a value | closed |
| T-11-08 | Information Disclosure | `!.env.example` negation | medium | mitigate | Exact-name negation only; dep03 tests assert `.env`, `.env.local`, `.env.production` stay ignored (`check-ignore --no-index`, no real env file read) | closed |
| T-11-09 | Tampering | Running `vercel-install.sh` on a developer machine | medium | mitigate | Since WR-01/02 the script itself confines git state to `GIT_CONFIG_GLOBAL` in a temp dir; dep02 test runs it only under a fake HOME/USERPROFILE/GIT_CONFIG_GLOBAL and asserts the real global config is unchanged; real global config has 0 x-access-token / 0 insteadOf entries | closed |
| T-11-10 | Information Disclosure | Credentials and `insteadOf` on the build host | low | accept | See AR-11-01 (risk reduced by WR-01/02: token no longer in `$HOME/.git-credentials` or config keys) | closed |
| T-11-11 | Tampering | `normalize-tracker-lock.mjs` rewriting the lockfile | low | accept | See AR-11-02; dep01 tests assert byte-exact rewrite/no-op (LF + CRLF) | closed |
| T-11-12 | Tampering | Unrelated lockfile changes | medium | mitigate | `f20debf` lockfile numstat 9 0 (LOCK-OK, LOCK-COMMITTED-OK); lockfile unchanged since `f20debf` | closed |
| T-11-13 | Denial of Service | Build when `TRACKER_REPO_TOKEN` missing/expired | low | accept | See AR-11-03; dep02 test asserts exit 1 with a clear stderr message | closed |
| T-11-14 | Elevation of Privilege | Push of the phase commit | high | mitigate | Same evidence as T-11-02 | closed |
| T-11-15 | Repudiation | Authorship of the phase commit | low | mitigate | `avoradevops <devops@avora.aero>` + trailer on `f20debf` and every later phase commit | closed |
| T-11-SC | Tampering | npm installs (supply chain) | high | mitigate | Human-approved package source (11-01 Task 2, v10 → a369f81); git URL spec, not a registry name; dep01 test asserts the lock resolves `git+https…#a369f81…` v10.0.0 with no tracker git+ssh; prebuild `check-tracker-lock.mjs` fails any SSH lock | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-10 | Credentials live in an owner-only file inside an ephemeral build container's temp dir, removed on exit; rewrites target `github.com` only; the PAT is fine-grained, read-only, single-repo | Plan 11-02 (D-02) | 2026-10-01 |
| AR-11-02 | T-11-11 | Replaces one exact URL prefix for one repo; the pinned sha is untouched; never fails an install; ships in HR (D-07) | Plan 11-02 (D-07) | 2026-10-01 |
| AR-11-03 | T-11-13 | Failing loudly is intended; Phase 14 (SHIP-03) sets the variable on Production and Preview before any push | Plan 11-02 | 2026-10-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-01 | 16 | 16 | 0 | /gsd-secure-phase 11 (orchestrator, L1 grep depth; plan-time register → auditor skipped per short-circuit rule) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-01
