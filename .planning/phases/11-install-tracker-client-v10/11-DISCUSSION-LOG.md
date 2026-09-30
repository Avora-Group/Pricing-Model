# Phase 11: Install tracker-client v10 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-30
**Phase:** 11-install-tracker-client-v10
**Areas discussed:** Lockfile normalizer, .env.example shape, Baseline and drift, Commit shape

---

## Lockfile normalizer

### Should ACMI get the postinstall normalizer, though DEP-01..03 and the roadmap don't list it?

| Option | Description | Selected |
|--------|-------------|----------|
| Add it, as the others | Copy HR's `scripts/normalize-tracker-lock.mjs` into a new `nextjs-project/scripts/` and add a `postinstall`. Later installs keep the lockfile on git+https. | ✓ |
| One-time manual fix | Normalize by hand, add no script. Smaller diff, but the next `npm install` rewrites the entry to git+ssh. | |
| You decide | Leave it to the planner. | |

**User's choice:** Add it, as the others

### Keep the script byte-for-byte, or adapt the CI wording in its comment?

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim | Same file in all four apps, as Finance and MXT did. | ✓ |
| Adapt the comment | Drop the CI wording; the comment drifts from the other three copies. | |

**User's choice:** Verbatim

---

## .env.example shape

### How should the file become tracked despite the `.env*` rule?

| Option | Description | Selected |
|--------|-------------|----------|
| Negation rule | `!.env.example` with a comment in `nextjs-project/.gitignore`, as Finance did. | ✓ |
| Forced add | `git add -f` once, `.gitignore` untouched. | |

**User's choice:** Negation rule

### Include `NEXT_PUBLIC_API_URL`, which DEP-03 doesn't name?

| Option | Description | Selected |
|--------|-------------|----------|
| Include it | Success criterion 4 says every `process.env` name under `src/`. Note the localhost fallback. `NODE_ENV` stays out. | ✓ |
| Leave it out | DEP-03's literal list; contradicts success criterion 4. | |

**User's choice:** Include it

### How should known non-secret values be treated?

| Option | Description | Selected |
|--------|-------------|----------|
| Blank, value in comment | `NAME=` with the known value in the comment above, as Finance and HR. | ✓ |
| Blank, no values at all | Purpose-only comments. | |
| Fill in non-secrets | Real values for the scope and URLs; breaks "names only". | |

**User's choice:** Blank, value in comment

### How should the file be organised?

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by concern | API, Azure sign-in, Tracker embed, Build-only; a generation hint for `TRACKER_RT_KEY`. | ✓ |
| Finance's style | Tracker block first as newest, ASCII-rule headings. | |
| You decide | Leave it to the planner. | |

**User's choice:** Grouped by concern

---

## Baseline and drift

### What happens to the untracked `.planning/state.json`?

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore it in .gitignore | Add it to the root `.gitignore` in its own chore commit before the phase work. | ✓ |
| Commit it | Track it; it would keep dirtying the tree. | |
| Tolerate it | Leave it untracked as the one acceptable `git status` entry. | |

**User's choice:** Ignore it in .gitignore

### Run `npm ci && npm run build` on the untouched tree as a gate?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, stop on failure | A failing baseline predates the phase; stop and report. | ✓ |
| Build only, no npm ci | Faster, but doesn't prove the lockfile installs cleanly. | |
| Skip the baseline | Rely on the final gate. | |

**User's choice:** Yes, stop on failure

### If `npm install` changes unrelated lockfile entries?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry once, then stop | `git checkout package-lock.json`, reinstall; if it recurs, stop and ask. | ✓ |
| Hand-revert unrelated hunks | Keep only the tracker-client hunks, prove with `npm ci`. | |
| Stop immediately | No retry. | |

**User's choice:** Retry once, then stop

---

## Commit shape

### How many commits for the phase work?

| Option | Description | Selected |
|--------|-------------|----------|
| One commit | Seven files staged by name; simpler to revert in Phase 14. | ✓ |
| Two commits | Dependency and install script, then `.env.example` and `.gitignore`. | |
| Per GSD task | Atomic commits per plan task. | |

**User's choice:** One commit

### Which subject style?

| Option | Description | Selected |
|--------|-------------|----------|
| ACMI's sentence style | e.g. `Tracker embed: install tracker-client v10 for the Vercel build`. | ✓ |
| Conventional commits | e.g. `feat(tracker): …`, as Finance and GSD's default. | |

**User's choice:** ACMI's sentence style

### Which author identity?

| Option | Description | Selected |
|--------|-------------|----------|
| Repo config as-is | `avoradevops <devops@avora.aero>`, plus the Co-Authored-By trailer. | ✓ |
| Avora DevOps override | `-c user.name='Avora DevOps'`, as Finance required. | |

**User's choice:** Repo config as-is

---

## Claude's Discretion

- Comment wording in `.env.example` and the header line of `vercel-install.sh`
- Exact subject wording of the two commits
- The final verification gate's exact command list

## Deferred Ideas

None.
