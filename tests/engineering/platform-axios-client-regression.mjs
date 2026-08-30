// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import {
  createPlatformAxiosClient,
  resolvePlatformAxiosUrl
} from '../../packages/eiscore-platform/src/axios-client.mjs'
import { PlatformHttpError } from '../../packages/eiscore-platform/src/http-client.mjs'
import {
  DEFAULT_ENTERPRISE_CONFIG,
  parseEnterpriseConfig
} from '../../packages/eiscore-platform/src/enterprise-config.mjs'

function createAxiosStub(adapter) {
  return {
    create(defaults) {
      const requestHandlers = []
      const responseHandlers = []
      const service = async (input = {}) => {
        let config = {
          ...defaults,
          ...input,
          headers: { ...(defaults.headers || {}), ...(input.headers || {}) }
        }
        try {
          for (const handler of requestHandlers) config = await handler.fulfilled(config)
          let response = await adapter(config)
          for (const handler of responseHandlers) response = await handler.fulfilled(response)
          return response
        } catch (caught) {
          let error = caught
          if (error && typeof error === 'object' && !error.config) error.config = config
          for (const handler of responseHandlers) {
            if (!handler.rejected) continue
            try {
              return await handler.rejected(error)
            } catch (nextError) {
              error = nextError
            }
          }
          throw error
        }
      }
      service.defaults = defaults
      service.interceptors = {
        request: {
          use(fulfilled, rejected) {
            requestHandlers.push({ fulfilled, rejected })
          }
        },
        response: {
          use(fulfilled, rejected) {
            responseHandlers.push({ fulfilled, rejected })
          }
        }
      }
      return service
    }
  }
}

const remoteSource = structuredClone(DEFAULT_ENTERPRISE_CONFIG)
remoteSource.enterprise.id = 'axios-contract'
remoteSource.endpoints.publicBaseUrl = 'https://erp.example.com/tenant/'
const remoteConfig = parseEnterpriseConfig(remoteSource, { source: 'Axios contract' })

assert.equal(
  resolvePlatformAxiosUrl('quality_inspections?status=eq.open', {
    enterpriseConfig: remoteConfig
  }),
  'https://erp.example.com/tenant/api/quality_inspections?status=eq.open'
)
assert.equal(
  resolvePlatformAxiosUrl('https://erp.example.com/tenant/api/quality_inspections?status=eq.open', {
    enterpriseConfig: remoteConfig
  }),
  'https://erp.example.com/tenant/api/quality_inspections?status=eq.open'
)
assert.equal(
  resolvePlatformAxiosUrl('https://eiscore.example.com/api/equipment_assets', {
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
    locationOrigin: 'https://eiscore.example.com'
  }),
  '/api/equipment_assets'
)

for (const target of [
  'https://attacker.invalid/api/quality_inspections',
  '//attacker.invalid/api/quality_inspections',
  '/quality_inspections#access-token',
  '/quality_inspections\\private',
  '../agent/secrets',
  '/%2e%2e/agent/secrets',
  'https://erp.example.com/tenant/other/quality_inspections'
]) {
  assert.throws(
    () => resolvePlatformAxiosUrl(target, { enterpriseConfig: remoteConfig }),
    (error) => error instanceof PlatformHttpError && error.code === 'invalid-path'
  )
}

{
  const calls = []
  const service = createPlatformAxiosClient({
    axios: createAxiosStub(async (config) => {
      calls.push(config)
      return { status: 200, data: [{ id: 1 }], config }
    }),
    enterpriseConfig: remoteConfig,
    getAccessToken: () => 'runtime-access-token',
    defaultProfile: 'public',
    timeoutMs: 8000
  })

  const data = await service({
    url: '/quality_inspections?status=eq.open',
    method: 'get',
    params: { limit: 25 },
    headers: { 'X-Trace-Mode': 'contract' }
  })
  assert.deepEqual(data, [{ id: 1 }])
  assert.equal(service.defaults.timeout, 8000)
  assert.equal(calls[0].url, 'https://erp.example.com/tenant/api/quality_inspections?status=eq.open')
  assert.deepEqual(calls[0].params, { limit: 25 })
  assert.equal(calls[0].headers.Authorization, 'Bearer runtime-access-token')
  assert.equal(calls[0].headers['Accept-Profile'], 'public')
  assert.equal(calls[0].headers['Content-Profile'], 'public')
  assert.equal(calls[0].headers['X-Trace-Mode'], 'contract')

  await service({
    url: '/quality_inspections',
    method: 'post',
    data: { inspection_no: 'Q-001' },
    headers: {
      'Accept-Profile': 'quality_private',
      'Content-Profile': 'quality_private'
    }
  })
  assert.equal(calls[1].headers['Accept-Profile'], 'quality_private')
  assert.equal(calls[1].headers['Content-Profile'], 'quality_private')
  assert.deepEqual(calls[1].data, { inspection_no: 'Q-001' })
}

