// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionStorage = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])(?:auth_token|user_info)\1/

const productionHome = read('eiscore-production/src/views/HomeView.vue')
assert.match(productionHome, /import\s*{\s*getAuthHeader,\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(productionHome, directSessionStorage)
assert.doesNotMatch(productionHome, /const parseStoredToken|const getAuthHeader/)
assert.match(productionHome, /const info = getUserInfo\(\) \|\| {}/)
assert.match(productionHome, /return info\.username \|\| info\.name \|\| info\.id \|\| ['"]BOM-MRP['"]/)
assert.match(productionHome, /\.\.\.getAuthHeader\(\)/)

const productionGrid = read('eiscore-production/src/components/ProductionAppGrid.vue')
assert.match(productionGrid, /import\s*{\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(productionGrid, directSessionStorage)
assert.match(productionGrid, /const info = getUserInfo\(\) \|\| {}/)
assert.match(productionGrid, /return info\.username \|\| info\.name \|\| info\.id \|\| ['"]BOM-MRP['"]/)

const inventoryLocation = read('eiscore-materials/src/views/InventoryCheckLocation.vue')
assert.match(inventoryLocation, /import\s*{\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(inventoryLocation, directSessionStorage)
assert.match(inventoryLocation, /const user = getUserInfo\(\)/)
assert.match(inventoryLocation, /checkBy\.value = user\?\.username \|\| ['"]/)

const hrUserManage = read('eiscore-hr/src/views/HrUserManage.vue')
assert.match(hrUserManage, /import\s*{\s*getUserInfo,\s*setUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(hrUserManage, directSessionStorage)
assert.match(hrUserManage, /if \(!setUserInfo\(info\)\) throw new Error\(['"]Unable to persist user info['"]\)/)
assert.match(hrUserManage, /const info = getUserInfo\(\)/)
assert.match(hrUserManage, /type: ['"]user-info-updated['"], user_info: info, user: info/)
assert.match(hrUserManage, /new StorageEvent\(['"]storage['"], storageEventInit\)/)
assert.match(hrUserManage, /setGlobalState\({ user_info: info, user: info }\)/)

for (const app of ['hr', 'materials']) {
  const mainSource = read(`eiscore-${app}/src/main.js`)
  assert.match(mainSource, /import\s*{\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
  assert.doesNotMatch(mainSource, directSessionStorage)
  assert.match(mainSource, /app\.directive\(['"]permission['"],/)
  assert.match(mainSource, /const userInfo = getUserInfo\(\) \|\| {}/)
  assert.match(mainSource, /const permissions = userInfo\.permissions \|\| \[]/)
  assert.match(mainSource, /permissions\.some\(perm => value\.includes\(perm\)\)/)
}

console.log('PASS: production, HR and materials consumers use platform session (6 files)')
