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
  BUSINESS_HTTP_ROUTE_MANIFEST,
  FLASH_HTTP_ROUTE_MANIFEST,
  KNOWLEDGE_HTTP_ROUTE_MANIFEST,
  INVALID_HTTP_ROUTE_MANIFEST,
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
  descriptor('POST', 'exact', '/internal/harness/session', 'harness.handleSessionRegister'),
  descriptor('DELETE', 'exact', '/internal/harness/session', 'harness.handleSessionUnregister'),
  descriptor('GET', 'exact', '/ai/harness/metrics', 'harness.handleMetrics'),
  descriptor('GET', 'exact', '/flash/draft', 'flash.handleDraftGet'),
  descriptor('POST', 'exact', '/flash/draft', 'flash.handleDraftWrite'),
  descriptor('POST', 'exact', '/flash/attachments', 'flash.handleAttachmentUpload'),
  descriptor('GET', 'exact', '/flash/tools/registry', 'flash.handleToolsRegistryGet'),
  descriptor('POST', 'exact', '/flash/tools/call', 'flash.handleToolCall'),
  descriptor('POST', 'exact', '/twin/chat', 'harness.handleTwinChat'),
  descriptor('POST', 'exact', '/twin/knowledge/chat', 'harness.handleKnowledgeTwinChat'),
  descriptor('GET', 'exact', '/twin/knowledge/sessions', 'twin.handleKnowledgeSessionsList'),
  descriptor('DELETE', 'exact', '/twin/knowledge/sessions', 'twin.handleKnowledgeSessionDelete'),
  descriptor('GET', 'exact', '/twin/knowledge/messages', 'twin.handleKnowledgeMessagesGet'),
  descriptor('GET', 'exact', '/twin/knowledge/files', 'twin.handleKnowledgeFilesList'),
  descriptor('POST', 'exact', '/twin/knowledge/files', 'twin.handleKnowledgeFileUpload'),
  descriptor('DELETE', 'exact', '/twin/knowledge/files', 'twin.handleKnowledgeFileDelete'),
  descriptor('GET', 'exact', '/twin/sessions', 'twin.handleSessionsList'),
  descriptor('GET', 'exact', '/twin/admin/sessions', 'twin.handleAdminSessionsList'),
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

assert.equal(CORE_HTTP_ROUTE_MANIFEST.length, 54)
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

