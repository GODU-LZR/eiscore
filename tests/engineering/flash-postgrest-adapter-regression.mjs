// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const {
  FlashToolError,
  createFlashPostgrestAdapter
} = require('../../realtime/flash-postgrest-adapter')
const repoRoot = resolve(import.meta.dirname, '../..')

const jsonResponse = (status, payload, contentType = 'application/json') => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? contentType : '' },
  text: async () => payload === undefined || payload === null
    ? ''
    : (typeof payload === 'string' ? payload : JSON.stringify(payload))
})

const createHarness = (overrides = {}) => {
  const state = {
    calls: [],
    queue: [],
    signCalls: [],
    scheduled: [],
    cancelled: [],
    waits: []
  }
  const adapter = createFlashPostgrestAdapter({
    baseUrl: 'http://postgrest.local',
    userRole: 'web_user',
    jwtSecret: 'jwt-secret',
    toolCallTimeoutMs: 4321,
    signJwt: (payload, secret, options) => {
      state.signCalls.push({ payload, secret, options })
      return 'signed-user-token'
    },
    fetchImpl: async (url, init) => {
      state.calls.push({ url, init })
      const next = state.queue.shift()
      if (next instanceof Error) throw next
      if (typeof next === 'function') return next(url, init)
      if (!next) throw new Error(`missing fake response for ${url}`)
      return next
    },
    sanitizeQueryParams: (query = {}) => Object.fromEntries(
      Object.entries(query || {})
        .filter(([key, value]) => String(key).trim() && value !== undefined && value !== null)
        .map(([key, value]) => [String(key).trim(), String(value)])
    ),
    parseJson: (raw) => {
      try { return JSON.parse(String(raw)) } catch { return null }
    },
    normalizeText: (value) => String(value ?? '').trim(),
    wait: async (ms) => { state.waits.push(ms) },
    scheduleTimeout: (callback, ms) => {
      const handle = { callback, ms, id: state.scheduled.length + 1 }
      state.scheduled.push(handle)
      return handle
    },
    cancelTimeout: (handle) => { state.cancelled.push(handle) },
    ...overrides
  })
  return { adapter, state }
}

const user = {
  id: 17,
  username: 'operator',
  tenant_id: 'tenant-a',
  role: 'manager',
  permissions: ['apps.read'],
  token: 'original-user-token'
}
const { adapter, state } = createHarness()
assert.equal(Object.isFrozen(adapter), true)
assert.deepEqual(Object.keys(adapter).sort(), [
  'bindPgQueryForUser',
  'callPostgrestWithFlashTableEnsure',
  'callPostgrestWithUser',
  'inferFlashDataColumnsFromPayload',
  'resolveDataTableTarget'
])

state.queue.push(jsonResponse(200, [{ id: 1 }]))
const queried = await adapter.callPostgrestWithUser(user, {
  method: 'get',
  path: 'apps',
  query: { select: 'id', ignored: undefined, limit: 2 },
  acceptProfile: 'app_center',
  traceId: 'trace-1',
  prefer: 'count=exact'
})
assert.deepEqual(queried, {
  status: 200,
  data: [{ id: 1 }],
  path: '/apps?select=id&limit=2'
})
assert.equal(state.calls[0].url, 'http://postgrest.local/apps?select=id&limit=2')
assert.equal(state.calls[0].init.method, 'GET')
assert.equal(state.calls[0].init.body, undefined)
assert.equal(state.calls[0].init.headers.Authorization, 'Bearer signed-user-token')
assert.equal(state.calls[0].init.headers.Accept, 'application/json')
assert.equal(state.calls[0].init.headers['Accept-Profile'], 'app_center')
assert.equal(state.calls[0].init.headers['X-Trace-Id'], 'trace-1')
assert.equal(state.calls[0].init.headers.Prefer, 'count=exact')
assert.equal(state.calls[0].init.signal instanceof AbortSignal, true)
assert.deepEqual(state.signCalls[0], {
  payload: {
    sub: '17',
    username: 'operator',
    tenant_id: 'tenant-a',
    role: 'web_user',
    app_role: 'manager',
    permissions: ['apps.read']
  },
  secret: 'jwt-secret',
  options: { expiresIn: '15m' }
})
assert.equal(state.scheduled[0].ms, 4321)
assert.equal(state.cancelled[0], state.scheduled[0])

