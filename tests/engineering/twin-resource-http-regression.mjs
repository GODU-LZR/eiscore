// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(import.meta.dirname, '../..')
const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const { createTwinResourceHttpHandlers } = require(resolve(repoRoot, 'realtime/twin-resource-http.js'))

const user = Object.freeze({ username: 'operator', token: 'token' })
let authorized = true
let requestBody = {}
let bodyError = null
let failMethod = ''
let persistenceCreations = 0
let boundNamespaces = []
let persistenceNamespaces = []
const operations = []
const responses = []
let deleteResult = true

const maybeFail = (method) => {
  if (failMethod === method) throw new Error(`${method} failed`)
}

const persistence = {
  async listSessions(limit) {
    maybeFail('listSessions')
    operations.push(['listSessions', limit])
    return [{ id: 'session-1' }]
  },
  async deleteSession(id) {
    maybeFail('deleteSession')
    operations.push(['deleteSession', id])
  },
  async loadHistory(id, limit) {
    maybeFail('loadHistory')
    operations.push(['loadHistory', id, limit])
    return [{ role: 'user', content: 'hello' }]
  },
  async uploadKnowledgeFile(body) {
    maybeFail('uploadKnowledgeFile')
    operations.push(['uploadKnowledgeFile', body])
    return { id: 'file-1' }
  },
  async listKnowledgeFiles(limit) {
    maybeFail('listKnowledgeFiles')
    operations.push(['listKnowledgeFiles', limit])
    return [{ id: 'file-1' }]
  },
  async getKnowledgeFile(id) {
    maybeFail('getKnowledgeFile')
    operations.push(['getKnowledgeFile', id])
    return { id, file_name: 'guide.txt', content_text: 'content' }
  },
  async updateKnowledgeFile(id, patch) {
    maybeFail('updateKnowledgeFile')
    operations.push(['updateKnowledgeFile', id, patch])
    return { id, file_name: patch.file_name || 'guide.txt', ...patch }
  },
  async deleteKnowledgeFile(id) {
    maybeFail('deleteKnowledgeFile')
    operations.push(['deleteKnowledgeFile', id])
    return deleteResult
  }
}
const fileId = '11111111-1111-4111-8111-111111111111'

const handlers = createTwinResourceHttpHandlers({
  authorizeTwinRequest() {
    return authorized ? user : null
  },
  bindPgQueryForUser(value) {
    assert.equal(value.username, user.username)
    assert.equal(value.token, user.token)
    boundNamespaces.push(value.harness_namespace)
    return 'bound-query'
  },
  async readJsonBody() {
    if (bodyError) throw bodyError
    return requestBody
  },
  sendJson(_res, status, payload) {
    responses.push({ status, payload })
  },
  port: 8078,
  createPersistence(pgQuery, username, namespace) {
    assert.equal(pgQuery, 'bound-query')
    assert.equal(username, 'operator')
    persistenceNamespaces.push(namespace)
    persistenceCreations += 1
    return persistence
  }
})

const reset = () => {
  authorized = true
  requestBody = {}
  bodyError = null
  failMethod = ''
  persistenceCreations = 0
  boundNamespaces.length = 0
  persistenceNamespaces.length = 0
  operations.length = 0
  responses.length = 0
  deleteResult = true
}

reset()
authorized = false
await handlers.handleSessionsList({ url: '/twin/sessions' }, {})
assert.equal(persistenceCreations, 0)
assert.deepEqual(responses, [])

reset()
await handlers.handleSessionsList({ url: '/twin/sessions' }, {})
assert.deepEqual(operations, [['listSessions', 30]])
assert.deepEqual(boundNamespaces, ['business'])
assert.deepEqual(persistenceNamespaces, ['business'])
assert.deepEqual(responses, [{ status: 200, payload: { sessions: [{ id: 'session-1' }] } }])

reset()
failMethod = 'listSessions'
await handlers.handleSessionsList({ url: '/twin/sessions' }, {})
assert.equal(responses[0].status, 500)
assert.equal(responses[0].payload.code, 'TWIN_SESSIONS_FAILED')

reset()
await handlers.handleSessionDelete({ url: '/twin/sessions' }, {})
assert.equal(persistenceCreations, 0)
assert.deepEqual(responses, [{ status: 400, payload: { code: 'ID_REQUIRED', message: 'session id is required' } }])

reset()
await handlers.handleSessionDelete({ url: '/twin/sessions?id=session-2' }, {})
assert.deepEqual(operations, [['deleteSession', 'session-2']])
assert.deepEqual(responses, [{ status: 200, payload: { ok: true } }])

reset()
await handlers.handleMessagesGet({ url: '/twin/messages' }, {})
assert.equal(persistenceCreations, 0)
assert.equal(responses[0].payload.code, 'SESSION_ID_REQUIRED')

reset()
await handlers.handleMessagesGet({ url: '/twin/messages?session_id=session-3' }, {})
assert.deepEqual(operations, [['loadHistory', 'session-3', 50]])
assert.deepEqual(responses, [{
  status: 200,
  payload: { messages: [{ role: 'user', content: 'hello' }] }
}])

