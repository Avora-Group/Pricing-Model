import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Working copies are CRLF under core.autocrlf, so strip \r before any line-anchored match.
const read = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\r/g, "");

// Code only: drop /* ... */ block comments and every whole line that starts with //.
// A // inside a line is kept, because URLs in strings contain it.
const codeOnly = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");

const LOGIN = "src/app/api/auth/login/azure/route.ts";
const CALLBACK = "src/app/api/auth/callback/azure/route.ts";
const ACTIONS = "src/app/actions/auth.ts";
const HELPER = "src/lib/tracker-rt.ts";

const srcFiles = () =>
  readdirSync(join(ROOT, "src"), { recursive: true })
    .map((p) => String(p).split("\\").join("/"))
    .filter((p) => /\.(ts|tsx)$/.test(p))
    .map((p) => `src/${p}`);

// The top-level arguments of the call whose "(" sits at `open`, as trimmed source text.
function callArgs(code, open) {
  const args = [];
  let depth = 0;
  let quote = null;
  let start = open + 1;
  for (let i = open + 1; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" && depth === 0) {
      args.push(code.slice(start, i).trim());
      return args.filter((a) => a !== "");
    } else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      args.push(code.slice(start, i).trim());
      start = i + 1;
    }
  }
  throw new Error("unbalanced call");
}

test("both sign-in requests ask for offline_access", () => {
  for (const f of [LOGIN, CALLBACK]) {
    const s = read(f);
    assert.ok(s.includes("'openid email profile offline_access'"), `${f} lacks offline_access`);
    assert.ok(!s.includes("'openid email profile'"), `${f} still has the old scope`);
  }
});

test("callback captures tracker_rt in its own try/catch after access_token", () => {
  const code = codeOnly(read(CALLBACK));
  const from = code.indexOf("response.cookies.set('access_token'");
  assert.ok(from >= 0, "no access_token set");
  const to = code.indexOf("return response", from);
  assert.ok(to > from, "no return response after the access_token set");
  const seg = code.slice(from, to);

  const tryAt = seg.indexOf("try {");
  const captureAt = seg.indexOf("captureTrackerRt(");
  const catchMatch = /\}\s*catch\s*\{/.exec(seg.slice(captureAt));
  assert.ok(tryAt >= 0, "no inner try");
  assert.ok(captureAt > tryAt, "captureTrackerRt( is not inside the inner try");
  assert.ok(catchMatch, "no catch { without a binding after captureTrackerRt(");

  for (const needle of [
    "cookies.set(TRACKER_RT_COOKIE",
    "trackerRtCookieOptions",
    "cookies.delete(TRACKER_RT_DELETE)",
    "rawKey: process.env.TRACKER_RT_KEY",
    "sessionToken: token",
    "refreshToken: tokens.refresh_token",
  ]) {
    assert.ok(seg.includes(needle), `segment lacks ${needle}`);
  }
});

test("callback leaves access_token and the redirect as they were", () => {
  const s = read(CALLBACK);
  assert.match(
    s,
    /response\.cookies\.set\(\s*'access_token',\s*token,\s*\{\s*httpOnly:\s*true,\s*secure:\s*IS_PRODUCTION,\s*sameSite:\s*'lax',\s*maxAge:\s*7\s*\*\s*24\s*\*\s*3600,\s*path:\s*'\/',?\s*\}\s*\)/,
  );
  assert.ok(s.includes("NextResponse.redirect(new URL(next, req.url))"));
  assert.match(s, /\}\s*catch\s*\(e\)\s*\{\s*console\.error\('\[azure-callback\] Unexpected error:', e\)/);
});

test("logoutAction deletes access_token and tracker_rt before redirecting", () => {
  const code = codeOnly(read(ACTIONS));
  assert.ok(code.includes("import { TRACKER_RT_DELETE } from '@/lib/tracker-rt'"));
  const a = code.indexOf("cookieStore.delete('access_token')");
  const b = code.indexOf("cookieStore.delete(TRACKER_RT_DELETE)");
  const c = code.indexOf("redirect('/login')");
  assert.ok(a >= 0 && b > a && c > b, `order: ${a} ${b} ${c}`);
  assert.match(code, /cookieStore\.delete\('access_token'\)\n\s*cookieStore\.delete\(TRACKER_RT_DELETE\)\n/);
});

test("tracker_rt is deleted only through TRACKER_RT_DELETE", () => {
  let good = 0;
  for (const f of srcFiles()) {
    const code = codeOnly(read(f));
    assert.doesNotMatch(code, /\.delete\(\s*(['"]tracker_rt['"]|TRACKER_RT_COOKIE\b)/, `${f} deletes tracker_rt by name`);
    assert.doesNotMatch(code, /\.delete\(\s*\{[^}]*\.\.\.\s*trackerRtCookieOptions/, `${f} spreads trackerRtCookieOptions into a delete`);
    good += (code.match(/\.delete\(TRACKER_RT_DELETE\)/g) ?? []).length;
  }
  assert.ok(good >= 2, `expected the callback and logoutAction deletes, found ${good}`);
});

test("tracker_rt is set only with trackerRtCookieOptions", () => {
  let sets = 0;
  let withOptions = 0;
  for (const f of srcFiles()) {
    const code = codeOnly(read(f));
    const re = /cookies\.set\(/g;
    let m;
    while ((m = re.exec(code))) {
      const args = callArgs(code, m.index + m[0].length - 1);
      if (!/^(TRACKER_RT_COOKIE|'tracker_rt'|"tracker_rt")$/.test(args[0] ?? "")) continue;
      sets++;
      if (args[2] === "trackerRtCookieOptions") withOptions++;
      else assert.fail(`${f} sets tracker_rt without trackerRtCookieOptions`);
    }
  }
  assert.ok(sets >= 1, "no set of tracker_rt found");
  assert.equal(withOptions, sets);
});

test("the helper imports only jose and reads only NODE_ENV", () => {
  const code = codeOnly(read(HELPER));
  const specs = [
    ...[...code.matchAll(/^\s*import\s[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...code.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]),
  ];
  assert.ok(specs.length >= 1, "no import found");
  for (const s of specs) assert.equal(s, "jose");
  assert.doesNotMatch(code, /\bimport\s*\(/, "dynamic import");
  assert.doesNotMatch(code, /\brequire\s*\(/, "require");
  assert.doesNotMatch(code, /process\.env\s*\[/, "computed env read");
  const envReads = [...code.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
  assert.ok(envReads.length >= 1);
  for (const name of envReads) assert.equal(name, "NODE_ENV");
});
