import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script, runInNewContext } from 'node:vm'
import { apply, responsePolicyForRequest, visualFormatForRequest } from '../../agent-harness/visual-response-policy.mjs'
import { prepareVisualAssets, VISUAL_PACKAGES, verifyArchive } from '../../scripts/prepare-harness-visual-assets.mjs'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const uiRoot = join(repo, 'agent-harness/web-ui')
for (const name of ['business-ui.js', 'visual-runtime.js']) new Script(readFileSync(join(uiRoot, name), 'utf8'), { filename: name })

const eventSources = []
class NativeEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  constructor(url, options) { eventSources.push({ url, options }) }
}
const uiWindow = { EventSource: NativeEventSource, addEventListener() {} }
runInNewContext(readFileSync(join(uiRoot, 'business-ui.js'), 'utf8'), {
  window: uiWindow, URL,
  location: { href: 'https://example.test/harness-embed/', origin: 'https://example.test' },
  document: { currentScript: { src: 'https://example.test/harness-embed/eiscore-ui/business-ui.js' },
    head: { appendChild() {} }, createElement: () => ({}), querySelector: () => null, addEventListener() {} },
  MutationObserver: class { observe() {} disconnect() {} }
})
const options = { withCredentials: true }
new uiWindow.EventSource('/plugins/events?since=5#tail', options)
assert.deepEqual(eventSources.at(-1), { url: 'https://example.test/harness-embed-plugins/events?since=5#tail', options })
new uiWindow.EventSource(new URL('https://example.test/plugins/events?x=1'), options)
assert.equal(eventSources.at(-1).url, 'https://example.test/harness-embed-plugins/events?x=1')
for (const url of ['https://other.test/plugins/events?x=1', '/plugins/events-extra', '/api/events', new URL('https://other.test/plugins/events')]) {
  new uiWindow.EventSource(url, options)
  assert.equal(eventSources.at(-1).url, url, 'unrelated URLs retain their original value')
  assert.equal(eventSources.at(-1).options, options)
}
assert(uiWindow.EventSource.prototype instanceof NativeEventSource)
assert.equal(uiWindow.EventSource.CONNECTING, 0)
assert.equal(uiWindow.EventSource.OPEN, 1)
assert.equal(uiWindow.EventSource.CLOSED, 2)

for (const [request, format] of [
  ['请查询库存并生成柱状图', 'echarts'], ['按部门人数给我条形图', 'echarts'], ['用饼图展示占比', 'echarts'],
  ['按月份展示折线图', 'echarts'], ['请把这些数据可视化，图型由你选择', 'echarts'], ['Show totals as a bar chart', 'echarts'],
  ['把采购流程做成思维导图', 'mind'], ['请输出 mind 树', 'mind'], ['使用 DOT 画出审批流程', 'dot'], ['输出 dto 流程图', 'dot'],
  ['输出一个带按钮和内联 JavaScript 的 HTML 页面', 'html'], ['查询最新十笔订单', ''], ['不要图表，用文字说明', ''],
  ['本次不用柱状图', ''], ['Show totals without charts', ''], ["Don't use a bar chart; give the totals", ''],
  ['不要饼图，改为库存柱状图', 'echarts'], ['解释 ECharts 的 series 配置代码', ''], ['怎么修复柱状图组件代码中的报错', ''],
  ['How does ECharts render a bar chart?', ''], ['HTML 是什么？', ''], ['网页上的订单数量是多少', ''],
  ['解释以下代码：```js\nconst x = "柱状图"\n```', ''], ['看一下这个错误：`echarts.init is not a function`', ''],
  ['> 上一次要求：生成饼图\n现在只查询库存数量', '']
]) assert.equal(visualFormatForRequest(request), format, request)

const policy = responsePolicyForRequest('画库存柱状图')
for (const pattern of [/至少一个 echarts 代码块/, /JSON\.parse/, /柱状图必须为竖向/, /条形图必须为横向/,
  /不加入未经业务确认的审批/, /先通过已授权工具查询/, /不把限量样本当作全量统计/, /不改变既有认证、权限和执行策略/]) assert.match(policy, pattern)
