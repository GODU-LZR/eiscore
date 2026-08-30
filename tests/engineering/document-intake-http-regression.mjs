// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const clientSource = read('eiscore-base/src/utils/document-intake-client.js')
const clientModule = await import(`data:text/javascript;base64,${Buffer.from(clientSource).toString('base64')}`)

const calls = []
let authReads = 0
let nextResponse = { ok: true, status: 200, json: async () => ({ rows: [1] }) }
const client = clientModule.createDocumentIntakeClient({
  getAuthHeader: () => {
    authReads += 1
    return { Authorization: `Bearer token-${authReads}` }
  },
  fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return nextResponse
  }
})

assert.deepEqual(
  await client.requestJson('/agent/document-intake/admin/overview', {
    method: 'GET',
    errorMessage: '智能收单总览加载失败'
  }),
  { rows: [1] }
)
assert.deepEqual(calls[0], {
  url: '/agent/document-intake/admin/overview',
  options: { method: 'GET', headers: { Authorization: 'Bearer token-1' } }
})

nextResponse = { ok: true, status: 200, json: async () => ({ enabled: true }) }
assert.deepEqual(
  await client.requestJson('/agent/document-intake/admin/devices/device-1/watch-folders/folder-1/status', {
    method: 'POST',
    data: { enabled: true },
    errorMessage: '监听目录状态更新失败'
  }),
  { enabled: true }
)
assert.deepEqual(calls[1], {
  url: '/agent/document-intake/admin/devices/device-1/watch-folders/folder-1/status',
  options: {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-2',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ enabled: true })
  }
})

nextResponse = {
  ok: false,
  status: 409,
  text: async () => '监听目录已存在'
}
await assert.rejects(
  client.requestJson('/agent/document-intake/admin/devices/device-1/watch-folders', {
    method: 'POST',
    data: {},
    errorMessage: '监听目录新增失败'
  }),
  (error) => error.message === '监听目录已存在'
)

nextResponse = {
  ok: false,
  status: 503,
  text: async () => { throw new Error('body unavailable') }
}
await assert.rejects(
  client.requestJson('/agent/document-intake/admin/assets', {
    errorMessage: '资产列表加载失败'
  }),
  (error) => error.message === '资产列表加载失败：503'
)

await assert.rejects(
  client.requestJson('/api/document-intake/admin/assets'),
  /document intake path must start with \/agent\/document-intake\//
)

const apiSource = read('eiscore-base/src/utils/document-intake-api.js')
assert.match(apiSource, /from\s*['"]\.\/document-intake-client\.js['"]/)
assert.match(apiSource, /createDocumentIntakeClient\(\{\s*getAuthHeader\s*\}\)/)
assert.equal([...apiSource.matchAll(/documentIntakeClient\.requestJson\(/g)].length, 13)
assert.doesNotMatch(apiSource, /\bfetch\s*\(|response\.text\(|response\.json\(|JSON\.stringify/)
assert.doesNotMatch(clientSource, /localStorage|auth_token|user_info|clearAuth|location\.href/)
assert.equal([...clientSource.matchAll(/\bglobalThis\.fetch\s*\(/g)].length, 1)

console.log('PASS: document intake JSON Agent boundary preserves 13 request contracts')
