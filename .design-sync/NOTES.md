# design-sync notes — acmi-app

- This repo is a Next.js **app**, not a packaged DS: no dist, no Storybook. The bundle builds from the hand-written entry `nextjs-project/src/ds-entry.ts` (passed via `--entry` and `cfg.entry`) — never let synth-entry auto-scan `src/` (it would re-export the whole app incl. server actions).
- Scope is deliberately the presentational surface only (9 components). App-coupled components (Sidebar, TopBar, DashboardSummary, tables wired to Zustand stores / server actions) are intentionally out.
- The real design payload is the `av-*` class system + tokens in `nextjs-project/src/app/globals.css`. It compiles via `bash .design-sync/build-css.sh` (Tailwind v4 CLI; cwd = nextjs-project so content scan picks up app usage; output `nextjs-project/.ds-css/acmi.css`, gitignored). **Re-run this before the converter whenever globals.css or component classNames change.**
- Fonts: the app injects `--font-inter`/`--font-geist-mono` via next/font. The CSS build script shims them: Google Fonts `@import` + `:root` var definitions appended. Validator reports `[FONT_REMOTE]` for Inter/Geist Mono — expected, not a miss.
- `npm ci` was skipped on first sync: `nextjs-project/node_modules` was already present and the user's dev server was running from it (a reinstall would have broken it). Converter deps live isolated in `.ds-sync/`.
- Playwright: cache had `chromium-1217` → `playwright@1.59.0` installed in `.ds-sync/` matches it.
- `LineDetailPopover` renders `position: fixed` at a `cursor` prop; its preview contains it with a `transform: translate(0,0)` wrapper (transformed ancestor = containing block for fixed children). Reuse that pattern in any future story for it.
- `FormulaCell` is `display:block; text-align:right` full-width — previews must width-constrain it (~120px) or the figure floats to the cell edge.
- `EditableCell` reads `ReadOnlyContext` (default `false`) — renders editable standalone, no provider needed.

## Known render warns

- (none — final validate: 9/9 clean, 0 bad/thin/variantsIdentical)

## Re-sync risks

- **ds-entry.ts drift**: new presentational components added to the app do NOT auto-join the sync — add them to `nextjs-project/src/ds-entry.ts` AND `cfg.componentSrcMap`.
- **Compiled CSS staleness**: `.ds-css/acmi.css` is generated, gitignored, and machine-local — a fresh clone MUST run `bash .design-sync/build-css.sh` before the converter or the build fails/`[CSS_*]`.
- **Tailwind utility subset**: the shipped CSS contains only utilities the app source actually uses. If a design built in claude.ai/design uses an uncompiled utility class, it silently no-ops — the conventions header steers the agent toward `av-*` classes + tokens instead.
- **Google Fonts at runtime**: Inter/Geist Mono load remotely in rendered designs; offline rendering falls back to system fonts.
- **Preview realism**: preview numbers (salaries, per-diems) were hand-copied from the crew-config seed data at sync time; they're display-only and can drift from the app's real seeds harmlessly.
