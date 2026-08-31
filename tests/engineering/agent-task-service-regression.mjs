// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { createAgentTaskService } = require('../../realtime/agent-task-service')
const repoRoot = resolve(import.meta.dirname, '../..')

const calls = []
const audits = []
let allowed = true
let projectAllowed = true
let config = { api_url: 'https://ai.example/v1', api_key: 'secret', model: 'agent-model' }
let taskError = null
let toolResult = { success: true, value: 1 }
let terminalResult = { success: true, output: 'ok' }

class FakeConversation {
  constructor(projectPath, options) {
    this.projectPath = projectPath
    this.options = options
    this.tools = {
      executeCommand: async (command) => {
        calls.push(['terminal', command])
        return terminalResult
      }
    }
    calls.push(['conversation', projectPath, options])
  }

  async executeTask(prompt) {
    calls.push(['task', prompt])
    if (taskError) throw taskError
    return { success: true, executionLog: ['done'], totalTurns: 3 }
  }

  async executeToolCall(toolCall) {
    calls.push(['tool', toolCall])
    return toolResult
  }
}

class FakeWatcher {
  constructor(projectPath, onChange) {
    this.projectPath = projectPath
    this.onChange = onChange
    this.started = false
    this.stopped = false
    calls.push(['watcher', projectPath])
  }

  start() { this.started = true; calls.push(['watcher-start']) }
  stop() { this.stopped = true; calls.push(['watcher-stop']) }
}

const service = createAgentTaskService({
  canUseAgent: () => allowed,
  logAgentEvent: (type, user, details) => audits.push({ type, user, details }),
  normalizeProjectPath: (value) => String(value || '').trim().replaceAll('\\', '/'),
  isAllowedProject: () => projectAllowed,
  getAiConfig: async () => config,
  sanitizeWritePolicy: (value) => {
    const policy = value && typeof value === 'object' ? value : {}
    return {
      allowedFiles: Array.isArray(policy.allowedFiles) ? policy.allowedFiles : [],
      allowedDirs: Array.isArray(policy.allowedDirs) ? policy.allowedDirs : []
    }
  },
  resolveDefaultWritePolicy: (projectPath) => ({ allowedFiles: [`${projectPath}/default.vue`], allowedDirs: [] }),
  createAgentTaskAiInvoker: (cfg) => ({ cfg }),
  normalizeAgentTaskErrorMessage: (error) => `safe:${error.message}`,
  AgentConversation: FakeConversation,
  FileWatcher: FakeWatcher
})

assert.equal(Object.isFrozen(service), true)
assert.deepEqual(Object.keys(service).sort(), ['cleanup', 'runTask', 'runTerminal', 'runTool'])

const createWs = () => ({
  user: { id: 7, role: 'manager' },
  sent: [],
  agentConversation: null,
  fileWatcher: null,
  send(value) { this.sent.push(JSON.parse(value)) }
})

allowed = false
let ws = createWs()
await service.runTask(ws, { projectPath: 'blocked' })
assert.deepEqual(ws.sent[0], { type: 'agent:error', error: 'Forbidden: agent access denied' })
assert.deepEqual(audits.at(-1), {
  type: 'agent:task_denied',
  user: ws.user,
  details: { projectPath: 'blocked' }
})

allowed = true
projectAllowed = false
ws = createWs()
await service.runTask(ws, { projectPath: 'outside' })
assert.equal(ws.sent[0].error, 'Forbidden: project path not allowed')
assert.equal(audits.at(-1).details.projectPath, 'outside')

projectAllowed = true
config = {}
ws = createWs()
await service.runTask(ws, { projectPath: 'eiscore-apps' })
assert.match(ws.sent[0].error, /AI configuration is missing/)
assert.equal(audits.at(-1).details.reason, 'ai_config_missing')

