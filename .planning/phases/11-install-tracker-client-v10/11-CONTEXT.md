# Phase 11: Install tracker-client v10 - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning

<domain>
## Phase Boundary

ACMI's frontend (`nextjs-project/`) gets `@avora/tracker-client` v10 as a dependency and builds locally. Phase 11 delivers:
- the dependency in `package.json` and `package-lock.json`
- `scripts/normalize-tracker-lock.mjs`, with a `postinstall` that runs it
- `vercel-install.sh`, and `vercel.json`'s `installCommand` pointing at it
- a new, tracked `.env.example`, with a negation rule in `nextjs-project/.gitignore`
- a root `.gitignore` entry for `.planning/state.json` (a chore commit before the phase work)

Nothing in the app imports the package yet. That starts in Phase 12. The work stays local: nothing is pushed until Phase 14, because a push to `main` is a production deploy. The Vercel install itself is first exercised by the Phase 14 deploy.

Requirements: DEP-01, DEP-02, DEP-03.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (settled before this discussion)
- **D-01:** The dependency is `"@avora/tracker-client": "git+https://github.com/Avora-Group/tracker-client.git#v10"`, added by hand as the **first** entry of `dependencies` (`@avora` sorts before `exceljs`). Don't use `npm install <url>`, which can rewrite the spec to `github:…`.
  - The lockfile's `resolved` must be `git+https://github.com/Avora-Group/tracker-client.git#a369f81a51c88d6b82fec3c05537a13da862f769`.
  - `grep -c git+ssh package-lock.json` must be `0`.
  - The installed `node_modules/@avora/tracker-client/package.json` is `10.0.0`.
- **D-02:** `vercel-install.sh` is HR's variant (`C:/Projects/hr-app/nextjs-project/vercel-install.sh`), not Finance's or MXT's. HR's is the one that rewrites all three GitHub URL forms (`https://github.com/`, `ssh://git@github.com/`, `git@github.com:`) with `insteadOf`, which success criterion 3 requires. HR's root directory is `nextjs-project` too, so its header wording applies.
  - Keep the fail-loud `exit 1` when `TRACKER_REPO_TOKEN` is unset.
  - Keep the `credential.helper store` credentials file.
  - Keep the warning never to rename the token to `NEXT_PUBLIC_*`, and the 256-char `installCommand` note.
  - End with `npm install`, which is what Vercel runs today.
  - Commit it with LF endings: `git ls-files --eol vercel-install.sh` must show `i/lf`. The repo has `core.autocrlf=true` and no `.gitattributes`, so `w/crlf` in the working tree is fine. What matters is the index.
- **D-03:** In `vercel.json`, only `installCommand` changes, from `npm install` to `bash vercel-install.sh`. The `$schema`, `framework`, `outputDirectory` and `buildCommand` keys stay as they are.
- **D-04:** **No CI changes and no Docker changes.** ACMI has no `.github/`. The root `Dockerfile` and `docker-compose.yml` build only FastAPI; the frontend runs natively.
- **D-05:** No other package changes. `jose` is already a dependency (`^6.1.3`), so Phase 12 adds nothing either.

### Lockfile normalizer
- **D-06:** ACMI gets the postinstall lockfile normalizer, as HR, Finance and MXT have, even though DEP-01..03 and the roadmap do not list it. It counts as part of delivering DEP-01: it keeps success criterion 2 (`git+ssh` count of `0`) true after any later `npm install`.
  - Create `nextjs-project/scripts/` (it does not exist) and copy `C:/Projects/hr-app/nextjs-project/scripts/normalize-tracker-lock.mjs` into it.
  - Add `"postinstall": "node scripts/normalize-tracker-lock.mjs"` to `scripts` in `package.json`. ACMI has no `postinstall` today.
- **D-07:** The script is **verbatim**, byte-for-byte in content, including its header comment about the Actions runner and the CI credential step that ACMI does not have. The four apps keep one identical file.

