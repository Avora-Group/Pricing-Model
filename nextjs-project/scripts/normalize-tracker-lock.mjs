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
