// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const apps = ['apps', 'hr', 'materials', 'sales', 'purchase', 'production', 'quality', 'equipment']
const compactPermissionApps = new Set(['quality', 'equipment'])

const readSource = (app, utility) => readFileSync(
  resolve(repoRoot, `eiscore-${app}/src/utils/${utility}.js`),
  'utf8'
)

const loadPermission = async (app, userInfo) => {
  const source = readSource(app, 'permission')
    .replace(
      /import\s*{\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]\s*/,
      `const getUserInfo = () => (${JSON.stringify(userInfo)})\n`
    )
  return import(`data:text/javascript,${encodeURIComponent(source)}#${app}-${Math.random()}`)
}

for (const app of apps) {
  const permissionSource = readSource(app, 'permission')
  const realtimeSource = readSource(app, 'realtime')

  assert.match(permissionSource, /import\s*{\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
  assert.doesNotMatch(permissionSource, /localStorage|user_info|JSON\.parse/)
  assert.match(permissionSource, /export const getPermissions/)
  assert.match(permissionSource, /export const hasPerm/)

  if (compactPermissionApps.has(app)) {
    assert.doesNotMatch(permissionSource, /export const hasAnyPerm|export const hasAllPerm/)
  } else {
    assert.match(permissionSource, /export const hasAnyPerm/)
    if (app === 'apps') assert.doesNotMatch(permissionSource, /export const hasAllPerm/)
    else assert.match(permissionSource, /export const hasAllPerm/)
  }

  assert.match(realtimeSource, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
  assert.doesNotMatch(realtimeSource, /localStorage|auth_token/)
  assert.match(realtimeSource, /DEFAULT_PORT\s*=\s*8078/)
  assert.match(realtimeSource, /DEFAULT_PATH\s*=\s*['"]\/ws['"]/)
  assert.match(realtimeSource, /PROXY_WS_PATH\s*=\s*['"]\/agent\/ws['"]/)
  assert.match(realtimeSource, /\['bearer',\s*token]/)
  assert.match(realtimeSource, /},\s*1000\)/)
  if (compactPermissionApps.has(app)) {
    assert.match(realtimeSource, /return\s*{\s*subscribe\s*}/)
    assert.doesNotMatch(realtimeSource, /return\s*{\s*subscribe,\s*close\s*}/)
  } else {
    assert.match(realtimeSource, /return\s*{\s*subscribe,\s*close\s*}/)
  }

  const direct = await loadPermission(app, {
    app_role: 'employee',
    permissions: ['op:direct', 'op:second']
  })
  assert.deepEqual(direct.getPermissions(), ['op:direct', 'op:second'])
  assert.equal(direct.hasPerm(''), true)
  assert.equal(direct.hasPerm('op:direct'), true)
  assert.equal(direct.hasPerm('op:missing'), false)

  const superAdmin = await loadPermission(app, { appRole: 'super_admin', permissions: [] })
  assert.equal(superAdmin.hasPerm('op:anything'), true)

  if (!compactPermissionApps.has(app)) {
    assert.equal(direct.hasAnyPerm([]), true)
    assert.equal(direct.hasAnyPerm(['op:missing', 'op:second']), true)
    assert.equal(direct.hasAnyPerm(['op:missing']), false)
    if (app !== 'apps') {
      assert.equal(direct.hasAllPerm([]), true)
      assert.equal(direct.hasAllPerm(['op:direct', 'op:second']), true)
      assert.equal(direct.hasAllPerm(['op:direct', 'op:missing']), false)
    }
  }
}

const salesModule = await loadPermission('sales', { permissions: ['module:sales'] })
assert.equal(salesModule.hasPerm('app:sales_order'), true)
assert.equal(salesModule.hasPerm('op:sales_create'), true)
assert.equal(salesModule.hasPerm('module:sales'), true)
assert.equal(salesModule.hasPerm('op:purchase_create'), false)

const salesManager = await loadPermission('sales', { role: 'sales_manager', permissions: [] })
assert.equal(salesManager.hasPerm('module:sales'), true)
assert.equal(salesManager.hasAllPerm(['app:sales_order', 'op:sales_create']), true)

const purchaseModule = await loadPermission('purchase', { permissions: ['module:purchase'] })
assert.equal(purchaseModule.hasPerm('app:purchase_order'), true)
assert.equal(purchaseModule.hasPerm('op:purchase_create'), true)
assert.equal(purchaseModule.hasPerm('module:purchase'), true)
assert.equal(purchaseModule.hasPerm('op:sales_create'), false)

const purchaseManager = await loadPermission('purchase', { role: 'purchase_manager', permissions: [] })
assert.equal(purchaseManager.hasPerm('module:purchase'), true)
assert.equal(purchaseManager.hasAllPerm(['app:purchase_order', 'op:purchase_create']), true)

console.log(`PASS: micro-app permission and realtime utilities use platform session (${apps.length} applications)`)
