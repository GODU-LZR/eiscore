// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const {
  WEBSOCKET_MESSAGE_MANIFEST,
  attachWebSocketServer
} = require(resolve(repoRoot, 'realtime/websocket-server.js'))

assert.deepEqual(WEBSOCKET_MESSAGE_MANIFEST.map((entry) => [entry.type, entry.handler]), [
  ['subscribe', 'subscribe'],
  ['unsubscribe', 'unsubscribe'],
  ['flash:tool_call', 'flashToolCall'],
  ['flash:cline_task', 'flashClineTask'],
  ['flash:cline_stop', 'flashClineStop'],
  ['flash:cline_reset', 'flashClineReset'],
  ['agent:task', 'agentTask'],
  ['agent:tool_use', 'agentToolUse'],
  ['agent:terminal', 'agentTerminal']
])
assert.ok(Object.isFrozen(WEBSOCKET_MESSAGE_MANIFEST))
assert.ok(WEBSOCKET_MESSAGE_MANIFEST.every(Object.isFrozen))

const calls = []
const logs = []
let tokenValid = true
let agentAllowed = true
let projectAllowed = true
let aiConfig = { api_url: 'https://ai.example.invalid', api_key: 'secret', model: 'agent-model' }
let taskError = null

class FakeAgentConversation {
  constructor(projectPath, options) {
    this.projectPath = projectPath
    this.options = options
    this.tools = {
      async executeCommand(command) {
        calls.push(['executeCommand', command])
        return { success: true, output: 'done' }
      }
    }
    calls.push(['AgentConversation', projectPath, options])
  }

  async executeTask(prompt) {
    calls.push(['executeTask', prompt])
    if (taskError) throw taskError
    return { success: true, executionLog: ['ok'], totalTurns: 2 }
  }

  async executeToolCall(toolCall) {
    calls.push(['executeToolCall', toolCall])
    return { success: true, value: 1 }
  }
}

class FakeFileWatcher {
  constructor(projectPath, onChange) {
    this.projectPath = projectPath
    this.onChange = onChange
    this.started = false
    this.stopped = false
    calls.push(['FileWatcher', projectPath])
  }

  start() { this.started = true; calls.push(['watcherStart']) }
  stop() { this.stopped = true; calls.push(['watcherStop']) }
}

const createSocket = () => ({
  listeners: new Map(),
  sent: [],
  closed: null,
  on(event, handler) { this.listeners.set(event, handler) },
  send(value) { this.sent.push(JSON.parse(value)) },
  close(code, reason) { this.closed = { code, reason } }
})

const wss = {
  listeners: new Map(),
  on(event, handler) { this.listeners.set(event, handler) }
}

attachWebSocketServer({
  wss,
  extractToken() { calls.push(['extractToken']); return 'token' },
  verifyToken(token) { calls.push(['verifyToken', token]); return tokenValid ? { sub: 'u-1' } : null },
  asUser(payload) { calls.push(['asUser', payload]); return { username: 'operator', role: 'manager' } },
  channel: 'eis_events',
  normalizeStringList(value) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : []
  },
  async handleFlashToolCallWs(_ws, data) { calls.push(['flashTool', data.type]) },
  async runFlashClineTask(_ws, data) { calls.push(['clineTask', data.sessionId]) },
  killFlashCliSessionProcess(session) { calls.push(['kill', session.id]) },
  sendWsJson(ws, payload) { ws.sent.push(payload) },
  createFlashCliSession() { calls.push(['createFlashSession']); return { id: 'created', taskId: 'new' } },
  canUseAgent() { return agentAllowed },
  logAgentEvent(type, _user, detail) { logs.push([type, detail]) },
  normalizeProjectPath(value) { return String(value || '').trim() },
  isAllowedProject() { return projectAllowed },
  async getAiConfig() { return aiConfig },
  sanitizeWritePolicy(value) {
    return value || { allowedFiles: [], allowedDirs: [] }
  },
  resolveDefaultWritePolicy(projectPath) {
    return { allowedFiles: [`${projectPath}/default.vue`], allowedDirs: [] }
  },
  createAgentTaskAiInvoker(cfg) { return { model: cfg.model } },
  normalizeAgentTaskErrorMessage(error) { return `safe:${error.message}` },
  AgentConversation: FakeAgentConversation,
  FileWatcher: FakeFileWatcher
})

const connect = (socket = createSocket()) => {
  wss.listeners.get('connection')(socket, { headers: {} })
  return socket
}

const message = async (socket, data) => {
  const value = typeof data === 'string' ? data : JSON.stringify(data)
  await socket.listeners.get('message')(value)
}

