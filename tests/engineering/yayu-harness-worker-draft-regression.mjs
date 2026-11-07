import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'

const read = (file) => readFileSync(resolve(file), 'utf8')
const bridge = read('eiscore-base/src/utils/ai-bridge.js')
const launcher = read('eiscore-base/src/components/HarnessAssistantLauncher.vue')
const businessFrame = read('eiscore-base/src/components/harness/BusinessHarnessFrame.vue')
const businessUi = read('agent-harness/web-ui/business-ui.js')

assert.match(bridge, /eis-harness-open-worker/)
assert.match(launcher, /event\.origin !== harnessOrigin\(\) \|\| event\.source !== frameRef\.value\?\.contentWindow/)
assert.match(launcher, /ElMessageBox\.confirm/)
assert.match(businessFrame, /AUTH_STATUS_INTERVAL_MS = 30_000/)
assert.match(businessFrame, /prepareBusinessHarnessAuth\(/)
assert.match(businessFrame, /refreshHarnessAuth\(\{ notify: true, force: true \}\)/)
assert.match(businessFrame, /当前消息未自动重发/)
assert.doesNotMatch(businessFrame, /session\/prompt/)
assert.match(businessUi, /AUTH_RECOVERY_COOLDOWN_MS = 30_000/)
assert.match(launcher, /message\.hasExistingDraft === true/)
assert.match(businessUi, /\[data-composer-input\]\[contenteditable="true"\]/)
assert.match(businessUi, /document\.execCommand\('insertText', false, prompt\)/)
assert.match(businessUi, /new ClipboardEvent\('paste'/)
assert.match(businessUi, /const uploadedFiles = new Map\(\)/)
assert.match(businessUi, /preview-request/)
assert.match(businessUi, /delete-request/)
assert.match(businessUi, /从当前草稿移除（不删除原文件）/)
assert.match(businessUi, /永久删除原文件/)

const listeners = new Map()
const documentListeners = new Map()
const replies = []
const mutationObservers = []
const editorListeners = new Map()
const buttonHandlers = []
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
const attachmentParent = {
  children: [],
  querySelector(selector) {
    return selector === '[data-eis-file-attachments]'
      ? this.children.find((node) => node.dataset?.eisFileAttachments === 'true') || null
      : null
  },
  insertBefore(node, reference) {
    node.parentElement = this
    this.children.splice(Math.max(0, this.children.indexOf(reference)), 0, node)
  }
}
const editor = {
  isConnected: true,
  innerText: 'Current draft\n\n我刚上传了客户档案资料文件。请调用 eiscore_customer_file_analyze，分析文件。\n\n文件：C:\\srv\\uploads\\old.docx（application/msword；引用 old-file-id）',
  textContent: 'Current draft\n\n我刚上传了客户档案资料文件。请调用 eiscore_customer_file_analyze，分析文件。\n\n文件：C:\\srv\\uploads\\old.docx（application/msword；引用 old-file-id）',
  parentElement: attachmentParent,
  getClientRects: () => [{}],
  focus() {},
  addEventListener(type, listener) {
    const entries = editorListeners.get(type) || []
    entries.push(listener)
    editorListeners.set(type, entries)
  },
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
const editingCommands = []
const document = {
  currentScript: { src: 'https://app.example/harness-embed/eiscore-ui/business-ui.js' },
  body,
  documentElement: body,
  head: { appendChild() {} },
  createElement: () => {
    const node = {
      dataset: {},
      children: [],
      title: '',
      setAttribute() {},
      append(...nodes) { this.children.push(...nodes) },
      appendChild(node) { this.children.push(node) },
      addEventListener(type, listener) {
        if (type === 'click' && this.title) buttonHandlers.push({ title: this.title, listener })
      },
      remove() {
        if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this)
      }
    }
    Object.defineProperty(node, 'textContent', {
      get() { return this._textContent || '' },
      set(value) {
        this._textContent = String(value ?? '')
        if (!this._textContent) this.children = []
      }
    })
    return node
  },
  createTreeWalker: (root, whatToShow) => {
    assert.equal(whatToShow, 4, 'drop copy rewriting must walk text nodes only')
    let index = 0
    return { nextNode: () => dropCopyNodes[index++] || null }
  },
  execCommand: (command, showUi, value) => {
    editingCommands.push({ command, showUi, value })
    editor.innerText = ''
    editor.textContent = ''
    for (const listener of editorListeners.get('input') || []) listener()
    editor.innerText = value
    editor.textContent = value
    for (const listener of editorListeners.get('input') || []) listener()
    return true
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
  fetch: async (...args) => {
    window.fetchCalls ||= []
    window.fetchCalls.push(args)
    return { status: 401 }
  },
  getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
  dispatchEvent: (event) => { if (event.type === 'dragend') nativeDropResetCount++ },
  addEventListener: (type, listener) => {
    const entries = listeners.get(type) || []
    entries.push(listener)
    listeners.set(type, entries)
  }
}
const recoveryTimers = []
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
  setTimeout: (callback, delay, ...args) => {
    if (delay === 30_000) { recoveryTimers.push(callback); return recoveryTimers.length }
    return setTimeout(callback, delay, ...args)
  },
  clearTimeout,
  crypto: { randomUUID: () => 'test-token' }
}

vm.runInNewContext(businessUi, context, { filename: 'business-ui.js' })
assert.equal(editor.textContent, 'Current draft', 'legacy internal file analysis instructions and server locations must be removed on load')
const legacyDraftObserver = mutationObservers.at(-1)
const initialCleanupCount = editingCommands.length
const normalDraft = '我刚上传了客户档案资料文件。\n请保留这份业务说明。\n文件在客户那边。'
editor.innerText = editor.textContent = normalDraft
legacyDraftObserver.callback([])
assert.equal(editor.textContent, normalDraft, 'ordinary user text sharing the old opening must remain intact')
assert.equal(editingCommands.length, initialCleanupCount, 'ordinary text must not trigger a composer replacement')
for (const instruction of [
  '我刚上传了客户资料文件。请先根据文件名和格式建议分类，不要推断文件正文。',
  '[EISCORE_CUSTOMER_FILE_ANALYSIS]\n我刚上传了客户档案资料文件。请调用 eiscore_customer_file_analyze，分析文件。'
]) {
  editor.innerText = editor.textContent = ['用户前文', instruction, '文件：/srv/uploads/private.docx（application/msword；引用 legacy-id）', '用户后文'].join('\n\n')
  legacyDraftObserver.callback([])
  assert.deepEqual(editor.textContent.split('\n').filter(Boolean), ['用户前文', '用户后文'], 'only the generated instruction/reference block may be removed')
}
editor.innerText = editor.textContent = 'Current draft'
editingCommands.splice(initialCleanupCount)
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

await window.fetch('/api/session/prompt', { method: 'POST' })
assert.equal(replies.length, 1, 'a prompt 401 must notify the host once for session recovery')
assert.equal(replies.at(-1).message.protocol, 'eiscore-harness-auth')
assert.equal(replies.at(-1).message.type, 'auth-required')
await window.fetch('/api/session/prompt', { method: 'POST' })
await window.fetch('/api/session/list')
assert.equal(replies.length, 1, 'auth recovery must not spam or react to unrelated 401 routes')
recoveryTimers.shift()()
window.fetch = async () => ({ status: 401 })
await window.fetch('/api/session/prompt', { method: 'POST' })
assert.equal(replies.length, 2, 'a later auth expiry must be able to request recovery again')
recoveryTimers.shift()()
await window.fetch('/harness-embed-api/session/prompt', { method: 'POST' })
assert.equal(replies.length, 3, 'the reverse-proxied prompt path must also request auth recovery')
replies.length = 0

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
assert.equal(editingCommands.at(-1).command, 'insertText', 'draft replacement should use the editor-native replace operation')
assert.ok(!editor.events?.includes('paste'), 'draft replacement must not trigger a duplicate paste insertion')

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
  data: { source: 'eiscore-host', protocol: 'eiscore-harness-file-drop', version: 1, type: 'uploaded', files: [{ id: 'test-file', name: 'C:\\private\\uploads\\问题反馈.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }] }
})
assert.equal(dropOverlayRemoved, true, 'the host upload response clears the native image-only overlay')
assert.equal(nativeDropResetCount, 2, 'upload success keeps DeepSeek native drag state reset')
assert.equal(editor.textContent, '用户刚刚输入的内容', 'file receipt must not insert internal analysis text into the visible composer')
assert.equal(editingCommands.length, 2, 'file receipt must not add instructions to the visible composer')
const attachmentObserver = mutationObservers.at(-1)
const initialAttachmentRoot = attachmentParent.querySelector('[data-eis-file-attachments]')
assert.equal(initialAttachmentRoot.children.length, 1, 'uploaded files must render an attachment row beside the composer')
assert.equal(attachmentParent.dataset.eisFileComposer, 'true', 'the attachment and composer must share a dedicated vertical layout')
assert.equal(initialAttachmentRoot.children[0].children[1].children[0].textContent, '问题反馈.docx', 'the UI must show only the filename, never a server path')
assert.equal(initialAttachmentRoot.children[0].children[1].children[1].textContent, 'DOCX · 大小未知', 'the UI must show a friendly file type instead of raw MIME metadata')
assert.equal(initialAttachmentRoot.children[0].children.length, 3, 'an attachment tile must contain only its icon, details, and actions')
assert.equal(initialAttachmentRoot.children[0].children[2].className, 'eis-file-attachment-actions')
assert.equal(buttonHandlers.some(({ title }) => title === '预览文件'), false, 'the attachment preview button is removed')
assert.equal(initialAttachmentRoot.children[0].children[1].children[0].title, '问题反馈.docx', 'the full filename remains available on hover')
initialAttachmentRoot.remove()
attachmentObserver.callback([{ type: 'childList', target: attachmentParent, removedNodes: [initialAttachmentRoot], addedNodes: [] }])
const restoredAttachmentRoot = attachmentParent.querySelector('[data-eis-file-attachments]')
assert.ok(restoredAttachmentRoot, 'a composer rerender must restore the removed attachment root')
assert.equal(restoredAttachmentRoot.children.length, 1, 'restoring the root must also restore uploaded file rows')
attachmentObserver.callback([{ type: 'childList', target: attachmentParent, addedNodes: [{}], removedNodes: [] }])
assert.equal(attachmentParent.querySelector('[data-eis-file-attachments]'), restoredAttachmentRoot, 'unrelated edits must not rebuild an intact attachment list')
await listeners.get('message')[1]({
  origin: 'https://app.example',
  source: parentWindow,
  data: { source: 'eiscore-host', protocol: 'eiscore-harness-file-drop', version: 1, type: 'uploaded', files: [{ id: 'second-file', name: '第二份资料.txt', type: 'text/plain' }] }
})
assert.equal(attachmentParent.querySelector('[data-eis-file-attachments]').children.length, 2, 'a programmatic draft replacement must not clear existing or newly uploaded attachments')
assert.equal(editor.textContent, '用户刚刚输入的内容', 'multiple uploads must stay out of the visible composer')
const promptEnvelope = {
  type: 'client-request',
  method: 'session/prompt',
  payload: { args: { request: { sessionId: 'session-1', mode: 'queue', content: [{ type: 'text', text: '请整理这些客户资料' }] } } }
}
let promptResponseStatus = 503
window.fetch = async (...args) => {
  window.promptRequestArgs = args
  return { status: promptResponseStatus, ok: promptResponseStatus >= 200 && promptResponseStatus < 300, clone: () => ({ json: async () => ({ result: { ok: true, value: {} } }) }) }
}
await window.fetch('/api/session/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(promptEnvelope) })
const failedPromptBody = JSON.parse(window.promptRequestArgs[1].body)
assert.equal(failedPromptBody.payload.args.request.content[0].text, '请整理这些客户资料', 'hidden context must preserve the user message')
assert.match(failedPromptBody.payload.args.request.content[1].text, /eiscore_customer_file_analyze/)
assert.match(failedPromptBody.payload.args.request.content[1].text, /needs_confirmation/)
assert.match(failedPromptBody.payload.args.request.content[1].text, /未经我看到结果后明确确认具体文件和客户，不要调用 customer_write 或 attach_file/)
assert.match(failedPromptBody.payload.args.request.content[1].text, /不得展示 file_id、服务器路径、存储位置或内部存储标识/)
assert.match(failedPromptBody.payload.args.request.content[1].text, /问题反馈\.docx/)
assert.doesNotMatch(failedPromptBody.payload.args.request.content[1].text, /C:\\\\private\\\\uploads/)
assert.match(failedPromptBody.payload.args.request.content[1].text, /引用 test-file/)
assert.match(failedPromptBody.payload.args.request.content[1].text, /引用 second-file/)
assert.equal((failedPromptBody.payload.args.request.content[1].text.match(/引用 second-file/g) || []).length, 1, 'each uploaded reference must be included only once')
assert.equal(attachmentParent.querySelector('[data-eis-file-attachments]').children.length, 2, 'a failed prompt must keep attachments available')
buttonHandlers.find(({ title }) => title === '从当前草稿移除（不删除原文件）').listener()
assert.equal(attachmentParent.querySelector('[data-eis-file-attachments]').children.length, 1, 'removing one draft attachment must leave other uploaded files visible')
assert.equal(editor.textContent, '用户刚刚输入的内容', 'removing an attachment must not change the natural-language draft')
assert.equal(replies.filter(({ message }) => message.type === 'delete-request').length, 0, 'removing from the draft must not permanently delete the source file')
promptResponseStatus = 200
await window.fetch('/api/session/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(promptEnvelope) })
assert.equal(attachmentParent.querySelector('[data-eis-file-attachments]'), null, 'a queued prompt must clear attachment chips')
assert.equal(editor.textContent, '用户刚刚输入的内容', 'hidden analysis context must never enter the visible composer')
await listeners.get('message')[1]({
  origin: 'https://app.example',
  source: parentWindow,
  data: { source: 'eiscore-host', protocol: 'eiscore-harness-file-drop', version: 1, type: 'uploaded', files: [{ id: 'proxy-file', name: '代理路径资料.txt', type: 'text/plain' }] }
})
promptResponseStatus = 503
await window.fetch('/harness-embed-api/session/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(promptEnvelope) })
const proxiedPromptBody = JSON.parse(window.promptRequestArgs[1].body)
assert.equal(proxiedPromptBody.payload.args.request.content[0].text, '请整理这些客户资料', 'proxy rewriting must preserve the natural-language message')
assert.match(proxiedPromptBody.payload.args.request.content.at(-1).text, /引用 proxy-file/, 'the reverse-proxied prompt must carry uploaded file references')
assert.equal(attachmentParent.querySelector('[data-eis-file-attachments]').children.length, 1, 'a failed reverse-proxied prompt must keep its attachment')
promptResponseStatus = 200
await window.fetch('/harness-embed-api/session/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(promptEnvelope) })
assert.equal(attachmentParent.querySelector('[data-eis-file-attachments]'), null, 'a successful reverse-proxied prompt must clear its attachment')
await listeners.get('message')[1]({
  origin: 'https://app.example',
  source: parentWindow,
  data: { source: 'eiscore-host', protocol: 'eiscore-harness-file-drop', version: 1, type: 'uploaded', files: [{ id: 'second-file', name: '第二份资料.txt', type: 'text/plain' }] }
})
let resolvePromptResponse
window.fetch = async (...args) => {
  window.promptRequestArgs = args
  return await new Promise((resolve) => { resolvePromptResponse = resolve })
}
const pendingPrompt = window.fetch('/api/session/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(promptEnvelope) })
assert.match(JSON.parse(window.promptRequestArgs[1].body).payload.args.request.content.at(-1).text, /引用 second-file/, 'the analysis reference must travel with the request started before another upload')
await listeners.get('message')[1]({
  origin: 'https://app.example',
  source: parentWindow,
  data: { source: 'eiscore-host', protocol: 'eiscore-harness-file-drop', version: 1, type: 'uploaded', files: [{ id: 'later-file', name: '后续资料.txt', type: 'text/plain' }] }
})
resolvePromptResponse({ status: 200, ok: true, clone: () => ({ json: async () => ({ result: { queued: true } }) }) })
await pendingPrompt
const remainingAttachmentRoot = attachmentParent.querySelector('[data-eis-file-attachments]')
assert.equal(remainingAttachmentRoot.children.length, 1, 'a successful request must not clear files uploaded after it started')
assert.equal(remainingAttachmentRoot.children[0].dataset.fileId, 'later-file')
editor.innerText = ''
editor.textContent = ''
for (const listener of editorListeners.get('input') || []) listener()
assert.equal(attachmentParent.querySelector('[data-eis-file-attachments]'), remainingAttachmentRoot, 'clearing natural language must preserve unsent file attachments')
dropOverlayRemoved = false
await listeners.get('message')[1]({
  origin: 'https://app.example',
  source: parentWindow,
  data: { source: 'eiscore-host', protocol: 'eiscore-harness-file-drop', version: 1, type: 'error', errors: ['文件格式不支持'] }
})
assert.equal(dropOverlayRemoved, true, 'an upload error response also clears the native image-only overlay')
assert.equal(nativeDropResetCount, 7, 'upload errors keep DeepSeek native drag state reset')

const filesOnlyDropEvent = {
  dataTransfer: { types: [], files: [droppedFile], dropEffect: '' },
  preventDefault() {},
  stopPropagation() {},
  stopImmediatePropagation() {}
}
documentListeners.get('drop')[0](filesOnlyDropEvent)
assert.equal(replies.at(-1).message.type, 'received', 'file drops without a Files type marker must still be accepted')
assert.equal(replies.at(-1).message.files[0], droppedFile)

console.log('PASS: Yayu Harness worker draft and file drop require trusted origin; files stay binary and drafts paste without sending')
