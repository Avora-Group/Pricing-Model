---
phase: "11"
slug: "install-tracker-client-v10"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-01"
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed after execution (State B) by /gsd-validate-phase 11 on 2026-10-01, after the WR-01..WR-04 review fixes.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` + `node:assert/strict` (no dependency added) |
| **Config file** | none |
| **Quick run command** | `cd nextjs-project && node --test "tests/*.test.mjs"` |
| **Full suite command** | `cd nextjs-project && node --test "tests/*.test.mjs" && npm run build` (prebuild runs `check-tracker-lock.mjs`) |
| **Estimated runtime** | ~1 second (tests); ~25 seconds with the build |

Quote the glob: `node --test tests/` treats `tests` as a module path on Node 24 and fails with MODULE_NOT_FOUND. There is no `npm test` script (package.json was not edited for this audit).

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | — (D-12, D-13) | — | N/A | other | `git check-ignore -q .planning/state.json` | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | DEP-01 | — | Package source is the intended private repo/tag | manual | see Manual-Only | — | ✅ green (approved 2026-10-01) |
| 11-02-01 | 02 | 2 | DEP-01 | — | Lock stays on git+https; no SSH URL committed | unit | `node --test "tests/dep01-lock.test.mjs"` + prebuild `check-tracker-lock.mjs` | ✅ | ✅ green |
| 11-02-02 | 02 | 2 | DEP-02 | — | Token required, never printed, never in config/argv, git state process-scoped, real HOME untouched | integration | `node --test "tests/dep02-install-script.test.mjs"` | ✅ | ✅ green |
| 11-02-02 | 02 | 2 | DEP-03 | — | Only `.env.example` trackable; no values in it; token not NEXT_PUBLIC_ | integration | `node --test "tests/dep03-env-manifest.test.mjs"` | ✅ | ✅ green |
| 11-02-03 | 02 | 2 | DEP-01 | — | N/A | build | `npm ci && npm run build` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `nextjs-project/tests/dep01-lock.test.mjs` — DEP-01: lock pin (v10.0.0, a369f81 over https, no tracker git+ssh), package.json spec, normalizer byte-exact rewrite/no-op (LF + CRLF) and missing-lockfile exit 0, check-tracker-lock exit 1/0 on fixtures and 0 on the real lockfile (10 tests)
- [x] `nextjs-project/tests/dep02-install-script.test.mjs` — DEP-02: unset/empty token exit 1 without calling npm; with a token, exit 0, no leak, `credential.helper` reset + store helper, exactly 2 `insteadOf` rewrites; temp git dir removed; nothing written to HOME; real global config identical before/after (5 tests; HOME, USERPROFILE and GIT_CONFIG_GLOBAL in a mkdtemp dir; stub `npm` first on PATH)
- [x] `nextjs-project/tests/dep03-env-manifest.test.mjs` — DEP-03: `.env.example` tracked and not ignored, `.env`/`.env.local`/`.env.production` ignored (`check-ignore --no-index`, no real env file read), no uncommented values, TRACKER_REPO_TOKEN not NEXT_PUBLIC_ (7 tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Package source is Avora-Group/tracker-client tag v10 → a369f81 | DEP-01 | Package-legitimacy gate: only a human can confirm the intended private repo | `git ls-remote git@github.com:Avora-Group/tracker-client.git refs/tags/v10 refs/tags/v10^{}`; approved 2026-10-01 |
| Real Vercel install fetches the private dep with TRACKER_REPO_TOKEN | DEP-02 | The test stubs `npm`; real GitHub auth on Vercel is first exercised by the Phase 14 deploy | After Phase 14 sets the variable and pushes, confirm the `pricing-model` build log shows a clean `bash vercel-install.sh` install |
| DEP-02 harness on Linux | DEP-02 | Suite was run on Windows Git Bash only | Run the quick command on a Linux shell (or in CI) once |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-01

## Validation Audit 2026-10-01
| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

Tests committed in `277e60b` (local, not pushed); 22/22 pass.
