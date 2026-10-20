(() => {
  const spec = window.__EIS_VISUAL__
  if (!spec?.token) return
  let chart, root, resizeObserver, disposed = false, heightJob
  const state = window.__EIS_VISUAL_STATE__ = { kind: spec.kind, state: 'loading' }
  const send = (type, extra = {}) => { if (!disposed) parent.postMessage({ type, token: spec.token, ...extra }, '*') }
  const measure = () => {
    cancelAnimationFrame(heightJob)
    heightJob = requestAnimationFrame(() => {
      const height = Math.max(document.body?.scrollHeight || 0, document.body?.offsetHeight || 0, root?.offsetHeight || 0)
      send('eis-visual-height', { height: Math.min(2400, Math.max(180, height)) })
    })
  }
  const ready = () => { if (state.state !== 'error') { state.state = 'ready'; send('eis-visual-ready'); measure() } }
  const fail = (error) => {
    state.state = 'error'
    state.error = String(error?.message || error || '无法展示此内容').slice(0, 240)
    send('eis-visual-error')
  }
  window.__eisVisualError = fail
  window.addEventListener('error', (event) => fail(event.error || event.message))
  window.addEventListener('unhandledrejection', (event) => fail(event.reason))
  const dispose = () => {
    if (disposed) return
    disposed = true
    resizeObserver?.disconnect()
    cancelAnimationFrame(heightJob)
    chart?.dispose()
    state.state = 'disposed'
  }
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.token !== spec.token) return
    if (event.data.type === 'eis-visual-dispose') dispose()
    if (event.data.type === 'eis-visual-resize' && !disposed) { chart?.resize(); measure() }
  })
  window.addEventListener('pagehide', dispose, { once: true })
  const relayDownload = (anchor) => {
    if (spec.kind === 'html' || !anchor.download || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(anchor.href)) return false
    send('eis-visual-download', { data: anchor.href, name: anchor.download })
    return true
  }
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (relayDownload(this)) return
    return click.call(this)
  }
  const dispatch = HTMLAnchorElement.prototype.dispatchEvent
  HTMLAnchorElement.prototype.dispatchEvent = function (event) {
    if (event.type === 'click' && relayDownload(this)) return true
    return dispatch.call(this, event)
  }
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a')
    if (anchor && !anchor.getAttribute('href')?.startsWith('#')) event.preventDefault()
  }, true)
  document.addEventListener('submit', (event) => event.preventDefault(), true)
  const rows = (payload) => {
    const series = Array.isArray(payload.series) ? payload.series[0] : payload.series
    const source = payload.data || payload.values || series?.data || []
    const labels = payload.labels || payload.categories || payload.xAxis?.data || []
    return source.map((item, index) => ({ name: String(item?.name ?? item?.label ?? labels[index] ?? `项目 ${index + 1}`), value: Number(typeof item === 'object' ? item.value ?? item.y ?? item.amount : item) || 0 }))
  }
  const legacyOption = () => {
    const data = rows(spec.payload), horizontal = spec.kind === 'horizontal-bar'
    if (horizontal) root.style.height = `${Math.min(1800, Math.max(420, data.length * 30 + 100))}px`
    return {
      title: typeof spec.payload.title === 'string' ? { text: spec.payload.title } : spec.payload.title,
      tooltip: { trigger: spec.kind === 'pie' ? 'item' : 'axis' },
      toolbox: { feature: { saveAsImage: {} } },
      ...(spec.kind === 'pie' ? { legend: { bottom: 0 }, series: [{ type: 'pie', radius: '65%', data }] }
        : { grid: { left: 24, right: 24, top: 65, bottom: 35, containLabel: true }, xAxis: horizontal ? { type: 'value' } : { type: 'category', data: data.map((item) => item.name) }, yAxis: horizontal ? { type: 'category', data: data.map((item) => item.name) } : { type: 'value' }, series: [{ type: 'bar', data: data.map((item) => item.value) }] })
    }
  }
  const outlineTree = (source) => {
    const tree = { name: '思维导图', children: [] }, stack = [{ level: -1, node: tree }]
    let headingLevel = -1
    for (const line of source.split('\n').filter((value) => value.trim())) {
      const heading = line.match(/^\s*(#{1,6})\s+(.+)$/)
      const bullet = line.match(/^(\s*)(?:[-*+] |\d+[.)] )(.+)$/)
      const level = heading ? (headingLevel = heading[1].length - 1) : bullet ? headingLevel + 1 + Math.floor(bullet[1].replace(/\t/g, '  ').length / 2) : 0
      const name = (heading ? heading[2] : bullet ? bullet[2] : line.trim()).replace(/\*\*|__/g, '')
      while (stack.length > 1 && stack.at(-1).level >= level) stack.pop()
      const node = { name, children: [] }
      stack.at(-1).node.children.push(node)
      stack.push({ level, node })
    }
    return tree.children.length === 1 ? tree.children[0] : tree
  }
  const mindOption = () => {
    const payload = spec.payload
    if (!payload && /^[{\[]/.test(spec.source.trim())) throw new Error('思维导图 JSON 尚未完整')
    const source = payload ? (payload.root || payload.tree || (Array.isArray(payload.data) ? { name: payload.title || '思维导图', children: payload.data } : payload.data) || payload) : outlineTree(spec.source)
    let count = 0, leaves = 0
    const normalize = (node, depth = 0) => {
      if (++count > 600 || depth > 40) throw new Error('思维导图内容过长')
      const children = Array.isArray(node?.children) ? node.children.map((child) => normalize(child, depth + 1)) : []
      if (!children.length) leaves++
      return { ...(typeof node === 'object' ? node : {}), name: String(typeof node === 'string' ? node : node?.name ?? node?.topic ?? node?.text ?? node?.label ?? node?.title ?? ''), children }
    }
    const data = normalize(source)
    root.style.height = `${Math.min(1800, Math.max(420, leaves * 30 + 100))}px`
    return { tooltip: { trigger: 'item', triggerOn: 'mousemove' }, toolbox: { feature: { restore: {}, saveAsImage: {} } }, series: [{ type: 'tree', data: [data], top: 35, left: '12%', bottom: 30, right: '22%', symbolSize: 9, roam: true, initialTreeDepth: -1, expandAndCollapse: true, label: { position: 'left', verticalAlign: 'middle', align: 'right', fontSize: 12 }, leaves: { label: { position: 'right', align: 'left' } }, animationDurationUpdate: 250 }] }
  }
  const applyOption = (option) => {
    if (disposed) return
    chart = echarts.getInstanceByDom(root) || echarts.init(root, null, { renderer: 'canvas' })
    if (option && typeof option === 'object') chart.setOption(option.option || option, { notMerge: true })
    else if (!chart.getOption()?.series) throw new Error('未找到 ECharts option')
    state.chart = chart
    chart.on('finished', measure)
    ready()
  }
  window.__eisApplyOption = applyOption
  const renderEcharts = () => {
    if (!window.echarts) throw new Error('ECharts 未加载')
    if (spec.kind === 'mind') return applyOption(mindOption())
    if (['bar', 'horizontal-bar', 'pie'].includes(spec.kind)) return applyOption(legacyOption())
    if (spec.payload) return applyOption(spec.payload)
    let source = spec.source.trim().replace(/^export\s+default\s+/, 'const option = ')
    if (/^[{(]/.test(source)) source = `const option = (${source.replace(/;\s*$/, '')});`
    const script = document.createElement('script')
    script.textContent = `(() => { try { const module = { exports: null }; ${source}\n; window.__eisApplyOption(typeof option !== 'undefined' ? option : module.exports); } catch (error) { window.__eisVisualError(error); } })();`
    document.body.appendChild(script)
  }
  const graphSource = () => {
    const payload = spec.payload
    if (!payload) return spec.source
    if (typeof payload.dot === 'string') return payload.dot
    if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges || payload.links)) throw new Error('流程图需要 nodes 和 edges')
    const nodes = payload.nodes, edges = payload.edges || payload.links
    if (nodes.length > 600 || edges.length > 1200) throw new Error('流程图内容过长')
    const quote = (value) => JSON.stringify(String(value ?? ''))
    return `digraph G { graph [rankdir=${payload.direction === 'TB' ? 'TB' : 'LR'}]; node [shape=box, style="rounded,filled", fillcolor="#f1f5f9", fontname="Arial"]; edge [fontname="Arial"];\n${nodes.map((node, index) => `${quote(node.id ?? index)} [label=${quote(node.label ?? node.name ?? node.id ?? index)}];`).join('\n')}\n${edges.map((edge) => `${quote(edge.from ?? edge.source)} -> ${quote(edge.to ?? edge.target)}${edge.label ? ` [label=${quote(edge.label)}]` : ''};`).join('\n')}\n}`
  }
  const renderDot = async () => {
    const viz = await Viz.instance()
    if (disposed) return
    const svg = viz.renderSVGElement(graphSource(), { engine: 'dot' })
    svg.querySelectorAll('script,foreignObject,image').forEach((node) => node.remove())
    svg.querySelectorAll('*').forEach((node) => { for (const attribute of [...node.attributes]) if (attribute.name.startsWith('on') || /href$/i.test(attribute.name)) node.removeAttribute(attribute.name) })
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', '流程图')
    root.classList.add('eis-dot-root')
    root.appendChild(svg)
    ready()
  }
  const boot = async () => {
    root = document.getElementById(spec.kind === 'html' ? 'eis-html-root' : 'main')
    if (!root) return fail('内容容器不存在')
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => { chart?.resize(); measure() })
      resizeObserver.observe(root)
    }
    try {
      if (spec.kind === 'html') { ready(); return }
      if (spec.kind === 'dot') await renderDot()
      else renderEcharts()
    } catch (error) { fail(error) }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
  else boot()
})()
