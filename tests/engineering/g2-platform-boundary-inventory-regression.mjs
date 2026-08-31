// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue'])
const storagePattern = /\b(?:window\.)?(?:localStorage|sessionStorage)\b/g
const fullPageNavigationPattern = /\bwindow\.location\.href\s*=/g

const expectedStorageInventory = new Map([
  ['eiscore-apps/src/views/AppDashboard.vue', 4],
  ['eiscore-apps/src/views/FlashBuilder.vue', 2],
  ['eiscore-base/src/components/AiCopilot.vue', 2],
  ['eiscore-base/src/layout/index.vue', 9],
  ['eiscore-base/src/stores/system.js', 1],
  ['eiscore-base/src/utils/ai-bridge.js', 2],
  ['eiscore-hr/src/components/eis-data-grid-v2/composables/useGridCore.js', 2],
  ['eiscore-hr/src/views/HrUserManage.vue', 1],
  ['eiscore-mobile/src/views/LoginView.vue', 3],
  ['eiscore-mobile/src/views/assistant/EnterpriseAssistant.vue', 3],
  ['eiscore-mobile/src/views/assistant/WarehouseAssistant.vue', 3],
  ['eiscore-mobile/src/views/stock/StockScan.vue', 2],
  ['shared/eis-check-cache.mjs', 1],
  ['shared/eis-display-control.js', 4],
  ['shared/eis-grid-local-layout.js', 2]
])

const expectedFullPageNavigationInventory = new Map([
  ['eiscore-apps/src/utils/auth.js', 1],
  ['eiscore-base/src/router/index.js', 1],
  ['eiscore-base/src/utils/auth.js', 1],
  ['eiscore-equipment/src/utils/auth.js', 1],
  ['eiscore-hr/src/utils/auth.js', 1],
  ['eiscore-materials/src/utils/auth.js', 1],
  ['eiscore-mobile/src/platform/http-client.js', 1],
  ['eiscore-mobile/src/utils/auth.js', 1],
  ['eiscore-mobile/src/views/HomeView.vue', 1],
  ['eiscore-mobile/src/views/LoginView.vue', 3],
  ['eiscore-production/src/utils/auth.js', 1],
  ['eiscore-purchase/src/utils/auth.js', 1],
  ['eiscore-quality/src/utils/auth.js', 1],
  ['eiscore-sales/src/utils/auth.js', 1],
  ['shared/eis-session.js', 1]
])

const permissionAdapters = [
  'eiscore-apps/src/utils/permission.js',
  'eiscore-base/src/utils/permission.js',
  'eiscore-equipment/src/utils/permission.js',
  'eiscore-hr/src/utils/permission.js',
  'eiscore-materials/src/utils/permission.js',
  'eiscore-production/src/utils/permission.js',
  'eiscore-purchase/src/utils/permission.js',
  'eiscore-quality/src/utils/permission.js',
  'eiscore-sales/src/utils/permission.js'
]
const expectedGridCopies = [
  'eiscore-apps',
  'eiscore-equipment',
  'eiscore-hr',
  'eiscore-materials',
  'eiscore-production',
  'eiscore-purchase',
  'eiscore-quality',
  'eiscore-sales'
]

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
const sourceFiles = scanRoots.flatMap((root) => walk(root))

const collectInventory = (pattern) => {
  const inventory = new Map()
  for (const path of sourceFiles) {
    const source = readFileSync(path, 'utf8')
    const count = [...source.matchAll(pattern)].length
    if (count) inventory.set(relative(repoRoot, path).replaceAll('\\', '/'), count)
  }
  return inventory
}

const actualGridCopies = new Set()
for (const path of sourceFiles) {
  const repoPath = relative(repoRoot, path).replaceAll('\\', '/')
  const match = repoPath.match(/^(eiscore-[^/]+)\/src\/components\/eis-data-grid-v2\//)
  if (match) actualGridCopies.add(match[1])
}
assert.deepEqual([...actualGridCopies].sort(), expectedGridCopies)

assert.deepEqual([...collectInventory(storagePattern).entries()].sort(), [...expectedStorageInventory.entries()].sort())
assert.deepEqual(
  [...collectInventory(fullPageNavigationPattern).entries()].sort(),
  [...expectedFullPageNavigationInventory.entries()].sort()
)

for (const path of permissionAdapters) {
  const source = readFileSync(resolve(repoRoot, path), 'utf8')
  assert.match(source, /from\s*['"]@eiscore\/platform\/permission['"]/, path)
  assert.match(source, /createPermissionService\(\{/, path)
  assert.doesNotMatch(source, /\bsuper_admin\b|info\?\.app_role|Array\.isArray\(/, path)
}

const storageTotal = [...expectedStorageInventory.values()].reduce((total, count) => total + count, 0)
const navigationTotal = [...expectedFullPageNavigationInventory.values()].reduce((total, count) => total + count, 0)
console.log(`PASS: G2 remaining inventories locked (storage ${expectedStorageInventory.size}/${storageTotal}, full-page navigation ${expectedFullPageNavigationInventory.size}/${navigationTotal}, permission adapters ${permissionAdapters.length}, Grid copies ${actualGridCopies.size})`)
