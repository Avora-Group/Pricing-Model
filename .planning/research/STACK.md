# Stack Research — v2.0 Dashboard & Project Pipeline

**Domain:** ACMI pricing platform — v2.0 metrics Dashboard, project status lifecycle, quote→project linkage (subsequent milestone on a shipped app)
**Researched:** 2026-06-05
**Confidence:** HIGH

> Scope note: This file covers ONLY the v2.0 milestone additions. The validated v1.0 foundational stack lives in `.planning/research/STACK.md` and is NOT re-researched here.

## Headline: No new dependencies required

The v2.0 features (metrics Dashboard, project status lifecycle, quote→project linkage) can be built entirely on the **already-installed** stack. The single decision a dashboard usually forces — "which charting library?" — is **already resolved**: `recharts@3.8.0` is installed and in active production use (`src/components/sensitivity/SensitivityChart.tsx`) with a working next-themes dark/light pattern. There is nothing to add.

> Stack-drift note: the milestone brief described the frontend as Next.js 14 / Tailwind v3. The actual installed stack (verified from `nextjs-project/package.json`) is **Next.js 16.1.6, React 19.2.3, Tailwind v4, recharts 3.8.0**. This research is based on the real `package.json`, not the brief. Conclusions are unaffected — recharts works on this stack today.

## Recommended Stack (all already installed)

### Core Technologies

| Technology | Version (installed) | Purpose | Why Recommended |
|------------|--------------------|---------|-----------------|
| Next.js | 16.1.6 (App Router) | Dashboard route + SSR data fetch | Already the app framework; new Dashboard is a read-only server-rendered page fed by FastAPI, identical pattern to existing `(dashboard)/dashboard/page.tsx` |
| React | 19.2.3 | UI | Already in use; recharts 3.x is React 19-compatible in this tree (see Version Compatibility) |
| recharts | 3.8.0 | Pipeline / revenue / utilization / rate charts | **Already installed and proven** in `SensitivityChart.tsx`; SVG-based, composable, integrates with next-themes via `resolvedTheme` color props. Latest is 3.8.1 — no upgrade needed |
| Tailwind CSS | v4 | Layout, StatCard grid, theming | Already the styling system; dark/light via `dark:` variants throughout existing components |
| next-themes | 0.4.6 | Dark/light theme for charts | Already wired; the mounted-guard + `resolvedTheme` chart-color pattern already exists and should be copied verbatim |
| Zustand | 5.0.11 | Client state (dashboard filters, if any) | Already the state lib; the Dashboard is mostly read-only so client state needs are minimal |
| asyncpg + BaseRepository | (backend) | Aggregation queries for metrics + status writes | Metrics = SQL aggregates (`COUNT FILTER`, `SUM`, `GROUP BY status`); raw SQL is the right tool, no new layer needed |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 (installed) | Validate dashboard API responses + status-transition payloads | Reuse for the new `/dashboard/metrics` response shape and the project status `PATCH` body |
| lucide-react | 0.577.0 (installed) | Icons for StatCards / status indicators | Reuse existing icon set for pipeline / fleet / margin cards |

Nothing needs to be **added**. Currency math stays on Python `Decimal`/`NUMERIC` on the backend; the frontend only formats already-computed numbers (existing `€${value.toFixed(2)}` pattern).

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 9 / eslint-config-next 16.1.6 | Lint | Already configured; no change |
| TypeScript 5 | Types | Add interfaces (`DashboardMetrics`, `ProjectStatus`, `PipelineSummary`) — code, not tooling |

## Installation

```bash
# Nothing to install. All required packages are already in nextjs-project/package.json.
# Verify only:
cd nextjs-project && npm ls recharts next-themes zustand zod
# expected: recharts@3.8.0  next-themes@0.4.6  zustand@5.0.11  zod@4.3.6
```

## Reusable Patterns Already in the Codebase

These are not new dependencies — they are existing code to copy, which is precisely why no additions are needed:

