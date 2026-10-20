import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { handleBusinessUi, injectBusinessUi } from '../../agent-harness/business-web-ui.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const businessUiCss = readFileSync(join(import.meta.dirname, '../../agent-harness/web-ui/business-ui.css'), 'utf8')
assert.match(businessUiCss, /@media \(max-width: 420px\)/)
assert.match(businessUiCss, /button\[aria-label\^="选择模型"\][\s\S]*?max-width: none !important/)
assert.match(businessUiCss, /button\[aria-label\^="选择模型"\] > span:nth-child\(2\)[\s\S]*?display: none !important/)
assert.match(businessUiCss, /div:has\(> button\[aria-label="发送消息"\]\)[\s\S]*?margin-left: 0 !important/)

if (process.argv.includes('--with-vendor')) {
  const html = '<html><head><base href="/"></head><body></body></html>'
  const result = injectBusinessUi(html)
  assert.match(result, /data-eiscore-business-ui src="\/harness-embed\/eiscore-ui\/business-ui\.js\?v=[a-f0-9]{16}"/)
  assert.equal(injectBusinessUi(result), result)
  assert.ok(result.indexOf('data-eiscore-business-ui') < result.indexOf('<base'))
}

const server = http.createServer((request, response) => {
  if (!handleBusinessUi(request, response)) response.writeHead(418).end()
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`
try {
  for (const path of ['/eiscore-ui/../package.json', '/eiscore-ui/%2e%2e%2fpackage.json', '/eiscore-ui/vendor/manifest.json', '/eiscore-ui/.env']) {
    const response = await fetch(base + path)
    assert.ok([404, 418].includes(response.status), path)
    assert.equal(await response.text(), '')
  }
  const blocked = await fetch(base + '/eiscore-ui/business-ui.js', { method: 'POST' })
  assert.equal(blocked.status, 405)
  assert.equal(blocked.headers.get('allow'), 'GET, HEAD')
  const asset = await fetch(base + '/eiscore-ui/business-ui.js?v=check')
  assert.equal(asset.status, 200)
  assert.match(asset.headers.get('content-type'), /javascript/)
  assert.equal(asset.headers.get('x-content-type-options'), 'nosniff')
  const source = await asset.text()
  assert.ok(source.length > 100)
  assert.equal(source.includes('DEEPSEEK_API_KEY'), false)
  const head = await fetch(base + '/eiscore-ui/business-ui.js', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.equal(Number(head.headers.get('content-length')), Buffer.byteLength(source))
  console.log('Harness business UI: fixed allowlist, path/method boundaries, content type and HEAD passed')
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
