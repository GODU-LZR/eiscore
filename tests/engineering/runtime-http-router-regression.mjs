// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const {
  CORE_HTTP_ROUTE_MANIFEST,
  HTTP_ROUTE_MANIFEST,
  createHttpRequestHandler,
  normalizeAgentRequestPath
} = require(resolve(repoRoot, 'realtime/http-router.js'))
const { COMPANY_HTTP_ROUTE_MANIFEST } = require(resolve(repoRoot, 'realtime/company-http.js'))

const descriptor = (method, match, matcher, handler, authorize = '') => [
  method,
  match,
  match === 'pattern' ? matcher.source : matcher,
  handler,
  authorize
]

const expectedRoutes = [
  descriptor('*', 'exact', '/health', 'health'),
  descriptor('POST', 'exact', '/document-intake/devices/bind', 'documentIntake.handleBindDevice'),
  descriptor('GET', 'exact', '/document-intake/admin/overview', 'documentIntake.handleGetOverview', 'documentIntakeAdmin'),
  descriptor('GET', 'exact', '/document-intake/admin/assets', 'documentIntake.handleListAssets', 'documentIntakeAdmin'),
  descriptor('GET', 'exact', '/document-intake/admin/devices', 'documentIntake.handleListDevices', 'documentIntakeAdmin'),
  descriptor('GET', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders$/, 'documentIntake.handleListDeviceWatchFolders', 'documentIntakeAdmin'),
  descriptor('POST', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders$/, 'documentIntake.handleCreateWatchFolder', 'documentIntakeAdmin'),
  descriptor('PATCH', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+$/, 'documentIntake.handleUpdateWatchFolder', 'documentIntakeAdmin'),
  descriptor('DELETE', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+$/, 'documentIntake.handleDeleteWatchFolder', 'documentIntakeAdmin'),
  descriptor('POST', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/watch-folders\/[^/]+\/status$/, 'documentIntake.handleUpdateWatchFolderStatus', 'documentIntakeAdmin'),
  descriptor('POST', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/status$/, 'documentIntake.handleUpdateDeviceStatus', 'documentIntakeAdmin'),
  descriptor('POST', 'pattern', /^\/document-intake\/admin\/devices\/[^/]+\/reset-binding-code$/, 'documentIntake.handleResetDeviceBindingCode', 'documentIntakeAdmin'),
  descriptor('GET', 'exact', '/document-intake/admin/logs', 'documentIntake.handleListLogs', 'documentIntakeAdmin'),
  descriptor('GET', 'exact', '/document-intake/admin/entry-results', 'documentIntake.handleListEntryResults', 'documentIntakeAdmin'),
  descriptor('GET', 'prefix', '/document-intake/admin/entry-results/', 'documentIntake.handleGetEntryResultDetail', 'documentIntakeAdmin'),
  descriptor('GET', 'exact', '/document-intake/devices/config', 'documentIntake.handleGetDeviceConfig'),
  descriptor('POST', 'exact', '/document-intake/devices/heartbeat', 'documentIntake.handleHeartbeat'),
  descriptor('POST', 'exact', '/document-intake/assets/upload', 'documentIntake.handleUploadAsset'),
  descriptor('POST', 'exact', '/document-intake/assets/chunks/init', 'documentIntake.handleInitChunkUpload'),
  descriptor('POST', 'exact', '/document-intake/assets/chunks/upload', 'documentIntake.handleUploadChunk'),
  descriptor('POST', 'exact', '/document-intake/assets/chunks/complete', 'documentIntake.handleCompleteChunkUpload'),
  descriptor('POST', 'exact', '/document-intake/client-logs/batch', 'documentIntake.handleLogBatch'),
  descriptor('GET', 'exact', '/ai/config', 'harness.handleConfig'),
  descriptor('GET', 'exact', '/ai/agents', 'harness.handleAgents'),
  descriptor('GET', 'exact', '/ai/business-snapshot', 'harness.handleBusinessSnapshot'),
  descriptor('POST', 'exact', '/ai/chat/completions', 'harness.handleChat'),
  descriptor('POST', 'exact', '/ai/translate', 'harness.handleCapability'),
  descriptor('POST', 'exact', '/ai/ocr', 'harness.handleCapability'),
  descriptor('POST', 'exact', '/ai/map-locate', 'harness.handleCapability'),
  descriptor('POST', 'exact', '/ai/harness/execute', 'harness.handleExecute'),
  descriptor('POST', 'exact', '/internal/harness/tool', 'harness.handleToolProxy'),
  descriptor('GET', 'exact', '/ai/harness/metrics', 'harness.handleMetrics'),
  descriptor('GET', 'exact', '/flash/draft', 'flash.handleDraftGet'),
  descriptor('POST', 'exact', '/flash/draft', 'flash.handleDraftWrite'),
  descriptor('POST', 'exact', '/flash/attachments', 'flash.handleAttachmentUpload'),
  descriptor('GET', 'exact', '/flash/tools/registry', 'flash.handleToolsRegistryGet'),
  descriptor('POST', 'exact', '/flash/tools/call', 'flash.handleToolCall'),
  descriptor('POST', 'exact', '/twin/chat', 'harness.handleTwinChat'),
  descriptor('GET', 'exact', '/twin/sessions', 'twin.handleSessionsList'),
  descriptor('DELETE', 'exact', '/twin/sessions', 'twin.handleSessionDelete'),
  descriptor('GET', 'exact', '/twin/messages', 'twin.handleMessagesGet'),
  descriptor('GET', 'exact', '/twin/knowledge', 'twin.handleKnowledgeList'),
  descriptor('POST', 'exact', '/twin/knowledge/upload', 'twin.handleKnowledgeUpload'),
  descriptor('DELETE', 'exact', '/twin/knowledge', 'twin.handleKnowledgeDelete'),
  ...COMPANY_HTTP_ROUTE_MANIFEST.map((entry) => descriptor(
    entry.method,
    entry.match,
    entry.match === 'pattern' ? entry.pattern : entry.path,
    entry.handler,
    entry.authorize
  ))
]

