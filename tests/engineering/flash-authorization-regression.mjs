// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createFlashAuthorization, STATIC_POLICIES } = require('../../realtime/flash-authorization')
const { createFlashToolRegistry } = require('../../realtime/flash-tool-registry')

const accessContext = {
  source: 'flash_agent_context_v1',
  accessPolicy: { roleScoped: true, superUser: false, roles: ['sales_operator'] },
  permissions: [
    { code: 'module:app' },
    { code: 'app:app_orders' },
    { code: 'op:app_orders.edit' },
    { code: 'app:hr_employee' }
  ],
  apps: [
    { app_id: 'orders-app', app_name: '订单', acl_module: 'app_orders', qualified_table: 'app_data.orders' },
    { app_id: 'hr-app', app_name: '员工', acl_module: 'hr_employee', qualified_table: 'hr.archives' }
  ],
  tables: [
    { table_schema: 'app_data', table_name: 'orders', access_level: 'read' },
    { table_schema: 'hr', table_name: 'archives', access_level: 'read' }
  ],
  columns: {},
  fieldAcl: {}
}
const requests = []
const authorization = createFlashAuthorization({
  callPostgrestWithUser: async (user, options) => {
    requests.push({ user, options })
    if (options.path === '/roles') return { data: [
      { id: '11111111-1111-4111-8111-111111111111', code: 'sales_operator' }
    ] }
    if (options.path === '/sys_field_acl') return { data: [
      { module: 'orders_app', field_code: 'margin', can_view: false, can_edit: false }
    ] }
    return { data: accessContext }
  }
})
const user = { id: 'u-1', username: 'sales', role: 'sales_operator' }

assert.equal(Object.keys(STATIC_POLICIES).length, 19)
const allRegistryIds = createFlashToolRegistry().getFlashToolRegistryPayload().tools.map((tool) => tool.tool_id).sort()
assert.deepEqual(allRegistryIds, Object.keys(STATIC_POLICIES).sort(), 'every registered EISCore capability has an authorization policy')
const visibleIds = await authorization.getVisibleToolIds(user)
assert.equal(visibleIds.includes('flash.draft.read'), true, 'non-EISCore assistant tools stay available')
assert.equal(visibleIds.includes('flash.draft.write'), false, 'draft writes require app configuration permission')
assert.equal(visibleIds.includes('flash.app.list'), true)
assert.equal(visibleIds.includes('flash.data.grid.list'), true)
assert.equal(visibleIds.includes('flash.data.grid.update'), true)
assert.equal(visibleIds.includes('flash.data.grid.delete'), false)
assert.equal(visibleIds.includes('flash.hr.archive.list'), false)
assert.equal(visibleIds.includes('flash.inventory.stock.in'), false)
assert.equal(visibleIds.some((toolId) => /^(flash\.(workflow|inventory|material|warehouse|hr|ontology))\./.test(toolId)), false)

const registry = createFlashToolRegistry({ getVisibleToolIds: authorization.getVisibleToolIds })
const registryPayload = await registry.getFlashToolRegistryPayload(user)
assert.equal(registryPayload.tools_count, visibleIds.length)
assert.deepEqual(registryPayload.tools.map((tool) => tool.tool_id).sort(), [...visibleIds].sort())

