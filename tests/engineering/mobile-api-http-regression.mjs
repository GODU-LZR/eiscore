// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMobileApiRequest } from '../../eiscore-mobile/src/api/request-core.js'

const calls = []
const request = createMobileApiRequest({
  defaultHeaders: {
    'Accept-Profile': 'scm',
    'Content-Profile': 'scm'
  },
  getHttpClient: () => ({
    async requestJson(target, options) {
      calls.push({ target, options })
      return { data: [{ id: 7 }] }
    }
  })
})

assert.deepEqual(await request('GET', '/raw_materials', {
  params: {
    or: '(name.ilike.*轴承*,batch_no.ilike.*A/B*)',
    limit: 20
  },
  headers: {
    'Accept-Profile': 'public',
    'Content-Profile': 'public'
  }
}), [{ id: 7 }])
assert.equal(
  calls[0].target,
  '/raw_materials?or=(name.ilike.*%E8%BD%B4%E6%89%BF*%2Cbatch_no.ilike.*A%2FB*)&limit=20'
)
assert.equal(calls[0].options.method, 'GET')
assert.deepEqual(calls[0].options.headers, {
  'Content-Type': 'application/json',
  'Accept-Profile': 'public',
  'Content-Profile': 'public'
})
assert.equal(calls[0].options.body, undefined)

await request('POST', '/rpc/stock_in', { body: { p_quantity: 3 } })
assert.equal(calls[1].target, '/rpc/stock_in')
assert.equal(calls[1].options.method, 'POST')
assert.deepEqual(calls[1].options.body, { p_quantity: 3 })
assert.equal(calls[1].options.headers['Accept-Profile'], 'scm')

const failingRequest = (error) => createMobileApiRequest({
  getHttpClient: () => ({ requestJson: async () => { throw error } })
})
await assert.rejects(
  failingRequest(Object.assign(new Error('sanitized'), { status: 401 }))('GET', '/warehouses'),
  (error) => error.message === '登录已过期'
)
await assert.rejects(
  failingRequest(Object.assign(new Error('sanitized'), {
    status: 422,
    displayMessage: '盘点数量不能小于零'
  }))('PATCH', '/inventory_checks'),
  (error) => error.message === '盘点数量不能小于零'
)
await assert.rejects(
  failingRequest(Object.assign(new Error('sanitized'), { status: 503 }))('GET', '/warehouses'),
  (error) => error.message === '请求失败 (503)'
)
const networkError = Object.assign(new Error('network'), { code: 'network', status: 0 })
await assert.rejects(
  failingRequest(networkError)('GET', '/warehouses'),
  (error) => error === networkError
)

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const adapter = read('eiscore-mobile/src/platform/http-client.js')
assert.match(adapter, /export function getMobileHttpClient\(\)/)
assert.match(adapter, /onUnauthorized:\s*\(\)\s*=>\s*\{/)
assert.match(adapter, /clearAuth\(\)/)
assert.match(adapter, /window\.location\.href\s*=\s*['"]\/mobile\/login['"]/)
assert.match(adapter, /resolveErrorMessage:\s*\(data\)\s*=>\s*data\?\.message/)

for (const path of [
  'eiscore-mobile/src/api/attendance.js',
  'eiscore-mobile/src/api/check.js',
  'eiscore-mobile/src/api/stock.js',
  'eiscore-mobile/src/api/warehouse.js'
]) {
  const source = read(path)
  assert.match(source, /import \{ createMobileProfileRequest \} from ['"]\.\/request['"]/)
  assert.match(source, /createMobileProfileRequest\(['"](?:hr|scm)['"]\)/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /\bgetToken\b|\bclearAuth\b|\bAPI_BASE\b/)
}

const endpointContracts = {
  'eiscore-mobile/src/api/attendance.js': {
    profile: 'hr',
    calls: [
      ['get', '/v_attendance_daily'],
      ['get', '/v_attendance_monthly'],
      ['get', '/attendance_shifts'],
      ['get', '/attendance_records'],
      ['post', '/rpc/init_attendance_records'],
      ['patch', '/attendance_records']
    ]
  },
  'eiscore-mobile/src/api/check.js': {
    profile: 'scm',
    calls: [
      ['get', '/warehouses'],
      ['get', '/v_inventory_current'],
      ['get', '/raw_materials'],
      ['get', '/inventory_batches'],
      ['post', '/inventory_checks'],
      ['post', '/inventory_check_items'],
      ['post', '/inventory_transactions'],
      ['patch', '/inventory_checks'],
      ['patch', '/inventory_batches']
    ]
  },
  'eiscore-mobile/src/api/stock.js': {
    profile: 'scm',
    calls: [
      ['get', '/warehouses'],
      ['get', '/raw_materials'],
      ['get', '/inventory_batches'],
      ['get', '/v_inventory_current'],
      ['get', '/v_inventory_transactions'],
      ['post', '/rpc/stock_in'],
      ['post', '/rpc/stock_out']
    ]
  },
  'eiscore-mobile/src/api/warehouse.js': {
    profile: 'scm',
    calls: [
      ['get', '/warehouses'],
      ['get', '/v_inventory_current'],
      ['get', '/raw_materials'],
      ['get', '/inventory_batches'],
      ['get', '/inventory_transactions'],
      ['get', '/inventory_checks'],
      ['get', '/inventory_check_items']
    ]
  }
}
for (const [path, contract] of Object.entries(endpointContracts)) {
  const source = read(path)
  assert.match(source, new RegExp(`createMobileProfileRequest\\(['"]${contract.profile}['"]\\)`))
  for (const [method, endpoint] of contract.calls) {
    assert.ok(source.includes(`${method}('${endpoint}'`), `${path} must retain ${method.toUpperCase()} ${endpoint}`)
  }
  if (contract.profile === 'scm' && source.includes("'/raw_materials'")) {
    assert.match(source, /'Accept-Profile':\s*'public'/)
    assert.match(source, /'Content-Profile':\s*'public'/)
  }
}

console.log('PASS: mobile protected API wrappers use platform HTTP')
