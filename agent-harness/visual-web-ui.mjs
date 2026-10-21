import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const root = new URL('./web-ui/', import.meta.url)
const files = new Map([
  ['visual-ui.js', 'application/javascript; charset=utf-8'],
  ['visual-runtime.js', 'application/javascript; charset=utf-8'],
  ['visual-runtime.css', 'text/css; charset=utf-8'],
  ['vendor/echarts.min.js', 'application/javascript; charset=utf-8'],
  ['vendor/viz-standalone.js', 'application/javascript; charset=utf-8'],
  ['vendor/echarts.min.js.LICENSE.txt', 'text/plain; charset=utf-8'],
  ['vendor/viz-standalone.js.LICENSE.txt', 'text/plain; charset=utf-8']
])
const publicPrefix = String(process.env.EISCORE_HARNESS_PUBLIC_PREFIX || '/harness-embed').replace(/\/+$/, '')
const prefix = '/eiscore-visual/'

const read = (file) => readFileSync(new URL(file, root))

export function handleVisualUi(request, response) {
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
    const body = read(file)
    response.writeHead(200, {
      'content-type': type,
      'content-length': body.byteLength,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff'
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch {
    response.writeHead(503, { 'cache-control': 'no-store' }).end('Harness visual resource unavailable')
  }
  return true
}

export function injectVisualUi(html) {
  if (html.includes('data-eiscore-visual-ui')) return html
  const version = createHash('sha256')
  for (const file of files.keys()) {
    if (file.endsWith('.LICENSE.txt')) continue
    version.update(read(file))
  }
  const script = `<script data-eiscore-visual-ui src="${publicPrefix}/eiscore-visual/visual-ui.js?v=${version.digest('hex').slice(0, 16)}"></script>`
  return html.replace(/<head(?:\s[^>]*)?>/i, (head) => head + script)
}
