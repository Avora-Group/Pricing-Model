import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SSH = "git+ssh://git@github.com/Avora-Group/tracker-client.git#";
const HTTPS = "git+https://github.com/Avora-Group/tracker-client.git#";
const SHA = "a369f81a51c88d6b82fec3c05537a13da862f769";

test("lockfile pins tracker-client v10 commit over https", () => {
  const raw = readFileSync(join(ROOT, "package-lock.json"), "utf8");
  const e = JSON.parse(raw).packages["node_modules/@avora/tracker-client"];
  assert.equal(e.version, "10.0.0");
  assert.equal(e.resolved, `${HTTPS}${SHA}`);
  assert.ok(!raw.includes("git+ssh://git@github.com/Avora-Group/tracker-client"));
});

test("package.json depends on tracker-client #v10 over https", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const dep = { ...pkg.dependencies, ...pkg.devDependencies }["@avora/tracker-client"];
  assert.equal(dep, "git+https://github.com/Avora-Group/tracker-client.git#v10");
});

function sandbox(script, lockContent) {
  const dir = mkdtempSync(join(tmpdir(), "lockfx-"));
  mkdirSync(join(dir, "scripts"));
  copyFileSync(join(ROOT, "scripts", script), join(dir, "scripts", script));
  if (lockContent !== undefined) writeFileSync(join(dir, "package-lock.json"), lockContent);
  const run = () => spawnSync(process.execPath, [join(dir, "scripts", script)], { encoding: "utf8" });
  return { dir, run, lock: () => readFileSync(join(dir, "package-lock.json")) };
}
const mk = (url, nl) => `{${nl}  "a": "${url}${SHA}",${nl}  "b": "x"${nl}}${nl}`;
const clean = (s) => rmSync(s.dir, { recursive: true, force: true });

for (const nl of ["\n", "\r\n"]) {
  const label = nl === "\n" ? "LF" : "CRLF";
  test(`normalizer rewrites SSH to HTTPS and preserves every other byte (${label})`, () => {
    const s = sandbox("normalize-tracker-lock.mjs", mk(SSH, nl));
    try {
      assert.equal(s.run().status, 0);
      assert.deepEqual(s.lock(), Buffer.from(mk(HTTPS, nl)));
    } finally { clean(s); }
  });
  test(`normalizer is a byte-exact no-op on HTTPS lockfile (${label})`, () => {
    const s = sandbox("normalize-tracker-lock.mjs", mk(HTTPS, nl));
    try {
      assert.equal(s.run().status, 0);
      assert.deepEqual(s.lock(), Buffer.from(mk(HTTPS, nl)));
    } finally { clean(s); }
  });
}

test("normalizer exits 0 when lockfile is missing", () => {
  const s = sandbox("normalize-tracker-lock.mjs");
  try { assert.equal(s.run().status, 0); } finally { clean(s); }
});

test("check-tracker-lock exits 1 on SSH lockfile", () => {
  const s = sandbox("check-tracker-lock.mjs", mk(SSH, "\n"));
  try {
    const r = s.run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /git\+ssh/);
  } finally { clean(s); }
});

test("check-tracker-lock exits 0 on HTTPS lockfile", () => {
  const s = sandbox("check-tracker-lock.mjs", mk(HTTPS, "\n"));
  try { assert.equal(s.run().status, 0); } finally { clean(s); }
});

test("check-tracker-lock passes on the real committed lockfile", () => {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", "check-tracker-lock.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