const actualRoutes = HTTP_ROUTE_MANIFEST.map((entry) => descriptor(
  entry.method,
  entry.match,
  entry.match === 'pattern' ? entry.pattern : entry.path,
  entry.handler,
  entry.authorize
))

assert.equal(CORE_HTTP_ROUTE_MANIFEST.length, 44)
assert.equal(HTTP_ROUTE_MANIFEST.length, CORE_HTTP_ROUTE_MANIFEST.length + COMPANY_HTTP_ROUTE_MANIFEST.length)
assert.deepEqual(actualRoutes, expectedRoutes)
assert.ok(Object.isFrozen(HTTP_ROUTE_MANIFEST))
assert.ok(HTTP_ROUTE_MANIFEST.every(Object.isFrozen))
assert.equal(normalizeAgentRequestPath('/agent/ai/translate?tenant=demo'), '/ai/translate')
assert.equal(normalizeAgentRequestPath('/ai/translate?tenant=demo'), '/ai/translate')
assert.equal(normalizeAgentRequestPath('/agent'), '/')
assert.equal(normalizeAgentRequestPath('/agent/ai/translate/extra'), '/ai/translate/extra')

const capabilityRoute = HTTP_ROUTE_MANIFEST.find((entry) => (
  entry.method === 'POST' && entry.match === 'exact' && entry.path === '/ai/translate'
))
assert.equal(capabilityRoute?.handler, 'harness.handleCapability')
assert.equal(HTTP_ROUTE_MANIFEST.some((entry) => entry.path === '/agent/ai/translate'), false)