calls.length = 0
tokenValid = false
const deniedSocket = connect()
assert.deepEqual(deniedSocket.closed, { code: 1008, reason: 'unauthorized' })
assert.equal(deniedSocket.listeners.has('message'), false)

calls.length = 0
tokenValid = true
agentAllowed = true
projectAllowed = true
aiConfig = { api_url: 'https://ai.example.invalid', api_key: 'secret', model: 'agent-model' }
const socket = connect()
assert.deepEqual(socket.user, { username: 'operator', role: 'manager', token: 'token' })
assert.deepEqual([...socket.channels], ['eis_events'])
assert.equal(socket.agentConversation, null)
assert.ok(socket.flashCliSessions instanceof Map)

await message(socket, { type: 'subscribe', channels: ['one', 'two'] })
assert.deepEqual([...socket.channels], ['one', 'two'])
await message(socket, { type: 'unsubscribe', channels: ['one'] })
assert.deepEqual([...socket.channels], ['two'])

await message(socket, { type: 'flash:tool_call' })
await message(socket, { type: 'flash:cline_task', sessionId: 'cline-1' })
assert.ok(calls.some((call) => call[0] === 'flashTool'))
assert.ok(calls.some((call) => call[0] === 'clineTask'))

socket.flashCliSessions.set('session-1unsafe', { id: 'existing', taskId: 'task' })
await message(socket, { type: 'flash:cline_stop', sessionId: 'session-1!unsafe' })
assert.ok(calls.some((call) => call[0] === 'kill' && call[1] === 'existing'))
assert.ok(socket.sent.some((entry) => entry.type === 'flash:cline_status' && entry.status === 'stopped'))

await message(socket, { type: 'flash:cline_reset', sessionId: 'new/session' })
assert.ok(socket.flashCliSessions.has('newsession'))
assert.ok(socket.sent.some((entry) => entry.type === 'flash:cline_status' && entry.status === 'reset'))

agentAllowed = false
await message(socket, { type: 'agent:task', projectPath: 'blocked' })
assert.ok(socket.sent.some((entry) => entry.type === 'agent:error' && entry.error.includes('access denied')))
agentAllowed = true

projectAllowed = false
await message(socket, { type: 'agent:task', projectPath: 'outside' })
assert.ok(socket.sent.some((entry) => entry.type === 'agent:error' && entry.error.includes('path not allowed')))
projectAllowed = true

aiConfig = {}
await message(socket, { type: 'agent:task', projectPath: 'eiscore-apps' })
assert.ok(socket.sent.some((entry) => entry.type === 'agent:error' && entry.error.includes('AI configuration is missing')))
aiConfig = { api_url: 'https://ai.example.invalid', api_key: 'secret', model: 'agent-model' }

await message(socket, {
  type: 'agent:task',
  projectPath: 'eiscore-apps',
  prompt: 'build',
  writePolicy: { allowedFiles: [], allowedDirs: ['src'] }
})
assert.ok(socket.agentConversation instanceof FakeAgentConversation)
assert.deepEqual(socket.agentConversation.options.writePolicy, { allowedFiles: [], allowedDirs: ['src'] })
assert.equal(socket.agentConversation.options.model, 'agent-model')
assert.equal(socket.fileWatcher.started, true)
assert.ok(socket.sent.some((entry) => entry.type === 'agent:status'))
assert.ok(socket.sent.some((entry) => entry.type === 'agent:result' && entry.totalTurns === 2))

socket.fileWatcher.onChange({ path: 'src/App.vue' })
assert.ok(socket.sent.some((entry) => entry.type === 'agent:file_change'))

await message(socket, { type: 'agent:tool_use', toolCall: { tool: 'read' } })
assert.ok(socket.sent.some((entry) => entry.type === 'agent:tool_result'))
await message(socket, { type: 'agent:terminal', command: 'npm test' })
assert.ok(socket.sent.some((entry) => entry.type === 'agent:terminal_result'))

const beforeUnknown = socket.sent.length
await message(socket, { type: 'unknown:type' })
assert.equal(socket.sent.length, beforeUnknown)
await message(socket, '{invalid')
assert.ok(socket.sent.some((entry) => entry.type === 'error'))

await socket.listeners.get('close')()
assert.equal(socket.fileWatcher.stopped, true)
assert.equal(socket.flashCliSessions.size, 0)

assert.match(indexSource, /attachWebSocketServer\(\{/)
assert.doesNotMatch(indexSource, /wss\.on\(['"]connection['"]/)
assert.doesNotMatch(indexSource, /data\.type ===/)

console.log('PASS: WebSocket manifest and connection dispatcher preserve 9 message types, auth, sessions and cleanup')
