// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const { createFlashHttpHandlers } = require(resolve(repoRoot, 'realtime/flash-http.js'))

const user = Object.freeze({ username: 'builder', role: 'manager' })
let authorized = true
let draftAuthorized = true
let requestBody = {}
let readError = null
let toolResult = { status: 200, payload: { ok: true } }
let draftReadResult = { content: 'draft' }
let draftReadError = null
let draftWriteResult = { path: '/workspace/FlashDraft.vue' }
let draftWriteError = null
let attachmentResult = { name: 'image.png' }
let attachmentError = null
const calls = []
const responses = []

const handlers = createFlashHttpHandlers({
  authorizeAgentHttpRequest() {
    return authorized ? user : null
  },
  async authorizeFlashTool(value, toolId, args, call) {
    calls.push(['authorizeFlashTool', value, toolId, args, call])
    return { allowed: draftAuthorized, context: {} }
  },
  getFlashToolRegistryPayload() {
    calls.push(['registry'])
    return { version: 1, tools: [{ id: 'read_draft' }] }
  },
  async readJsonBody(_req, maxBytes) {
    calls.push(['readJsonBody', maxBytes])
    if (readError) throw readError
    return requestBody
  },
  async executeFlashToolCall(value, body, source) {
    calls.push(['executeFlashToolCall', value, body, source])
    return toolResult
  },
  async readFlashDraftSource(appId) {
    calls.push(['readFlashDraftSource', appId])
    if (draftReadError) throw draftReadError
    return draftReadResult
  },
  async writeFlashDraftSource(content, reason, value, appId) {
    calls.push(['writeFlashDraftSource', content, reason, value, appId])
    if (draftWriteError) throw draftWriteError
    return draftWriteResult
  },
  async uploadFlashAttachment(body, value) {
    calls.push(['uploadFlashAttachment', body, value])
    if (attachmentError) throw attachmentError
    return attachmentResult
  },
  resolveFlashToolErrorStatus(error) {
    return error.flashStatus || 500
  },
  flashAttachmentMaxBytes: 3 * 1024 * 1024,
  sendJson(_res, status, payload) {
    responses.push({ status, payload })
  }
})

const reset = () => {
  authorized = true
  draftAuthorized = true
  requestBody = {}
  readError = null
  toolResult = { status: 200, payload: { ok: true } }
  draftReadResult = { content: 'draft' }
  draftReadError = null
  draftWriteResult = { path: '/workspace/FlashDraft.vue' }
  draftWriteError = null
  attachmentResult = { name: 'image.png' }
  attachmentError = null
  calls.length = 0
  responses.length = 0
}

reset()
authorized = false
for (const handler of Object.values(handlers)) {
  await handler({ url: '/', headers: {} }, {})
}
assert.deepEqual(calls, [])
assert.deepEqual(responses, [])

reset()
await handlers.handleToolsRegistryGet({}, {})
assert.deepEqual(calls, [['registry']])
assert.deepEqual(responses, [{
  status: 200,
  payload: { version: 1, tools: [{ id: 'read_draft' }] }
}])

reset()
readError = new Error('invalid tool body')
await handlers.handleToolCall({}, {})
assert.deepEqual(calls, [['readJsonBody', 4 * 1024 * 1024]])
assert.deepEqual(responses, [{
  status: 400,
  payload: { code: 'BAD_REQUEST', message: 'invalid tool body' }
}])

reset()
requestBody = { tool_id: 'read_draft' }
toolResult = { status: 202, payload: { ok: true, trace_id: 'trace-1' } }
await handlers.handleToolCall({}, {})
assert.deepEqual(calls, [
  ['readJsonBody', 4 * 1024 * 1024],
  ['executeFlashToolCall', user, requestBody, 'http']
])
assert.deepEqual(responses, [{ status: 202, payload: toolResult.payload }])

