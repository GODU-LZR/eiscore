(() => {
  const NativeEventSource = window.EventSource
  if (typeof NativeEventSource === 'function') {
    window.EventSource = class extends NativeEventSource {
      constructor(url, options) {
        const target = new URL(String(url), location.href)
        super(target.origin === location.origin && target.pathname === '/plugins/events'
          ? `${location.origin}/harness-embed-plugins/events${target.search}${target.hash}` : url, options)
      }
    }
  }
  const assetUrl = new URL(document.currentScript?.src || '/harness-embed/eiscore-ui/business-ui.js', location.href)
  if (assetUrl.origin !== location.origin) return
  const ASSET_ROOT = new URL('./', assetUrl).href
  const VERSION = 'business-visual-v1'
  const framePolicy = document.createElement('meta')
  framePolicy.httpEquiv = 'Content-Security-Policy'
  framePolicy.content = "frame-src 'none'"
  document.head.appendChild(framePolicy)
  const style = document.createElement('link')
  style.rel = 'stylesheet'
  style.href = `${ASSET_ROOT}business-ui.css?v=${VERSION}`
  document.head.appendChild(style)

  const dismissNotice = () => {
    const button = document.querySelector('[role="dialog"][aria-label="内测声明"] button, [role="dialog"][aria-label="Internal Testing Notice"] button')
    if (!button) return
    noticeObserver.disconnect()
    button.click()
  }
  const noticeObserver = new MutationObserver(dismissNotice)
  noticeObserver.observe(document, { childList: true, subtree: true })
  dismissNotice()

  const MAX_SOURCE = 192 * 1024
  const WORKER_DRAFT_PROTOCOL = 'eiscore-harness-worker-draft'
  const WORKER_DRAFT_VERSION = 1
  const WORKER_DRAFT_MAX_LENGTH = 20000
  const WORKER_COMPOSER_SELECTOR = '[data-composer-input][contenteditable="true"]'
  const FILE_DROP_PROTOCOL = 'eiscore-harness-file-drop'
  const FILE_DROP_VERSION = 1
  const FILE_DROP_COPY = Object.freeze([
    [/Drag images here to add them/gi, 'Drag files here to add them'],
    [/Up to\s*(\d+)\s*images/gi, 'Up to $1 files'],
    [/([\d.]+\s*(?:MB|MiB|GB|GiB))\s*each/gi, '$1 per file'],
    [/请把\s*图片\s*拖拽在上面/g, '请把文件拖拽在上面'],
    [/图片\s*拖动到此处即可添加/g, '文件拖动到此处即可添加'],
    [/图片\s*拖拽在上面/g, '文件拖拽在上面'],
    [/最多\s*(\d+)\s*张/g, '最多$1个文件'],
    [/每张\s*(\d+(?:\.\d+)?\s*(?:MB|MiB|GB|GiB))/g, '每个文件$1']
  ])
  const rewriteFileDropCopy = (root) => {
    if (!root) return
    if (root.nodeType === 3) {
      let value = root.nodeValue
      for (const [pattern, replacement] of FILE_DROP_COPY) value = value.replace(pattern, replacement)
      if (value !== root.nodeValue) root.nodeValue = value
      return
    }
    if (typeof document.createTreeWalker !== 'function') return
    const walker = document.createTreeWalker(root, 4)
    let node
    while ((node = walker.nextNode())) {
      let value = node.nodeValue
      for (const [pattern, replacement] of FILE_DROP_COPY) value = value.replace(pattern, replacement)
      if (value !== node.nodeValue) node.nodeValue = value
    }
  }
  const clearFileDropOverlay = () => {
    delete document.documentElement.dataset.eiscoreFileDrop
    window.dispatchEvent(new Event('dragend'))
    const statuses = typeof document.querySelectorAll === 'function'
      ? document.querySelectorAll('[role="status"]')
      : []
    for (const status of statuses) {
      const copy = String(status?.textContent || '')
      if (/(?:图片|文件).*(?:拖拽|拖动)|(?:拖拽|拖动).*(?:图片|文件)|最多\s*\d+\s*(?:张|个文件)|每(?:张|个文件)|drag\s+(?:images|files)\s+here\s+to\s+add|up to\s*\d+\s*(?:images|files)|[\d.]+\s*(?:mb|mib|gb|gib)\s*(?:each|per file)/i.test(copy)) status.remove?.()
    }
  }
  const fileDropCopyObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') rewriteFileDropCopy(record.target)
      else for (const node of record.addedNodes) rewriteFileDropCopy(node)
    }
  })
  fileDropCopyObserver.observe(document.documentElement, { childList: true, characterData: true, subtree: true })
  rewriteFileDropCopy(document.body || document.documentElement)
  const workerDrafts = new Map()
  const aliases = {
    echarts: 'echarts', echart: 'echarts', 'e-chart': 'echarts',
    bar: 'bar', 'bar-chart': 'bar', bar_chart: 'bar', '柱状图': 'bar',
    'horizontal-bar': 'horizontal-bar', horizontal_bar: 'horizontal-bar', '条形图': 'horizontal-bar',
    pie: 'pie', 'pie-chart': 'pie', pie_chart: 'pie', '饼图': 'pie',
    mind: 'mind', mindmap: 'mind', 'mind-map': 'mind', '思维导图': 'mind',
    dot: 'dot', dto: 'dot', graphviz: 'dot', flowchart: 'dot',
    chart: 'chart', charts: 'chart', json: 'json', jsonc: 'json', html: 'html', 'html-preview': 'html'
  }
  const text = (value) => String(value ?? '').trim()
  const parseJson = (source) => { try { return JSON.parse(source) } catch { return null } }
  const scriptsafe = (source) => source.replace(/<\/script/gi, '<\\/script')
  const normalizedDraftText = (value) => String(value ?? '').replace(/\r\n?/g, '\n').trim()
  const readComposerText = (composer) => normalizedDraftText(composer?.innerText || composer?.textContent)
  const getWorkerComposer = () => [...document.querySelectorAll(WORKER_COMPOSER_SELECTOR)]
    .reverse()
    .find((composer) => composer.isConnected && composer.getClientRects().length > 0) || null
  const uploadedFiles = new Map()
  const watchedComposers = new WeakSet()
  const formatFileSize = (value) => {
    const size = Number(value)
    if (!Number.isFinite(size) || size <= 0) return '大小未知'
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }
  const fileReference = (file) => {
    const name = file.name || '未命名文件'
    const type = file.type || '未知格式'
    const id = file.id || ''
    const excerpt = text(file.contentExcerpt).slice(0, 9000)
    return `文件：${name}（${type}；引用 ${id}）${excerpt ? `\n内容节选：\n${excerpt}` : '\n尚无可读取的内容节选'}`
  }
  const attachmentRootFor = (composer) => {
    const parent = composer?.parentElement
    if (!parent) return null
    let root = parent.querySelector?.('[data-eis-file-attachments]')
    if (!root) {
      root = document.createElement('div')
      root.dataset.eisFileAttachments = 'true'
      root.setAttribute('aria-label', '已添加文件')
      parent.insertBefore?.(root, composer)
    }
    return root
  }
  const clearFileReferenceFromComposer = (file) => {
    const composer = getWorkerComposer()
    const reference = String(file?.referenceText || '')
    if (!composer || !reference || !readComposerText(composer).includes(reference)) return
    const current = readComposerText(composer)
    const next = normalizedDraftText(current.replace(reference, '').replace(/\n{3,}/g, '\n\n'))
    try { pasteWorkerDraft(composer, next) } catch {}
  }
  const sendFileDropMessage = (type, id, extra = {}) => {
    window.parent.postMessage({
      source: 'eiscore-harness',
      protocol: FILE_DROP_PROTOCOL,
      version: FILE_DROP_VERSION,
      type,
      id,
      ...extra
    }, location.origin)
  }
  const requestFilePreview = (file) => {
    if (!file?.id || file.previewState === 'loading') return
    file.previewState = 'loading'
    file.previewError = ''
    renderFileAttachments()
    sendFileDropMessage('preview-request', `preview-${Date.now()}`, { fileId: file.id })
  }
  const requestFileDelete = (file) => {
    if (!file?.id || file.deleteState === 'loading') return
    if (typeof window.confirm === 'function' && !window.confirm(`永久删除“${file.name || '此文件'}”？此操作不可撤销。`)) return
    file.deleteState = 'loading'
    file.deleteError = ''
    renderFileAttachments()
    sendFileDropMessage('delete-request', `delete-${Date.now()}`, { fileId: file.id })
  }
  const removeFileFromDraft = (file) => {
    clearFileReferenceFromComposer(file)
    uploadedFiles.delete(file.id)
    renderFileAttachments()
  }
  const renderFilePreview = (row, file) => {
    if (!file.previewOpen) return
    const preview = document.createElement('div')
    preview.className = 'eis-file-preview'
    if (file.previewState === 'loading') {
      preview.textContent = '正在读取文件预览…'
    } else if (file.previewError) {
      preview.textContent = file.previewError
    } else if (file.preview?.content_base64 && /^image\//i.test(file.preview.mime_type || file.type || '')) {
      const image = document.createElement('img')
      image.alt = file.name || '文件预览'
      image.src = `data:${file.preview.mime_type || file.type};base64,${file.preview.content_base64}`
      preview.appendChild(image)
    } else if (file.preview?.content_base64 && /^audio\//i.test(file.preview.mime_type || file.type || '')) {
      const audio = document.createElement('audio')
      audio.controls = true
      audio.src = `data:${file.preview.mime_type || file.type};base64,${file.preview.content_base64}`
      preview.appendChild(audio)
    } else if (text(file.contentExcerpt)) {
      const excerpt = document.createElement('pre')
      excerpt.textContent = file.contentExcerpt
      preview.appendChild(excerpt)
    } else {
      preview.textContent = '该文件类型暂提供文件信息预览。'
    }
    row.appendChild(preview)
  }
  function renderFileAttachments(composer = getWorkerComposer()) {
    const root = attachmentRootFor(composer)
    if (!root) return
    root.textContent = ''
    if (!uploadedFiles.size) {
      root.remove?.()
      return
    }
    for (const file of uploadedFiles.values()) {
      const row = document.createElement('div')
      row.className = 'eis-file-attachment'
      row.dataset.fileId = file.id
      const icon = document.createElement('span')
      icon.className = 'eis-file-attachment-icon'
      icon.textContent = /^image\//i.test(file.type || '') ? '图' : /^audio\//i.test(file.type || '') ? '音' : '件'
      const detail = document.createElement('span')
      detail.className = 'eis-file-attachment-detail'
      const name = document.createElement('strong')
      name.textContent = file.name || '未命名文件'
      const meta = document.createElement('small')
      meta.textContent = `${file.type || '未知格式'} · ${formatFileSize(file.size)}${file.deleteState === 'loading' ? ' · 正在删除' : ''}`
      detail.append(name, meta)
      const preview = document.createElement('button')
      preview.type = 'button'
      preview.className = 'eis-file-attachment-action'
      preview.textContent = file.previewOpen ? '收起' : '预览'
      preview.title = file.previewOpen ? '收起文件预览' : '预览文件'
      preview.addEventListener?.('click', () => {
        file.previewOpen = !file.previewOpen
        if (file.previewOpen && !file.preview && !file.contentExcerpt) requestFilePreview(file)
        renderFileAttachments()
      })
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'eis-file-attachment-action'
      remove.textContent = '×'
      remove.title = '从当前草稿移除（不删除原文件）'
      remove.setAttribute('aria-label', `从当前草稿移除 ${file.name || '文件'}`)
      remove.addEventListener?.('click', () => removeFileFromDraft(file))
      const destroy = document.createElement('button')
      destroy.type = 'button'
      destroy.className = 'eis-file-attachment-action eis-file-attachment-delete'
      destroy.textContent = file.deleteState === 'loading' ? '…' : '删'
      destroy.title = '永久删除原文件'
      destroy.setAttribute('aria-label', `永久删除 ${file.name || '文件'}`)
      destroy.disabled = file.deleteState === 'loading'
      destroy.addEventListener?.('click', () => requestFileDelete(file))
      row.append(icon, detail, preview, remove, destroy)
      renderFilePreview(row, file)
      root.appendChild(row)
    }
  }
  const watchComposer = (composer) => {
    if (!composer || watchedComposers.has(composer)) return
    watchedComposers.add(composer)
    composer.addEventListener?.('input', () => {
      if (!readComposerText(composer)) {
        uploadedFiles.clear()
        renderFileAttachments(composer)
      }
    })
  }
  const sendWorkerDraftReply = (type, id, extra = {}) => {
    window.parent.postMessage({
      source: 'eiscore-harness',
      protocol: WORKER_DRAFT_PROTOCOL,
      version: WORKER_DRAFT_VERSION,
      type,
      id,
      ...extra
    }, location.origin)
  }
  const waitForWorkerComposer = (timeoutMs = 12000) => new Promise((resolve) => {
    const current = getWorkerComposer()
    if (current) { resolve(current); return }
    const root = document.documentElement || document.body
    if (!root) { resolve(null); return }
    const observer = new MutationObserver(() => {
      const composer = getWorkerComposer()
      if (composer) finish(composer)
    })
    const timer = setTimeout(() => finish(null), timeoutMs)
    const finish = (composer) => {
      clearTimeout(timer)
      observer.disconnect()
      resolve(composer)
    }
    observer.observe(root, { childList: true, subtree: true })
  })
  const pasteWorkerDraft = (composer, prompt) => {
    if (typeof DataTransfer !== 'function' || typeof ClipboardEvent !== 'function') return false
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(composer)
    selection.removeAllRanges()
    selection.addRange(range)
    composer.focus()
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', prompt)
    composer.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData
    }))
    return true
  }
  const handleWorkerDraftMessage = async (event) => {
    if (event.origin !== location.origin || event.source !== window.parent) return
    const message = event.data
    if (!message || message.source !== 'eiscore-host' || message.protocol !== WORKER_DRAFT_PROTOCOL || message.version !== WORKER_DRAFT_VERSION) return
    const id = String(message.id || '')
    if (!/^[A-Za-z0-9._:-]{1,120}$/.test(id)) return

    if (message.type === 'prepare') {
      if (workerDrafts.has(id)) return
      if (typeof message.prompt !== 'string' || !message.prompt.trim() || message.prompt.length > WORKER_DRAFT_MAX_LENGTH) {
        sendWorkerDraftReply('error', id, { reason: 'invalid-request' })
        return
      }
      const composer = await waitForWorkerComposer()
      if (!composer) {
        sendWorkerDraftReply('error', id, { reason: 'composer-unavailable' })
        return
      }
      const currentText = readComposerText(composer)
      if (currentText === normalizedDraftText(message.prompt)) {
        sendWorkerDraftReply('applied', id, { alreadyPresent: true })
        return
      }
      workerDrafts.set(id, { composer, prompt: message.prompt, initialText: currentText })
      sendWorkerDraftReply('proposal', id, { hasExistingDraft: Boolean(currentText) })
      return
    }

    if (message.type !== 'apply' && message.type !== 'cancel') return
    const draft = workerDrafts.get(id)
    if (!draft) return
    workerDrafts.delete(id)
    if (message.type === 'cancel') {
      sendWorkerDraftReply('cancelled', id)
      return
    }
    if (!draft.composer.isConnected || getWorkerComposer() !== draft.composer || readComposerText(draft.composer) !== draft.initialText) {
      sendWorkerDraftReply('error', id, { reason: 'draft-changed' })
      return
    }
    let pasted = false
    try {
      pasted = pasteWorkerDraft(draft.composer, draft.prompt)
    } catch {
      pasted = false
    }
    if (!pasted) {
      sendWorkerDraftReply('error', id, { reason: 'paste-unavailable' })
      return
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    if (readComposerText(draft.composer) !== normalizedDraftText(draft.prompt)) {
      sendWorkerDraftReply('error', id, { reason: 'paste-rejected' })
      return
    }
    sendWorkerDraftReply('applied', id)
  }
  window.addEventListener('message', handleWorkerDraftMessage)

  // The Harness page is same-origin after the Yayu proxy rewrite. Keep binary
  // files in the host upload path and send only stable file references back to
  // the model-facing composer; this avoids duplicating Base64 data in chat.
  const hasFiles = (event) => {
    const transfer = event?.dataTransfer
    return [...(transfer?.types || [])].includes('Files') || Number(transfer?.files?.length) > 0
  }
  const claimFileDrop = (event) => {
    if (!hasFiles(event)) return false
    event.preventDefault()
    event.stopPropagation?.()
    event.stopImmediatePropagation?.()
    return true
  }
  const handleFileDragOver = (event) => {
    if (!claimFileDrop(event)) return
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    document.documentElement.dataset.eiscoreFileDrop = 'active'
  }
  const handleFileDragEnd = () => { clearFileDropOverlay() }
  const handleFileDrop = (event) => {
    if (!claimFileDrop(event)) return
    clearFileDropOverlay()
    const files = [...(event.dataTransfer?.files || [])]
    if (!files.length) { handleFileDragEnd(); return }
    const id = `drop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sendFileDropMessage('received', id, { files })
  }
  document.addEventListener('dragenter', handleFileDragOver, true)
  document.addEventListener('dragover', handleFileDragOver, true)
  document.addEventListener('dragleave', handleFileDragEnd, true)
  document.addEventListener('drop', handleFileDrop, true)
  window.addEventListener('message', async (event) => {
    if (event.origin !== location.origin || event.source !== window.parent) return
    const message = event.data
    if (!message || message.source !== 'eiscore-host' || message.protocol !== FILE_DROP_PROTOCOL || message.version !== FILE_DROP_VERSION) return
    clearFileDropOverlay()
    if (message.type === 'deleted' || message.type === 'delete-error' || message.type === 'previewed' || message.type === 'preview-error') {
      const fileId = String(message.fileId || '')
      const file = uploadedFiles.get(fileId)
      if (!file) return
      if (message.type === 'deleted') {
        clearFileReferenceFromComposer(file)
        uploadedFiles.delete(fileId)
      } else if (message.type === 'delete-error') {
        file.deleteState = ''
        file.deleteError = text(message.error) || '文件删除失败'
      } else if (message.type === 'previewed') {
        file.previewState = ''
        file.previewError = ''
        file.preview = message.file && typeof message.file === 'object' ? message.file : null
      } else {
        file.previewState = ''
        file.previewError = text(message.error) || '文件预览失败'
      }
      renderFileAttachments()
      return
    }
    if (message.type !== 'uploaded' || !Array.isArray(message.files) || !message.files.length) return
    let remaining = 9000
    const references = message.files.map((file) => {
      const normalized = { ...file, id: String(file.id || ''), name: text(file.name) || '未命名文件', type: text(file.type) || '未知格式' }
      normalized.referenceText = fileReference({ ...normalized, contentExcerpt: text(file.contentExcerpt).slice(0, Math.max(0, remaining)) })
      normalized.contentExcerpt = text(file.contentExcerpt).slice(0, Math.max(0, remaining))
      uploadedFiles.set(normalized.id, normalized)
      const excerpt = normalized.contentExcerpt
      remaining -= excerpt.length
      return normalized.referenceText
    })
    const prompt = `我刚上传了客户资料文件。请先根据文件名、格式以及已提供的内容节选建议分类；没有节选时，不要推断文件内容。先向我确认客户和分类，再调用客户档案能力把文件引用写入客户资料列。\n\n${references.join('\n\n')}`
    const composer = await waitForWorkerComposer(3000)
    if (!composer) return
    watchComposer(composer)
    const currentText = readComposerText(composer)
    const nextText = currentText ? `${currentText}\n\n${prompt}` : prompt
    try { pasteWorkerDraft(composer, nextText) } catch {}
    renderFileAttachments(composer)
  })
  const HARNESS_ENTRY_VERSION = 1
  const HARNESS_ENTRIES = new Set(['worker', 'workbench'])
  const sendHarnessEntryReply = (message) => window.parent.postMessage({ version: HARNESS_ENTRY_VERSION, ...message }, location.origin)
  const handleHarnessEntryMessage = (event) => {
    if (event.origin !== location.origin || event.source !== window.parent) return
    const message = event.data
    if (!message || message.type !== 'eiscore:harness-entry' || message.version !== HARNESS_ENTRY_VERSION) return
    const entry = String(message.entry || '')
    const id = String(message.id || '')
    if (!HARNESS_ENTRIES.has(entry) || !/^[A-Za-z0-9._:-]{1,160}$/.test(id)) {
      sendHarnessEntryReply({ type: 'eiscore:harness-entry-result', entry, id, status: 'failed' })
      return
    }
    document.documentElement.dataset.eiscoreHarnessEntry = entry
    sendHarnessEntryReply({ type: 'eiscore:harness-entry-ready' })
    sendHarnessEntryReply({ type: 'eiscore:harness-entry-result', entry, id, status: 'applied' })
  }
  window.addEventListener('message', handleHarnessEntryMessage)
  const assets = new Map()
  const frames = new Map()
  const loadAsset = (path) => {
    if (!assets.has(path)) {
      const promise = fetch(`${ASSET_ROOT}${path}?v=${VERSION}`, { credentials: 'same-origin', signal: AbortSignal.timeout(20000) }).then(async (response) => {
        if (!response.ok) throw new Error('可视化资源暂时无法加载')
        const source = await response.text()
        if (/^\s*<!doctype html/i.test(source)) throw new Error('可视化资源地址无效')
        return source
      }).catch((error) => { assets.delete(path); throw error })
      assets.set(path, promise)
    }
    return assets.get(path)
  }
  const descriptor = (kind, source) => {
    const payload = parseJson(source)
    if (kind === 'json' || kind === 'chart') {
      const requested = text(payload?.type || payload?.kind || payload?.chartType || payload?.format).toLowerCase()
      kind = aliases[requested] || (payload?.series || payload?.option?.series ? 'echarts' : '')
      if (!['echarts', 'bar', 'horizontal-bar', 'pie', 'mind', 'dot'].includes(kind)) return null
    }
    if (['bar', 'horizontal-bar', 'pie'].includes(kind) && !payload) return null
    return { kind, source, payload }
  }
  const prepareHtml = (source) => {
    const template = document.createElement('template')
    template.innerHTML = source
    const parsed = template.content
    parsed.querySelectorAll('base,meta,link,iframe,frame,object,embed,portal,script[src]').forEach((node) => node.remove())
    parsed.querySelectorAll('*').forEach((node) => {
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase(), value = attribute.value.trim()
        if (['srcdoc', 'action', 'formaction', 'ping', 'srcset', 'poster', 'background'].includes(name)
          || (['href', 'xlink:href'].includes(name) && !value.startsWith('#'))
          || (name === 'src' && !/^(?:data:|blob:)/i.test(value))) node.removeAttribute(attribute.name)
      }
    })
    return template.innerHTML
  }
  const frameDocument = async (spec, token) => {
    const dependencies = spec.kind === 'dot' ? ['vendor/viz-standalone.js']
      : spec.kind === 'html' ? ['vendor/echarts.min.js', 'vendor/viz-standalone.js'] : ['vendor/echarts.min.js']
    const [runtime, css, ...libraries] = await Promise.all([
      loadAsset('visual-runtime.js'), loadAsset('visual-runtime.css'), ...dependencies.map(loadAsset)
    ])
    const configuration = JSON.stringify({ ...spec, token }).replace(/</g, '\\u003c')
    const csp = "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; media-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'"
    const compactChartStyle = ['dot', 'html'].includes(spec.kind) ? ''
      : '<style>@media(max-width:600px){#main{height:clamp(280px,52dvh,380px)!important;min-width:0}}</style>'
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${css.replace(/<\/style/gi, '<\\/style')}</style>${compactChartStyle}<script>window.__EIS_VISUAL__=${configuration}</script>${libraries.map((library) => `<script>${scriptsafe(library)}</script>`).join('')}<script>${scriptsafe(runtime)}</script></head><body>${spec.kind === 'html' ? `<main id="eis-html-root">${prepareHtml(spec.source)}</main>` : '<main id="main" aria-label="图表"></main>'}</body></html>`
  }
  const dispose = (entry) => {
    entry.frame.contentWindow?.postMessage({ type: 'eis-visual-dispose', token: entry.token }, '*')
    entry.observer?.disconnect()
    frames.delete(entry.token)
  }
  const setState = (entry, state, message = '') => {
    entry.block.setAttribute('data-eis-visual-status', state)
    entry.panel.dataset.state = state
    entry.frame.dataset.state = state
    entry.status.textContent = message
  }
  window.addEventListener('message', (event) => {
    const data = event.data
    if (!data || typeof data !== 'object' || !['eis-visual-height', 'eis-visual-ready', 'eis-visual-error', 'eis-visual-download'].includes(data.type)) return
    const entry = frames.get(data.token)
    if (!entry || event.source !== entry.frame.contentWindow || !entry.panel.isConnected) return
    if (data.type === 'eis-visual-download') {
      if (entry.kind === 'html' || typeof data.data !== 'string' || data.data.length > 12 * 1024 * 1024 || !/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(data.data)) return
      const link = document.createElement('a')
      link.href = data.data
      link.download = text(data.name || 'chart.png').replace(/[^\w.\-\u4e00-\u9fff]/g, '_').slice(0, 100)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } else if (data.type === 'eis-visual-height') {
      const height = Number(data.height)
      const compactChart = !['dot', 'html'].includes(entry.kind)
      const maxHeight = window.matchMedia('(max-width: 600px)').matches && compactChart ? 420 : 2400
      if (Number.isFinite(height)) entry.frame.style.height = `${Math.min(maxHeight, Math.max(180, Math.ceil(height)))}px`
    } else {
      clearTimeout(entry.timer)
      setState(entry, data.type === 'eis-visual-ready' ? 'ready' : 'error')
    }
  })
  const renderCodeBlock = (block) => {
    const code = block.querySelector('pre code, code, pre')
    const source = text(code?.textContent)
    const language = text(block.querySelector('[class*="infostring"]')?.textContent || block.getAttribute('data-language') || block.getAttribute('data-lang')
      || block.className?.match(/(?:language|lang|code)-([\w-]+)/i)?.[1] || code?.className?.match(/(?:language|lang)-([\w-]+)/i)?.[1]).replace(/^language[-:]/i, '').toLowerCase()
    const kind = aliases[language]
    if (!kind) return
    const fingerprint = `${kind}\u0000${source}`
    if (block.__eisVisualFingerprint === fingerprint && frames.has(block.__eisVisual?.dataset.token)) {
      if (!block.contains(block.__eisVisual)) block.appendChild(block.__eisVisual)
      return
    }
    const spec = source && source.length <= MAX_SOURCE ? descriptor(kind, source) : null
    const previous = block.__eisVisual
    if (previous) { const entry = frames.get(previous.dataset.token); if (entry) { clearTimeout(entry.timer); dispose(entry) }; previous.remove() }
    block.__eisVisual = null
    block.__eisVisualFingerprint = fingerprint
    if (!spec && kind === 'json') {
      block.classList.remove('eis-visual-code-block')
      block.removeAttribute('data-eis-visual')
      block.removeAttribute('data-eis-visual-status')
      return
    }
    block.setAttribute('data-eis-visual', spec?.kind || kind)
    if (!block.classList.contains('eis-visual-code-block')) block.classList.add('eis-visual-code-block')
    if (!spec) {
      block.setAttribute('data-eis-visual-status', 'error')
      return
    }
    const panel = document.createElement('section')
    panel.className = 'eis-visual-render eis-visual-output'
    panel.dataset.state = 'loading'
    const token = crypto.randomUUID()
    panel.dataset.token = token
    const status = document.createElement('p')
    status.className = 'eis-visual-status'
    status.setAttribute('role', 'status')
    status.textContent = '正在加载…'
    const frame = document.createElement('iframe')
    frame.className = 'eis-visual-frame'
    frame.dataset.state = 'loading'
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.setAttribute('referrerpolicy', 'no-referrer')
    frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'")
    frame.title = spec.kind === 'html' ? '交互内容' : spec.kind === 'mind' ? '思维导图' : spec.kind === 'dot' ? '流程图' : 'ECharts 图表'
    panel.append(status, frame)
    block.__eisVisual = panel
    block.setAttribute('data-eis-visual-status', 'loading')
    block.appendChild(panel)
    const entry = { token, panel, frame, status, block, kind: spec.kind }
    frames.set(token, entry)
    if (typeof ResizeObserver === 'function') {
      entry.observer = new ResizeObserver(() => frame.contentWindow?.postMessage({ type: 'eis-visual-resize', token }, '*'))
      entry.observer.observe(panel)
    }
    entry.timer = setTimeout(() => {
      if (frames.has(token)) setState(entry, 'error')
    }, 30000)
    frameDocument(spec, token).then((source) => {
      if (frames.get(token) === entry && panel.isConnected) frame.srcdoc = source
    }).catch(() => {
      if (frames.get(token) === entry) { clearTimeout(entry.timer); setState(entry, 'error') }
    })
  }
  const renderVisuals = (root) => {
    for (const entry of frames.values()) if (!entry.panel.isConnected) { clearTimeout(entry.timer); dispose(entry) }
    root.querySelectorAll('.md-code-block').forEach(renderCodeBlock)
  }
  const observeVisuals = () => {
    const root = document.body
    if (!root) return
    renderVisuals(root)
    let pending
    const observer = new MutationObserver((records) => {
      if (records.every(({ target }) => (target.nodeType === 1 ? target : target.parentElement)?.closest('.eis-visual-render'))) return
      clearTimeout(pending)
      pending = setTimeout(() => renderVisuals(root), 180)
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-language', 'data-lang'] })
    window.addEventListener('pagehide', () => { observer.disconnect(); clearTimeout(pending); for (const entry of frames.values()) { clearTimeout(entry.timer); dispose(entry) } }, { once: true })
  }
  if (document.body) observeVisuals()
  else document.addEventListener('DOMContentLoaded', observeVisuals, { once: true })
})()
