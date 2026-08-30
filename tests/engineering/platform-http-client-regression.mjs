// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import {
  PlatformHttpError,
  classifyHttpStatus,
  createPlatformHttpClient,
  resolvePlatformServiceUrl
} from '../../packages/eiscore-platform/src/http-client.mjs'
import {
  DEFAULT_ENTERPRISE_CONFIG,
  parseEnterpriseConfig
} from '../../packages/eiscore-platform/src/enterprise-config.mjs'

const remoteSource = structuredClone(DEFAULT_ENTERPRISE_CONFIG)
remoteSource.enterprise.id = 'http-contract'
remoteSource.endpoints.publicBaseUrl = 'https://erp.example.com/'
const remoteConfig = parseEnterpriseConfig(remoteSource, { source: 'HTTP contract' })

assert.equal(
  resolvePlatformServiceUrl('/system_configs?key=eq.app_settings', {
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG
  }),
  '/api/system_configs?key=eq.app_settings'
)
assert.equal(
  resolvePlatformServiceUrl('/system_configs?key=eq.app_settings', {
    enterpriseConfig: remoteConfig
  }),
  'https://erp.example.com/api/system_configs?key=eq.app_settings'
)
assert.equal(classifyHttpStatus(401), 'unauthorized')
assert.equal(classifyHttpStatus(403), 'forbidden')
assert.equal(classifyHttpStatus(404), 'not-found')
assert.equal(classifyHttpStatus(409), 'conflict')
assert.equal(classifyHttpStatus(422), 'validation')
assert.equal(classifyHttpStatus(429), 'rate-limited')
assert.equal(classifyHttpStatus(503), 'server')

for (const path of [
  'https://attacker.invalid/api/system_configs',
  '//attacker.invalid/api/system_configs',
  '../agent/secrets',
  '/system_configs#token',
  '/system_configs\\private'
]) {
  assert.throws(
    () => resolvePlatformServiceUrl(path, { enterpriseConfig: remoteConfig }),
    (error) => error instanceof PlatformHttpError && error.code === 'invalid-path'
  )
}

{
  const calls = []
  const client = createPlatformHttpClient({
    enterpriseConfig: remoteConfig,
    getAccessToken: () => 'runtime-access-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return new Response(JSON.stringify([{ value: { themeColor: '#409EFF' } }]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }
  })
  const result = await client.requestJson('/system_configs?key=eq.app_settings', {
    headers: { 'Accept-Profile': 'public' }
  })
  assert.equal(result.status, 200)
  assert.equal(result.data[0].value.themeColor, '#409EFF')
  assert.equal(calls[0].url, 'https://erp.example.com/api/system_configs?key=eq.app_settings')
  assert.equal(calls[0].init.headers.get('Authorization'), 'Bearer runtime-access-token')
  assert.equal(calls[0].init.headers.get('Accept-Profile'), 'public')
  assert.equal(calls[0].init.credentials, 'same-origin')
}

{
  const calls = []
  const client = createPlatformHttpClient({
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
    getAccessToken: () => '',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return new Response('', { status: 201 })
    }
  })
  await client.requestJson('/system_configs', {
    method: 'POST',
    body: { key: 'app_settings', value: { notifications: true } }
  })
  assert.equal(calls[0].init.headers.get('Content-Type'), 'application/json')
  assert.equal(calls[0].init.body, JSON.stringify({
    key: 'app_settings',
    value: { notifications: true }
  }))
}

{
  const unauthorizedEvents = []
  const client = createPlatformHttpClient({
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
    getAccessToken: () => 'must-not-appear-in-errors',
    onUnauthorized: (event) => unauthorizedEvents.push(event),
    fetchImpl: async () => new Response(JSON.stringify({
      message: 'server-secret-must-not-appear'
    }), { status: 401, headers: { 'content-type': 'application/json' } })
  })
  await assert.rejects(
    client.requestJson('/system_configs?select=sensitive-query-value'),
    (error) => {
      assert.ok(error instanceof PlatformHttpError)
      assert.equal(error.code, 'unauthorized')
      assert.equal(error.status, 401)
      assert.equal(error.path, '/system_configs')
      assert.doesNotMatch(error.message, /must-not-appear|sensitive-query-value|server-secret/)
      return true
    }
  )
  assert.deepEqual(unauthorizedEvents, [{
    code: 'unauthorized',
    status: 401,
    method: 'GET',
    path: '/system_configs'
  }])
}

{
  const responses = [
    { message: '盘点数量不能小于零' },
    { message: 'token=must-not-appear' },
    { message: `业务错误${'过'.repeat(200)}` }
  ]
  const client = createPlatformHttpClient({
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
    resolveErrorMessage: (data) => data?.message,
    fetchImpl: async () => new Response(JSON.stringify(responses.shift()), {
      status: 422,
      headers: { 'content-type': 'application/json' }
    })
  })
  await assert.rejects(
    client.requestJson('/inventory_checks'),
    (error) => {
      assert.equal(error.message, 'Platform HTTP request failed: validation (GET /inventory_checks)')
      assert.equal(error.displayMessage, '盘点数量不能小于零')
      return true
    }
  )
  for (let index = 0; index < 2; index += 1) {
    await assert.rejects(
      client.requestJson('/inventory_checks'),
      (error) => {
        assert.equal(error.displayMessage, undefined)
        assert.doesNotMatch(error.message, /must-not-appear|业务错误/)
        return true
      }
    )
  }
}

{
  const client = createPlatformHttpClient({
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
    timeoutMs: 100,
    setTimeoutImpl(callback) {
      queueMicrotask(callback)
      return 1
    },
    clearTimeoutImpl() {},
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  })
  await assert.rejects(
    client.requestJson('/system_configs'),
    (error) => error instanceof PlatformHttpError && error.code === 'timeout'
  )
}

console.log('PASS: platform HTTP client contract')
