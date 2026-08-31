// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const { createAiChatHttpHandler } = require(resolve(repoRoot, 'realtime/ai-chat-http.js'))

const user = Object.freeze({ username: 'manager', role: 'manager' })
let authorized = true
let body = {}
let bodyError = null
let configError = null
let semanticError = null
let routeAgentId = 'enterprise_analyst'
let guardRequired = false
let guardApplied = false
let upstream = { ok: true, stream: false, data: { text: 'model answer' } }
let guardError = null
const calls = []
const jsonResponses = []

const createRequest = () => ({
  listeners: new Map(),
  on(event, handler) { this.listeners.set(event, handler) },
  off(event, handler) {
    if (this.listeners.get(event) === handler) this.listeners.delete(event)
  }
})

const createResponse = () => ({
  writableEnded: false,
  writes: [],
  headers: null,
  flushed: false,
  writeHead(status, headers) {
    this.status = status
    this.headers = headers
  },
  flushHeaders() { this.flushed = true },
  write(value) { this.writes.push(value) },
  end() { this.writableEnded = true }
})

const handler = createAiChatHttpHandler({
  authorizeHttpRequest() {
    calls.push(['authorize'])
    return authorized ? user : null
  },
  async readJsonBody() {
    calls.push(['readJsonBody'])
    if (bodyError) throw bodyError
    return body
  },
  sendJson(_res, status, payload, headers) {
    jsonResponses.push({ status, payload, headers })
  },
  async getAiConfig() {
    calls.push(['getAiConfig'])
    if (configError) throw configError
    return { model: 'configured-model' }
  },
  sanitizeConversationMessages(messages) {
    calls.push(['sanitize', messages])
    return [{ role: 'user', content: 'sanitized' }]
  },
  async enrichMessagesWithOcr(messages) {
    calls.push(['ocr', messages])
    return { messages: [{ role: 'user', content: 'enriched' }], ocr: [{ index: 0 }] }
  },
  resolveAgentRoute(args) {
    calls.push(['route', args])
    return {
      agentId: routeAgentId,
      intent: 'business_analysis',
      requestedMode: 'enterprise',
      latestUserText: 'latest question',
      context: null
    }
  },
  async fetchSemanticContext(value) {
    assert.equal(value, user)
    if (semanticError) throw semanticError
    return { tables: ['orders'] }
  },
  async safeFetchBusinessSnapshot(value, source) {
    calls.push(['snapshot', value, source])
    return { sales: 10 }
  },
  resolveAgentRuntimeConfig(cfg, agentId) {
    calls.push(['runtime', cfg, agentId])
    return { model: 'runtime-model' }
  },
  shouldApplyEnterpriseOutputGuard() {
    return guardRequired
  },
  composeAgentMessages(args) {
    calls.push(['compose', args])
    return [{ role: 'system', content: 'composed' }]
  },
  async callAiUpstreamWithRetry(payload, options, retry) {
    calls.push(['upstream', payload, options, retry])
    return upstream
  },
  async applyEnterpriseOutputGuard(args) {
    calls.push(['guard', args])
    if (guardError) throw guardError
    return { guardedData: { text: 'guarded answer' }, guardApplied }
  },
  setCorsHeaders(res) { res.cors = true },
  streamTextAsSse(res, text) {
    calls.push(['streamTextAsSse', text])
    res.write(`fallback:${text}`)
    res.end()
  },
  extractCompletionText(data) { return data?.text || '' }
})

const reset = () => {
  authorized = true
  body = { messages: [{ role: 'user', content: 'raw' }], stream: false, extra: 'kept' }
  bodyError = null
  configError = null
  semanticError = null
  routeAgentId = 'enterprise_analyst'
  guardRequired = false
  guardApplied = false
  upstream = { ok: true, stream: false, data: { text: 'model answer' } }
  guardError = null
  calls.length = 0
  jsonResponses.length = 0
}

reset()
authorized = false
await handler(createRequest(), createResponse())
assert.deepEqual(calls, [['authorize']])

reset()
bodyError = new Error('invalid json')
await handler(createRequest(), createResponse())
assert.deepEqual(jsonResponses, [{
  status: 400,
  payload: { code: 'BAD_REQUEST', message: 'invalid json' },
  headers: undefined
}])