- **Dark-mode chart colors** — `src/components/sensitivity/SensitivityChart.tsx`: `'use client'` + `useTheme()` + `mounted` guard, deriving `gridStroke` / `axisStroke` / `tooltipBg` from `isDark`. Copy this exactly for every Dashboard chart (bar / pie / line).
- **Status pills** — `src/components/quotes/StatusBadge.tsx`: a `Record<string, string>` of Tailwind dark/light classes (`draft`/`sent`/`accepted`/`rejected`). Extend or clone with `potential` / `signed` styles for project status. No component library needed.
- **SSR data fetch with auth cookie** — `(dashboard)/dashboard/page.tsx`: server component reading the `access_token` cookie, `fetch` to FastAPI with `cache: 'no-store'`. Reuse for the new Dashboard's `/dashboard/metrics` call and for project lists.
- **ResponsiveContainer** — already used; gives responsive charts inside Tailwind grid cells without extra config.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| recharts 3.8.0 (already in) | Tremor (Tailwind-native dashboard kit) | Only if starting fresh with no chart lib; here it duplicates recharts and adds a dependency for zero benefit. **Reject.** |
| recharts 3.8.0 | visx / D3 | Only for highly custom/novel visualizations; overkill for counts, pipeline bars, utilization, and rate trends. **Reject.** |
| recharts 3.8.0 | Chart.js + react-chartjs-2 | Canvas-based; would not reuse the existing SVG/next-themes pattern and adds a new dep. **Reject.** |
| Extend `StatusBadge` | shadcn/ui Badge or a UI kit | Existing bespoke badge already covers the need; a component library is disproportionate. **Reject.** |
| Plain server-component metrics fetch | Server Actions / tRPC / React Query / SWR | App already fetches in server components against FastAPI; a data-fetching layer is unnecessary scope. **Reject.** |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new charting library (Tremor, Chart.js, visx, ECharts, Nivo) | recharts is installed, proven, and theme-integrated here; a second lib means bundle bloat + two divergent patterns | Reuse `recharts@3.8.0` + copy the `SensitivityChart` theming pattern |
| A component/UI kit (shadcn, MUI, Mantine) for StatCard/StatusBadge | The AeroVista-style StatCard/StatusBadge/DataTable patterns already exist as bespoke Tailwind components | Extend existing `StatusBadge.tsx`, `ui/TableParts.tsx`, `ui/table-styles.ts` |
| A frontend money/decimal library (dinero.js, big.js) | All monetary math stays on the backend in Python `Decimal`/`NUMERIC`; frontend only displays | Format with the existing `Number(v).toFixed(2)` + `€` pattern; keep contract-value math (EUR/BH × MGH × period months) server-side |
| React Query / SWR / tRPC | The app's data-fetch convention is server-component `fetch` to FastAPI; a client cache layer fragments the pattern | Server-component `fetch` with `cache: 'no-store'` (existing pattern) |
| An ORM / query builder for the aggregation queries | Backend mandates raw SQL via BaseRepository; metrics are simple aggregates | Raw SQL `SELECT ... GROUP BY status` / `SUM` in a new `DashboardRepository` |

## Stack Patterns by Variant

**If Dashboard charts must render in dark mode without a flash:**
- Use the `mounted` guard from `SensitivityChart.tsx` (`isDark = !mounted || resolvedTheme === 'dark'`)
- Because chart color props are computed at render and next-themes resolves theme only after hydration; the guard defaults to dark to avoid a light flash.

**If metrics aggregation gets heavy (many projects/MSNs):**
- Push all aggregation into SQL (`COUNT(*) FILTER (WHERE status='signed')`, `SUM(eur_bh * mgh * period_months)`), return a single computed payload
- Because per-row math in Python/TS loses `Decimal` precision guarantees and the DB does grouped aggregates faster.

**If project status must stay authoritative across quote acceptance + manual override:**
- Status lives on `pricing_projects` (per Key Decisions); accepted-quote auto-sign is a backend write, manual override is a separate `PATCH`
- Because the source of truth is one column; both paths write the same field and the frontend just reflects it. No new client state library needed.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| recharts@3.8.0 | React 19.2.3 | Compatible in this project's lockfile: the transitive `react-is` constraint already resolves to `^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19`, so **no `overrides`/`resolutions` workaround is needed here**. Public guidance about pinning `react-is` for React 19 does not apply to this tree. Verified: `SensitivityChart` renders in production. |
| recharts@3.8.0 → 3.8.1 | React 19 / Next 16 | Latest is 3.8.1 (patch). Upgrade is optional and out of scope for v2.0; 3.8.0 is fine. |
| recharts@3.x | Next.js 16 App Router | Works as a client component (`'use client'`) inside server-rendered pages — exactly the existing setup. Charts must NOT be server components (they use state/effects/browser APIs). |
| next-themes@0.4.6 | Next 16 / React 19 | Already integrated app-wide via `ThemeToggle.tsx`. |
| Tailwind v4 | Existing `dark:` variants | Dashboard styling uses the same `dark:` utility classes already throughout the app. |

## Sources

- `nextjs-project/package.json` + `npm ls recharts` — installed stack (HIGH): recharts 3.8.0, next-themes 0.4.6, zustand 5.0.11, zod 4.3.6, Next 16.1.6, React 19.2.3, Tailwind v4
- `package-lock.json` (`react-is` constraint resolves to include `^19.0.0`) — confirms no React 19 override needed in this tree (HIGH)
- `src/components/sensitivity/SensitivityChart.tsx` — proven recharts + next-themes dark/light pattern to reuse (HIGH)
- `src/components/quotes/StatusBadge.tsx` — existing status-pill pattern to extend for project status (HIGH)
- `src/app/(dashboard)/dashboard/page.tsx` — existing SSR + auth-cookie fetch pattern for the metrics page (HIGH)
- `npm view recharts version` → 3.8.1 latest; [recharts npm](https://www.npmjs.com/package/recharts), [recharts releases](https://github.com/recharts/recharts/releases) (HIGH)
- [LogRocket — Best React chart libraries 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/) — "recharts is still the most practical default" for React 19 / App Router dashboards (MEDIUM)
- [recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide), [Discussion #5698](https://github.com/recharts/recharts/discussions/5698) — React 19 / react-is context (MEDIUM)

---
*Stack research for: ACMI pricing platform v2.0 Dashboard & Project Pipeline*
*Researched: 2026-06-05*
