import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../../agent-harness/web-ui/business-ui.js', import.meta.url), 'utf8')
const protocol = source.slice(source.indexOf('  const installWorkerDraft = '), source.indexOf('  const MAX_SOURCE'))
assert(protocol.includes('installWorkerDraft()'))

const createFixture = ({ standalone = false, ready = true, initial = '', pasteMode = 'immediate' } = {}) => {
  const listeners = {}, documentListeners = {}, timers = new Map(), results = [], elements = []
  let sequence = 0, pasteCount = 0
  const schedule = (callback) => { const id = ++sequence; timers.set(id, callback); return id }
  const parent = { postMessage: (message, origin) => results.push({ ...message, origin }) }
  const input = {
    innerText: initial, getAttribute: () => null, getClientRects: () => [1], focus() {},
    dispatchEvent(event) {
      assert.equal(event.type, 'paste')
      assert.equal(event.bubbles, true)
      assert.equal(event.cancelable, true)
      pasteCount++
      const adopt = () => { this.innerText = event.clipboardData.getData('text/plain') }
      if (pasteMode === 'microtask') Promise.resolve().then(adopt)
      else if (pasteMode === 'task') schedule(adopt)
      else if (pasteMode !== 'reject') adopt()
    }
  }
  const window = { parent, addEventListener: (type, callback) => { listeners[type] = callback },
    getSelection: () => ({ removeAllRanges() {}, addRange() {} }) }
  if (standalone) window.parent = window
  const document = {
    body: { appendChild: (element) => { elements.push(element) } },
    querySelectorAll: (selector) => {
      assert.equal(selector, '[data-composer-input][contenteditable="true"]')
      return ready ? [input] : []
    },
    createRange: () => ({ selectNodeContents: (element) => assert.equal(element, input) }),
    dispatchEvent: (event) => assert.equal(event.type, 'selectionchange'),
    addEventListener: (type, callback) => { documentListeners[type] = callback },
    createElement: (tag) => ({ tag, children: [], events: {}, removed: false, setAttribute() {},
      append(...children) { this.children.push(...children) },
      addEventListener(type, callback) { this.events[type] = callback },
      remove() { this.removed = true }
    })
  }
  runInNewContext(protocol, {
    window, document, location: { origin: 'https://eiscore.test' },
    Event: class { constructor(type) { this.type = type } },
    ClipboardEvent: class { constructor(type, options) { Object.assign(this, { type }, options) } },
    DataTransfer: class { values = {}; setData(type, value) { this.values[type] = value } getData(type) { return this.values[type] } },
    setTimeout: schedule,
    clearTimeout: (id) => timers.delete(id)
  })
  return {
    input, results, timers, listeners, documentListeners,
    get pasteCount() { return pasteCount },
    setReady: (value) => { ready = value },
    receive: (data, overrides = {}) => listeners.message?.({ data, source: parent, origin: 'https://eiscore.test', ...overrides }),
    tick: async () => { const [id, callback] = timers.entries().next().value || []; if (callback) { timers.delete(id); callback() }; await Promise.resolve() },
    notice: () => elements.findLast((element) => !element.removed),
    accept: () => elements.findLast((element) => !element.removed).children[1].events.click()
  }
}
const command = (id = 'worker-1', prompt = '请整理当前表格') => ({ type: 'eiscore:harness-draft', version: 1, id, prompt })

const empty = createFixture()
empty.receive(command())
assert.equal(empty.input.innerText, '请整理当前表格')
assert.equal(empty.pasteCount, 1)
assert.equal(empty.results.at(-1).status, 'queued', 'paste is confirmed only after its bounded adoption turn')
await empty.tick()
assert.deepEqual(empty.results.map(({ status }) => status), ['queued', 'applied'])
assert(empty.results.every(({ origin }) => origin === 'https://eiscore.test'))
assert(empty.results.every((result) => Object.keys(result).sort().join() === 'id,origin,status,type,version'))
empty.receive(command('worker-1', '不得重复覆盖'))
assert.equal(empty.pasteCount, 1)
assert.equal(empty.input.innerText, '请整理当前表格')

const occupied = createFixture({ initial: '用户尚未发送的草稿' })
occupied.receive(command())
assert.equal(occupied.input.innerText, '用户尚未发送的草稿')
assert.equal(occupied.pasteCount, 0)
assert.equal(occupied.notice().children[1].textContent, '替换当前草稿')
occupied.input.innerText = ''
occupied.receive(command())
assert.equal(occupied.pasteCount, 0, 'replayed command never replaces a later draft without consent')
occupied.accept()
assert.equal(occupied.input.innerText, '请整理当前表格')
await occupied.tick()
assert.equal(occupied.results.at(-1).status, 'applied')

const delayed = createFixture({ ready: false })
delayed.receive(command())
assert.equal(delayed.results.at(-1).status, 'queued')
delayed.setReady(true)
await delayed.tick()
await delayed.tick()
assert.equal(delayed.input.innerText, '请整理当前表格')
assert.equal(delayed.timers.size, 0)

const unavailable = createFixture({ ready: false })
unavailable.receive(command())
for (let i = 0; i < 70; i++) await unavailable.tick()
assert.equal(unavailable.timers.size, 0, 'missing composer has a bounded retry window')
assert(unavailable.notice())
unavailable.setReady(true)
unavailable.accept()
await unavailable.tick()
assert.equal(unavailable.results.at(-1).status, 'applied')

