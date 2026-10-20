import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const opened = []
class EventSource {
  static OPEN = 1
  constructor(url, options) { opened.push({ url, options }) }
}
const requests = []
const styles = []
const document = { createElement: (tag) => { assert.equal(tag, 'style'); return {} }, head: { append: (style) => styles.push(style) } }
const window = { EventSource, fetch: (...args) => requests.push(args) }
const location = { href: 'https://example.test/harness-flash-embed/?eiscoreAppId=app&eiscoreSessionId=flash-app', origin: 'https://example.test', search: '?eiscoreAppId=app&eiscoreSessionId=flash-app' }
vm.runInNewContext(readFileSync(new URL('./flash-ui.js', import.meta.url), 'utf8'), { document, window, location, addEventListener() {}, URL, URLSearchParams, Request, Headers })
assert.equal(styles.length, 1)
assert.match(styles[0].textContent, /\[data-composer-card\] button\[aria-haspopup="listbox"\]\[aria-label="指令"\]/)
assert.match(styles[0].textContent, /\[aria-label="Commands"\]/)
assert.match(styles[0].textContent, /display: none !important/)

const events = new window.EventSource('/plugins/events', { withCredentials: true })
assert.ok(events instanceof EventSource)
assert.equal(window.EventSource.OPEN, EventSource.OPEN)
assert.deepEqual(opened[0], { url: 'https://example.test/harness-flash-embed-plugins/events', options: { withCredentials: true } })
new window.EventSource('https://outside.test/plugins/events')
assert.equal(opened[1].url, 'https://outside.test/plugins/events')
new window.EventSource('/another/events?after=1')
assert.equal(opened[2].url, 'https://example.test/another/events?after=1')
window.fetch('/harness-flash-embed-api/session/prompt', { headers: { 'content-type': 'application/json' } })
assert.equal(requests[0][1].headers.get('x-eis-flash-app-id'), 'app')
assert.equal(requests[0][1].headers.get('x-eis-flash-session-id'), 'flash-app')
assert.equal(requests[0][1].headers.get('content-type'), 'application/json')
console.log('PASS: Flash events use the authenticated same-origin endpoint without credential URLs; native EventSource and request context remain intact')
