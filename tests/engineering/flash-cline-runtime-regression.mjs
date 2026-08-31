// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path, { resolve } from 'node:path'
import { PassThrough } from 'node:stream'

const require = createRequire(import.meta.url)
const { createFlashClineRuntime } = require('../../realtime/flash-cline-runtime')
const repoRoot = resolve(import.meta.dirname, '../..')

const normalizeText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  return String(value?.text || value).trim()
}
const parseJsonMaybe = (value) => {
  try { return JSON.parse(String(value || '').trim()) } catch { return null }
}
const sent = []
const existing = new Set([
  '/bin/bash',
  '/workspace/apps',
  '/workspace/apps/package.json',
  '/workspace/apps/package-lock.json',
  '/workspace/drafts/brief.txt',
  '/workspace/drafts/spec.md'
])
const fsApi = {
  existsSync: (target) => existing.has(String(target).replaceAll('\\', '/')),
  symlinkSync: () => { throw new Error('unexpected symlink') }
}

const spawnCalls = []
const spawnPlans = []
const spawnProcess = (command, args, options) => {
  const child = new EventEmitter()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.killedWith = ''
  child.kill = (signal) => { child.killedWith = signal }
  spawnCalls.push({ command, args, options, child })
  const plan = spawnPlans.shift() || { code: 0 }
  queueMicrotask(() => {
    if (plan.error) {
      child.emit('error', plan.error)
      return
    }
    if (plan.stdout) child.stdout.write(plan.stdout)
    if (plan.stderr) child.stderr.write(plan.stderr)
    child.emit('close', plan.code || 0)
  })
  return child
}

const makeRuntime = (overrides = {}) => createFlashClineRuntime({
  command: '/missing/cline',
  projectPath: 'eiscore-apps/src/views/drafts',
  buildWorkdirConfigured: '/workspace/apps',
  taskTimeoutMs: 480000,
  buildTimeoutMs: 180000,
  installTimeoutMs: 120000,
  selfHealMaxRounds: 2,
  autoInstallDeps: true,
  historyLimit: 2,
  attachmentPreviewMaxChars: 12,
  agentBaseUrl: 'http://127.0.0.1:8078',
  semanticCliScript: '/app/flash-semantic-tool.js',
  httpProxyUrl: 'http://proxy.internal:8080',
  buildValidateEnabled: true,
  normalizeText,
  normalizeProjectPath: (value) => String(value || '').replaceAll('\\', '/').replace(/^\/+/, ''),
  normalizeRelativeAgentPath: (value) => {
    const text = String(value || '').replaceAll('\\', '/').replace(/^\/+/, '')
    return text.includes('..') ? '' : text
  },
  sanitizeUploadFileName: (value) => path.posix.basename(String(value || '')).replace(/[^a-zA-Z0-9._-]/g, '_'),
  parseJsonMaybe,
  sendWsJson: (ws, payload) => sent.push({ ws, payload }),
  fsApi,
  pathApi: path.posix,
  spawnProcess,
  environment: { EXISTING: 'yes', NO_PROXY: 'api,custom.internal' },
  processCwd: () => '/workspace/realtime',
  moduleDir: '/workspace/realtime',
  ...overrides
})

const runtime = makeRuntime()
assert.equal(Object.isFrozen(runtime), true)
assert.equal(runtime.ensureBashCompat(), true)
assert.equal(runtime.resolveClineBin(), 'cline')
assert.equal(runtime.deriveOpenAiBaseUrl('https://ai.example/v1/chat/completions'), 'https://ai.example/v1')
assert.equal(runtime.deriveOpenAiBaseUrl('not-a-url/chat/completions'), 'not-a-url')
assert.match(runtime.normalizeFlashCliError('spawn /bin/bash ENOENT'), /缺少 \/bin\/bash/)