reset()
guardApplied = true
await handler(createRequest(), createResponse())
const upstreamCall = calls.find((call) => call[0] === 'upstream')
assert.equal(upstreamCall[1].extra, 'kept')
assert.deepEqual(upstreamCall[1].messages, [{ role: 'system', content: 'composed' }])
assert.equal(upstreamCall[2].forceStream, false)
assert.equal(upstreamCall[2].agentRuntime.model, 'runtime-model')
assert.deepEqual(upstreamCall[3], { maxRetries: 2, baseDelayMs: 320 })
const routeCall = calls.find((call) => call[0] === 'compose')[1].route
assert.deepEqual(routeCall.context, {
  semanticContext: { tables: ['orders'] },
  businessSnapshot: { sales: 10 }
})
assert.deepEqual(jsonResponses, [{
  status: 200,
  payload: { text: 'guarded answer' },
  headers: {
    'X-Eis-Ai-Agent': 'enterprise_analyst',
    'X-Eis-Ai-Intent': 'business_analysis',
    'X-Eis-Ai-Guard': 'rewrite'
  }
}])

reset()
body.stream = true
guardRequired = true
const guardedStreamResponse = createResponse()
await handler(createRequest(), guardedStreamResponse)
assert.equal(calls.find((call) => call[0] === 'upstream')[2].forceStream, false)
assert.equal(guardedStreamResponse.status, 200)
assert.equal(guardedStreamResponse.cors, true)
assert.equal(guardedStreamResponse.headers['X-Eis-Ai-Guard'], 'pass')
assert.deepEqual(guardedStreamResponse.writes, ['fallback:guarded answer'])

reset()
upstream = { ok: false, status: 429, payload: { code: 'RATE_LIMITED' } }
await handler(createRequest(), createResponse())
assert.deepEqual(jsonResponses, [{ status: 429, payload: { code: 'RATE_LIMITED' }, headers: undefined }])

reset()
routeAgentId = 'general'
body.stream = true
const nodeStreamHandlers = new Map()
let destroyed = false
const nodeStream = {
  on(event, callback) { nodeStreamHandlers.set(event, callback) },
  destroy() { destroyed = true }
}
upstream = { ok: true, stream: true, response: { body: nodeStream } }
const nodeRequest = createRequest()
const nodeResponse = createResponse()
await handler(nodeRequest, nodeResponse)
assert.equal(calls.find((call) => call[0] === 'upstream')[2].forceStream, true)
assert.equal(nodeResponse.headers['X-Eis-Ai-Guard'], 'stream-pass')
nodeStreamHandlers.get('data')(Buffer.from('data: chunk\n\n'))
assert.equal(nodeResponse.writes[0].toString(), 'data: chunk\n\n')
nodeRequest.listeners.get('close')()
assert.equal(destroyed, true)
nodeStreamHandlers.get('end')()
nodeStreamHandlers.get('close')()
assert.equal(nodeResponse.writableEnded, true)
assert.equal(nodeRequest.listeners.has('close'), false)

reset()
routeAgentId = 'general'
body.stream = true
let readIndex = 0
let released = false
const reader = {
  async read() {
    readIndex += 1
    if (readIndex === 1) return { done: false, value: new TextEncoder().encode('web chunk') }
    return { done: true }
  },
  async cancel() {},
  releaseLock() { released = true }
}
upstream = { ok: true, stream: true, response: { body: { getReader: () => reader } } }
const webRequest = createRequest()
const webResponse = createResponse()
await handler(webRequest, webResponse)
assert.equal(Buffer.from(webResponse.writes[0]).toString(), 'web chunk')
assert.equal(webResponse.writableEnded, true)
assert.equal(released, true)
assert.equal(webRequest.listeners.has('close'), false)

reset()
routeAgentId = 'general'
body.stream = true
upstream = { ok: true, stream: true, response: { body: {} } }
await handler(createRequest(), createResponse())
assert.deepEqual(jsonResponses, [{
  status: 502,
  payload: { code: 'AI_STREAM_FAILED', message: 'AI upstream stream is unavailable' },
  headers: undefined
}])

reset()
configError = new Error('config failed')
await handler(createRequest(), createResponse())
assert.deepEqual(jsonResponses, [{
  status: 500,
  payload: { code: 'AI_CHAT_FAILED', message: 'config failed' },
  headers: undefined
}])

assert.match(indexSource, /createAiChatHttpHandler\(\{/)
assert.doesNotMatch(indexSource, /const handleAiChat = async/)

console.log('PASS: AI Chat preserves routing context, guard fallback, Node/Web streams, abort and error contracts')