const composing = createFixture()
composing.documentListeners.compositionstart()
composing.receive(command())
assert.equal(composing.pasteCount, 0, 'host draft must not interrupt IME composition')
composing.documentListeners.compositionend()
await composing.tick()
await composing.tick()
assert.equal(composing.pasteCount, 1)

const multiple = createFixture({ initial: 'keep me' })
multiple.receive(command('one', '第一条'))
multiple.receive(command('two', '第二条'))
multiple.accept()
assert.equal(multiple.input.innerText, '第一条')
await multiple.tick()
assert.equal(multiple.notice().children[1].textContent, '替换当前草稿')
multiple.accept()
await multiple.tick()
assert.equal(multiple.input.innerText, '第二条')
assert.equal(multiple.pasteCount, 2)

const saturated = createFixture({ initial: '保留用户草稿' })
for (let i = 0; i < 8; i++) saturated.receive(command(`pending-${i}`, `指令${i}`))
assert.equal(saturated.results.length, 8, 'eight pending commands are accepted')
saturated.receive(command('pending-8', '第九条'))
assert.equal(saturated.results.length, 8, 'a ninth command is not ACKed or retained')
saturated.receive(command('pending-0', '不得重复排队'))
assert.equal(saturated.results.at(-1).status, 'queued', 'pending IDs retain their deduplication entry')
saturated.accept()
await saturated.tick()
const beforeRetry = saturated.results.length
saturated.receive(command('pending-8', '第九条'))
assert.equal(saturated.results.length, beforeRetry + 1, 'the rejected command can be retried after a slot opens')
assert.equal(saturated.results.at(-1).id, 'pending-8')
for (let i = 1; i <= 8; i++) { saturated.accept(); await saturated.tick() }
assert.equal(saturated.pasteCount, 9, 'each accepted command is applied exactly once')
assert.equal(saturated.input.innerText, '第九条')

const history = createFixture()
for (let i = 0; i < 256; i++) {
  history.input.innerText = ''
  history.receive(command(`history-${i}`, `历史${i}`))
  await history.tick()
}
const atCapacity = history.pasteCount
history.receive(command('history-0', '不得重放'))
assert.equal(history.pasteCount, atCapacity, 'all 256 retained IDs are deduplicated')
history.input.innerText = ''
history.receive(command('history-256', '第257条'))
await history.tick()
history.receive(command('history-255', '近期历史仍应保留'))
assert.equal(history.pasteCount, atCapacity + 1, 'the newest applied IDs remain in bounded history')
history.input.innerText = ''
history.receive(command('history-0', '已过历史保留窗口'))
await history.tick()
assert.equal(history.pasteCount, atCapacity + 2, 'the oldest applied ID is evicted after 256 retained IDs')

for (const pasteMode of ['microtask', 'task']) {
  const asynchronous = createFixture({ initial: '已有草稿', pasteMode })
  asynchronous.receive(command('async', '异步采用的新草稿'))
  asynchronous.accept()
  asynchronous.accept()
  asynchronous.receive(command('async', '重放不得再次paste'))
  assert.equal(asynchronous.pasteCount, 1, `${pasteMode}: repeated clicks and replay cannot duplicate a pending paste`)
  assert.equal(asynchronous.input.innerText, '已有草稿')
  assert.equal(asynchronous.results.at(-1).status, 'queued', `${pasteMode}: no premature applied acknowledgement`)
  await asynchronous.tick()
  await asynchronous.tick()
  assert.equal(asynchronous.input.innerText, '异步采用的新草稿')
  assert.equal(asynchronous.results.at(-1).status, 'applied', `${pasteMode}: adoption succeeds after a single bounded confirmation turn`)
  assert.equal(asynchronous.timers.size, 0)
}
const rejectedPaste = createFixture({ pasteMode: 'reject' })
rejectedPaste.receive(command('reject', '不能采用'))
await rejectedPaste.tick()
assert.equal(rejectedPaste.results.at(-1).status, 'queued', 'unadopted text must not be acknowledged as applied')
assert.equal(rejectedPaste.pasteCount, 1)
assert.equal(rejectedPaste.timers.size, 0, 'confirmation failure does not loop or repeat paste')

const invalid = createFixture()
for (const data of [null, [], {}, command('', 'x'), command('x'.repeat(129)), command('x', ''), command('x', 'x'.repeat(12001)),
  { ...command(), version: 2 }, { ...command(), token: 'not-accepted' }, { ...command(), context: {} },
  { ...command(), autoSend: true }, { ...command(), type: 'eis-visual-ready' }]) invalid.receive(data)
invalid.receive(command(), { source: {} })
invalid.receive(command(), { origin: 'https://untrusted.test' })
assert.equal(invalid.results.length, 0)
assert.equal(invalid.pasteCount, 0)
const standalone = createFixture({ standalone: true })
assert.equal(standalone.listeners.message, undefined, 'standalone native UI does not receive host draft commands')
unavailable.listeners.pagehide()
assert.equal(unavailable.timers.size, 0)

console.log('PASS: same-parent bounded draft protocol, native paste, preserved drafts, explicit replacement, replay and IME guards; no automatic submit')