### .env.example shape
- **D-08:** Track the file with a negation rule. In `nextjs-project/.gitignore`, add `!.env.example` directly under the `.env*` line, with a one-line comment saying it is a name-only manifest. No `git add -f`. `git ls-files .env.example` must list it.
- **D-09:** The file lists every `process.env` name read under `src/`, which includes `NEXT_PUBLIC_API_URL` (`src/lib/api.ts:1`) although DEP-03 does not name it. Note its fallback to `http://localhost:8000`. `NODE_ENV` stays out, because the framework sets it. The full list:
  - `API_URL`, `NEXT_PUBLIC_API_URL`
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`
  - `TRACKER_API_SCOPE`, `TRACKER_RT_KEY`, `NEXT_PUBLIC_TRACKER_API_URL`, `NEXT_PUBLIC_TRACKER_URL`
  - `TRACKER_REPO_TOKEN`
- **D-10:** Names only. Every line is `NAME=` with a **blank value**. A known non-secret value goes **in the comment** above it, so a developer can copy it into `.env.local`. The comment values are the ones Finance's and HR's manifests name:
  - `TRACKER_API_SCOPE`: `api://86fcee80-55d8-4992-937e-af37620ed7f9/access_as_user`. Server-only, never `NEXT_PUBLIC_`. It holds the tracker's client id, not ACMI's.
  - `NEXT_PUBLIC_TRACKER_API_URL`: `https://task-tracker-production-a300.up.railway.app`. Leaving it blank hides both triggers (EMBED-07).
  - `NEXT_PUBLIC_TRACKER_URL`: `https://dev-tracker.avora.aero`.
  - Secrets (`AZURE_CLIENT_SECRET`, `TRACKER_RT_KEY`, `TRACKER_REPO_TOKEN`) get no value anywhere, only a description.
- **D-11:** Group the file by concern, under a short header that says "names only, copy to `.env.local`, set the same names on Vercel":
  1. API: `API_URL`, `NEXT_PUBLIC_API_URL`
  2. Azure sign-in: the four `AZURE_*` names
  3. Tracker embed: the four tracker names, each marked server-only or public
  4. Build-only: `TRACKER_REPO_TOKEN`, with the never-`NEXT_PUBLIC_` warning and "Production and Preview"

  `TRACKER_RT_KEY` gets a one-line generation hint (32 random bytes, base64url) and a note that it is server-only.

### Baseline and drift
- **D-12:** Before the phase work, ignore `.planning/state.json`: add it to the **root** `.gitignore` in its own small chore commit. It is GSD SDK machine state; `STATE.md` is the tracked record. After that commit the tree must be clean. Any other dirt means stop and ask (PROJECT.md, "Clean tree first").
- **D-13:** Baseline gate: `npm ci && npm run build` in `nextjs-project/` on the untouched tree, before any change. If it fails, **stop and report**. The failure predates this phase, and fixing it is the user's call. `npm ci` wipes `node_modules`; on Windows, stop a running `next dev` first.
- **D-14:** Lockfile drift: if `npm install` changes any lockfile entry other than the new root dependency and the `node_modules/@avora/tracker-client` entry, run `git checkout package-lock.json` and `npm install` once more. If unrelated entries still change, **stop and ask**. No hand-reverting of hunks, and nothing unrelated is ever committed (DEP-01).

### Commit shape
- **D-15:** **One commit** for the phase work, staging exactly these seven files by name (paths under `nextjs-project/`): `package.json`, `package-lock.json`, `scripts/normalize-tracker-lock.mjs`, `vercel-install.sh`, `vercel.json`, `.env.example`, `.gitignore`. The D-12 chore commit is separate and comes first. No push.
- **D-16:** The subject follows ACMI's sentence style, not conventional commits and not GSD's `feat(11-01): …` default. For example: `Tracker embed: install tracker-client v10 for the Vercel build`. The body explains git+https, the lock normalizer, and `TRACKER_REPO_TOKEN` via `vercel-install.sh`.
- **D-17:** Author with the repo's configured identity as-is (`avoradevops <devops@avora.aero>`), with no `-c user.name` override. End the message with the session's Co-Authored-By trailer.

