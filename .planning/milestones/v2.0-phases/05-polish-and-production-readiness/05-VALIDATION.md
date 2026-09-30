---
phase: 5
slug: polish-and-production-readiness
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.4 (backend) + TypeScript build check (frontend) |
| **Config file** | `fastapi-project/pytest.ini` |
| **Quick run command** | `cd nextjs-project && npx tsc --noEmit` |
| **Full suite command** | `cd fastapi-project && python3 -m pytest tests/ -v && cd ../nextjs-project && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd nextjs-project && npx tsc --noEmit` (ensures no TypeScript errors from theme conversion)
- **After every plan wave:** Run full suite (backend tests + frontend build)
- **Before `/gsd:verify-work`:** Full suite must be green + manual visual inspection
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | UI-02 | manual | Browser: sort columns in AircraftTable | N/A | ⬜ pending |
| 05-01-02 | 01 | 1 | UI-02 | manual | Browser: sort columns in QuoteList | N/A | ⬜ pending |
| 05-01-03 | 01 | 1 | UI-02 | manual | Browser DevTools: check mobile layout | N/A | ⬜ pending |
| 05-02-01 | 02 | 1 | UI-03 | smoke | `cd nextjs-project && npm run build` | ✅ existing | ⬜ pending |
| 05-02-02 | 02 | 1 | UI-03 | manual | Browser: toggle dark/light/system, verify persistence | N/A | ⬜ pending |
| 05-02-03 | 02 | 1 | UI-03 | manual | Visual: all pages correct in light mode | N/A | ⬜ pending |
| 05-03-01 | 03 | 2 | DEPLOY | smoke | `cd nextjs-project && npm run build` | ✅ existing | ⬜ pending |
| 05-03-02 | 03 | 2 | DEPLOY | regression | `cd fastapi-project && python3 -m pytest tests/ -v` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Phase 5 is primarily frontend UI work (theme classes, sorting state) and deployment config. Existing backend tests cover regression. No new automated tests needed — changes are visual/behavioral and best verified manually.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Column sorting in AircraftTable | UI-02 | Client-side React state; visual verification | Click MSN/Type headers, verify sort order toggles |
| Column sorting in QuoteList | UI-02 | Client-side React state; visual verification | Click Quote#/Client/Status/Created headers, verify sort |
| Mobile responsive tables | UI-02 | Responsive layout requires visual inspection | Open DevTools, set to mobile viewport, verify usability |
| Theme toggle cycles | UI-03 | Theme switching requires visual verification | Click toggle, verify dark→light→system cycle |
| Theme persists on refresh | UI-03 | localStorage persistence is browser-specific | Set theme, refresh page, verify theme matches |
| All pages correct in light mode | UI-03 | 38 files with hardcoded colors; visual inspection | Navigate all pages in light mode, check readability |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: build check after every task prevents silent breakage
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
