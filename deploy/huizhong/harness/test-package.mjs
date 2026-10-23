import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { apply, capabilities, normalizeDshSchema } from './eiscore-tools.mjs'
import { createBusinessSessionBindings } from './business-session-bindings.mjs'
import { createBusinessSessionProxy } from './web-session-proxy.mjs'
import { pluginList } from './dsh-http-bridge.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const workspace = resolve(root, '../../..')
const sdkRoot = process.env.DSH_TEST_MODULE_ROOT || resolve(workspace, 'agent-harness/node_modules')
const runnerSource = readFileSync(resolve(root, 'dsh-web-runner.mjs'), 'utf8')
assert.match(runnerSource, /import\s*\{\s*createBusinessSessionProxy\s*\}\s*from\s*['"]\.\/web-session-proxy\.mjs['"]/, 'Web runner must import the business session proxy')
assert.match(runnerSource, /const\s+proxyAuthenticatedRequest\s*=\s*createBusinessSessionProxy\s*\(\s*\{[\s\S]*?\bforward:\s*proxyRawRequest\b/, 'Authenticated Web requests must pass through business session binding')
assert.match(runnerSource, /proxyAuthenticatedRequest\(request,\s*response,\s*checkedHeaders,\s*checkedCookies\)/, 'The authenticated HTTP handler must invoke the bound session proxy')
const runner = await import(pathToFileURL(resolve(root, 'dsh-web-runner.mjs')))
assert.equal(typeof runner.shouldBootstrapDshAuth, 'function')
assert.equal(typeof runner.isDshBootstrapRedirect, 'function')
assert.equal(typeof runner.handleKnowledgeDshBootstrapRedirect, 'function')
assert.equal(runner.isDshBootstrapRedirect(
  { method: 'GET', url: '/' },
  { statusCode: 303, headers: { location: '/' } }
), true)
assert.equal(runner.isDshBootstrapRedirect(
  { method: 'GET', url: '/' },
  { statusCode: 302, headers: { location: '/' } }
), false)
assert.equal(runner.isDshBootstrapRedirect(
  { method: 'GET', url: '/assets/app.js' },
  { statusCode: 303, headers: { location: '/' } }
), false)
assert.equal(runner.shouldRefreshKnowledgeDshAuth(
  { method: 'GET', url: '/' },
  { statusCode: 303, headers: { location: '/' } },
  'knowledge'
), true)
assert.equal(runner.shouldRefreshKnowledgeDshAuth(
  { method: 'GET', url: '/' },
  { statusCode: 303, headers: { location: '/' } },
  'business'
), false)
assert.equal(runner.shouldRefreshKnowledgeDshAuth(
  { method: 'GET', url: '/' },
  { statusCode: 303, headers: { location: '/' } },
  'flash'
), false)
assert.equal(runner.knowledgeDshBootstrapAction(
  { method: 'GET', url: '/' },
  { statusCode: 303, headers: { location: '/?retry=1' } },
  true,
  'knowledge'
), 'refresh')
assert.equal(runner.knowledgeDshBootstrapAction(
  { method: 'GET', url: '/' },
  { statusCode: 303, headers: { location: '/' } },
  false,
  'knowledge'
), 'unavailable')
assert.equal(runner.knowledgeDshBootstrapAction(
  { method: 'GET', url: '/' },
  { statusCode: 303, headers: { location: 'https://other.example/' } },
  true,
  'knowledge'
), 'forward')
console.log('PASS: actual Web runner imports and connects authenticated requests to business session binding')
const require = createRequire(import.meta.url)
const { loadPluginRegistry } = require('./plugin-registry.js')
const { createHarnessGateway } = require(resolve(workspace, 'realtime/harness-gateway.js'))
const registry = loadPluginRegistry()
assert.deepEqual(registry.list().map((plugin) => plugin.plugin_id).sort(), ['company-sales', 'independent-site-sales', 'worker-grid'])
assert.deepEqual([...capabilities].sort(), ['eiscore_grid_query', 'eiscore_sales_context', 'eiscore_sales_write', 'eiscore_site_sales'])
assert.deepEqual(pluginList('enterprise-bi,company-sales,worker-grid,digital-twin,independent-site-sales'), [{ plugin_id: 'company-sales' }, { plugin_id: 'worker-grid' }, { plugin_id: 'independent-site-sales' }])
const gateway = createHarnessGateway({ registry, dispatch: async () => ({}), audit: () => {}, auditKey: 'test-only-audit-key-0000000000000000' })
const user = { id: 'test-admin', tenant_id: 'test-tenant', token: 'test-token', permissions: ['*'] }
const authorize = (capability_id, payload) => gateway.authorize({ capability_id, payload, user, confirmed: true, idempotency_key: 'test-idempotency-000001' })
for (const dataset of ['materials', 'inventory', 'employees', 'users']) assert.equal(authorize('eiscore_grid_query', { dataset }).ok, true)
for (const dataset of ['production_orders', 'apps', 'equipment']) assert.equal(authorize('eiscore_grid_query', { dataset }).code, 'HARNESS_INPUT_SCHEMA_INVALID')
for (const capability of ['eiscore_twin_chat', 'eiscore_enterprise_query', 'eiscore_document_commit', 'eiscore_flash_write', 'eiscore_workflow_write']) assert.equal(authorize(capability, {}).code, 'HARNESS_PLUGIN_UNAVAILABLE')
assert.equal(authorize('eiscore_sales_write', { operation: 'production_draft_create' }).code, 'HARNESS_INPUT_SCHEMA_INVALID')
assert.equal(authorize('eiscore_sales_write', { operation: 'sales_approval', object_type: 'production' }).code, 'HARNESS_INPUT_SCHEMA_INVALID')
assert.equal(authorize('eiscore_sales_write', { operation: 'qualify_lead', lead_id: 'test-lead' }).ok, true)
assert.equal(authorize('eiscore_grid_query', { dataset: 'materials', tenant_id: 'other' }).code, 'HARNESS_INPUT_SCHEMA_INVALID')
console.log('PASS: authoritative runtime denies forbidden plugins, production operations and datasets even for administrator')

const registrations = []
let approvalResult = 'rejected'
apply({ tools: { register: (definition) => registrations.push(definition) }, get: () => ({ request: async () => approvalResult }) })
const dshTools = await import(pathToFileURL(resolve(sdkRoot, '@deepseek-ai/dsh-tools/lib/index.js')))
const dshGateway = await import(pathToFileURL(resolve(sdkRoot, '@deepseek-ai/dsh-api-gateway/lib/index.js')))
const dshConnection = await import(pathToFileURL(resolve(sdkRoot, '@deepseek-ai/dsh-client-connection/lib/index.js')))
for (const tool of registrations) {
  dshTools.assertObjectJsonSchema(tool.parameters)
  dshTools.assertSupportedJsonSchema(tool.output.schema)
  const policy = registry.listCapabilities().find((policy) => policy.capability_id === tool.name)
  const expectedParameters = normalizeDshSchema(policy.input_schema)
  if (tool.name === 'eiscore_site_sales') {
    for (const field of ['view', 'view_id']) expectedParameters.properties[field].enum = ['site', 'catalog', 'knowledge']
  }
  assert.deepEqual(tool.parameters, expectedParameters)
}
console.log('PASS: all four tool schemas accepted by installed DeepSeek Harness validator')
const siteSalesTool = registrations.find((tool) => tool.name === 'eiscore_site_sales')
for (const field of ['view', 'view_id']) {
  assert.deepEqual(siteSalesTool.parameters.properties[field].enum, ['site', 'catalog', 'knowledge'])
  assert.equal(siteSalesTool.parameters.properties[field].enum.includes('overview'), false)
}
console.log('PASS: site sales tool registers only supported site, catalog and knowledge views')

const temporary = mkdtempSync(join(root, '.test-bindings-'))
const liveTokens = new Map([['cookie-a', 'token-a'], ['cookie-b', 'token-b'], ['cookie-a-renewed', 'token-a-renewed'], ['cookie-a-other-tenant', 'token-a-other-tenant']])
const fakeClaims = (token) => ({
  id: ['token-a-renewed', 'token-a-other-tenant'].includes(token) ? 'token-a' : token,
  tenant_id: token === 'token-a-other-tenant' ? 'other-tenant' : 'test-tenant'
})
const tokenForRequest = (request) => liveTokens.get(request.headers.get('cookie')) || ''
const ownerFile = join(temporary, 'owners.json')
const bindings = createBusinessSessionBindings({ tokenForRequest, claimsForToken: fakeClaims, ownerFile })
const priorSecret = process.env.EISCORE_TOOL_PROXY_SECRET
process.env.EISCORE_TOOL_PROXY_SECRET = 'test-only-bind-secret-000000000000000'
const bindingRequest = (cookie, body, secret = process.env.EISCORE_TOOL_PROXY_SECRET) => new Request('http://dsh.internal/api/eiscore/auth/bind-session', { method: 'POST', headers: { cookie, 'content-type': 'application/json', 'x-eis-bind-secret': secret }, body: JSON.stringify(body) })
const requestBody = async (request) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}
const received = []
const upstream = http.createServer(async (request, response) => {
  const raw = await requestBody(request)
  if (request.url === '/api/eiscore/auth/bind-session') {
    const result = await bindings.bind(new Request('http://dsh.internal' + request.url, { method: 'POST', headers: request.headers, body: raw }))
    response.writeHead(result.status, { 'content-type': 'application/json' }).end(await result.text())
    return
  }
  if (['/api/session/create', '/api/session/prompt'].includes(request.url)) {
    const message = dshConnection.clientRequestSchema.parse(JSON.parse(raw))
    const result = await dshGateway.TypertGatewayService.prototype.invokeRpc.call({
      invoke: async ({ namespace, method, args }) => {
        assert.equal(namespace, 'session')
        assert.equal('session/' + method, message.method)
        assert.equal(typeof args.request, 'object')
        return method === 'create' ? { sessionId: 'session-created-a' } : { accepted: true }
      }
    }, message.method, message.payload)
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ type: 'server-response', rpcId: message.rpcId, result }))
    return
  }
  if (request.url === '/ai/harness/execute') {
    received.push({ body: JSON.parse(raw), authorization: request.headers.authorization })
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: { dataset: 'materials', rows: [], limit: 10 } }))
    return
  }
  response.writeHead(404).end()
})
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
const proxy = http.createServer(createBusinessSessionProxy({ port: upstream.address().port, withToken: (path) => path, mapCookies: (cookies) => cookies, forward: (_request, response) => response.writeHead(404).end() }))
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
const proxyUrl = 'http://127.0.0.1:' + proxy.address().port
try {
  assert.equal((await bindings.bind(bindingRequest('cookie-a', { session_id: 'arbitrary', created: true }, 'bad-secret'))).status, 403)
  assert.equal((await bindings.bind(bindingRequest('bad-cookie', { session_id: 'arbitrary', created: true }))).status, 401)
  const call = (method, payload, cookie = 'cookie-a') => fetch(proxyUrl + '/api/session/' + method, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'test-' + method, method: 'session/' + method, payload: { args: { request: payload } } }) })
  assert.equal((await fetch(proxyUrl + '/api/session/create', { method: 'POST', headers: { cookie: 'cookie-a', 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'test-legacy-envelope', method: 'session/create', payload: { request: {} } }) })).status, 400)
  assert.equal((await call('create', { sessionId: 'someone-elses-session' })).status, 400)
  const created = await call('create', {})
  assert.equal(created.status, 200)
  assert.equal((await created.json()).result.ok, true)
  assert.equal(bindings.toolToken('session-created-a'), 'token-a')
  assert.equal((await call('prompt', { sessionId: 'session-created-a' }, 'cookie-b')).status, 403)
  assert.equal((await call('prompt', { sessionId: 'session-created-a' })).status, 200)
  assert.equal((await call('prompt', { sessionId: 'unregistered-session' })).status, 403)
  assert.doesNotMatch(readFileSync(ownerFile, 'utf8'), /token-a|cookie-a/)
  const restored = createBusinessSessionBindings({ tokenForRequest, claimsForToken: fakeClaims, ownerFile })
  assert.equal(restored.toolToken('session-created-a'), '')
  assert.equal((await restored.bind(bindingRequest('cookie-a-renewed', { session_id: 'session-created-a', created: false }))).status, 200)
  assert.equal(restored.toolToken('session-created-a'), 'token-a-renewed')
  assert.equal((await restored.bind(bindingRequest('cookie-b', { session_id: 'session-created-a', created: false }))).status, 403)
  assert.equal((await restored.bind(bindingRequest('cookie-a-other-tenant', { session_id: 'session-created-a', created: false }))).status, 403)
  assert.equal(restored.toolToken('session-created-a'), 'token-a-renewed')
  assert.equal((await restored.bind(bindingRequest('cookie-a-renewed', { session_id: 'unregistered-session', created: false }))).status, 403)
  assert.equal(restored.toolToken('unregistered-session'), '')
  globalThis[Symbol.for('eiscore.dsh.auth-bridge')] = { toolToken: bindings.toolToken }
  process.env.EISCORE_GATEWAY_URL = 'http://127.0.0.1:' + upstream.address().port
  const exec = { agent: { session: { id: 'session-created-a' } }, callId: 'test-call-1' }
  await assert.rejects(registrations.find((tool) => tool.name === 'eiscore_grid_query').execute({ dataset: 'materials' }, { ...exec, agent: { session: { id: 'unregistered-session' } } }), /authentication is required/)
  assert.equal(received.length, 0)
  assert.deepEqual(await registrations.find((tool) => tool.name === 'eiscore_grid_query').execute({ dataset: 'materials' }, exec), { dataset: 'materials', rows: [], limit: 10 })
  assert.equal(received[0].authorization, 'Bearer token-a')
  assert.equal(received[0].body.plugin_id, 'worker-grid')
  const sales = registrations.find((tool) => tool.name === 'eiscore_sales_write')
  await assert.rejects(sales.execute({ operation: 'qualify_lead', lead_id: 'test' }, exec), /not approved/)
  assert.equal(received.length, 1)
  approvalResult = 'allowed-once'
  await sales.execute({ operation: 'qualify_lead', lead_id: 'test' }, exec)
  assert.equal(received[1].body.confirmed, true)
  assert.match(received[1].body.idempotency_key, /^[a-f0-9]{64}$/)
  liveTokens.delete('cookie-a')
  assert.equal(bindings.toolToken('session-created-a'), '')
  await assert.rejects(registrations[0].execute({}, exec), /authentication is required/)
  console.log('PASS: Web session binding, persistent owner check, logout revocation, tool auth and explicit sales approval')
} finally {
  delete globalThis[Symbol.for('eiscore.dsh.auth-bridge')]
  if (priorSecret === undefined) delete process.env.EISCORE_TOOL_PROXY_SECRET
  else process.env.EISCORE_TOOL_PROXY_SECRET = priorSecret
  await new Promise((resolve) => proxy.close(resolve))
  await new Promise((resolve) => upstream.close(resolve))
  rmSync(temporary, { recursive: true, force: true })
}
