// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createTwinTools } = require('../../realtime/twin-tools')

const user = { username: 'operator' }
const allowedContext = {
  accessPolicy: { roleScoped: true, superUser: false, roles: ['employee'] },
  permissions: [{ code: 'app:hr_employee' }],
  apps: [],
  fieldAcl: { hr_employee: { phone: { canView: false, canEdit: false } } },
  fieldAclAvailable: true
}
const calls = []
const pgQuery = async (options) => {
  calls.push(options)
  return { data: [{ id: 7, employee_no: 'E7', name: '张三', department: '生产部', phone: 'private' }] }
}

const lockedTools = createTwinTools(pgQuery, user, null)
assert.equal(lockedTools.query_employees, undefined)
assert.equal(lockedTools.query_inventory, undefined)
assert.equal(typeof lockedTools.search_knowledge.execute, 'function')
assert.equal(typeof lockedTools.get_my_info.execute, 'function')
const incompleteAclTools = createTwinTools(pgQuery, user, { ...allowedContext, fieldAclAvailable: false })
assert.equal(incompleteAclTools.query_employees, undefined, 'business tools are hidden when field ACL context is incomplete')

const missingModuleAclTools = createTwinTools(pgQuery, user, {
  ...allowedContext,
  permissions: [{ code: 'app:mms_ledger' }]
})
assert.equal(missingModuleAclTools.query_inventory, undefined, 'business tools are hidden when their module ACL is absent')

const emptyModuleAclTools = createTwinTools(pgQuery, user, {
  ...allowedContext,
  fieldAcl: { hr_employee: {} }
})
assert.equal(emptyModuleAclTools.query_employees, undefined, 'an empty module ACL is treated as unavailable')

const selfInfoCalls = []
const selfInfoTools = createTwinTools(async (options) => {
  selfInfoCalls.push(options)
  return { data: [{ id: 7, username: 'operator', full_name: '张三' }] }
}, user, {
  ...allowedContext,
  fieldAcl: {},
  permissions: []
})
const selfInfo = await selfInfoTools.get_my_info.execute({})
assert.equal(selfInfoCalls.length, 0, 'self-info does not query tables without their module ACL')
assert.equal(selfInfo.account, null)
assert.equal(selfInfo.employee, '未找到对应HR员工档案')
assert.equal(selfInfo.warnings.length >= 2, true)

const inventoryContext = {
  ...allowedContext,
  permissions: [{ code: 'app:mms_ledger' }],
  fieldAcl: { mms_ledger: { material_name: { canView: true, canEdit: false } } }
}
const inventoryTools = createTwinTools(pgQuery, user, inventoryContext)
assert.equal(typeof inventoryTools.query_inventory.execute, 'function', 'a complete ACL for one module does not require unrelated modules')

const adminTools = createTwinTools(pgQuery, user, {
  ...allowedContext,
  accessPolicy: { roleScoped: true, superUser: true, roles: ['super_admin'] },
  permissions: []
})
assert.equal(typeof adminTools.query_employees.execute, 'function')
assert.equal(typeof adminTools.query_inventory.execute, 'function')

const adminInfoCalls = []
const adminInfoTools = createTwinTools(async (options) => {
  adminInfoCalls.push(options)
  return { data: [{ id: 7, username: 'operator', full_name: '张三' }] }
}, user, {
  ...allowedContext,
  accessPolicy: { roleScoped: true, superUser: true, roles: ['super_admin'] },
  permissions: [],
  fieldAcl: {}
})
await adminInfoTools.get_my_info.execute({})
assert.equal(adminInfoCalls.length > 0, true, 'super admins retain self-info table access without module rows')

let refreshed = 0
const revokedTools = createTwinTools(pgQuery, user, allowedContext, async () => {
  refreshed += 1
  return { ...allowedContext, permissions: [] }
})
await assert.rejects(
  revokedTools.query_employees.execute({}),
  (error) => error.code === 'PERMISSION_DENIED'
)
assert.equal(refreshed, 1)
assert.equal(calls.length, 0, 'revoked access is checked before querying HR data')

const activeTools = createTwinTools(pgQuery, user, allowedContext, async () => allowedContext)
const employeeResult = await activeTools.query_employees.execute({})
assert.equal(calls.length, 1)
assert.equal(calls[0].query.select.includes('phone'), false, 'denied fields are removed from default projections')
assert.equal(employeeResult[0].phone, '', 'restricted fields are stripped before record normalization')

await assert.rejects(
  activeTools.query_employees.execute({ select: 'phone' }),
  (error) => error.code === 'PERMISSION_DENIED'
)
assert.equal(calls.length, 1, 'explicitly requested hidden fields never reach PostgREST')

const revokedModuleAclTools = createTwinTools(pgQuery, user, allowedContext, async () => ({
  ...allowedContext,
  fieldAcl: {},
  permissions: [{ code: 'app:hr_employee' }]
}))
await assert.rejects(
  revokedModuleAclTools.query_employees.execute({}),
  (error) => error.code === 'PERMISSION_DENIED',
  'module ACL removal is denied before PostgREST is queried'
)
assert.equal(calls.length, 1, 'missing module ACL never reaches PostgREST')

console.log('PASS: Digital twin filters EISCore tools by current permissions and enforces fresh field ACLs per call')
