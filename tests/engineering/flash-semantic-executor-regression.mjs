// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { FlashToolError } = require('../../realtime/flash-postgrest-adapter')
const { createFlashSemanticExecutor } = require('../../realtime/flash-semantic-executor')
const repoRoot = resolve(import.meta.dirname, '../..')

const pgCalls = []
const ensureCalls = []
const pgResults = []
const ensureResults = []
const draftCalls = []
const user = { id: 17, username: 'operator' }
const callContext = {
  traceId: 'trace-17',
  appId: 'app-context',
  context: {
    reason: 'context reason',
    moduleName: '库存',
    appName: '库存应用',
    routePath: '/inventory'
  },
  authorizationContext: {
    apps: [{ app_id: 'orders-app', acl_module: 'orders_app', qualified_table: 'app_data.orders' }],
    columns: {
      'app_data.orders': [
        { col: 'id' },
        { col: 'name' },
        { col: 'secret' }
      ]
    },
    fieldAcl: { orders_app: { secret: { canView: false, canEdit: false } } },
    fieldAclAvailable: true
  }
}

const sanitizeQueryParams = (query = {}) => Object.fromEntries(
  Object.entries(query || {})
    .filter(([key, value]) => String(key).trim() && value !== undefined && value !== null)
    .map(([key, value]) => [String(key).trim(), String(value)])
)
const resolveDataTableTarget = (value) => {
  const raw = String(value || '').trim()
  if (!raw || !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(raw)) {
    throw new FlashToolError('VALIDATION_FAILED', 'table is invalid', { httpStatus: 400 })
  }
  const [schema, table] = raw.includes('.') ? raw.split('.', 2) : ['app_data', raw]
  return { schema, table }
}
const requireNonEmptyText = (value, fieldName) => {
  const text = String(value ?? '').trim()
  if (!text) throw new FlashToolError('VALIDATION_FAILED', `${fieldName} is required`, { httpStatus: 400 })
  return text
}
const executor = createFlashSemanticExecutor({
  callPostgrestWithFlashTableEnsure: async (...args) => {
    ensureCalls.push(args)
    return ensureResults.shift() || { status: 200, data: [] }
  },
  callPostgrestWithUser: async (...args) => {
    pgCalls.push(args)
    return pgResults.shift() || { status: 200, data: [] }
  },
  inferFlashDataColumnsFromPayload: (payload) => Object.keys(payload).map((field) => ({ field, label: field, type: 'text' })),
  normalizeText: (value) => String(value ?? '').trim(),
  normalizeToolCallBoolean: (value) => ['1', 'true', 'yes', 'y'].includes(String(value ?? '').trim().toLowerCase()) || value === true,
  readFlashDraftSource: async (appId) => {
    draftCalls.push({ type: 'read', appId })
    return { content: 'draft source' }
  },
  requireNonEmptyText,
  resolveDataTableTarget,
  sanitizeQueryParams,
  uploadFlashAttachment: async (args, currentUser) => {
    draftCalls.push({ type: 'upload', args, user: currentUser })
    return { name: 'note.txt' }
  },
  writeFlashDraftSource: async (content, reason, currentUser, appId) => {
    draftCalls.push({ type: 'write', content, reason, user: currentUser, appId })
    return { saved: true }
  }
})
assert.equal(Object.isFrozen(executor), true)
assert.deepEqual(Object.keys(executor), ['executeFlashSemanticTool'])

pgResults.push({ data: [{ id: 2 }, { id: 1 }] })
const appList = await executor.executeFlashSemanticTool('flash.app.list', {
  filters: { status: 'eq.active', ignored: undefined },
  limit: 999
}, user, callContext)
assert.deepEqual(pgCalls.shift(), [user, {
  method: 'GET',
  path: '/apps',
  query: { status: 'eq.active', order: 'id.desc', limit: '200' },
  acceptProfile: 'app_center',
  traceId: 'trace-17'
}])
assert.deepEqual(appList, {
  message: '应用列表查询成功',
  data: { items: [{ id: 2 }, { id: 1 }] },
  rowsAffected: 2
})

pgResults.push({ data: ' app_data.orders ' })
const ensuredTable = await executor.executeFlashSemanticTool('flash.data.table.ensure', {
  table: 'orders',
  columns: [{ field: 'name' }]
}, user, callContext)
assert.deepEqual(pgCalls.shift(), [user, {
  method: 'POST',
  path: '/rpc/create_data_app_table',
  body: { app_id: 'app-context', table_name: 'orders', columns: [{ field: 'name' }] },
  acceptProfile: 'app_center',
  contentProfile: 'app_center',
  traceId: 'trace-17'
}])
assert.deepEqual(ensuredTable, {
  message: '数据应用表初始化成功',
  data: { table: 'app_data.orders' },
  rowsAffected: 1
})

