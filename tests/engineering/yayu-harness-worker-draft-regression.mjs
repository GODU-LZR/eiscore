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
const mutationObservers = []
const dropCopyNodes = [
  { nodeType: 3, nodeValue: 'Drag images here to add them' },
  { nodeType: 3, nodeValue: 'Up to 20 images' },
  { nodeType: 3, nodeValue: '20MB each' },
  { nodeType: 3, nodeValue: '图片拖动到此处即可添加' },
  { nodeType: 3, nodeValue: '最多 20 张' },
  { nodeType: 3, nodeValue: '每张 20MB' },
  { nodeType: 3, nodeValue: '请把图片拖拽在上面' }
]
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
let dropOverlayRemoved = false
let nativeDropResetCount = 0
const dropOverlay = { textContent: 'Drag files here to add themUp to 20 files20MB per file', remove() { dropOverlayRemoved = true } }
const document = {
  currentScript: { src: 'https://app.example/harness-embed/eiscore-ui/business-ui.js' },
  body,
  documentElement: body,
  head: { appendChild() {} },
  createElement: () => ({ setAttribute() {}, appendChild() {}, remove() {} }),
  createTreeWalker: (root, whatToShow) => {
    assert.equal(whatToShow, 4, 'drop copy rewriting must walk text nodes only')
    let index = 0
    return { nextNode: () => dropCopyNodes[index++] || null }
  },
  querySelector: () => null,
  querySelectorAll: (selector) => {
    if (selector === '[data-composer-input][contenteditable="true"]') return [editor]
    if (selector === '[role="status"]') return [dropOverlay]
    return []
  },
  createRange: () => ({ selectNodeContents() {} }),
  addEventListener: (type, listener) => {
    const entries = documentListeners.get(type) || []
    entries.push(listener)
    documentListeners.set(type, entries)
  }
}
class FakeMutationObserver {
  constructor(callback) { this.callback = callback; mutationObservers.push(this) }
  observe(target, options) { this.options = options }
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
class FakeEvent {
  constructor(type) { this.type = type }
}
const window = {
  parent: parentWindow,
  getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
  dispatchEvent: (event) => { if (event.type === 'dragend') nativeDropResetCount++ },
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
  Event: FakeEvent,
  requestAnimationFrame: (callback) => callback(),
  setTimeout,
  clearTimeout,
  crypto: { randomUUID: () => 'test-token' }
}

vm.runInNewContext(businessUi, context, { filename: 'business-ui.js' })
assert.deepEqual(dropCopyNodes.map((node) => node.nodeValue), [
  'Drag files here to add them', 'Up to 20 files', '20MB per file',
  '文件拖动到此处即可添加', '最多20个文件', '每个文件20MB', '请把文件拖拽在上面'
])
assert.equal(mutationObservers[1].options.characterData, true, 'Harness text updates must be normalized after initial render too')
const dynamicDropCopy = { nodeType: 3, nodeValue: '请把图片拖拽在上面' }
mutationObservers[1].callback([{ type: 'childList', addedNodes: [dynamicDropCopy] }])
dropCopyNodes.push(dynamicDropCopy)
assert.equal(dropCopyNodes.at(-1).nodeValue, '请把文件拖拽在上面')
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
let stoppedImmediately = false
const dragEvent = {
  dataTransfer: { types: ['Files'], dropEffect: '' },
  preventDefault() { prevented = true },
  stopPropagation() { stopped = true },
  stopImmediatePropagation() { stoppedImmediately = true }
}
documentListeners.get('dragover')[0](dragEvent)
assert.equal(body.dataset.eiscoreFileDrop, 'active')
documentListeners.get('dragenter')[0](dragEvent)
assert.equal(body.dataset.eiscoreFileDrop, 'active', 'dragenter must claim file drops before the image-only Harness handler')
const dropEvent = {
  dataTransfer: { types: ['Files'], files: [droppedFile] },
  preventDefault() { prevented = true },
  stopPropagation() { stopped = true },
  stopImmediatePropagation() { stoppedImmediately = true }
}
documentListeners.get('drop')[0](dropEvent)
assert.equal(prevented, true)
assert.equal(stopped, true, 'the host must claim file drops before the image-only Harness handler')
assert.equal(stoppedImmediately, true, 'the host must stop same-target image-only handlers')
assert.equal(dropOverlayRemoved, true, 'the drop clears the native image-only overlay before upload completes')
assert.equal(nativeDropResetCount, 1, 'the drop resets DeepSeek native drag state after blocking its drop listener')
assert.equal(body.dataset.eiscoreFileDrop, undefined, 'the plugin drop state must clear when the file is received')
assert.equal(replies.at(-1).message.protocol, 'eiscore-harness-file-drop')
assert.equal(replies.at(-1).message.type, 'received')
assert.equal(replies.at(-1).message.files[0], droppedFile, 'the plugin forwards the original file without Base64 conversion')
assert.equal(replies.at(-1).origin, 'https://app.example')
await listeners.get('message')[1]({
  origin: 'https://app.example',
  source: parentWindow,
  data: { source: 'eiscore-host', protocol: 'eiscore-harness-file-drop', version: 1, type: 'uploaded', files: [{ id: 'test-file', name: droppedFile.name }] }
})
assert.equal(dropOverlayRemoved, true, 'the host upload response clears the native image-only overlay')
assert.equal(nativeDropResetCount, 2, 'upload success keeps DeepSeek native drag state reset')
dropOverlayRemoved = false
await listeners.get('message')[1]({
  origin: 'https://app.example',
  source: parentWindow,
  data: { source: 'eiscore-host', protocol: 'eiscore-harness-file-drop', version: 1, type: 'error', errors: ['文件格式不支持'] }
})
assert.equal(dropOverlayRemoved, true, 'an upload error response also clears the native image-only overlay')
assert.equal(nativeDropResetCount, 3, 'upload errors keep DeepSeek native drag state reset')

console.log('PASS: Yayu Harness worker draft and file drop require trusted origin; files stay binary and drafts paste without sending')
