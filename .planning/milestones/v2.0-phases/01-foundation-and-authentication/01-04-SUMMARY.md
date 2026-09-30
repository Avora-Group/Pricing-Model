---
phase: 01-foundation-and-authentication
plan: 04
subsystem: ui
tags: [nextjs, react, zustand, tailwind, lucide-react, sidebar, app-shell, layout, server-actions]

# Dependency graph
requires:
  - phase: 01-foundation-and-authentication/01-02
    provides: FastAPI auth endpoints (login, logout) consumed by Server Actions
  - phase: 01-foundation-and-authentication/01-03
    provides: Next.js project, login page, middleware, loginAction/logoutAction, getSession()
provides:
  - Collapsible sidebar with 5 nav items (Dashboard, Pricing, Quotes, Aircraft, Admin)
  - Zustand sidebar store with localStorage persistence across refresh
  - Top bar with logout form action wired to logoutAction
  - Dashboard route group layout with defense-in-depth session check
  - PlaceholderPage component for all unbuilt sections
  - All 5 page routes rendering placeholder content
  - Cookie-forwarding fix: Server Actions now parse Set-Cookie from FastAPI and forward via Next.js cookies() API
affects: [02-aircraft-data, 03-pricing-engine, 04-quotes, 05-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [Zustand persist middleware for localStorage, useEffect mounted guard for SSR hydration, route group (dashboard) for app shell layout, defense-in-depth session check in layout]

key-files:
  created:
    - nextjs-project/src/stores/sidebar-store.ts
    - nextjs-project/src/components/sidebar/Sidebar.tsx
    - nextjs-project/src/components/layout/TopBar.tsx
    - nextjs-project/src/components/ui/PlaceholderPage.tsx
    - nextjs-project/src/app/(dashboard)/layout.tsx
    - nextjs-project/src/app/(dashboard)/dashboard/page.tsx
    - nextjs-project/src/app/(dashboard)/pricing/page.tsx
    - nextjs-project/src/app/(dashboard)/quotes/page.tsx
    - nextjs-project/src/app/(dashboard)/aircraft/page.tsx
    - nextjs-project/src/app/(dashboard)/admin/page.tsx
  modified:
    - nextjs-project/src/app/actions/auth.ts

key-decisions:
  - "Server Actions must forward Set-Cookie from FastAPI to browser via Next.js cookies() API -- server-to-server fetch does not propagate cookies to the client"
  - "logoutAction clears cookie directly via cookies().delete() instead of calling FastAPI -- simpler and avoids the same server-to-server cookie issue"
  - "Sidebar hydration fix: useEffect + mounted state renders expanded on server, reads Zustand store after mount to avoid SSR mismatch"
  - "Defense-in-depth: dashboard layout checks getSession() in addition to middleware, ensuring double-layer route protection"

patterns-established:
  - "Zustand persist pattern: create<T>()(persist((set) => ({...}), { name: 'key' })) for localStorage state"
  - "SSR hydration guard: const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []); const value = mounted ? storeValue : defaultValue"
  - "Route group layout: (dashboard) group wraps all authenticated pages with Sidebar + TopBar"
  - "PlaceholderPage pattern: reusable component for unbuilt pages with title and description"

requirements-completed: [UI-01, UI-05]

# Metrics
duration: 8min
completed: 2026-03-05
---

# Phase 1 Plan 04: App Shell Summary

**Collapsible sidebar with 5 nav items, Zustand localStorage persistence, top bar with logout, and placeholder pages for all routes -- plus cookie-forwarding fix for Server Action auth flow**

## Performance

- **Duration:** 8 min (Task 1 execution + checkpoint verification + cookie fix)
- **Started:** 2026-03-04T17:32:25Z
- **Completed:** 2026-03-05T08:18:27Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files created:** 10
- **Files modified:** 1

## Accomplishments
- Collapsible sidebar with all 5 navigation items (Dashboard, Pricing, Quotes, Aircraft, Admin) using lucide-react icons and active route highlighting via usePathname()
- Zustand sidebar store with localStorage persistence that survives browser refresh, with SSR hydration guard to prevent mismatch
- Top bar with logout button wired to logoutAction Server Action
- Dashboard route group layout composing Sidebar + TopBar + content area with defense-in-depth session check
- PlaceholderPage component used by all 5 routes with descriptive text about what each section will contain
- Critical cookie-forwarding fix: loginAction now parses Set-Cookie from FastAPI response and sets it on the browser via Next.js cookies() API

## Task Commits

Each task was committed atomically:

1. **Task 1: Zustand sidebar store, sidebar component, top bar, and app shell layout** - `1c3f6a8` (feat)
2. **Task 2: Cookie-forwarding fix discovered during human verification** - `d51e0b5` (fix)

## Files Created/Modified
- `nextjs-project/src/stores/sidebar-store.ts` - Zustand store with localStorage persistence for sidebar collapse state
- `nextjs-project/src/components/sidebar/Sidebar.tsx` - Collapsible sidebar with 5 nav items, active highlighting, hydration guard
- `nextjs-project/src/components/layout/TopBar.tsx` - Top bar with user email display and logout form action
- `nextjs-project/src/components/ui/PlaceholderPage.tsx` - Reusable placeholder for unbuilt pages
- `nextjs-project/src/app/(dashboard)/layout.tsx` - App shell layout with Sidebar + TopBar + session check
- `nextjs-project/src/app/(dashboard)/dashboard/page.tsx` - Dashboard placeholder (Phase 5)
- `nextjs-project/src/app/(dashboard)/pricing/page.tsx` - Pricing Calculator placeholder (Phase 3)
- `nextjs-project/src/app/(dashboard)/quotes/page.tsx` - Quotes placeholder (Phase 4)
- `nextjs-project/src/app/(dashboard)/aircraft/page.tsx` - Aircraft placeholder (Phase 2)
- `nextjs-project/src/app/(dashboard)/admin/page.tsx` - Admin placeholder
- `nextjs-project/src/app/actions/auth.ts` - **Modified:** Added Set-Cookie forwarding via cookies() API, simplified logoutAction

## Decisions Made
- Server Actions must forward Set-Cookie from FastAPI to browser via Next.js cookies() API -- the server-to-server fetch (Node.js to FastAPI) sets the cookie on the Node.js process, not the browser. This is a fundamental characteristic of Server Actions that must be accounted for in any cookie-based auth flow.
- logoutAction simplified to clear the cookie directly via `cookies().delete()` instead of calling FastAPI, avoiding the same cookie-propagation issue and reducing a network round-trip.
- Sidebar hydration guard pattern established: render default (expanded) state on server, read persisted Zustand value after mount via useEffect.
- Defense-in-depth: dashboard layout checks getSession() in addition to middleware route protection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Server Action cookie not reaching browser**
- **Found during:** Task 2 (human-verify checkpoint)
- **Issue:** loginAction called FastAPI server-to-server. The httpOnly Set-Cookie header from FastAPI was set on the Node.js process, never reaching the user's browser. Login appeared to succeed (FastAPI returned 200) but the redirect to /dashboard failed because the browser had no access_token cookie, causing middleware to redirect back to /login.
- **Fix:** Parse the Set-Cookie header from FastAPI's response, extract the access_token value, and set it on the browser using Next.js `cookies()` API with matching cookie options (httpOnly, sameSite: lax, maxAge: 7 days). Also simplified logoutAction to clear the cookie directly.
- **Files modified:** `nextjs-project/src/app/actions/auth.ts`
- **Verification:** Full end-to-end flow tested: login sets cookie, dashboard loads, sidebar works, logout clears cookie, redirect to /login confirmed.
- **Committed in:** `d51e0b5`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for auth flow correctness. The Server Action cookie-forwarding pattern is now established for all future authenticated Server Actions.

## Issues Encountered

The cookie-forwarding issue was the only problem encountered. It manifested as a "login redirect loop" -- the user would submit valid credentials, FastAPI would return 200 with Set-Cookie, but the browser never received the cookie. The fix was discovered during the human verification checkpoint and resolved before approval.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 1 is complete: users can log in, see the app shell with sidebar, navigate all 5 routes, and log out
- All placeholder pages are ready to be replaced with real content in Phases 2-5
- The cookie-forwarding pattern in auth.ts is the established approach for any future Server Actions that need to set cookies
- Sidebar component is extensible -- future phases can add sub-items or badges
- PlaceholderPage component can be swapped out page-by-page as each phase delivers real UI

## Self-Check: PASSED

- All 10 created files verified present on disk
- Modified file (auth.ts) verified present on disk
- Both task commits verified in git log (1c3f6a8, d51e0b5)

---
*Phase: 01-foundation-and-authentication*
*Completed: 2026-03-05*
