// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const { createAiHttpHandlers } = require(resolve(repoRoot, 'realtime/ai-http.js'))

const user = Object.freeze({ username: 'operator', role: 'manager' })
let authorized = true
let body = {}
let bodyError = null
let textUpstream = { ok: true, data: { text: ' cleaned text ' } }
let textUpstreamError = null
let visionUpstream = { ok: true, data: { text: ' 广东-深圳-南山-粤海街道 ' } }
let visionUpstreamError = null
let ocrResult = { ok: true, text: 'ocr text', model: 'vision-model' }
let ocrError = null
let visionConfig = { temperature: 0.2, max_tokens: 768 }
let visionConfigError = null
const calls = []
const responses = []

const handlers = createAiHttpHandlers({
  authorizeHttpRequest() {
    calls.push(['authorize'])
    return authorized ? user : null
  },
  getAiConfig: async () => ({}),
  async getAiVisionConfig() {
    calls.push(['getAiVisionConfig'])
    if (visionConfigError) throw visionConfigError
    return visionConfig
  },
  buildAgentCatalog: () => [],
  safeFetchBusinessSnapshot: async () => ({}),
  async readJsonBody() {
    calls.push(['readJsonBody'])
    if (bodyError) throw bodyError
    return body
  },
  normalizeAiText(value) {
    return String(value || '').trim()
  },
  async callAiUpstreamWithRetry(payload, options, retry) {
    calls.push(['textUpstream', payload, options, retry])
    if (textUpstreamError) throw textUpstreamError
    return textUpstream
  },
  async callAiVisionUpstreamWithRetry(payload, options, retry) {
    calls.push(['visionUpstream', payload, options, retry])
    if (visionUpstreamError) throw visionUpstreamError
    return visionUpstream
  },
  async runImageOcr(imageUrl, prompt) {
    calls.push(['runImageOcr', imageUrl, prompt])
    if (ocrError) throw ocrError
    return ocrResult
  },
  cleanModelText(value) {
    return String(value || '').trim()
  },
  extractCompletionText(data) {
    return data?.text || ''
  },
  sendJson(_res, status, payload) {
    responses.push({ status, payload })
  }
})

const reset = () => {
  authorized = true
  body = {}
  bodyError = null
  textUpstream = { ok: true, data: { text: ' cleaned text ' } }
  textUpstreamError = null
  visionUpstream = { ok: true, data: { text: ' 广东-深圳-南山-粤海街道 ' } }
  visionUpstreamError = null
  ocrResult = { ok: true, text: 'ocr text', model: 'vision-model' }
  ocrError = null
  visionConfig = { temperature: 0.2, max_tokens: 768 }
  visionConfigError = null
  calls.length = 0
  responses.length = 0
}

reset()
authorized = false
await handlers.handleTranslate({}, {})
await handlers.handleOcr({}, {})
await handlers.handleMapLocate({}, {})
assert.deepEqual(calls, [['authorize'], ['authorize'], ['authorize']])
assert.deepEqual(responses, [])

reset()
bodyError = new Error('invalid json')
await handlers.handleTranslate({}, {})
assert.deepEqual(responses, [{ status: 400, payload: { code: 'BAD_REQUEST', message: 'invalid json' } }])

reset()
body = { text: '  ' }
await handlers.handleTranslate({}, {})
assert.equal(responses[0].payload.code, 'TEXT_REQUIRED')

reset()
body = { text: 'Shenzhen Bay', prompt: 'custom prompt', model: 'translate-model', thinking: { type: 'enabled' } }
await handlers.handleTranslate({}, {})
const translateCall = calls.find((call) => call[0] === 'textUpstream')
assert.deepEqual(translateCall[1], {
  model: 'translate-model',
  stream: false,
  thinking: { type: 'enabled' },
  messages: [
    { role: 'system', content: 'custom prompt' },
    { role: 'user', content: 'Shenzhen Bay' }
  ]
})
assert.deepEqual(translateCall[2], { forceStream: false })
assert.deepEqual(translateCall[3], { maxRetries: 1, baseDelayMs: 260 })
assert.deepEqual(responses, [{ status: 200, payload: { text: 'cleaned text' } }])

