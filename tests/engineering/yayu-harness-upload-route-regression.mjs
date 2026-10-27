// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const auth = await import(new URL('../../agent-harness/auth-plugin.mjs', import.meta.url))
const { createCustomerFileUploadHandler, MAX_BODY_BYTES } = require(fileURLToPath(new URL('../../realtime/customer-files-upload.js', import.meta.url)))
const { CORE_HTTP_ROUTE_MANIFEST, FLASH_HTTP_ROUTE_MANIFEST, BUSINESS_HTTP_ROUTE_MANIFEST } = require(fileURLToPath(new URL('../../realtime/http-router.js', import.meta.url)))

const businessRoutes = auth.createAuthRoutes({ profile: 'business', upload: () => new Response('{}', { status: 201 }) })
const flashRoutes = auth.createAuthRoutes({ profile: 'flash', upload: () => new Response('{}', { status: 201 }) })
const fileRoute = businessRoutes.find((route) => route.path === '/api/eiscore/files/upload')
assert.equal(fileRoute?.maxRequestBodyBytes, 20 * 1024 * 1024)
assert.equal(flashRoutes.some((route) => route.path === '/api/eiscore/files/upload'), false)
assert.equal(MAX_BODY_BYTES, 20 * 1024 * 1024)
assert.ok(BUSINESS_HTTP_ROUTE_MANIFEST.some((route) => route.path === '/ai/harness/files/upload'))
assert.ok(BUSINESS_HTTP_ROUTE_MANIFEST.some((route) => route.path === '/ai/harness/files/read'))
assert.ok(BUSINESS_HTTP_ROUTE_MANIFEST.some((route) => route.path === '/ai/harness/files/delete'))
assert.equal(FLASH_HTTP_ROUTE_MANIFEST.some((route) => route.path === '/ai/harness/files/upload'), false)
assert.ok(CORE_HTTP_ROUTE_MANIFEST.some((route) => route.path === '/ai/harness/files/upload'))

const ctx = {
  effect(callback) { callback() },
  connection: { requestRejection() {} },
  webServer: { register() {} }
}

const chunks = [Buffer.alloc(5 * 1024, 0x61)]
const request = {
  method: 'POST',
  url: '/api/eiscore/files/upload',
  headers: { 'content-type': 'text/plain', 'x-eiscore-file-name': 'notes.txt' },
  async *[Symbol.asyncIterator]() { yield* chunks }
}
let capturedBytes = 0
const received = []
const response = new PassThrough()
response.writeHead = (status) => { response.status = status }
response.end = (...args) => { response.ended = true; PassThrough.prototype.end.call(response, ...args) }
const route = { ...fileRoute, method: 'POST', fetch: async (body) => {
  capturedBytes = (await body.arrayBuffer()).byteLength
  received.push(body.headers.get('x-eiscore-file-name'))
  return new Response(null, { status: 201 })
} }
const registered = []
auth.registerHttpRoute({ ...ctx, webServer: { register(value) { registered.push(value) } } }, route)
await registered[0].handler(request, response)
assert.equal(response.status, 201)
assert.equal(capturedBytes, 5 * 1024)
assert.deepEqual(received, ['notes.txt'])

const oversized = { ...request, resume() {}, async *[Symbol.asyncIterator]() { yield Buffer.alloc(MAX_BODY_BYTES + 1, 0x61) } }
const oversizedResponse = new PassThrough()
oversizedResponse.writeHead = (status, headers) => { oversizedResponse.status = status; oversizedResponse.headers = headers; oversizedResponse.headersSent = true; return oversizedResponse }
oversizedResponse.end = (body, ...args) => { oversizedResponse.ended = true; oversizedResponse.body = String(body || ''); PassThrough.prototype.end.call(oversizedResponse, body, ...args) }
const oversizedRoute = { ...fileRoute, method: 'POST', fetch: async () => new Response(null, { status: 201 }) }
const oversizedRegistered = []
auth.registerHttpRoute({ ...ctx, webServer: { register(value) { oversizedRegistered.push(value) } } }, oversizedRoute)
await oversizedRegistered[0].handler(oversized, oversizedResponse)
assert.equal(oversizedResponse.status, 413)
assert.equal(oversizedResponse.headers['content-type'], 'application/json; charset=utf-8')
assert.deepEqual(JSON.parse(oversizedResponse.body), { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds the 20 MiB upload limit' })

const authorize = () => ({ id: 'user-1', tenant_id: 'tenant-1' })
const upload = createCustomerFileUploadHandler({
  authorize,
  sendJson: (res, status, payload) => { res.status = status; res.payload = payload },
  fetchSemanticContext: async () => ({ accessPolicy: { roleScoped: true, superUser: true }, fieldAclAvailable: true, fieldAcl: {} }),
  callPostgrestWithUser: async (_user, options) => ({ data: [{ id: 'file-1', filename: 'notes.txt', mime_type: 'text/plain', size_bytes: 5 }] })
})
const uploadRequest = Object.assign(new EventEmitter(), {
  headers: { 'content-length': String(5 * 1024), 'content-type': 'application/pdf', 'x-eiscore-file-name': encodeURIComponent('notes.pdf') },
  resume() {}
})
const uploadResponse = {}
const uploadPromise = upload.handleUpload(uploadRequest, uploadResponse)
await new Promise((resolve) => setImmediate(resolve))
uploadRequest.emit('data', Buffer.alloc(5 * 1024, 0x61))
uploadRequest.emit('end')
await uploadPromise
assert.equal(uploadResponse.status, 201)

const ownedFileId = '22222222-2222-4222-8222-222222222222'
const secureResponses = []
const secure = createCustomerFileUploadHandler({
  authorize,
  sendJson: (res, status, payload) => { res.status = status; res.payload = payload; secureResponses.push({ status, payload }) },
  fetchSemanticContext: async () => ({
    accessPolicy: { roleScoped: true, superUser: false },
    fieldAclAvailable: true,
    permissions: [{ code: 'app:sales_customer' }, { code: 'op:sales_customer.edit' }],
    fieldAcl: { sales_customer: { customer_files: { canView: true, canEdit: true } } }
  }),
  callPostgrestWithUser: async (_user, options) => {
    if (options.method === 'GET') return { data: [{ id: ownedFileId, filename: 'notes.pdf', mime_type: 'application/pdf', size_bytes: 12, content_base64: 'cGRm', extra: { source: 'harness_customer_archive', uploaded_by: 'user-1', tenant_id: 'tenant-1' } }] }
    return { data: [{ id: ownedFileId }] }
  }
})
const readResponse = {}
await secure.handleRead({ url: `/api/eiscore/files/read?id=${ownedFileId}`, headers: {} }, readResponse)
assert.equal(readResponse.status, 200)
assert.equal(readResponse.payload.content_base64, 'cGRm')
const deleteResponse = {}
await secure.handleDelete({ url: `/api/eiscore/files/delete?id=${ownedFileId}`, headers: {} }, deleteResponse)
assert.equal(deleteResponse.status, 200)
assert.equal(deleteResponse.payload.deleted, true)

console.log('PASS: Yayu business file upload route keeps the 20 MiB limit, rejects Flash exposure, and avoids the 4 KiB auth ceiling')