const cliEnv = runtime.buildFlashCliEnv('jwt-token')
assert.equal(cliEnv.FLASH_AGENT_TOKEN, 'jwt-token')
assert.equal(cliEnv.FLASH_AGENT_BASE_URL, 'http://127.0.0.1:8078')
assert.equal(cliEnv.FLASH_SEMANTIC_CLI_SCRIPT, '/app/flash-semantic-tool.js')
assert.equal(cliEnv.HTTP_PROXY, 'http://proxy.internal:8080')
assert.equal(cliEnv.NO_PROXY.split(',').filter((item) => item === 'api').length, 1)
assert.match(cliEnv.NO_PROXY, /custom\.internal/)
assert.match(cliEnv.NO_PROXY, /host\.docker\.internal/)

assert.deepEqual(runtime.collectMissingPackagesFromBuildLog([
  "Cannot find package 'lodash-es'",
  "Failed to resolve import '@scope/ui/button'",
  "Could not resolve './local-file'",
  "Cannot find module 'node:fs'"
].join('\n')), ['lodash-es', '@scope/ui'])
assert.equal(runtime.specifierToPackageName('@scope/ui/button'), '@scope/ui')
assert.equal(runtime.specifierToPackageName('https://cdn.example/x.js'), '')
assert.equal(runtime.isDraftScopedBuildFailure('error in FlashDraft.vue'), true)
assert.equal(runtime.isDraftScopedBuildFailure('legacy unrelated failure'), false)
assert.equal(runtime.detectPackageManager('/workspace/apps'), 'npm')
assert.equal(runtime.resolveBuildWorkdir('/workspace/drafts'), '/workspace/apps')

const history = runtime.clampFlashHistory([
  { role: 'system', content: 'drop' },
  { role: 'user', content: 'first' },
  { role: 'assistant', content: 'second' },
  { role: 'USER', content: 'x'.repeat(1700) }
])
assert.deepEqual(history.map((item) => item.role), ['assistant', 'user'])
assert.equal(history[1].content.length, 1600)

const attachments = runtime.normalizeFlashAttachmentList([
  { path: 'brief.txt', name: '../brief 中文.txt', type: 'text/plain', size: 4.8, preview: 'abcdefghij' },
  { path: 'spec.md', name: 'spec.md', type: 'text/markdown', size: 2, preview: 'klmnop' },
  { path: '../secret.txt', preview: 'drop' },
  { path: 'missing.txt', preview: 'drop' }
], '/workspace/drafts')
assert.deepEqual(attachments, [
  { name: 'brief___.txt', mimeType: 'text/plain', size: 4, relativePath: 'brief.txt', textPreview: 'abcdefghij' },
  { name: 'spec.md', mimeType: 'text/markdown', size: 2, relativePath: 'spec.md', textPreview: 'kl...' }
])

const prompt = runtime.buildFlashCliPrompt('生成库存页面', history, attachments)
assert.match(prompt, /只能修改 FlashDraft\.vue/)
assert.match(prompt, /node \/app\/flash-semantic-tool\.js --registry/)
assert.match(prompt, /\[assistant\] second/)
assert.match(prompt, /brief\.txt/)
assert.match(prompt, /当前用户请求：\n生成库存页面$/)

assert.equal(runtime.shouldForwardClineSay('text', '完成'), true)
assert.equal(runtime.shouldForwardClineSay('reasoning', '内部推理'), false)
assert.equal(runtime.shouldForwardClineSay('text', '<environment_details>secret'), false)
assert.equal(runtime.parseClineRetryMessage({ type: 'say', say: 'error_retry', text: '{"attempt":2,"maxAttempts":4}' }), '上游请求失败，自动重试 2/4...')
assert.equal(runtime.parseClineRetryMessage({ type: 'say', say: 'text', text: 'x' }), '')

assert.deepEqual(runtime.parseClineCapturedEvents([
  '{"type":"task_started","taskId":"task-9"}',
  '{"type":"say","say":"reasoning","text":"hidden"}',
  '{"type":"say","say":"text","text":" result "}',
  '{"type":"error","message":" failed "}'
].join('\n')), {
  assistantChunks: ['result'],
  taskId: 'task-9',
  errorText: 'failed'
})

