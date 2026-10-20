import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { respondToDisabledCommandList } from './dsh-web-runner.mjs'

const envelope = { type: 'client-request', rpcId: 'rpc-qa-command-list', method: 'commands/list', payload: { args: { agentId: 'qa-session' } } }
const call = async ({ method = 'POST', url = '/api/commands/list', body = envelope, authenticated = true, setCookies = [] } = {}) => {
  const request = Readable.from([Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))])
  Object.assign(request, { method, url })
  const response = { writeHead(status, headers) { this.status = status; this.headers = headers; return this }, end(body) { this.body = JSON.parse(body) } }
  const handled = await respondToDisabledCommandList(request, response, { authenticated, setCookies })
  return { handled, ...response }
}
const normal = await call({ setCookies: ['flash-dsh-auth-qa=opaque; HttpOnly; SameSite=Strict'] })
assert.equal(normal.status, 200)
assert.deepEqual(normal.body, { type: 'server-response', rpcId: envelope.rpcId, result: { ok: true, value: [] } })
assert.equal(normal.headers['cache-control'], 'no-store')
assert.deepEqual(normal.headers['set-cookie'], ['flash-dsh-auth-qa=opaque; HttpOnly; SameSite=Strict'])
assert.equal((await call({ authenticated: false })).status, 401)
assert.equal((await call({ body: { ...envelope, rpcId: '' } })).status, 400)
assert.equal((await call({ body: { ...envelope, method: 'commands/execute' } })).status, 400)
assert.equal((await call({ body: '{' })).status, 400)
assert.equal((await call({ body: 'x'.repeat(4097) })).status, 413)
assert.equal((await call({ method: 'GET' })).handled, false)
assert.equal((await call({ url: '/api/commands/execute' })).handled, false)
assert.equal((await call({ url: '/api/session/prompt' })).handled, false)
assert.equal((await call({ url: '/api/commands/list/extra' })).handled, false)
console.log('PASS: authenticated empty native command RPC, correlation ID, cookies, anonymous denial, malformed and oversized inputs; execution and other routes untouched')
