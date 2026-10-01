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
