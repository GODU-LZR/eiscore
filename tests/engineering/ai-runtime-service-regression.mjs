// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const {
  buildAxiosProxyConfig,
  createAiRuntimeService,
  iterateAiStreamChunks
} = require('../../realtime/ai-runtime-service')

const repoRoot = resolve(import.meta.dirname, '../..')
assert.deepEqual(buildAxiosProxyConfig('https://user:p%40ss@proxy.local'), {
  protocol: 'https',
  host: 'proxy.local',
  port: 443,
  auth: { username: 'user', password: 'p@ss' }
})
assert.equal(buildAxiosProxyConfig('not a url'), undefined)
assert.equal(buildAxiosProxyConfig(''), undefined)

let currentTime = 1000
const configQueries = []
const configValues = new Map([
  ['ai_glm_config', { api_url: 'https://main.example/chat', api_key: 'main-key', model: 'main-model' }],
  ['ai_vision_config', { api_url: 'https://vision.example/chat', api_key: 'vision-key', model: 'vision-model' }]
])
const cacheService = createAiRuntimeService({
  queryConfig: async (sql, params) => {
    configQueries.push([sql, params])
    return { rows: [{ value: configValues.get(params[0]) }] }
  },
  configTtlMs: 100,
  clock: () => currentTime,
  axiosClient: { post: async () => { throw new Error('not used') } },
  log: { warn: () => {} }
})
const firstMain = await cacheService.getAiConfig()
assert.equal(await cacheService.getAiConfig(), firstMain)
assert.equal(configQueries.length, 1)
assert.equal((await cacheService.getAiVisionConfig()).model, 'vision-model')
assert.equal(configQueries.length, 2)
currentTime += 101
assert.equal((await cacheService.getAiConfig()).model, 'main-model')
assert.equal(configQueries.length, 3)
assert.match(configQueries[0][0], /public\.system_configs/)
assert.deepEqual(configQueries[0][1], ['ai_glm_config'])

let nullQueries = 0
const missingService = createAiRuntimeService({
  queryConfig: async () => {
    nullQueries += 1
    return { rows: [] }
  },
  axiosClient: { post: async () => { throw new Error('missing config must not call HTTP') } },
  log: { warn: () => {} }
})
assert.equal((await missingService.callAiUpstream({})).payload.code, 'AI_CONFIG_MISSING')
assert.equal((await missingService.callAiUpstream({})).payload.code, 'AI_CONFIG_MISSING')
assert.equal((await missingService.callAiVisionUpstream({})).payload.code, 'AI_VISION_CONFIG_MISSING')
assert.equal(nullQueries, 3, 'null configurations retain the original non-cached behavior')

class FakeAxios {
  constructor() {
    this.queue = []
    this.calls = []
  }

  async post(url, payload, config) {
    this.calls.push({ url, payload, config })
    const result = this.queue.shift()
    if (result instanceof Error) throw result
    if (typeof result === 'function') return result({ url, payload, config })
    return result
  }
}

const fakeAxios = new FakeAxios()
const waits = []
const warnings = []
const service = createAiRuntimeService({
  queryConfig: async () => { throw new Error('tests pass explicit config') },
  upstreamTimeoutMs: 9876,
  proxyUrl: 'http://proxy-user:proxy-pass@proxy.local:8080',
  axiosClient: fakeAxios,
  normalizeText: (value) => String(value || '').trim(),
  normalizeToolsWhitelist: (value) => Array.isArray(value) ? value.map((item) => String(item).toLowerCase()) : [],
  wait: async (delay) => waits.push(delay),
  random: () => 0.5,
  log: { warn: (...items) => warnings.push(items) }
})

const mainConfig = {
  api_url: 'https://main.example/chat',
  api_key: 'main-key',
  model: 'config-model',
  thinking: { type: 'enabled' }
}
fakeAxios.queue.push({
  status: 200,
  data: JSON.stringify({ choices: [{ message: { content: 'ok' } }] })
})
const mainResult = await service.callAiUpstream({
  api_key: 'must-not-leak',
  api_url: 'must-not-leak',
  assistantMode: 'worker',
  mode: 'worker',
  context: { secret: true },
  agent_id: 'hidden',
  messages: [{ role: 'user', content: 'hello' }],
  tools: [
    { function: { name: 'AllowedTool' } },
    { function: { name: 'blockedTool' } }
  ]
}, {
  cfg: mainConfig,
  agentRuntime: {
    model: 'agent-model',
    temperature: 0.2,
    top_p: 0.8,
    max_tokens: 1234,
    thinking: { type: 'agent' },
    tools_whitelist: ['allowedtool']
  }
})
assert.equal(mainResult.ok, true)
assert.equal(mainResult.stream, false)
assert.equal(mainResult.data.choices[0].message.content, 'ok')
const mainCall = fakeAxios.calls.at(-1)
assert.equal(mainCall.url, mainConfig.api_url)
assert.equal(mainCall.payload.model, 'agent-model')
assert.equal(mainCall.payload.temperature, 0.2)
assert.equal(mainCall.payload.top_p, 0.8)
assert.equal(mainCall.payload.max_tokens, 1234)
assert.deepEqual(mainCall.payload.thinking, { type: 'agent' })
assert.equal(mainCall.payload.tools.length, 1)
for (const field of ['api_key', 'api_url', 'assistantMode', 'mode', 'context', 'agent_id']) {
  assert.equal(Object.hasOwn(mainCall.payload, field), false, field)
}
assert.equal(mainCall.config.timeout, 9876)
assert.equal(mainCall.config.responseType, 'text')
assert.equal(mainCall.config.headers.Authorization, 'Bearer main-key')
assert.deepEqual(mainCall.config.proxy, {
  protocol: 'http',
  host: 'proxy.local',
  port: 8080,
  auth: { username: 'proxy-user', password: 'proxy-pass' }
})

