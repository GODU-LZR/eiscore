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
  ['flash:harness_task', 'flashHarnessTask'],
  ['flash:harness_reset', 'flashHarnessReset'],
])
assert.ok(Object.isFrozen(WEBSOCKET_MESSAGE_MANIFEST))
assert.ok(WEBSOCKET_MESSAGE_MANIFEST.every(Object.isFrozen))

const calls = []
let tokenValid = true

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
  asUser(payload) { calls.push(['asUser', payload]); return { username: 'operator', role: 'manager', tenant_id: 'tenant-a' } },
  hasHarnessTenantContext(user) { return Boolean(user.username && user.tenant_id && user.token) },
  channel: 'eis_events',
  normalizeStringList(value) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : []
  },
  async handleFlashToolCallWs(_ws, data) { calls.push(['flashTool', data.type]) },
  async handleFlashHarnessTaskWs(_ws, data) { calls.push(['flashHarnessTask', data.type]) },
  async handleFlashHarnessResetWs(_ws, data) { calls.push(['flashHarnessReset', data.type]) },
  sendWsJson(ws, payload) { ws.sent.push(payload) },
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
const socket = connect()
assert.deepEqual(socket.user, { username: 'operator', role: 'manager', tenant_id: 'tenant-a', token: 'token' })
assert.deepEqual([...socket.channels], ['eis_events'])
assert.equal(socket.flashCliSessions, undefined)

await message(socket, { type: 'subscribe', channels: ['one', 'two'] })
assert.deepEqual([...socket.channels], ['one', 'two'])
await message(socket, { type: 'unsubscribe', channels: ['one'] })
assert.deepEqual([...socket.channels], ['two'])

await message(socket, { type: 'flash:tool_call' })
assert.ok(calls.some((call) => call[0] === 'flashTool'))
await message(socket, { type: 'flash:harness_task' })
assert.ok(calls.some((call) => call[0] === 'flashHarnessTask'))
await message(socket, { type: 'flash:harness_reset' })
assert.ok(calls.some((call) => call[0] === 'flashHarnessReset'))

const beforeUnknown = socket.sent.length
await message(socket, { type: 'unknown:type' })
assert.equal(socket.sent.length, beforeUnknown)
await message(socket, '{invalid')
assert.ok(socket.sent.some((entry) => entry.type === 'error'))

await socket.listeners.get('close')()
assert.equal(socket.flashCliSessions, undefined)

const missingTenantSocket = createSocket()
attachWebSocketServer({
  wss: {
    on(event, handler) { if (event === 'connection') handler(missingTenantSocket, { headers: {} }) }
  },
  extractToken() { return 'token' },
  verifyToken() { return { sub: 'u-1' } },
  asUser() { return { username: 'operator' } },
  hasHarnessTenantContext() { return false },
  channel: 'eis_events',
  normalizeStringList() { return [] },
  handleFlashToolCallWs() {},
  handleFlashHarnessTaskWs() {},
  handleFlashHarnessResetWs() {},
  sendWsJson() {}
})
assert.deepEqual(missingTenantSocket.closed, { code: 1008, reason: 'tenant_context_required' })
assert.equal(missingTenantSocket.listeners.has('message'), false)

assert.match(indexSource, /attachWebSocketServer\(\{/)
assert.doesNotMatch(indexSource, /wss\.on\(['"]connection['"]/)
assert.doesNotMatch(indexSource, /data\.type ===/)
assert.doesNotMatch(readFileSync(resolve(repoRoot, 'realtime/websocket-server.js'), 'utf8'), /new AgentConversation/)
assert.doesNotMatch(readFileSync(resolve(repoRoot, 'realtime/websocket-server.js'), 'utf8'), /cline|agent:task/i)

console.log('PASS: WebSocket manifest and connection dispatcher preserve Harness messages, auth, subscriptions and cleanup')
