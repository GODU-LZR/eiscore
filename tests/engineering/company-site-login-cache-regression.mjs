import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const config = readFileSync(new URL('../../deploy/huizhong/nginx/huizong.conf', import.meta.url), 'utf8')
for (const path of ['/company-site/huizhong', '/company-site/index.html']) {
  const start = config.indexOf(`location = ${path} {`)
  assert.ok(start >= 0, `missing exact HTML location: ${path}`)
  const block = config.slice(start, config.indexOf('}', start) + 1)
  assert.match(block, /add_header Cache-Control "no-store, no-cache, must-revalidate" always;/)
  // A location-level add_header replaces inherited headers; retain both protections.
  assert.match(block, /add_header X-Content-Type-Options nosniff always;/)
  assert.match(block, /add_header Referrer-Policy strict-origin-when-cross-origin always;/)
}
assert.match(config, /expires 1h;/, 'retain hashed resource caching')
console.log('PASS: company-site login HTML revalidates and retains security headers')
