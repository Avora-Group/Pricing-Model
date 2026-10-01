// HTTP smoke of POST /api/tracker/token against the built app (D-13).
//
// Starts `next start` on a free 127.0.0.1 port with throwaway tracker and Azure
// values, then checks the route's 401, 405 and 503 answers over HTTP. Process
// env wins over .env.local in @next/env, and an empty string counts as set, so
// no real credential is used. AZURE_CLIENT_SECRET is empty, so the package
// throws `unconfigured` before any network call.
//
// Run from nextjs-project/ after `npm run build`: node tests/rt-route-smoke.mjs
// Prints `ok <case>` or `FAIL <case>: <detail>` per case, then RT-SMOKE-OK.
// It never prints a cookie value, a key, a session token or a refresh token.

import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EncryptJWT } from 'jose'
import { parseTrackerRtKey, sealTrackerRt } from '../src/lib/tracker-rt.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NEXT_BIN = join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const ROUTE = '/api/tracker/token'

if (!existsSync(join(ROOT, '.next', 'BUILD_ID'))) {
  console.log('FAIL build: run npm run build first')
  process.exit(1)
}

// ---------------------------------------------------------------- test data

const nowSec = () => Math.floor(Date.now() / 1000)
const keyStr = (n = 32) => randomBytes(n).toString('base64url')
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
// An unsigned FastAPI-shaped session token. The route decodes it without
// verifying it (D-02), so this is test data, not a credential.
const session = (sub, expOffset = 3600) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'admin', exp: nowSec() + expOffset })}.sig`

const REFRESH = `rt-smoke-refresh-${randomBytes(8).toString('hex')}`
const KEY_A = keyStr()
const KEY_A_BYTES = parseTrackerRtKey(KEY_A)

const BASE_ENV = {
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  TRACKER_API_SCOPE: 'api://rt-smoke/access_as_user',
  TRACKER_RT_KEY: KEY_A,
  AZURE_TENANT_ID: 'rt-smoke-tenant',
  AZURE_CLIENT_ID: 'rt-smoke-client',
  AZURE_CLIENT_SECRET: '',
}
const CONFIGS = {
  A: BASE_ENV,
  B: { ...BASE_ENV, TRACKER_API_SCOPE: '' },
  C: { ...BASE_ENV, TRACKER_RT_KEY: keyStr(16) },
}

// Every value the server log must never carry.
const SECRETS = [REFRESH, KEY_A]

// ---------------------------------------------------------------- plumbing

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function startServer(env) {
  const port = await freePort()
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const server = { port, child, output: '', exited: false }
  child.stdout.on('data', (d) => (server.output += d))
  child.stderr.on('data', (d) => (server.output += d))
  server.exitPromise = new Promise((resolve) =>
    child.once('exit', () => {
      server.exited = true
      resolve()
    }),
  )

  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (server.exited) throw new Error('server exited before it answered')
    try {
      await fetch(`http://127.0.0.1:${port}${ROUTE}`, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(2000),
      })
      return server
    } catch {
      await sleep(250)
    }
  }
  throw new Error('server did not answer within 90 s')
}

async function stopServer(server) {
  if (!server || server.exited) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(server.child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } else {
    server.child.kill('SIGTERM')
  }
  await Promise.race([server.exitPromise, sleep(10_000)])
}

