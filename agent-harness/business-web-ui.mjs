import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const root = new URL('./web-ui/', import.meta.url)
const files = new Map([
  ['business-ui.js', 'application/javascript; charset=utf-8'],
  ['business-ui.css', 'text/css; charset=utf-8'],
  ['visual-runtime.js', 'application/javascript; charset=utf-8'],
  ['visual-runtime.css', 'text/css; charset=utf-8'],
  ['vendor/echarts.min.js', 'application/javascript; charset=utf-8'],
  ['vendor/viz-standalone.js', 'application/javascript; charset=utf-8'],
  ['vendor/echarts.min.js.LICENSE.txt', 'text/plain; charset=utf-8'],
  ['vendor/viz-standalone.js.LICENSE.txt', 'text/plain; charset=utf-8']
])
const prefix = '/eiscore-ui/'

export function handleBusinessUi(request, response) {
  const path = String(request.url || '').split('?', 1)[0]
  if (!path.startsWith(prefix)) return false
  const file = path.slice(prefix.length)
  const type = files.get(file)
  if (!type) {
    response.writeHead(404, { 'cache-control': 'no-store' }).end()
    return true
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' }).end()
    return true
  }
  try {
    const body = readFileSync(new URL(file, root))
    response.writeHead(200, {
      'content-type': type,
      'content-length': body.byteLength,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff'
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch {
    response.writeHead(503, { 'cache-control': 'no-store' }).end('Harness UI resource unavailable')
  }
  return true
}

export function injectBusinessUi(html) {
  if (html.includes('data-eiscore-business-ui')) return html
  const version = createHash('sha256')
  for (const file of files.keys()) {
    if (file.endsWith('.LICENSE.txt')) continue
    version.update(readFileSync(new URL(file, root)))
  }
  const script = `<script data-eiscore-business-ui src="/harness-embed/eiscore-ui/business-ui.js?v=${version.digest('hex').slice(0, 16)}"></script>`
  return html.replace(/<head(?:\s[^>]*)?>/i, (head) => head + script)
}
