// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const { createAiConfigHttpHandlers } = require(resolve(repoRoot, 'realtime/ai-config-http.js'))

const user = Object.freeze({ username: 'manager', role: 'manager' })
let authorized = true
let config = null
let configError = null
let visionConfig = null
let visionError = null
const catalogCalls = []
const responses = []

const handlers = createAiConfigHttpHandlers({
  authorizeHttpRequest() {
    return authorized ? user : null
  },
  async getAiConfig() {
    if (configError) throw configError
    return config
  },
  async getAiVisionConfig() {
    if (visionError) throw visionError
    return visionConfig
  },
  buildAgentCatalog(value, cfg) {
    catalogCalls.push([value, cfg])
    return [{ id: 'enterprise' }]
  },
  sendJson(_res, status, payload) {
    responses.push({ status, payload })
  }
})

const reset = () => {
  authorized = true
  config = null
  configError = null
  visionConfig = null
  visionError = null
  catalogCalls.length = 0
  responses.length = 0
}

reset()
authorized = false
await handlers.handleConfig({}, {})
await handlers.handleAgents({}, {})
assert.deepEqual(catalogCalls, [])
assert.deepEqual(responses, [])

reset()
config = {
  api_url: 'https://ai.example.invalid',
  api_key: 'main-secret',
  model: 'main-model',
  provider: 'main-provider'
}
visionConfig = {
  api_url: 'https://vision.example.invalid',
  api_key: 'vision-secret',
  model: 'vision-model',
  provider: 'vision-provider'
}
await handlers.handleConfig({}, {})
assert.deepEqual(catalogCalls, [[user, config]])
assert.deepEqual(responses, [{
  status: 200,
  payload: {
    enabled: true,
    model: 'main-model',
    provider: 'main-provider',
    stream: true,
    vision: {
      enabled: true,
      model: 'vision-model',
      provider: 'vision-provider'
    },
    agents: [{ id: 'enterprise' }]
  }
}])
assert.equal(JSON.stringify(responses).includes('main-secret'), false)
assert.equal(JSON.stringify(responses).includes('vision-secret'), false)

reset()
config = {}
visionError = new Error('vision unavailable')
await handlers.handleConfig({}, {})
assert.deepEqual(responses[0], {
  status: 200,
  payload: {
    enabled: false,
    model: 'glm-4.6v',
    provider: 'glm',
    stream: true,
    vision: { enabled: false, model: '', provider: '' },
    agents: [{ id: 'enterprise' }]
  }
})

reset()
configError = new Error('config unavailable')
await handlers.handleConfig({}, {})
assert.deepEqual(responses, [{
  status: 500,
  payload: { code: 'AI_CONFIG_LOAD_FAILED', message: 'config unavailable' }
}])

reset()
config = { model: 'catalog-model' }
await handlers.handleAgents({}, {})
assert.deepEqual(catalogCalls, [[user, config]])
assert.deepEqual(responses, [{
  status: 200,
  payload: { role: 'manager', agents: [{ id: 'enterprise' }] }
}])

reset()
configError = new Error('agents unavailable')
await handlers.handleAgents({}, {})
assert.deepEqual(responses, [{
  status: 500,
  payload: { code: 'AI_CONFIG_LOAD_FAILED', message: 'agents unavailable' }
}])

assert.ok(Object.isFrozen(handlers))
assert.match(indexSource, /createAiConfigHttpHandlers\(\{/)
assert.match(indexSource, /\.\.\.aiConfigHttpHandlers/)
assert.doesNotMatch(indexSource, /const handleAi(?:Config|Agents)/)

console.log('PASS: AI config HTTP handlers preserve authorization, defaults, vision fallback and secret-free responses')
