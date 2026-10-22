import assert from 'node:assert/strict'
import { Readable, PassThrough } from 'node:stream'
import { apply, bindFlashContext } from './flash-context-plugin.mjs'

const contexts = globalThis[Symbol.for('eiscore.dsh.flash-context')]
const authKey = Symbol.for('eiscore.dsh.auth-bridge')
const originalAuth = globalThis[authKey]
const originalFetch = globalThis.fetch
const originalGateway = process.env.EISCORE_GATEWAY_URL
const appId = '12345678-1234-1234-1234-123456789abc'
const otherApp = '22345678-1234-1234-1234-123456789abc'
const dshSessionId = 'dsh-session.one:1'
const sessionId = `flash-${appId}`
let ownerToken = 'test-user-token'
let registrationStatus = 200
const registrations = []
const bind = (extra = {}, cookie = 'eiscore-session=test-user') => bindFlashContext(new Request('http://dsh.internal/api/eiscore/flash/context', {
  method: 'POST', headers: { cookie }, body: JSON.stringify({ appId, sessionId, dshSessionId, ...extra })
}))
const register = async (url, options) => {
  registrations.push({ url: String(url), options })
  assert.equal(String(url), 'http://flash-agent-runtime:8078/internal/harness/session')
  assert.equal(options.headers.authorization, 'Bearer test-user-token')
  assert.deepEqual(JSON.parse(options.body), { session_id: sessionId, app_id: appId })
  return Response.json({ ok: registrationStatus === 200 }, { status: registrationStatus })
}

try {
  contexts.clear()
  globalThis[authKey] = {
    token: request => request.headers.get('cookie') === 'eiscore-session=test-user' ? 'test-user-token' : '',
    toolToken: () => ownerToken
  }
  process.env.EISCORE_GATEWAY_URL = 'http://flash-agent-runtime:8078'
  globalThis.fetch = register
  for (const extra of [{ appId: 'not-an-app' }, { sessionId: 'another-session' }, { dshSessionId: '../session' }]) {
    assert.equal((await bind(extra)).status, 400)
  }
  assert.equal((await bind({}, '')).status, 403)
  ownerToken = 'another-user-token'
  assert.equal((await bind()).status, 403)
  assert.equal(registrations.length, 0, 'An unowned session never reaches the gateway')
  ownerToken = 'test-user-token'
  assert.equal((await bind()).status, 200)
  assert.deepEqual(Object.keys(contexts.get(dshSessionId)).sort(), ['appId', 'expiresAt', 'sessionId', 'token'])
  assert.equal(contexts.get(dshSessionId).token, ownerToken)
  assert.equal(contexts.get(dshSessionId).sessionId, sessionId)
  assert.ok(contexts.get(dshSessionId).expiresAt > Date.now())
  const activeBinding = contexts.get(dshSessionId)
  assert.equal((await bind({}, '')).status, 403)
  assert.equal(contexts.get(dshSessionId), activeBinding, 'An unauthenticated request cannot invalidate another session')
  ownerToken = 'another-user-token'
  assert.equal((await bind()).status, 403)
  assert.equal(contexts.get(dshSessionId), activeBinding, 'A different user cannot invalidate the current owner binding')
  ownerToken = 'test-user-token'
  assert.equal((await bind({ appId: otherApp, sessionId: `flash-${otherApp}` })).status, 403)
  assert.equal(contexts.get(dshSessionId), activeBinding, 'A rejected app switch preserves the original app binding')

  for (const status of [400, 401, 403, 409, 500]) {
    registrationStatus = status
    assert.equal((await bind()).status, status === 500 ? 503 : status)
    assert.equal(contexts.get(dshSessionId).expiresAt, 0, 'A failed registration cannot leave a usable binding')
  }
  registrationStatus = 200
  const beforeInvalidGateway = registrations.length
  for (const value of ['', 'ftp://runtime', 'http://user:password@runtime', 'http://runtime/path', 'http://runtime/?secret=1', 'http://runtime/#fragment']) {
    process.env.EISCORE_GATEWAY_URL = value
    assert.equal((await bind()).status, 503)
  }
  assert.equal(registrations.length, beforeInvalidGateway, 'Invalid configuration never becomes a fetch target')
  process.env.EISCORE_GATEWAY_URL = 'http://flash-agent-runtime:8078'

  let startRegistration
  let finishRegistration
  const started = new Promise(resolve => { startRegistration = resolve })
  const blocked = new Promise(resolve => { finishRegistration = resolve })
  globalThis.fetch = async (...args) => { startRegistration(); await blocked; return register(...args) }
  const pending = bind({ dshSessionId: 'concurrent-session' })
  await started
  assert.equal((await bind({ dshSessionId: 'concurrent-session', appId: otherApp, sessionId: `flash-${otherApp}` })).status, 403)
  finishRegistration()
  assert.equal((await pending).status, 200)
  assert.equal(contexts.get('concurrent-session').appId, appId)

  globalThis.fetch = async (...args) => { ownerToken = ''; return register(...args) }
  assert.equal((await bind()).status, 403, 'Logout during registration cannot reactivate the old token')
  assert.equal(contexts.get(dshSessionId).expiresAt, 0)
  ownerToken = 'test-user-token'
  globalThis.fetch = register

  let uiRoute
  let contextRoute
  let rejection
  apply({
    effect: effect => effect(),
    connection: { requestRejection: () => rejection, fetch: { register: route => { uiRoute = route } } },
    webServer: { register: route => { contextRoute = route } }
  })
  assert.equal(uiRoute.path, '/api/eiscore/flash/ui.js')
  const ui = uiRoute.fetch()
  assert.equal(ui.headers.get('cache-control'), 'no-store')
  assert.match(await ui.text(), /x-eis-flash-app-id/)
  assert.equal(contextRoute.path, '/api/eiscore/flash/context')
  const routeRequest = async (body, method = 'POST') => {
    const req = Readable.from([Buffer.from(body)])
    Object.assign(req, { method, headers: { cookie: 'eiscore-session=test-user' } })
    const res = new PassThrough()
    const chunks = []
    res.on('data', chunk => chunks.push(chunk))
    res.writeHead = (status, headers) => { res.status = status; res.headers = headers; return res }
    await contextRoute.handler(req, res)
    return { status: res.status, body: Buffer.concat(chunks).toString('utf8') }
  }
  rejection = 403
  assert.equal((await routeRequest('{}')).status, 403)
  rejection = undefined
  assert.equal((await routeRequest('{}', 'GET')).status, 405)
  assert.equal((await routeRequest('x'.repeat(4097))).status, 413)
  assert.equal((await routeRequest('not-json')).status, 400)
  assert.equal((await routeRequest(JSON.stringify({ appId, sessionId, dshSessionId }))).status, 200)
  console.log('PASS: configured Flash gateway, user/app ownership, concurrent app claims, logout, failed registration and bounded context route')
} finally {
  contexts.clear()
  globalThis.fetch = originalFetch
  if (originalAuth === undefined) delete globalThis[authKey]
  else globalThis[authKey] = originalAuth
  if (originalGateway === undefined) delete process.env.EISCORE_GATEWAY_URL
  else process.env.EISCORE_GATEWAY_URL = originalGateway
}
