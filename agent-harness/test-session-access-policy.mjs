import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// Use the actual pinned transport, dispatch, reflection and WS mux. Only the
// Session data provider and trusted handoff gateway are deterministic fixtures.
const resolvers = [createRequire(import.meta.url), createRequire(new URL('../../agent-harness/package.json', import.meta.url))]
const load = async (name) => {
  for (const resolve of resolvers) {
    let path
    try { path = resolve.resolve(name) } catch { continue }
    return import(pathToFileURL(path).href)
  }
  throw new Error(`Install agent-harness dependencies before running this test: ${name}`)
}
const { Context, Service } = await load('@deepseek-ai/cordis')
const { WebServer } = await load('@deepseek-ai/dsh-host-webserver')
const { TypertRegistry } = await load('@deepseek-ai/dsh-typert-registry')
const { HostConnectionService } = await load('@deepseek-ai/dsh-client-connection')
const { default: Gateway } = await load('@deepseek-ai/dsh-api-gateway')
const { TypertRemoteService, Remote } = await load('@deepseek-ai/dsh-typert-protocol')
const { default: WebSocket } = await load('ws')
// JSON package import requires an import attribute on current Node versions.
const packageRequire = resolvers.find((resolve) => { try { return resolve.resolve('@deepseek-ai/dsh-api-gateway/package.json') } catch { return false } })
assert.equal(packageRequire('@deepseek-ai/dsh-api-gateway/package.json').version, '0.1.2-rc.1')

const temporary = mkdtempSync(join(tmpdir(), 'eiscore-native-session-'))
const priorEnv = { ...process.env }
const nativeFetch = globalThis.fetch
const authKey = Symbol.for('eiscore.dsh.auth-bridge')
const priorAuth = globalThis[authKey]
process.env.DSH_HOME = temporary
process.env.DSH_DEFAULT_WORKSPACE = '/fixture'
process.env.EISCORE_GATEWAY_URL = 'http://handoff.fixture'
process.env.EISCORE_AUTH_GATEWAY_URL = 'http://handoff.fixture'
process.env.EISCORE_AUTH_URL = 'http://localhost'
process.env.EISCORE_TOOL_PROXY_SECRET = 'fixture-only-proxy-secret-000000000000'
const jwt = (user) => `header.${Buffer.from(JSON.stringify({ username: user, tenant_id: 'fixture', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`
globalThis.fetch = (url, options) => String(url).startsWith('http://handoff.fixture/')
  ? Promise.resolve(Response.json({ token: jwt(JSON.parse(options.body).code[0]) }))
  : nativeFetch(url, options)

