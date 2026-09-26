// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { createAiContextService } = require('../../realtime/ai-context-service')
const repoRoot = resolve(import.meta.dirname, '../..')

const dataByPath = new Map([
  ['/rpc/agent_ontology_context', {
    source: 'agent_ontology_context_v1',
    fetchedAt: '2026-09-01T01:02:03.000Z',
    accessPolicy: { roleScoped: true, superUser: true, roles: ['super_admin'], permissionCount: 1 },
    tables: [{ table_schema: 'scm', table_name: 'inventory', semantic_name: '库存', semantic_description: '实时库存', tags: ['stock'], access_level: 'read' }],
    columns: {
      'scm.inventory': [
        { col: 'qty', name: '数量', cls: 'measure', type: 'numeric', ui: 'number', sensitive: false },
        { col: 'warehouse_id', name: '仓库', cls: 'dimension', type: 'uuid', ui: 'select', sensitive: false }
      ]
    },
    relations: [{ subject_table: 'scm.inventory', predicate: 'belongs_to', object_table: 'public.materials', subject_semantic_name: '库存', object_semantic_name: '物料', relation_type: 'ontology' }],
    apps: [{ app_id: 'inventory-app', app_name: '库存应用', acl_module: 'mms_ledger', qualified_table: 'scm.inventory' }],
    permissions: [{ code: 'app:mms_ledger', scope: 'app', semantic_kind: 'app', entity_key: 'mms_ledger', action_key: null }]
  }],
  ['/warehouses', [
    { id: 1, code: 'W1', name: '一号仓', level: 1, status: '启用' },
    { id: 2, code: 'W2', name: '二号仓', level: 1, status: '停用' }
  ]],
  ['/v_inventory_current', [
    { warehouse_name: '一号仓', material_name: '钢材', material_code: 'M1', available_qty: 12, unit: 'kg' },
    { warehouse_name: '二号仓', material_name: '铜材', material_code: 'M2', available_qty: '8', unit: 'kg' }
  ]],
  ['/v_inventory_transactions', [
    { transaction_type: '入库', io_type: 'purchase', material_name: '钢材', material_code: 'M1', quantity: 5, unit: 'kg', warehouse_name: '一号仓', transaction_date: '2026-08-30' },
    { transaction_type: '出库', io_type: 'production', material_name: '铜材', material_code: 'M2', quantity: 2, unit: 'kg', warehouse_name: '二号仓', transaction_date: '2026-08-29' }
  ]],
  ['/raw_materials', [{ id: 1, name: '钢材', category: '金属' }, { id: 2, name: '铜材', category: '金属' }, { id: 3, name: '辅料', category: null }]],
  ['/archives', [{ id: 1, department: '生产部', status: '在职' }, { id: 2, department: '生产部', status: '在职' }, { id: 3, department: null, status: '离职' }]],
  ['/employees', [{ id: 9, department: '兼容部门' }]],
  ['/inventory_checks', [{ id: 1, status: '已完成' }, { id: 2, status: '草稿' }]],
  ['/sales_customers', [
    { name: '客户A', level: 'A', credit_limit: 100, receivable_balance: 120 },
    { name: '客户B', level: 'B', credit_limit: 200, receivable_balance: 20 }
  ]],
  ['/sales_orders', [
    { order_no: 'S1', customer_name: '客户A', product_name: '产品A', total_amount: 300, order_status: '执行中', delivery_date: '2026-09-02' },
    { order_no: 'S2', customer_name: '客户B', product_name: '产品B', total_amount: '200', order_status: '完成', delivery_date: '2026-08-20' }
  ]],
  ['/sales_opportunities', [{ expected_amount: 800, stage: '报价' }, { expected_amount: 200, stage: '赢单' }]],
  ['/sales_payments', [{ amount: 250 }, { amount: '50' }]],
  ['/purchase_suppliers', [{ lead_time_days: 4 }, { lead_time_days: 6 }]],
  ['/purchase_demands', [{ demand_status: '待采购' }, { demand_status: '已完成' }]],
  ['/purchase_orders', [
    { order_no: 'P1', supplier_name: '供应商A', material_name: '钢材', total_amount: 400, expected_arrival_date: '2026-09-03', order_status: '待到货' },
    { order_no: 'P2', supplier_name: '供应商B', material_name: '铜材', total_amount: 100, expected_arrival_date: '2026-08-20', order_status: '已到货' }
  ]],
  ['/purchase_arrivals', [
    { arrival_quantity: 100, accepted_quantity: 95, iqc_status: '合格' },
    { arrival_quantity: 20, accepted_quantity: 10, iqc_status: '不合格' }
  ]],
  ['/v_production_work_orders', [
    { work_order_no: 'WO1', product_material_name: '产品A', planned_qty: 100, item_count: 5, shortage_item_count: 2, work_order_status: '生产中', priority: '高', planned_finish_date: '2026-09-03' },
    { work_order_no: 'WO2', product_material_name: '产品B', planned_qty: 50, item_count: 3, shortage_item_count: 0, work_order_status: '待排产', priority: '普通', planned_finish_date: '2026-09-05' }
  ]],
  ['/quality_inspections', [
    { sample_qty: 100, defect_qty: 2, result: '合格' },
    { sample_qty: 20, defect_qty: 5, result: '不合格' }
  ]],
  ['/quality_ncrs', [{ doc_no: 'N1', issue_desc: '尺寸异常', severity: '严重', owner_dept: '生产部', deadline: '2026-09-04', ncr_status: '整改中' }, { doc_no: 'N2', severity: '一般', ncr_status: '已关闭' }]],
  ['/quality_corrective_actions', [{ action_status: '执行中' }, { action_status: '完成' }]],
  ['/quality_audits', [{ finding_count: 3 }, { finding_count: 2 }]],
  ['/equipment_assets', [
    { asset_no: 'E1', asset_name: '机床', run_status: '运行', health_score: 90, owner_name: '张三', next_maint_date: '2026-09-10' },
    { asset_no: 'E2', asset_name: '冲床', run_status: '停机', health_score: 60, owner_dept: '设备部', next_maint_date: '2026-09-02' }
  ]],
  ['/equipment_checks', [{ abnormal_count: 0, check_result: '正常' }, { abnormal_count: 2, check_result: '异常' }]],
  ['/equipment_issues', [{ issue_level: '紧急', issue_status: '处理中' }, { issue_level: '一般', issue_status: '已关闭' }]],
  ['/equipment_work_orders', [{ downtime_hours: 3, work_status: '完成' }, { downtime_hours: 2, work_status: '处理中' }]],
  ['/equipment_maintenance_plans', [{ completion_rate: 80 }, { completion_rate: 100 }]],
  ['/apps', [{ name: '库存应用', app_type: 'data', status: 'published' }, { name: '质量应用', app_type: 'workflow', status: 'draft' }]]
  ,['/roles', [
    { id: '11111111-1111-4111-8111-111111111111', code: 'super_admin' }
  ]]
  ,['/sys_field_acl', [
    { module: 'mms_ledger', field_code: 'qty', can_view: true, can_edit: false },
    { module: 'mms_ledger', field_code: 'qty', can_view: false, can_edit: true },
    { module: 'mms_ledger', field_code: 'cost', can_view: false, can_edit: false }
  ]]
])

