import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const appId = '12345678-1234-1234-1234-123456789abc'
const nextApp = '22345678-1234-1234-1234-123456789abc'
const opened = []
class EventSource {
  static OPEN = 1
  constructor(url, options) { opened.push({ url, options }) }
}
const requests = []
const styles = []
const messages = []
const listeners = new Map()
const parent = { postMessage: (...args) => messages.push(args) }
const result = Promise.resolve(new Response('ok'))
const document = { createElement: tag => { assert.equal(tag, 'style'); return {} }, head: { append: style => styles.push(style) } }
const window = { EventSource, fetch: (...args) => { requests.push(args); return result } }
const location = new URL(`https://example.test/harness-flash-embed/?eiscoreAppId=${appId}&eiscoreSessionId=flash-${appId}`)
vm.runInNewContext(readFileSync(new URL('./flash-ui.js', import.meta.url), 'utf8'), {
  document, window, location, parent, addEventListener: (type, handler) => listeners.set(type, handler), URL, URLSearchParams, Request, Headers
})
assert.match(styles[0].textContent, /\[aria-label="Commands"\]/)
assert.match(styles[0].textContent, /\[aria-label="指令"\]/)
assert.equal(messages[0][1], location.origin)
assert.equal(messages[0][0].type, 'flash:harness:ready')
assert.equal(messages[0][0].appId, appId)
new window.EventSource('/plugins/events?after=1', { withCredentials: true })
assert.equal(window.EventSource.OPEN, EventSource.OPEN)
assert.deepEqual(opened[0], { url: 'https://example.test/harness-flash-embed-plugins/events?after=1', options: { withCredentials: true } })
new window.EventSource('https://outside.test/plugins/events')
assert.equal(opened[1].url, 'https://outside.test/plugins/events')

for (const input of ['/api/session/create?source=flash', new URL('/harness-flash-embed-api/session/prompt', location), new Request(new URL('/api/session/prompt', location), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })]) {
  const promise = window.fetch(input)
  assert.equal(promise, result, 'The browser returns the server response promise without a detached binding fetch')
  const [actualInput, init] = requests.at(-1)
  if (input instanceof Request) {
    assert.equal(actualInput.url, `${location.origin}/harness-flash-embed-api/session/prompt`)
    assert.equal(await actualInput.clone().text(), '{}', 'Request routing preserves the prompt body')
  } else assert.equal(actualInput, input)
  assert.equal(init.headers.get('x-eis-flash-app-id'), appId)
  assert.equal(init.headers.get('x-eis-flash-session-id'), `flash-${appId}`)
  if (input instanceof Request) assert.equal(init.headers.get('content-type'), 'application/json')
}
assert.equal(requests.length, 3, 'Each session operation issues exactly one request')
const contextMessage = { source: 'eiscore-flash-builder', type: 'flash:context', appId: nextApp, sessionId: `flash-${nextApp}` }
for (const event of [
  { source: {}, origin: location.origin, data: contextMessage },
  { source: parent, origin: 'https://outside.test', data: contextMessage },
  { source: parent, origin: location.origin, data: { ...contextMessage, source: 'another-source' } }
]) {
  listeners.get('message')(event)
  window.fetch('/api/session/prompt')
  assert.equal(requests.at(-1)[1].headers.get('x-eis-flash-app-id'), appId)
}
listeners.get('message')({ source: parent, origin: location.origin, data: contextMessage })
window.fetch('/harness-flash-embed-api/session/prompt', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(1000) })
assert.equal(requests.at(-1)[1].headers.get('x-eis-flash-app-id'), nextApp)
assert.equal(requests.at(-1)[1].headers.get('x-eis-flash-session-id'), `flash-${nextApp}`)
assert.equal(requests.at(-1)[1].headers.get('accept'), 'application/json')
for (const input of ['https://outside.test/api/session/prompt', '/api/session/list', '/api/eiscore/flash/context']) {
  window.fetch(input)
  assert.equal(requests.at(-1)[1], undefined, 'Flash context is attached only to same-origin session create/prompt')
}
console.log('PASS: Flash query/parent context, same-origin session headers, no detached binding requests, native Request and EventSource behavior')
