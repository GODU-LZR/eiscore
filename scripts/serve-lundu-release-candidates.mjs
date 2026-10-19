// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣
// Local-only, disposable server for testing an actual Service Worker upgrade.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { resolve, sep, extname } from 'node:path'

const [oldDirectory, candidateDirectory] = process.argv.slice(2)
assert(oldDirectory && candidateDirectory, 'usage: node scripts/serve-lundu-release-candidates.mjs <old-dist> <candidate-dist>')
const roots = { old: realpathSync(oldDirectory), candidate: realpathSync(candidateDirectory) }
for (const root of Object.values(roots)) assert(statSync(resolve(root, 'sw.js')).isFile())
let phase = 'old'
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return }
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname === '/__eiscore_sw_check__/select') {
    const selected = url.searchParams.get('phase')
    if (!Object.hasOwn(roots, selected)) { response.writeHead(400).end(); return }
    phase = selected
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ phase, directory: roots[phase] }))
    return
  }
  try {
    const name = ['/', '/login'].includes(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname).slice(1)
    const file = realpathSync(resolve(roots[phase], name))
    assert(file.startsWith(roots[phase] + sep) && statSync(file).isFile())
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
    response.end(request.method === 'HEAD' ? undefined : readFileSync(file))
  } catch { response.writeHead(404).end() }
})
server.listen(0, '127.0.0.1', () => console.log(`http://localhost:${server.address().port}`))