const readAllowed = await authorization.authorizeFlashTool(user, 'flash.data.grid.list', { table: 'orders' })
assert.equal(readAllowed.allowed, true)
const updateAllowed = await authorization.authorizeFlashTool(user, 'flash.data.grid.update', { table: 'orders' })
assert.equal(updateAllowed.allowed, true)
const wrongTable = await authorization.authorizeFlashTool(user, 'flash.data.grid.list', { table: 'users' })
assert.equal(wrongTable.allowed, false, 'a caller cannot substitute an unlisted table')
const deleteDenied = await authorization.authorizeFlashTool(user, 'flash.data.grid.delete', { table: 'orders' })
assert.equal(deleteDenied.allowed, false, 'edit permission is not delete permission')
const appConfigDenied = await authorization.authorizeFlashTool(user, 'flash.app.save', { appId: 'orders-app' })
assert.equal(appConfigDenied.allowed, false, 'data edit permission is not application config permission')
const draftReadAllowed = await authorization.authorizeFlashTool(user, 'flash.draft.read', { appId: 'orders-app' })
assert.equal(draftReadAllowed.allowed, true, 'draft reads must stay inside an app the user can read')
const draftReadDenied = await authorization.authorizeFlashTool(user, 'flash.draft.read', { appId: 'missing-app' })
assert.equal(draftReadDenied.allowed, false, 'draft reads must reject an app outside the user context')
const draftWriteDenied = await authorization.authorizeFlashTool(user, 'flash.draft.write', { appId: 'orders-app' })
assert.equal(draftWriteDenied.allowed, false, 'draft writes must require app configuration permission')
assert.equal(requests.every((request) => request.user === user), true)
assert.equal(requests.some((request) => request.options.path === '/rpc/agent_ontology_context'), false,
  'Flash authorization must never call the shared business ontology context')
assert.equal(requests.some((request) => request.options.path === '/sys_field_acl'), true)
assert.equal(readAllowed.context.fieldAclAvailable, true)
assert.deepEqual(readAllowed.context.fieldAcl, { orders_app: { margin: { canView: false, canEdit: false } } })

const canonicalMaterialsContext = {
  ...accessContext,
  permissions: [{ code: 'module:mms' }],
  fieldAclAvailable: true,
  fieldAcl: { mms_ledger: { material_name: { canView: true, canEdit: false } } }
}
const canonicalMaterialsAuthorization = createFlashAuthorization({
  callPostgrestWithUser: async () => ({ data: canonicalMaterialsContext })
})
const canonicalMaterialsIds = await canonicalMaterialsAuthorization.getVisibleToolIds(user)
assert.equal(canonicalMaterialsIds.some((toolId) => /^(flash\.(workflow|inventory|material|warehouse|hr|ontology))\./.test(toolId)), false,
  'business modules must never enter the Flash programming catalog')

const missingRoleAcl = createFlashAuthorization({
  callPostgrestWithUser: async (_user, options) => {
    if (options.path === '/rpc/flash_agent_context') return { data: accessContext }
    if (options.path === '/roles') return { data: [] }
    throw new Error(`unexpected call: ${options.path}`)
  }
})
const missingAclIds = await missingRoleAcl.getVisibleToolIds(user)
assert.equal(missingAclIds.includes('flash.data.grid.list'), false)
assert.equal(missingAclIds.includes('flash.hr.archive.list'), false)
assert.equal(missingAclIds.includes('flash.draft.read'), true)
assert.equal(missingAclIds.includes('flash.draft.write'), false)

const adminContext = {
  ...accessContext,
  accessPolicy: { roleScoped: true, superUser: true, roles: ['super_admin'] },
  permissions: [],
  fieldAclAvailable: true
}
const administrator = createFlashAuthorization({
  callPostgrestWithUser: async () => ({ data: adminContext })
})
const adminVisibleIds = await administrator.getVisibleToolIds(user)
assert.equal(adminVisibleIds.includes('flash.app.delete'), true)
assert.equal(adminVisibleIds.includes('flash.data.grid.delete'), true)
assert.equal(adminVisibleIds.includes('flash.hr.archive.update'), false)

const unavailable = createFlashAuthorization({ callPostgrestWithUser: async () => { throw new Error('database offline') } })
assert.deepEqual(await unavailable.authorizeFlashTool(user, 'flash.app.list'), { allowed: false, context: null })
await assert.rejects(unavailable.getVisibleToolIds(user))

console.log('PASS: Flash capability catalog is role-scoped and each call denies unavailable or mismatched access')