const aliasTenantHarness = createHarness()
aliasTenantHarness.state.queue.push(jsonResponse(200, []))
await aliasTenantHarness.adapter.callPostgrestWithUser({ id: 18, tenantId: 'tenant-b', token: 'raw' }, { path: '/tenant-alias' })
assert.equal(aliasTenantHarness.state.signCalls[0].payload.tenant_id, 'tenant-b')

state.queue.push(jsonResponse(201, [{ id: 2 }]))
await adapter.callPostgrestWithUser(user, {
  method: 'POST',
  path: '/apps',
  body: { name: 'demo' },
  acceptProfile: 'app_center',
  contentProfile: 'app_center',
  prefer: 'return=representation',
  timeoutMs: 9876
})
const postCall = state.calls[1]
assert.equal(postCall.init.headers['Content-Profile'], 'app_center')
assert.equal(postCall.init.headers['Content-Type'], 'application/json')
assert.equal(postCall.init.body, '{"name":"demo"}')
assert.equal(state.scheduled[1].ms, 9876)

state.queue.push(jsonResponse(204))
await adapter.callPostgrestWithUser(user, {
  method: 'DELETE',
  path: '/apps',
  contentProfile: 'app_center'
})
const deleteCall = state.calls[2]
assert.equal(deleteCall.init.headers['Content-Profile'], 'app_center')
assert.equal(deleteCall.init.headers['Content-Type'], undefined)
assert.equal(deleteCall.init.body, undefined)

state.queue.push(jsonResponse(200, 'plain response', 'text/plain'))
const raw = await adapter.callPostgrestWithUser(user, { path: '/' })
assert.deepEqual(raw.data, { raw: 'plain response' })

const fallbackHarness = createHarness({
  signJwt: () => { throw new Error('sign failed') }
})
fallbackHarness.state.queue.push(jsonResponse(200, []))
await fallbackHarness.adapter.callPostgrestWithUser(user, { path: '/fallback' })
assert.equal(
  fallbackHarness.state.calls[0].init.headers.Authorization,
  'Bearer original-user-token'
)

const mappedErrors = [
  [400, { message: 'bad input' }, 'VALIDATION_FAILED'],
  [401, { message: 'login required' }, 'PERMISSION_DENIED'],
  [403, { code: '42501', message: 'denied' }, 'RLS_DENIED'],
  [404, { message: 'missing' }, 'BAD_REQUEST'],
  [409, { message: 'duplicate' }, 'CONFLICT'],
  [504, { message: 'gateway timeout' }, 'TIMEOUT'],
  [500, { message: 'database down' }, 'UPSTREAM_ERROR']
]
for (const [status, payload, code] of mappedErrors) {
  state.queue.push(jsonResponse(status, payload))
  await assert.rejects(
    adapter.callPostgrestWithUser(user, { path: `/error-${status}` }),
    (error) => {
      assert.equal(error instanceof FlashToolError, true)
      assert.equal(error.code, code)
      assert.equal(error.reasonCode, code)
      assert.equal(error.httpStatus, status)
      assert.deepEqual(error.data, payload)
      assert.equal(error.message, payload.message)
      return true
    }
  )
}

const abortError = new Error('aborted')
abortError.name = 'AbortError'
state.queue.push(abortError)
await assert.rejects(
  adapter.callPostgrestWithUser(user, { path: '/slow', timeoutMs: 55 }),
  (error) => error instanceof FlashToolError && error.code === 'TIMEOUT' &&
    error.httpStatus === 504 && error.message === 'Tool upstream timeout after 55ms'
)
state.queue.push(new Error('network unavailable'))
await assert.rejects(
  adapter.callPostgrestWithUser(user, { path: '/offline' }),
  (error) => error instanceof FlashToolError && error.code === 'UPSTREAM_ERROR' &&
    error.httpStatus === 502 && error.message === 'network unavailable'
)

