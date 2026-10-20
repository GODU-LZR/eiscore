import assert from 'node:assert/strict'
import http from 'node:http'
import { Readable } from 'node:stream'
import { readFileSync } from 'node:fs'
import { bindFlashContext } from './flash-context-plugin.mjs'
import { mapAuthCookiesToUpstream, mapAuthSetCookiesToBrowser, shouldBootstrapDshAuth } from './dsh-web-runner.mjs'
import { createBusinessSessionProxy } from './web-session-proxy.mjs'

const flashPatch = readFileSync(new URL('./dsh-flash-web.patch.yml', import.meta.url), 'utf8')
for (const id of ['commands', 'command-compact', 'command-feedback', 'command-goal']) {
  assert.match(flashPatch, new RegExp(`(?:^|\\n)- id: ${id}\\r?\\n  disabled: true(?:\\r?\\n|$)`), `Flash must keep ${id} disabled`)
}
assert.doesNotMatch(flashPatch, /(?:^|\n)- id: ui-commands\r?\n  disabled: true/, 'Keep commandUi service available to model and permission selectors')

const cookies = mapAuthCookiesToUpstream('eiscore-session=business; dsh-auth-localhost=business-dsh; flash-eiscore-session=flash-user; flash-dsh-auth-localhost=flash-dsh', 'flash-')
assert.equal(cookies, 'eiscore-session=flash-user; dsh-auth-localhost=flash-dsh')
assert.deepEqual(mapAuthSetCookiesToBrowser(['eiscore-session=x; Path=/', 'dsh-auth-localhost=y; Path=/'], 'flash-'), ['flash-eiscore-session=x; Path=/', 'flash-dsh-auth-localhost=y; Path=/'])
assert.equal(shouldBootstrapDshAuth({ method: 'POST', headers: { cookie: mapAuthCookiesToUpstream('dsh-auth-localhost=business', 'flash-') } }), true)

const appId = '12345678-1234-1234-1234-123456789abc'
const sessionId = `flash-${appId}`
const dshSessionId = 'dsh-session-one'
let currentToken = 'test-user-token'
let ownerToken = currentToken
let registrationStatus = 200
let registrations = 0
const contexts = globalThis[Symbol.for('eiscore.dsh.flash-context')]
globalThis[Symbol.for('eiscore.dsh.auth-bridge')] = { token: () => currentToken, toolToken: () => ownerToken }
process.env.EISCORE_GATEWAY_URL = 'http://flash-agent:8078'
process.env.EISCORE_HARNESS_CAPABILITY_PROFILE = 'flash'
process.env.EISCORE_FLASH_REQUIRE_WEB_CONTEXT = 'true'
process.env.EISCORE_TOOL_PROXY_URL = 'http://flash-agent:8078/internal/harness/tool'
process.env.EISCORE_TOOL_PROXY_SECRET = 'test-flash-service-secret-at-least-32-characters'
globalThis.fetch = async (url, options) => {
  registrations += 1
  assert.equal(String(url), 'http://flash-agent:8078/internal/harness/session')
  assert.deepEqual(JSON.parse(options.body), { app_id: appId, session_id: sessionId })
  assert.equal(options.headers.authorization, `Bearer ${currentToken}`)
  return Response.json({ ok: registrationStatus === 200 }, { status: registrationStatus })
}
const bind = (extra = {}) => bindFlashContext(new Request('http://dsh.internal/api/eiscore/flash/context', { method: 'POST', body: JSON.stringify({ appId, sessionId, dshSessionId, ...extra }) }))
assert.equal((await bind({ sessionId: 'another-session' })).status, 400)
ownerToken = 'another-owner'
assert.equal((await bind()).status, 403)
assert.equal(registrations, 0)
ownerToken = currentToken
assert.equal((await bind()).status, 200)
assert.equal(contexts.get(dshSessionId).sessionId, sessionId)
const otherApp = '22345678-1234-1234-1234-123456789abc'
assert.equal((await bind({ appId: otherApp, sessionId: `flash-${otherApp}` })).status, 403)
assert.equal(contexts.get(dshSessionId).expiresAt, 0)
assert.equal((await bind()).status, 200)
registrationStatus = 403
assert.equal((await bind()).status, 403)
assert.equal(contexts.get(dshSessionId).expiresAt, 0)
registrationStatus = 200
assert.equal((await bind()).status, 200)

const tools = []
const runtime = await import('./eiscore-tools.mjs')
runtime.apply({ tools: { register: (tool) => tools.push(tool) } })
assert.deepEqual(tools.map((tool) => tool.name), ['eiscore_flash_read', 'eiscore_flash_write'])
let toolCalls = 0
globalThis.fetch = async (url, options) => {
  toolCalls += 1
  assert.equal(String(url), process.env.EISCORE_TOOL_PROXY_URL)
  assert.equal(JSON.parse(options.body).session_id, sessionId)
  return Response.json({ data: { ok: true } })
}
const exec = { agent: { session: { id: dshSessionId } } }
await tools[0].execute({ tool_id: 'flash.draft.read' }, exec)
assert.equal(toolCalls, 1)
ownerToken = ''
await assert.rejects(tools[1].execute({ tool_id: 'flash.draft.write' }, exec), /authenticated Flash app session/)
assert.equal(toolCalls, 1)
ownerToken = 'new-login-token'
await assert.rejects(tools[0].execute({ tool_id: 'flash.draft.read' }, exec), /authenticated Flash app session/)
assert.equal(toolCalls, 1)

let contextStatus = 403
let sequence = []
const upstream = http.createServer(async (req, res) => {
  for await (const part of req) void part
  sequence.push(req.url)
  res.writeHead(req.url.endsWith('/context') ? contextStatus : 200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ ok: true }))
})
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
try {
  const proxy = createBusinessSessionProxy({ port: upstream.address().port, withToken: (path) => path, mapCookies: (value) => value, forward: () => assert.fail('Prompt must pass through binding checks') })
  const prompt = async () => {
    const request = Readable.from([Buffer.from(JSON.stringify({ type: 'client-request', payload: { args: { request: { sessionId: dshSessionId } } } }))])
    Object.assign(request, { method: 'POST', url: '/api/session/prompt', headers: { 'x-eis-flash-app-id': appId, 'x-eis-flash-session-id': sessionId } })
    const result = { writeHead(status) { this.status = status; return this }, end() {}, destroy() { assert.fail('Unexpected proxy stream failure') } }
    await proxy(request, result)
    return result.status
  }
  assert.equal(await prompt(), 403)
  assert.deepEqual(sequence, ['/api/eiscore/auth/bind-session', '/api/eiscore/flash/context'])
  contextStatus = 200
  sequence = []
  assert.equal(await prompt(), 200)
  assert.deepEqual(sequence, ['/api/eiscore/auth/bind-session', '/api/eiscore/flash/context', '/api/session/prompt'])
} finally { await new Promise((resolve) => upstream.close(resolve)) }
console.log('PASS: isolated cookies, app ownership, registration failure, logout and relogin guards, Flash-only tools, bind-before-prompt and rejection short-circuit')