const cliArgs = runtime.buildFlashCliArgs({
  configDir: '/tmp/config',
  model: 'model-x',
  taskId: 'task-9',
  prompt: 'do work',
  workdir: '/workspace/drafts'
})
assert.deepEqual(cliArgs, [
  'task', '--json', '--act', '--yolo', '--timeout', '480',
  '--config', '/tmp/config', '--cwd', '/workspace/drafts',
  '--model', 'model-x', '-T', 'task-9', 'do work'
])

const session = runtime.createFlashCliSession()
let killedSignal = ''
session.running = true
session.process = { kill: (signal) => { killedSignal = signal } }
runtime.killFlashCliSessionProcess(session)
assert.equal(killedSignal, 'SIGKILL')
assert.deepEqual(session, { taskId: '', running: false, process: null })

spawnPlans.push({ stdout: `${'x'.repeat(8100)}tail`, stderr: ' warn ', code: 0 })
let spawnedChild = null
let finishedChild = null
const captured = await runtime.runSpawnCapture('tool', ['arg'], {
  cwd: '/workspace/drafts',
  timeoutMs: 500,
  onSpawn: (child) => { spawnedChild = child },
  onDone: (child) => { finishedChild = child }
})
assert.equal(captured.code, 0)
assert.equal(captured.timedOut, false)
assert.equal(captured.stdout.length, 8000)
assert.match(captured.stdout, /tail$/)
assert.equal(captured.stderr, 'warn')
assert.equal(spawnedChild, finishedChild)
assert.equal(spawnCalls.at(-1).options.cwd, '/workspace/drafts')

const fallbackManagers = []
const fallback = await runtime.runWithManagerFallback(async (manager) => {
  fallbackManagers.push(manager)
  if (manager === 'pnpm') throw new Error('spawn pnpm ENOENT')
  return { code: 0 }
}, 'pnpm')
assert.deepEqual(fallbackManagers, ['pnpm', 'npm'])
assert.deepEqual(fallback, { manager: 'npm', result: { code: 0 } })

sent.length = 0
spawnPlans.push(
  { stderr: "FlashDraft.vue: Cannot find module 'lodash-es'", code: 1 },
  { stdout: 'installed', code: 0 },
  { stdout: 'build ok', code: 0 }
)
const healSession = runtime.createFlashCliSession()
const heal = await runtime.runFlashBuildSelfHeal({
  ws: { id: 'ws-1' },
  sessionId: 'session-1',
  session: healSession,
  clineBin: 'cline',
  configDir: '/tmp/config',
  model: 'model-x',
  prompt: 'make app',
  taskWorkdir: '/workspace/drafts',
  clineEnv: {}
})
assert.deepEqual(heal, { success: true, installedPackages: ['lodash-es'], rounds: 0 })
assert.deepEqual(spawnCalls.slice(-3).map((call) => [call.command, call.args.slice(0, 3)]), [
  ['npm', ['run', 'build']],
  ['npm', ['install', '--save', '--no-audit']],
  ['npm', ['run', 'build']]
])
assert.deepEqual(sent.map((item) => item.payload.status), ['validating', 'installing', 'validating', 'deps_installed'])
assert.equal(healSession.process, null)

const skippedRuntime = makeRuntime({ buildValidateEnabled: false })
assert.deepEqual(await skippedRuntime.runFlashBuildSelfHeal({}), { success: true, skipped: true })

const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const runtimeSource = readFileSync(resolve(repoRoot, 'realtime/flash-cline-runtime.js'), 'utf8')
assert.match(indexSource, /createFlashClineRuntime\(\{/)
for (const forbidden of [
  'const runSpawnCapture =',
  'const runFlashBuildSelfHeal =',
  'const buildFlashCliPrompt =',
  'const collectMissingPackagesFromBuildLog ='
]) {
  assert.equal(indexSource.includes(forbidden), false, `composition root reintroduced ${forbidden}`)
}
assert.equal(runtimeSource.includes("require('child_process')"), true)
assert.ok(indexSource.split(/\r?\n/).length <= 2594, 'realtime/index.js must not grow past the extraction baseline')

console.log('Flash Cline runtime regression passed')
