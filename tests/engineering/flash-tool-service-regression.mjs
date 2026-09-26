// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { FlashToolError } = require('../../realtime/flash-postgrest-adapter')
const { createFlashToolService } = require('../../realtime/flash-tool-service')
const repoRoot = resolve(import.meta.dirname, '../..')

const definitions = new Map([
  ['flash.read', { tool_id: 'flash.read', risk_level: 'low', confirm_required: false }],
  ['flash.write', { tool_id: 'flash.write', risk_level: 'medium', confirm_required: true }],
  ['flash.risky', { tool_id: 'flash.risky', risk_level: 'medium', confirm_required: false }]
])
let clock = 1000
const semanticCalls = []
const auditEvents = []
const resultData = { items: [{ id: 1 }] }
const service = createFlashToolService({
  idempotencyTtlMs: 1000,
  getToolDefinition: (toolId) => definitions.get(toolId),
  resolveToolId: (toolId) => ({
    'cap.read': 'flash.read',
    'cap.write': 'flash.write',
    'cap.risky': 'flash.risky'
  }[String(toolId || '').replace(/[^a-zA-Z0-9._-]/g, '')] || String(toolId || '').replace(/[^a-zA-Z0-9._-]/g, '')),
  registryVersion: 'flash-tools-v2',
  registryCount: 43,
  executeSemanticTool: async (toolId, args, user, call) => {
    semanticCalls.push({ toolId, args, user, call })
    if (args.mode === 'typed-error') {
      throw new FlashToolError('CONFLICT', 'already exists', {
        httpStatus: 409,
        reasonCode: 'DUPLICATE',
        data: { id: 7 }
      })
    }
    if (args.mode === 'generic-error') throw new Error('unexpected failure')
    clock += Number(args.duration || 0)
    return { message: '  completed  ', data: resultData, rowsAffected: 2 }
  },
  logAgentEvent: (type, user, details) => { auditEvents.push({ type, user, details }) },
  normalizeText: (value) => String(value ?? '').trim(),
  sanitizePathToken: (value, fallback = 'default') => {
    const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
    return cleaned || fallback
  },
  now: () => clock,
  random: () => 0.5
})

assert.equal(Object.isFrozen(service), true)
assert.deepEqual(Object.keys(service).sort(), [
  'executeFlashToolCall',
  'normalizeToolCallBoolean'
])
for (const [input, expected] of [
  [true, true], [false, false], [1, true], [0, false],
  ['true', true], ['TRUE', true], ['yes', true], ['y', true], ['1', true],
  ['false', false], ['no', false], ['', false], [null, false]
]) {
  assert.equal(service.normalizeToolCallBoolean(input), expected, String(input))
}

const missing = await service.executeFlashToolCall({ id: 1 }, {}, 'http')
assert.equal(missing.status, 400)
assert.equal(missing.payload.code, 'VALIDATION_FAILED')
assert.equal(missing.payload.message, 'tool_id is required')
assert.equal(missing.payload.tool_id, '')
assert.match(missing.payload.trace_id, /^tr_1000_[a-z0-9]+$/)
assert.deepEqual(missing.payload.error, { reason_code: 'VALIDATION_FAILED', http_status: 400 })
assert.equal(semanticCalls.length, 0)
assert.equal(auditEvents.length, 0)

const unknown = await service.executeFlashToolCall({ id: 1 }, {
  tool_id: 'flash.unknown',
  trace_id: 'unknown-trace'
})
assert.deepEqual(unknown, {
  status: 404,
  payload: {
    ok: false,
    code: 'TOOL_NOT_FOUND',
    message: 'tool_id not found: flash.unknown',
    tool_id: 'flash.unknown',
    trace_id: 'unknown-trace',
    error: { reason_code: 'TOOL_NOT_FOUND', http_status: 404 }
  }
})

