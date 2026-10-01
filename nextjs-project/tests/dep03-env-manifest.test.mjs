import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a) => spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });

test(".env.example is tracked by git", () => {
  const r = git("ls-files", "--error-unmatch", ".env.example");
  assert.equal(r.status, 0, r.stderr);
});

for (const f of [".env.local", ".env", ".env.production"]) {
  test(`${f} is gitignored`, () => {
    assert.equal(git("check-ignore", "-q", "--no-index", f).status, 0);
  });
}

test(".env.example itself is not ignored", () => {
  assert.equal(git("check-ignore", "-q", "--no-index", ".env.example").status, 1);
});

const lines = readFileSync(join(ROOT, ".env.example"), "utf8").split(/\r?\n/);

test("no uncommented assignment in .env.example carries a value", () => {
  const assigns = lines.filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l));
  assert.ok(assigns.length > 0);
  for (const l of assigns) assert.match(l, /^[A-Za-z_][A-Za-z0-9_]*=$/, `has a value: ${l.split("=")[0]}`);
});

test("TRACKER_REPO_TOKEN is declared and not NEXT_PUBLIC_", () => {
  const names = lines.map((l) => l.match(/^#?\s*([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean);
  assert.ok(names.includes("TRACKER_REPO_TOKEN"));
  assert.ok(!names.some((n) => n.startsWith("NEXT_PUBLIC_") && /TOKEN|SECRET|KEY/.test(n)));
});