reset()
await handlers.handleDraftGet({
  url: '/flash/draft?appId=app-camel&app_id=app-snake',
  headers: { host: 'agent.local' }
}, {})
assert.deepEqual(calls, [
  ['authorizeFlashTool', user, 'flash.draft.read', { appId: 'app-camel' }, { appId: 'app-camel', source: 'flash-draft-http' }],
  ['readFlashDraftSource', 'app-camel']
])
assert.deepEqual(responses, [{ status: 200, payload: draftReadResult }])

reset()
await handlers.handleDraftGet({ url: '/flash/draft', headers: {} }, {})
assert.deepEqual(calls, [])
assert.deepEqual(responses, [{
  status: 400,
  payload: { code: 'APP_ID_REQUIRED', message: 'appId is required for flash draft access' }
}])

reset()
draftReadError = new Error('draft unavailable')
await handlers.handleDraftGet({ url: '/flash/draft?appId=read-error-app', headers: {} }, {})
assert.deepEqual(responses, [{
  status: 500,
  payload: { code: 'FLASH_DRAFT_READ_FAILED', message: 'draft unavailable' }
}])

reset()
requestBody = { content: '<template />', reason: 'update', app_id: 'legacy-app' }
await handlers.handleDraftWrite({}, {})
assert.deepEqual(calls, [
  ['readJsonBody', 2 * 1024 * 1024],
  ['authorizeFlashTool', user, 'flash.draft.write', { appId: 'legacy-app' }, { appId: 'legacy-app', source: 'flash-draft-http' }],
  ['writeFlashDraftSource', '<template />', 'update', user, 'legacy-app']
])
assert.deepEqual(responses, [{
  status: 200,
  payload: { ok: true, path: '/workspace/FlashDraft.vue' }
}])

reset()
draftAuthorized = false
requestBody = { content: '<template />', appId: 'denied-app' }
await handlers.handleDraftWrite({}, {})
assert.deepEqual(calls, [
  ['readJsonBody', 2 * 1024 * 1024],
  ['authorizeFlashTool', user, 'flash.draft.write', { appId: 'denied-app' }, { appId: 'denied-app', source: 'flash-draft-http' }]
])
assert.deepEqual(responses, [{
  status: 403,
  payload: { code: 'PERMISSION_DENIED', message: 'Current user is not authorized for this flash app' }
}])

reset()
requestBody = { content: '', appId: 'error-app' }
draftWriteError = Object.assign(new Error('content required'), { flashStatus: 400 })
await handlers.handleDraftWrite({}, {})
assert.deepEqual(responses, [{
  status: 400,
  payload: { code: 'BAD_REQUEST', message: 'content required' }
}])

reset()
requestBody = { fileName: 'image.png' }
await handlers.handleAttachmentUpload({}, {})
assert.deepEqual(calls, [
  ['readJsonBody', 6 * 1024 * 1024],
  ['uploadFlashAttachment', requestBody, user]
])
assert.deepEqual(responses, [{
  status: 200,
  payload: { ok: true, file: attachmentResult }
}])

reset()
attachmentError = new Error('storage unavailable')
await handlers.handleAttachmentUpload({}, {})
assert.deepEqual(responses, [{
  status: 500,
  payload: { code: 'FLASH_ATTACHMENT_UPLOAD_FAILED', message: 'storage unavailable' }
}])

assert.ok(Object.isFrozen(handlers))
assert.match(indexSource, /createFlashHttpHandlers\(\{/)
assert.match(indexSource, /authorizeFlashTool: \(\.\.\.args\) => flashAuthorization\.authorizeFlashTool\(\.\.\.args\)/)
assert.match(indexSource, /\.\.\.flashHttpHandlers/)
assert.match(indexSource, /let handleFlashToolCallWs/)
assert.match(indexSource, /handleFlashToolCallWs = createHarnessFlashToolCallHandler\(\{/)
assert.doesNotMatch(indexSource, /const handleFlash(?:ToolsRegistryGet|ToolCallHttp|DraftGet|DraftWrite|AttachmentUpload)/)

console.log('PASS: Flash HTTP handlers preserve authorization, body limits, app ids, tool results and error mapping')
