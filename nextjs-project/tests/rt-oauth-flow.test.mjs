// WR-03: the Azure sign-in's state nonce and PKCE (src/lib/oauth-flow.ts), and
// how the login and callback routes wire them in.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server.js";
import {
  OAUTH_FLOW_COOKIE,
  OAUTH_FLOW_PATH,
  OAUTH_FLOW_MAX_AGE,
  OAUTH_FLOW_DELETE,
  oauthFlowCookieOptions,
  newOAuthFlow,
  pkceChallenge,
  serializeOAuthFlow,
  parseOAuthFlow,
  buildOAuthState,
  parseOAuthState,
  nonceMatches,
} from "../src/lib/oauth-flow.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\r/g, "");
const codeOnly = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");

const LOGIN = "src/app/api/auth/login/azure/route.ts";
const CALLBACK = "src/app/api/auth/callback/azure/route.ts";
const HELPER = "src/lib/oauth-flow.ts";
const TOKEN43 = /^[A-Za-z0-9_-]{43}$/;

// ---- helpers

test("newOAuthFlow makes a 43-character base64url nonce and verifier, fresh each time", () => {
  const a = newOAuthFlow();
  const b = newOAuthFlow();
  for (const v of [a.nonce, a.verifier, b.nonce, b.verifier]) assert.match(v, TOKEN43);
  assert.notEqual(a.nonce, a.verifier);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.verifier, b.verifier);
});

test("pkceChallenge is S256 per RFC 7636 appendix B", () => {
  assert.equal(
    pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
  const { verifier } = newOAuthFlow();
  assert.match(pkceChallenge(verifier), TOKEN43);
  assert.notEqual(pkceChallenge(verifier), verifier);
});

test("the flow cookie value round-trips", () => {
  const flow = newOAuthFlow();
  const raw = serializeOAuthFlow(flow);
  assert.equal(raw, `${flow.nonce}.${flow.verifier}`);
  assert.deepEqual(parseOAuthFlow(raw), flow);
});

{
  const { nonce, verifier } = newOAuthFlow();
  for (const [name, raw] of [
    ["undefined", undefined],
    ["null", null],
    ['""', ""],
    ["one part", nonce],
    ["three parts", `${nonce}.${verifier}.${nonce}`],
    ["an empty verifier", `${nonce}.`],
    ["a short nonce", `${nonce.slice(1)}.${verifier}`],
    ["a long verifier", `${nonce}.${verifier}A`],
    ["standard base64 characters", `${nonce.slice(0, 42)}+.${verifier}`],
  ]) {
    test(`parseOAuthFlow rejects ${name}`, () => {
      assert.equal(parseOAuthFlow(raw), null);
    });
  }
}

test("state carries the nonce and the post-login path, split at the first dot", () => {
  const { nonce } = newOAuthFlow();
  for (const next of ["/dashboard", "/quotes/12?tab=a.b&x=1", "/"]) {
    const state = buildOAuthState(nonce, next);
    assert.deepEqual(parseOAuthState(state), { nonce, next });
  }
  assert.deepEqual(parseOAuthState(`${nonce}.`), { nonce, next: "" });
});

{
  const { nonce } = newOAuthFlow();
  for (const [name, state] of [
    ["null", null],
    ['""', ""],
    ["a bare path (the pre-WR-03 state)", "/dashboard"],
    ["a nonce without a dot", nonce],
    ["a short nonce", `${nonce.slice(2)}./dashboard`],
    ["a nonce with a bad character", `${nonce.slice(0, 42)}!./dashboard`],
  ]) {
    test(`parseOAuthState rejects ${name}`, () => {
      assert.equal(parseOAuthState(state), null);
    });
  }
}

test("nonceMatches is true only for the same nonce", () => {
  const a = newOAuthFlow().nonce;
  const b = newOAuthFlow().nonce;
  assert.equal(nonceMatches(a, a), true);
  assert.equal(nonceMatches(a, `${a}`), true);
  assert.equal(nonceMatches(a, b), false);
  assert.equal(nonceMatches(a, a.slice(1)), false);
  assert.equal(nonceMatches("", a), false);
});

test("the flow cookie is httpOnly, Lax, 10 minutes and scoped to the callback", () => {
  assert.equal(OAUTH_FLOW_COOKIE, "azure_oauth");
  assert.equal(OAUTH_FLOW_PATH, "/api/auth/callback/azure");
  assert.equal(OAUTH_FLOW_MAX_AGE, 600);
  assert.deepEqual({ ...oauthFlowCookieOptions }, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/auth/callback/azure",
  });
  assert.deepEqual({ ...OAUTH_FLOW_DELETE }, { name: "azure_oauth", path: "/api/auth/callback/azure" });
  assert.ok(Object.isFrozen(oauthFlowCookieOptions));
  assert.ok(Object.isFrozen(OAUTH_FLOW_DELETE));
});

