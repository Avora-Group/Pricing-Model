---
phase: "12"
slug: "refresh-token-capture-and-token-route"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| **Full suite command** | `cd nextjs-project && node --test "tests/*.test.mjs"` (baseline 22 before this phase; 141 pass, 0 fail at f545121) |
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

Requirement → task → check mapping (updated 2026-10-01 after the code-review fixes; WR-01..03 and IN-01..05 added `rt-oauth-flow.test.mjs` and `rt-token-route.test.mjs`):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-T1 | 12-01 | 1 | RT-01 | — | Both auth routes request `openid email profile offline_access` | static | `node --test tests/rt-wiring.test.mjs` | ✅ | ✅ green |
| 12-01-T1 | 12-01 | 1 | RT-02 | — | Callback seals `{ rt, sub, sexp }` as `dir`/`A256GCM` JWE; exp = min(+7 d, session exp) (WR-01) | unit + static | `node --test tests/rt-helper.test.mjs tests/rt-wiring.test.mjs` | ✅ | ✅ green |
| 12-01-T1 | 12-01 | 1 | RT-03 | — | Cookie `httpOnly`, `sameSite: lax`, Max-Age capped at the session, path `/api/tracker`, secure in prod; options frozen (IN-02) | unit | `node --test tests/rt-helper.test.mjs` | ✅ | ✅ green |
| 12-01-T2 | 12-01 | 1 | RT-04 | — | Logout deletes `tracker_rt` on path `/api/tracker` | unit + static | `node --test tests/rt-helper.test.mjs tests/rt-wiring.test.mjs` | ✅ | ✅ green |
| 12-01-T1/T2 | 12-01 | 1 | RT-05 | — | Unset or malformed key (strict 43-char base64url, IN-01), no sub, no refresh token or oversized → no cookie, sign-in unaffected | unit | `node --test tests/rt-helper.test.mjs` | ✅ | ✅ green |
| 12-02-T1 | 12-02 | 2 | TOKEN-01 | — | 200 `{accessToken, expiresAt}`, `no-store` (behavioural since IN-03) | unit + integration | `node --test tests/rt-token-route.test.mjs` + `node tests/rt-route-smoke.mjs` | ✅ | ✅ green |
| 12-02-T1 | 12-02 | 2 | TOKEN-02 | — | No/expired `access_token` → 401 reauth JSON, never a redirect, no Entra call | unit + integration | `node --test tests/rt-token-route.test.mjs tests/rt-wiring.test.mjs` | ✅ | ✅ green |
| 12-02-T2 | 12-02 | 2 | TOKEN-03 | — | Bad / foreign `tracker_rt` → 401 reauth + cleared; unset scope/key → 503 before the session; logs carry codes only | unit + integration | `node --test tests/rt-token-route.test.mjs tests/rt-helper.test.mjs` | ✅ | ✅ green |
| 12-02-T2 | 12-02 | 2 | TOKEN-04 | — | Rotation re-seals with the same sub and original deadline, size-guarded (WR-01, WR-02) | unit | `node --test tests/rt-token-route.test.mjs` | ✅ | ✅ green |
| review-fix | WR-03 | — | (hardening) | — | OAuth `state` nonce + PKCE S256, flow cookie deleted on every answer, constant-time nonce match | unit + static | `node --test tests/rt-oauth-flow.test.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `nextjs-project/tests/rt-helper.test.mjs` — RT-02, RT-03, RT-05, TOKEN-02, TOKEN-03 (helper decisions)
- [x] `nextjs-project/tests/rt-wiring.test.mjs` — RT-01, RT-04, TOKEN-01..04 (static wiring)
- No framework install: `node:test` is built in and `jose` resolves from `tests/` through the project `node_modules`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Entra `offline_access` admin consent on `ac19614d-…` | D-11 | Portal state | Human checkpoint before UAT 1; stop on any consent screen or AADSTS65001 / AADSTS90094 |
| `tracker_rt` present with RT-03 attributes, hidden from `document.cookie` | RT-03 / SC1 | Needs a real sign-in | DevTools → Application → Cookies; console `document.cookie` lacks `tracker_rt` |
| 200 with tracker `aud`, `azp` = `ac19614d-…` | TOKEN-01 / SC2 | Needs a real Entra refresh token | Console snippet that prints only status, cache-control, `aud`, `azp`, `scp`, `exp` — never the token (D-16) |
| Rotation re-sets the cookie | TOKEN-04 / SC2 | Needs a real redeem | DevTools Network → response `set-cookie: tracker_rt=…; Path=/api/tracker; HttpOnly; SameSite=lax`, expiry not moved past the sign-in deadline |
| 401 / 503 JSON responses, no redirect | TOKEN-02, TOKEN-03 / SC3 | Live route | `curl -si -X POST http://localhost:3001/api/tracker/token` with no cookies, with a garbage `tracker_rt`, and with `TRACKER_API_SCOPE` blanked |
| Sign-in with `TRACKER_RT_KEY` unset; sign-out clears both cookies | RT-04, RT-05 / SC4 | Live sign-in | User blanks the key, restarts dev, signs in, then signs out; DevTools cookie checks |
| Dashboard, Calculation, Quotes still work | SC5 | App regression | Open each page after sign-in |

All manual-only items were exercised in `12-UAT.md` (2026-10-01, 18/18 pass, commit b732b5f).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-01

---

## Validation Audit 2026-10-01

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Full suite `node --test "tests/*.test.mjs"`: 141 pass, 0 fail (rt-helper 43, rt-wiring 17, rt-oauth-flow 13, rt-token-route 9, plus Phase 11's checks).
