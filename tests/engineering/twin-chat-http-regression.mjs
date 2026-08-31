// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const { createTwinChatHttpHandler } = require(resolve(repoRoot, 'realtime/twin-chat-http.js'))

const user = Object.freeze({ username: 'operator', role: 'employee' })
let authorized = true
let body = {}
let bodyError = null
let config = { api_url: 'https://ai.example.invalid', api_key: 'secret', model: 'twin-model' }
let configError = null
let sessionError = null
let historyError = null
let semanticError = null
let engineMode = 'success'
let upstreamMode = 'non-stream'
const events = []
const jsonResponses = []
const upstreamCalls = []
const engineRuns = []
let engineOptions = null

class FakeTwinEngine {
  constructor(options) {
    engineOptions = options
  }

  async run(message, history, context) {
    engineRuns.push({ message, history, context })
    if (engineMode === 'throw') throw new Error('engine failed')
    if (engineMode === 'abort') {
      currentRequest.closeHandler()
      engineOptions.onEvent({ type: 'thinking', detail: 'ignored' })
      return { streamed: false, answer: 'ignored', turns: 1, toolLogs: [] }
    }
    engineOptions.onEvent({ type: 'tool', detail: 'lookup' })
    const intermediate = await engineOptions.aiCaller({ messages: [{ role: 'user', content: 'reason' }] })
    assert.deepEqual(intermediate, { choices: [{ message: { content: 'reasoned' } }] })
    const streamed = await engineOptions.streamingAiCaller({ messages: [{ role: 'user', content: 'answer' }] })
    assert.equal(streamed, upstreamMode === 'stream' ? 'streamed answer' : 'fallback stream answer content')
    return { streamed: true, answer: 'unused', turns: 2, toolLogs: [{ id: 'tool-1' }] }
  }
}

const persistence = {
  async createSession(title) {
    events.push(['createSession', title])
    if (sessionError) throw sessionError
    return 'session-new'
  },
  async loadHistory(sessionId, limit) {
    events.push(['loadHistory', sessionId, limit])
    if (historyError) throw historyError
    return [{ role: 'assistant', content: 'stored history' }]
  }
}

const createResponse = () => ({
  headersSent: false,
  writableEnded: false,
  headers: null,
  rawWrites: [],
  payloadWrites: [],
  flushed: false,
  done: false,
  writeHead(status, headers) {
    this.status = status
    this.headers = headers
    this.headersSent = true
  },
  flushHeaders() {
    this.flushed = true
  },
  write(value) {
    this.rawWrites.push(value)
  },
  end() {
    this.writableEnded = true
  }
})

let currentRequest = null
const createRequest = () => {
  const request = {
    closeHandler: () => {},
    on(event, handler) {
      if (event === 'close') this.closeHandler = handler
    }
  }
  currentRequest = request
  return request
}

const handler = createTwinChatHttpHandler({
  authorizeTwinRequest() {
    events.push(['authorize'])
    return authorized ? user : null
  },
  async readJsonBody() {
    events.push(['readJsonBody'])
    if (bodyError) throw bodyError
    return body
  },
  normalizeAiText(value) {
    return String(value || '').trim()
  },
  sendJson(_res, status, payload) {
    jsonResponses.push({ status, payload })
  },
  async getAiConfig() {
    events.push(['getAiConfig'])
    if (configError) throw configError
    return config
  },
  bindPgQueryForUser(value) {
    assert.equal(value, user)
    return 'bound-query'
  },
  async fetchSemanticContext(value) {
    assert.equal(value, user)
    if (semanticError) throw semanticError
    return { tables: [{ name: 'orders' }] }
  },
  async callAiUpstreamWithRetry(payload, options, retry) {
    upstreamCalls.push({ payload, options, retry })
    if (!options.forceStream) {
      return { ok: true, data: { choices: [{ message: { content: 'reasoned' } }] } }
    }
    if (upstreamMode === 'stream') {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"streamed "}}]}\n',
        'data: bad-json\n',
        'data: {"choices":[{"delta":{"content":"answer"}}]}\n'
      ].map((value) => new TextEncoder().encode(value))
      return {
        ok: true,
        stream: true,
        response: { body: { async *[Symbol.asyncIterator]() { yield * chunks } } }
      }
    }
    return { ok: true, stream: false, data: { text: 'fallback stream answer content' } }
  },
  setCorsHeaders(res) {
    res.cors = true
  },
  extractCompletionText(data) {
    return data.text || ''
  },
  async waitMs(delay) {
    events.push(['waitMs', delay])
  },
  writeSsePayload(res, payload) {
    res.payloadWrites.push(payload)
  },
  async *iterateAiStreamChunks(source) {
    yield * source
  },
  extractStreamDeltaText(value) {
    return value?.choices?.[0]?.delta?.content || ''
  },
  writeSseDone(res) {
    res.done = true
    res.end()
  },
  aiUpstreamTimeoutMs: 5000,
  TwinEngine: FakeTwinEngine,
  createTwinTools(pgQuery, value) {
    assert.equal(pgQuery, 'bound-query')
    assert.equal(value, user)
    return { lookup: () => {} }
  },
  buildTwinSystemPrompt(value, semantic) {
    assert.equal(value, user)
    events.push(['semantic', semantic])
    return 'system prompt'
  },
  createPersistence(pgQuery, username) {
    assert.equal(pgQuery, 'bound-query')
    assert.equal(username, 'operator')
    return persistence
  }
})

