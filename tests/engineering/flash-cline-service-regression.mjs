// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { PassThrough } from 'node:stream'

const require = createRequire(import.meta.url)
const { createFlashClineService } = require('../../realtime/flash-cline-service')
const repoRoot = resolve(import.meta.dirname, '../..')

const makeChild = () => {
  const child = new EventEmitter()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.killSignals = []
  child.kill = (signal) => child.killSignals.push(signal)
  return child
}
const settle = () => new Promise((resolveTick) => setImmediate(resolveTick))

const makeHarness = (overrides = {}) => {
  const messages = []
  const audits = []
  const ensured = []
  const authCalls = []
  const taskArgCalls = []
  const healCalls = []
  const scopedToPreview = []
  const previewToScoped = []
  const timers = []
  const clearedTimers = []
  const children = []
  let clock = 1000
  let authResult = { code: 0, stdout: '', stderr: '', timedOut: false }
  let aiConfig = { api_key: 'secret-key', api_url: 'https://ai.example/v1/chat/completions', model: 'cfg-model' }
  let healResult = { success: true }
  let fingerprintCalls = 0
  let fingerprints = [
    { preview: { sha: 'p1', bytes: 10 }, scoped: { sha: 's1', bytes: 11 } },
    { preview: { sha: 'p2', bytes: 20 }, scoped: { sha: 's1', bytes: 11 } },
    { preview: { sha: 'p2', bytes: 20 }, scoped: { sha: 'p2', bytes: 20 } }
  ]
  const runtime = {
    buildFlashCliArgs: (input) => {
      taskArgCalls.push(input)
      return ['task', input.prompt]
    },
    buildFlashCliEnv: (token) => ({ TOKEN: token }),
    buildFlashCliPrompt: (prompt, history, attachments) => `PROMPT:${prompt}:${history.length}:${attachments.length}`,
    clampFlashHistory: (history) => Array.isArray(history) ? history.slice(-2) : [],
    createFlashCliSession: () => ({ taskId: '', running: false, process: null }),
    deriveOpenAiBaseUrl: () => 'https://ai.example/v1',
    killFlashCliSessionProcess: (session) => {
      if (session.process) session.process.kill('SIGKILL')
      session.process = null
      session.running = false
    },
    normalizeFlashAttachmentList: (attachments) => Array.isArray(attachments) ? attachments.filter(Boolean) : [],
    normalizeFlashCliError: (value) => String(value || '').trim().replace('RAW', 'SAFE'),
    parseClineRetryMessage: (event) => event?.type === 'say' && event?.say === 'error_retry' ? 'retrying' : '',
    resolveClineBin: () => 'cline-bin',
    runFlashBuildSelfHeal: async (input) => {
      healCalls.push(input)
      return healResult
    },
    runSpawnCapture: async (...args) => {
      authCalls.push(args)
      return authResult
    },
    shouldForwardClineSay: (say, text) => Boolean(text) && say !== 'reasoning'
  }
  const dependencies = {
    enabled: true,
    nodeVersion: '20.19.0',
    projectPath: 'eiscore-apps/src/views/drafts',
    configRoot: '/tmp/flash-cline',
    taskTimeoutMs: 480000,
    authTimeoutMs: 30000,
    provider: 'openai',
    registryVersion: 'flash-tools-v2',
    registryCount: 43,
    runtime,
    normalizeText: (value) => String(value || '').trim(),
    normalizeAppId: (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
    normalizeProjectPath: (value) => String(value || '').replaceAll('\\', '/'),
    isAllowedProject: () => true,
    canUseAgent: () => true,
    getAiConfig: async () => aiConfig,
    resolveTaskWorkdir: () => '/workspace/drafts',
    ensureDir: async (target) => ensured.push(target),
    syncScopedDraftToPreview: async (appId) => { scopedToPreview.push(appId) },
    readDraftFingerprintsSafe: async () => fingerprints[Math.min(fingerprintCalls++, fingerprints.length - 1)],
    syncPreviewDraftToScoped: async (appId) => { previewToScoped.push(appId) },
    hasFingerprintChanged: (before, after) => before?.sha !== after?.sha,
    sendWsJson: (ws, payload) => messages.push({ ws, payload }),
    logAgentEvent: (type, user, details) => audits.push({ type, user, details }),
    spawnProcess: (command, args, options) => {
      const child = makeChild()
      children.push({ command, args, options, child })
      return child
    },
    now: () => { clock += 25; return clock },
    setTimer: (callback, delay) => {
      const timer = { callback, delay, id: timers.length + 1 }
      timers.push(timer)
      return timer
    },
    clearTimer: (timer) => clearedTimers.push(timer),
    ...overrides
  }
  const service = createFlashClineService(dependencies)
  return {
    service,
    runtime,
    messages,
    audits,
    ensured,
    authCalls,
    taskArgCalls,
    healCalls,
    scopedToPreview,
    previewToScoped,
    timers,
    clearedTimers,
    children,
    setAuthResult: (value) => { authResult = value },
    setAiConfig: (value) => { aiConfig = value },
    setHealResult: (value) => { healResult = value },
    setFingerprints: (value) => { fingerprints = value; fingerprintCalls = 0 }
  }
}

{
  const harness = makeHarness({ enabled: false })
  assert.equal(Object.isFrozen(harness.service), true)
  await harness.service.runFlashClineTask({ user: {} }, { sessionId: 'raw/id' })
  assert.deepEqual(harness.messages[0].payload, {
    type: 'flash:cline_error',
    sessionId: 'raw/id',
    error: 'Cline CLI shell mode is disabled by server policy'
  })
}

{
  const harness = makeHarness({ nodeVersion: '18.20.0' })
  await harness.service.runFlashClineTask({ user: {} }, { sessionId: 's' })
  assert.match(harness.messages[0].payload.error, /Node\.js 18\.20\.0.*requires >=20/)
}

{
  const harness = makeHarness({ canUseAgent: () => false })
  const user = { id: 1 }
  await harness.service.runFlashClineTask({ user }, { sessionId: 's' })
  assert.equal(harness.messages[0].payload.error, 'Forbidden: agent access denied')
  assert.deepEqual(harness.audits[0], { type: 'flash:cline_denied', user, details: { reason: 'role_denied' } })
}

{
  const harness = makeHarness({ isAllowedProject: () => false })
  await harness.service.runFlashClineTask({ user: {} }, { sessionId: 's' })
  assert.equal(harness.messages[0].payload.error, 'Forbidden: flash project path not allowed')
  assert.equal(harness.audits[0].details.reason, 'project_denied')
}

{
  const harness = makeHarness()
  const ws = { user: {}, flashCliSessions: new Map([['busy', { taskId: '', running: true, process: null }]]) }
  await harness.service.runFlashClineTask(ws, { sessionId: 'busy', prompt: 'work' })
  assert.equal(harness.messages[0].payload.error, '上一条请求尚未完成，请稍后再试')
  assert.equal(harness.authCalls.length, 0)
}

{
  const harness = makeHarness()
  await harness.service.runFlashClineTask({ user: {} }, { sessionId: 'invalid///', prompt: '   ' })
  assert.equal(harness.messages[0].payload.sessionId, 'invalid')
  assert.equal(harness.messages[0].payload.error, 'Prompt is required')
}

{
  const harness = makeHarness()
  harness.setAiConfig({})
  await harness.service.runFlashClineTask({ user: {} }, { sessionId: 's', prompt: 'work' })
  assert.match(harness.messages[0].payload.error, /AI configuration is missing/)
}

{
  const harness = makeHarness()
  harness.setAuthResult({ code: 1, stdout: '', stderr: 'bad auth', timedOut: false })
  const user = { id: 2, token: 'jwt' }
  await harness.service.runFlashClineTask({ user }, { sessionId: 's', prompt: 'work' })
  assert.equal(harness.messages[0].payload.error, 'Cline auth failed: bad auth')
  assert.equal(harness.audits[0].type, 'flash:cline_auth_failed')
  assert.deepEqual(harness.authCalls[0][0], 'cline-bin')
  assert.deepEqual(harness.authCalls[0][1], [
    'auth', '-p', 'openai', '-k', 'secret-key', '-m', 'cfg-model',
    '--config', '/tmp/flash-cline/s', '-b', 'https://ai.example/v1'
  ])
  assert.equal(harness.authCalls[0][2].timeoutMs, 30000)
}

{
  const harness = makeHarness()
  const user = { id: 7, token: 'jwt-token' }
  const ws = { user }
  await harness.service.runFlashClineTask(ws, {
    sessionId: 'session/1',
    app_id: 'app/42',
    prompt: ' build app ',
    model: ' payload-model ',
    history: [{ role: 'user', content: 'before' }],
    attachments: [{ relativePath: 'brief.txt' }]
  })
  assert.deepEqual(harness.ensured, ['/tmp/flash-cline/session1', '/workspace/drafts'])
  assert.deepEqual(harness.scopedToPreview, ['app42'])
  assert.deepEqual(harness.taskArgCalls[0], {
    configDir: '/tmp/flash-cline/session1',
    model: 'payload-model',
    taskId: '',
    prompt: 'PROMPT:build app:1:1',
    workdir: '/workspace/drafts'
  })
  assert.equal(harness.children.length, 1)
  assert.equal(harness.children[0].command, 'cline-bin')
  assert.deepEqual(harness.children[0].options, {
    cwd: '/app',
    env: { TOKEN: 'jwt-token' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  assert.deepEqual(harness.messages.slice(0, 2).map((item) => item.payload.status), ['running', 'registry_meta'])
  assert.equal(harness.messages[1].payload.registryVersion, 'flash-tools-v2')
  assert.equal(harness.messages[1].payload.registryCount, 43)

  const child = harness.children[0].child
  child.stdout.write('{"type":"task_started","taskId":"task-1"}\n')
  child.stdout.write('{"type":"say","say":"text","text":"first"}\n{"type":"say","say":"error_retry","text":"{}"}\n')
  child.stdout.write('{"type":"ask","ask":"api_req_failed","text":"upstream down"}\n')
  child.stdout.write('{"type":"error","message":"RAW failure"}\n')
  child.stdout.write('{"type":"say","say":"reasoning","text":"hidden"}\n')
  child.stdout.write('{"type":"say","say":"text","text":"second"}')
  child.stderr.write('plain stderr\n')
  child.emit('close', 0)
  await settle()
  await settle()

  assert.equal(ws.flashCliSessions.get('session1').taskId, 'task-1')
  assert.deepEqual(harness.previewToScoped, ['app42'])
  assert.equal(harness.healCalls.length, 1)
  assert.equal(harness.healCalls[0].prompt, 'build app')
  assert.equal(harness.clearedTimers.length, 1)
  const payloads = harness.messages.map((item) => item.payload)
  assert.equal(payloads.some((item) => item.status === 'log' && item.message === 'plain stderr'), true)
  assert.equal(payloads.some((item) => item.status === 'retry' && item.message === 'retrying'), true)
  assert.equal(payloads.some((item) => item.type === 'flash:cline_error' && item.error === 'upstream down'), true)
  assert.equal(payloads.some((item) => item.type === 'flash:cline_error' && item.error === 'SAFE failure'), true)
  assert.deepEqual(payloads.filter((item) => item.type === 'flash:cline_output').map((item) => item.content), ['first', 'second'])
  assert.equal(payloads.find((item) => item.type === 'flash:cline_summary').content, 'first\n\nsecond')
  assert.deepEqual(payloads.find((item) => item.type === 'flash:cline_done'), {
    type: 'flash:cline_done',
    sessionId: 'session1',
    success: true,
    exitCode: 0,
    elapsedMs: 25,
    appId: 'app42',
    draftChanged: true,
    draftFingerprint: { sha: 'p2', bytes: 20 }
  })
  assert.equal(harness.audits[0].type, 'flash:cline_start')
  assert.equal(harness.audits.at(-1).type, 'flash:cline_done')
  assert.equal(harness.audits.at(-1).details.draftBytes, 20)
  assert.equal(ws.flashCliSessions.get('session1').running, false)
  assert.equal(ws.flashCliSessions.get('session1').process, null)
}

{
  const harness = makeHarness()
  const ws = { user: {} }
  await harness.service.runFlashClineTask(ws, { sessionId: 'timeout', prompt: 'work' })
  const child = harness.children[0].child
  harness.timers[0].callback()
  assert.deepEqual(child.killSignals, ['SIGKILL'])
  child.emit('close', 0)
  await settle()
  await settle()
  const payloads = harness.messages.map((item) => item.payload)
  assert.equal(payloads.some((item) => item.error === 'Cline task timeout after 480000ms'), true)
  assert.equal(payloads.find((item) => item.type === 'flash:cline_done').success, false)
  assert.equal(harness.healCalls.length, 0)
}

{
  const harness = makeHarness()
  harness.setHealResult({ success: false, error: 'build failed' })
  await harness.service.runFlashClineTask({ user: {} }, { sessionId: 'heal-fail', prompt: 'work' })
  harness.children[0].child.emit('close', 0)
  await settle()
  await settle()
  const payloads = harness.messages.map((item) => item.payload)
  assert.equal(payloads.some((item) => item.error === 'build failed'), true)
  assert.equal(payloads.find((item) => item.type === 'flash:cline_done').exitCode, 2)
}

{
  const harness = makeHarness({ ensureDir: async () => { throw new Error('directory denied') } })
  const user = { id: 5 }
  await harness.service.runFlashClineTask({ user }, { sessionId: 'fail', prompt: 'work' })
  assert.equal(harness.messages[0].payload.error, 'directory denied')
  assert.equal(harness.audits[0].type, 'flash:cline_failed')
}

const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const serviceSource = readFileSync(resolve(repoRoot, 'realtime/flash-cline-service.js'), 'utf8')
assert.match(indexSource, /createFlashClineService\(\{/)
assert.equal(indexSource.includes('async function runFlashClineTask'), false)
assert.equal(indexSource.includes("require('child_process')"), false)
assert.match(serviceSource, /const runFlashClineTask = async/)
assert.ok(indexSource.split(/\r?\n/).length <= 2243, 'realtime/index.js must not grow past the service extraction baseline')

console.log('Flash Cline service regression passed')