assert.deepEqual(adapter.resolveDataTableTarget('orders'), { schema: 'app_data', table: 'orders' })
assert.deepEqual(adapter.resolveDataTableTarget('public.orders'), { schema: 'public', table: 'orders' })
for (const invalid of ['', 'bad-name', 'a.b.c', '.orders']) {
  assert.throws(
    () => adapter.resolveDataTableTarget(invalid),
    (error) => error instanceof FlashToolError && error.code === 'VALIDATION_FAILED' && error.httpStatus === 400
  )
}
assert.deepEqual(adapter.inferFlashDataColumnsFromPayload({
  id: 1,
  count: 3,
  price: 3.5,
  enabled: true,
  business_date: '2026-08-31',
  happened_at: '2026-08-31T08:00:00Z',
  name: 'sample',
  properties: { hidden: true }
}), [
  { field: 'count', label: 'count', type: 'integer' },
  { field: 'price', label: 'price', type: 'numeric' },
  { field: 'enabled', label: 'enabled', type: 'boolean' },
  { field: 'business_date', label: 'business_date', type: 'date' },
  { field: 'happened_at', label: 'happened_at', type: 'timestamptz' },
  { field: 'name', label: 'name', type: 'text' }
])

const ensureHarness = createHarness()
ensureHarness.state.queue.push(
  jsonResponse(404, { code: 'PGRST205', message: 'table missing from schema cache' }),
  jsonResponse(200, {}),
  jsonResponse(404, { message: 'reload helper unavailable' }),
  jsonResponse(404, { code: 'PGRST205', message: 'still missing' }),
  jsonResponse(200, [{ id: 9 }])
)
const ensureColumns = [{ field: 'name', label: 'name', type: 'text' }]
const ensured = await ensureHarness.adapter.callPostgrestWithFlashTableEnsure(
  user,
  { schema: 'app_data', table: 'orders' },
  'app-17',
  {
    method: 'GET',
    path: '/orders',
    acceptProfile: 'app_data',
    traceId: 'trace-ensure'
  },
  ensureColumns
)
assert.deepEqual(ensured.data, [{ id: 9 }])
assert.deepEqual(ensureHarness.state.calls.map((call) => call.url), [
  'http://postgrest.local/orders',
  'http://postgrest.local/rpc/create_data_app_table',
  'http://postgrest.local/rpc/reload_schema_cache',
  'http://postgrest.local/orders',
  'http://postgrest.local/orders'
])
assert.deepEqual(JSON.parse(ensureHarness.state.calls[1].init.body), {
  app_id: 'app-17',
  table_name: 'orders',
  columns: ensureColumns
})
assert.equal(ensureHarness.state.calls[1].init.headers['Accept-Profile'], 'app_center')
assert.equal(ensureHarness.state.calls[1].init.headers['Content-Profile'], 'app_center')
assert.equal(ensureHarness.state.calls[2].init.headers['Accept-Profile'], 'public')
assert.equal(ensureHarness.state.calls[2].init.headers['Content-Profile'], 'public')
assert.deepEqual(ensureHarness.state.waits, [450, 350])

const noEnsureHarness = createHarness()
noEnsureHarness.state.queue.push(jsonResponse(404, { code: 'PGRST205', message: 'missing' }))
await assert.rejects(
  noEnsureHarness.adapter.callPostgrestWithFlashTableEnsure(
    user,
    { schema: 'public', table: 'orders' },
    'app-17',
    { path: '/orders' }
  ),
  (error) => error instanceof FlashToolError && error.code === 'BAD_REQUEST'
)
assert.equal(noEnsureHarness.state.calls.length, 1, 'non-app_data targets must not trigger table creation')

state.queue.push(jsonResponse(200, [{ id: 3 }]))
const boundQuery = adapter.bindPgQueryForUser(user)
await boundQuery({ path: '/bound' })
assert.equal(state.calls.at(-1).url, 'http://postgrest.local/bound')
assert.equal(state.calls.at(-1).init.headers.Authorization, 'Bearer signed-user-token')

const compositionRoot = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(compositionRoot, /require\('\.\/flash-postgrest-adapter'\)/)
assert.match(compositionRoot, /createFlashPostgrestAdapter\(/)
assert.doesNotMatch(
  compositionRoot,
  /(class FlashToolError|function (isValidDbObjectName|resolveDataTableTarget|isPostgrestSchemaCacheMiss|inferFlashDataColumnsFromPayload|reloadPostgrestSchemaCache|ensureFlashDataTable|callPostgrestWithFlashTableEnsure|mapPostgrestErrorCode|buildPostgrestPath|buildPostgrestUserToken|callPostgrestWithUser))/
)
assert.ok(compositionRoot.split(/\r?\n/).length <= 5063, 'Realtime composition root must not regain Flash PostgREST implementation')

console.log('PASS: Flash PostgREST adapter preserves JWT binding, profiles, payloads, timeout/error mapping, dynamic table ensure and schema-cache retries')
