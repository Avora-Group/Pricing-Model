// IN-03: behavioural tests for POST /api/tracker/token's logic
// (src/lib/tracker-token.ts) against a mocked Entra token endpoint. Covers the
// 200 paths the HTTP smoke cannot reach: a redeem with and without rotation,
// a re-seal that is skipped, and Entra's invalid_grant keeping the cookie.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { registerHooks } from "node:module";

// Next resolves the "@/" alias and the extensionless "next/server"; Node's ESM
// loader does neither. Map both for the import below. Test-only, this process only.
const SRC = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`${specifier.slice(2)}.ts`, SRC).href, context);
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    return nextResolve(specifier, context);
  },
});

const { trackerTokenResponse } = await import("../src/lib/tracker-token.ts");
const { parseTrackerRtKey, sealTrackerRt, openTrackerRt, TRACKER_RT_MAX_AGE } = await import("../src/lib/tracker-rt.ts");

const DAY = 24 * 3600;
const nowSec = () => Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
// An unsigned FastAPI-shaped session token, as the route decodes it (D-02).
const sessionToken = (claims) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "admin", ...claims })}.sig`;

const KEY = randomBytes(32).toString("base64url");
const KEY_BYTES = parseTrackerRtKey(KEY);
const ENV = Object.freeze({
  TRACKER_API_SCOPE: "api://tracker-test/access_as_user",
  TRACKER_RT_KEY: KEY,
  AZURE_TENANT_ID: "tenant-test",
  AZURE_CLIENT_ID: "client-test",
  AZURE_CLIENT_SECRET: "secret-test-value",
});
const ORIGINAL_RT = "RT-ORIGINAL-test-value";
// Values that must never reach a response body or a log line. The new access
// token belongs in the 200 body, so it is checked against the log only.
const BODY_SECRETS = [ORIGINAL_RT, "RT-ROTATED-test-value", ENV.AZURE_CLIENT_SECRET, KEY];
const LOG_SECRETS = [...BODY_SECRETS, "AT-NEW-test-value"];

/** A signed-in browser: a session token and a tracker_rt sealed at sign-in. */
async function signedIn({ sub = "42", sexpOffset = 3 * DAY } = {}) {
  const sexp = nowSec() + sexpOffset;
  const accessToken = sessionToken({ sub, exp: sexp });
  const trackerRt = await sealTrackerRt({ rt: ORIGINAL_RT, sub, sexp }, KEY_BYTES);
  return { accessToken, trackerRt, sexp };
}

/** A mocked Entra token endpoint answering `status` with `body`, recording each call. */
function entra(status, body) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), body: new URLSearchParams(String(init?.body ?? "")) });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { fetch, calls };
}

const silenceErrors = (t) => t.mock.method(console, "error", () => {});
// Every console.error line, and the route's own lines. Node prints its
// MODULE_TYPELESS_PACKAGE_JSON warning for a .ts import through console.error
// too, at a time a spy may catch, so assertions about the route's logging look
// only at lines with its "tracker-token" prefix.
const allLogged = (spy) => spy.mock.calls.map((c) => c.arguments.map(String).join(" "));
const logged = (spy) => allLogged(spy).filter((line) => line.startsWith("tracker-token"));

async function read(res) {
  return {
    status: res.status,
    text: await res.text(),
    cacheControl: res.headers.get("cache-control") ?? "",
    contentType: res.headers.get("content-type") ?? "",
    setCookies: res.headers.getSetCookie(),
  };
}

function assertNoLeak(r, spy) {
  for (const v of BODY_SECRETS) assert.ok(!r.text.includes(v), "a secret value reached the response body");
  for (const v of LOG_SECRETS) {
    for (const line of allLogged(spy)) assert.ok(!line.includes(v), "a secret value reached a log line");
  }
}

const trackerRtValue = (setCookie) => decodeURIComponent(setCookie.slice("tracker_rt=".length).split(";")[0]);
const maxAgeOf = (setCookie) => Number(/Max-Age=(\d+)/.exec(setCookie)?.[1]);

test("a redeem with rotation answers 200 and re-seals the rotated token for the same sub and deadline", async (t) => {
  const spy = silenceErrors(t);
  const { accessToken, trackerRt, sexp } = await signedIn();
  const mock = entra(200, {
    token_type: "Bearer",
    access_token: "AT-NEW-test-value",
    expires_in: 3600,
    refresh_token: "RT-ROTATED-test-value",
  });
  const r = await read(await trackerTokenResponse({ accessToken, trackerRt, env: ENV, fetch: mock.fetch }));

  assert.equal(r.status, 200);
  assert.ok(r.cacheControl.includes("no-store"), `cache-control ${r.cacheControl}`);
  assert.ok(r.contentType.startsWith("application/json"), r.contentType);
  const body = JSON.parse(r.text);
  assert.deepEqual(Object.keys(body).sort(), ["accessToken", "expiresAt"]);
  assert.equal(body.accessToken, "AT-NEW-test-value");

  // The Entra call: one refresh-token grant with the cookie's token and the tracker scope.
  assert.equal(mock.calls.length, 1);
  assert.ok(mock.calls[0].url.includes("/tenant-test/oauth2/v2.0/token"), "token endpoint");
  assert.equal(mock.calls[0].body.get("grant_type"), "refresh_token");
  assert.equal(mock.calls[0].body.get("refresh_token"), ORIGINAL_RT);
  assert.equal(mock.calls[0].body.get("client_id"), "client-test");
  assert.equal(mock.calls[0].body.get("scope"), "api://tracker-test/access_as_user offline_access");

  // The re-set cookie: RT-03 attributes, the rotated token, the same sub and the original sexp.
  assert.equal(r.setCookies.length, 1);
  const [c] = r.setCookies;
  assert.ok(c.startsWith("tracker_rt="), "not a tracker_rt cookie");
  for (const part of ["Path=/api/tracker", "HttpOnly", "SameSite=lax"]) assert.ok(c.includes(part), `lacks ${part}`);
  const maxAge = maxAgeOf(c);
  assert.ok(maxAge <= 3 * DAY && maxAge > 3 * DAY - 10, `Max-Age ${maxAge}`);
  assert.deepEqual(await openTrackerRt(trackerRtValue(c), KEY_BYTES), {
    rt: "RT-ROTATED-test-value",
    sub: "42",
    sexp,
  });

  assert.equal(logged(spy).length, 0);
  assertNoLeak(r, spy);
});

test("a forged far-future session cannot push the rotated cookie past the sign-in deadline (WR-01)", async (t) => {
  silenceErrors(t);
  const { trackerRt, sexp } = await signedIn({ sexpOffset: 2 * DAY });
  const forged = sessionToken({ sub: "42", exp: nowSec() + 365 * DAY });
  const mock = entra(200, { access_token: "AT-NEW-test-value", expires_in: 3600, refresh_token: "RT-ROTATED-test-value" });
  const r = await read(await trackerTokenResponse({ accessToken: forged, trackerRt, env: ENV, fetch: mock.fetch }));
  assert.equal(r.status, 200);
  const [c] = r.setCookies;
  assert.ok(maxAgeOf(c) <= 2 * DAY, `Max-Age ${maxAgeOf(c)}`);
  assert.ok(maxAgeOf(c) < TRACKER_RT_MAX_AGE);
  assert.equal((await openTrackerRt(trackerRtValue(c), KEY_BYTES)).sexp, sexp);
});

test("a redeem without rotation answers 200 and leaves tracker_rt alone", async (t) => {
  const spy = silenceErrors(t);
  const { accessToken, trackerRt } = await signedIn();
  const mock = entra(200, { access_token: "AT-NEW-test-value", expires_in: 3600 });
  const r = await read(await trackerTokenResponse({ accessToken, trackerRt, env: ENV, fetch: mock.fetch }));
  assert.equal(r.status, 200);
  assert.ok(r.cacheControl.includes("no-store"));
  assert.equal(JSON.parse(r.text).accessToken, "AT-NEW-test-value");
  assert.deepEqual(r.setCookies, []);
  assert.equal(logged(spy).length, 0);
  assertNoLeak(r, spy);
});

test("a re-seal that would not fit answers 200 without a cookie and logs the step (WR-02)", async (t) => {
  const spy = silenceErrors(t);
  const { accessToken, trackerRt } = await signedIn();
  const huge = "r".repeat(5000);
  const mock = entra(200, { access_token: "AT-NEW-test-value", expires_in: 3600, refresh_token: huge });
  const r = await read(await trackerTokenResponse({ accessToken, trackerRt, env: ENV, fetch: mock.fetch }));
  assert.equal(r.status, 200);
  assert.ok(r.cacheControl.includes("no-store"));
  assert.equal(JSON.parse(r.text).accessToken, "AT-NEW-test-value");
  assert.deepEqual(r.setCookies, []);
  assert.deepEqual(logged(spy), ["tracker-token: reseal skipped, sealed cookie is too large"]);
  assert.ok(!logged(spy)[0].includes(huge.slice(0, 50)));
  assertNoLeak(r, spy);
});

test("Entra invalid_grant is reauth, keeps tracker_rt and logs only the code", async (t) => {
  const spy = silenceErrors(t);
  const { accessToken, trackerRt } = await signedIn();
  const mock = entra(400, {
    error: "invalid_grant",
    error_description: "AADSTS70008: free text that must not be logged",
    error_codes: [70008],
  });
  const r = await read(await trackerTokenResponse({ accessToken, trackerRt, env: ENV, fetch: mock.fetch }));
  assert.equal(r.status, 401);
  assert.equal(r.text, JSON.stringify({ error: "reauth" }));
  assert.ok(r.cacheControl.includes("no-store"));
  assert.deepEqual(r.setCookies, [], "an Entra reauth must leave tracker_rt alone (D-05)");
  assert.deepEqual(logged(spy), ["tracker-token: reauth [70008]"]);
  assertNoLeak(r, spy);
});

test("an unreachable Entra is unavailable and keeps tracker_rt", async (t) => {
  const spy = silenceErrors(t);
  const { accessToken, trackerRt } = await signedIn();
  const fetch = async () => {
    throw new TypeError(`fetch failed for ${ORIGINAL_RT}`);
  };
  const r = await read(await trackerTokenResponse({ accessToken, trackerRt, env: ENV, fetch }));
  assert.equal(r.status, 502);
  assert.equal(r.text, JSON.stringify({ error: "unavailable" }));
  assert.deepEqual(r.setCookies, []);
  assert.equal(logged(spy).length, 1);
  assert.match(logged(spy)[0], /^tracker-token: unavailable/);
  assertNoLeak(r, spy);
});

test("missing configuration is unconfigured before the session or any Entra call", async (t) => {
  silenceErrors(t);
  const { accessToken, trackerRt } = await signedIn();
  for (const env of [
    { ...ENV, TRACKER_API_SCOPE: "" },
    { ...ENV, TRACKER_RT_KEY: undefined },
    { ...ENV, TRACKER_RT_KEY: randomBytes(32).toString("base64") },
  ]) {
    const mock = entra(200, { access_token: "AT-NEW-test-value", expires_in: 3600 });
    const r = await read(await trackerTokenResponse({ accessToken, trackerRt, env, fetch: mock.fetch }));
    assert.equal(r.status, 503);
    assert.equal(r.text, JSON.stringify({ error: "unconfigured" }));
    assert.equal(mock.calls.length, 0);
  }
});

test("a tracker_rt for another user is reauth and cleared without calling Entra", async (t) => {
  silenceErrors(t);
  const { accessToken } = await signedIn({ sub: "42" });
  const { trackerRt } = await signedIn({ sub: "99" });
  const mock = entra(200, { access_token: "AT-NEW-test-value", expires_in: 3600 });
  const r = await read(await trackerTokenResponse({ accessToken, trackerRt, env: ENV, fetch: mock.fetch }));
  assert.equal(r.status, 401);
  assert.equal(r.text, JSON.stringify({ error: "reauth" }));
  assert.ok(r.cacheControl.includes("no-store"), "no-store lost when the cookie delete was added");
  assert.deepEqual(r.setCookies, ["tracker_rt=; Path=/api/tracker; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);
  assert.equal(mock.calls.length, 0);
});

test("no session is reauth without clearing and without calling Entra", async (t) => {
  silenceErrors(t);
  const { trackerRt } = await signedIn();
  const mock = entra(200, { access_token: "AT-NEW-test-value", expires_in: 3600 });
  const r = await read(await trackerTokenResponse({ accessToken: undefined, trackerRt, env: ENV, fetch: mock.fetch }));
  assert.equal(r.status, 401);
  assert.deepEqual(r.setCookies, []);
  assert.equal(mock.calls.length, 0);
});
