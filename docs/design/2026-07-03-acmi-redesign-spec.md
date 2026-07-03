# ACMI Pricing — UX/UI Overhaul Spec

_Date: 2026-07-03 · Owner: Kyarash (Avora) · Requested by: Shereef / Alim_

## Goal

Reskin the entire live ACMI Pricing app (Next.js 16 + FastAPI) to the "Fly2Sky theme"
redesign prototyped by Shereef, and add role-based **naked-cost** access. Back-end
workflow/formulas unchanged — this is look-and-feel + one new access-control feature.

Branding: **Avora** = product chrome (logo, "Avora · ACMI Pricing"); **Fly2Sky** = the
priced airline entity (footer, cost-reference headers). Both are business entities.

## Design direction (locked)

- **Theme engine:** keep existing Tailwind 4 + `next-themes` (class-based dark). Adopt the
  HR-app convention of semantic CSS tokens with full **light + dark** symmetry. Tokens +
  shared `av-*` component classes live in `globals.css`.
- **Visual language (from prototype):** navy `#182460` + cyan `#18b4d8` accent; **Georgia
  serif** display headings + **Inter** body; **tabular figures** everywhere; gradient hero
  dashboard; KPI cards; donut/bar charts; expandable project rows; live pricing workspace
  with waterfall + cost build-up incl. new **Project Total** and **Per BH** columns.
- Applied to **all** pages (Dashboard, Calculation/Pricing, P&L, Sensitivity, Quotes,
  Aircraft, Crew, Costs, Admin) — the prototype is directional, not a page inventory.

## Research-backed refinements (folded in)

- **No "Calculate" gate** — live recompute on every edit (already the prototype's model).
- **Override transparency (FL3XX):** auto values in default ink, manual overrides in cyan
  with hover-to-see-original + a reset-to-auto control.
- **Numbers:** right-aligned, `font-variant-numeric: tabular-nums` everywhere.
- **Colorblind safety:** never encode P&L by hue alone — pair color with sign / ▲▼.
- **Tables:** freeze header + ID column; 1px dividers over zebra; inline expand for detail.
- **Waterfall:** value labelled on each bar; costs colored, red reserved for reductions.
- **Dark mode:** no pure black (base `#0b1020`), elevation via lighter surfaces, ~15%
  desaturated accents, 1px borders (shadows are weak in dark).

## Naked-cost access control (server-enforced)

Three gated layers — **cost**, **price**, **margin** — enforced in FastAPI, not the client:
- **Sales / viewer:** sell price + margin *guardrail* only. API omits naked cost & true margin.
- **Pricing / finance:** full naked cost + true margin.
- **Exec:** aggregate margins.
Client redaction (`.av-redacted`) is cosmetic only. Log reveal events (who/what/when),
never the secret value. Add "View as role" for admins to verify boundaries. Naked numbers
come from Abu → reference tabs.

## Build sequence

1. Design-system foundation (globals.css tokens + `av-*` classes) — **done**.
2. Fonts (Inter + Georgia) + shell (Sidebar brand, TopBar) + Dashboard — reference pattern.
3. Pricing Workspace (Calculation) + Quotes (replicate summary report).
4. P&L, Sensitivity, Aircraft, Crew, Costs, Admin.
5. Naked-cost role gating (FastAPI role/permission + frontend gating + reference "naked" data).
6. Wire git remote `Avora-Group/Pricing-Model`, verify build, push.

## Key source references

FL3XX pricing override pattern; Leon/Avinode/Victor pricing UIs; Stripe/Linear/Ramp/Mercury/
Vercel-Geist table & token patterns; shadcn theming vocab + Tailwind v4 `@theme inline`;
OWASP A01 (broken access control) for server-side gating; WCAG 1.4.11 non-text contrast +
Wong CVD-safe palette for financial red/green.