const userOne = { id: 17, username: 'operator' }
const read = await service.executeFlashToolCall(userOne, {
  toolId: ' cap.read! ',
  trace: ' trace!*:1 ',
  arguments: { appId: 'app-1', duration: 25 },
  context: { sessionId: 'session/1', confirmed: 'no', extra: 'kept' }
}, 'ws')
assert.equal(read.status, 200)
assert.deepEqual(read.payload, {
  ok: true,
  code: 'OK',
  message: 'completed',
  tool_id: 'flash.read',
  trace_id: 'trace:1',
  registry_version: 'flash-tools-v2',
  registry_tools_count_actual: 43,
  data: { items: [{ id: 1 }] },
  meta: {
    risk_level: 'low',
    duration_ms: 25,
    rows_affected: 2,
    source: 'ws'
  }
})
assert.deepEqual(semanticCalls[0].call, {
  traceId: 'trace:1',
  toolId: 'flash.read',
  idempotencyKey: '',
  sessionId: 'session_1',
  appId: 'app-1',
  arguments: { appId: 'app-1', duration: 25 },
  context: { sessionId: 'session/1', confirmed: 'no', extra: 'kept' },
  confirmed: false
})
assert.deepEqual(auditEvents[0], {
  type: 'flash:tool_call_ok',
  user: userOne,
  details: {
    tool_id: 'flash.read',
    trace_id: 'trace:1',
    source: 'ws',
    duration_ms: 25
  }
})
resultData.items[0].id = 99
assert.equal(read.payload.data.items[0].id, 1, 'success payload must clone executor data')

const unconfirmed = await service.executeFlashToolCall(userOne, {
  tool_id: 'flash.write',
  trace_id: 'write-no-confirm'
})
assert.equal(unconfirmed.status, 403)
assert.equal(unconfirmed.payload.code, 'PERMISSION_DENIED')
assert.equal(unconfirmed.payload.message, 'write tool requires confirmed=true')
assert.equal(semanticCalls.length, 1)

const riskyUnconfirmed = await service.executeFlashToolCall(userOne, {
  tool_id: 'flash.risky',
  trace_id: 'risky-no-confirm'
})
assert.equal(riskyUnconfirmed.status, 403, 'non-low risk must require confirmation even if manifest flag is false')

const noKey = await service.executeFlashToolCall(userOne, {
  tool_id: 'flash.write',
  confirmed: 'yes',
  trace_id: 'write-no-key'
})
assert.equal(noKey.status, 400)
assert.equal(noKey.payload.code, 'VALIDATION_FAILED')
assert.equal(noKey.payload.message, 'idempotency_key is required for write tools')

resultData.items[0].id = 2
const writePayload = {
  toolId: 'cap.write',
  confirm: 'true',
  idempotencyKey: ' key!*:01 ',
  sessionId: 'write-session',
  appId: 'app-write',
  traceId: 'write-first',
  arguments: { value: 1 }
}
const writeFirst = await service.executeFlashToolCall(userOne, writePayload, 'http')
assert.equal(writeFirst.status, 200)
assert.equal(writeFirst.payload.meta.idempotent_replay, undefined)
assert.equal(semanticCalls.length, 2)
assert.equal(semanticCalls[1].call.idempotencyKey, 'key:01')
assert.equal(semanticCalls[1].call.confirmed, true)

const replay = await service.executeFlashToolCall(userOne, {
  ...writePayload,
  traceId: 'write-replay',
  arguments: { value: 999 }
})
assert.equal(replay.status, 200)
assert.equal(replay.payload.trace_id, 'write-first', 'idempotent replay must preserve the original response')
assert.equal(replay.payload.meta.idempotent_replay, true)
assert.equal(semanticCalls.length, 2)
assert.equal(auditEvents.length, 2, 'cache replay must not emit a second audit event')

const userTwo = { id: 18, username: 'other' }
await service.executeFlashToolCall(userTwo, writePayload)
assert.equal(semanticCalls.length, 3, 'idempotency cache must be isolated by user id')

