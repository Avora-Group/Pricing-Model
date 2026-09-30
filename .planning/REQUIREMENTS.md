# Requirements: ACMI Pricing Platform

**Defined:** 2026-09-30 (milestone v2.1)
**Core Value:** Accurate, repeatable ACMI pricing quotes that sales teams can generate, save, and retrieve — replacing manual spreadsheet-based pricing.
**Milestone goal:** A signed-in ACMI user can file a feature request or bug report from the app shell, and it lands in the tracker as their own request, with `source_app` = `acmi-app`.

**Source:** `C:\Projects\task-tracker\docs\superpowers\specs\2026-09-14-host-app-embeds-design.md`. All paths below are under `nextjs-project/`.

## v2.1 Requirements

### Dependency & build (DEP)

- [ ] **DEP-01**: `@avora/tracker-client` v10 is a dependency pinned to the `v10` git tag. The lockfile resolves it over `git+https` to `a369f81…`, contains no `git+ssh`, and no other package changes.
- [ ] **DEP-02**: The Vercel build installs the private dependency. `vercel.json`'s `installCommand` changes from `npm install` to `bash vercel-install.sh`, and that script writes git credentials from `TRACKER_REPO_TOKEN` for all three GitHub URL forms before `npm install`. It is committed with LF line endings.
- [ ] **DEP-03**: A new `.env.example` lists every variable name the frontend reads, name-only: the existing `AZURE_*` and `API_URL` names, `TRACKER_API_SCOPE` and `TRACKER_RT_KEY` (server-only), `NEXT_PUBLIC_TRACKER_API_URL`, `NEXT_PUBLIC_TRACKER_URL`, and the build-only `TRACKER_REPO_TOKEN`.

### Refresh-token capture (RT)

- [ ] **RT-01**: A Microsoft sign-in requests `openid email profile offline_access` in both places: the authorize request in `src/app/api/auth/login/azure/route.ts` and the code exchange in `src/app/api/auth/callback/azure/route.ts`.
- [ ] **RT-02**: When the code exchange returns a `refresh_token`, the callback sets a `tracker_rt` cookie whose value is `EncryptJWT({ rt })` (jose, `dir` / `A256GCM`) keyed by `TRACKER_RT_KEY` (32 random bytes, base64url).
- [ ] **RT-03**: The `tracker_rt` cookie is `httpOnly`, `secure` in production, `sameSite: 'lax'`, `maxAge` 7 days and `path: '/api/tracker'`, so the browser sends it only to the token route and page scripts cannot read it.
- [ ] **RT-04**: `logoutAction` clears `tracker_rt` with the same path, alongside `access_token`.
- [ ] **RT-05**: Sign-in is unaffected when the embed is not configured. With `TRACKER_RT_KEY` unset, or when Entra returns no refresh token, the callback still sets `access_token` and redirects as it does today, and sets no `tracker_rt`.

### Token route (TOKEN)

- [ ] **TOKEN-01**: `POST /api/tracker/token` (`src/app/api/tracker/token/route.ts`) decrypts `tracker_rt` and redeems it for `TRACKER_API_SCOPE` with `redeemTrackerToken`, using the existing `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET`. It returns `200 { accessToken, expiresAt }` with `Cache-Control: no-store`.
- [ ] **TOKEN-02**: The route requires the app's own session. A request without the `access_token` cookie gets `401 reauth`, returned by the route itself, because `src/middleware.ts`'s matcher does not cover `/api`.
- [ ] **TOKEN-03**: Failures map through `tokenErrorResponse`:
  - `503 unconfigured` when `TRACKER_API_SCOPE` or `TRACKER_RT_KEY` is unset
  - `401 reauth` when `tracker_rt` is missing or fails to decrypt (for example after a key rotation)
  - `403 consent`, `503 config` and `502 unavailable` from Entra

  The route logs only the error code and Entra's numeric codes, never a token.
- [ ] **TOKEN-04**: When Entra returns a rotated refresh token, the route re-sets `tracker_rt` with the new value and the RT-03 attributes on the same response.

### Triggers & dialog (EMBED)

- [ ] **EMBED-01**: On desktop, two lucide icon buttons (`Lightbulb`, `Bug`) with `aria-label` and `title` **Request a feature** and **Report a bug** sit in the `Sidebar.tsx` footer beside `ThemeToggle`. They are hidden when the sidebar is collapsed, as `ThemeToggle` is.
- [ ] **EMBED-02**: On mobile, **Request a feature** and **Report a bug** appear in `BottomTabBar.tsx`'s More list and open the same dialog.
- [ ] **EMBED-03**: Each trigger opens the tracker dialog:
  - with `type` set to `feature` or `bug`
  - pinned to `{ id: "acmi-app", name: "ACMI App" }` with `lockProject: true`
  - with the requester's email from the shell's `userEmail`, and the display name decoded from the `name` claim of the tracker access token already fetched (display only)
