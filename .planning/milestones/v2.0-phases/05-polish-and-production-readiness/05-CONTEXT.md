# Phase 5: Polish and Production Readiness - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the application professionally finished and deployable. Three areas: sortable/responsive data tables, dark/light/system mode toggle, and deployment configuration for Vercel (frontend) + Railway (backend + PostgreSQL). Dashboard stats (UI-04) was explicitly dropped by user — not needed.

</domain>

<decisions>
## Implementation Decisions

### Sortable tables — data tables only
- **Scope:** Only AircraftTable and QuoteList get column sorting. P&L, Crew Config, Costs Config, EPR Matrix, and Sensitivity tables stay as-is (they're financial/config tables where sorting doesn't help).
- **Sortable columns (key columns only):**
  - AircraftTable: MSN, Type (skip rate columns)
  - QuoteList: Quote #, Client, Status, Created date
- **Detail panes:** Keep current full-page navigation (clicking aircraft row goes to /aircraft/[msn]). No slide-over or modal behavior needed.
- **Mobile responsive:** Tables must be usable on mobile phone screens. Hide less important columns at small breakpoints, improve spacing/padding, maintain horizontal scroll fallback.

### Dark/light mode — three states with localStorage
- **Three modes:** Dark / Light / System (follows OS prefers-color-scheme). Default to System on first visit.
- **Persistence:** Per-browser using Zustand persist middleware with localStorage (same pattern as sidebar-store). No backend changes needed.
- **Toggle placement:** Claude's discretion — pick the best spot based on the existing layout.
- **Light theme colors:** Claude's discretion — clean light theme that complements the existing dark theme and indigo accents.
- **Implementation note:** Currently 100% hardcoded dark colors (gray-900/800/700). Tailwind v4 with inline theme in globals.css. Need to convert hardcoded colors to theme-aware classes across all components.

### Dashboard stats — DROPPED
- User explicitly decided no dashboard stats are needed.
- UI-04 requirement is skipped for this phase.
- Dashboard remains the pricing workspace (inputs + summary).

### Deployment — Vercel + Railway
- **Frontend (Next.js):** Deploy to Vercel. Auto-deploys from GitHub.
- **Backend (FastAPI + PostgreSQL):** Deploy to Railway. Container-based with managed PostgreSQL.
- **Phase deliverables:** Dockerfiles, environment variable configuration, production build settings, any necessary Railway/Vercel config files.

### Claude's Discretion
- Theme toggle placement (sidebar footer vs top bar)
- Light mode color palette design
- Mobile responsive breakpoints and column hiding strategy
- Sorting visual indicators (arrows, highlighting)
- Specific Railway configuration (Procfile, nixpacks, etc.)
- Docker multi-stage build optimization

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **sidebar-store.ts**: Uses Zustand `persist` middleware with localStorage — same pattern for theme preference store
- **AircraftTable.tsx**: Has search filter pattern (`useState` + filtering). Add sorting state alongside existing search
- **QuoteList.tsx**: Has search + status filter. Sorting fits naturally into existing filter pattern
- **RatesSection.tsx**: Toggle edit pattern (isEditing state) — similar pattern for theme toggle component

### Established Patterns
- **Tailwind classes:** All components use hardcoded gray-900/800/700 dark colors. Converting to theme-aware requires systematic class replacement
- **Tailwind v4:** Uses `@theme inline { }` in globals.css, NOT tailwind.config.ts. Dark mode configuration is different from v3
- **globals.css:** Body has hardcoded `background: #030712; color: #e5e7eb;` — needs CSS variable approach
- **layout.tsx:** Simple `<html lang="en">` with no theme class or provider wrapper

### Integration Points
- **layout.tsx:** Theme provider wraps here, theme class goes on `<html>` element
- **globals.css:** CSS variables for theme colors defined here
- **Sidebar.tsx:** If toggle goes in sidebar footer, modify this component
- **All components:** Every component with gray-900/800/700 classes needs theme-aware equivalents

</code_context>

<specifics>
## Specific Ideas

- "I need it to be useful on mobile phone screen" — explicit mobile usability requirement for tables
- User wants System mode as a third option (not just dark/light toggle)

</specifics>

<deferred>
## Deferred Ideas

- Dashboard stats (UI-04) — user explicitly dropped this. Could be revisited in a future iteration if needed.
- Detail panes without full-page navigation — user chose to keep current full-page nav behavior.

</deferred>

---

*Phase: 05-polish-and-production-readiness*
*Context gathered: 2026-03-10*
