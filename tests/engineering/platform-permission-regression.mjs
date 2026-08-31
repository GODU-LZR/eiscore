// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPermissionService } from '../../packages/eiscore-platform/src/permission.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.throws(() => createPermissionService(), /getUserInfo must be a function/)
assert.throws(
  () => createPermissionService({ getUserInfo: () => ({}), moduleId: '../sales' }),
  /moduleId must be a safe identifier/
)
assert.throws(
  () => createPermissionService({ getUserInfo: () => ({}), managerRole: 'sales_manager' }),
  /managerRole requires moduleId/
)

const directPermissions = ['op:direct', 'op:second']
const direct = createPermissionService({
  getUserInfo: () => ({ app_role: 'employee', permissions: directPermissions })
})
assert.equal(direct.getPermissions(), directPermissions)
assert.equal(direct.hasPerm(''), true)
assert.equal(direct.hasPerm('op:direct'), true)
assert.equal(direct.hasPerm('op:missing'), false)
assert.equal(direct.hasAnyPerm([]), true)
assert.equal(direct.hasAnyPerm(['op:missing', 'op:second']), true)
assert.equal(direct.hasAllPerm([]), true)
assert.equal(direct.hasAllPerm(['op:direct', 'op:second']), true)
assert.equal(direct.hasAllPerm(['op:direct', 'op:missing']), false)

for (const userInfo of [
  { app_role: 'super_admin' },
  { appRole: 'super_admin' },
  { role: 'super_admin' }
]) {
  const service = createPermissionService({ getUserInfo: () => userInfo })
  assert.equal(service.hasPerm('op:anything'), true)
  assert.equal(service.hasAnyPerm(['op:anything']), true)
  assert.equal(service.hasAllPerm(['op:anything']), true)
}

const safeFailure = createPermissionService({ getUserInfo: () => { throw new Error('storage disabled') } })
assert.deepEqual(safeFailure.getPermissions(), [])
assert.equal(safeFailure.hasPerm('op:anything'), false)
assert.equal(safeFailure.hasAnyPerm([]), true)

const strictFailure = createPermissionService({
  getUserInfo: () => { throw new Error('strict read failure') },
  catchReadErrors: false
})
assert.throws(() => strictFailure.getPermissions(), /strict read failure/)
assert.throws(() => strictFailure.hasPerm('op:anything'), /strict read failure/)

const salesModule = createPermissionService({
  getUserInfo: () => ({ permissions: ['module:sales'] }),
  moduleId: 'sales',
  managerRole: 'sales_manager'
})
assert.equal(salesModule.hasPerm('module:sales'), true)
assert.equal(salesModule.hasPerm('app:sales_order'), true)
assert.equal(salesModule.hasPerm('op:sales_create'), true)
assert.equal(salesModule.hasPerm('op:purchase_create'), false)
assert.equal(salesModule.hasAnyPerm(['op:missing', 'app:sales_order']), true)
assert.equal(salesModule.hasAllPerm(['app:sales_order', 'op:sales_create']), true)
assert.equal(salesModule.hasAllPerm(['module:sales', 'op:sales_create']), false)

const salesManager = createPermissionService({
  getUserInfo: () => ({ role: 'sales_manager', permissions: [] }),
  moduleId: 'sales',
  managerRole: 'sales_manager'
})
assert.equal(salesManager.hasPerm('module:sales'), true)
assert.equal(salesManager.hasAllPerm(['module:sales', 'app:sales_order', 'op:sales_create']), true)

const purchaseModule = createPermissionService({
  getUserInfo: () => ({ permissions: ['module:purchase'] }),
  moduleId: 'purchase',
  managerRole: 'purchase_manager'
})
assert.equal(purchaseModule.hasPerm('app:purchase_order'), true)
assert.equal(purchaseModule.hasAllPerm(['app:purchase_order', 'op:purchase_create']), true)
assert.equal(purchaseModule.hasPerm('op:sales_create'), false)

const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'packages/eiscore-platform/package.json'), 'utf8'))
assert.equal(packageJson.exports['./permission'], './src/permission.mjs')
console.log('PASS: platform permission service preserves generic and module-manager policies')
