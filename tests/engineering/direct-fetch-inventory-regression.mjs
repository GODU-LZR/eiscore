// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue'])
const fetchPattern = /\bfetch\s*\(/g

const expectedInventory = new Map([
  ['shared/eis-geo-services.js', ['geo-hybrid', 1]],
  ['eiscore-apps/src/utils/flash-runtime-bridge.js', ['agent-protocol', 1]],
  ['eiscore-apps/src/views/FlashDraftPreview.vue', ['agent-protocol', 1]],
  ['eiscore-base/src/components/AiCopilot.vue', ['agent-protocol', 1]],
  ['eiscore-base/src/utils/ai-bridge.js', ['agent-protocol', 1]],
  ['eiscore-base/src/utils/document-intake-api.js', ['agent-protocol', 13]],
  ['eiscore-base/src/views/DigitalTwinView.vue', ['agent-protocol', 2]],
  ['eiscore-base/src/views/HomeView.vue', ['agent-protocol', 2]],
  ['eiscore-mobile/src/views/assistant/EnterpriseAssistant.vue', ['agent-protocol', 2]],
  ['eiscore-mobile/src/views/assistant/WarehouseAssistant.vue', ['agent-protocol', 1]],
  ['eiscore-apps/src/views/AppDashboard.vue', ['static-assets', 2]],
  ['eiscore-base/src/layout/index.vue', ['static-assets', 2]],
  ['eiscore-apps/src/views/FlashBuilder.vue', ['service-probe', 1]],
  ['eiscore-base/src/views/LoginView.vue', ['login-bootstrap', 4]],
  ['eiscore-mobile/src/views/LoginView.vue', ['login-bootstrap', 2]],
  ['eiscore-mobile/src/utils/auth.js', ['compat-auth', 1]]
])

const expectedCategoryCounts = new Map([
  ['geo-hybrid', 1],
  ['agent-protocol', 24],
  ['static-assets', 4],
  ['service-probe', 1],
  ['login-bootstrap', 6],
  ['compat-auth', 1]
])

const walk = (directory, files = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) walk(path, files)
    else if (sourceExtensions.has(extname(entry.name))) files.push(path)
  }
  return files
}

const scanRoots = readdirSync(repoRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^eiscore-/.test(entry.name))
  .map((entry) => resolve(repoRoot, entry.name, 'src'))
scanRoots.push(resolve(repoRoot, 'shared'))

const actualInventory = new Map()
const categoryCounts = new Map()
const literalApiFetches = []

for (const path of scanRoots.flatMap((root) => walk(root))) {
  const source = readFileSync(path, 'utf8')
  const count = [...source.matchAll(fetchPattern)].length
  if (!count) continue

  const repoPath = relative(repoRoot, path).replaceAll('\\', '/')
  actualInventory.set(repoPath, count)
  const expected = expectedInventory.get(repoPath)
  if (expected) categoryCounts.set(expected[0], (categoryCounts.get(expected[0]) || 0) + count)

  if (!['eiscore-base/src/views/LoginView.vue', 'eiscore-mobile/src/views/LoginView.vue', 'eiscore-mobile/src/utils/auth.js'].includes(repoPath)
      && /\bfetch\s*\(\s*['"`]\/api(?:\/|['"`])/.test(source)) {
    literalApiFetches.push(repoPath)
  }
}

assert.deepEqual(
  [...actualInventory.entries()].sort(),
  [...expectedInventory.entries()].map(([path, [, count]]) => [path, count]).sort(),
  'direct fetch inventory changed; classify and review every addition, removal, or count change'
)
assert.deepEqual([...categoryCounts.entries()].sort(), [...expectedCategoryCounts.entries()].sort())
assert.deepEqual(literalApiFetches, [], 'protected /api calls must use the platform HTTP client')

const total = [...actualInventory.values()].reduce((sum, count) => sum + count, 0)
assert.equal(total, 37)
console.log(`PASS: direct fetch inventory locked (${actualInventory.size} files, ${total} calls, 6 categories)`)
