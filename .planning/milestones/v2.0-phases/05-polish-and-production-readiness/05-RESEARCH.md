# Phase 5: Polish and Production Readiness - Research

**Researched:** 2026-03-10
**Domain:** UI theming (Tailwind v4 dark/light mode), table sorting, responsive tables, deployment (Vercel + Railway)
**Confidence:** HIGH

## Summary

Phase 5 covers three distinct areas: (1) adding column sorting to AircraftTable and QuoteList with mobile responsiveness, (2) implementing dark/light/system theme toggle using `next-themes` with Tailwind CSS v4's `@custom-variant` directive, and (3) configuring production deployment with Vercel for the Next.js frontend and Railway for the FastAPI backend with PostgreSQL. UI-04 (dashboard stats) was dropped by the user.

The most substantial work is the theme conversion: 27 component files plus 4 page/layout files contain hardcoded dark-theme colors (gray-900/800/700, text-gray-100/200/300/400/500) totaling ~335 individual class occurrences. This requires a systematic CSS variable approach in globals.css and converting all hardcoded gray classes to `dark:` / light equivalent pairs. The `next-themes` library (v0.4.6) is the standard solution for Next.js App Router theme management with flash-free hydration.

**Primary recommendation:** Use `next-themes` with Tailwind v4 `@custom-variant dark` for theme switching. Implement sorting with plain React state (no library needed for 2 tables with 2-4 sortable columns each). Deploy with Vercel's monorepo root directory setting for frontend and a simple Dockerfile with gunicorn+uvicorn workers for Railway backend.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Sortable tables -- data tables only:** Only AircraftTable and QuoteList get column sorting. P&L, Crew Config, Costs Config, EPR Matrix, and Sensitivity tables stay as-is.
- **Sortable columns (key columns only):**
  - AircraftTable: MSN, Type (skip rate columns)
  - QuoteList: Quote #, Client, Status, Created date
- **Detail panes:** Keep current full-page navigation (clicking aircraft row goes to /aircraft/[msn]). No slide-over or modal behavior needed.
- **Mobile responsive:** Tables must be usable on mobile phone screens. Hide less important columns at small breakpoints, improve spacing/padding, maintain horizontal scroll fallback.
- **Dark/light mode -- three states with localStorage:** Dark / Light / System (follows OS prefers-color-scheme). Default to System on first visit.
- **Persistence:** Per-browser using Zustand persist middleware with localStorage (same pattern as sidebar-store). No backend changes needed.
- **Implementation note:** Currently 100% hardcoded dark colors (gray-900/800/700). Tailwind v4 with inline theme in globals.css. Need to convert hardcoded colors to theme-aware classes across all components.
- **Dashboard stats -- DROPPED:** UI-04 requirement is skipped. Dashboard remains the pricing workspace.
- **Deployment -- Vercel + Railway:**
  - Frontend (Next.js): Deploy to Vercel. Auto-deploys from GitHub.
  - Backend (FastAPI + PostgreSQL): Deploy to Railway. Container-based with managed PostgreSQL.
  - Phase deliverables: Dockerfiles, environment variable configuration, production build settings, Railway/Vercel config files.

### Claude's Discretion
- Theme toggle placement (sidebar footer vs top bar)
- Light mode color palette design
- Mobile responsive breakpoints and column hiding strategy
- Sorting visual indicators (arrows, highlighting)
- Specific Railway configuration (Procfile, nixpacks, etc.)
- Docker multi-stage build optimization