const calls = []
const logs = []
const user = { id: 7, username: 'operator' }
const service = createAiContextService({
  callPostgrestWithUser: async (actualUser, options) => {
    calls.push({ actualUser, options })
    return { data: dataByPath.get(options.path) }
  },
  log: {
    log: (...args) => logs.push(['log', ...args]),
    warn: (...args) => logs.push(['warn', ...args])
  },
  now: () => new Date('2026-09-01T01:02:03.000Z')
})
assert.equal(Object.isFrozen(service), true)

const semantic = await service.fetchSemanticContext(user)
assert.deepEqual(semantic, {
  fetchedAt: '2026-09-01T01:02:03.000Z',
  source: 'agent_ontology_context_v1',
  accessPolicy: { roleScoped: true, superUser: true, roles: ['super_admin'], permissionCount: 1 },
  tables: [{ schema: 'scm', table: 'inventory', name: '库存', desc: '实时库存', tags: ['stock'], access: 'read' }],
  columns: {
    'scm.inventory': [
      { col: 'qty', name: '数量', cls: 'measure', type: 'numeric', ui: 'number', sensitive: false },
      { col: 'warehouse_id', name: '仓库', cls: 'dimension', type: 'uuid', ui: 'select', sensitive: false }
    ]
  },
  relations: [{ from: 'scm.inventory', to: 'public.materials', predicate: 'belongs_to', fromName: '库存', toName: '物料' }],
  apps: [{ app_id: 'inventory-app', app_name: '库存应用', acl_module: 'mms_ledger', qualified_table: 'scm.inventory' }],
  fieldAcl: { mms_ledger: { qty: { canView: true, canEdit: true }, cost: { canView: false, canEdit: false } } },
  fieldAclAvailable: true,
  permissions: [{ code: 'app:mms_ledger', scope: 'app', kind: 'app', entity: 'mms_ledger', action: '' }]
})
assert.deepEqual(calls.slice(0, 1).map((call) => [call.options.path, call.options.method, call.options.body, call.options.acceptProfile, call.options.contentProfile, call.options.timeoutMs]), [
  ['/rpc/agent_ontology_context', 'POST', { p_query: '', p_limit: 200 }, 'public', 'public', 5000]
])
assert.deepEqual(calls.slice(1, 3).map((call) => [call.options.path, call.options.query?.select]), [
  ['/roles', 'id,code'],
  ['/sys_field_acl', 'module,field_code,can_view,can_edit']
])

