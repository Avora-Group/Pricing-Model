---
phase: "12"
slug: "refresh-token-capture-and-token-route"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `12-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (built into Node v24.15.0); no npm test runner, no `test` script |
| **Config file** | none. Tests are `nextjs-project/tests/*.test.mjs`, with `ROOT` resolved from `import.meta.url` (Phase 11 style) |
| **Quick run command** | `cd nextjs-project && node --test tests/rt-helper.test.mjs tests/rt-wiring.test.mjs` |
| **Full suite command** | `cd nextjs-project && node --test "tests/*.test.mjs"` (baseline: 22 pass, 0 fail) |
| **Build gate** | `cd nextjs-project && npm run build` |
| **Lint gate** | `cd nextjs-project && npm run lint` must stay at 10 errors, 10 warnings (ESLint covers `src/**`, `tests/*.mjs`, `scripts/*.mjs`) |
| **Estimated runtime** | ~5 seconds (tests); build ~1–2 min |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/*.test.mjs"`
- **After every plan wave:** Run the full suite, plus `npm run lint` (must equal 10/10), plus `npm run build`
- **Before `/gsd-verify-work`:** Full suite green, build, lint baseline, then local UAT 1–5 with the D-11 checkpoint first
- **Max feedback latency:** 5 seconds (tests)

---

## Per-Task Verification Map

Task IDs are filled in once the plans exist. Requirement → check mapping, from research:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | RT-01 | — | Both auth routes request `openid email profile offline_access` | static | `node --test tests/rt-wiring.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RT-02 | — | Callback seals `{ rt, sub }` as `dir`/`A256GCM` JWE with `exp` = +7 d | unit + static | `node --test tests/rt-helper.test.mjs tests/rt-wiring.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RT-03 | — | Cookie `httpOnly`, `sameSite: lax`, 7 d, path `/api/tracker`, secure in prod | unit | `node --test tests/rt-helper.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RT-04 | — | Logout deletes `tracker_rt` with path `/api/tracker`, no `maxAge` in delete options | static | `node --test tests/rt-wiring.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RT-05 | — | Unset or malformed key → no cookie, sign-in unaffected | unit | `node --test tests/rt-helper.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TOKEN-01 | — | 200 `{accessToken, expiresAt}`, `no-store` | static + manual | `node --test tests/rt-wiring.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TOKEN-02 | — | No/expired `access_token` → 401 reauth JSON, never a redirect | unit + static | `node --test tests/rt-helper.test.mjs tests/rt-wiring.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TOKEN-03 | — | Bad `tracker_rt` → 401 reauth + cleared cookie; unset scope/key → 503 before the session gate; logs carry no token | unit + static | `node --test tests/rt-helper.test.mjs tests/rt-wiring.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TOKEN-04 | — | Rotation re-sets `tracker_rt` with the same attributes | static + manual | `node --test tests/rt-wiring.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `nextjs-project/tests/rt-helper.test.mjs` — RT-02, RT-03, RT-05, TOKEN-02, TOKEN-03 (helper decisions)
- [ ] `nextjs-project/tests/rt-wiring.test.mjs` — RT-01, RT-04, TOKEN-01..04 (static wiring)
- No framework install: `node:test` is built in and `jose` resolves from `tests/` through the project `node_modules`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Entra `offline_access` admin consent on `ac19614d-…` | D-11 | Portal state | Human checkpoint before UAT 1; stop on any consent screen or AADSTS65001 / AADSTS90094 |
| `tracker_rt` present with RT-03 attributes, hidden from `document.cookie` | RT-03 / SC1 | Needs a real sign-in | DevTools → Application → Cookies; console `document.cookie` lacks `tracker_rt` |
| 200 with tracker `aud`, `azp` = `ac19614d-…` | TOKEN-01 / SC2 | Needs a real Entra refresh token | Console snippet that prints only status, cache-control, `aud`, `azp`, `scp`, `exp` — never the token (D-16) |
| Rotation re-sets the cookie | TOKEN-04 / SC2 | Needs a real redeem | DevTools Network → response `set-cookie: tracker_rt=…; Path=/api/tracker; Max-Age=604800; HttpOnly; SameSite=lax` |
| 401 / 503 JSON responses, no redirect | TOKEN-02, TOKEN-03 / SC3 | Live route | `curl -si -X POST http://localhost:3000/api/tracker/token` with no cookies, with a garbage `tracker_rt`, and with `TRACKER_API_SCOPE` blanked |
| Sign-in with `TRACKER_RT_KEY` unset; sign-out clears both cookies | RT-04, RT-05 / SC4 | Live sign-in | User blanks the key, restarts dev, signs in, then signs out; DevTools cookie checks |
| Dashboard, Calculation, Quotes still work | SC5 | App regression | Open each page after sign-in |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