{
  const calls = []
  const service = createPlatformAxiosClient({
    axios: createAxiosStub(async (config) => {
      calls.push(config)
      return { status: 204, data: null, config }
    }),
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
    defaultProfile: () => 'public',
    defaultAccept: 'application/json'
  })
  await service({ url: '/equipment_assets', method: 'delete' })
  assert.equal(calls[0].headers.Accept, 'application/json')
  assert.equal(calls[0].headers['Accept-Profile'], 'public')
}

{
  const error = Object.assign(new Error('request leaked?secret-query-value'), {
    response: { status: 401 }
  })
  const unauthorizedEvents = []
  const notifications = []
  const service = createPlatformAxiosClient({
    axios: createAxiosStub(async () => { throw error }),
    enterpriseConfig: remoteConfig,
    getAccessToken: () => 'must-not-appear',
    defaultProfile: 'public',
    notifyError: (message, event) => notifications.push({ message, event }),
    onUnauthorized: (event) => unauthorizedEvents.push(event)
  })

  await assert.rejects(
    service({
      url: '/quality_inspections?select=secret-query-value',
      method: 'post',
      data: { password: 'body-must-not-appear' }
    }),
    (caught) => caught === error
  )
  assert.deepEqual(unauthorizedEvents, [{
    code: 'unauthorized',
    status: 401,
    method: 'POST',
    path: '/quality_inspections'
  }])
  assert.deepEqual(notifications, [{
    message: '登录已过期，请重新登录',
    event: unauthorizedEvents[0]
  }])
  assert.doesNotMatch(JSON.stringify({ unauthorizedEvents, notifications }), /must-not-appear|secret-query-value|body-must-not-appear/)
  assert.doesNotMatch(JSON.stringify(error), /must-not-appear|secret-query-value|body-must-not-appear/)
}

{
  const notifications = []
  const networkError = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
  const service = createPlatformAxiosClient({
    axios: createAxiosStub(async () => { throw networkError }),
    notifyError: (message, event) => notifications.push({ message, event })
  })
  await assert.rejects(service({ url: '/equipment_assets' }), (error) => error === networkError)
  assert.deepEqual(notifications, [{
    message: 'Network Error',
    event: {
      code: 'network',
      status: 0,
      method: 'GET',
      path: '/equipment_assets'
    }
  }])
}

{
  const errors = [
    Object.assign(new Error('Request failed with status code 401'), { response: { status: 401 } }),
    Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } })
  ]
  const notifications = []
  const unauthorizedEvents = []
  const service = createPlatformAxiosClient({
    axios: createAxiosStub(async () => { throw errors.shift() }),
    shouldNotifyError: (config) => (
      config.silentError !== true && config.suppressErrorMessage !== true
    ),
    notifyError: (message, event) => notifications.push({ message, event }),
    onUnauthorized: (event) => unauthorizedEvents.push(event)
  })
  await assert.rejects(service({ url: '/sales_orders', silentError: true }))
  await assert.rejects(service({ url: '/sales_orders', suppressErrorMessage: true }))
  assert.deepEqual(notifications, [])
  assert.deepEqual(unauthorizedEvents, [{
    code: 'unauthorized',
    status: 401,
    method: 'GET',
    path: '/sales_orders'
  }])
}

console.log('PASS: platform Axios compatibility contract')
