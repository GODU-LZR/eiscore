// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const clientSource = read('shared/eis-agent-sse-client.js')
const clientModule = await import(`data:text/javascript;base64,${Buffer.from(clientSource).toString('base64')}`)

const encoder = new TextEncoder()
const makeBody = (text, splitAt = []) => {
  const encoded = encoder.encode(text)
  const offsets = [0, ...splitAt, encoded.length]
  const chunks = offsets.slice(0, -1).map((start, index) => encoded.slice(start, offsets[index + 1]))
  let index = 0
  return {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++] }
        }
      }
    }
  }
}

const calls = []
const responses = []
const lifecycle = []
const client = clientModule.createAgentSseClient({
  fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return responses.shift()
  }
})

const controller = new AbortController()
responses.push({
  ok: true,
  status: 200,
  headers: { get: (name) => name === 'x-eis-ai-agent' ? 'smart-bi' : null },
  body: makeBody(
    'event: message\ndata: {"text":"你好"}\n data: {"ignored":true}\ndata: [DONE]\n',
    [28, 29]
  )
})
const dataEvents = []
await client.streamAgentEvents({
  path: '/ai/chat/completions',
  headers: { Authorization: 'Bearer stream-token', 'Content-Type': 'application/json' },
  payload: { stream: true, messages: [{ role: 'user', content: '你好' }] },
  signal: controller.signal,
  onResponse: (response) => lifecycle.push(`response:${response.headers.get('x-eis-ai-agent')}`),
  onOpen: () => lifecycle.push('open'),
  onData: (data) => dataEvents.push(data)
})
assert.deepEqual(dataEvents, ['{"text":"你好"}'])
assert.deepEqual(lifecycle, ['response:smart-bi', 'open'])
assert.deepEqual(calls[0], {
  url: '/ai/chat/completions',
  options: {
    method: 'POST',
    headers: { Authorization: 'Bearer stream-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ stream: true, messages: [{ role: 'user', content: '你好' }] }),
    signal: controller.signal
  }
})

responses.push({
  ok: true,
  status: 200,
  headers: { get: () => null },
  body: makeBody(' data: {"trimmed":true}\r\n\n')
})
const trimmedEvents = []
await client.streamAgentEvents({
  path: '/twin/chat',
  headers: {},
  payload: {},
  trimLines: true,
  onData: (data) => trimmedEvents.push(data)
})
assert.deepEqual(trimmedEvents, ['{"trimmed":true}'])
assert.equal(Object.hasOwn(calls[1].options, 'signal'), false)

responses.push({ ok: false, status: 503, headers: { get: () => null }, body: null })
await assert.rejects(
  client.streamAgentEvents({
    path: '/ai/chat/completions',
    headers: {},
    payload: {},
    onResponse: (response) => {
      const error = new Error(`network ${response.status}`)
      error.status = response.status
      throw error
    }
  }),
  (error) => error.message === 'network 503' && error.status === 503
)

responses.push({ ok: true, status: 200, headers: { get: () => null }, body: null })
await assert.rejects(
  client.streamAgentEvents({
    path: '/twin/chat',
    headers: {},
    payload: {},
    missingBodyMessage: '无法获取流式响应'
  }),
  /无法获取流式响应/
)

await assert.rejects(
  client.streamAgentEvents({ path: '/api/private', headers: {}, payload: {} }),
  /Harness SSE path must start with \/ai\/ or \/twin\//
)
assert.equal(calls.length, 4)

const abortController = new AbortController()
const abortClient = clientModule.createAgentSseClient({
  fetchImpl: async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error(`aborted ${url}`)
      error.name = 'AbortError'
      reject(error)
    }, { once: true })
  })
})
const abortedRequest = abortClient.streamAgentEvents({
  path: '/twin/chat',
  headers: {},
  payload: {},
  signal: abortController.signal
})
abortController.abort()
await assert.rejects(abortedRequest, (error) => error.name === 'AbortError')

const consumers = [
  'eiscore-base/src/utils/ai-bridge.js',
  'eiscore-mobile/src/views/assistant/EnterpriseAssistant.vue',
  'eiscore-mobile/src/views/assistant/WarehouseAssistant.vue'
]
for (const path of consumers) {
  const source = read(path)
  assert.match(source, /import\s*{\s*streamAgentEvents\s*}\s*from\s*['"]@shared\/eis-agent-sse-client['"]/, path)
  assert.equal([...source.matchAll(/\bstreamAgentEvents\s*\(\{/g)].length, 1, path)
  assert.doesNotMatch(source, /\bfetch\s*\(|\.getReader\s*\(|new TextDecoder\s*\(/, path)
  assert.match(source, /const streamController = new AbortController\(\)/, path)
  assert.match(source, /signal:\s*streamController\.signal/, path)
  assert.match(source, /(?:this\.)?activeStreamController\?\.abort\(\)/, path)
  assert.match(source, /e\?\.name (?:!==|===) ['"]AbortError['"]/, path)
}

const bridge = read(consumers[0])
assert.match(bridge, /path:\s*['"]\/ai\/chat\/completions['"]/)
assert.match(bridge, /response\.headers\.get\(['"]x-eis-ai-agent['"]\)/)
assert.match(bridge, /网络错误: \$\{response\.status}/)
assert.match(bridge, /missingBodyMessage:\s*['"]无可用的流式响应['"]/)
assert.match(bridge, /console\.warn\(['"]\[AiBridge] SSE Parse Failed['"]/)
assert.match(bridge, /if \(this\.activeStreamController === streamController\)\s*\{/)

for (const path of []) {
  const source = read(path)
  assert.match(source, /path:\s*['"]\/twin\/chat['"]/)
  assert.match(source, /errText\.slice\(0, 200\)/)
  assert.match(source, /missingBodyMessage:\s*['"]无法获取流式响应['"]/)
  assert.match(source, /parsed\.type === ['"]tool_start['"]/)
}

for (const path of consumers.slice(1)) {
  const source = read(path)
  assert.match(source, /path:\s*['"]\/ai\/chat\/completions['"]/)
  assert.match(source, /errText\.slice\(0, 100\)/)
  assert.match(source, /trimLines:\s*true/)
  assert.match(source, /json\?\.choices\?\.\[0\]\?\.delta\?\.content/)
}

assert.doesNotMatch(clientSource, /localStorage|auth_token|user_info|location\.href|window\.location|JSON\.parse/)
assert.equal([...clientSource.matchAll(/\bglobalThis\.fetch\s*\(/g)].length, 1)
console.log('PASS: Agent SSE consumers share one cancelable streaming boundary')