const profileCases = [
  ['GET', '/company-site/public/site-config?locale=zh-CN', 'company.handleGetPublicSiteConfig', true, false],
  ['POST', '/company-site/auth/handoff', 'company.handleCreateAuthHandoff', true, false],
  ['POST', '/company-site/auth/handoff/consume', 'company.handleConsumeAuthHandoff', true, false],
  ['POST', '/internal/harness/session', 'harness.handleSessionRegister', false, true],
  ['DELETE', '/internal/harness/session', 'harness.handleSessionUnregister', false, true],
  ['POST', '/internal/harness/tool', 'harness.handleToolProxy', true, true],
  ['GET', '/flash/draft', 'flash.handleDraftGet', false, true],
  ['GET', '/ai/config', 'harness.handleConfig', true, false],
  ['POST', '/twin/chat', 'harness.handleTwinChat', true, false],
  ['POST', '/twin/knowledge/chat', 'harness.handleKnowledgeTwinChat', false, false],
  ['GET', '/twin/knowledge/sessions', 'twin.handleKnowledgeSessionsList', false, false],
  ['PUT', '/health', 'health', true, true]
]
const recordDispatch = (name) => (_req, res) => {
  events.push(name)
  res.writeHead(200)
  res.end()
}
for (const [profile, routes, allowedIndex] of [
  ['business', BUSINESS_HTTP_ROUTE_MANIFEST, 3],
  ['flash', FLASH_HTTP_ROUTE_MANIFEST, 4]
]) {
  const profileHandler = createHttpRequestHandler({
    routes,
    getRequestPath: (req) => normalizeAgentRequestPath(req.url),
    setCorsHeaders: () => {},
    handlers: {
      health: recordDispatch('health'),
      company: {
        handleGetPublicSiteConfig: recordDispatch('company.handleGetPublicSiteConfig'),
        handleCreateAuthHandoff: recordDispatch('company.handleCreateAuthHandoff'),
        handleConsumeAuthHandoff: recordDispatch('company.handleConsumeAuthHandoff')
      },
      harness: {
        handleSessionRegister: recordDispatch('harness.handleSessionRegister'),
        handleSessionUnregister: recordDispatch('harness.handleSessionUnregister'),
        handleToolProxy: recordDispatch('harness.handleToolProxy'),
        handleConfig: recordDispatch('harness.handleConfig'),
        handleTwinChat: recordDispatch('harness.handleTwinChat'),
        handleKnowledgeTwinChat: recordDispatch('harness.handleKnowledgeTwinChat')
      },
      twin: {
        handleKnowledgeSessionsList: recordDispatch('twin.handleKnowledgeSessionsList'),
        handleKnowledgeSessionDelete: recordDispatch('twin.handleKnowledgeSessionDelete'),
        handleKnowledgeMessagesGet: recordDispatch('twin.handleKnowledgeMessagesGet'),
        handleKnowledgeFilesList: recordDispatch('twin.handleKnowledgeFilesList'),
        handleKnowledgeFileUpload: recordDispatch('twin.handleKnowledgeFileUpload'),
        handleKnowledgeFileDelete: recordDispatch('twin.handleKnowledgeFileDelete'),
        handleKnowledgeList: recordDispatch('twin.handleKnowledgeList'),
        handleKnowledgeUpload: recordDispatch('twin.handleKnowledgeUpload'),
        handleKnowledgeDelete: recordDispatch('twin.handleKnowledgeDelete')
      },
      flash: { handleDraftGet: recordDispatch('flash.handleDraftGet') }
    }
  })
  for (const testCase of profileCases) {
    const [method, path, handler] = testCase
    for (const url of [path, `/agent${path}`]) {
      events.length = 0
      const response = createResponse()
      await profileHandler({ method, url }, response)
      const allowed = testCase[allowedIndex]
      assert.equal(response.status, allowed ? 200 : 404, `${profile}: ${method} ${url}`)
      assert.deepEqual(events, allowed ? [handler] : [], `${profile}: ${method} ${url}`)
    }
  }
  assert.ok(Object.isFrozen(routes))
}
const knowledgeProfileHandler = createHttpRequestHandler({
  routes: KNOWLEDGE_HTTP_ROUTE_MANIFEST,
  getRequestPath: (req) => normalizeAgentRequestPath(req.url),
  setCorsHeaders: () => {},
  handlers: {
    health: recordDispatch('health'),
    harness: {
      handleToolProxy: recordDispatch('harness.handleToolProxy'),
      handleKnowledgeTwinChat: recordDispatch('harness.handleKnowledgeTwinChat')
    },
    twin: {
      handleKnowledgeSessionsList: recordDispatch('twin.handleKnowledgeSessionsList'),
      handleKnowledgeSessionDelete: recordDispatch('twin.handleKnowledgeSessionDelete'),
      handleKnowledgeMessagesGet: recordDispatch('twin.handleKnowledgeMessagesGet'),
      handleKnowledgeFilesList: recordDispatch('twin.handleKnowledgeFilesList'),
      handleKnowledgeFileUpload: recordDispatch('twin.handleKnowledgeFileUpload'),
      handleKnowledgeFileDelete: recordDispatch('twin.handleKnowledgeFileDelete'),
      handleKnowledgeList: recordDispatch('twin.handleKnowledgeList'),
      handleKnowledgeUpload: recordDispatch('twin.handleKnowledgeUpload'),
      handleKnowledgeDelete: recordDispatch('twin.handleKnowledgeDelete')
    }
  }
})
for (const [method, path, handler] of [
  ['GET', '/health', 'health'],
  ['POST', '/internal/harness/tool', 'harness.handleToolProxy'],
  ['POST', '/twin/knowledge/chat', 'harness.handleKnowledgeTwinChat'],
  ['GET', '/twin/knowledge/sessions', 'twin.handleKnowledgeSessionsList'],
  ['DELETE', '/twin/knowledge/sessions', 'twin.handleKnowledgeSessionDelete'],
  ['GET', '/twin/knowledge/messages', 'twin.handleKnowledgeMessagesGet'],
  ['GET', '/twin/knowledge/files', 'twin.handleKnowledgeFilesList'],
  ['POST', '/twin/knowledge/files', 'twin.handleKnowledgeFileUpload'],
  ['DELETE', '/twin/knowledge/files', 'twin.handleKnowledgeFileDelete'],
  ['GET', '/twin/knowledge', 'twin.handleKnowledgeList'],
  ['POST', '/twin/knowledge/upload', 'twin.handleKnowledgeUpload'],
  ['DELETE', '/twin/knowledge', 'twin.handleKnowledgeDelete']
]) {
  for (const url of [path, `/agent${path}`]) {
    events.length = 0
    const response = createResponse()
    await knowledgeProfileHandler({ method, url }, response)
    assert.equal(response.status, 200, `knowledge: ${method} ${url}`)
    assert.deepEqual(events, [handler], `knowledge: ${method} ${url}`)
  }
}
for (const [method, path] of [['POST', '/twin/chat'], ['GET', '/ai/config'], ['POST', '/flash/draft'], ['POST', '/internal/harness/session']]) {
  const response = createResponse()
  await knowledgeProfileHandler({ method, url: path }, response)
  assert.equal(response.status, 404, `knowledge must reject ${method} ${path}`)
}
assert.ok(Object.isFrozen(KNOWLEDGE_HTTP_ROUTE_MANIFEST))
const invalidProfileHandler = createHttpRequestHandler({
  routes: INVALID_HTTP_ROUTE_MANIFEST,
  strictOptions: true,
  getRequestPath: (req) => normalizeAgentRequestPath(req.url),
  setCorsHeaders: (res) => { res.cors = true },
  handlers: { health: recordDispatch('health') }
})
for (const url of ['/health', '/agent/health']) {
  events.length = 0
  const response = createResponse()
  await invalidProfileHandler({ method: 'GET', url }, response)
  assert.equal(response.status, 200, `unknown profile must retain health: ${url}`)
  assert.deepEqual(events, ['health'])
}
for (const [url, expectedStatus] of [['/health', 204], ['/ai/config', 404], ['/company-site/public/site-config', 404]]) {
  events.length = 0
  const response = createResponse()
  await invalidProfileHandler({ method: 'OPTIONS', url }, response)
  assert.equal(response.status, expectedStatus, `unknown profile OPTIONS ${url}`)
  assert.equal(response.cors, expectedStatus === 204)
  assert.deepEqual(events, [])
}
for (const [method, path] of [
  ['GET', '/ai/config'],
  ['POST', '/ai/chat/completions'],
  ['POST', '/internal/harness/tool'],
  ['POST', '/twin/chat'],
  ['POST', '/twin/knowledge/chat'],
  ['POST', '/flash/draft'],
  ['GET', '/company-site/public/site-config']
]) {
  for (const url of [path, `/agent${path}`]) {
    events.length = 0
    const response = createResponse()
    await invalidProfileHandler({ method, url }, response)
    assert.equal(response.status, 404, `unknown profile must reject ${method} ${url}`)
    assert.deepEqual(events, [])
  }
}
assert.deepEqual(INVALID_HTTP_ROUTE_MANIFEST.map((entry) => descriptor(
  entry.method,
  entry.match,
  entry.match === 'pattern' ? entry.pattern : entry.path,
  entry.handler,
  entry.authorize
)), [descriptor('*', 'exact', '/health', 'health')])
assert.ok(Object.isFrozen(INVALID_HTTP_ROUTE_MANIFEST))
assert.equal(BUSINESS_HTTP_ROUTE_MANIFEST.length, 79)
for (const entry of HTTP_ROUTE_MANIFEST) {
  assert.equal(BUSINESS_HTTP_ROUTE_MANIFEST.includes(entry), !entry.path?.startsWith('/flash/') && !entry.path?.startsWith('/twin/knowledge') && entry.path !== '/internal/harness/session', entry.handler)
}
assert.deepEqual(FLASH_HTTP_ROUTE_MANIFEST, CORE_HTTP_ROUTE_MANIFEST.filter((entry) => [
  '/health', '/internal/harness/tool', '/internal/harness/session',
  '/flash/draft', '/flash/attachments', '/flash/tools/registry', '/flash/tools/call'
].includes(entry.path)))
assert.equal(FLASH_HTTP_ROUTE_MANIFEST.length, 9)
assert.deepEqual(KNOWLEDGE_HTTP_ROUTE_MANIFEST.map((entry) => descriptor(
  entry.method,
  entry.match,
  entry.match === 'pattern' ? entry.pattern : entry.path,
  entry.handler,
  entry.authorize
)), [
  descriptor('*', 'exact', '/health', 'health'),
  descriptor('POST', 'exact', '/internal/harness/tool', 'harness.handleToolProxy'),
  descriptor('POST', 'exact', '/twin/knowledge/chat', 'harness.handleKnowledgeTwinChat'),
  descriptor('GET', 'exact', '/twin/knowledge/sessions', 'twin.handleKnowledgeSessionsList'),
  descriptor('DELETE', 'exact', '/twin/knowledge/sessions', 'twin.handleKnowledgeSessionDelete'),
  descriptor('GET', 'exact', '/twin/knowledge/messages', 'twin.handleKnowledgeMessagesGet'),
  descriptor('GET', 'exact', '/twin/knowledge/files', 'twin.handleKnowledgeFilesList'),
  descriptor('POST', 'exact', '/twin/knowledge/files', 'twin.handleKnowledgeFileUpload'),
  descriptor('DELETE', 'exact', '/twin/knowledge/files', 'twin.handleKnowledgeFileDelete'),
  descriptor('GET', 'exact', '/twin/knowledge', 'twin.handleKnowledgeList'),
  descriptor('POST', 'exact', '/twin/knowledge/upload', 'twin.handleKnowledgeUpload'),
  descriptor('DELETE', 'exact', '/twin/knowledge', 'twin.handleKnowledgeDelete')
])