const ctx = new Context()
const webServer = new WebServer(ctx, { host: '127.0.0.1', port: 0, compression: 'none' })
new TypertRegistry(ctx)
const connection = new HostConnectionService(ctx, ['localhost'], { isAuthenticated: () => true })
const registry = new Service(ctx, 'workspaceRegistry')
registry.get = (id) => id === 'fixture' ? { path: '/fixture' } : { path: '/private' }
const gatewayFiber = ctx.plugin(Gateway, { websocketHeartbeatIntervalMs: 1000 })
await new Promise(setImmediate)
await gatewayFiber.inertia
assert.equal(gatewayFiber.state, 2)
const gateway = ctx.get('typertGateway')
gateway.registerRemoteEvents(async function* (signal) {
  await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))
}, { home: '/private/host-home' })
const rows = []
const executed = []
let sequence = 0
class Sessions extends TypertRemoteService {
  constructor(context) { super(context, 'fixtureSessions', { namespace: 'session' }) }
  list(request) { return { items: rows.map((sessionId) => ({ sessionId, title: `private-${sessionId}` })) } }
  search(request) { return { items: rows.map((sessionId) => ({ sessionId, snippet: `private-${sessionId}` })), hasMore: false } }
  create(request) { const sessionId = request.sessionId || `session-${++sequence}`; if (!rows.includes(sessionId)) rows.push(sessionId); return { sessionId } }
  fork(request) { return this.create({}) }
  rename(request) { executed.push(request.sessionId); return { title: request.title } }
  page(request) { executed.push(request.address.sessionId); return { records: [{ text: `history-${request.address.sessionId}` }] } }
  async *follow(request, signal) {
    yield { type: 'snapshot', header: { id: request.address.sessionId }, records: [{ text: `history-${request.address.sessionId}` }] }
    while (!signal.aborted) { await delay(10); yield { type: 'append', records: [{ text: `live-${request.address.sessionId}` }] } }
  }
  async *control(signal) {
    yield { type: 'baseline', value: Object.fromEntries(['queues', 'jobs', 'projections'].map((key) => [key, Object.fromEntries(rows.map((id) => [id, [{ text: `private-${id}` }]]))])) }
    while (!signal.aborted) for (const sessionId of rows) { await delay(10); yield { type: 'queue', sessionId, items: [`private-${sessionId}`] } }
  }
}
class Workspaces extends TypertRemoteService {
  constructor(context) { super(context, 'fixtureWorkspaces', { namespace: 'workspace' }) }
  create(request) { return { created: false, workspace: { workspaceId: 'fixture', path: request.path, sessionIds: rows } } }
  async *follow(signal) {
    yield { type: 'baseline', value: { items: [{ workspaceId: 'fixture', path: '/fixture', sessionIds: rows }, { workspaceId: 'other', path: '/private', sessionIds: rows }], archivedSessionIds: rows } }
    while (!signal.aborted) { await delay(10); yield { type: 'upsert', workspace: { workspaceId: 'fixture', path: '/fixture', sessionIds: rows } } }
  }
}
const mark = (service, methods, streams = []) => {
  for (const name of methods) {
    const decorator = streams.includes(name) ? Remote({ mode: 'stream' }) : Remote(name)
    decorator(service[name], { name, private: false, static: false, addInitializer: (initialize) => initialize.call(service) })
  }
}
mark(new Sessions(ctx), ['list', 'search', 'create', 'fork', 'rename', 'page', 'follow', 'control'], ['follow', 'control'])
mark(new Workspaces(ctx), ['create', 'follow'], ['follow'])
const handler = connection.createSharedFetchHandler('/api')
webServer.register({ kind: 'prefix', path: '/api', handler: async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const response = await handler.fetch(new Request(`http://localhost${req.url}`, {
    method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {})
  }))
  res.writeHead(response.status, Object.fromEntries(response.headers)).end(await response.text())
} })
// Let the actual Gateway register its /api interceptor and WS upgrade owner.
await new Promise(setImmediate)
assert.ok(webServer.upgrades.has('/api/remote.mux'))
const authFiber = ctx.plugin(await import('./auth-plugin.mjs'))
await new Promise(setImmediate)
await authFiber.inertia
assert.equal(authFiber.state, 2)
await webServer[Service.init]()
const origin = `http://127.0.0.1:${webServer.port}`
const sockets = []
const login = async (user) => {
  const start = await nativeFetch(origin + '/api/eiscore/auth/start', { method: 'POST' })
  const cookie = start.headers.get('set-cookie').split(';', 1)[0]
  const response = await nativeFetch(origin + '/api/eiscore/auth/handoff', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ code: user.repeat(32) }) })
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie').split(';', 1)[0]
}
const rpc = async (endpoint, request, cookie = '', args = { request }) => {
  const response = await nativeFetch(origin + '/api/' + endpoint, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'fixture-rpc', method: endpoint, payload: { args } }) })
  assert.equal(response.status, 200)
  return (await response.json()).result
}
const connect = async (cookie) => {
  const socket = new WebSocket(origin.replace('http:', 'ws:') + '/api/remote.mux', { headers: { host: 'localhost', cookie } })
  sockets.push(socket)
  const inbox = []
  socket.on('message', (message) => inbox.push(JSON.parse(String(message))))
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  return {
    socket,
    open: (streamId, endpoint, args = {}) => socket.send(JSON.stringify({ type: 'open', streamId, endpoint, payload: { args } })),
    async take(streamId, type) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const at = inbox.findIndex((frame) => frame.streamId === streamId && (!type || frame.type === type))
        if (at !== -1) return inbox.splice(at, 1)[0]
        await delay(5)
      }
      throw new Error(`Native Remote frame missing: ${streamId}/${type || '*'}`)
    },
    inbox
  }
}
try {
  const cookieA = await login('a')
  const cookieB = await login('b')
  const a = (await rpc('session/create', {}, cookieA)).value.sessionId
  const b = (await rpc('session/create', {}, cookieB)).value.sessionId
  assert.equal((await rpc('session/list', {})).error.code, 'EISCORE_AUTH_REQUIRED')
  for (const [cookie, id] of [[cookieA, a], [cookieB, b]]) {
    for (const method of ['list', 'search']) assert.deepEqual((await rpc('session/' + method, {}, cookie)).value.items.map((item) => item.sessionId), [id])
  }
  assert.equal((await rpc('session/rename', { sessionId: a, title: 'stolen' }, cookieB)).error.code, 'EISCORE_SESSION_OWNERSHIP_DENIED')
  assert.equal((await rpc('session/page', { address: { kind: 'session', sessionId: a } }, cookieB)).error.code, 'EISCORE_SESSION_OWNERSHIP_DENIED')
  assert.equal(executed.length, 0)
  assert.equal((await rpc('session/page', { address: { kind: 'session', sessionId: a } }, cookieA)).ok, true)
  assert.equal((await rpc('session/create', { sessionId: a }, cookieB)).ok, false)
  assert.equal((await rpc('session/create', { cwd: '/private' }, cookieA)).ok, false)
  assert.equal((await rpc('session/create', { workspaceId: 'private' }, cookieA)).ok, false)
  const workspaceSession = (await rpc('session/create', { workspaceId: 'fixture' }, cookieA)).value.sessionId
  assert.ok(workspaceSession)
  assert.equal((await rpc('workspace/create', { path: '/private' }, cookieA)).ok, false)
  const forked = (await rpc('session/fork', { sessionId: a }, cookieA)).value.sessionId
  assert.equal((await rpc('session/rename', { sessionId: forked, title: 'mine' }, cookieA)).ok, true)
  assert.equal((await rpc('session/rename', { sessionId: forked, title: 'stolen' }, cookieB)).ok, false)
  const wsA = await connect(cookieA)
  const wsB = await connect(cookieB)
  const wsNone = await connect('')
  wsNone.open('no-auth', 'session/control')
  assert.equal((await wsNone.take('no-auth', 'error')).error.code, 'EISCORE_AUTH_REQUIRED')
  wsA.open('history', 'session/follow', { request: { address: { kind: 'session', sessionId: a } } })
  assert.equal((await wsA.take('history', 'item')).value.header.id, a)
  wsB.open('stolen-history', 'session/follow', { request: { address: { kind: 'session', sessionId: a } } })
  assert.equal((await wsB.take('stolen-history', 'error')).error.code, 'EISCORE_SESSION_OWNERSHIP_DENIED')
  wsB.open('control', 'session/control')
  const control = (await wsB.take('control', 'item')).value
  for (const key of ['queues', 'jobs', 'projections']) assert.deepEqual(Object.keys(control.value[key]), [b])
  assert.equal((await wsB.take('control', 'item')).value.sessionId, b)
  wsB.open('workspaces', 'workspace/follow')
  const baseline = (await wsB.take('workspaces', 'item')).value.value
  assert.deepEqual(baseline.items.map((item) => item.path), ['/fixture'])
  assert.deepEqual(baseline.items[0].sessionIds, [b])
  assert.deepEqual(baseline.archivedSessionIds, [b])
  wsA.open('events-a', '$events')
  wsB.open('events-b', '$events')
  const readyA = (await wsA.take('events-a', 'item')).value
  const readyB = (await wsB.take('events-b', 'item')).value
  assert.equal(readyA.type, 'ready')
  assert.deepEqual(readyA.host, { home: '/fixture' })
  gateway.broadcastRemoteEvent({ event: 'api-session/status', args: [a, true] })
  gateway.broadcastRemoteEvent({ event: 'credentials/reference-updated', args: ['private-provider'] })
  gateway.broadcastRemoteEvent({ event: 'api-session/status', args: [b, true] })
  assert.deepEqual((await wsA.take('events-a', 'item')).value.args, [a, true])
  assert.deepEqual((await wsB.take('events-b', 'item')).value.args, [b, true])
  const outcome = []
  const pending = {
    id: 'approval-a', frame: { type: 'waterfall', event: 'approval/request', eventId: 'approval-a', agentId: a, request: { private: 'owner-a' } },
    deliveries: new Set(), releaseSignal() {}, releaseContext() {}, source: { resolve: (result) => outcome.push(result) }
  }
  gateway.pendingRemoteEvents.set(pending.id, pending)
  gateway.deliverRemoteEvent(pending, gateway.remoteEventClients.get(readyA.clientId))
  gateway.deliverRemoteEvent(pending, gateway.remoteEventClients.get(readyB.clientId))
  assert.equal((await wsA.take('events-a', 'item')).value.request.private, 'owner-a')
  assert.equal(pending.deliveries.size, 1)
  const answer = { clientId: readyA.clientId, eventId: pending.id, outcome: { kind: 'result', value: 'owner-answer' } }
  assert.equal((await rpc('$events/result', undefined, cookieB, answer)).error.code, 'EISCORE_SESSION_OWNERSHIP_DENIED')
  assert.equal(outcome.length, 0)
  assert.equal((await rpc('$events/result', undefined, cookieA, answer)).ok, true)
  assert.deepEqual(outcome, [{ kind: 'result', value: 'owner-answer' }])
  assert.ok(wsB.inbox.every((frame) => frame.streamId !== 'events-b'), 'no foreign session, credential or approval frame was delivered')
  // Logout revokes existing HTTP cookies and already-open native WS streams.
  await nativeFetch(origin + '/api/eiscore/auth/logout', { method: 'POST', headers: { cookie: cookieA } })
  assert.equal((await rpc('session/list', {}, cookieA)).error.code, 'EISCORE_AUTH_REQUIRED')
  assert.equal((await wsA.take('history', 'error')).error.code, 'EISCORE_AUTH_REQUIRED')
  gateway.broadcastRemoteEvent({ event: 'api-session/status', args: [a, false] })
  assert.equal((await wsA.take('events-a', 'error')).error.code, 'EISCORE_AUTH_REQUIRED')
  wsA.open('after-logout', 'session/control')
  assert.equal((await wsA.take('after-logout', 'error')).error.code, 'EISCORE_AUTH_REQUIRED')
  console.log('PASS: pinned DSH 0.1.2-rc.1 Gateway/WebServer/Connection/ws, real handoff cookies, cross-user HTTP/list/search/history/control/workspace/events/approval filters and live logout revocation')
} finally {
  for (const socket of sockets) socket.terminate()
  await ctx.fiber.dispose()
  globalThis.fetch = nativeFetch
  if (priorAuth === undefined) delete globalThis[authKey]; else globalThis[authKey] = priorAuth
  for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key]
  Object.assign(process.env, priorEnv)
  rmSync(temporary, { recursive: true, force: true })
}