config = { api_url: 'https://ai.example/v1', api_key: 'secret', model: '' }
ws = createWs()
const previousWatcher = { stopped: false, stop() { this.stopped = true } }
ws.fileWatcher = previousWatcher
await service.runTask(ws, { projectPath: '', prompt: 'build', writePolicy: { allowedFiles: [], allowedDirs: [] } })
assert.equal(previousWatcher.stopped, true)
assert.equal(ws.agentConversation.projectPath, 'eiscore-apps')
assert.deepEqual(ws.agentConversation.options, {
  writePolicy: { allowedFiles: ['eiscore-apps/default.vue'], allowedDirs: [] },
  model: 'glm-4.6v',
  aiInvoker: { cfg: config }
})
assert.equal(ws.fileWatcher.started, true)
assert.deepEqual(ws.sent.slice(0, 2), [
  { type: 'agent:status', status: 'thinking', message: 'Processing your request...' },
  { type: 'agent:result', success: true, executionLog: ['done'], totalTurns: 3 }
])
ws.fileWatcher.onChange({ path: 'src/App.vue' })
assert.deepEqual(ws.sent.at(-1), { type: 'agent:file_change', data: { path: 'src/App.vue' } })
assert.equal(audits.some((item) => item.type === 'agent:task_start'), true)
assert.equal(audits.some((item) => item.type === 'agent:task_result' && item.details.totalTurns === 3), true)

config = { api_url: 'https://ai.example/v1', api_key: 'secret', model: 'custom' }
taskError = new Error('raw failure')
ws = createWs()
await service.runTask(ws, {
  projectPath: 'eiscore-apps',
  prompt: 'fail',
  writePolicy: { allowedFiles: ['src/one.vue'], allowedDirs: ['src/components'] }
})
assert.deepEqual(ws.agentConversation.options.writePolicy, {
  allowedFiles: ['src/one.vue'],
  allowedDirs: ['src/components']
})
assert.deepEqual(ws.sent.at(-1), { type: 'agent:error', error: 'safe:raw failure', code: 'AGENT_TASK_FAILED' })
assert.equal(audits.at(-1).type, 'agent:task_failed')
taskError = null

allowed = false
ws = createWs()
await service.runTool(ws, { toolCall: { tool: 'read' } })
assert.equal(ws.sent[0].error, 'Forbidden: agent access denied')
assert.deepEqual(audits.at(-1).details, { tool: 'read' })
await service.runTerminal(ws, { command: 'npm test' })
assert.equal(ws.sent[1].error, 'Forbidden: agent access denied')
assert.deepEqual(audits.at(-1).details, { command: 'npm test' })

allowed = true
ws = createWs()
await service.runTool(ws, { toolCall: { tool: 'read' } })
await service.runTerminal(ws, { command: 'npm test' })
assert.deepEqual(ws.sent, [
  { type: 'agent:error', error: 'No active conversation. Send agent:task first.' },
  { type: 'agent:error', error: 'No active conversation.' }
])

ws.agentConversation = new FakeConversation('eiscore-apps', {})
toolResult = { success: false, error: 'denied' }
terminalResult = { success: false, output: 'failed' }
await service.runTool(ws, { toolCall: { tool: 'write' } })
await service.runTerminal(ws, { command: 'rm blocked' })
assert.deepEqual(ws.sent.slice(-2), [
  { type: 'agent:tool_result', result: toolResult },
  { type: 'agent:terminal_result', result: terminalResult }
])
assert.equal(audits.at(-2).details.success, false)
assert.equal(audits.at(-1).details.success, false)

const watcher = new FakeWatcher('eiscore-apps', () => {})
ws.fileWatcher = watcher
service.cleanup(ws)
assert.equal(watcher.stopped, true)

const websocketSource = readFileSync(resolve(repoRoot, 'realtime/websocket-server.js'), 'utf8')
const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(indexSource, /createAgentTaskService\(\{/)
assert.match(websocketSource, /agentTask: agentTaskService\.runTask/)
for (const forbidden of ['new AgentConversation', 'new FileWatcher', 'executeToolCall(data.toolCall)', 'tools.executeCommand(data.command)']) {
  assert.equal(websocketSource.includes(forbidden), false, `WebSocket transport reintroduced ${forbidden}`)
}

console.log('Agent task service regression passed')