reset()
bodyError = new Error('invalid json')
await handlers.handleKnowledgeUpload({ url: '/twin/knowledge/upload' }, {})
assert.equal(persistenceCreations, 0)
assert.deepEqual(responses, [{ status: 400, payload: { code: 'BAD_REQUEST', message: 'invalid json' } }])

reset()
requestBody = { fileName: 'guide.txt', contentText: 'content' }
await handlers.handleKnowledgeUpload({ url: '/twin/knowledge/upload' }, {})
assert.deepEqual(operations, [['uploadKnowledgeFile', requestBody]])
assert.deepEqual(responses, [{ status: 200, payload: { ok: true, file: { id: 'file-1' } } }])

reset()
failMethod = 'uploadKnowledgeFile'
await handlers.handleKnowledgeUpload({ url: '/twin/knowledge/upload' }, {})
assert.equal(responses[0].status, 500)
assert.equal(responses[0].payload.code, 'TWIN_UPLOAD_FAILED')

reset()
await handlers.handleKnowledgeList({ url: '/twin/knowledge' }, {})
assert.deepEqual(operations, [['listKnowledgeFiles', 50]])
assert.deepEqual(responses, [{ status: 200, payload: { files: [{ id: 'file-1' }] } }])

reset()
await handlers.handleKnowledgeDelete({ url: '/twin/knowledge' }, {})
assert.equal(persistenceCreations, 0)
assert.deepEqual(responses, [{ status: 400, payload: { code: 'ID_REQUIRED', message: 'file id is required' } }])

reset()
await handlers.handleKnowledgeList({ url: `/twin/knowledge?id=${fileId}` }, {})
assert.deepEqual(operations, [['getKnowledgeFile', fileId]])
assert.deepEqual(responses, [{ status: 200, payload: { file: { id: fileId, file_name: 'guide.txt', content_text: 'content' } } }])

reset()
await handlers.handleKnowledgeList({ url: '/twin/knowledge?id=invalid' }, {})
assert.deepEqual(operations, [])
assert.equal(responses[0].status, 400)
assert.equal(responses[0].payload.code, 'TWIN_KB_INVALID')

reset()
await handlers.handleKnowledgeUpdate({ url: '/twin/knowledge/files' }, {})
assert.equal(persistenceCreations, 0)
assert.deepEqual(responses, [{ status: 400, payload: { code: 'ID_REQUIRED', message: 'file id is required' } }])

reset()
requestBody = {
  fileName: 'renamed.txt',
  employee_id: 'other-user',
  harness_namespace: 'business',
  id: '22222222-2222-4222-8222-222222222222'
}
await handlers.handleKnowledgeUpdate({ url: `/twin/knowledge/files?id=${fileId}` }, {})
assert.deepEqual(operations, [['updateKnowledgeFile', fileId, { file_name: 'renamed.txt' }]])
assert.deepEqual(boundNamespaces, ['business'])
assert.deepEqual(responses, [{ status: 200, payload: { ok: true, file: { id: fileId, file_name: 'renamed.txt' } } }])

reset()
requestBody = { fileName: '   ' }
await handlers.handleKnowledgeUpdate({ url: `/twin/knowledge/files?id=${fileId}` }, {})
assert.deepEqual(operations, [])
assert.equal(responses[0].status, 400)
assert.equal(responses[0].payload.code, 'TWIN_KB_INVALID')

reset()
await handlers.handleKnowledgeDelete({ url: `/twin/knowledge?id=${fileId}` }, {})
assert.deepEqual(operations, [['deleteKnowledgeFile', fileId]])
assert.deepEqual(responses, [{ status: 200, payload: { ok: true } }])

reset()
deleteResult = false
await handlers.handleKnowledgeDelete({ url: `/twin/knowledge?id=${fileId}` }, {})
assert.equal(responses[0].status, 404)

const knowledgeHandlers = createTwinResourceHttpHandlers({
  authorizeTwinRequest() {
    return user
  },
  bindPgQueryForUser(value) {
    assert.equal(value.harness_namespace, 'knowledge')
    boundNamespaces.push(value.harness_namespace)
    return 'bound-query'
  },
  readJsonBody: async () => ({}),
  sendJson(_res, status, payload) {
    responses.push({ status, payload })
  },
  port: 8078,
  namespace: 'knowledge',
  createPersistence(pgQuery, username, namespace) {
    assert.equal(pgQuery, 'bound-query')
    assert.equal(username, 'operator')
    assert.equal(namespace, 'knowledge')
    return persistence
  }
})

reset()
await knowledgeHandlers.handleKnowledgeDelete({ url: `/twin/knowledge?id=${fileId}` }, {})
assert.deepEqual(operations, [['deleteKnowledgeFile', fileId]])
assert.deepEqual(boundNamespaces, ['knowledge'])
assert.deepEqual(responses, [{ status: 200, payload: { ok: true } }])

assert.ok(Object.isFrozen(handlers))
assert.match(indexSource, /createTwinResourceHttpHandlers\(\{/)
assert.match(indexSource, /\.\.\.twinResourceHttpHandlers/)
assert.doesNotMatch(indexSource, /const handleTwin(?:SessionsList|SessionDelete|MessagesGet|KnowledgeUpload|KnowledgeList|KnowledgeDelete)/)

console.log('PASS: Twin session and knowledge HTTP handlers preserve authorization, persistence, limits and responses')
