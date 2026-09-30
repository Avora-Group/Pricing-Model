# Phase 11: Install tracker-client v10 - Pattern Map

**Mapped:** 2026-09-30
**Files analyzed:** 8 (3 new, 5 modified)
**Analogs found:** 8 / 8

Research was skipped for this phase, so `11-CONTEXT.md` is the only source for the file list. ACMI's own tree has nothing to reuse (no `scripts/`, no `.env.example`, no install script). Every analog is in a sibling repo named in CONTEXT.md `<canonical_refs>`:

- **HR** (`C:/Projects/hr-app/nextjs-project/`): the install script, the normalizer, the `package.json` and `vercel.json` shape. Same layout as ACMI (Vercel Root Directory `nextjs-project`).
- **Finance** (`C:/Projects/avora-finance-app/`): the `.env.example` style and the `.gitignore` negation rule, and the same phase already planned and shipped (`.planning/milestones/v1.0-phases/01-install-tracker-client-v10/`).

All analog paths were checked with `git ls-files` in their own repos and are tracked source.

All paths below are relative to `C:/Projects/acmi-app/` unless they start with a drive letter.

## Repo facts (checked 2026-09-30, HEAD `34a68e4`, branch `main`)

| Fact | Value |
|---|---|
| Working tree | One entry: `?? .planning/state.json` (D-12 removes it). Nothing else. |
| `core.autocrlf` | `true`; no `.gitattributes` |
| Line endings | All five existing files are `i/lf w/crlf` |
| Git identity | `avoradevops <devops@avora.aero>` (D-17: use as-is) |
| `.github/` | Does not exist (D-04) |
| `nextjs-project/scripts/` | Does not exist |
| `nextjs-project/.env.example` | Does not exist. `nextjs-project/.env.local` exists: do not read it. |
| Lockfile | `lockfileVersion: 3`, root name `nextjs-project`. `git+ssh` count 0, `git+https` count 0, no `tracker` string. |
| Lockfile root entry | No `hasInstallScript` on `packages[""]` (the 2 occurrences in the file are on other packages) |
| Project skills / `CLAUDE.md` | None in acmi-app |
| Recent code-commit subjects | `P&L proration: derive month day-shares from dates, not array position`, `Local dev: move Postgres to host port 5434 to clear the task-tracker clash`, `Verdict strip: lead with revenue and add a gross profit card` |
| Recent planning-commit subjects | `docs(11): capture phase context`, `docs: create milestone v2.1 roadmap (4 phases)` |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.gitignore` (root, modify; D-12 chore commit) | config (ignore rules) | n/a | own file, the "machine state" block at lines 7-13 | exact (self) |
| `nextjs-project/package.json` (modify) | config (manifest) | build-time | `C:/Projects/hr-app/nextjs-project/package.json` lines 8-24 | exact |
| `nextjs-project/package-lock.json` (modify, generated) | config (lockfile) | build-time | Finance `01-01-PLAN.md` `<interfaces>` (expected diff shape + LOCK check) | exact |
| `nextjs-project/scripts/normalize-tracker-lock.mjs` (new) | utility (postinstall hook) | file-I/O (text transform) | `C:/Projects/hr-app/nextjs-project/scripts/normalize-tracker-lock.mjs`, verbatim (D-07) | exact |
| `nextjs-project/vercel-install.sh` (new) | config / build script | build-time (credential setup + install) | `C:/Projects/hr-app/nextjs-project/vercel-install.sh` (D-02) | exact |
| `nextjs-project/vercel.json` (modify) | config | build-time | `C:/Projects/hr-app/nextjs-project/vercel.json` line 4 | exact (one key) |
| `nextjs-project/.env.example` (new) | config (env manifest) | n/a | `C:/Projects/avora-finance-app/.env.example` lines 1-34 | role-match (style); values from D-10 |
| `nextjs-project/.gitignore` (modify) | config (ignore rules) | n/a | `C:/Projects/avora-finance-app/.gitignore` lines 35-37 | exact |

---

## Pattern Assignments

### `.gitignore` (root) — D-12 chore commit, comes first

**Current state** (whole file, 21 lines, `i/lf w/crlf`):
```
.env

# Python
__pycache__/
*.pyc

# design-sync machine state (durable inputs live in .design-sync/, committed)
.ds-sync/
ds-bundle/
.design-sync/.cache/
.design-sync/learnings/
.design-sync/node_modules
nextjs-project/.ds-css/

# SDD scratch (progress ledger, task briefs)
.superpowers/
.vercel
.env*.local