const snapshot = await service.fetchBusinessSnapshot(user, semantic)
assert.deepEqual(snapshot.warehouses, {
  total: 2,
  list: [
    { code: 'W1', name: '一号仓', level: 1, status: '启用' },
    { code: 'W2', name: '二号仓', level: 1, status: '停用' }
  ]
})
assert.deepEqual(snapshot.inventory, {
  totalRecords: 2,
  totalQty: 20,
  materialCount: 2,
  warehouseNames: ['一号仓', '二号仓'],
  top10: [
    { warehouse: '一号仓', material: '钢材', code: 'M1', qty: 12, unit: 'kg' },
    { warehouse: '二号仓', material: '铜材', code: 'M2', qty: '8', unit: 'kg' }
  ]
})
assert.deepEqual(snapshot.recentTransactions, {
  total: 2,
  inCount: 1,
  outCount: 1,
  latest: [
    { type: '入库', ioType: 'purchase', material: '钢材', code: 'M1', qty: 5, unit: 'kg', warehouse: '一号仓', date: '2026-08-30' },
    { type: '出库', ioType: 'production', material: '铜材', code: 'M2', qty: 2, unit: 'kg', warehouse: '二号仓', date: '2026-08-29' }
  ]
})
assert.deepEqual(snapshot.materials, { total: 3, byCategory: { 金属: 2, 未分类: 1 } })
assert.deepEqual(snapshot.employees, { total: 3, byDepartment: { 生产部: 2, 未分配: 1 } })
assert.deepEqual(snapshot.inventoryChecks, { total: 2, byStatus: { 已完成: 1, 草稿: 1 } })
assert.equal(snapshot.sales.orderAmount, 500)
assert.equal(snapshot.sales.paidAmount, 300)
assert.equal(snapshot.sales.receivableBalance, 140)
assert.equal(snapshot.sales.opportunityAmount, 1000)
assert.deepEqual(snapshot.sales.byOrderStatus, { 执行中: 1, 完成: 1 })
assert.equal(snapshot.sales.receivableRisk[0].overCredit, true)
assert.equal(snapshot.purchase.purchaseAmount, 500)
assert.equal(snapshot.purchase.arrivalQty, 120)
assert.equal(snapshot.purchase.acceptedQty, 105)
assert.equal(snapshot.purchase.acceptanceRate, 87.5)
assert.equal(snapshot.purchase.avgSupplierLeadTimeDays, 5)
assert.equal(snapshot.purchase.pendingArrivals.length, 1)
assert.equal(snapshot.production.plannedQty, 150)
assert.equal(snapshot.production.shortageItemCount, 2)
assert.equal(snapshot.production.shortageOrderCount, 1)
assert.equal(snapshot.quality.defectRate, 5.83)
assert.equal(snapshot.quality.passRate, 50)
assert.equal(snapshot.quality.auditFindingCount, 5)
assert.equal(snapshot.quality.openNcrs.length, 1)
assert.equal(snapshot.equipment.avgHealthScore, 75)
assert.equal(snapshot.equipment.abnormalCheckCount, 1)
assert.equal(snapshot.equipment.openIssueCount, 1)
assert.equal(snapshot.equipment.downtimeHours, 5)
assert.equal(snapshot.equipment.avgPlanCompletionRate, 90)
assert.equal(snapshot.equipment.riskAssets.length, 1)
assert.deepEqual(snapshot.apps, {
  total: 2,
  list: [
    { name: '库存应用', type: 'data', status: 'published' },
    { name: '质量应用', type: 'workflow', status: 'draft' }
  ]
})
assert.equal(snapshot.snapshotTime, '2026-09-01T01:02:03.000Z')
assert.deepEqual(snapshot._meta, { partial: false, accessControlled: true, deniedDomains: [], failedSourceCount: 0, failedSources: [] })

