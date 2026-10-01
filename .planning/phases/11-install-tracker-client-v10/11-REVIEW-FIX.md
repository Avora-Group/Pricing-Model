---
phase: 11-install-tracker-client-v10
fixed_at: 2026-10-01T08:00:00Z
review_path: .planning/phases/11-install-tracker-client-v10/11-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-10-01T08:00:00Z
**Source review:** .planning/phases/11-install-tracker-client-v10/11-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 to WR-04; fix_scope `critical_warning`)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: vercel-install.sh fails on a second run and prints the token to the log

**Files modified:** `nextjs-project/vercel-install.sh`
**Commit:** e0baf40 (shared with WR-02, because one rewrite of the same lines fixes both)
**Applied fix:** The token is no longer part of any git config key. The `insteadOf` rewrites now point at plain `https://github.com/`, which holds no token, and cover both SSH forms (`ssh://git@github.com/` and `git@github.com:`). The token comes from a credential store. All git config goes to a fresh `mktemp -d` file through `GIT_CONFIG_GLOBAL`, so every run starts from an empty config and no multi-valued key can collide on a re-run.

### WR-02: Running the install script outside Vercel truncates credentials and hijacks all GitHub auth

**Files modified:** `nextjs-project/vercel-install.sh`
**Commit:** e0baf40
**Applied fix:** `export GIT_CONFIG_GLOBAL="$GIT_TMP/gitconfig"` keeps all git state inside this process tree. npm's `@npmcli/git` spawns git with `{...process.env}`, so its git children inherit the variable. The script never writes to `~/.gitconfig` or `~/.git-credentials`. The credential file is created inside the temp dir under `umask 077`. An empty `credential.helper` value is added first, which clears helpers inherited from system config (for example Git Credential Manager on Windows), and then `store --file=<tmp>/creds` is added. `GIT_TERMINAL_PROMPT=0` makes git fail rather than hang. An EXIT trap deletes the two files and the directory with `rm -f` plus `rmdir`, not `rm -rf`. The script has no `VERCEL`-only guard: local runs are now harmless and are useful for testing.

The same rewrite also covers three Info findings, which stay out of scope and unscored:
- IN-01: the token is now in one place only, the credential store. It is not in config keys or in any argv.
- IN-02: the file is created under umask 077 rather than chmod-ed afterwards.
- IN-04, partly: the rewrites no longer carry the token, so git sends it only when GitHub issues an auth challenge. Public repos are fetched without it. Rewrites still apply to all of github.com.

**Verification of WR-01/WR-02:** `bash -n` passes. A scratch-HOME simulation used `TRACKER_REPO_TOKEN=github_pat_FAKE123` and a stub `npm` on PATH that inspects the environment npm's git children would inherit. It ran twice on Windows Git Bash and twice in a Linux (alpine) container. Results:
- Every run exited 0.
- The token never appeared in any output: grep count 0.
- The token was not in the generated gitconfig: count 0.
- `git ls-remote --get-url` rewrote all three URL forms to `https://github.com/Avora-Group/tracker-client.git`.
- `git credential fill` returned the token from the store, and GCM was not invoked.
- The credential file was mode 600 on Linux. NTFS reports 644 because it emulates permissions.
- The temp dir was removed after every run, and the scratch HOME stayed empty.

A network check in the container confirmed the end-to-end behaviour. With the script, `git ls-remote git@github.com:Avora-Group/tracker-client.git` went over HTTPS with the stored credential and got `Invalid username or token`. The token was not echoed. Without the script, the same call got `could not read Username ... terminal prompts disabled`. The real `~/.gitconfig` was unchanged (sha256 `5a22b600…` before and after), and `~/.git-credentials` still does not exist.

### WR-03: The postinstall normalizer skips most npm commands, so the lockfile can still get git+ssh

**Files modified:** `nextjs-project/scripts/check-tracker-lock.mjs` (new file), `nextjs-project/package.json`, `.planning/phases/11-install-tracker-client-v10/11-CONTEXT.md`
**Commit:** 99dc259 (code), 0e88f99 (planning note, committed separately)
**Applied fix:**
- **New guard script.** `scripts/check-tracker-lock.mjs` is a new file. It exits 1 with a clear message when `package-lock.json` contains `git+ssh://git@github.com/Avora-Group/tracker-client`.
- **Wired as `prebuild`.** It runs as `"prebuild": "node scripts/check-tracker-lock.mjs"`, so both a local `npm run build` and Vercel's `npm run build` run it. Plain node with no shell syntax works the same on Windows (cmd) and Linux.
- **Normalizer left as-is.** `normalize-tracker-lock.mjs` is untouched, so it stays byte-identical to HR's copy.
- **Lockfile not modified.** Scripts are not recorded in the lockfile.
- **D-06 note updated.** The note in 11-CONTEXT.md now says "bare `npm install`" and adds a correction about running a bare install after any dependency change and about the guard.

**Verification:**
- With the committed lockfile, the guard exits 0.
- On a scratch copy with the SSH URL injected, `npm run prebuild` exits 1 and prints the message.

### WR-04: Copying .env.example as instructed defeats the localhost:8000 fallback it documents

**Files modified:** `nextjs-project/.env.example`
**Commit:** f6eef54
**Applied fix:** `API_URL` and `NEXT_PUBLIC_API_URL` are now commented out as `# NAME=http://localhost:8000`. The wording explains that a blank `NAME=` sets the variable to `""` and breaks the `??` default, and a header note says why some lines are commented out. These are the only variables in `.env.example` whose read sites have a code default: all 17 API read sites use `??`, and no AZURE_* or TRACKER_* read has a default. A check with Node's `util.parseEnv` confirmed that a verbatim copy no longer defines either API variable.

## Verification environment

The fixes were edited and committed in an isolated worktree under `C:/Projects/acmi-app/.claude/worktrees/` on a temp branch. That branch was then fast-forwarded into `main` (97f6042 to f6eef54), and the worktree, temp branch and recovery sentinel were removed.

The project gates ran in the **main checkout** (`C:/Projects/acmi-app/nextjs-project`) after the fast-forward, so the results below can be reproduced from the tree:
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0. The `prebuild` guard ran and passed first.
- `npm run lint`: exit 1, with 10 errors and 10 warnings. All of them are already present in `src/` files this phase does not touch, mostly `react-hooks/set-state-in-effect`. `npx eslint scripts/` is clean.

No `npm install` was run, and `package-lock.json` was not changed.

---

_Fixed: 2026-10-01T08:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