const createResponse = () => Object.assign(new EventEmitter(), {
  status: null,
  cors: false,
  ended: false,
  writableEnded: false,
  writeHead(status) {
    this.status = status
  },
  end() {
    this.ended = true
    this.writableEnded = true
  }
})

const events = []
let adminAuthorized = true
const requestHandler = createHttpRequestHandler({
  getRequestPath: (req) => new URL(req.url, 'http://localhost').pathname,
  setCorsHeaders: (res) => {
    res.cors = true
  },
  authorizers: {
    documentIntakeAdmin(req, res) {
      events.push('authorize')
      if (adminAuthorized) return true
      res.writeHead(401)
      res.end()
      return false
    }
  },
  handlers: {
    health(_req, res) {
      events.push('health')
      res.writeHead(200)
      res.end()
    },
    documentIntake: {
      handleGetOverview() {
        events.push('overview')
      },
      handleListDeviceWatchFolders() {
        events.push('watch-folders')
      },
      handleGetEntryResultDetail() {
        events.push('entry-result-detail')
      }
    },
    ai: {},
    harness: {
      handleConfig() {
        events.push('ai-config')
      },
      async handleChat(req) {
        events.push('ai-chat')
        await new Promise((resolve) => req.signal.addEventListener('abort', resolve, { once: true }))
      }
    }
  }
})

const dispatch = async (method, url) => {
  const response = createResponse()
  await requestHandler({ method, url }, response)
  return response
}

events.length = 0
const optionsResponse = await dispatch('OPTIONS', '/not-a-route')
assert.deepEqual(events, [])
assert.equal(optionsResponse.cors, true)
assert.equal(optionsResponse.status, 204)
assert.equal(optionsResponse.ended, true)

events.length = 0
await dispatch('PUT', '/health')
assert.deepEqual(events, ['health'])

events.length = 0
await dispatch('GET', '/ai/config?tenant=demo')
assert.deepEqual(events, ['ai-config'])

events.length = 0
const disconnectedResponse = createResponse()
const disconnectedRequest = requestHandler({ method: 'POST', url: '/ai/chat/completions' }, disconnectedResponse)
await new Promise((resolve) => setImmediate(resolve))
assert.deepEqual(events, ['ai-chat'])
disconnectedResponse.emit('close')
await disconnectedRequest
assert.equal(disconnectedResponse.ended, false)

events.length = 0
await dispatch('GET', '/document-intake/admin/devices/device-1/watch-folders')
assert.deepEqual(events, ['authorize', 'watch-folders'])

events.length = 0
await dispatch('GET', '/document-intake/admin/entry-results/result-1')
assert.deepEqual(events, ['authorize', 'entry-result-detail'])

adminAuthorized = false
events.length = 0
const deniedResponse = await dispatch('GET', '/document-intake/admin/overview')
assert.deepEqual(events, ['authorize'])
assert.equal(deniedResponse.status, 401)
assert.equal(deniedResponse.ended, true)
adminAuthorized = true

events.length = 0
const methodMismatchResponse = await dispatch('GET', '/document-intake/devices/bind')
assert.deepEqual(events, [])
assert.equal(methodMismatchResponse.status, 404)
assert.equal(methodMismatchResponse.ended, true)

events.length = 0
const missingResponse = await dispatch('GET', '/missing')
assert.deepEqual(events, [])
assert.equal(missingResponse.status, 404)
assert.equal(missingResponse.ended, true)

assert.match(indexSource, /http\.createServer\(createHttpRequestHandler\(/)
assert.doesNotMatch(indexSource, /pathname\s*===\s*['"]\/(?:health|document-intake|ai|flash|twin)/)
assert.doesNotMatch(indexSource, /pathname\.startsWith\(['"]\/document-intake/)
assert.doesNotMatch(indexSource, /\/\^\\\/document-intake[\s\S]*?\.test\(pathname\)/)

console.log(`PASS: runtime HTTP router manifest and dispatch contract (${HTTP_ROUTE_MANIFEST.length} routes)`)
