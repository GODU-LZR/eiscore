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
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><script>window.__EIS_VISUAL__=${configuration}</script>${libraries.map((library) => `<script>${scriptsafe(library)}</script>`).join('')}<script>${scriptsafe(runtime)}</script></head><body>${spec.kind === 'html' ? `<main id="eis-html-root">${prepareHtml(spec.source)}</main>` : '<main id="main" aria-label="图表"></main>'}</body></html>`
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
      if (Number.isFinite(height)) entry.frame.style.height = `${Math.min(2400, Math.max(180, Math.ceil(height)))}px`
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
