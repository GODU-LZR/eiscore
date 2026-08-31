// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { createAgentAccessService } = require('../../realtime/agent-access-service')
const repoRoot = resolve(import.meta.dirname, '../..')

const normalizeRelativeAgentPath = (value) => {
  const raw = String(value || '').trim().replaceAll('\\', '/').replace(/^\/+/, '')
  const parts = raw.split('/').filter(Boolean)
  if (!parts.length || parts.some((item) => item === '..')) return ''
  return parts.join('/')
}
const normalizeProjectPath = (value) => normalizeRelativeAgentPath(value).replace(/\/+$/, '')
const normalizeText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : item?.text || '').join('\n').trim()
  return String(value?.text || '').trim()
}

const upstreamCalls = []
const logCalls = []
let upstreamResult = { ok: true, data: { choices: [{ message: { content: '```text\ncompleted\n```' } }] } }
const service = createAgentAccessService({
  environment: {
    AGENT_ALLOWED_ROLES: ' Super_Admin,Manager ',
    AGENT_ALLOWED_PROJECTS: ' eiscore-apps, docs , ../invalid ',
    AGENT_ALLOW_ALL: 'false'
  },
  normalizeProjectPath,
  normalizeRelativeAgentPath,
  normalizeText,
  cleanModelText: (value) => normalizeText(value).replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, ''),
  extractCompletionText: (data) => normalizeText(data?.choices?.[0]?.message?.content),
  callAiUpstreamWithRetry: async (...args) => {
    upstreamCalls.push(args)
    return upstreamResult
  },
  writeLog: (...args) => logCalls.push(args),
  nowIso: () => '2026-08-31T00:00:00.000Z'
})

assert.equal(Object.isFrozen(service), true)
assert.deepEqual(Object.keys(service).sort(), [
  'canUseAgent',
  'createAgentTaskAiInvoker',
  'isAllowedProject',
  'logAgentEvent',
  'normalizeAgentTaskErrorMessage',
  'resolveDefaultWritePolicy',
  'sanitizeWritePolicy'
])
assert.equal(service.canUseAgent({ role: 'manager' }), true)
assert.equal(service.canUseAgent({ role: 'SUPER_ADMIN' }), true)
assert.equal(service.canUseAgent({ role: 'worker' }), false)
assert.equal(service.isAllowedProject('eiscore-apps'), true)
assert.equal(service.isAllowedProject('eiscore-apps/src/views'), true)
assert.equal(service.isAllowedProject('docs/engineering'), true)
assert.equal(service.isAllowedProject('eiscore-app'), false)
assert.equal(service.isAllowedProject('../outside'), false)

const allowAllService = createAgentAccessService({
  environment: { AGENT_ALLOW_ALL: 'TRUE' },
  normalizeProjectPath,
  normalizeRelativeAgentPath,
  normalizeText,
  cleanModelText: normalizeText,
  extractCompletionText: () => '',
  callAiUpstreamWithRetry: async () => ({ ok: true, data: {} })
})
assert.equal(allowAllService.canUseAgent({ role: 'unknown' }), true)

assert.deepEqual(service.sanitizeWritePolicy({
  allowedFiles: [' /src/App.vue ', '../outside', 'src\\main.js'],
  allowedDirs: [' src/components/// ', '../outside', '/docs/']
}), {
  allowedFiles: ['src/App.vue', 'src/main.js'],
  allowedDirs: ['src/components', 'docs']
})
assert.deepEqual(service.sanitizeWritePolicy(null), { allowedFiles: [], allowedDirs: [] })
assert.deepEqual(service.resolveDefaultWritePolicy('eiscore-apps/src/views/drafts'), {
  allowedFiles: ['FlashDraft.vue'],
  allowedDirs: []
})
assert.deepEqual(service.resolveDefaultWritePolicy('eiscore-apps'), {
  allowedFiles: ['src/views/drafts/FlashDraft.vue'],
  allowedDirs: []
})
assert.deepEqual(service.resolveDefaultWritePolicy('docs'), { allowedFiles: [], allowedDirs: [] })

service.logAgentEvent('agent:test', { id: 7, role: 'manager', token: 'secret' }, { ok: true })
assert.deepEqual(logCalls[0], [
  '[agent]',
  JSON.stringify({
    ts: '2026-08-31T00:00:00.000Z',
    type: 'agent:test',
    user: { id: 7, role: 'manager' },
    details: { ok: true }
  })
])

assert.equal(service.normalizeAgentTaskErrorMessage(new Error('Connection error: secret host')), 'AI upstream connection error')
assert.equal(service.normalizeAgentTaskErrorMessage(new Error('socket hang up at upstream')), 'AI upstream connection error')
assert.equal(service.normalizeAgentTaskErrorMessage(new Error('request TIMEOUT after 10s')), 'AI upstream timeout')
assert.equal(service.normalizeAgentTaskErrorMessage(new Error('x'.repeat(400))).length, 300)
assert.equal(service.normalizeAgentTaskErrorMessage({}), 'Agent task execution failed')

const cfg = { api_url: 'https://ai.example/v1', api_key: 'secret', model: 'cfg-model' }
const invoke = service.createAgentTaskAiInvoker(cfg)
assert.equal(await invoke({
  model: ' task-model ',
  maxTokens: '2048',
  systemPrompt: ' system ',
  messages: [
    { role: 'user', content: ' hello ' },
    { role: '', content: 'drop' },
    { role: 'assistant', content: '' }
  ]
}), 'completed')
assert.deepEqual(upstreamCalls[0], [
  {
    model: 'task-model',
    max_tokens: 2048,
    stream: false,
    messages: [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'hello' }
    ]
  },
  { forceStream: false, cfg },
  { maxRetries: 2, baseDelayMs: 320 }
])

upstreamResult = {
  ok: false,
  status: 429,
  payload: { code: 'RATE_LIMIT', message: 'rate limited', detail: 'retry later' }
}
await assert.rejects(
  () => invoke({ systemPrompt: '', messages: [] }),
  (error) => error.message === 'rate limited: retry later' && error.code === 'RATE_LIMIT' && error.status === 429
)
upstreamResult = { ok: true, data: {} }
await assert.rejects(() => invoke({ systemPrompt: '', messages: [] }), /AI upstream returned empty content/)

const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(indexSource, /createAgentAccessService\(\{/)
for (const forbidden of [
  'process.env.AGENT_ALLOWED_ROLES',
  'process.env.AGENT_ALLOWED_PROJECTS',
  'function sanitizeWritePolicy',
  'function normalizeAgentTaskErrorMessage',
  'function createAgentTaskAiInvoker'
]) {
  assert.equal(indexSource.includes(forbidden), false, `composition root reintroduced ${forbidden}`)
}
assert.ok(indexSource.split(/\r?\n/).length <= 1514, 'realtime/index.js must not grow past the access extraction baseline')

console.log('Agent access service regression passed')