ensureResults.push({ data: [{ id: 9, name: 'created' }] })
const gridCreate = await executor.executeFlashSemanticTool('flash.data.grid.create', {
  table: 'app_data.orders',
  payload: { name: 'created', enabled: true }
}, user, callContext)
assert.deepEqual(ensureCalls.shift(), [
  user,
  { schema: 'app_data', table: 'orders' },
  'app-context',
  {
    method: 'POST',
    path: '/orders',
    body: { name: 'created', enabled: true },
    acceptProfile: 'app_data',
    contentProfile: 'app_data',
    prefer: 'return=representation',
    traceId: 'trace-17'
  },
  [
    { field: 'name', label: 'name', type: 'text' },
    { field: 'enabled', label: 'enabled', type: 'text' }
  ]
])
assert.equal(gridCreate.data.item.id, 9)

ensureResults.push({ data: [{ id: 10, name: 'visible', secret: 'must not escape' }] })
const gridList = await executor.executeFlashSemanticTool('flash.data.grid.list', {
  table: 'app_data.orders',
  query: { select: '*' }
}, user, callContext)
assert.equal(ensureCalls.shift()[3].query.select, 'id,name')
assert.deepEqual(gridList.data.items, [{ id: 10, name: 'visible' }])

const callsBeforeDeniedFields = ensureCalls.length
await assert.rejects(
  executor.executeFlashSemanticTool('flash.data.grid.list', {
    table: 'app_data.orders',
    query: { secret: 'eq.hidden' }
  }, user, callContext),
  (error) => error.code === 'PERMISSION_DENIED'
)
await assert.rejects(
  executor.executeFlashSemanticTool('flash.data.grid.update', {
    table: 'app_data.orders', id: '10', payload: { secret: 'changed' }
  }, user, callContext),
  (error) => error.code === 'PERMISSION_DENIED'
)
assert.equal(ensureCalls.length, callsBeforeDeniedFields, 'denied field filters and writes stop before the database call')

await assert.rejects(
  executor.executeFlashSemanticTool('flash.hr.archive.list', {}, user, {
    ...callContext,
    authorizationContext: { fieldAclAvailable: false }
  }),
  (error) => error.code === 'PERMISSION_DENIED',
  'field ACL lookup failure fails closed for fixed HR tables'
)

pgResults.push({ data: { id: 33, status: 'completed' } })
const transitioned = await executor.executeFlashSemanticTool('flash.workflow.instance.transition', {
  instanceId: '33',
  nextTaskId: 'Task_Next',
  complete: 'yes',
  variables: { approved: true }
}, user, callContext)
assert.deepEqual(pgCalls.shift(), [user, {
  method: 'POST',
  path: '/rpc/transition_workflow_instance',
  body: {
    p_instance_id: 33,
    p_next_task_id: null,
    p_complete: true,
    p_variables: { approved: true }
  },
  acceptProfile: 'workflow',
  contentProfile: 'workflow',
  traceId: 'trace-17'
}])
assert.deepEqual(transitioned.data.item, { id: 33, status: 'completed' })

pgResults.push({ data: { transaction_id: 8 } })
const stockOut = await executor.executeFlashSemanticTool('flash.inventory.stock.out', {
  materialId: '7',
  warehouseId: 'WH-A',
  quantity: '2.5',
  unit: 'kg',
  batchNo: 'B-1',
  productionDate: '2026-08-31',
  remark: 'issued'
}, user, callContext)
const stockCall = pgCalls.shift()
assert.equal(stockCall[1].path, '/rpc/stock_out')
assert.equal(stockCall[1].acceptProfile, 'scm')
assert.equal(stockCall[1].contentProfile, 'scm')
assert.deepEqual(stockCall[1].body, {
  p_material_id: 7,
  p_warehouse_id: 'WH-A',
  p_quantity: 2.5,
  p_unit: 'kg',
  p_batch_no: 'B-1',
  p_transaction_no: null,
  p_operator: null,
  p_remark: 'issued'
})
assert.equal(stockOut.message, '库存出库执行成功')
assert.equal(stockOut.rowsAffected, 1)

pgResults.push(
  { data: [{ id: 6, table_schema: 'app_data', table_name: 'orders' }] },
  { data: [{ id: 6, semantic_name: '订单' }] }
)
const enriched = await executor.executeFlashSemanticTool('flash.ontology.semantic.enrich', {
  table: 'orders',
  payload: { semantic_name: '订单', created_at: 'remove-me' }
}, user, callContext)
assert.deepEqual(pgCalls.shift()[1], {
  method: 'GET',
  path: '/ontology_table_semantics',
  query: { table_schema: 'eq.app_data', table_name: 'eq.orders', limit: '1' },
  acceptProfile: 'public',
  traceId: 'trace-17'
})
const enrichPatch = pgCalls.shift()[1]
assert.equal(enrichPatch.method, 'PATCH')
assert.equal(enrichPatch.contentProfile, 'public')
assert.deepEqual(enrichPatch.query, { table_schema: 'eq.app_data', table_name: 'eq.orders' })
assert.deepEqual(enrichPatch.body, {
  semantic_name: '订单',
  table_schema: 'app_data',
  table_name: 'orders',
  is_active: true
})
assert.equal(enriched.message, '本体语义已更新')

