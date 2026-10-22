import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBusinessSessionProxy } from './web-session-proxy.mjs'

const temporary = mkdtempSync(join(tmpdir(), 'eiscore-web-bind-'))
const priorEnv = { ...process.env }
const nativeFetch = globalThis.fetch
const authKey = Symbol.for('eiscore.dsh.auth-bridge')
const contextKey = Symbol.for('eiscore.dsh.flash-context')
const priorAuth = globalThis[authKey]
const priorContext = globalThis[contextKey]
process.env.DSH_HOME = temporary
process.env.EISCORE_GATEWAY_URL = 'http://flash-agent-runtime:8078'
process.env.EISCORE_AUTH_GATEWAY_URL = 'http://business-agent:8078'
process.env.EISCORE_AUTH_URL = 'https://fixture.example'
process.env.EISCORE_TOOL_PROXY_SECRET = 'fixture-only-proxy-secret-000000000000'
process.env.EISCORE_TOOL_PROXY_URL = 'http://flash-agent-runtime:8078/internal/harness/tool'
process.env.EISCORE_HARNESS_CAPABILITY_PROFILE = 'flash'
process.env.DSH_DEFAULT_WORKSPACE = '/fixture'
const appId = '11111111-2222-3333-4444-555555555555'
const otherApp = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const events = []
let registrationGate
let registrationStarted
const tools = []
const routes = new Map()
const exact = new Map()
const prefixes = new Map()
const upgrades = new Map()
const gateway = {
  ctx: { workspaceRegistry: { get: (id) => id === 'fixture' ? { path: '/fixture' } : undefined } },
  remoteEventClients: new Map(),
  pendingRemoteEvents: new Map(),
  invoke: async () => undefined,
  stream: async () => ({ async *[Symbol.asyncIterator] () {} }),
  dispatchRpc: async () => ({ ok: true }),
  openWireStream: async () => ({ async *[Symbol.asyncIterator] () {} }),
  deliverRemoteEvent: () => undefined
}
const ctx = {
  effect: (effect) => effect(),
  connection: { requestRejection: () => undefined, fetch: { register: (route) => { routes.set(route.path, route); return () => {} } } },
  webServer: {
    exact,
    prefixes,
    upgrades,
    register: (route) => {
      routes.set(route.path, route)
      ;(route.kind === 'prefix' ? prefixes : exact).set(route.path, route)
      return () => {}
    },
    registerUpgrade: (route) => {
      upgrades.set(route.path, route)
      return () => {}
    }
  },
  typertGateway: gateway
}
const token = (user) => `header.${Buffer.from(JSON.stringify({ username: user, tenant_id: 'tenant', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`
globalThis.fetch = async (url, options) => {
  const target = new URL(url)
  if (target.hostname === 'business-agent') return Response.json({ token: token(JSON.parse(options.body).code[0]) })
  if (target.hostname === 'flash-agent-runtime') {
    if (target.pathname === '/internal/harness/session') {
      events.push('context-start')
      registrationStarted?.()
      if (registrationGate) await registrationGate
      events.push('context-ready')
      return Response.json({ ok: true })
    }
    tools.push({ headers: options.headers, body: JSON.parse(options.body) })
    return Response.json({ data: { content: '<template><p>saved draft</p></template>' } })
  }
  return nativeFetch(url, options)
}
const { apply: applyAuth } = await import('./auth-plugin.mjs')
const { apply: applyFlash } = await import('./flash-context-plugin.mjs')
applyAuth(ctx)
applyFlash(ctx)
let nextSession = 0
const upstream = http.createServer(async (request, response) => {
  const path = request.url.split('?', 1)[0]
  const route = routes.get(path)
  if (route?.handler) { events.push(path === '/api/eiscore/auth/bind-session' ? 'auth-bind' : path); return route.handler(request, response) }
  if (route?.fetch) {
    const result = await route.fetch(new Request('http://dsh.internal' + path, { headers: request.headers }))
    response.writeHead(result.status, Object.fromEntries(result.headers)).end(await result.text())
    return
  }
  for await (const _ of request) { /* drain native RPC */ }
  const value = path === '/api/session/create' ? { sessionId: `dsh-${++nextSession}` } : { accepted: true }
  events.push(path === '/api/session/create' ? 'create' : 'prompt')
  response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ result: { ok: true, value } }))
})
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
const proxy = http.createServer(createBusinessSessionProxy({ port: upstream.address().port, withToken: (path) => path, forward: (_req, res) => res.writeHead(404).end(), mapCookies: (cookies) => cookies, flash: true }))
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`
const proxyUrl = `http://127.0.0.1:${proxy.address().port}`
const login = async (user) => {
  const start = await nativeFetch(upstreamUrl + '/api/eiscore/auth/start', { method: 'POST' })
  const state = start.headers.get('set-cookie').split(';', 1)[0]
  const handoff = await nativeFetch(upstreamUrl + '/api/eiscore/auth/handoff', { method: 'POST', headers: { cookie: state, 'content-type': 'application/json' }, body: JSON.stringify({ code: user.repeat(32) }) })
  assert.equal(handoff.status, 200)
  return handoff.headers.get('set-cookie').split(';', 1)[0]
}
const call = (method, input, cookie = '', app = appId) => nativeFetch(proxyUrl + '/api/session/' + method, {
  method: 'POST', headers: { cookie, 'content-type': 'application/json', 'x-eis-flash-app-id': app, 'x-eis-flash-session-id': `flash-${app}` },
  body: JSON.stringify({ type: 'client-request', method: 'session/' + method, payload: { args: { request: input } } })
})
try {
  const cookieA = await login('a')
  const cookieB = await login('b')
  const created = await call('create', {}, cookieA)
  assert.equal(created.status, 200)
  const sessionId = (await created.json()).result.value.sessionId
  events.length = 0
  let release
  registrationGate = new Promise((resolve) => { release = resolve })
  const started = new Promise((resolve) => { registrationStarted = resolve })
  const pending = call('prompt', { sessionId }, cookieA)
  await started
  assert.deepEqual(events, ['auth-bind', '/api/eiscore/flash/context', 'context-start'])
  release()
  assert.equal((await pending).status, 200)
  assert.deepEqual(events.slice(-2), ['context-ready', 'prompt'])
  registrationGate = null
  assert.equal((await call('prompt', { sessionId })).status, 401)
  assert.equal((await call('prompt', { sessionId }, cookieB)).status, 403)
  assert.equal((await call('prompt', { sessionId }, cookieA, otherApp)).status, 403)
  assert.equal((await call('prompt', { sessionId }, cookieA)).status, 200)
  const definitions = []
  const { apply } = await import('./eiscore-tools.mjs?flash-binding-test')
  apply({ tools: { register: (definition) => definitions.push(definition) } })
  const write = definitions.find((definition) => definition.name === 'eiscore_flash_write')
  await assert.rejects(write.execute({}, { agent: { session: { id: 'missing' } } }), /authenticated Flash/)
  const result = await write.execute({ tool_id: 'flash.draft.write', arguments: { content: '<template><p>draft</p></template>' } }, { agent: { session: { id: sessionId } } })
  assert.match(result.content, /saved draft/)
  assert.equal(tools[0].body.session_id, `flash-${appId}`)
  assert.equal(tools[0].body.arguments.tool_id, 'flash.draft.write')
  await nativeFetch(upstreamUrl + '/api/eiscore/auth/logout', { method: 'POST', headers: { cookie: cookieA } })
  await assert.rejects(write.execute({}, { agent: { session: { id: sessionId } } }), /authenticated Flash/)
  assert.equal(tools.length, 1)
  console.log('PASS: actual auth handoff, cross-user/app denial, bind-before-prompt, authenticated draft write and logout revocation')
} finally {
  globalThis.fetch = nativeFetch
  if (priorAuth === undefined) delete globalThis[authKey]; else globalThis[authKey] = priorAuth
  if (priorContext === undefined) delete globalThis[contextKey]; else globalThis[contextKey] = priorContext
  for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key]
  Object.assign(process.env, priorEnv)
  await new Promise((resolve) => proxy.close(resolve))
  await new Promise((resolve) => upstream.close(resolve))
  rmSync(temporary, { recursive: true, force: true })
}