assert.doesNotMatch(policy, /sales_orders|order_date\.desc|eiscore_sales_context|惠众|伦度/)
const events = new Map()
let section
apply({ on: (name, fn) => events.set(name, fn), systemPrompt: { getSectionOrder: () => 9900, section: (value) => { section = value } } })
const claimed = events.get('agent/inbox/claimed')
const agent = {}, other = {}
const message = Object.freeze({ source: Object.freeze({ kind: 'user' }), content: Object.freeze([
  Object.freeze({ type: 'text', text: '请画库存柱状图' }), Object.freeze({ type: 'image', data: 'unchanged-image' })
]) })
const before = JSON.stringify(message)
claimed({ agent, message })
assert.match(section.text({ agent }), /至少一个 echarts 代码块/)
assert.doesNotMatch(section.text({ agent: other }), /至少一个 echarts 代码块/)
assert.equal(JSON.stringify(message), before)
for (const kind of ['tool', 'plugin', 'model']) {
  claimed({ agent, message: { source: { kind }, content: [{ type: 'text', text: '输出HTML' }] } })
  assert.match(section.text({ agent }), /至少一个 echarts 代码块/)
}
claimed({ agent, message: { source: { kind: 'user' }, content: [{ type: 'text', text: '现在不用图表，只报库存数量' }] } })
assert.doesNotMatch(section.text({ agent }), /至少一个 echarts 代码块/)
assert.doesNotMatch(section.text(), /至少一个 echarts 代码块/)

const archive = Buffer.from('integrity-check')
const spec = { package: 'fixture', packageIntegrity: `sha512-${createHash('sha512').update(archive).digest('base64')}` }
verifyArchive(archive, spec)
assert.throws(() => verifyArchive(Buffer.from('tampered'), spec), /integrity mismatch/)
assert.deepEqual(VISUAL_PACKAGES.map(({ package: name, version }) => [name, version]), [['echarts', '6.1.0'], ['@viz-js/viz', '3.31.0']])
const cacheFixture = mkdtempSync(join(tmpdir(), 'eiscore-visual-regression-'))
try {
  writeFileSync(join(cacheFixture, 'manifest.json'), JSON.stringify([{ ...VISUAL_PACKAGES[0], version: '0.0.0' }]))
  await assert.rejects(prepareVisualAssets(join(cacheFixture, 'output'), { fromVendor: cacheFixture }), /cache manifest version mismatch/)
  writeFileSync(join(cacheFixture, 'manifest.json'), JSON.stringify(VISUAL_PACKAGES))
  writeFileSync(join(cacheFixture, VISUAL_PACKAGES[0].file), 'tampered')
  writeFileSync(join(cacheFixture, `${VISUAL_PACKAGES[0].file}.LICENSE.txt`), 'tampered')
  await assert.rejects(prepareVisualAssets(join(cacheFixture, 'output'), { fromVendor: cacheFixture }), /served library checksum mismatch/)
  assert(!existsSync(join(cacheFixture, 'output')), 'cache validation failure must not publish files')
} finally {
  rmSync(cacheFixture, { recursive: true, force: true })
}
console.log('PASS: business visual intent, per-agent turn reset, unchanged attachments, generic data policy and dependency integrity')