### Deferred Ideas (OUT OF SCOPE)
- Dashboard stats (UI-04) -- user explicitly dropped this. Could be revisited in a future iteration if needed.
- Detail panes without full-page navigation -- user chose to keep current full-page nav behavior.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-02 | Data displayed in responsive, sortable tables with detail panes | Sorting pattern (React useState), responsive table strategy (column hiding + horizontal scroll), existing AircraftTable and QuoteList analyzed |
| UI-03 | Dark/light mode toggle persisted per user | next-themes library, Tailwind v4 @custom-variant dark, CSS variable approach, theme-store pattern, full component audit (27 files + 4 pages) |
| UI-04 | Dashboard shows summary stats | DROPPED by user -- not implemented |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-themes | ^0.4.6 | Theme provider for Next.js App Router | De facto standard for Next.js dark mode. Handles FOUC prevention, system preference detection, localStorage persistence, and hydration-safe rendering. 8M+ weekly downloads |
| tailwindcss | ^4 (already installed) | CSS framework with `@custom-variant dark` | Already in use. v4 uses CSS-first config with `@custom-variant` for class-based dark mode |
| zustand | ^5.0.11 (already installed) | State management | Already used for sidebar-store, pricing-store. NOT needed for theme (next-themes handles persistence) |
| lucide-react | ^0.577.0 (already installed) | Icons for theme toggle (Sun, Moon, Monitor) | Already in use for all icons in the app |

### Supporting (Deployment)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gunicorn | latest | Production WSGI server for FastAPI | Railway deployment -- runs uvicorn workers behind gunicorn process manager |
| Docker | - | Containerize FastAPI backend | Railway deployment uses Dockerfile builder |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-themes | Custom Zustand theme store + inline script | next-themes handles FOUC, system preference listeners, SSR hydration -- reimplementing is error-prone |
| Gunicorn + Uvicorn | Hypercorn | Gunicorn with UvicornWorker is the most documented pattern for FastAPI production; Hypercorn also works but less ecosystem support |
| Railway Dockerfile | Railway Nixpacks | Dockerfile gives explicit control over build; Nixpacks can have PATH issues with uvicorn |

**Installation:**
```bash
# Frontend (nextjs-project/)
npm install next-themes

# Backend (fastapi-project/) -- add to requirements.txt
pip install gunicorn
```

## Architecture Patterns

### Recommended Project Structure (new/modified files)
```
nextjs-project/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # MODIFY: wrap with ThemeProvider, add suppressHydrationWarning
│   │   └── globals.css                   # MODIFY: add @custom-variant dark, CSS variables, light theme
│   ├── components/
│   │   └── ui/
│   │       └── ThemeToggle.tsx            # NEW: dark/light/system toggle component
│   └── providers/
│       └── ThemeProvider.tsx              # NEW: client-component wrapper for next-themes
│
fastapi-project/
├── Dockerfile                             # NEW: production container config
├── .dockerignore                          # NEW: exclude tests, __pycache__, .env
└── railway.json                           # NEW: Railway deployment settings

# Root level
├── vercel.json                            # NEW (optional): monorepo root directory config
```

### Pattern 1: Tailwind v4 Class-Based Dark Mode with next-themes
**What:** Configure Tailwind v4 to use class-based dark mode via `@custom-variant`, then let `next-themes` manage the `.dark` class on `<html>`.
**When to use:** Any Next.js + Tailwind v4 app that needs user-controllable dark/light/system theme.
**Example:**
```css
/* globals.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

/* Light mode (default) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;     /* gray-50 */
  --bg-tertiary: #f3f4f6;      /* gray-100 */
  --border-primary: #e5e7eb;   /* gray-200 */
  --border-secondary: #d1d5db; /* gray-300 */
  --text-primary: #111827;     /* gray-900 */
  --text-secondary: #374151;   /* gray-700 */
  --text-tertiary: #6b7280;    /* gray-500 */
  --text-muted: #9ca3af;       /* gray-400 */
}

/* Dark mode */
.dark {
  --bg-primary: #030712;       /* gray-950 */
  --bg-secondary: #111827;     /* gray-900 */
  --bg-tertiary: #1f2937;      /* gray-800 */
  --border-primary: #1f2937;   /* gray-800 */
  --border-secondary: #374151; /* gray-700 */
  --text-primary: #f3f4f6;    /* gray-100 */
  --text-secondary: #d1d5db;   /* gray-300 */
  --text-tertiary: #9ca3af;    /* gray-400 */
  --text-muted: #6b7280;       /* gray-500 */
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
}
```

