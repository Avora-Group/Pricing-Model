---
phase: 05-polish-and-production-readiness
plan: 01
subsystem: ui
tags: [next-themes, tailwind-v4, dark-mode, light-mode, theme-toggle, recharts]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Next.js app shell, layout, sidebar, login page"
  - phase: 02-aircraft-master-data
    provides: "Aircraft components (table, detail, rates, EPR matrix)"
  - phase: 03-pricing-engine
    provides: "Pricing components (P&L, summary, sensitivity, costs, crew)"
  - phase: 04-quote-persistence-and-history
    provides: "Quote components (list, detail, save dialog)"
provides:
  - "Dark/light/system theme toggle with next-themes"
  - "All 38+ component files converted to theme-aware dark: variant pairs"
  - "CSS variables for light/dark body styles in globals.css"
  - "ThemeProvider wrapping app with class-based dark mode"
  - "ThemeToggle component in sidebar footer"
affects: [05-02-table-sorting, 05-03-deployment]

# Tech tracking
tech-stack:
  added: [next-themes ^0.4.6]
  patterns: [Tailwind v4 @custom-variant dark, class-based dark mode, light-first defaults with dark: prefix]

key-files:
  created:
    - nextjs-project/src/providers/ThemeProvider.tsx
    - nextjs-project/src/components/ui/ThemeToggle.tsx
  modified:
    - nextjs-project/src/app/globals.css
    - nextjs-project/src/app/layout.tsx
    - nextjs-project/src/app/(auth)/login/page.tsx
    - nextjs-project/src/app/(dashboard)/layout.tsx
    - nextjs-project/src/components/sidebar/Sidebar.tsx
    - nextjs-project/src/components/layout/TopBar.tsx
    - "38+ component and page files (full theme conversion)"

key-decisions:
  - "Light mode is the DEFAULT (no prefix), dark mode uses dark: prefix -- reversed from original hardcoded dark-only"
  - "ThemeToggle placed in sidebar footer (always visible, follows user-preference-controls-in-sidebar pattern)"
  - "next-themes handles all persistence and system preference detection -- no Zustand store for theme"
  - "SensitivityChart uses useTheme() + resolvedTheme for Recharts inline color values"
  - "StatusBadge semantic colors get proper light variants (bg-blue-100/bg-green-100/bg-red-100)"

patterns-established:
  - "Theme-aware class pattern: bg-white dark:bg-gray-900 (light default, dark prefix)"
  - "Color mapping: gray-950->white, gray-900->white/gray-50, gray-800->gray-100, text-gray-100->text-gray-900"
  - "Recharts theme integration: useTheme + mounted guard + conditional color values"

requirements-completed: [UI-03]

# Metrics
duration: 8min
completed: 2026-03-10
---

# Phase 5 Plan 1: Dark/Light/System Theme Toggle Summary

**Dark/light/system theme toggle with next-themes, Tailwind v4 @custom-variant dark, and full 38-file component conversion from hardcoded dark to theme-aware classes**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-10T10:38:34Z
- **Completed:** 2026-03-10T10:46:34Z
- **Tasks:** 2
- **Files modified:** 42

## Accomplishments
- Installed next-themes and configured Tailwind v4 class-based dark mode with @custom-variant dark
- Created ThemeProvider wrapper and ThemeToggle component (Sun/Moon/Monitor segmented button in sidebar footer)
- Converted all 38+ component and page files from hardcoded dark-only colors to light-first defaults with dark: variant pairs
- SensitivityChart Recharts colors respond to theme via useTheme() hook with mounted guard
- StatusBadge semantic colors have proper light mode variants (blue-100, green-100, red-100)

## Task Commits

Each task was committed atomically:

1. **Task 1: Theme infrastructure and core layout conversion** - `9465693` (feat)
2. **Task 2: Convert all remaining components and pages to theme-aware classes** - `d413ffd` (feat)

## Files Created/Modified

**Created:**
- `nextjs-project/src/providers/ThemeProvider.tsx` - Client-component wrapper for next-themes
- `nextjs-project/src/components/ui/ThemeToggle.tsx` - Three-way dark/light/system toggle with Sun/Moon/Monitor icons