const snapshotCalls = calls.slice(3)
assert.equal(snapshotCalls.length, 25)
assert.equal(snapshotCalls.every((call) => call.actualUser === user && call.options.timeoutMs === 5000), true)
assert.deepEqual(snapshotCalls.map((call) => [call.options.path, call.options.acceptProfile]), [
  ['/warehouses', 'scm'],
  ['/v_inventory_current', 'scm'],
  ['/v_inventory_transactions', 'scm'],
  ['/raw_materials', 'public'],
  ['/archives', 'hr'],
  ['/inventory_checks', 'scm'],
  ['/sales_customers', 'public'],
  ['/sales_orders', 'public'],
  ['/sales_opportunities', 'public'],
  ['/sales_payments', 'public'],
  ['/purchase_suppliers', 'public'],
  ['/purchase_demands', 'public'],
  ['/purchase_orders', 'public'],
  ['/purchase_arrivals', 'public'],
  ['/v_production_work_orders', 'scm'],
  ['/quality_inspections', 'public'],
  ['/quality_ncrs', 'public'],
  ['/quality_corrective_actions', 'public'],
  ['/quality_audits', 'public'],
  ['/equipment_assets', 'public'],
  ['/equipment_checks', 'public'],
  ['/equipment_issues', 'public'],
  ['/equipment_work_orders', 'public'],
  ['/equipment_maintenance_plans', 'public'],
  ['/apps', 'app_center']
])
assert.equal(logs.some((entry) => entry[0] === 'log' && String(entry[1]).includes('tables:1, columns:2, relations:1, permissions:1')), true)
assert.equal(logs.some((entry) => entry[0] === 'log' && String(entry[1]).includes('partial=no')), true)

const restrictedCalls = []
const restrictedService = createAiContextService({
  callPostgrestWithUser: async (actualUser, options) => {
    restrictedCalls.push({ actualUser, options })
    const data = dataByPath.get(options.path)
    if (options.path === '/v_inventory_current' && Array.isArray(data)) {
      // Keep the forbidden source field in the fixture so result filtering is
      // exercised independently from the generated PostgREST select list.
      return { data: data.map((row) => ({ ...row, cost: 999 })) }
    }
    return { data }
  },
  log: { log() {}, warn() {} },
  now: () => new Date('2026-09-01T01:02:03.000Z')
})
const restrictedContext = {
  accessPolicy: { roleScoped: true, superUser: false, roles: ['inventory_viewer'] },
  permissions: [{ code: 'app:mms_ledger' }],
  fieldAcl: {
    mms_ledger: {
      material_name: { canView: false, canEdit: false },
      cost: { canView: false, canEdit: false }
    }
  },
  fieldAclAvailable: true
}
const restrictedSnapshot = await restrictedService.fetchBusinessSnapshot(user, restrictedContext)
assert.equal(restrictedSnapshot.inventory.totalRecords, 2)
assert.equal(restrictedSnapshot.inventory.totalQty, 20)
assert.equal(restrictedSnapshot.inventory.top10[0].material, undefined)
assert.equal(restrictedSnapshot.sales, undefined)
assert.equal(restrictedSnapshot.quality, undefined)
assert.equal(restrictedSnapshot.equipment, undefined)
assert.equal(restrictedSnapshot.production, undefined)
assert.equal(restrictedSnapshot._meta.accessControlled, true)
assert.deepEqual(restrictedSnapshot._meta.deniedDomains, ['apps', 'employees', 'equipment', 'production', 'purchase', 'quality', 'sales'])
assert.equal(restrictedCalls.some((call) => ['/sales_customers', '/sales_orders', '/quality_ncrs', '/equipment_assets'].includes(call.options.path)), false)
const restrictedInventoryCall = restrictedCalls.find((call) => call.options.path === '/v_inventory_current')
assert.equal(restrictedInventoryCall.options.query.select.includes('material_name'), false)
assert.equal(restrictedInventoryCall.options.query.select.includes('cost'), false)