```tsx
// src/providers/ThemeProvider.tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

```tsx
// src/app/layout.tsx
import { ThemeProvider } from '@/providers/ThemeProvider'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Pattern 2: Converting Hardcoded Dark Classes to Theme-Aware
**What:** Replace hardcoded gray-900/800/700 backgrounds and gray-100/200/300/400/500 text colors with Tailwind `dark:` variant pairs.
**When to use:** Every component and page with hardcoded dark colors.
**Example:**
```tsx
// BEFORE (hardcoded dark only):
<div className="bg-gray-900 border border-gray-800 rounded-lg">
  <h2 className="text-gray-100">Title</h2>
  <p className="text-gray-400">Description</p>
  <input className="bg-gray-800 border border-gray-700 text-gray-100" />
</div>

// AFTER (theme-aware):
<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
  <h2 className="text-gray-900 dark:text-gray-100">Title</h2>
  <p className="text-gray-500 dark:text-gray-400">Description</p>
  <input className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100" />
</div>
```

**Color mapping table (dark -> light equivalents):**
| Dark Mode Class | Light Mode Equivalent | Usage |
|-----------------|----------------------|-------|
| `bg-gray-950` / `bg-[#030712]` | `bg-white` | Page/app background |
| `bg-gray-900` | `bg-white` or `bg-gray-50` | Card/panel backgrounds |
| `bg-gray-800` | `bg-gray-50` or `bg-gray-100` | Input backgrounds, hover states |
| `bg-gray-800/50` (hover) | `bg-gray-100` (hover) | Table row hover |
| `border-gray-800` | `border-gray-200` | Card/panel borders |
| `border-gray-700` | `border-gray-300` | Input borders |
| `text-gray-100` | `text-gray-900` | Primary text (headings) |
| `text-gray-200` | `text-gray-800` | Secondary text |
| `text-gray-300` | `text-gray-700` | Tertiary text |
| `text-gray-400` | `text-gray-500` | Muted/label text |
| `text-gray-500` | `text-gray-400` | Placeholder text |
| `placeholder-gray-500` | `placeholder-gray-400` | Input placeholders |

### Pattern 3: Simple Table Column Sorting (no library needed)
**What:** useState-based sorting with sort key + direction toggle.
**When to use:** Tables with <10 sortable columns and client-side data.
**Example:**
```tsx
type SortKey = 'msn' | 'aircraft_type'
type SortDir = 'asc' | 'desc'

const [sortKey, setSortKey] = useState<SortKey>('msn')
const [sortDir, setSortDir] = useState<SortDir>('asc')

const sorted = [...filtered].sort((a, b) => {
  const aVal = a[sortKey]
  const bVal = b[sortKey]
  if (aVal == null) return 1
  if (bVal == null) return -1
  const cmp = typeof aVal === 'number'
    ? aVal - (bVal as number)
    : String(aVal).localeCompare(String(bVal))
  return sortDir === 'asc' ? cmp : -cmp
})

const handleSort = (key: SortKey) => {
  if (sortKey === key) {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  } else {
    setSortKey(key)
    setSortDir('asc')
  }
}

// In thead:
<th onClick={() => handleSort('msn')} className="cursor-pointer select-none">
  MSN {sortKey === 'msn' && (sortDir === 'asc' ? '\u25B2' : '\u25BC')}
</th>
```

