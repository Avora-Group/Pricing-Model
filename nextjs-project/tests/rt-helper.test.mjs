import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server.js";
import { EncryptJWT, jwtDecrypt } from "jose";
import {
  TRACKER_RT_COOKIE,
  TRACKER_RT_DELETE,
  TRACKER_RT_MAX_AGE,
  TRACKER_RT_MAX_LENGTH,
  TRACKER_RT_SKIP_MESSAGES,
  trackerRtCookieOptions,
  trackerRtExp,
  parseTrackerRtKey,
  sealTrackerRt,
  sealTrackerRtCookie,
  openTrackerRt,
  sessionClaims,
  sessionSubject,
  checkTrackerRt,
  captureTrackerRt,
} from "../src/lib/tracker-rt.ts";

const JWE_PREFIX = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..";
const DAY = 24 * 3600;

const nowSec = () => Math.floor(Date.now() / 1000);
// A session deadline well past the 7-day window, so the window alone sets exp.
const far = () => nowSec() + 30 * DAY;
const keyStr = (n = 32) => randomBytes(n).toString("base64url");
const newKey = () => parseTrackerRtKey(keyStr());
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
// An unsigned FastAPI-shaped session token: { sub, role, exp }, HS256 header, fake signature.
const sessionToken = (claims) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "admin", ...claims })}.sig`;
const session = (sub, expOffset = 3600) => sessionToken({ sub, exp: nowSec() + expOffset });

// The callback's access_token options, as set in src/app/api/auth/callback/azure/route.ts.
const ACCESS_TOKEN_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: 7 * 24 * 3600,
  path: "/",
};

test("seal/open round trip keeps rt, sub and sexp", async () => {
  const key = newKey();
  const sexp = far();
  const jwe = await sealTrackerRt({ rt: "RT-VALUE", sub: "7", sexp }, key);
  assert.deepEqual(await openTrackerRt(jwe, key), { rt: "RT-VALUE", sub: "7", sexp });
});

test("sealed value is a dir/A256GCM compact JWE with exp 7 days after iat", async () => {
  const key = newKey();
  const jwe = await sealTrackerRt({ rt: "RT-VALUE", sub: "7", sexp: far() }, key);
  const parts = jwe.split(".");
  assert.equal(parts.length, 5);
  assert.equal(parts[1], "");
  assert.ok(jwe.startsWith(JWE_PREFIX), "unexpected protected header");
  const { payload, protectedHeader } = await jwtDecrypt(jwe, key);
  assert.deepEqual(protectedHeader, { alg: "dir", enc: "A256GCM" });
  assert.equal(typeof payload.iat, "number");
  assert.equal(payload.exp - payload.iat, 604800);
});

// ---- WR-01: the sign-in session's exp (sexp) is an absolute deadline

test("seal caps exp at sexp when the session ends inside 7 days", async () => {
  const key = newKey();
  const sexp = nowSec() + 3600;
  const { payload } = await jwtDecrypt(await sealTrackerRt({ rt: "RT-VALUE", sub: "7", sexp }, key), key);
  assert.equal(payload.exp, sexp);
  assert.equal(payload.sexp, sexp);
});

test("trackerRtExp is min(now + 7 days, sexp)", () => {
  const now = 1_900_000_000;
  assert.equal(trackerRtExp(now + 30 * DAY, now), now + TRACKER_RT_MAX_AGE);
  assert.equal(trackerRtExp(now + 3600, now), now + 3600);
});

test("a re-seal at a later time never extends past the original sexp", async () => {
  const key = newKey();
  const start = nowSec();
  const sexp = start + 6 * DAY;
  const first = await openTrackerRt(await sealTrackerRt({ rt: "RT-ONE", sub: "7", sexp }, key, start), key);
  assert.equal(first.sexp, sexp);
  // Five days on, a rotation re-seals with what the cookie carried. Seven days
  // from then would be start + 12 days; the deadline holds it at start + 6.
  const later = start + 5 * DAY;
  const resealed = await sealTrackerRt({ rt: "RT-TWO", sub: first.sub, sexp: first.sexp }, key, later);
  const { payload } = await jwtDecrypt(resealed, key, { currentDate: new Date(later * 1000) });
  assert.equal(payload.exp, sexp);
  assert.equal(payload.sexp, sexp);
  assert.ok(payload.exp < later + TRACKER_RT_MAX_AGE);
});

test("a forged far-future access_token does not move the deadline", async () => {
  const raw = keyStr();
  const key = parseTrackerRtKey(raw);
  const sexp = nowSec() + 3600;
  const { sealed } = await captureTrackerRt({
    rawKey: raw,
    sessionToken: sessionToken({ sub: "42", exp: sexp }),
    refreshToken: "RT-VALUE",
  });
  const forged = sessionToken({ sub: "42", exp: nowSec() + 365 * DAY });
  const check = await checkTrackerRt({ accessToken: forged, trackerRt: sealed, key });
  assert.equal(check.ok, true);
  assert.equal(check.sexp, sexp);
});

test("sealTrackerRt refuses a past, missing or non-integer sexp", async () => {
  const key = newKey();
  for (const sexp of [nowSec() - 1, nowSec(), undefined, null, "9999999999", nowSec() + 3600.5, NaN, Infinity]) {
    await assert.rejects(sealTrackerRt({ rt: "RT-VALUE", sub: "7", sexp }, key), `sexp ${String(sexp)}`);
  }
});

test("captureTrackerRt seals the refresh token for the session sub and exp", async () => {
  const raw = keyStr();
  const sexp = nowSec() + 3600;
  const result = await captureTrackerRt({
    rawKey: raw,
    sessionToken: sessionToken({ sub: "42", exp: sexp }),
    refreshToken: "RT-VALUE",
  });
  assert.equal(result.skipped, null);
  assert.equal(typeof result.sealed, "string");
  assert.ok(result.sealed.startsWith(JWE_PREFIX));
  assert.deepEqual(await openTrackerRt(result.sealed, parseTrackerRtKey(raw)), { rt: "RT-VALUE", sub: "42", sexp });
  // The cookie's maxAge runs out with the JWE: the session's remaining seconds.
  assert.ok(result.maxAge > 3590 && result.maxAge <= 3600, `maxAge ${result.maxAge}`);
});

test("captureTrackerRt caps maxAge at 7 days for a longer session", async () => {
  const result = await captureTrackerRt({ rawKey: keyStr(), sessionToken: session("42", 30 * DAY), refreshToken: "RT" });
  assert.equal(result.maxAge, TRACKER_RT_MAX_AGE);
});

test("checkTrackerRt accepts the cookie the callback sets", async () => {
  const raw = keyStr();
  const sexp = nowSec() + 3600;
  const access = sessionToken({ sub: "42", exp: sexp });
  const { sealed } = await captureTrackerRt({ rawKey: raw, sessionToken: access, refreshToken: "RT-VALUE" });
  const check = await checkTrackerRt({ accessToken: access, trackerRt: sealed, key: parseTrackerRtKey(raw) });
  assert.deepEqual(check, { ok: true, rt: "RT-VALUE", sub: "42", sexp });
});

test("cookie options are RT-03, with maxAge clamped to 0..7 days", () => {
  assert.equal(TRACKER_RT_COOKIE, "tracker_rt");
  const options = trackerRtCookieOptions(TRACKER_RT_MAX_AGE);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.maxAge, 604800);
  assert.equal(options.path, "/api/tracker");
  assert.equal(options.secure, process.env.NODE_ENV === "production");
  assert.equal(trackerRtCookieOptions(3600.9).maxAge, 3600);
  assert.equal(trackerRtCookieOptions(30 * DAY).maxAge, 604800);
  assert.equal(trackerRtCookieOptions(-5).maxAge, 0);
  assert.deepEqual(TRACKER_RT_DELETE, { name: "tracker_rt", path: "/api/tracker" });
});

test("callback redirect carries access_token and tracker_rt as separate cookies", async () => {
  const sealed = await sealTrackerRt({ rt: "RT-VALUE", sub: "7", sexp: far() }, newKey());
  const response = NextResponse.redirect(new URL("/dashboard", "http://localhost:3000/api/auth/callback/azure"));
  response.cookies.set("access_token", session("7"), ACCESS_TOKEN_OPTIONS);
  response.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions(TRACKER_RT_MAX_AGE));
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  const access = cookies.find((c) => c.startsWith("access_token="));
  const rt = cookies.find((c) => c.startsWith("tracker_rt="));
  assert.ok(access, "no access_token Set-Cookie");
  assert.ok(access.includes("Path=/;"), access);
  assert.ok(rt, "no tracker_rt Set-Cookie");
  assert.ok(rt.includes("Path=/api/tracker"), "tracker_rt path");
  assert.ok(rt.includes("Max-Age=604800"), "tracker_rt Max-Age");
  assert.ok(rt.includes("HttpOnly"), "tracker_rt HttpOnly");
  assert.ok(rt.includes("SameSite=lax"), "tracker_rt SameSite");
});

// A JWE built directly with jose, so a test can choose its claims and exp (or leave exp out).
const rawJwe = async (claims, key, exp) => {
  let jwt = new EncryptJWT(claims).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt();
  if (exp !== undefined) jwt = jwt.setExpirationTime(exp);
  return jwt.encrypt(key);
};

test("parseTrackerRtKey accepts exactly 32 bytes", () => {
  const key = parseTrackerRtKey(keyStr(32));
  assert.ok(key instanceof Uint8Array);
  assert.equal(key.length, 32);
});

test("parseTrackerRtKey trims surrounding whitespace", () => {
  const raw = keyStr(32);
  assert.deepEqual(parseTrackerRtKey(` ${raw}\n`), parseTrackerRtKey(raw));
});

for (const [name, raw] of [
  ["undefined", undefined],
  ['""', ""],
  ['"!!!!"', "!!!!"],
  ["16 random bytes", keyStr(16)],
  ["31 random bytes", keyStr(31)],
  ["33 random bytes", keyStr(33)],
  // IN-01: standard base64 of 32 bytes (openssl rand -base64 32) is refused on every runtime.
  ["standard base64 of 32 bytes", randomBytes(32).toString("base64")],
  ["43 characters with a + or /", `${keyStr().slice(0, 41)}+/`],
]) {
  test(`parseTrackerRtKey rejects ${name}`, () => {
    assert.equal(parseTrackerRtKey(raw), null);
  });
}

test("openTrackerRt rejects a wrong key", async () => {
  const jwe = await sealTrackerRt({ rt: "RT-VALUE", sub: "7", sexp: far() }, newKey());
  assert.equal(await openTrackerRt(jwe, newKey()), null);
});

test("openTrackerRt rejects a past exp", async () => {
  const key = newKey();
  const jwe = await rawJwe({ rt: "RT-VALUE", sub: "7", sexp: far() }, key, nowSec() - 60);
  assert.equal(await openTrackerRt(jwe, key), null);
});

test("openTrackerRt rejects a JWE without exp", async () => {
  const key = newKey();
  const jwe = await rawJwe({ rt: "RT-VALUE", sub: "7", sexp: far() }, key);
  assert.equal(await openTrackerRt(jwe, key), null);
});

for (const [name, claims] of [
  ["no sexp", { rt: "RT-VALUE", sub: "7" }],
  ["a string sexp", { rt: "RT-VALUE", sub: "7", sexp: String(nowSec() + 3600) }],
  ["a fractional sexp", { rt: "RT-VALUE", sub: "7", sexp: nowSec() + 3600.5 }],
  ["a zero sexp", { rt: "RT-VALUE", sub: "7", sexp: 0 }],
  ["an exp later than sexp", { rt: "RT-VALUE", sub: "7", sexp: nowSec() + 60 }],
]) {
  test(`openTrackerRt rejects ${name}`, async () => {
    const key = newKey();
    const jwe = await rawJwe(claims, key, nowSec() + 3600);
    assert.equal(await openTrackerRt(jwe, key), null);
  });
}

{
  const key = newKey();
  for (const [name, value] of [
    ['""', async () => ""],
    ['"garbage"', async () => "garbage"],
    ['"a.b.c.d.e"', async () => "a.b.c.d.e"],
    ["a truncated JWE", async () => (await sealTrackerRt({ rt: "RT-VALUE", sub: "7", sexp: far() }, key)).slice(0, -4)],
  ]) {
    test(`openTrackerRt rejects ${name}`, async () => {
      assert.equal(await openTrackerRt(await value(), key), null);
    });
  }
}

test("openTrackerRt rejects non-string claims", async () => {
  const key = newKey();
  const jwe = await rawJwe({ rt: 12345, sub: "7", sexp: far() }, key, nowSec() + 3600);
  assert.equal(await openTrackerRt(jwe, key), null);
});

test("sessionSubject reads sub from a FastAPI-shaped token", () => {
  assert.equal(sessionSubject(session("42")), "42");
});

test("sessionClaims reads sub and a whole-second exp", () => {
  const exp = nowSec() + 3600;
  assert.deepEqual(sessionClaims(sessionToken({ sub: "42", exp })), { sub: "42", exp });
  assert.deepEqual(sessionClaims(sessionToken({ sub: "42", exp: exp + 0.7 })), { sub: "42", exp });
});

test("sessionSubject treats exp equal to now as expired", () => {
  const now = 1_900_000_000;
  assert.equal(sessionSubject(sessionToken({ sub: "42", exp: now }), now), null);
  assert.equal(sessionSubject(sessionToken({ sub: "42", exp: now + 1 }), now), "42");
});

for (const [name, token] of [
  ["undefined", undefined],
  ['"garbage"', "garbage"],
  ["an expired token", session("42", -60)],
  ["a token without sub", sessionToken({ exp: nowSec() + 3600 })],
  ["a token whose exp is a string", sessionToken({ sub: "42", exp: String(nowSec() + 3600) })],
]) {
  test(`sessionSubject rejects ${name}`, () => {
    assert.equal(sessionSubject(token), null);
  });
}

test("checkTrackerRt: no or expired session is reauth without clearing", async () => {
  const key = newKey();
  const trackerRt = await sealTrackerRt({ rt: "RT-VALUE", sub: "42", sexp: far() }, key);
  assert.deepEqual(await checkTrackerRt({ accessToken: undefined, trackerRt, key }), { ok: false, clear: false });
  assert.deepEqual(await checkTrackerRt({ accessToken: session("42", -60), trackerRt, key }), { ok: false, clear: false });
});

test("checkTrackerRt: missing tracker_rt is reauth without clearing", async () => {
  const key = newKey();
  for (const trackerRt of [undefined, ""]) {
    assert.deepEqual(await checkTrackerRt({ accessToken: session("42"), trackerRt, key }), { ok: false, clear: false });
  }
});

{
  const key = newKey();
  for (const [name, cookie] of [
    ["garbage", async () => "garbage"],
    ["a wrong key", async () => sealTrackerRt({ rt: "RT-VALUE", sub: "42", sexp: far() }, newKey())],
    ["a past exp", async () => rawJwe({ rt: "RT-VALUE", sub: "42", sexp: far() }, key, nowSec() - 60)],
    ["a missing exp", async () => rawJwe({ rt: "RT-VALUE", sub: "42", sexp: far() }, key)],
    ["a missing sexp", async () => rawJwe({ rt: "RT-VALUE", sub: "42" }, key, nowSec() + 3600)],
    ["another user's sub", async () => sealTrackerRt({ rt: "RT-VALUE", sub: "99", sexp: far() }, key)],
  ]) {
    test(`checkTrackerRt clears ${name}`, async () => {
      const check = await checkTrackerRt({ accessToken: session("42"), trackerRt: await cookie(), key });
      assert.deepEqual(check, { ok: false, clear: true });
    });
  }
}

test("checkTrackerRt decisions are independent across parallel calls", async () => {
  const key = newKey();
  const sexp = far();
  const [a, b] = await Promise.all([
    sealTrackerRt({ rt: "RT-ONE", sub: "1", sexp }, key),
    sealTrackerRt({ rt: "RT-TWO", sub: "2", sexp }, key),
  ]);
  const [ca, cb] = await Promise.all([
    checkTrackerRt({ accessToken: session("1"), trackerRt: a, key }),
    checkTrackerRt({ accessToken: session("2"), trackerRt: b, key }),
  ]);
  assert.deepEqual(ca, { ok: true, rt: "RT-ONE", sub: "1", sexp });
  assert.deepEqual(cb, { ok: true, rt: "RT-TWO", sub: "2", sexp });
});

test("captureTrackerRt skips with no-key for an unset or empty key", async () => {
  for (const rawKey of [undefined, ""]) {
    const result = await captureTrackerRt({ rawKey, sessionToken: session("42"), refreshToken: "RT-VALUE" });
    assert.deepEqual(result, { sealed: null, skipped: "no-key" });
  }
});

test("captureTrackerRt skips with malformed-key for a bad key", async () => {
  for (const rawKey of ["!!!!", keyStr(16), keyStr(33)]) {
    const result = await captureTrackerRt({ rawKey, sessionToken: session("42"), refreshToken: "RT-VALUE" });
    assert.deepEqual(result, { sealed: null, skipped: "malformed-key" });
  }
});

test("captureTrackerRt skips with no-session for a token without a usable sub", async () => {
  for (const sessionTok of [undefined, "garbage", session("42", -60), sessionToken({ exp: nowSec() + 3600 })]) {
    const result = await captureTrackerRt({ rawKey: keyStr(), sessionToken: sessionTok, refreshToken: "RT-VALUE" });
    assert.deepEqual(result, { sealed: null, skipped: "no-session" });
  }
});

test("captureTrackerRt skips with no-refresh-token", async () => {
  for (const refreshToken of [undefined, null, "", 42]) {
    const result = await captureTrackerRt({ rawKey: keyStr(), sessionToken: session("42"), refreshToken });
    assert.deepEqual(result, { sealed: null, skipped: "no-refresh-token" });
  }
});

test("captureTrackerRt skips with too-large above TRACKER_RT_MAX_LENGTH", async () => {
  assert.equal(TRACKER_RT_MAX_LENGTH, 3800);
  const result = await captureTrackerRt({ rawKey: keyStr(), sessionToken: session("42"), refreshToken: "r".repeat(4000) });
  assert.deepEqual(result, { sealed: null, skipped: "too-large" });
});

// ---- WR-02: one size-guarded seal for the callback and the rotation re-seal

test("sealTrackerRtCookie seals and reports maxAge until the JWE's exp", async () => {
  const key = newKey();
  const now = nowSec();
  const sexp = now + 3 * DAY;
  const result = await sealTrackerRtCookie({ rt: "RT-VALUE", sub: "7", sexp }, key, now);
  assert.equal(result.skipped, null);
  assert.equal(result.maxAge, 3 * DAY);
  assert.deepEqual(await openTrackerRt(result.sealed, key), { rt: "RT-VALUE", sub: "7", sexp });
});

test("sealTrackerRtCookie skips too-large for a rotated token that would not fit", async () => {
  const result = await sealTrackerRtCookie({ rt: "r".repeat(4000), sub: "7", sexp: far() }, newKey());
  assert.deepEqual(result, { sealed: null, skipped: "too-large" });
});

test("sealTrackerRtCookie skips seal-failed instead of throwing", async () => {
  const result = await sealTrackerRtCookie({ rt: "RT-VALUE", sub: "7", sexp: nowSec() - 1 }, newKey());
  assert.deepEqual(result, { sealed: null, skipped: "seal-failed" });
});

test("captureTrackerRt reports the first failure in key, session, refresh-token order", async () => {
  const malformed = await captureTrackerRt({ rawKey: "!!!!", sessionToken: session("42"), refreshToken: undefined });
  assert.equal(malformed.skipped, "malformed-key");
  const noSession = await captureTrackerRt({ rawKey: keyStr(), sessionToken: "garbage", refreshToken: undefined });
  assert.equal(noSession.skipped, "no-session");
});

test("TRACKER_RT_SKIP_MESSAGES names a step and carries no value", () => {
  assert.deepEqual(Object.keys(TRACKER_RT_SKIP_MESSAGES).sort(), [
    "malformed-key",
    "no-key",
    "no-refresh-token",
    "no-session",
    "seal-failed",
    "too-large",
  ]);
  assert.equal(TRACKER_RT_SKIP_MESSAGES["no-key"], null);
  assert.equal(TRACKER_RT_SKIP_MESSAGES["malformed-key"], "TRACKER_RT_KEY is malformed");
  for (const [reason, message] of Object.entries(TRACKER_RT_SKIP_MESSAGES)) {
    if (reason === "no-key") continue;
    assert.equal(typeof message, "string", reason);
    assert.ok(message.length > 0, reason);
    assert.ok(!message.includes("="), reason);
  }
});

test("deleting tracker_rt emits an expired cookie on its path and replaces an earlier set", async () => {
  const sealed = await sealTrackerRt({ rt: "RT-VALUE", sub: "7", sexp: far() }, newKey());
  const response = NextResponse.redirect(new URL("/dashboard", "http://localhost:3000/api/auth/callback/azure"));
  response.cookies.set("access_token", session("7"), ACCESS_TOKEN_OPTIONS);
  response.cookies.set(TRACKER_RT_COOKIE, sealed, trackerRtCookieOptions(TRACKER_RT_MAX_AGE));
  const accessBefore = response.headers.getSetCookie().find((c) => c.startsWith("access_token="));
  response.cookies.delete(TRACKER_RT_DELETE);
  const cookies = response.headers.getSetCookie();
  const rt = cookies.filter((c) => c.startsWith("tracker_rt="));
  assert.equal(rt.length, 1);
  assert.equal(rt[0], "tracker_rt=; Path=/api/tracker; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  assert.ok(!rt[0].includes("Max-Age"));
  assert.equal(cookies.find((c) => c.startsWith("access_token=")), accessBefore);
  assert.equal(cookies.length, 2);
});
