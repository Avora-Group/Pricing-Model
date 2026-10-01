#!/usr/bin/env node
/**
 * prebuild: fail if package-lock.json resolves @avora/tracker-client over SSH.
 *
 * The postinstall normalizer (normalize-tracker-lock.mjs) only runs on a bare
 * `npm install`. npm skips the root postinstall for `npm install <pkg>`,
 * `npm uninstall`, `npm update`, `npm dedupe` and `--ignore-scripts`, and each
 * of those re-saves the lockfile with the git+ssh:// URL. A consumer with no
 * SSH key for the private repo (CI, a teammate's `npm ci`) then fails. This
 * check makes `npm run build` fail loudly instead of letting that lockfile be
 * committed unnoticed.
 *
 * Fix: run a bare `npm install` after any dependency change; the postinstall
 * normalizer rewrites the URL back to git+https://.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LOCKFILE = join(dirname(fileURLToPath(import.meta.url)), "..", "package-lock.json");
const SSH = "git+ssh://git@github.com/Avora-Group/tracker-client";

if (readFileSync(LOCKFILE, "utf8").includes(SSH)) {
  console.error(
    "[check-tracker-lock] package-lock.json resolves @avora/tracker-client over " +
      "git+ssh://, which breaks installs without an SSH key (Vercel, CI). Run a " +
      "bare `npm install` (no arguments) to rewrite it to git+https://.",
  );
  process.exit(1);
}
