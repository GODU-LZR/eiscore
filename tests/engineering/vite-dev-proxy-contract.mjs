// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadViteDevProxyTargets } from '../../scripts/vite-dev-proxy-config.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const consumers = [
  'eiscore-base',
  'eiscore-apps',
  'eiscore-materials',
  'eiscore-sales',
  'eiscore-purchase',
  'eiscore-production',
  'eiscore-quality',
  'eiscore-equipment',
  'eiscore-decision',
  'eiscore-mobile'
]

assert.deepEqual(loadViteDevProxyTargets({}), {
  api: 'http://localhost:3000',
  agent: 'http://localhost:8078',
  ide: 'http://localhost:8443'
})
assert.deepEqual(loadViteDevProxyTargets({
  VITE_DEV_API_PROXY_TARGET: 'http://127.0.0.1:13000',
  VITE_DEV_AGENT_PROXY_TARGET: 'http://127.0.0.1:18078',
  VITE_FLASH_IDE_PROXY_TARGET: 'http://127.0.0.1:18443'
}), {
  api: 'http://127.0.0.1:13000',
  agent: 'http://127.0.0.1:18078',
  ide: 'http://127.0.0.1:18443'
})
assert.throws(
  () => loadViteDevProxyTargets({ VITE_DEV_API_PROXY_TARGET: 'http://user:pass@localhost:3000' }),
  /without credentials/
)
assert.throws(
  () => loadViteDevProxyTargets({ VITE_DEV_AGENT_PROXY_TARGET: 'http://localhost:8078/path' }),
  /must not include a path/
)

for (const consumer of consumers) {
  const source = readFileSync(resolve(repoRoot, consumer, 'vite.config.js'), 'utf8')
  assert.match(source, /loadViteDevProxyTargets/, `${consumer} must use the shared dev proxy contract`)
  assert.doesNotMatch(
    source,
    /target:\s*['"]http:\/\/localhost:(?:3000|8078|8443)['"]/,
    `${consumer} must not hard-code an isolated service target`
  )
}

const baseConfigSource = readFileSync(resolve(repoRoot, 'eiscore-base', 'vite.config.js'), 'utf8')
assert.match(baseConfigSource, /target:\s*`\$\{devProxyTargets\.api\}\/rpc`/)
assert.doesNotMatch(baseConfigSource, /http:\/\/localhost:3000\/rpc/)

console.log(`PASS: configurable Vite dev proxy contract (${consumers.length} consumers)`)