reset()
body = { text: 'original' }
textUpstream = { ok: true, data: { text: '' } }
await handlers.handleTranslate({}, {})
assert.deepEqual(responses, [{ status: 200, payload: { text: 'original' } }])

reset()
body = { text: 'source' }
textUpstream = { ok: false, status: 429, payload: { code: 'RATE_LIMITED' } }
await handlers.handleTranslate({}, {})
assert.deepEqual(responses, [{ status: 429, payload: { code: 'RATE_LIMITED' } }])

reset()
body = { image_url: 'https://image.example.invalid/map.png', prompt: 'ocr prompt' }
await handlers.handleOcr({}, {})
assert.deepEqual(calls.find((call) => call[0] === 'runImageOcr'), [
  'runImageOcr',
  'https://image.example.invalid/map.png',
  'ocr prompt'
])
assert.deepEqual(responses, [{ status: 200, payload: { text: 'ocr text', model: 'vision-model' } }])

reset()
body = { imageUrl: 'https://image.example.invalid/map.png' }
ocrResult = { ok: false, error: 'unreadable' }
await handlers.handleOcr({}, {})
assert.deepEqual(responses, [{ status: 502, payload: { code: 'AI_OCR_FAILED', message: 'unreadable' } }])

reset()
body = { imageUrl: 'https://image.example.invalid/map.png' }
ocrError = new Error('ocr crashed')
await handlers.handleOcr({}, {})
assert.deepEqual(responses, [{ status: 500, payload: { code: 'AI_OCR_FAILED', message: 'ocr crashed' } }])

reset()
body = { lat: 22.5, lng: 113.9 }
await handlers.handleMapLocate({}, {})
assert.equal(responses[0].payload.code, 'IMAGE_REQUIRED')

reset()
body = { image_url: 'https://image.example.invalid/map.png', lat: 22.5, lng: 113.9, model: 'map-model' }
await handlers.handleMapLocate({}, {})
const mapCall = calls.find((call) => call[0] === 'visionUpstream')
assert.equal(mapCall[1].model, 'map-model')
assert.equal(mapCall[1].stream, false)
assert.equal(mapCall[1].temperature, 0.2)
assert.equal(mapCall[1].max_tokens, 768)
assert.ok(mapCall[1].messages[1].content[0].text.includes('113.9,22.5'))
assert.deepEqual(mapCall[1].messages[1].content[1], {
  type: 'image_url',
  image_url: { url: 'https://image.example.invalid/map.png' }
})
assert.deepEqual(mapCall[2], { cfg: visionConfig })
assert.deepEqual(mapCall[3], { maxRetries: 1, baseDelayMs: 360 })
assert.deepEqual(responses, [{ status: 200, payload: { address: '广东-深圳-南山-粤海街道' } }])

reset()
body = { imageUrl: 'https://image.example.invalid/map.png', prompt: 'custom map prompt' }
visionUpstream = { ok: false, status: 503, payload: { code: 'VISION_DOWN' } }
await handlers.handleMapLocate({}, {})
assert.deepEqual(responses, [{ status: 503, payload: { code: 'VISION_DOWN' } }])

reset()
body = { imageUrl: 'https://image.example.invalid/map.png' }
visionConfigError = new Error('vision config failed')
await handlers.handleMapLocate({}, {})
assert.deepEqual(responses, [{
  status: 500,
  payload: { code: 'AI_MAP_LOCATE_FAILED', message: 'vision config failed' }
}])

assert.ok(Object.isFrozen(handlers))
console.log('PASS: AI translate, OCR and map handlers preserve validation, aliases, upstream payloads and error mapping')