const reset = () => {
  authorized = true
  body = {}
  bodyError = null
  config = { api_url: 'https://ai.example.invalid', api_key: 'secret', model: 'twin-model' }
  configError = null
  sessionError = null
  historyError = null
  semanticError = null
  engineMode = 'success'
  upstreamMode = 'non-stream'
  events.length = 0
  jsonResponses.length = 0
  upstreamCalls.length = 0
  engineRuns.length = 0
  engineOptions = null
}

reset()
authorized = false
await handler(createRequest(), createResponse())
assert.deepEqual(events, [['authorize']])

reset()
bodyError = new Error('invalid json')
await handler(createRequest(), createResponse())
assert.deepEqual(jsonResponses, [{ status: 400, payload: { code: 'BAD_REQUEST', message: 'invalid json' } }])

reset()
body = { content: '   ' }
await handler(createRequest(), createResponse())
assert.deepEqual(jsonResponses, [{ status: 400, payload: { code: 'MESSAGE_REQUIRED', message: 'message is required' } }])

reset()
body = { message: 'hello' }
config = {}
await handler(createRequest(), createResponse())
assert.deepEqual(jsonResponses, [{
  status: 503,
  payload: { code: 'AI_CONFIG_MISSING', message: 'AI configuration not available' }
}])

reset()
body = {
  message: 'This message is deliberately longer than thirty characters.',
  history: [
    { role: 'system', content: 'drop' },
    { role: 'user', content: 'client history' },
    { role: 'assistant', content: 'x'.repeat(4500) }
  ]
}
historyError = new Error('history unavailable')
semanticError = new Error('semantic unavailable')
const successResponse = createResponse()
await handler(createRequest(), successResponse)
assert.equal(successResponse.status, 200)
assert.equal(successResponse.cors, true)
assert.equal(successResponse.flushed, true)
assert.equal(successResponse.headers['X-Eis-Agent'], 'digital_twin')
assert.equal(successResponse.headers['X-Eis-Session'], 'session-new')
assert.deepEqual(engineRuns[0].context, { sessionId: 'session-new' })
assert.equal(engineRuns[0].history.length, 2)
assert.equal(engineRuns[0].history[1].content.length, 4000)
assert.equal(engineOptions.model, 'twin-model')
assert.equal(engineOptions.maxTurns, 6)
assert.equal(engineOptions.turnDelayMs, 120)
assert.equal(successResponse.done, true)
assert.ok(successResponse.rawWrites.some((value) => value.includes('"type":"tool"')))
assert.ok(successResponse.rawWrites.some((value) => value.includes('"type":"meta"')))
assert.equal(successResponse.payloadWrites.length, 2)
assert.equal(upstreamCalls.length, 2)
assert.deepEqual(upstreamCalls.map((call) => call.options.forceStream), [false, true])
assert.ok(upstreamCalls.every((call) => call.retry.maxRetries === 3 && call.retry.baseDelayMs === 320))

reset()
body = { message: 'stream path', session_id: 'session-existing' }
upstreamMode = 'stream'
const streamResponse = createResponse()
await handler(createRequest(), streamResponse)
assert.deepEqual(
  streamResponse.payloadWrites.map((payload) => payload.choices[0].delta.content),
  ['streamed ', 'answer']
)

reset()
body = { message: 'abort path', session_id: 'session-existing' }
engineMode = 'abort'
const abortedResponse = createResponse()
await handler(createRequest(), abortedResponse)
assert.equal(abortedResponse.done, false)
assert.deepEqual(abortedResponse.payloadWrites, [])
assert.deepEqual(abortedResponse.rawWrites, [])

reset()
body = { message: 'failure before headers' }
configError = new Error('config failed')
await handler(createRequest(), createResponse())
assert.deepEqual(jsonResponses, [{
  status: 500,
  payload: { code: 'TWIN_CHAT_FAILED', message: 'config failed' }
}])

reset()
body = { message: 'failure after headers', session_id: 'session-existing' }
engineMode = 'throw'
const failedStreamResponse = createResponse()
await handler(createRequest(), failedStreamResponse)
assert.equal(failedStreamResponse.writableEnded, true)
assert.ok(failedStreamResponse.rawWrites.some((value) => value.includes('"type":"error"')))
assert.deepEqual(jsonResponses, [])

assert.match(indexSource, /createTwinChatHttpHandler\(\{/)
assert.doesNotMatch(indexSource, /const handleTwinChat = async/)

console.log('PASS: Twin Chat preserves authorization, fallbacks, SSE metadata, upstream modes, abort and error boundaries')
