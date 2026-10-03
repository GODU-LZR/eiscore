// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const clientSource = read('shared/eis-business-snapshot.js')
const client = await import(`data:text/javascript;base64,${Buffer.from(clientSource).toString('base64')}`)

const calls = []
let response = {
  ok: true,
  status: 200,
  json: async () => ({ snapshot: { snapshotTime: '2026-08-31T00:00:00.000Z', sales: { orders: 3 } } })
}
const loadSnapshot = client.createBusinessSnapshotLoader({
  getAuthHeaders: () => ({ Authorization: 'Bearer snapshot-token', 'X-Trace': 'trace-1' }),
  fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return response
  }
})

assert.deepEqual(await loadSnapshot(), {
  snapshotTime: '2026-08-31T00:00:00.000Z',
  sales: { orders: 3 }
})
assert.deepEqual(calls, [{
  url: '/ai/business-snapshot',
  options: {
    method: 'GET',
    headers: { Authorization: 'Bearer snapshot-token', 'X-Trace': 'trace-1' }
  }
}])

response = { ok: true, status: 200, json: async () => ({}) }
assert.deepEqual(await loadSnapshot(), {})

response = { ok: false, status: 403 }
await assert.rejects(loadSnapshot(), (error) => error.message === '快照读取失败 (403)' && error.status === 403)

const baseSource = read('eiscore-base/src/components/AiCopilot.vue')
assert.match(baseSource, /from\s*['"]@shared\/eis-business-snapshot['"]/)
assert.match(baseSource, /createBusinessSnapshotLoader\(\{\s*getAuthHeaders:\s*\(\)\s*=>\s*aiBridge\.buildAuthHeaders\(\)\s*\}\)/)
assert.match(baseSource, /smartBiSnapshot\.value\s*=\s*await loadBusinessSnapshot\(\)/)
assert.doesNotMatch(baseSource, /fetch\(['"]\/agent\/ai\/business-snapshot['"]/)

const mobileSource = read('eiscore-mobile/src/views/assistant/EnterpriseAssistant.vue')
assert.match(mobileSource, /from\s*['"]@shared\/eis-business-snapshot['"]/)
assert.match(mobileSource, /from\s*['"]@shared\/eis-agent-sse-client['"]/)
assert.match(mobileSource, /createBusinessSnapshotLoader\(\{\s*getAuthHeaders:\s*buildAuthHeaders\s*\}\)/)
assert.match(mobileSource, /businessSnapshot\.value\s*=\s*await requestBusinessSnapshot\(\)/)
assert.equal([...mobileSource.matchAll(/\bfetch\s*\(/g)].length, 0, 'mobile enterprise assistant must delegate SSE transport')

assert.doesNotMatch(clientSource, /localStorage|auth_token|user_info|clearAuth|location\.href|JSON\.stringify/)
assert.equal([...clientSource.matchAll(/\bglobalThis\.fetch\s*\(/g)].length, 1)
console.log('PASS: desktop and mobile business snapshots share one JSON Agent boundary')
