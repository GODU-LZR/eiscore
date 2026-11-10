import assert from 'node:assert/strict'
import { bindFlashContext, contexts, installToolTokenBridge } from './flash-context-plugin.mjs'

const appId = '12345678-1234-1234-1234-123456789abc'
const otherAppId = '22345678-1234-1234-1234-123456789abc'
const dshSessionId = 'dsh-session-one'
const sessionId = `flash-${appId}`
const token = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIiwidGVuYW50X2lkIjoidGVuYW50In0.signature'
let currentToken = token
let registrationStatus = 200
let registrations = 0

process.env.FLASH_GATEWAY_ORIGIN = 'http://flash-agent-runtime:8078'
globalThis[Symbol.for('eiscore.dsh.auth-bridge')] = {
  token: () => currentToken
}
installToolTokenBridge()
globalThis.fetch = async (url, options) => {
  registrations += 1
  assert.equal(String(url), 'http://flash-agent-runtime:8078/internal/harness/session')
  assert.deepEqual(JSON.parse(options.body), { app_id: appId, session_id: sessionId })
  assert.equal(options.headers.authorization, `Bearer ${token}`)
  return Response.json({ ok: registrationStatus === 200 }, { status: registrationStatus })
}

const bind = (payload) => bindFlashContext(new Request('http://dsh.internal/api/eiscore/flash/context', {
  method: 'POST',
  body: JSON.stringify({ appId, sessionId, dshSessionId, ...payload })
}))

assert.equal((await bind({ sessionId: 'wrong' })).status, 400)
assert.equal(registrations, 0)
currentToken = token
assert.equal((await bind({})).status, 200)
assert.equal(contexts.get(dshSessionId).appId, appId)
assert.equal(globalThis[Symbol.for('eiscore.dsh.auth-bridge')].toolToken(dshSessionId), token)
currentToken = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJvdGhlciIsInRlbmFudF9pZCI6InRlbmFudCJ9.signature'
assert.equal((await bind({})).status, 403)
assert.equal(contexts.get(dshSessionId).expiresAt, 0)
currentToken = token
assert.equal((await bind({})).status, 200)
assert.equal((await bind({ appId: otherAppId, sessionId: `flash-${otherAppId}` })).status, 403)
assert.equal(contexts.get(dshSessionId).expiresAt, 0)
assert.equal((await bind({})).status, 200)
registrationStatus = 403
assert.equal((await bind({})).status, 403)
assert.equal(contexts.get(dshSessionId).expiresAt, 0)
registrationStatus = 200
assert.equal((await bind({})).status, 200)
currentToken = ''
assert.equal(globalThis[Symbol.for('eiscore.dsh.auth-bridge')].toolToken(dshSessionId), '')
assert.equal(contexts.has(dshSessionId), false)
console.log('PASS: Flash context validates app/session ownership, isolates the runtime gateway, fails closed on registration and invalidates logout bindings')
