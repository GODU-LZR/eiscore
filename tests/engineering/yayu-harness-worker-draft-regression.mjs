import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'

const read = (file) => readFileSync(resolve(file), 'utf8')
const bridge = read('eiscore-base/src/utils/ai-bridge.js')
const launcher = read('eiscore-base/src/components/HarnessAssistantLauncher.vue')
const businessUi = read('agent-harness/web-ui/business-ui.js')

assert.match(bridge, /eis-harness-open-worker/)
assert.match(launcher, /event\.origin !== harnessOrigin\(\) \|\| event\.source !== frameRef\.value\?\.contentWindow/)
assert.match(launcher, /ElMessageBox\.confirm/)
assert.match(launcher, /message\.hasExistingDraft === true/)
assert.match(businessUi, /\[data-composer-input\]\[contenteditable="true"\]/)
assert.match(businessUi, /new ClipboardEvent\('paste'/)

const listeners = new Map()
const documentListeners = new Map()
const replies = []
const parentWindow = { postMessage: (message, origin) => replies.push({ message, origin }) }
const editor = {
  isConnected: true,
  innerText: 'Current draft',
  textContent: 'Current draft',
  getClientRects: () => [{}],
  focus() {},
  dispatchEvent(event) {
    this.events ||= []
    this.events.push(event.type)
    const pastedText = event.clipboardData.getData('text/plain')
    this.innerText = pastedText
    this.textContent = pastedText
    return true
  }
}
const body = { dataset: {}, querySelectorAll: () => [] }
const document = {
  currentScript: { src: 'https://app.example/harness-embed/eiscore-ui/business-ui.js' },
  body,
  documentElement: body,
  head: { appendChild() {} },
  createElement: () => ({ setAttribute() {}, appendChild() {}, remove() {} }),
  querySelector: () => null,
  querySelectorAll: (selector) => selector === '[data-composer-input][contenteditable="true"]' ? [editor] : [],
  createRange: () => ({ selectNodeContents() {} }),
  addEventListener: (type, listener) => {
    const entries = documentListeners.get(type) || []
    entries.push(listener)
    documentListeners.set(type, entries)
  }
}
class FakeMutationObserver {
  constructor(callback) { this.callback = callback }
  observe() {}
  disconnect() {}
}
class FakeDataTransfer {
  values = new Map()
  setData(type, value) { this.values.set(type, value) }
  getData(type) { return this.values.get(type) || '' }
}
class FakeClipboardEvent {
  constructor(type, options) { this.type = type; this.clipboardData = options.clipboardData }
}
const window = {
  parent: parentWindow,
  getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
  addEventListener: (type, listener) => {
    const entries = listeners.get(type) || []
    entries.push(listener)
    listeners.set(type, entries)
  }
}
const context = {
  window,
  document,
  location: { href: 'https://app.example/harness-embed/', origin: 'https://app.example' },
  URL,
  MutationObserver: FakeMutationObserver,
  DataTransfer: FakeDataTransfer,
  ClipboardEvent: FakeClipboardEvent,
  requestAnimationFrame: (callback) => callback(),
  setTimeout,
  clearTimeout,
  crypto: { randomUUID: () => 'test-token' }
}

vm.runInNewContext(businessUi, context, { filename: 'business-ui.js' })
const onWorkerMessage = listeners.get('message')[0]
const baseMessage = { source: 'eiscore-host', protocol: 'eiscore-harness-worker-draft', version: 1 }
const sendToHarness = async (data, source = parentWindow, origin = 'https://app.example') =>
  onWorkerMessage({ data, source, origin })

await sendToHarness({ ...baseMessage, type: 'prepare', id: 'forged', prompt: 'ignored' }, parentWindow, 'https://attacker.example')
await sendToHarness({ ...baseMessage, type: 'prepare', id: 'forged-source', prompt: 'ignored' }, {}, 'https://app.example')
assert.equal(replies.length, 0, 'messages from another origin or window must be ignored')

const prompt = '请整理当前销售合同并保留原有字段'
await sendToHarness({ ...baseMessage, type: 'prepare', id: 'cancel-me', prompt })
assert.equal(replies.at(-1).message.type, 'proposal')
assert.equal(replies.at(-1).message.hasExistingDraft, true)
await sendToHarness({ ...baseMessage, type: 'cancel', id: 'cancel-me' })
assert.equal(replies.at(-1).message.type, 'cancelled')
assert.equal(editor.textContent, 'Current draft', 'cancel must preserve the existing draft')

await sendToHarness({ ...baseMessage, type: 'prepare', id: 'apply-me', prompt })
assert.equal(replies.at(-1).message.type, 'proposal')
await sendToHarness({ ...baseMessage, type: 'apply', id: 'apply-me' })
assert.equal(replies.at(-1).message.type, 'applied')
assert.equal(editor.textContent, prompt)
assert.deepEqual(editor.events, ['paste'], 'applying a draft must not activate a send control')

await sendToHarness({ ...baseMessage, type: 'prepare', id: 'conflict', prompt: '新的草稿' })
editor.innerText = '用户刚刚输入的内容'
editor.textContent = editor.innerText
await sendToHarness({ ...baseMessage, type: 'apply', id: 'conflict' })
assert.equal(replies.at(-1).message.reason, 'draft-changed')
assert.equal(editor.textContent, '用户刚刚输入的内容', 'late user edits must not be overwritten')

const droppedFile = { name: '报价单.xlsx', size: 2048, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
let prevented = false
let stopped = false
const dropEvent = {
  dataTransfer: { types: ['Files'], files: [droppedFile] },
  preventDefault() { prevented = true },
  stopPropagation() { stopped = true }
}
documentListeners.get('drop')[0](dropEvent)
assert.equal(prevented, true)
assert.equal(stopped, true)
assert.equal(replies.at(-1).message.protocol, 'eiscore-harness-file-drop')
assert.equal(replies.at(-1).message.type, 'received')
assert.equal(replies.at(-1).message.files[0], droppedFile, 'the plugin forwards the original file without Base64 conversion')
assert.equal(replies.at(-1).origin, 'https://app.example')

console.log('PASS: Yayu Harness worker draft and file drop require trusted origin; files stay binary and drafts paste without sending')