**Modified (core):**
- `nextjs-project/src/app/globals.css` - Added @custom-variant dark, CSS variables for light/dark, body uses variables
- `nextjs-project/src/app/layout.tsx` - ThemeProvider wrapping children, suppressHydrationWarning on html
- `nextjs-project/src/app/(auth)/login/page.tsx` - Theme-aware login form
- `nextjs-project/src/app/(dashboard)/layout.tsx` - Theme-aware dashboard container
- `nextjs-project/src/components/sidebar/Sidebar.tsx` - Theme-aware sidebar + ThemeToggle in footer
- `nextjs-project/src/components/layout/TopBar.tsx` - Theme-aware top bar

**Modified (bulk conversion - 31 files):**
- All aircraft components (AircraftTable, AircraftDetail, RatesSection, CreateAircraftDialog, EprMatrixTable)
- All pricing components (DashboardSummary, MsnInputRow, MsnSwitcher, MarginInput, PnlTable, PnlView, SummaryTable)
- All quote components (QuoteList, SaveQuoteDialog, StatusBadge)
- All sensitivity components (SensitivityTable, SensitivityView, SensitivityChart, ParameterPicker)
- PlaceholderPage
- All dashboard page files (9 pages)

## Decisions Made
- Light mode is the DEFAULT (no prefix), dark mode uses `dark:` prefix -- this is the correct Tailwind convention where light is the base
- ThemeToggle placed in sidebar footer -- always visible, does not crowd TopBar, follows user-preference-controls-in-sidebar pattern
- next-themes handles all localStorage persistence and system preference detection -- no Zustand store needed for theme (per research "Don't Hand-Roll" section)
- SensitivityChart uses useTheme() hook with resolvedTheme and mounted guard to conditionally set Recharts inline color values (grid, axes, tooltip)
- StatusBadge semantic colors converted: draft (gray), sent (blue), accepted (green), rejected (red) with proper light-mode backgrounds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed double dark: class artifacts from systematic conversion**
- **Found during:** Task 2 (bulk conversion)
- **Issue:** The systematic regex conversion script produced double dark: prefixes in some cases (e.g., `text-gray-400 dark:text-gray-500 dark:text-gray-400`) when text-gray-400 was both a source and target class
- **Fix:** Ran cleanup pass to resolve duplicate dark: prefixes to single correct pair
- **Files modified:** 26 files
- **Verification:** No remaining `dark:X dark:Y` patterns, build passes
- **Committed in:** d413ffd (Task 2 commit)

**2. [Rule 1 - Bug] Fixed hover pseudo-class missing in dark mode**
- **Found during:** Task 2 (verification)
- **Issue:** `hover:bg-gray-800` was converted to `hover:bg-gray-100 dark:bg-gray-800/50` instead of `hover:bg-gray-100 dark:hover:bg-gray-800/50` -- missing hover: in dark variant
- **Fix:** Corrected 4 files to use proper `dark:hover:` prefix
- **Files modified:** QuoteList, EprMatrixTable, CreateAircraftDialog, QuoteDetailClient
- **Verification:** Build passes, dark mode hover states work correctly
- **Committed in:** d413ffd (Task 2 commit)

**3. [Rule 1 - Bug] Fixed disabled:text-gray-400 incorrectly converted**
- **Found during:** Task 2 (verification)
- **Issue:** `disabled:text-gray-400` was incorrectly matched by the text-gray-400 replacement, producing `disabled:text-gray-500 dark:text-gray-400`
- **Fix:** Restored `disabled:text-gray-400` as the correct disabled state color
- **Files modified:** RatesSection, CreateAircraftDialog, EprMatrixTable
- **Verification:** Build passes
- **Committed in:** d413ffd (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs from systematic conversion)
**Impact on plan:** All auto-fixes were necessary for correctness of the theme conversion. No scope creep -- all fixes are within the color class conversion scope.

## Issues Encountered
None -- plan executed as designed with systematic conversion approach.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theme infrastructure complete, all components theme-aware
- Next plans (05-02 table sorting, 05-03 deployment) can proceed independently
- Any new components added in future should follow the `light-default dark:variant` pattern established here

## Self-Check: PASSED

- [x] nextjs-project/src/providers/ThemeProvider.tsx - FOUND
- [x] nextjs-project/src/components/ui/ThemeToggle.tsx - FOUND
- [x] Commit 9465693 (Task 1) - FOUND
- [x] Commit d413ffd (Task 2) - FOUND
- [x] 05-01-SUMMARY.md - FOUND

---
*Phase: 05-polish-and-production-readiness*
*Completed: 2026-03-10*