async function request(server, { method = 'POST', cookies = {} } = {}) {
  const headers = {}
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  if (cookie) headers.cookie = cookie
  const res = await fetch(`http://127.0.0.1:${server.port}${ROUTE}`, {
    method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  return { status: res.status, headers: res.headers, text, setCookies: res.headers.getSetCookie() }
}

// ---------------------------------------------------------------- checks

class CheckError extends Error {}
const check = (cond, detail) => {
  if (!cond) throw new CheckError(detail)
}
// Only an expected-shape error body is ever echoed into a failure line.
const showBody = (t) => (/^\{"error":"[a-z]+"\}$/.test(t) ? t : '<body withheld>')

function expectCommon(r) {
  check((r.headers.get('cache-control') ?? '').includes('no-store'), `cache-control is ${r.headers.get('cache-control')}`)
  check(!r.headers.has('location'), 'response has a location header')
}

function expectError(r, status, error) {
  expectCommon(r)
  check(r.status === status, `status ${r.status}, expected ${status}`)
  check(r.text === JSON.stringify({ error }), `body ${showBody(r.text)}, expected {"error":"${error}"}`)
  check((r.headers.get('content-type') ?? '').startsWith('application/json'), `content-type ${r.headers.get('content-type')}`)
}

function expectNoSetCookie(r) {
  check(r.setCookies.length === 0, `${r.setCookies.length} set-cookie header(s), expected none`)
}

// Cleared: exactly one Set-Cookie, an empty tracker_rt on its path, expired at
// the epoch, with no Max-Age (which would turn the delete into a 7-day cookie).
function expectCleared(r) {
  check(r.setCookies.length === 1, `${r.setCookies.length} set-cookie header(s), expected 1`)
  const c = r.setCookies[0]
  check(c.startsWith('tracker_rt=;'), 'set-cookie is not an empty tracker_rt')
  check(c.includes('Path=/api/tracker'), 'set-cookie lacks Path=/api/tracker')
  check(c.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT'), 'set-cookie is not expired at the epoch')
  check(!/max-age/i.test(c), 'set-cookie carries Max-Age')
}

let failed = false
const failedConfigs = new Set()

async function runCase(config, name, fn) {
  try {
    await fn()
    console.log(`ok ${name}`)
  } catch (e) {
    failed = true
    failedConfigs.add(config)
    console.log(`FAIL ${name}: ${e instanceof CheckError ? e.message : 'threw ' + (e?.name ?? 'error')}`)
  }
}

// ---------------------------------------------------------------- cases

async function configA(server) {
  const s1 = session('rt-smoke-1')
  const sealed1 = await sealTrackerRt({ rt: REFRESH, sub: 'rt-smoke-1', sexp: nowSec() + 3600 }, KEY_A_BYTES)
  SECRETS.push(s1, sealed1)

  await runCase('A', 'no cookies is reauth', async () => {
    const r = await request(server)
    expectError(r, 401, 'reauth')
    expectNoSetCookie(r)
  })

  await runCase('A', 'session without tracker_rt is reauth', async () => {
    const r = await request(server, { cookies: { access_token: s1 } })
    expectError(r, 401, 'reauth')
    expectNoSetCookie(r)
  })

  await runCase('A', 'matching tracker_rt reaches the redeem', async () => {
    const r = await request(server, { cookies: { access_token: s1, tracker_rt: sealed1 } })
    expectError(r, 503, 'unconfigured')
    expectNoSetCookie(r)
  })

  await runCase('A', 'only POST is served', async () => {
    const r = await request(server, { method: 'GET' })
    check(r.status === 405, `status ${r.status}, expected 405`)
    check(!r.headers.has('location'), 'response has a location header')
  })

  await runCase('A', 'garbage tracker_rt is reauth and cleared', async () => {
    const r = await request(server, { cookies: { access_token: s1, tracker_rt: 'garbage' } })
    expectError(r, 401, 'reauth')
    expectCleared(r)
  })

  await runCase('A', "another user's tracker_rt is reauth and cleared", async () => {
    const sealed2 = await sealTrackerRt({ rt: REFRESH, sub: 'rt-smoke-2', sexp: nowSec() + 3600 }, KEY_A_BYTES)
    SECRETS.push(sealed2)
    const r = await request(server, { cookies: { access_token: s1, tracker_rt: sealed2 } })
    expectError(r, 401, 'reauth')
    expectCleared(r)
  })

  await runCase('A', 'tracker_rt under another key is reauth and cleared', async () => {
    const otherKey = keyStr()
    const sealedOther = await sealTrackerRt({ rt: REFRESH, sub: 'rt-smoke-1', sexp: nowSec() + 3600 }, parseTrackerRtKey(otherKey))
    SECRETS.push(otherKey, sealedOther)
    const r = await request(server, { cookies: { access_token: s1, tracker_rt: sealedOther } })
    expectError(r, 401, 'reauth')
    expectCleared(r)
  })

  await runCase('A', 'tracker_rt past its exp is reauth and cleared', async () => {
    const sealedPast = await new EncryptJWT({ rt: REFRESH, sub: 'rt-smoke-1', sexp: nowSec() + 3600 })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt(nowSec() - 120)
      .setExpirationTime(nowSec() - 60)
      .encrypt(KEY_A_BYTES)
    SECRETS.push(sealedPast)
    const r = await request(server, { cookies: { access_token: s1, tracker_rt: sealedPast } })
    expectError(r, 401, 'reauth')
    expectCleared(r)
  })

  await runCase('A', 'expired session keeps tracker_rt', async () => {
    const expired = session('rt-smoke-1', -60)
    SECRETS.push(expired)
    const r = await request(server, { cookies: { access_token: expired, tracker_rt: 'garbage' } })
    expectError(r, 401, 'reauth')
    expectNoSetCookie(r)
  })

  await runCase('A', 'log carries only the code', async () => {
    const want = 'tracker-token: unconfigured []'
    const deadline = Date.now() + 5000
    while (!server.output.includes(want) && Date.now() < deadline) await sleep(100)
    check(server.output.includes(want), `server output lacks "${want}"`)
    const leaked = SECRETS.filter((v) => server.output.includes(v)).length
    check(leaked === 0, `server output carries ${leaked} test secret value(s)`)
  })
}

async function configB(server) {
  await runCase('B', 'blank scope is unconfigured before the session', async () => {
    expectError(await request(server), 503, 'unconfigured')
  })
}

async function configC(server) {
  await runCase('C', 'malformed key is unconfigured before the session', async () => {
    expectError(await request(server), 503, 'unconfigured')
  })
}

// ---------------------------------------------------------------- main

const outputs = {}
for (const [name, run] of [
  ['A', configA],
  ['B', configB],
  ['C', configC],
]) {
  let server
  try {
    server = await startServer(CONFIGS[name])
    await run(server)
  } catch (e) {
    failed = true
    failedConfigs.add(name)
    console.log(`FAIL config ${name}: ${e instanceof Error ? e.message : 'error'}`)
  } finally {
    await stopServer(server)
    if (server) outputs[name] = server.output
  }
}

if (failed) {
  for (const name of failedConfigs) {
    let tail = (outputs[name] ?? '').replace(/\r/g, '').split('\n').slice(-40).join('\n')
    for (const v of SECRETS) tail = tail.split(v).join('<redacted>')
    console.log(`--- config ${name} server output (last 40 lines) ---\n${tail}`)
  }
  process.exit(1)
}
console.log('RT-SMOKE-OK')