test("Next serializes the flow cookie set and delete with its path", () => {
  const set = NextResponse.redirect("https://login.microsoftonline.com/t/oauth2/v2.0/authorize");
  set.cookies.set(OAUTH_FLOW_COOKIE, serializeOAuthFlow(newOAuthFlow()), oauthFlowCookieOptions);
  const [c] = set.headers.getSetCookie();
  for (const part of ["Path=/api/auth/callback/azure", "Max-Age=600", "HttpOnly", "SameSite=lax"]) {
    assert.ok(c.includes(part), `set lacks ${part}`);
  }
  const del = NextResponse.redirect(new URL("/login", "http://localhost:3000/api/auth/callback/azure"));
  del.cookies.delete(OAUTH_FLOW_DELETE);
  assert.deepEqual(del.headers.getSetCookie(), [
    "azure_oauth=; Path=/api/auth/callback/azure; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ]);
});

// ---- wiring

test("oauth-flow imports only node:crypto and reads only NODE_ENV", () => {
  const code = codeOnly(read(HELPER));
  const specs = [...code.matchAll(/^\s*import\s[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.deepEqual(specs, ["node:crypto"]);
  const envReads = [...code.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
  for (const name of envReads) assert.equal(name, "NODE_ENV");
});

test("login route sends the nonce in state, the S256 challenge, and sets the flow cookie", () => {
  const code = codeOnly(read(LOGIN));
  for (const needle of [
    "const next = sanitizeNext(req.nextUrl.searchParams.get('next'))",
    "const flow = newOAuthFlow()",
    "state: buildOAuthState(flow.nonce, next)",
    "code_challenge: pkceChallenge(flow.verifier)",
    "code_challenge_method: 'S256'",
    "cookies.set(OAUTH_FLOW_COOKIE, serializeOAuthFlow(flow), oauthFlowCookieOptions)",
  ]) {
    assert.ok(code.includes(needle), `login route lacks ${needle}`);
  }
  assert.doesNotMatch(code, /state:\s*next\b/, "login route still sends the bare path as state");
  // The verifier itself only ever reaches the cookie and the challenge, never the authorize URL.
  assert.ok(!code.includes("code_verifier"), "login route sends a code_verifier");
  assert.equal((code.match(/flow\.verifier/g) ?? []).length, 1, "flow.verifier is used outside pkceChallenge(");
});

test("callback checks the nonce before the code exchange and sends the verifier", () => {
  const code = codeOnly(read(CALLBACK));
  assert.ok(code.includes("const state = parseOAuthState(req.nextUrl.searchParams.get('state'))"));
  assert.ok(code.includes("const next = sanitizeNext(state?.next)"), "next is not re-validated with sanitizeNext");
  assert.ok(code.includes("parseOAuthFlow(req.cookies.get(OAUTH_FLOW_COOKIE)?.value)"));
  const checkAt = code.indexOf("!nonceMatches(state.nonce, flow.nonce)");
  const exchangeAt = code.indexOf("oauth2/v2.0/token");
  assert.ok(checkAt >= 0, "no nonceMatches check");
  assert.ok(exchangeAt > checkAt, "the nonce check is not before the code exchange");
  const reject = code.indexOf("return loginRedirect(req, 'azure_failed', next)", checkAt);
  assert.ok(reject > checkAt && reject < exchangeAt, "a failed nonce check does not reject with azure_failed");
  assert.ok(code.includes("code_verifier: flow.verifier"), "the code exchange lacks code_verifier");
  assert.doesNotMatch(code, /nonce\s*[!=]==?\s*/, "nonces compared with == instead of nonceMatches");
});

test("callback deletes the flow cookie on every answer", () => {
  const code = codeOnly(read(CALLBACK));
  const fn = code.slice(code.indexOf("function loginRedirect("), code.indexOf("export async function GET("));
  assert.ok(fn.includes("cookies.delete(OAUTH_FLOW_DELETE)"), "loginRedirect does not delete the flow cookie");
  const from = code.indexOf("response.cookies.set('access_token'");
  const to = code.indexOf("return response", from);
  assert.ok(code.slice(from, to).includes("response.cookies.delete(OAUTH_FLOW_DELETE)"), "success path keeps the flow cookie");
  assert.doesNotMatch(code, /\.delete\(\s*['"]azure_oauth['"]/, "the flow cookie is deleted by name, without its path");
  const returns = [...code.matchAll(/\breturn\s+(\w+)/g)].map((m) => m[1]);
  for (const r of returns) assert.ok(["loginRedirect", "response"].includes(r), `unexpected return ${r}`);
});
