import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { createBusinessSessionProxy } from './web-session-proxy.mjs'

const rolePath = '/api/eiscore/business/role'
const jwt = (id) => `test.${Buffer.from(JSON.stringify({ sub: id, tenant_id: 'tenant' })).toString('base64url')}.fixture`

if (process.argv.includes('--upstream')) {
  const { createBusinessSessionBindings } = await import('./business-session-bindings.mjs')
  const { apply } = await import('./business-role-policy.mjs')
  const token = (request) => ['a', 'b'].includes(request.headers.get('cookie')) ? jwt(request.headers.get('cookie')) : ''
  const bindings = createBusinessSessionBindings({ tokenForRequest: token, claimsForToken: (value) => { const claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url')); return { id: claims.sub, tenant_id: claims.tenant_id } } })
  globalThis[Symbol.for('eiscore.dsh.auth-bridge')] = { token, toolToken: bindings.toolToken }
  const routes = new Map()
  const prompts = []
  const calls = []
  let counter = 0
  apply({
    workspaceRegistry: { resolveByPath: async () => ({ id: 'business-ws', title: '业务助手工作区' }) },
    systemPrompt: { getSectionOrder: () => 0, section: (value) => prompts.push(value) },
    effect: (effect) => effect(),
    connection: { requestRejection: () => undefined, fetch: { register: (route) => routes.set(route.path, route.fetch) } },
    webServer: { register: (route) => routes.set(route.path, route.handler) }
  })
  const server = http.createServer(async (req, res) => {
    try {
      const path = req.url.split('?')[0]
      if (path === rolePath) { calls.push('role'); return routes.get(path)(req, res) }
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = Buffer.concat(chunks)
      const request = new Request(`http://localhost${path}`, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body } : {}) })
      let response
      if (path === '/api/eiscore/auth/bind-session') { calls.push('bind'); response = await bindings.bind(request) }
      else if (path === '/api/session/create') {
        calls.push('create')
        response = Response.json({ result: { ok: true, value: { sessionId: `session-${++counter}` } } })
      } else if (path === '/api/session/prompt') {
        calls.push('prompt')
        const id = JSON.parse(body).payload.args.request.sessionId
        response = Response.json({ result: { ok: true, value: { systemPrompt: prompts.map((part) => part.text({ agent: { session: { id } } })).join('\n') } } })
      } else if (path === '/test/calls') response = Response.json(calls)
      else if (routes.has(path)) response = await routes.get(path)(request)
      else response = new Response('', { status: 404 })
      res.writeHead(response.status, Object.fromEntries(response.headers)).end(await response.text())
    } catch (error) { res.writeHead(500).end(String(error)) }
  })
  server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }))
} else {
  const taskDir = mkdtempSync(join(tmpdir(), 'eiscore-role-test-'))
  const secret = 'fixture-secret-'.repeat(4)
  process.env.EISCORE_TOOL_PROXY_SECRET = secret
  let child
  let proxy
  try {
    const launch = async () => {
      child = fork(new URL(import.meta.url), ['--upstream'], { env: { ...process.env, DSH_HOME: taskDir, EISCORE_TOOL_PROXY_SECRET: secret }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
      child.stderr.on('data', (value) => process.stderr.write(value))
      return (await once(child, 'message'))[0].port
    }
    let port = await launch()
    proxy = http.createServer((req, res) => createBusinessSessionProxy({ port, withToken: (path) => path, mapCookies: (values) => values, forward: (_req, response) => response.writeHead(404).end() })(req, res))
    proxy.listen(0, '127.0.0.1')
    await once(proxy, 'listening')
    const base = `http://127.0.0.1:${proxy.address().port}`
    const rpc = async (method, input, entry, cookie = 'a') => {
      const response = await fetch(`${base}/api/${method}`, { method: 'POST', headers: { cookie, ...(entry === undefined ? {} : { 'x-eis-business-entry': entry }) }, body: JSON.stringify({ type: 'client-request', method, payload: { args: { request: input } } }) })
      return { status: response.status, body: await response.json() }
    }
    const internal = async (body, cookie = 'a', key = secret) => {
      const response = await fetch(`http://127.0.0.1:${port}${rolePath}`, { method: 'POST', headers: { cookie, 'x-eis-bind-secret': key }, body: JSON.stringify(body) })
      return response.status
    }
    const context = async (cookie = 'a') => (await fetch(`http://127.0.0.1:${port}/api/eiscore/business/context`, { headers: { cookie } })).json()
    assert.equal((await rpc('session/create', { workspaceId: 'other' }, 'worker')).status, 400)
    for (const field of ['sessionId', 'cwd', 'agentPreset']) assert.equal((await rpc('session/create', { workspaceId: 'business-ws', [field]: '' }, 'worker')).status, 400)
    for (const entry of ['flash', 'admin', '']) assert.equal((await rpc('session/create', { workspaceId: 'business-ws' }, entry)).status, 400)
    assert.equal((await rpc('session/create', { workspaceId: 'business-ws', entry: 'worker' }, 'worker')).status, 400)
    const worker = await rpc('session/create', { workspaceId: 'business-ws' }, 'worker')
    assert.equal(worker.status, 200)
    const workerId = worker.body.result.value.sessionId
    const workbench = await rpc('session/create', { workspaceId: 'business-ws' }, 'workbench')
    const analysisId = workbench.body.result.value.sessionId
    assert.notEqual(workerId, analysisId)
    let prompt = await rpc('session/prompt', { sessionId: workerId }, 'worker')
    assert.match(prompt.body.result.value.systemPrompt, /一线员工/)
    assert.equal((await rpc('session/prompt', { sessionId: workerId }, 'workbench')).status, 409)
    assert.equal((await rpc('session/prompt', { sessionId: workerId }, 'worker', 'b')).status, 403)
    assert.equal(await internal({ session_id: workerId, entry: 'workbench', created: true }), 409)
    assert.equal(await internal({ session_id: workerId, entry: 'worker', created: false }, 'a', ''), 403)
    assert.equal(await internal({ session_id: 'unowned', entry: 'worker', created: true }), 403)
    const legacy = await rpc('session/create', { workspaceId: 'business-ws' })
    const legacyId = legacy.body.result.value.sessionId
    assert.equal((await rpc('session/prompt', { sessionId: legacyId }, 'worker')).status, 409)
    prompt = await rpc('session/prompt', { sessionId: legacyId })
    assert.equal(prompt.status, 200)
    assert.match(prompt.body.result.value.systemPrompt, /未被追认/)
    // History of the other role remains usable with its own immutable persona.
    prompt = await rpc('session/prompt', { sessionId: analysisId }, 'workbench')
    assert.match(prompt.body.result.value.systemPrompt, /指标定义/)
    const a = await context()
    assert.deepEqual(a.sessions, { [workerId]: 'worker', [analysisId]: 'workbench' })
    assert.deepEqual((await context('b')).sessions, {})
    const calls = await (await fetch(`http://127.0.0.1:${port}/test/calls`)).json()
    const firstCreate = calls.indexOf('create')
    assert.deepEqual(calls.slice(firstCreate, firstCreate + 3), ['create', 'bind', 'role'])
    child.kill(); await once(child, 'exit')
    port = await launch()
    assert.deepEqual((await context()).sessions, a.sessions)
    prompt = await rpc('session/prompt', { sessionId: workerId }, 'worker')
    assert.equal(prompt.status, 200)
    assert.match(prompt.body.result.value.systemPrompt, /表单填写指导/)
    console.log('PASS: cross-process native create → owner bind → immutable role → actual dynamic system prompt; workspace, cross-owner, legacy, restart persistence')
  } finally {
    if (proxy) await new Promise((resolve) => proxy.close(resolve))
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit') }
    rmSync(taskDir, { recursive: true, force: true })
  }
}
