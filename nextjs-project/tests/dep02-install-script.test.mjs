import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "vercel-install.sh");
const TOKEN = "ghp_TESTTOKEN123";
const realGlobal = () => spawnSync("git", ["config", "--global", "--list"], { encoding: "utf8" }).stdout;

let base, fakeHome, bin, work, realBefore;

const STUB = [
  "#!/usr/bin/env bash",
  'out="$PWD/npm-out.txt"',
  "{",
  "  echo CALLED",
  '  echo "GITDIR=$(dirname "$GIT_CONFIG_GLOBAL")"',
  "  echo --CONFIG",
  "  git config --global --list",
  "  echo --LS",
  '  ls "$(dirname "$GIT_CONFIG_GLOBAL")/creds"',
  '} > "$out" 2>&1',
  "",
].join("\n");

before(() => {
  realBefore = realGlobal();
  base = mkdtempSync(join(tmpdir(), "vinst-"));
  fakeHome = join(base, "home");
  bin = join(base, "bin");
  work = join(base, "work");
  for (const d of [fakeHome, bin, work]) mkdirSync(d);
  writeFileSync(join(bin, "npm"), STUB);
  chmodSync(join(bin, "npm"), 0o755);
});

after(() => {
  const now = realGlobal();
  rmSync(base, { recursive: true, force: true });
  assert.equal(now, realBefore, "real global git config changed");
});

function run(tokenEnv) {
  rmSync(join(work, "npm-out.txt"), { force: true });
  const env = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    GIT_CONFIG_GLOBAL: join(fakeHome, "fake-gitconfig"),
    PATH: bin + delimiter + process.env.PATH,
  };
  delete env.TRACKER_REPO_TOKEN;
  Object.assign(env, tokenEnv);
  const r = spawnSync("bash", [SCRIPT], { cwd: work, env, encoding: "utf8" });
  const out = join(work, "npm-out.txt");
  return { r, npmOut: existsSync(out) ? readFileSync(out, "utf8") : null };
}

for (const [name, env] of [["unset", {}], ["empty", { TRACKER_REPO_TOKEN: "" }]]) {
  test(`${name} TRACKER_REPO_TOKEN fails with stderr error and never calls npm`, () => {
    const { r, npmOut } = run(env);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /TRACKER_REPO_TOKEN/);
    assert.equal(npmOut, null);
  });
}

test("with a token: succeeds, leaks nothing, config rewrites ssh to https", () => {
  const { r, npmOut } = run({ TRACKER_REPO_TOKEN: TOKEN });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(npmOut, "npm stub was not called");
  assert.ok(!r.stdout.includes(TOKEN) && !r.stderr.includes(TOKEN));
  const cfg = npmOut.split("--CONFIG")[1].split("--LS")[0];
  assert.ok(!cfg.includes(TOKEN), "token in git config");
  const lines = cfg.split(/\r?\n/).filter(Boolean);
  const helpers = lines.filter((l) => l.startsWith("credential.helper="));
  assert.equal(helpers.length, 2);
  assert.equal(helpers[0], "credential.helper=");
  assert.match(helpers[1], /^credential\.helper=store --file=/);
  const rewrites = lines
    .filter((l) => l.startsWith("url.https://github.com/.insteadof="))
    .map((l) => l.split("=")[1])
    .sort();
  assert.deepEqual(rewrites, ["git@github.com:", "ssh://git@github.com/"]);
  const ls = npmOut.split("--LS")[1];
  assert.match(ls, /creds/);
  assert.ok(!/No such file/.test(ls), "creds file missing while npm ran");
});

test("script's temp git dir is removed after exit", () => {
  const { r, npmOut } = run({ TRACKER_REPO_TOKEN: TOKEN });
  assert.equal(r.status, 0, r.stderr);
  const gitDir = npmOut.match(/^GITDIR=(.*)$/m)[1].trim();
  const t = spawnSync("bash", ["-c", 'test -e "$1" && echo exists || echo gone', "_", gitDir], { encoding: "utf8" });
  assert.equal(t.stdout.trim(), "gone");
});

test("nothing is written to HOME", () => {
  run({ TRACKER_REPO_TOKEN: TOKEN });
  assert.ok(!existsSync(join(fakeHome, ".gitconfig")));
  assert.ok(!existsSync(join(fakeHome, ".git-credentials")));
});