### Claude's Discretion
- The exact comment wording in `.env.example`, within D-09 to D-11.
- The header line of `vercel-install.sh`, as long as D-02 holds.
- The exact subject wording of both commits, within D-16.
- The final gate after the change: `npm ci && npm run build` per success criterion 1, plus the `git+ssh` grep, the lockfile-diff check, `git ls-files --eol vercel-install.sh` and `git ls-files .env.example`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec
- `C:/Projects/task-tracker/docs/superpowers/specs/2026-09-14-host-app-embeds-design.md`: the "acmi-app" section, "Env and deploy" (lines ~379–383), and "Entra and deployment prerequisites" item 3 (`TRACKER_REPO_TOKEN` on `pricing-model`, Production and Preview).

### Reference implementations
- `C:/Projects/hr-app/nextjs-project/vercel-install.sh`: the script to follow (D-02). It has the three `insteadOf` rewrites.
- `C:/Projects/hr-app/nextjs-project/scripts/normalize-tracker-lock.mjs`: the file to copy verbatim (D-06, D-07).
- `C:/Projects/task-tracker/docs/superpowers/plans/2026-09-16-hr-request-embed.md` Task 1: the dependency edit, the lockfile checks, the install script, the `--eol` check. Skip its CI step.
- `C:/Projects/avora-finance-app/.planning/milestones/v1.0-phases/01-install-tracker-client-v10/01-CONTEXT.md` and `01-01-PLAN.md`: the same phase in Finance, the closest task shape for an app with no test runner. Its `vercel-install.sh` lacks the three URL rewrites, so do not copy that file.
- `C:/Projects/avora-finance-app/.env.example` and `C:/Projects/avora-finance-app/.gitignore` (lines 35–37): the value-in-comment style (D-10) and the negation rule (D-08).

### Project
- `.planning/PROJECT.md`: Constraints (clean tree first, no push without sign-off, secrets, package pin) and "Lessons carried from HR, MXT and Finance".
- `.planning/REQUIREMENTS.md`: DEP-01..03.
- `.planning/ROADMAP.md`: Phase 11 success criteria.
- `.planning/STATE.md`: Blockers/Concerns, the three Phase 11 entries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- HR's `vercel-install.sh` and `normalize-tracker-lock.mjs` are used as they are. Nothing in ACMI's own tree is reused.

### Established Patterns
- `nextjs-project/package.json` has `dev`, `build`, `start` and `lint` scripts, with no `postinstall` and no `engines` field. `lockfileVersion` is 3. Local Node is v24.15.0 and npm is 11.12.1.
- `nextjs-project/` has no `scripts/` directory and no `.env.example`. It has a `.env.local`, which the user edits and agents must not read.
- `nextjs-project/.gitignore` ignores `.env*`. The root `.gitignore` ignores `.env` and `.env*.local`.
- The lockfile has no `git+ssh` or `git+https` entries today, so any such line after the change belongs to the tracker-client entry.
- There is no `.gitattributes`, and `core.autocrlf=true`.
- `process.env` names read under `src/`: `API_URL` (16 reads), `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`, `AZURE_TENANT_ID`, `NEXT_PUBLIC_API_URL`, `NODE_ENV`.
- Code commits use sentence-style subjects (`P&L proration: derive…`). Planning commits use `docs:`.

### Integration Points
- The Vercel project is `pricing-model`, with root directory `nextjs-project` and production from `main`. `TRACKER_REPO_TOKEN` must be on Production **and** Preview before any deploy (Phase 14, SHIP-03). Without it, `vercel-install.sh` fails the build by design.
- **Tag.** In the local `tracker-client` clone, `v10` is an annotated tag object `ddfd166…` that peels to commit `a369f81a51c88d6b82fec3c05537a13da862f769`. The lockfile records the peeled commit.
- `main` is ahead of `origin/main` by the milestone's `.planning/` commits. That is expected and stays so until Phase 14.

</code_context>

<specifics>
## Specific Ideas

- Keep ACMI consistent with the other three host apps wherever there is a choice: the same normalizer file, the same install script, the same `.env.example` comment values.
- Where ACMI has its own convention, ACMI's wins: its commit subject style and its repo identity.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within the phase scope. The actual Vercel variable values are set in Phase 14 (SHIP-03).

</deferred>

---

*Phase: 11-install-tracker-client-v10*
*Context gathered: 2026-09-30*
