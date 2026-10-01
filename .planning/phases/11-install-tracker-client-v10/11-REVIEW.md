---
phase: 11-install-tracker-client-v10
reviewed: 2026-10-01T07:30:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - .gitignore
  - nextjs-project/package.json
  - nextjs-project/package-lock.json
  - nextjs-project/scripts/normalize-tracker-lock.mjs
  - nextjs-project/vercel-install.sh
  - nextjs-project/vercel.json
  - nextjs-project/.env.example
  - nextjs-project/.gitignore
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-10-01T07:30:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the phase diff `495bf59..HEAD`, excluding `.planning/`. That is 8 files, with only the 9 added lines of `package-lock.json` in scope. Two findings are proven by execution in an isolated scratch HOME and a scratch copy of the project. Neither run touched the repo or the real global git config.

Things checked and found sound:
- `.env.example` holds no secret values. Every assignment is `NAME=` with a blank value. The only literal values are in comments: a public tracker client-id scope and two public URLs.
- The `.gitignore` negation `!.env.example` re-includes that exact basename and nothing else. `.env.local`, `.env.production`, `.env.example.local` and the like stay ignored. Only `.env.local` and `.env.example` exist under `nextjs-project/`.
- The lockfile diff contains only the root dependency, `hasInstallScript: true` and the `node_modules/@avora/tracker-client` entry, pinned to `a369f81` over `git+https`. The installed package has no `prepare` script, so it needs no build-time compile.
- `vercel-install.sh` uses `set -euo pipefail`, quotes its variables, never enables `set -x`, and writes the token with the `printf` builtin, so the credential-file write does not expose the token in a process argument. In a test, git's own `Authentication failed` message did not print the token from the `insteadOf` URL.
- The normalizer survives a missing lockfile: the ENOENT is caught and reported as "skipped". It is idempotent, exiting early when no SSH string is present. Because npm runs the root `postinstall` after reify, the lockfile is already written when the normalizer runs.

Key concerns:
- The install script is not idempotent. On a second run it exits 5 and prints the token in plaintext to stderr.
- It has no guard against running outside Vercel. A local run truncates `~/.git-credentials` and sends every GitHub URL through a PAT scoped to one repo.
- The postinstall normalizer does not run for `npm install <pkg>`, `uninstall`, `update`, `dedupe` or `--ignore-scripts`, so the "zero git+ssh" invariant does not hold. This was proven.
- Copying `.env.example` as instructed breaks the documented `localhost:8000` fallback, because the code uses `??` and a blank line sets an empty string.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: vercel-install.sh fails on a second run and prints the token to the log

**File:** `nextjs-project/vercel-install.sh:31-34`
**Issue:** The token is embedded in the git config *key* (`url."https://x-access-token:<TOKEN>@github.com/".insteadOf`). Line 32 sets that key without `--add`/`--replace-all`. After a first run, the key has three values (lines 32-34), so a second run in the same HOME fails at line 32. `set -e` aborts with exit 5, and git's error message echoes the full key, token included, to stderr. Reproduced with `TRACKER_REPO_TOKEN=github_pat_FAKE123` in an isolated HOME:

```
=== run 2
warning: url.https://x-access-token:github_pat_FAKE123@github.com/.insteadof has multiple values
error: cannot overwrite multiple values with a single value
       Use a regexp, --add or --replace-all to change url.https://x-access-token:github_pat_FAKE123@github.com/.insteadOf.
exit=5
```

Vercel normally starts each build in a fresh HOME, so production builds are not hit on every deploy. But any re-run against a persisted HOME fails the install and writes the PAT into the log in plaintext: a retried step, a local test run, or a build image that keeps HOME. A malformed token value has the same effect. A trailing newline pasted into the Vercel UI makes `git config` reject the key as invalid, and the error again echoes the key with the token.
**Fix:** Clear the section before adding, so the script is idempotent:
```bash
AUTH="https://x-access-token:${TRACKER_REPO_TOKEN}@github.com/"
git config --global --remove-section "url.$AUTH" 2>/dev/null || true
git config --global --add url."$AUTH".insteadOf "https://github.com/"
git config --global --add url."$AUTH".insteadOf "ssh://git@github.com/"
git config --global --add url."$AUTH".insteadOf "git@github.com:"
```
A sturdier option keeps the token out of config keys entirely. Rewrite the SSH forms to plain `https://github.com/` with no token in the key, and let the credential store on line 21 supply the token:
```bash
git config --global --replace-all url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --global --add        url."https://github.com/".insteadOf "git@github.com:"
```