const partialCalls = []
const partialService = createAiContextService({
  callPostgrestWithUser: async (_user, options) => {
    partialCalls.push(options.path)
    if (options.path === '/archives') throw new Error('hr unavailable')
    return { data: dataByPath.get(options.path) || [] }
  },
  log: { log() {}, warn() {} },
  now: () => new Date('2026-09-01T01:02:03.000Z')
})
const partialSnapshot = await partialService.safeFetchBusinessSnapshot(user)
assert.deepEqual(partialSnapshot.employees, { total: 1, byDepartment: { 兼容部门: 1 } })
assert.equal(partialSnapshot._meta.partial, true)
assert.equal(partialSnapshot._meta.failedSourceCount, 1)
assert.deepEqual(partialSnapshot._meta.failedSources, [{ label: 'hrArchives', message: 'hr unavailable' }])
assert.equal(partialCalls.includes('/employees'), true)

assert.deepEqual(service.buildBusinessSnapshotFallback(new Error('snapshot failed')), {
  snapshotTime: '2026-09-01T01:02:03.000Z',
  _meta: {
    partial: true,
    fallback: true,
    error: 'snapshot failed',
    failedSourceCount: 1,
    failedSources: [{ label: 'businessSnapshot', message: 'snapshot failed' }]
  }
})

const emptyService = createAiContextService({
  callPostgrestWithUser: async () => ({ data: [] }),
  log: { log() {}, warn() {} },
  now: () => new Date('2026-09-01T01:02:03.000Z')
})
assert.equal(await emptyService.fetchSemanticContext(user), null)

const failedSemanticService = createAiContextService({
  callPostgrestWithUser: async (_user, options) => {
    assert.equal(options.path, '/rpc/agent_ontology_context')
    throw new Error('role context unavailable')
  },
  log: { log() {}, warn() {} }
})
assert.equal(await failedSemanticService.fetchSemanticContext(user), null)

const untrustedSemanticService = createAiContextService({
  callPostgrestWithUser: async (_user, options) => {
    assert.equal(options.path, '/rpc/agent_ontology_context')
    return {
      data: {
        source: 'legacy_unscoped_context',
        accessPolicy: { roleScoped: true, superUser: true },
        tables: [{ table_schema: 'public', table_name: 'users' }]
      }
    }
  },
  log: { log() {}, warn() {} }
})
assert.equal(await untrustedSemanticService.fetchSemanticContext(user), null)

const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(indexSource, /createAiContextService\(\{/)
for (const forbidden of [
  "safeQuery('table_semantics'",
  "safeQuery('salesOrders'",
  "safeQuery('equipmentPlans'",
  'const fetchBusinessSnapshot ='
]) {
  assert.equal(indexSource.includes(forbidden), false, `composition root reintroduced ${forbidden}`)
}
assert.match(readFileSync(resolve(repoRoot, 'realtime/ai-context-service.js'), 'utf8'), /path: '\/rpc\/agent_ontology_context'/)
assert.doesNotMatch(readFileSync(resolve(repoRoot, 'realtime/ai-context-service.js'), 'utf8'), /path: '\/v_permission_ontology'/)
assert.ok(indexSource.split(/\r?\n/).length <= 1030, 'realtime/index.js must not grow past the context extraction baseline')

console.log('AI context service regression passed')