// Explicit browser mode uses a private localhost fixture, never a business service.
if (process.argv.includes('--browser')) {
  const { chromium } = await import('playwright')
  const vendor = resolve(process.env.HARNESS_VISUAL_VENDOR_ROOT || (existsSync(join(uiRoot, 'vendor/manifest.json')) ? join(uiRoot, 'vendor') : join(repo, 'output/harness-visual-assets/vendor')))
  for (const dependency of VISUAL_PACKAGES) {
    const file = join(vendor, dependency.file)
    assert(existsSync(file), `Run node scripts/prepare-harness-visual-assets.mjs first: ${file}`)
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), dependency.sha256)
  }
  const fixtures = [
    ['chart', 'echarts', JSON.stringify({ xAxis: { type: 'category', data: ['甲', '乙'] }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: [2, 3] }] })],
    ['bar', 'bar_chart', JSON.stringify({ labels: ['甲', '乙'], data: [2, 3] })],
    ['horizontal', '条形图', JSON.stringify({ labels: ['甲', '乙'], data: [2, 3] })],
    ['pie', 'pie-chart', JSON.stringify({ data: [{ name: '甲', value: 2 }, { name: '乙', value: 3 }] })],
    ['mind', 'mindmap', '# 采购\n- 询价\n- 下单'],
    ['dot', 'dto', 'digraph G { a [label="询价"]; b [label="下单"]; a -> b; }'],
    ['html', 'html-preview', '<button id="hello">点击</button><script>document.getElementById("hello").onclick=()=>document.getElementById("hello").textContent="完成";</script>'],
    ['plain', 'json', '{"total":5}']
  ]
  let forbiddenRequests = 0
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (pathname === '/fixture') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/harness-embed/eiscore-ui/business-ui.js" defer></script></head><body><div data-slot="conversation.hero.workspace">workspace</div><div data-slot="conversation.hero.agentPreset">mode</div><button aria-label="访问模式，当前：工作区内修改">access</button><aside data-slot="sidebar.workspaces"><button id="history">历史会话</button></aside></body></html>')
      return
    }
    if (pathname === '/favicon.ico') { response.writeHead(204).end(); return }
    const prefix = '/harness-embed/eiscore-ui/'
    const name = pathname.slice(prefix.length)
    const allowed = ['business-ui.js', 'business-ui.css', 'visual-runtime.js', 'visual-runtime.css', ...VISUAL_PACKAGES.map((item) => `vendor/${item.file}`)]
    if (!pathname.startsWith(prefix) || !allowed.includes(name)) { forbiddenRequests++; response.writeHead(404).end(); return }
    response.writeHead(200, { 'Content-Type': name.endsWith('.css') ? 'text/css' : 'application/javascript' })
    response.end(readFileSync(name.startsWith('vendor/') ? join(vendor, name.slice(7)) : join(uiRoot, name)))
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  let browser
  try {
    browser = await chromium.launch({ channel: process.env.HARNESS_VISUAL_BROWSER_CHANNEL || 'chrome', headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/fixture`)
    await page.evaluate((items) => {
      for (const [id, language, source] of items) {
        const block = document.createElement('div')
        block.id = id
        block.className = 'md-code-block'
        block.dataset.language = language
        const code = document.createElement('code')
        code.textContent = source
        block.appendChild(code)
        document.body.appendChild(block)
      }
    }, fixtures)
    await page.waitForFunction(() => document.querySelectorAll('[data-eis-visual-status="ready"]').length === 7, { timeout: 30000 })
    assert.equal(await page.locator('[data-slot="conversation.hero.workspace"]').isVisible(), false)
    assert.equal(await page.locator('[data-slot="conversation.hero.agentPreset"]').isVisible(), false)
    assert.equal(await page.locator('button[aria-label^="访问模式"]').isVisible(), false)
    assert.equal(await page.locator('#history').isVisible(), true)
    assert.equal(await page.locator('#plain').innerText(), '{"total":5}')
    assert.equal(await page.locator('#dot iframe').contentFrame().locator('svg').count(), 1)
    await page.locator('#html iframe').contentFrame().locator('#hello').click()
    assert.equal(await page.locator('#html iframe').contentFrame().locator('#hello').innerText(), '完成')
    assert.deepEqual(await page.locator('#bar iframe').contentFrame().locator('body').evaluate(() => window.__EIS_VISUAL_STATE__.chart.getOption().xAxis[0].type), 'category')
    assert.equal(await page.locator('#horizontal iframe').contentFrame().locator('body').evaluate(() => window.__EIS_VISUAL_STATE__.chart.getOption().yAxis[0].type), 'category')
    const chartFrame = page.locator('#chart iframe').contentFrame()
    assert.equal(await chartFrame.locator('body').evaluate(() => { try { parent.document.body; return false } catch { return true } }), true)
    assert.equal(await chartFrame.locator('body').evaluate(() => { try { localStorage.getItem('secret'); return false } catch { return true } }), true)
    assert.match(await chartFrame.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'), /connect-src 'none'.*form-action 'none'/)
    assert.equal(await chartFrame.locator('body').evaluate(async (_body, url) => {
      try { await fetch(url); return false } catch { return true }
    }, `http://127.0.0.1:${server.address().port}/forbidden`), true, 'sandbox preview cannot access service APIs')

    const token = await page.locator('#chart .eis-visual-render').getAttribute('data-token')
    const previousHeight = await page.locator('#chart iframe').evaluate((frame) => frame.style.height)
    await page.evaluate((value) => window.postMessage({ type: 'eis-visual-height', token: value, height: 2300 }, '*'), token)
    await page.waitForTimeout(50)
    assert.equal(await page.locator('#chart iframe').evaluate((frame) => frame.style.height), previousHeight, 'same token from wrong window must not mutate frame')
    await chartFrame.locator('body').evaluate(() => parent.postMessage({ type: 'eis-visual-height', token: 'wrong', height: 2300 }, '*'))
    await page.waitForTimeout(50)
    assert.equal(await page.locator('#chart iframe').evaluate((frame) => frame.style.height), previousHeight, 'wrong token from right window must not mutate frame')

    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6zcsAAAAASUVORK5CYII='
    let downloadCount = 0
    page.on('download', () => { downloadCount++ })
    await page.evaluate(({ data, value }) => window.postMessage({ type: 'eis-visual-download', token: value, data, name: 'forged.png' }, '*'), { data: image, value: token })
    await chartFrame.locator('body').evaluate((_body, data) => {
      parent.postMessage({ type: 'eis-visual-download', token: 'wrong', data, name: 'forged.png' }, '*')
      parent.postMessage({ type: 'eis-visual-download', token: window.__EIS_VISUAL__.token, data: 'data:text/html;base64,PGgxPg==', name: 'forged.html' }, '*')
    }, image)
    await page.locator('#html iframe').contentFrame().locator('body').evaluate((_body, data) => parent.postMessage({ type: 'eis-visual-download', token: window.__EIS_VISUAL__.token, data, name: 'forged.png' }, '*'), image)
    await page.waitForTimeout(100)
    assert.equal(downloadCount, 0, 'wrong source, wrong token, executable MIME and HTML preview downloads must be denied')
    await chartFrame.locator('body').evaluate((_body, data) => {
      const button = document.createElement('button')
      button.id = 'download-test'
      button.textContent = '下载图表'
      button.onclick = () => { const anchor = document.createElement('a'); anchor.href = data; anchor.download = 'chart.png'; anchor.click() }
      document.body.appendChild(button)
    }, image)
    const download = page.waitForEvent('download', { timeout: 5000 })
    await chartFrame.locator('#download-test').click()
    const downloaded = await download
    assert.equal(downloaded.suggestedFilename(), 'chart.png')

    await page.evaluate(() => { document.querySelector('#chart code').textContent = '{' })
    await page.waitForFunction(() => document.querySelector('#chart').dataset.eisVisualStatus === 'error')
    await page.evaluate((source) => { document.querySelector('#chart code').textContent = source }, fixtures[0][2])
    await page.waitForFunction((old) => document.querySelector('#chart').dataset.eisVisualStatus === 'ready' && document.querySelector('#chart .eis-visual-render').dataset.token !== old, token)
    assert.equal(await page.locator('#chart iframe').count(), 1, 'stream replacements must dispose old panels')
    await page.evaluate((source) => { document.querySelector('#plain code').textContent = source }, fixtures[0][2])
    await page.waitForFunction(() => document.querySelector('#plain').dataset.eisVisualStatus === 'ready')
    await page.evaluate(() => { document.querySelector('#plain code').textContent = '{"total":6}' })
    await page.waitForFunction(() => !document.querySelector('#plain iframe') && !document.querySelector('#plain').hasAttribute('data-eis-visual-status'))
    assert.equal(await page.locator('#plain').innerText(), '{"total":6}', 'ordinary streamed JSON must not retain stale chart data')
    await page.setViewportSize({ width: 390, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile preview must not overflow the page')
    assert.equal(forbiddenRequests, 0)
    assert.deepEqual(pageErrors, [])
    console.log('PASS: real Chrome ECharts/bar/pie/mind/DOT/HTML, hidden selectors/history, sandbox, token/source checks, download, stream recovery and mobile width')
  } finally {
    await browser?.close()
    await new Promise((done) => server.close(done))
  }
}