assert.match(indexSource, /http\.createServer\(createHttpRequestHandler\(/)
assert.match(indexSource, /routes:\s*flashRuntime\s*\?\s*FLASH_HTTP_ROUTE_MANIFEST\s*:\s*knowledgeRuntime\s*\?\s*KNOWLEDGE_HTTP_ROUTE_MANIFEST\s*:\s*businessRuntime\s*\?\s*BUSINESS_HTTP_ROUTE_MANIFEST\s*:\s*INVALID_HTTP_ROUTE_MANIFEST/)
assert.match(indexSource, /strictOptions:\s*!supportedRuntimeProfile/)
assert.match(indexSource, /supportedRuntimeProfile\s*\?\s*200\s*:\s*503/)
assert.match(indexSource, /if\s*\(supportedRuntimeProfile\)\s*attachWebSocketServer\(/)
assert.match(indexSource, /wss\.on\('connection',\s*\(ws\)\s*=>\s*ws\.close\(1008,\s*'runtime_profile_invalid'\)\)/)
assert.match(indexSource, /const databaseNotifier\s*=\s*!businessRuntime\s*&&\s*!knowledgeRuntime/)
assert.doesNotMatch(indexSource, /pathname\s*===\s*['"]\/(?:health|document-intake|ai|flash|twin)/)
assert.doesNotMatch(indexSource, /pathname\.startsWith\(['"]\/document-intake/)
assert.doesNotMatch(indexSource, /\/\^\\\/document-intake[\s\S]*?\.test\(pathname\)/)

console.log(`PASS: runtime HTTP router manifest and dispatch contract (${HTTP_ROUTE_MANIFEST.length} routes)`)