assert.deepEqual(
  await executor.executeFlashSemanticTool('flash.draft.read', { app_id: 'draft-app' }, user, callContext),
  { message: '草稿读取成功', data: { content: 'draft source' }, rowsAffected: 1 }
)
assert.deepEqual(
  await executor.executeFlashSemanticTool('flash.draft.write', { content: '<template/>', appId: 'draft-app' }, user, callContext),
  { message: '草稿已保存', data: { saved: true }, rowsAffected: 1 }
)
assert.deepEqual(
  await executor.executeFlashSemanticTool('flash.attachment.upload', { name: 'note.txt' }, user, callContext),
  { message: '附件上传成功', data: { file: { name: 'note.txt' } }, rowsAffected: 1 }
)
assert.deepEqual(draftCalls, [
  { type: 'read', appId: 'draft-app' },
  { type: 'write', content: '<template/>', reason: 'context reason', user, appId: 'draft-app' },
  { type: 'upload', args: { name: 'note.txt' }, user }
])

pgResults.push({ data: [{ id: 17, status: 'published' }] })
await executor.executeFlashSemanticTool('flash.app.publish', {
  appId: '17',
  payload: { name: 'Demo', published_at: 'remove', published_by: 'remove' }
}, user, callContext)
assert.deepEqual(pgCalls.shift()[1].body, { name: 'Demo', status: 'published' })

pgResults.push(
  { data: [{ id: 19 }] },
  { data: [{ id: 19, route_path: '/demo' }] }
)
const route = await executor.executeFlashSemanticTool('flash.route.upsert', {
  appId: '17',
  routePath: '/demo'
}, user, callContext)
const routeLookup = pgCalls.shift()[1]
const routePatch = pgCalls.shift()[1]
assert.deepEqual(routeLookup.query, {
  app_id: 'eq.17', route_path: 'eq./demo', order: 'id.desc', limit: '1'
})
assert.equal(routePatch.method, 'PATCH')
assert.deepEqual(routePatch.query, { id: 'eq.19' })
assert.deepEqual(routePatch.body, { app_id: '17', route_path: '/demo', is_active: true })
assert.equal(route.message, '发布路由已更新')

pgResults.push({ data: [{ id: 55 }] })
const audit = await executor.executeFlashSemanticTool('flash.audit.write', {
  payload: {
    appId: '17',
    event_type: 'stock_update',
    event_message: '库存已更新',
    severity: 'error'
  }
}, user, callContext)
const auditCall = pgCalls.shift()[1]
assert.equal(auditCall.path, '/execution_logs')
assert.deepEqual(auditCall.body, {
  app_id: '17',
  task_id: 'stock_update',
  operation_location: {
    address: '模块:库存 / 应用:库存应用 / 操作:库存已更新',
    module: '库存',
    app: '库存应用',
    action: '库存已更新',
    app_id: '17',
    route_path: '/inventory',
    source: 'system_audit'
  },
  status: 'failed',
  executed_by: '17',
  output_data: {
    event_message: '库存已更新',
    severity: 'error',
    trace_id: 'trace-17'
  }
})
assert.equal(audit.data.item.id, 55)

await assert.rejects(
  executor.executeFlashSemanticTool('flash.app.create', {}, user, callContext),
  (error) => error instanceof FlashToolError && error.code === 'VALIDATION_FAILED' && error.httpStatus === 400
)
await assert.rejects(
  executor.executeFlashSemanticTool('flash.not-supported', {}, user, callContext),
  (error) => error instanceof FlashToolError && error.code === 'TOOL_NOT_FOUND' && error.httpStatus === 404
)

const registrySource = readFileSync(resolve(repoRoot, 'realtime/flash-tool-registry.js'), 'utf8')
const executorSource = readFileSync(resolve(repoRoot, 'realtime/flash-semantic-executor.js'), 'utf8')
const registryIds = [...registrySource.matchAll(/defineTool\('(flash\.[^']+)'/g)].map((match) => match[1])
const executorIds = [...executorSource.matchAll(/case '(flash\.[^']+)'/g)].map((match) => match[1])
assert.equal(registryIds.length, 43)
assert.equal(executorIds.length, 43)
assert.deepEqual([...new Set(executorIds)].sort(), [...new Set(registryIds)].sort())

const compositionRoot = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(compositionRoot, /require\('\.\/flash-semantic-executor'\)/)
assert.match(compositionRoot, /createFlashSemanticExecutor\(/)
assert.doesNotMatch(
  compositionRoot,
  /(async function executeFlashSemanticTool|case 'flash\.|function (toPlainObject|normalizeLimit|normalizeExecutionLogStatus|firstNonEmptyText|toJsonObjectOrNull|normalizeOperationLocation|normalizeExecutionLogPayload|encodeInList))/
)
assert.ok(compositionRoot.split(/\r?\n/).length <= 3290, 'Realtime composition root must not regain Flash semantic tool matrix')

console.log('PASS: Flash semantic executor covers all 43 registry tools and preserves representative app, data, workflow, inventory, ontology, draft, publish and audit contracts')