### WR-02: Running the install script outside Vercel truncates credentials and hijacks all GitHub auth

**File:** `nextjs-project/vercel-install.sh:19-34`
**Issue:** Nothing confines the script to the Vercel build container. If a developer runs `bash vercel-install.sh` locally to test the Vercel install before the Phase 14 deploy, three things happen:
1. Line 21 uses `>`, which **truncates** `~/.git-credentials` and destroys any credentials the developer had stored for other hosts or repos.
2. Line 20 overwrites the developer's global `credential.helper`, for example Git Credential Manager, with `store`.
3. Lines 32-34 send *every* `github.com` URL in every repo on the machine through a fine-grained PAT that can read only `Avora-Group/tracker-client`. The developer's pushes and pulls to all other private repos then fail, and the token stays in plaintext in `~/.gitconfig` and `~/.git-credentials` until someone cleans it up by hand.

`TRACKER_REPO_TOKEN` is listed in the tracked `.env.example` for developers to fill in, which makes a local run with the token set more likely.
**Fix:** Scope all git state to this process tree instead of the user's global config, so nothing persists or gets clobbered anywhere:
```bash
GIT_TMP="$(mktemp -d)"
export GIT_CONFIG_GLOBAL="$GIT_TMP/gitconfig"
( umask 077; printf 'https://x-access-token:%s@github.com\n' "$TRACKER_REPO_TOKEN" > "$GIT_TMP/creds" )
git config --global credential.helper "store --file=$GIT_TMP/creds"
# ... insteadOf lines unchanged (they now write to $GIT_TMP/gitconfig) ...
```
At minimum, refuse to run outside Vercel: `[ -n "${VERCEL:-}" ] || { echo "vercel-install.sh is for Vercel builds only" >&2; exit 1; }`.

### WR-03: The postinstall normalizer skips most npm commands, so the lockfile can still get git+ssh

**File:** `nextjs-project/package.json:10`, `nextjs-project/scripts/normalize-tracker-lock.mjs:26-35`
**Issue:** npm runs the root project's `postinstall` only for a bare `npm install`. The bundled npm 11.12.1, at `lib/commands/install.js:148`, does `if (!args.length && !isGlobalInstall && !ignoreScripts) { ... 'postinstall' ... }`. `npm install <pkg>`, `npm uninstall`, `npm update`, `npm dedupe` and `npm install --ignore-scripts` all re-save the lockfile without running the normalizer. Reproduced in a scratch copy of `package.json`, `package-lock.json` and `scripts/`:

```
$ npm install --package-lock-only is-number@7.0.0
up to date in 2s
ssh count: 1
52:      "resolved": "git+ssh://git@github.com/Avora-Group/tracker-client.git#a369f81...",
```

D-06 justifies the normalizer as keeping the `git+ssh` count at `0` "after any later `npm install`". That holds only for the bare form. The usual way to add or remove a dependency (Phase 12 onward) puts the SSH URL back, and nothing catches it before commit. Vercel is shielded by the `ssh://git@github.com/` rewrite in `vercel-install.sh`. But the committed lockfile then diverges from the stated invariant, and any other consumer without an SSH key fails: a future CI job, or a teammate's `npm ci`.
**Fix:** Add a guard that fails instead of relying on one lifecycle hook, and document the requirement:
```json
"scripts": {
  "postinstall": "node scripts/normalize-tracker-lock.mjs",
  "prebuild": "node -e \"if(require('fs').readFileSync('package-lock.json','utf8').includes('git+ssh://git@github.com/Avora-Group/tracker-client'))throw new Error('package-lock.json has the SSH tracker-client URL: run a bare npm install')\""
}
```
Or add a pre-commit check. Also update the D-06 note to say "run a bare `npm install` after any dependency change".