- [ ] **EMBED-04**: The wrapper fetches a token before opening. On failure it shows `showNotice({ tone: 'error' })` with the error's message, and no dialog opens.
- [ ] **EMBED-05**: A successful submit shows a notice linking to `{NEXT_PUBLIC_TRACKER_URL}/?view=requests&project=acmi-app`.
- [ ] **EMBED-06**: The dialog and notices are themed from ACMI's palette for next-themes' `resolvedTheme` at open time. All 18 dialog variables are set, and nothing is written to `documentElement`.
- [ ] **EMBED-07**: The triggers are hidden on desktop and mobile when `NEXT_PUBLIC_TRACKER_API_URL` is unset or the shell has no `userEmail`.
- [ ] **EMBED-08**: Viewer-role users see and can use both triggers. The viewer route allowlist does not filter them out.

### Rollout (SHIP)

- [ ] **SHIP-01**: The Entra prerequisites are re-confirmed for client `ac19614d-e6c8-4e6c-966f-2e6de3ee1516`: the delegated `access_as_user` permission with admin consent, and its entry as an authorized client on the tracker registration.
- [ ] **SHIP-02**: A live preflight to the tracker API returns `access-control-allow-origin` from each origin ACMI users actually land on: `https://pricing-model.avora.aero` and `https://acmi-pricing.vercel.app`.
- [ ] **SHIP-03**: `TRACKER_API_SCOPE`, `TRACKER_RT_KEY`, `NEXT_PUBLIC_TRACKER_API_URL`, `NEXT_PUBLIC_TRACKER_URL` and `TRACKER_REPO_TOKEN` are set on the Vercel project `pricing-model` before the deploy.
- [ ] **SHIP-04**: After explicit sign-off, a push to `main` deploys to production and the deployment reaches `READY`. The rollback target is recorded first, and the install log shows the credential step.
- [ ] **SHIP-05**: The spec's per-app UAT checklist passes on production:
  - a feature (with a screenshot) and a bug each land with `source_app` = `acmi-app` and `created_by` = the user
  - light and dark both match, and the page behind the dialog does not change colour
  - a forced `reauth` shows the notice and no dialog opens
  - a session from before the deploy gets `reauth` once, then works after signing in again
  - after logout, `tracker_rt` is gone
  - ACMI's own session, quotes and dashboard still work after filing

## Future Requirements

Deferred. Tracked but not in the current roadmap.

### Embed follow-ups

- **EMBED-09**: A loading state on the trigger during the token pre-flight (Finance 04-UI-REVIEW).
- **EMBED-10**: Adopt a tracker-client v10.x that stops `dialog.css` setting `color-scheme` and defaults on `:root` (Finance 03-REVIEW WR-05).

### Dashboard Enhancements

- **DASH-08**: Time-bounded fleet utilization (lease period overlap — an MSN signed Jan–Mar is free in Apr)
- **DASH-09**: Weighted pipeline forecasting

### Actuals Comparison

- **ACTV-01**: User can upload Excel file with actual operational cost data
- **ACTV-02**: System displays comparison of quoted vs actual costs per contract
- **ACTV-03**: User can identify pricing model gaps (missing or irrelevant costs)

### Quote Enhancement

- **QUOT-06**: User can export a quote as PDF with professional formatting *(carried over from v1.0; the API route is a 501 stub)*
- **QUOT-07**: User can clone/duplicate an existing quote with modified inputs
- **QUOT-08**: User can add notes and attachments to quotes

### Integration

- **INTG-01**: System syncs financial data from Business Central Dynamics
- **INTG-02**: System provides monthly financial performance reporting

### Advanced Auth

- **AUTH-06**: Role-based access control with granular permissions

## Out of Scope

| Feature | Reason |
|---------|--------|
| A test runner for the frontend | Spec, Testing: ACMI is verified by `next build`, lint and UAT |
| Tracker read views, status sync or notifications in ACMI | Spec non-goal; host-app tokens are create-only |
| Changing `AZURE_REDIRECT_URI` or consolidating ACMI's two addresses | Not requested; the embed must work where sessions land today |
| Changes to FastAPI or to the tracker backend | The refresh token is redeemed by the Next.js server; the tracker already maps ACMI's client id |
| Storing the refresh token in the database or in the `access_token` JWT | Spec decision: a separate encrypted cookie scoped to `/api/tracker` |
| A user menu component | Spec decision: icon buttons in the sidebar footer and entries in the mobile More list |
| Moving asset-app or the tracker to v10 | Spec non-goal |
| Multi-stage CRM pipeline, real-time dashboard, fuel cost, multi-currency, self-service signup, mobile app | Standing exclusions from v1.0 and v2.0 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| *(filled by the roadmap)* | | |

**Coverage:**
- v2.1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 ⚠️

## Shipped requirements

The v1.0 list (30 requirements, shipped 2026-03-10) and the v2.0 list (14 requirements, closed 2026-09-30 from code evidence) are in git history at `7c9993d:.planning/REQUIREMENTS.md`. MILESTONES.md summarises both.

---
*Requirements defined: 2026-09-30 for milestone v2.1*
*Last updated: 2026-09-30 after initial definition*
