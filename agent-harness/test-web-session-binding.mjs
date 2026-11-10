import assert from 'node:assert/strict'
import http from 'node:http'
import { Readable } from 'node:stream'
import { createBusinessSessionProxy } from './web-session-proxy.mjs'

const appId = '12345678-1234-1234-1234-123456789abc'
const flashSessionId = `flash-${appId}`
const dshSessionId = 'dsh-session-one'
let contextStatus = 200
const sequence = []
const upstream = http.createServer(async (req, res) => {
  for await (const part of req) void part
  sequence.push(req.url)
  if (req.url.endsWith('/context')) res.writeHead(contextStatus, { 'content-type': 'application/json' })
  else if (req.url.endsWith('/session/create')) res.writeHead(200, { 'content-type': 'application/json' })
  else res.writeHead(200, { 'content-type': 'application/json' })
  res.end(req.url.endsWith('/session/create') ? JSON.stringify({ result: { ok: true, value: { sessionId: dshSessionId } } }) : JSON.stringify({ ok: true }))
})
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))

const request = (path, payload) => {
  const stream = Readable.from([Buffer.from(JSON.stringify(payload))])
  Object.assign(stream, { method: 'POST', url: path, headers: {
    'x-eis-flash-app-id': appId,
    'x-eis-flash-session-id': flashSessionId,
    cookie: 'eiscore-session=flash-user'
  } })
  return stream
}
const response = () => ({
  status: 0,
  headersSent: false,
  writeHead(status) { this.status = status; this.headersSent = true; return this },
  end(body) { this.body = body; return this },
  destroy() { throw new Error('unexpected destroy') }
})
const payload = (requestPayload) => ({ type: 'client-request', payload: { args: { request: requestPayload } } })
try {
  const proxy = createBusinessSessionProxy({
    port: upstream.address().port,
    withToken: (path) => path,
    mapCookies: (value) => value,
    requireFlashContext: true,
    forward: () => { throw new Error('forward should only run after binding') }
  })
  const createResponse = response()
  await proxy(request('/api/session/create', payload({})), createResponse, request.headers)
  assert.equal(createResponse.status, 200)
  assert.deepEqual(sequence, ['/api/session/create', '/api/eiscore/flash/context'])
  sequence.length = 0

  contextStatus = 403
  const promptResponse = response()
  await proxy(request('/api/session/prompt', payload({ sessionId: dshSessionId })), promptResponse, request.headers)
  assert.equal(promptResponse.status, 403)
  assert.deepEqual(sequence, ['/api/eiscore/flash/context'])
  sequence.length = 0

  contextStatus = 200
  const promptOk = response()
  await proxy(request('/api/session/prompt', payload({ sessionId: dshSessionId })), promptOk, request.headers)
  assert.equal(promptOk.status, 200)
  assert.deepEqual(sequence, ['/api/eiscore/flash/context', '/api/session/prompt'])
  console.log('PASS: Flash session create/prompt bind app context before forwarding and short-circuit registration failures')
} finally {
  await new Promise((resolve) => upstream.close(resolve))
}