### WR-04: Copying .env.example as instructed defeats the localhost:8000 fallback it documents

**File:** `nextjs-project/.env.example:3-4, 13, 16-18`
**Issue:** The header says "Copy to .env.local and fill in real values". Lines 16-17 say that when `NEXT_PUBLIC_API_URL` "is unset the code falls back to http://localhost:8000". But a blank `NAME=` line does not leave the variable unset. `@next/env` assigns the empty string. All 17 read sites use nullish coalescing, which does not replace `''`: `src/lib/api.ts:1` (`process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'`) and 16 `process.env.API_URL ?? 'http://localhost:8000'` reads, such as `src/app/actions/quotes.ts:5` and `src/app/api/auth/callback/azure/route.ts:8`. A developer who copies the file and leaves the "optional" API lines blank gets `API_BASE = ''`. Browser fetches go to the Next origin and 404. Server-side `fetch('' + '/api/...')` throws `TypeError: Invalid URL`, so every dashboard page and server action fails, and the cause is hard to find.
**Fix:** Comment out the variables that have a code default, so a verbatim copy leaves them unset, and correct the wording:
```bash
# API_URL — ... Server-only. Leave this line commented out to use the code
# default http://localhost:8000 (a blank `API_URL=` sets it to "" and breaks it).
# API_URL=http://localhost:8000

# NEXT_PUBLIC_API_URL — ... Leave commented out to use http://localhost:8000.
# NEXT_PUBLIC_API_URL=http://localhost:8000
```
Alternatively, change the read sites to `||` in a later phase.

## Info

### IN-01: The token ends up in three plaintext places, one of them redundant

**File:** `nextjs-project/vercel-install.sh:20-22, 31-34`
**Issue:** The token is written to `~/.git-credentials` (line 21) and into `~/.gitconfig` as part of the `insteadOf` key (lines 31-34). It is also passed as an argv element to three `git config` processes, where it is visible to anything that can list processes in the build container. Because the `insteadOf` URL already carries the username and password, git never consults the credential store for these URLs, so lines 20-22 do nothing in practice.
**Fix:** Pick one mechanism. A credential store plus token-free `insteadOf` rewrites (see WR-01) removes the token from config keys and process args.

### IN-02: The credentials file is world-readable until chmod runs

**File:** `nextjs-project/vercel-install.sh:21-22`
**Issue:** The file is created under the default umask (typically 0644), and `chmod 600` runs only afterwards, so for a moment the file is readable by others. The risk is small in a single-tenant build container, but it is real on a shared host (see WR-02).
**Fix:** `( umask 077; printf '...' "$TRACKER_REPO_TOKEN" > "$HOME/.git-credentials" )`.

### IN-03: A failed write can leave a truncated lockfile while the install reports success

**File:** `nextjs-project/scripts/normalize-tracker-lock.mjs:32, 37-38`
**Issue:** `writeFileSync` writes in place. If the write fails partway (disk full, an AV lock on Windows, an interrupted process), `package-lock.json` can be left truncated. The catch block then logs `skipped:` as a warning and the install "succeeds", so a corrupted lockfile can be committed unnoticed.
**Fix:** Write to a temp file and rename it into place: `writeFileSync(LOCKFILE + ".tmp", out); renameSync(LOCKFILE + ".tmp", LOCKFILE);`.

### IN-04: The `insteadOf` rewrite covers all of github.com, not just the tracker-client repo

**File:** `nextjs-project/vercel-install.sh:32-34`
**Issue:** Every github.com fetch during the build is forced through a PAT that can read only `Avora-Group/tracker-client`. Any future git dependency from another private GitHub repo would fail with a confusing auth error instead of a clear "no access" error. Public repos still work, but they are fetched with the token attached.
**Fix:** Narrow the prefixes while keeping all three URL forms, for example `insteadOf "https://github.com/Avora-Group/tracker-client"`, `"ssh://git@github.com/Avora-Group/tracker-client"` and `"git@github.com:Avora-Group/tracker-client"`, with the `AUTH` value ending in `github.com/Avora-Group/tracker-client`.

---

_Reviewed: 2026-10-01T07:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
