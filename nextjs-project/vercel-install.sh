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

if [ -z "${TRACKER_REPO_TOKEN:-}" ]; then
  # Fail loudly rather than let npm emit a confusing SSH permission error.
  echo "ERROR: TRACKER_REPO_TOKEN is not set. The private @avora/tracker-client" >&2
  echo "dependency cannot be installed. Set it in the Vercel project's" >&2
  echo "environment variables (Production + Preview)." >&2
  exit 1
fi

# All git state lives in a throwaway directory scoped to this process tree.
# GIT_CONFIG_GLOBAL is exported, so the git processes npm spawns read it in
# place of ~/.gitconfig. Nothing is written to ~/.gitconfig or
# ~/.git-credentials, so a local run cannot clobber a developer's credential
# helper or stored credentials, and a re-run starts from a clean config.
GIT_TMP="$(mktemp -d)"
cleanup() {
  rm -f "$GIT_TMP/creds" "$GIT_TMP/gitconfig"
  rmdir "$GIT_TMP" 2>/dev/null || true
}
trap cleanup EXIT
export GIT_CONFIG_GLOBAL="$GIT_TMP/gitconfig"
# Never fall back to an interactive prompt: fail instead of hanging the build.
export GIT_TERMINAL_PROMPT=0

# The token is written once, with the printf builtin (so it never appears in a
# process argument), to a file created owner-only by umask 077.
( umask 077; printf 'https://x-access-token:%s@github.com\n' "$TRACKER_REPO_TOKEN" > "$GIT_TMP/creds" )
# The empty value clears any helper inherited from the system config, so only
# this store is consulted.
git config --global --add credential.helper ""
git config --global --add credential.helper "store --file=\"$GIT_TMP/creds\""

# npm may resolve the dependency over ssh://git@github.com/ regardless of the
# git+https:// URL in package.json and package-lock.json. That is exactly how
# it failed in CI (run 35193567885: "Permission denied (publickey)"): a
# credential helper is never consulted for an SSH URL. This image has no SSH
# key, so both SSH forms are rewritten to plain HTTPS. The rewrite target
# carries no token: on GitHub's auth challenge, git takes the token from the
# credential store above, so the token stays out of config keys and argv.
# --add is required: a second insteadOf on the same key replaces the first.
git config --global --add url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --global --add url."https://github.com/".insteadOf "git@github.com:"

npm install
