// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const clientSource = read('eiscore-apps/src/utils/flash-agent-client.js')
const clientModule = await import(`data:text/javascript;base64,${Buffer.from(clientSource).toString('base64')}`)

const calls = []
const responses = []
const client = clientModule.createFlashAgentClient({
  fetchImpl: async (url, options) => {
    calls.push({ url, options })
    const next = responses.shift()
    if (next instanceof Error) throw next
    return next
  }
})

responses.push(
  new Error('proxy unavailable'),
  { ok: true, status: 200, json: async () => ({ ok: true, data: { id: 'tool-result' } }) }
)
const payload = { tool_id: 'flash.app.save', arguments: { name: '测试应用' } }
assert.deepEqual(await client.callTool({
  urls: ['/agent/flash/tools/call', 'http://localhost:8078/flash/tools/call'],
  token: 'flash-token',
  payload
}), { ok: true, data: { id: 'tool-result' } })
assert.deepEqual(calls.slice(0, 2), [
  {
    url: '/agent/flash/tools/call',
    options: {
      method: 'POST',
      headers: {
        Authorization: 'Bearer flash-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  },
  {
    url: 'http://localhost:8078/flash/tools/call',
    options: {
      method: 'POST',
      headers: {
        Authorization: 'Bearer flash-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  }
])

for (const [body, status, message] of [
  [{ ok: false, message: '业务拒绝', code: 'FLASH_REJECTED' }, 200, '业务拒绝'],
  [{ ok: false, code: 'FLASH_REJECTED' }, 200, 'FLASH_REJECTED'],
  [{}, 503, '工具调用失败 (503)']
]) {
  responses.push({ ok: status < 400, status, json: async () => body })
  await assert.rejects(
    client.callTool({ urls: ['/agent/flash/tools/call'], token: 'flash-token', payload: {} }),
    (error) => error.message === message
  )
}

responses.push(
  { ok: false, status: 502, json: async () => ({ message: '代理失败' }) },
  {
    ok: true,
    status: 200,
    json: async () => ({ content: 'top-level draft', data: { content: 'nested draft' } })
  }
)
assert.equal(await client.fetchDraftSource({
  urls: ['/agent/flash/draft?appId=demo', 'http://localhost:8078/flash/draft?appId=demo'],
  token: 'draft-token'
}), 'top-level draft')
assert.deepEqual(calls.slice(-2), [
  {
    url: '/agent/flash/draft?appId=demo',
    options: {
      headers: { Authorization: 'Bearer draft-token' },
      cache: 'no-store'
    }
  },
  {
    url: 'http://localhost:8078/flash/draft?appId=demo',
    options: {
      headers: { Authorization: 'Bearer draft-token' },
      cache: 'no-store'
    }
  }
])

responses.push({ ok: true, status: 200, json: async () => ({ data: { content: 'nested draft' } }) })
assert.equal(await client.fetchDraftSource({ urls: ['/agent/flash/draft'], token: '' }), 'nested draft')
assert.deepEqual(calls.at(-1), {
  url: '/agent/flash/draft',
  options: { headers: {}, cache: 'no-store' }
})

responses.push(
  { ok: false, status: 404, json: async () => ({ message: 'not found' }) },
  new Error('direct endpoint unavailable')
)
await assert.rejects(
  client.fetchDraftSource({ urls: ['/agent/flash/draft', 'http://localhost:8078/flash/draft'] }),
  (error) => error.message === 'direct endpoint unavailable'
)

assert.doesNotMatch(clientSource, /localStorage|auth_token|user_info|location\.href|window\.location/)
assert.equal([...clientSource.matchAll(/\bglobalThis\.fetch\s*\(/g)].length, 1)
console.log('PASS: Flash tool calls and draft reads share one JSON Agent client')