clock += 1001
await service.executeFlashToolCall(userOne, writePayload)
assert.equal(semanticCalls.length, 4, 'expired idempotency entry must execute again')

const typed = await service.executeFlashToolCall(userOne, {
  tool_id: 'flash.read',
  trace_id: 'typed-trace',
  arguments: { mode: 'typed-error' }
})
assert.deepEqual(typed, {
  status: 409,
  payload: {
    ok: false,
    code: 'CONFLICT',
    message: 'already exists',
    tool_id: 'flash.read',
    trace_id: 'typed-trace',
    registry_version: 'flash-tools-v2',
    registry_tools_count_actual: 43,
    error: {
      reason_code: 'DUPLICATE',
      http_status: 409,
      data: { id: 7 }
    }
  }
})
assert.deepEqual(auditEvents.at(-1), {
  type: 'flash:tool_call_fail',
  user: userOne,
  details: {
    tool_id: 'flash.read',
    trace_id: 'typed-trace',
    source: 'http',
    code: 'CONFLICT',
    message: 'already exists'
  }
})

const generic = await service.executeFlashToolCall(userOne, {
  tool_id: 'flash.read',
  trace_id: 'generic-trace',
  arguments: { mode: 'generic-error' }
})
assert.equal(generic.status, 500)
assert.equal(generic.payload.code, 'INTERNAL_ERROR')
assert.equal(generic.payload.error.reason_code, 'INTERNAL_ERROR')
assert.equal(generic.payload.error.http_status, 500)
assert.equal(generic.payload.error.data, null)

let guardedAllowed = true
let guardedAuthorizationCalls = 0
let guardedExecutionCalls = 0
const guardedService = createFlashToolService({
  idempotencyTtlMs: 1000,
  authorizeTool: async () => {
    guardedAuthorizationCalls += 1
    return { allowed: guardedAllowed, context: { permissions: [] } }
  },
  getToolDefinition: (toolId) => definitions.get(toolId),
  resolveToolId: (toolId) => String(toolId || '').replace(/[^a-zA-Z0-9._-]/g, ''),
  registryVersion: 'flash-tools-v2',
  registryCount: 43,
  executeSemanticTool: async () => {
    guardedExecutionCalls += 1
    return { data: { saved: true } }
  },
  logAgentEvent() {},
  normalizeText: (value) => String(value ?? '').trim(),
  sanitizePathToken: (value) => String(value || 'default'),
  now: () => clock,
  random: () => 0.5
})
const guardedWrite = {
  tool_id: 'flash.write',
  confirmed: true,
  idempotency_key: 'guarded-write',
  arguments: { value: 1 }
}
assert.equal((await guardedService.executeFlashToolCall(userOne, guardedWrite)).status, 200)
guardedAllowed = false
const revokedReplay = await guardedService.executeFlashToolCall(userOne, guardedWrite)
assert.equal(revokedReplay.status, 403, 'cached writes must still re-check current permissions')
assert.equal(guardedAuthorizationCalls, 2)
assert.equal(guardedExecutionCalls, 1)

const compositionRoot = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(compositionRoot, /require\('\.\/flash-tool-service'\)/)
assert.match(compositionRoot, /createFlashToolService\(/)
assert.doesNotMatch(
  compositionRoot,
  /(flashToolIdempotencyCache|function normalizeFlashToolCallEnvelope|async function executeFlashToolCall|function (generateTraceId|sanitizeIdempotencyKey|cloneJsonValue|sanitizeTraceId|normalizeToolCallBoolean|cleanupFlashToolIdempotencyCache|makeFlashToolIdempotencyCacheKey))/
)
assert.ok(compositionRoot.split(/\r?\n/).length <= 4378, 'Realtime composition root must not regain Flash tool policy implementation')

console.log('PASS: Flash tool service preserves envelope aliases, confirmation, user-scoped TTL idempotency, responses, typed errors and audit events')
