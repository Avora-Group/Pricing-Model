# Avora ACMI Pricing — build conventions

Aviation-pricing aesthetic: navy + cyan brand, serif display headings, dense tabular figures, soft cards. **No provider or wrapper is required** — components style themselves from CSS custom properties. Set `background: var(--bg); color: var(--ink)` on your app root. Dark mode: add the `dark` class to a root element (every token flips automatically) — never hand-pick dark colors.

## Styling idiom

Style with the **`av-*` class vocabulary + CSS variables** below (all defined in `styles.css` → `_ds_bundle.css`). A compiled subset of Tailwind utilities also ships (layout ones like `flex`, `grid`, `gap-*`, `px-*`, `text-right` resolve), but the design language lives in the `av-*` classes and `var(--*)` tokens — prefer them; use inline styles for one-off spacing rather than inventing utility names.

**Tokens** (light+dark): brand `--navy --navy-700 --navy-500 --cyan --cyan-soft --cyan-ink --teal --brand --brand-fg`; semantic `--pos --pos-soft --neg --neg-soft --amber --amber-soft`; surfaces `--bg --card --card-2 --panel-h-bg --hover`; text `--ink --ink-2 --muted --muted-2`; lines `--line --line-2`; misc `--radius --radius-sm --shadow --shadow-lg --font-serif --font-mono`.

**Class families:**

| Family | Classes |
|---|---|
| Page heading | `av-page-title` (serif navy), `av-page-sub` |
| Buttons | `av-btn` + `av-btn-primary` \| `av-btn-cyan` \| `av-btn-ghost` |
| Cards | `av-panel` / `av-card`, header `av-panel-h` (holds `h2` + `.av-hint`), body `av-card-b` |
| KPI tiles | `av-kpi-row` grid → `av-kpi` (+`k-green`/`k-navy`/`k-amber` accent bar) with `.lab .val .sub .delta` |
| Tables | `av-tbl` → `av-th` / `av-td` (+`.r` right-align) |
| Status pills | `av-pill` + `av-pill-draft/-sent/-signed/-active/-completed/-rejected`, dot span `.d` |
| Chips / links | `av-msn` (mono registration chip), `av-link` / `tlink` |
| Hero banner | `av-hero` → `av-hero-grid`, `av-hero-eyebrow`, `av-hero-val`, `av-hero-sub`; stats `av-hstat-grid` → `av-hstat` (`.l .v .s`) |
| Forms | `av-input`, `av-field` (label row `.fl`), `av-field-row`, `av-seg` (buttons, active=`.on`), `av-slider` |
| Workspace tabs | `av-ac-tabs` → `av-ac-tab` (+`.active`, draft state `.draft` + `.draft-badge`), `av-ac-add` |
| Metric verdict | `av-verdict-top` → `av-vcell` (`.vlab .vval .vsub`); flag `av-verdict-flag` + `av-vf-good/-thin/-loss` |
| Breakdown table | `av-bd-tbl` with row classes `head` / `sub` / `total`, label `cat` + swatch `sw`, `.r .pct` cells |
| Waterfall chart | `av-wf` → `av-wf-col` → `av-wf-bar` (`rev`/`cost`/`net`+`isneg`) with `av-wf-val`, `av-wf-lab` |
| Sensitivity strip | `av-sens-grid` → `av-sens-cell` (+`.cur`) with `.sr .sm .sn` |
| Numbers | `av-num` (tabular figures — put it on EVERY numeric cell), `av-pos` / `av-neg` |
| Redaction | `av-redacted` (hatched hidden-figure pill) |

## Components (`window.AcmiDS`)

`StatusBadge` (status string → lifecycle pill) · `EditableCell` + `ReadOnlyProvider` (click-to-edit numeric cell; provider locks subtrees read-only) · `FormulaCell` (computed figure) · `SectionHeader` · `TableCard` (panel-wrapped table shell) · `LineDetailPopover` (cost build-up tooltip; give it `cursor={{x,y}}` and a `transform: translate(0,0)` ancestor to contain it) · `Redacted` · `PlaceholderPage`.

## Where the truth lives

Read `styles.css` (imports `_ds_bundle.css` — every class/token above) before styling; per-component API + examples in each `components/<group>/<Name>/<Name>.prompt.md`.

## Idiomatic snippet

```jsx
import { StatusBadge } from '@ds'
<div className="av-panel">
  <div className="av-panel-h"><h2>Quotes</h2><span className="av-hint">last 30 days</span></div>
  <table className="av-tbl">
    <thead><tr><th className="av-th">Quote</th><th className="av-th">Status</th><th className="av-th r">EUR/BH</th></tr></thead>
    <tbody><tr>
      <td className="av-td"><span className="tlink av-num">EZJ-014</span></td>
      <td className="av-td"><StatusBadge status="active" /></td>
      <td className="av-td av-num r">3,500</td>
    </tr></tbody>
  </table>
</div>
```
