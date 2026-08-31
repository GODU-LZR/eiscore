// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const clientSource = read('eiscore-base/src/utils/twin-json-client.js')
const clientModule = await import(`data:text/javascript;base64,${Buffer.from(clientSource).toString('base64')}`)

const calls = []
let response = { ok: true, status: 200, json: async () => ({ sessions: [{ id: 'session-1' }] }) }
const apiCall = clientModule.createTwinJsonClient({
  getAuthHeaders: () => ({ Authorization: 'Bearer twin-token', 'Content-Type': 'application/json' }),
  fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return response
  }
})

assert.deepEqual(await apiCall('/twin/sessions'), { sessions: [{ id: 'session-1' }] })
assert.deepEqual(calls[0], {
  url: '/agent/twin/sessions',
  options: {
    method: 'GET',
    headers: { Authorization: 'Bearer twin-token', 'Content-Type': 'application/json' },
    body: undefined
  }
})

response = { ok: true, status: 200, json: async () => ({ id: 'file-1' }) }
const body = { fileName: '测试.docx', tags: [] }
assert.deepEqual(await apiCall('/twin/knowledge/upload', { method: 'POST', body }), { id: 'file-1' })
assert.deepEqual(calls[1], {
  url: '/agent/twin/knowledge/upload',
  options: {
    method: 'POST',
    headers: { Authorization: 'Bearer twin-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
})

response = { ok: false, status: 503, text: async () => '上游错误'.repeat(100) }
await assert.rejects(
  apiCall('/twin/messages?session_id=session-1'),
  (error) => error.message === `API error 503: ${'上游错误'.repeat(100).slice(0, 200)}`
)

await assert.rejects(apiCall('/ai/chat/completions'), /Twin JSON path must start with \/twin\//)

for (const path of ['eiscore-base/src/views/HomeView.vue', 'eiscore-base/src/views/DigitalTwinView.vue']) {
  const source = read(path)
  assert.match(source, /from\s*['"]@\/utils\/twin-json-client['"]/)
  assert.match(source, /from\s*['"]@shared\/eis-agent-sse-client['"]/)
  assert.match(source, /const apiCall = createTwinJsonClient\(\{ getAuthHeaders \}\)/)
  assert.equal([...source.matchAll(/\bfetch\s*\(/g)].length, 0, `${path} must delegate Twin SSE transport`)
  assert.match(source, /path:\s*['"]\/agent\/twin\/chat['"]/)
  assert.doesNotMatch(source, /const url = `\/agent\$\{path\}`|API error \$\{res\.status\}/)
}

assert.doesNotMatch(clientSource, /localStorage|auth_token|user_info|clearAuth|location\.href/)
assert.equal([...clientSource.matchAll(/\bglobalThis\.fetch\s*\(/g)].length, 1)
console.log('PASS: Home and DigitalTwin share one non-streaming Twin JSON client')