### Pattern 4: Theme Toggle Component
**What:** Three-way toggle button using next-themes' `useTheme` hook with Sun/Moon/Monitor icons.
**When to use:** Placed in sidebar footer or top bar.
**Recommendation:** Place in the **sidebar footer** -- it is always visible, does not crowd the TopBar, and follows the pattern of user-preference controls being in the sidebar.
**Example:**
```tsx
'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null // Prevent hydration mismatch

  const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`p-1.5 rounded-md transition-colors ${
            theme === value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          aria-label={label}
          title={label}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
```

### Pattern 5: Responsive Tables with Column Hiding
**What:** Use Tailwind responsive utilities to hide non-essential columns at small breakpoints while maintaining horizontal scroll as fallback.
**When to use:** AircraftTable (11 columns -- many should hide on mobile) and QuoteList (7 columns).
**Example:**
```tsx
// AircraftTable: hide rate columns on mobile, show MSN + Type + Registration
<th className="hidden md:table-cell">Lease Rent (USD)</th>  {/* hidden below md */}

// QuoteList: hide Rate and MSNs columns on mobile
<th className="hidden sm:table-cell">Rate</th>
<th className="hidden sm:table-cell">MSNs</th>

// The table wrapper keeps overflow-x-auto as fallback:
<div className="overflow-x-auto">
  <table className="w-full text-sm min-w-[600px]">  {/* min-width prevents squishing */}
```

### Anti-Patterns to Avoid
- **Replacing each gray class individually without a mapping:** Creates inconsistent light theme. Define the mapping table first, then apply systematically file by file.
- **Using CSS variables in Tailwind classes for every color:** Overcomplicates; use standard `dark:` variant pairs for most cases, CSS variables only for body/globals.
- **Adding `dark:` classes but leaving hardcoded dark backgrounds as defaults:** Will break light mode. The light variant must be the default (no prefix), dark variant uses `dark:` prefix.
- **Skipping `suppressHydrationWarning` on `<html>`:** Will cause React hydration warnings because next-themes modifies the element before React hydrates.
- **Mounting theme toggle without hydration guard:** `useTheme()` returns undefined on server render. Must use `useEffect` + `mounted` state pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme flash prevention (FOUC) | Custom inline script in `<head>` | `next-themes` ThemeProvider | Handles blocking script injection, localStorage read, matchMedia listener, and SSR hydration. Extremely error-prone to build correctly |
| System preference detection | `window.matchMedia` listener + cleanup | `next-themes` `enableSystem` prop | Handles matchMedia listener lifecycle, fallback, cross-browser compat |
| Theme persistence | Custom Zustand persist store | `next-themes` built-in localStorage | next-themes already uses localStorage with configurable storageKey. Adding Zustand persist would create dual-source-of-truth |
| Table sorting library | Custom hook library | Plain `useState` + `Array.sort()` | Only 2 tables with 2-4 sortable columns each. A library (TanStack Table) is overkill for this scope |

**Key insight:** The CONTEXT.md mentioned using Zustand persist for theme (same pattern as sidebar-store), but `next-themes` already handles localStorage persistence. Using both would be redundant. `next-themes` is the single source of truth for theme state. The `useTheme()` hook replaces any need for a Zustand theme store.

## Common Pitfalls

### Pitfall 1: Tailwind v4 Dark Mode Config Mismatch
**What goes wrong:** `dark:` variant classes have no effect because Tailwind v4 defaults to `prefers-color-scheme` (media query), not class-based detection.
**Why it happens:** In Tailwind v3, you set `darkMode: 'class'` in tailwind.config.js. In v4, there is no config file. You must add `@custom-variant dark (&:where(.dark, .dark *));` in your CSS file.
**How to avoid:** Add the `@custom-variant dark` line in globals.css BEFORE any component conversion. Test by manually adding `.dark` class to `<html>` and verifying a `dark:bg-red-500` class works.
**Warning signs:** Classes like `dark:bg-gray-900` have no effect in the browser. Inspecting shows the media query variant instead of class variant.

### Pitfall 2: Flash of Wrong Theme (FOUC)
**What goes wrong:** Page briefly shows light theme then snaps to dark (or vice versa) on load.
**Why it happens:** Server renders without knowing the user's theme preference. The theme class gets applied after JavaScript hydration, causing a visible flash.
**How to avoid:** `next-themes` injects a blocking `<script>` before React hydration that reads localStorage and applies the correct class immediately. Ensure `<html>` has `suppressHydrationWarning` and ThemeProvider wraps the body content.
**Warning signs:** Visible color flash on page load/refresh, especially noticeable in dark mode.

### Pitfall 3: Incomplete Theme Conversion
**What goes wrong:** Some components still show dark colors in light mode because not all hardcoded classes were converted.
**Why it happens:** 335 individual color class occurrences across 27+ files. Easy to miss some.
**How to avoid:** Use the complete file list (documented below in Code Examples section). Process each file systematically using the color mapping table. After conversion, test by toggling to light mode and visually inspecting every page.
**Warning signs:** Individual cards, inputs, or text appearing dark-on-dark in light mode.

### Pitfall 4: Recharts Not Respecting Theme
**What goes wrong:** The SensitivityChart component uses Recharts which may have hardcoded colors for grid lines, labels, tooltips.
**Why it happens:** Recharts uses its own color system, not Tailwind classes. Theme changes don't automatically propagate.
**How to avoid:** Use CSS variables or `useTheme()` hook to dynamically set Recharts stroke/fill colors. Or use `currentColor` for Recharts label styling.
**Warning signs:** Chart appears with light grid lines on light background (invisible) or dark elements on dark background.

### Pitfall 5: Railway PORT Environment Variable
**What goes wrong:** Application starts but is not reachable publicly.
**Why it happens:** Railway injects a `PORT` environment variable. If uvicorn/gunicorn binds to a hardcoded port (e.g., 8000) instead of `$PORT`, the app is unreachable.
**How to avoid:** Always use `--port $PORT` in the start command. Default to 8000 for local development: `${PORT:-8000}`.
**Warning signs:** Deployment succeeds but health checks fail; "Service is not responding" in Railway dashboard.

### Pitfall 6: Vercel Monorepo Root Directory
**What goes wrong:** Vercel tries to build from repo root, fails because package.json is in `nextjs-project/` subdirectory.
**Why it happens:** Repo has `fastapi-project/` and `nextjs-project/` as sibling directories, not a standard monorepo layout.
**How to avoid:** In Vercel project settings, set "Root Directory" to `nextjs-project`. Or add vercel.json at repo root.
**Warning signs:** Build fails with "No Next.js version detected" or "package.json not found".

## Code Examples

### Complete File Inventory for Theme Conversion

**27 component files + 11 page/layout files = 38 total files need dark: variant pairs:**

Components (27):
1. `src/components/sidebar/Sidebar.tsx` (6 occurrences)
2. `src/components/layout/TopBar.tsx` (3)
3. `src/components/ui/PlaceholderPage.tsx` (2)
4. `src/components/aircraft/AircraftTable.tsx` (26)
5. `src/components/aircraft/AircraftDetail.tsx` (12)
6. `src/components/aircraft/RatesSection.tsx` (12)
7. `src/components/aircraft/CreateAircraftDialog.tsx` (15)
8. `src/components/aircraft/EprMatrixTable.tsx` (27)
9. `src/components/costs/CostsConfigTable.tsx` (21)
10. `src/components/crew/CrewConfigTable.tsx` (41)
11. `src/components/pricing/DashboardSummary.tsx` (13)
12. `src/components/pricing/MsnInputRow.tsx` (8)
13. `src/components/pricing/MsnSwitcher.tsx` (2)
14. `src/components/pricing/MarginInput.tsx` (5)
15. `src/components/pricing/PnlTable.tsx` (28)
16. `src/components/pricing/PnlView.tsx` (2)
17. `src/components/pricing/SummaryTable.tsx` (17)
18. `src/components/quotes/QuoteList.tsx` (13)
19. `src/components/quotes/SaveQuoteDialog.tsx` (8)
20. `src/components/quotes/StatusBadge.tsx` (2)
21. `src/components/sensitivity/SensitivityTable.tsx` (11)
22. `src/components/sensitivity/SensitivityView.tsx` (3)
23. `src/components/sensitivity/SensitivityChart.tsx` (2)
24. `src/components/sensitivity/ParameterPicker.tsx` (2)

Pages/Layouts (11):
25. `src/app/globals.css` (body colors)
26. `src/app/layout.tsx` (ThemeProvider wrapper)
27. `src/app/(auth)/login/page.tsx` (7 -- includes bg-[#030712])
28. `src/app/(dashboard)/layout.tsx` (1 -- bg-gray-950)
29. `src/app/(dashboard)/dashboard/page.tsx` (text colors)
30. `src/app/(dashboard)/aircraft/page.tsx` (text colors)
31. `src/app/(dashboard)/aircraft/[msn]/page.tsx` (text + bg colors)
32. `src/app/(dashboard)/quotes/page.tsx` (text colors)
33. `src/app/(dashboard)/quotes/[id]/page.tsx` (text + bg colors)
34. `src/app/(dashboard)/quotes/[id]/QuoteDetailClient.tsx` (27 -- heaviest page)
35. `src/app/(dashboard)/costs/page.tsx` (text colors)
36. `src/app/(dashboard)/crew/page.tsx` (text colors)
37. `src/app/(dashboard)/pnl/page.tsx` (text colors)
38. `src/app/(dashboard)/sensitivity/page.tsx` (text colors)

### FastAPI Dockerfile for Railway
```dockerfile
# Multi-stage build for smaller production image
FROM python:3.12-slim AS builder

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt gunicorn

FROM python:3.12-slim

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

EXPOSE 8000

CMD gunicorn app.main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" \
    --timeout 120
```

### Railway Configuration
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "./Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

### .dockerignore
```
__pycache__
*.pyc
.env
.git
tests/
pytest.ini
*.md
.planning/
```

### Vercel Environment Variables Needed
```
API_URL=https://<railway-backend-url>   # Server-side only (no NEXT_PUBLIC_ prefix)
```

### Railway Environment Variables Needed
```
DATABASE_URL=postgresql://...           # Auto-populated by Railway PostgreSQL add-on
JWT_SECRET=<random-32-char-string>      # Generate securely
ENVIRONMENT=production                  # Enables cookie_secure=True
FRONTEND_URL=https://<vercel-domain>    # For CORS allow_origins
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `darkMode: 'class'` in tailwind.config.js | `@custom-variant dark (&:where(.dark, .dark *))` in CSS | Tailwind v4 (2025) | Config is now CSS-first; no tailwind.config.js needed |
| `next-themes` 0.2.x with pages router | `next-themes` 0.4.x with App Router + Server Components | 2024 | ThemeProvider must be a client component; `suppressHydrationWarning` on `<html>` |
| `tailwind.config.ts` for all config | `@theme inline { }` in globals.css | Tailwind v4 (2025) | Project already uses this pattern |
| Railway Nixpacks auto-detection | Dockerfile builder (recommended) | 2024-2025 | Nixpacks can have PATH issues with pip-installed binaries; Dockerfile gives explicit control |

**Deprecated/outdated:**
- `darkMode` config key in tailwind.config.js: Does not exist in Tailwind v4
- `next-themes` < 0.3: Does not support App Router properly
- Railway Procfile: Replaced by railway.json `startCommand` or Dockerfile CMD

## Open Questions

1. **Database migrations on Railway**
   - What we know: The app uses raw SQL migration files in `migrations/`. There is no migration runner (like Alembic).
   - What's unclear: How to run migrations on Railway deploy. Manual via Railway CLI? Startup script in Dockerfile?
   - Recommendation: Add a `scripts/migrate.py` or run migrations as part of Dockerfile CMD (before gunicorn starts). Or document as a manual step for initial deployment.

2. **Recharts theme integration**
   - What we know: SensitivityChart.tsx uses Recharts with potentially hardcoded colors for axes, grid, tooltips.
   - What's unclear: Exact Recharts color props used in the component.
   - Recommendation: Inspect SensitivityChart.tsx during implementation and pass theme-aware colors via `useTheme()`.

3. **Login page theming**
   - What we know: Login page uses `bg-[#030712]` hardcoded hex. It is outside the dashboard layout (no sidebar).
   - What's unclear: Whether login page should follow theme or always be dark for branding.
   - Recommendation: Make it theme-aware (consistent UX). The `@custom-variant` approach handles this automatically.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.4 (asyncio_mode=auto) |
| Config file | `fastapi-project/pytest.ini` |
| Quick run command | `cd fastapi-project && python -m pytest tests/ -x -q` |
| Full suite command | `cd fastapi-project && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-02 | AircraftTable sortable by MSN, Type | manual-only | Visual browser test -- sorting is client-side React state | N/A (frontend) |
| UI-02 | QuoteList sortable by Quote#, Client, Status, Created | manual-only | Visual browser test -- sorting is client-side React state | N/A (frontend) |
| UI-02 | Tables responsive on mobile | manual-only | Browser DevTools responsive mode inspection | N/A (frontend) |
| UI-03 | Theme toggle cycles dark/light/system | manual-only | Browser test -- click toggle, verify class on html element | N/A (frontend) |
| UI-03 | Theme persists across page refresh | manual-only | Set theme, refresh, verify localStorage and visual state | N/A (frontend) |
| UI-03 | All components render correctly in light mode | manual-only | Visual inspection of all pages in light mode | N/A (frontend) |
| DEPLOY | Backend health check responds 200 | smoke | `curl -f https://<railway-url>/health` | N/A (deployment) |
| DEPLOY | Frontend builds successfully | smoke | `cd nextjs-project && npm run build` | N/A (build) |
| DEPLOY | Existing backend tests still pass | regression | `cd fastapi-project && python -m pytest tests/ -x -q` | Existing |

### Sampling Rate
- **Per task commit:** `cd nextjs-project && npm run build` (ensures no TypeScript/build errors from theme conversion)
- **Per wave merge:** `cd fastapi-project && python -m pytest tests/ -v` + `cd nextjs-project && npm run build`
- **Phase gate:** Full backend test suite green + successful frontend build + manual visual inspection of all pages in both themes

### Wave 0 Gaps
- None -- this phase is primarily frontend UI work (theme classes, sorting state) and deployment config. Existing backend tests cover regression. No new automated tests needed as the changes are visual/behavioral and best verified manually.

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 Dark Mode Docs](https://tailwindcss.com/docs/dark-mode) - `@custom-variant dark` syntax, class-based and media-based configuration, JavaScript system preference code
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - ThemeProvider setup for App Router, `attribute="class"`, `enableSystem`, `suppressHydrationWarning`, useTheme hook API
- [Railway FastAPI Deployment Guide](https://docs.railway.com/guides/fastapi) - Deployment methods, railway.json configuration, start command with PORT

### Secondary (MEDIUM confidence)
- [Dark Mode Next.js 15 + Tailwind v4 Guide](https://www.sujalvanjare.com/blog/dark-mode-nextjs15-tailwind-v4) - Step-by-step integration of next-themes with Tailwind v4 @custom-variant, verified against official docs
- [FastAPI Dockerfile for Railway](https://www.codingforentrepreneurs.com/blog/deploy-fastapi-to-railway-with-this-dockerfile) - Multi-stage Dockerfile pattern, gunicorn+uvicorn worker config, PORT binding
- [Vercel Monorepo Docs](https://vercel.com/docs/monorepos) - Root directory configuration for subdirectory deployments
- [Next.js Environment Variables Docs](https://nextjs.org/docs/pages/guides/environment-variables) - NEXT_PUBLIC_ prefix rules, server-only variables

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - next-themes is the de facto standard for Next.js dark mode; Tailwind v4 @custom-variant is documented in official docs; deployment patterns verified against Railway/Vercel docs
- Architecture: HIGH - Pattern is well-documented across multiple verified sources; codebase fully audited with exact file list and occurrence counts
- Pitfalls: HIGH - All pitfalls sourced from official docs or verified community patterns (Tailwind v4 migration, FOUC prevention, Railway PORT binding)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable ecosystem -- Tailwind v4, next-themes 0.4.x, Railway/Vercel are mature)