# local DB rescue dumps (contain real quote/user data)
/pgdata-*.sql
```

**Pattern to follow (self-analog):** each block is a `# <what it is> (<why>)` comment, then the paths. Lines 7-8 are the closest precedent, since they also ignore machine state and say where the durable record lives:
```
# design-sync machine state (durable inputs live in .design-sync/, committed)
.ds-sync/
```

**Edit:** append one block in the same style, for example:
```

# GSD SDK machine state (STATE.md is the tracked record)
.planning/state.json
```
Wording is Claude's discretion. This file alone goes in the chore commit. After it, `git status --short` must be empty (D-12).

**Note for the `.env.example` work:** this root file's `.env` and `.env*.local` patterns do not match `.env.example`. `git check-ignore -v nextjs-project/.env.example` names only `nextjs-project/.gitignore:34:.env*`, so the negation rule belongs in `nextjs-project/.gitignore` and nowhere else.

---

### `nextjs-project/scripts/normalize-tracker-lock.mjs` (utility, file-I/O) — NEW

**Analog:** `C:/Projects/hr-app/nextjs-project/scripts/normalize-tracker-lock.mjs` (39 lines, `i/lf w/lf`, clean in HR's tree). Copy the whole file, byte for byte (D-07), into a new `nextjs-project/scripts/` directory.

**Whole file** (lines 1-39):
```js
#!/usr/bin/env node
/**
 * postinstall: keep @avora/tracker-client's lockfile entry on HTTPS.
 *
 * npm normalizes any github.com dependency through hosted-git-info and records
 * the SSH form in package-lock.json's `resolved` -- regardless of the
 * git+https:// URL named in package.json. Committing that SSH URL breaks both
 * the Vercel build and the Actions runner, neither of which has an SSH key for
 * the private repo; they authenticate over token HTTPS instead (see
 * vercel-install.sh and the CI credential step).
 *
 * Git deps carry no integrity hash, so rewriting `resolved` is safe: the
 * pinned commit sha is untouched and the same code installs -- only the
 * transport differs.
 *
 * Never fails an install: any problem here is reported and ignored.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LOCKFILE = join(dirname(fileURLToPath(import.meta.url)), "..", "package-lock.json");
const SSH = "git+ssh://git@github.com/Avora-Group/tracker-client.git#";
const HTTPS = "git+https://github.com/Avora-Group/tracker-client.git#";

try {
  // Read as text, not JSON: a targeted replace preserves the file's exact
  // formatting and line endings, so this never shows up as a whitespace diff.
  const before = readFileSync(LOCKFILE, "utf8");
  if (!before.includes(SSH)) process.exit(0);

  writeFileSync(LOCKFILE, before.split(SSH).join(HTTPS));
  console.log(
    "[normalize-tracker-lock] rewrote @avora/tracker-client to git+https:// " +
      "in package-lock.json (npm had reset it to SSH, which breaks Vercel and CI).",
  );
} catch (err) {
  console.warn(`[normalize-tracker-lock] skipped: ${err.message}`);
}
```

**Verbatim gate:** the file's git blob is `1e657b8d363aad7e1721cb34653563b2e8740a80` in both HR (`nextjs-project/scripts/...`) and Finance (`scripts/...`), read from `git ls-files -s` in each repo. After creating ACMI's copy, `git hash-object nextjs-project/scripts/normalize-tracker-lock.mjs` must print the same id. `hash-object` applies the autocrlf conversion, so the result does not depend on the working copy's line endings.

**Path resolution:** `LOCKFILE` is `<script dir>/../package-lock.json`. With the script in `nextjs-project/scripts/`, that is `nextjs-project/package-lock.json`, the same relative layout as HR. No path change is needed.

**Do not adapt the comments.** The header mentions the Actions runner and a CI credential step, and the log line says "Vercel and CI". ACMI has neither (D-04). D-07 keeps the text anyway so that the four apps hold one identical file.

---

### `nextjs-project/package.json` (config, modify)

**Current state** (whole file, 34 lines, `i/lf w/crlf`):
```json
{
  "name": "nextjs-project",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "exceljs": "^4.4.0",
    "jose": "^6.1.3",
    "lucide-react": "^0.577.0",
    "next": "16.1.6",
    "next-themes": "^0.4.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "recharts": "^3.8.0",
    "server-only": "^0.0.1",
    "zod": "^4.3.6",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```
There is no `postinstall` and no `engines`. `jose` is already present (D-05: no other package changes).

**Analog:** `C:/Projects/hr-app/nextjs-project/package.json`.

Script declaration (HR line 11):
```json
    "postinstall": "node scripts/normalize-tracker-lock.mjs",
```
Dependency declaration, first entry of `dependencies` (HR lines 23-25):
```json
  "dependencies": {
    "@avora/tracker-client": "git+https://github.com/Avora-Group/tracker-client.git#v10",
    "@dnd-kit/core": "^6.3.1",
```

**Edit 1, scripts (D-06).** HR puts `postinstall` between `predev` and `dev`. ACMI has no `pre*` scripts, so append it after the last script, as Finance's plan did with `start`. Replace:
```json
    "lint": "eslint"
  },
```
with:
```json
    "lint": "eslint",
    "postinstall": "node scripts/normalize-tracker-lock.mjs"
  },
```

**Edit 2, dependencies (D-01).** First entry, because `@avora` sorts before `exceljs`. Replace:
```json
  "dependencies": {
    "exceljs": "^4.4.0",
```
with:
```json
  "dependencies": {
    "@avora/tracker-client": "git+https://github.com/Avora-Group/tracker-client.git#v10",
    "exceljs": "^4.4.0",
```
Edit by hand. Never `npm install <url>` (D-01): it can rewrite the spec to `github:…`.

**Do not copy from HR:** the `engines` block, `prebuild`/`predev`, or any other script or dependency.

---

### `nextjs-project/package-lock.json` (config, generated)

**Current state:** root entry at lines 6-33, no tracker entry, no `git+` URL of any kind. The first `node_modules/` keys are `@alloc/quick-lru` (line 34) and `@babel/code-frame` (line 47), so the new `node_modules/@avora/tracker-client` entry lands between them.

**Analog:** Finance `01-01-PLAN.md` `<interfaces>` (lines 112-140) and Task 1 Step 5 (lines 245-253).

**Expected diff shape** (Finance plan lines 113-123; additions only, no deletions):
```
+        "@avora/tracker-client": "git+https://github.com/Avora-Group/tracker-client.git#v10",
+      "hasInstallScript": true,
+    "node_modules/@avora/tracker-client": {
+      "version": "10.0.0",
+      "resolved": "git+https://github.com/Avora-Group/tracker-client.git#a369f81a51c88d6b82fec3c05537a13da862f769",
+      "engines": {
+        "node": ">=20.6"
+      }
+    },
```
- The root `"hasInstallScript": true,` line is an expected result of adding ACMI's first `postinstall` (D-06). It is not drift under D-14. ACMI's root entry has no such key today.
- Finance accepted `git diff --numstat` of `9 0` or `8 0` (the latter if npm omits `hasInstallScript`). Any deleted line is drift.

**Verification block to reuse** (Finance plan line 247, with ACMI's directory):
```bash
cd /c/Projects/acmi-app/nextjs-project && npm install && grep -n "tracker-client" package.json package-lock.json && grep -c "git+ssh" package-lock.json; git diff --numstat package-lock.json; grep '"version"' node_modules/@avora/tracker-client/package.json; ls node_modules/@avora/tracker-client
```

**LOCK check to reuse** (Finance plan lines 127-139). It compares the working lockfile with `HEAD` and ignores exactly the new root dependency, the root `hasInstallScript`, and the new tracker entry. Two changes for ACMI: the `cd` target, and the `git show` path, which must be repo-relative from the subdirectory (`HEAD:./package-lock.json`):
```bash
cd /c/Projects/acmi-app/nextjs-project && node -e '
const {execSync}=require("child_process");const fs=require("fs");
const a=JSON.parse(execSync("git show HEAD:./package-lock.json",{maxBuffer:1<<28}));
const b=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
const ra=JSON.parse(JSON.stringify(a.packages[""])),rb=JSON.parse(JSON.stringify(b.packages[""]));
if(rb.dependencies)delete rb.dependencies["@avora/tracker-client"];delete ra.hasInstallScript;delete rb.hasInstallScript;
const ka=Object.keys(a.packages).filter(k=>k!=="").sort();
const kb=Object.keys(b.packages).filter(k=>k!==""&&k!=="node_modules/@avora/tracker-client").sort();
const same=a.lockfileVersion===b.lockfileVersion&&JSON.stringify(ra)===JSON.stringify(rb)&&JSON.stringify(ka)===JSON.stringify(kb)&&ka.every(k=>JSON.stringify(a.packages[k])===JSON.stringify(b.packages[k]));
const t=b.packages["node_modules/@avora/tracker-client"]||{};
console.log(same&&t.version==="10.0.0"&&t.resolved==="git+https://github.com/Avora-Group/tracker-client.git#a369f81a51c88d6b82fec3c05537a13da862f769"?"LOCK-OK":"LOCK-DRIFT");'
```
The ACMI form of this command has not been run. The planner should have the executor run it once on the untouched tree first: there it must print `LOCK-DRIFT` only because the tracker entry is missing.

**Drift rule (D-14):** on `LOCK-DRIFT`, `git checkout package-lock.json` and `npm install` once more. If it persists, stop and ask. No hand-reverting of hunks.

**Expected values (D-01):** `resolved` ends `#a369f81a51c88d6b82fec3c05537a13da862f769`; `grep -c git+ssh` is `0`; installed version `10.0.0`.

---

### `nextjs-project/vercel-install.sh` (build script) — NEW

**Analog:** `C:/Projects/hr-app/nextjs-project/vercel-install.sh` (43 lines, mode `100644`, `i/lf w/lf`, blob `fbb9185f9f1ed1146c2b82e500d96c283b7ed498`). D-02 names this variant. Do **not** use Finance's or MXT's script: those lack the `insteadOf` rewrites.

**Whole file** (lines 1-43):
```bash
#!/usr/bin/env bash
# Vercel install step (Root Directory: nextjs-project).
#
# The build image holds no SSH key for the private Avora-Group/tracker-client
# repo, so @avora/tracker-client is fetched over token-authenticated HTTPS.
# package.json and package-lock.json both name the git+https:// URL (the
# postinstall script keeps the lockfile that way), and the credentials come
# from TRACKER_REPO_TOKEN — a fine-grained PAT scoped to that one repo with
# Contents: read-only. The same PAT serves every Avora app that embeds the
# tracker, so if it expires, all of their builds fail at once.
#
# TRACKER_REPO_TOKEN must NOT be renamed to NEXT_PUBLIC_*: that prefix would
# inline the credential into the client bundle served to every visitor.
#
# This lives in a script rather than inline in vercel.json because Vercel caps
# `installCommand` at 256 characters.
set -euo pipefail

if [ -n "${TRACKER_REPO_TOKEN:-}" ]; then
  git config --global credential.helper store
  printf 'https://x-access-token:%s@github.com\n' "$TRACKER_REPO_TOKEN" > "$HOME/.git-credentials"
  chmod 600 "$HOME/.git-credentials"

  # npm may resolve the dependency over ssh://git@github.com/ regardless of the
  # git+https:// URL in package.json and package-lock.json. That is exactly how
  # it failed in CI (run 35193567885: "Permission denied (publickey)"), where
  # the credential store alone would not have saved it either — a credential
  # helper is never consulted for an SSH URL. This image has no SSH key, so
  # every form github.com can arrive in is rewritten to token HTTPS. --add is
  # required: a second insteadOf on the same key replaces the first.
  AUTH="https://x-access-token:${TRACKER_REPO_TOKEN}@github.com/"
  git config --global url."$AUTH".insteadOf "https://github.com/"
  git config --global --add url."$AUTH".insteadOf "ssh://git@github.com/"
  git config --global --add url."$AUTH".insteadOf "git@github.com:"
else
  # Fail loudly rather than let npm emit a confusing SSH permission error.
  echo "ERROR: TRACKER_REPO_TOKEN is not set. The private @avora/tracker-client" >&2
  echo "dependency cannot be installed. Set it in the Vercel project's" >&2
  echo "environment variables (Production + Preview)." >&2
  exit 1
fi

npm install
```

**How it maps to D-02:**

| D-02 requirement | HR lines |
|---|---|
| Header wording for Root Directory `nextjs-project` | 2 (applies to ACMI unchanged) |
| Never-`NEXT_PUBLIC_*` warning | 12-13 |
| 256-char `installCommand` note | 15-16 |
| `credential.helper store` + credentials file, `chmod 600` | 20-22 |
| Three `insteadOf` rewrites (`https://github.com/`, `ssh://git@github.com/`, `git@github.com:`) | 31-34 |
| Fail-loud `exit 1` when the token is unset | 35-40 |
| Ends with `npm install` | 43 |

**Verbatim or adapted:** nothing in the file needs changing for ACMI. The header line is Claude's discretion, but HR's line 2 is already correct. If the file is copied unchanged, `git hash-object nextjs-project/vercel-install.sh` prints `fbb9185f9f1ed1146c2b82e500d96c283b7ed498`, which gives the plan a one-line content gate. The comment at lines 24-30 cites a CI run in HR's repo; it is history explaining why the rewrites exist, and is harmless in ACMI. The file holds `—` (UTF-8), so write it as UTF-8.

**Line-ending gate (D-02):** `git ls-files --eol nextjs-project/vercel-install.sh` must start `i/lf`. `w/crlf` is fine. If it shows `i/crlf`: `sed -i 's/\r$//' vercel-install.sh`, `git add` again, re-check (Finance plan line 437). Keep mode `100644`: Vercel runs it as `bash vercel-install.sh`, so no executable bit.

**Isolated test pattern** (Finance plan lines 329-350). Never run the script against the real `$HOME`: it overwrites `~/.git-credentials` and the global git config. The HR variant also writes three global `url.*.insteadOf` entries, so `GIT_CONFIG_GLOBAL` must point at the throwaway directory too:
```bash
cd /c/Projects/acmi-app/nextjs-project && bash -n vercel-install.sh && echo SYNTAX-OK
BEFORE=$(git config --global --get-all credential.helper || true)
T=$(mktemp -d)
# (a) unset branch: must exit 1 with the ERROR text and write nothing
( cd "$T" && env -u TRACKER_REPO_TOKEN HOME="$T" GIT_CONFIG_GLOBAL="$T/.gitconfig" bash /c/Projects/acmi-app/nextjs-project/vercel-install.sh ) > "$T/unset.log" 2>&1; echo "unset-exit=$?"
grep -c "ERROR: TRACKER_REPO_TOKEN is not set" "$T/unset.log"; ls -a "$T" | grep -c git-credentials
# (b) set branch, with a fake token and an empty package in the temp dir
( cd "$T" && printf '{"name":"probe","version":"1.0.0"}\n' > package.json && TRACKER_REPO_TOKEN=fake-probe-token HOME="$T" GIT_CONFIG_GLOBAL="$T/.gitconfig" bash /c/Projects/acmi-app/nextjs-project/vercel-install.sh ) > "$T/set.log" 2>&1; echo "set-exit=$?"
cat "$T/.git-credentials"; git config --file "$T/.gitconfig" credential.helper; grep -c fake-probe-token "$T/set.log"
AFTER=$(git config --global --get-all credential.helper || true); [ "$BEFORE" = "$AFTER" ] && echo REAL-GLOBAL-UNCHANGED
rm -rf "$T"
```
ACMI addition for success criterion 3, run before the `rm -rf`: the three rewrites must be present in the throwaway config.
```bash
git config --file "$T/.gitconfig" --get-all 'url.https://x-access-token:fake-probe-token@github.com/.insteadof'
```
Expected: three lines, `https://github.com/`, `ssh://git@github.com/`, `git@github.com:`. Also check the real global config gained no `url.*.insteadof` key (`git config --global --get-regexp '^url\.'` unchanged before and after). This ACMI form has not been run here.

---

### `nextjs-project/vercel.json` (config, modify)

**Current state** (whole file, 7 lines, `i/lf w/crlf`):
```json
{
  "$schema": "https://vercel.com/schema.json",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "buildCommand": "npm run build"
}
```

**Analog:** `C:/Projects/hr-app/nextjs-project/vercel.json` (whole file):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "bash vercel-install.sh"
}
```

**Edit (D-03).** One line. Replace:
```json
  "installCommand": "npm install",
```
with:
```json
  "installCommand": "bash vercel-install.sh",
```
Take only the `installCommand` value from HR. ACMI's `$schema` URL differs from HR's and stays as it is, as do `framework`, `outputDirectory` and `buildCommand`. Vercel resolves the command against the project Root Directory (`nextjs-project`), where the script sits.

Gate: `git diff --numstat nextjs-project/vercel.json` shows `1 1`.

---

### `nextjs-project/.gitignore` (config, modify)

**Current state** (lines 33-37 of 41, `i/lf w/crlf`):
```
# env files (can opt-in for committing if needed)
.env*

# vercel
.vercel
```

**Analog:** `C:/Projects/avora-finance-app/.gitignore` lines 35-37:
```
.env*
# .env.example is a name-only manifest (no secrets) — keep it tracked (Phase 68 / AUTH-05).
!.env.example
```

**Edit (D-08).** Add the comment and the negation directly under `.env*` (line 34). Replace:
```
.env*

# vercel
```
with, for example:
```
.env*
# .env.example is a name-only manifest (no secrets), so keep it tracked.
!.env.example

# vercel
```
Drop Finance's "(Phase 68 / AUTH-05)" reference: it is Finance's phase. The negation must come after `.env*`, because the last matching pattern wins.

**Gates:** `git check-ignore -q nextjs-project/.env.example` exits 1 (not ignored); after a plain `git add`, `git ls-files nextjs-project/.env.example` lists it. No `git add -f` (D-08). `git check-ignore -v nextjs-project/.env.local` must still name the `.env*` rule.

---

### `nextjs-project/.env.example` (config, env manifest) — NEW

**Style analog:** `C:/Projects/avora-finance-app/.env.example`. HR's own `nextjs-project/.env.example` is **not** the style to follow: it writes real values on the variable lines (`TRACKER_API_SCOPE=api://...`) and comments the token out (`# TRACKER_REPO_TOKEN=`), which D-10 rules out.

**File header** (Finance lines 1-6):
```
# .env.example — env-var manifest for avora-finance-app (Next.js, Vercel-deployed).
#
# Names only — NO real secret values committed here. Copy to .env.local and
# fill in real values for local dev; set the same names in the Vercel
# dashboard (Project Settings -> Environment Variables) for each deployed
# environment (Development / Preview / Production).
```
This covers D-11's header ("names only, copy to `.env.local`, set the same names on Vercel"). Change the app name; the Vercel project is `pricing-model`.

**Section heading + value-in-comment block** (Finance lines 8-34, the tracker block):
```
# ── Tracker request embed / DEP-03 (NEW) ─────────────────────────────────────

# TRACKER_API_SCOPE — Entra scope that POST /api/tracker/token redeems the
# signed-in user's refresh token for. Server-only: the route reads it, the
# browser never talks to Entra. Not a secret, but never NEXT_PUBLIC_.
# Value: api://86fcee80-55d8-4992-937e-af37620ed7f9/access_as_user
TRACKER_API_SCOPE=

# NEXT_PUBLIC_TRACKER_API_URL — tracker API base URL the request dialog posts
# to. Leave it blank to hide both user-menu items (Request a feature / Report
# a bug). Requests are pinned to the tracker project "avora-finance-app".
# Ships in the browser bundle; not a secret.
# Value: https://task-tracker-production-a300.up.railway.app
NEXT_PUBLIC_TRACKER_API_URL=

# NEXT_PUBLIC_TRACKER_URL — tracker frontend, used for the link in the notice
# shown after a request is filed. Ships in the browser bundle; not a secret.
# Value: https://dev-tracker.avora.aero
NEXT_PUBLIC_TRACKER_URL=

# TRACKER_REPO_TOKEN — Vercel build/install only, read by vercel-install.sh.
# A read-only fine-grained PAT (Contents: read-only) on the private
# Avora-Group/tracker-client repo, shared across the Avora apps. NEVER rename
# it to NEXT_PUBLIC_*: that prefix would inline the credential into the client
# bundle served to every visitor. Set it on Production AND Preview; without it
# vercel-install.sh fails the build on purpose. Never commit its value here.
TRACKER_REPO_TOKEN=
```

**Conventions to carry over:**
- Section heading: `# ── <title> ` padded with `─` to 79 code points, then a blank line.
- Per variable: a `# NAME — explanation` paragraph, an optional `# Value: <non-secret value>` line, then `NAME=` with nothing after the `=`, then a blank line.
- Secrets get a description and no `# Value:` line.
- One-line generation hints sit in the comment, as Finance line 42 does: `couple their rotation. Generate with: openssl rand -hex 32`.

**ACMI adaptations (D-09 to D-11):**

| Finance text | ACMI |
|---|---|
| "avora-finance-app" (app name and tracker project key) | `acmi-app` (spec line 354: "project `acmi-app`") |
| "hide both user-menu items" | "hide both triggers" (D-10). ACMI has no menu: the triggers are two icon buttons in the sidebar footer and two entries in the mobile tab bar (spec lines 369-371) |
| "(NEW)" and "/ DEP-03" in the heading | Drop. The whole file is new, and D-11 groups by concern |
| Tracker section holds the repo token | Move `TRACKER_REPO_TOKEN` to its own build-only section (D-11 group 4) |
| — | Add `TRACKER_RT_KEY` to the tracker section: a secret, server-only, with the hint "32 random bytes, base64url" (D-11; spec line 358). No `# Value:` line |

**Section order and contents (D-11):**
1. **API** — `API_URL`, `NEXT_PUBLIC_API_URL` (note the `http://localhost:8000` fallback)
2. **Azure sign-in** — `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (secret), `AZURE_REDIRECT_URI`
3. **Tracker embed** — `TRACKER_API_SCOPE` (server-only), `TRACKER_RT_KEY` (server-only secret), `NEXT_PUBLIC_TRACKER_API_URL` (public), `NEXT_PUBLIC_TRACKER_URL` (public)
4. **Build-only** — `TRACKER_REPO_TOKEN`, with the never-`NEXT_PUBLIC_` warning and "Production and Preview"

Eleven `NAME=` lines in total. `# Value:` lines for exactly three names (D-10): `TRACKER_API_SCOPE`, `NEXT_PUBLIC_TRACKER_API_URL`, `NEXT_PUBLIC_TRACKER_URL`. The `TRACKER_API_SCOPE` comment should say it holds the tracker's client id, not ACMI's (D-10).

**`process.env` names actually read under `nextjs-project/src/`** (grep `process\.env\.[A-Z0-9_]+`, 2026-09-30; 25 reads in 19 files):

| Name | Reads | Where | In D-09? |
|---|---|---|---|
| `API_URL` | 16 | 11 files under `src/app/(dashboard)/` (`layout.tsx` and the pages `admin`, `quotes`, `quotes/[id]`, `calculation`, `crew`, `costs`, `pnl`, `dashboard`, `aircraft`, `aircraft/[msn]`), `src/app/actions/{admin,aircraft,pricing,quotes}.ts`, `src/app/api/auth/callback/azure/route.ts:8` | yes |
| `NEXT_PUBLIC_API_URL` | 1 | `src/lib/api.ts:1` | yes |
| `AZURE_TENANT_ID` | 2 | `src/app/api/auth/login/azure/route.ts:4`, `.../callback/azure/route.ts:4` | yes |
| `AZURE_CLIENT_ID` | 2 | `login/azure/route.ts:5`, `callback/azure/route.ts:5` | yes |
| `AZURE_REDIRECT_URI` | 2 | `login/azure/route.ts:6`, `callback/azure/route.ts:7` | yes |
| `AZURE_CLIENT_SECRET` | 1 | `callback/azure/route.ts:6` | yes |
| `NODE_ENV` | 1 | `callback/azure/route.ts:9` | no, by design (framework-set) |

The `NEXT_PUBLIC_API_URL` fallback, `src/lib/api.ts:1`:
```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
```

**Check against D-09:**
- Every name the code reads today is in D-09, apart from `NODE_ENV`, which D-09 excludes on purpose. Nothing is missing.
- D-09 also lists five names that `src/` does **not** read yet: `TRACKER_API_SCOPE`, `TRACKER_RT_KEY`, `NEXT_PUBLIC_TRACKER_API_URL`, `NEXT_PUBLIC_TRACKER_URL` (first read in Phases 12-13) and `TRACKER_REPO_TOKEN` (read only by `vercel-install.sh`, never by app code). That is intended. A plan gate of the form "every name in `.env.example` is read under `src/`" would fail; the correct gate is one-directional: every name read under `src/` except `NODE_ENV` appears in `.env.example`.
- The grep matches the `process.env.NAME` form only. No bracket-access or destructured reads were searched for.

**Suggested content gates:**
```bash
cd /c/Projects/acmi-app/nextjs-project
tr -d '\r' < .env.example | grep -cE '^[A-Z0-9_]+=$'      # 11
tr -d '\r' < .env.example | grep -cE '^[A-Z0-9_]+=.+'     # 0
tr -d '\r' < .env.example | grep -c 'NEXT_PUBLIC_TRACKER_REPO_TOKEN'   # 0
tr -d '\r' < .env.example | grep -c '^# Value: '          # 3
```

---

## Shared Patterns

### Line endings
**Source:** `git ls-files --eol` in acmi-app. All five existing files are `i/lf w/crlf`; `core.autocrlf=true`; no `.gitattributes`.
**Apply to:** all eight files. A normal `git add` stores LF whatever the working copy holds. Only `vercel-install.sh` is gated (`i/lf`), because bash on Vercel breaks on `\r`. Working-tree files are CRLF, so strip `\r` before any line-anchored grep (`tr -d '\r' < FILE | grep ...`, Finance plan line 97).

### Working directory
**Source:** Finance plan line 95. The Bash tool resets cwd between calls. ACMI's app root is a subdirectory, unlike Finance's, so every npm and file command starts `cd /c/Projects/acmi-app/nextjs-project && ...`. The seven phase files are staged from there by the names D-15 gives. The D-12 chore commit touches the root `.gitignore`, from `/c/Projects/acmi-app`.

### Gates (no test runner)
**Source:** Finance plan Task 1 Step 2 (lines 164-171) and Task 3 Step 2 (lines 440-447); spec line 450 ("These apps have no test runner... verified by `next build`").
**Apply to:** the baseline (D-13) and the final gate.
```bash
cd /c/Projects/acmi-app/nextjs-project && npm ci && npm run build
```
- Baseline runs on the untouched tree, after the D-12 chore commit and before any phase edit. A failure means stop and report.
- `npm ci` wipes `node_modules`. On Windows a running `next dev` holds file locks (`EBUSY`/`EPERM`): find it with `netstat -ano | grep ':3000'`, stop that PID, rerun (Finance plan line 169).
- Final gate, after staging: the same command, then `git diff --exit-code -- <the seven files>` to prove the install and build rewrote none of them (Finance plan line 442).
- ACMI has a `lint` script (`eslint`), which Finance did not. No phase file is linted source, so it is optional here.

### Staging and commit shape
**Source:** Finance plan Task 3 (lines 432-476), changed where ACMI's decisions differ.
**Apply to:** the single phase commit (D-15 to D-17).
```bash
cd /c/Projects/acmi-app/nextjs-project && git add -- package.json package-lock.json scripts/normalize-tracker-lock.mjs vercel-install.sh vercel.json .env.example .gitignore && git diff --cached --name-only && git ls-files --eol vercel-install.sh && git ls-files .env.example
```
Stage by name only; never `git add -A`, `git add .` or a directory.

| | Finance | ACMI |
|---|---|---|
| Files in the commit | 6 | 7 (adds `nextjs-project/.gitignore`) |
| Earlier chore commit | none | root `.gitignore` for `.planning/state.json` (D-12) |
| Subject style | `feat(tracker): install …` | sentence style, e.g. `Tracker embed: install tracker-client v10 for the Vercel build` (D-16) |
| Author | `git -c user.name='Avora DevOps' -c user.email=…` override | **no override**; repo identity `avoradevops <devops@avora.aero>` (D-17) |
| Trailer | the executing session's `Co-Authored-By` | same (D-17) |
| Branch | `master` | `main` |
| Push | none | none until Phase 14 |

Subject-style precedent in ACMI's own log: `P&L proration: derive month day-shares from dates, not array position`.

Commit-body model (Finance plan lines 454-469): three short paragraphs covering what the package is and that nothing imports it yet; git+https, the `a369f81` pin, `vercel-install.sh` with `TRACKER_REPO_TOKEN`, and the postinstall normalizer; then the `.env.example` contents. For ACMI, add that the install script rewrites all three GitHub URL forms, and that `.env.example` is new and tracked through a negation rule.

Post-commit checks to reuse (Finance plan lines 481-494): `git show --name-only --format= HEAD` lists exactly the seven paths; `git show HEAD | grep -cE 'ghp_[A-Za-z0-9]|github_pat_[A-Za-z0-9]'` prints `0`; `git rev-parse origin/main` is unchanged.

### Secrets
**Source:** Finance plan threat register (lines 514-524).
**Apply to:** `vercel-install.sh`, `.env.example`, and the commit.
- No `set -x` in the script; the token goes to a file and into git config, never to stdout.
- Every `.env.example` line has a blank value.
- Never read `nextjs-project/.env.local`.
- The script is only ever run with `HOME` and `GIT_CONFIG_GLOBAL` pointed at a temp directory.

## No Analog Found

None. Each file has either a verbatim source (HR's normalizer and install script) or a shipped analog (Finance's `.env.example` and `.gitignore`, HR's `package.json` and `vercel.json`).

## Metadata

**Analog search scope:**
- `C:/Projects/acmi-app` (root `.gitignore`; `nextjs-project/` `package.json`, `package-lock.json` head, `vercel.json`, `.gitignore`; `process.env` grep over `nextjs-project/src/`)
- `C:/Projects/hr-app/nextjs-project` (`vercel-install.sh`, `scripts/normalize-tracker-lock.mjs`, `package.json`, `vercel.json`, the tracker block of `.env.example`)
- `C:/Projects/avora-finance-app` (`.env.example`, `.gitignore`, `.planning/milestones/v1.0-phases/01-install-tracker-client-v10/01-PATTERNS.md` and `01-01-PLAN.md`)
- `C:/Projects/task-tracker/docs/superpowers/specs/2026-09-14-host-app-embeds-design.md` lines 354-383 (the acmi-app section)

**Not read:** any `.env` or `.env.local` file; `C:/Projects/task-tracker/docs/superpowers/plans/2026-09-16-hr-request-embed.md` (the live HR files were read instead).

**Files scanned:** 15
**Pattern extraction date:** 2026-09-30