const nodeStream = (async function* () {
  yield Buffer.from('one')
  yield Buffer.from('two')
})()
fakeAxios.queue.push({ status: 200, data: nodeStream })
const streamResult = await service.callAiUpstream({ messages: [], stream: false }, {
  cfg: mainConfig,
  forceStream: true
})
assert.equal(streamResult.ok, true)
assert.equal(streamResult.stream, true)
assert.equal(fakeAxios.calls.at(-1).config.responseType, 'stream')
const streamed = []
for await (const chunk of iterateAiStreamChunks(streamResult.response.body)) streamed.push(Buffer.from(chunk).toString('utf8'))
assert.deepEqual(streamed, ['one', 'two'])

fakeAxios.queue.push({
  status: 429,
  data: (async function* () { yield Buffer.from('rate limited') })()
})
const streamFailure = await service.callAiUpstream({ stream: true }, { cfg: mainConfig })
assert.equal(streamFailure.ok, false)
assert.equal(streamFailure.status, 429)
assert.equal(streamFailure.payload.detail, 'rate limited')

fakeAxios.queue.push({ status: 200, data: 'not-json' })
const rawResult = await service.callAiUpstream({}, { cfg: mainConfig })
assert.deepEqual(rawResult.data, { raw: 'not-json' })

const timeout = new Error('request timeout')
timeout.code = 'ECONNABORTED'
fakeAxios.queue.push(timeout)
const timeoutResult = await service.callAiUpstream({}, { cfg: mainConfig })
assert.equal(timeoutResult.status, 502)
assert.equal(timeoutResult.payload.message, 'AI upstream timeout after 9876ms')
assert.equal(warnings.length, 1)
assert.doesNotMatch(JSON.stringify(warnings), /main-key/)

fakeAxios.queue.push(
  { status: 503, data: 'temporary' },
  { status: 200, data: JSON.stringify({ choices: [{ message: { content: 'recovered' } }] }) }
)
const retried = await service.callAiUpstreamWithRetry({}, { cfg: mainConfig }, {
  maxRetries: 1,
  baseDelayMs: 100
})
assert.equal(retried.ok, true)
assert.equal(retried.data.choices[0].message.content, 'recovered')
assert.equal(waits.at(-1), 140)

const visionConfig = {
  api_url: 'https://vision.example/chat',
  api_key: 'vision-key',
  model: 'vision-model',
  temperature: 0.1,
  max_tokens: 2048
}
fakeAxios.queue.push({ status: 200, data: { choices: [{ message: { content: 'vision ok' } }] } })
const visionResult = await service.callAiVisionUpstream({
  api_key: 'hidden',
  api_url: 'hidden',
  provider: 'hidden'
}, { cfg: visionConfig })
assert.equal(visionResult.ok, true)
const visionCall = fakeAxios.calls.at(-1)
assert.deepEqual(visionCall.payload, {
  model: 'vision-model',
  stream: false,
  temperature: 0.1,
  max_tokens: 2048
})
assert.equal(visionCall.config.headers.Authorization, 'Bearer vision-key')

fakeAxios.queue.push(
  { status: 500, data: 'vision temporary' },
  { status: 200, data: '{}' }
)
const visionRetried = await service.callAiVisionUpstreamWithRetry({}, { cfg: visionConfig }, {
  maxRetries: 1,
  baseDelayMs: 200
})
assert.equal(visionRetried.ok, true)
assert.equal(waits.at(-1), 260)

let released = 0
const webChunks = [new Uint8Array([65]), new Uint8Array([66])]
const webBody = {
  getReader: () => ({
    read: async () => webChunks.length ? { done: false, value: webChunks.shift() } : { done: true },
    releaseLock: () => { released += 1 }
  })
}
const webText = []
for await (const chunk of iterateAiStreamChunks(webBody)) webText.push(Buffer.from(chunk).toString('utf8'))
assert.deepEqual(webText, ['A', 'B'])
assert.equal(released, 1)

const compositionRoot = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(compositionRoot, /require\('\.\/ai-runtime-service'\)/)
assert.match(compositionRoot, /createAiRuntimeService\(/)
assert.doesNotMatch(compositionRoot, /require\('axios'\)/)
assert.doesNotMatch(compositionRoot, /const (callJsonHttp|callStreamHttp|callAiUpstream|callAiVisionUpstream|shouldRetryUpstream|buildAxiosProxyConfig)/)
assert.ok(compositionRoot.split(/\r?\n/).length <= 5758, 'Realtime composition root must not regain AI runtime implementation')

console.log('PASS: AI runtime service preserves config TTLs, secret stripping, proxy/timeout, JSON/stream payloads, retries, vision behavior and stream adapters')
