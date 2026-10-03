// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { createFlashToolRegistry } = require('../../realtime/flash-tool-registry')
const repoRoot = resolve(import.meta.dirname, '../..')

const fixedNow = new Date('2026-08-31T12:34:56.000Z')
const registry = createFlashToolRegistry({ now: () => fixedNow })
assert.equal(Object.isFrozen(registry), true)
assert.deepEqual(Object.keys(registry).sort(), [
  'getFlashToolDefinition',
  'getFlashToolRegistryPayload',
  'registryCount',
  'registryVersion',
  'resolveFlashToolId'
])
assert.equal(registry.registryVersion, 'flash-tools-v2')
assert.equal(registry.registryCount, 43)

const payload = registry.getFlashToolRegistryPayload()
assert.equal(payload.registry_version, 'flash-tools-v2')
assert.equal(payload.tools_count, 43)
assert.equal(payload.generated_at, '2026-08-31T12:34:56.000Z')
assert.equal(payload.domain, 'flash')

const compactTool = (tool) => [
  tool.tool_id,
  tool.tool_name_zh,
  tool.intent,
  tool.object,
  tool.risk_level,
  tool.confirm_required,
  tool.batch,
  tool.api.path,
  tool.api.method,
  tool.api.accept_profile || '',
  tool.api.content_profile || ''
]
const expectedTools = [
  ['flash.app.list', '查询应用列表', 'read_list', 'app_registry', 'low', false, 1, '/apps', 'GET', 'app_center', ''],
  ['flash.app.detail', '查询应用详情', 'read_detail', 'app_registry', 'low', false, 1, '/apps', 'GET', 'app_center', ''],
  ['flash.route.resolve', '查询发布路由', 'read_detail', 'published_route', 'low', false, 1, '/published_routes', 'GET', 'app_center', ''],
  ['flash.data.grid.list', '查询表格列表数据', 'read_list', 'data_table', 'low', false, 1, '/{table}', 'GET', '', ''],
  ['flash.data.grid.detail', '查询表格单条详情', 'read_detail', 'data_table', 'low', false, 1, '/{table}', 'GET', '', ''],
  ['flash.data.grid.export', '导出表格数据', 'read_export', 'data_table', 'low', false, 1, '/{table}', 'GET', '', ''],
  ['flash.workflow.definition.list', '查询流程定义', 'read_list', 'workflow_definition', 'low', false, 1, '/definitions', 'GET', 'workflow', ''],
  ['flash.workflow.instance.list', '查询流程实例', 'read_list', 'workflow_instance', 'low', false, 1, '/instances', 'GET', 'workflow', ''],
  ['flash.workflow.event.list', '查询流程日志', 'read_list', 'workflow_event', 'low', false, 1, '/instance_events', 'GET', 'workflow', ''],
  ['flash.workflow.assignment.list', '查询流程任务分派', 'read_list', 'workflow_task_assignment', 'low', false, 1, '/task_assignments', 'GET', 'workflow', ''],
  ['flash.workflow.mapping.list', '查询流程状态映射', 'read_list', 'workflow_state_mapping', 'low', false, 1, '/workflow_state_mappings', 'GET', 'app_center', ''],
  ['flash.inventory.current.list', '查询当前库存', 'read_list', 'inventory_current', 'low', false, 1, '/v_inventory_current', 'GET', 'scm', ''],
  ['flash.inventory.draft.list', '查询库存草稿', 'read_list', 'inventory_draft', 'low', false, 1, '/v_inventory_drafts', 'GET', 'scm', ''],
  ['flash.material.master.list', '查询物料主数据', 'read_list', 'material_master', 'low', false, 1, '/raw_materials', 'GET', 'public', ''],
  ['flash.warehouse.list', '查询仓库列表', 'read_list', 'warehouse', 'low', false, 1, '/warehouses', 'GET', 'scm', ''],
  ['flash.hr.archive.list', '查询人事档案', 'read_list', 'hr_archive', 'low', false, 1, '/archives', 'GET', 'hr', ''],
  ['flash.ontology.relation.list', '查询本体关系', 'read_list', 'ontology_relation', 'low', false, 1, '/ontology_table_relations', 'GET', 'app_data', ''],
  ['flash.ontology.semantic.list', '查询本体语义', 'read_list', 'ontology_semantic', 'low', false, 1, '/ontology_table_semantics', 'GET', 'public', ''],
  ['flash.app.create', '创建应用', 'create_record', 'app_registry', 'high', true, 2, '/apps', 'POST', 'app_center', 'app_center'],
  ['flash.app.delete', '删除应用', 'delete_record', 'app_registry', 'high', true, 2, '/apps', 'DELETE', 'app_center', 'app_center'],
  ['flash.data.table.ensure', '初始化数据应用表', 'configure_app', 'data_table', 'medium', true, 2, '/rpc/create_data_app_table', 'POST', 'app_center', 'app_center'],
  ['flash.data.grid.create', '新增表格记录', 'create_record', 'data_table', 'medium', true, 2, '/{table}', 'POST', '', ''],
  ['flash.data.grid.update', '更新表格记录', 'update_record', 'data_table', 'medium', true, 2, '/{table}', 'PATCH', '', ''],
  ['flash.data.grid.delete', '删除表格记录', 'delete_record', 'data_table', 'high', true, 2, '/{table}', 'DELETE', '', ''],
  ['flash.workflow.definition.upsert', '写入流程定义', 'configure_app', 'workflow_definition', 'high', true, 2, '/definitions', 'POST/PATCH', 'workflow', 'workflow'],
  ['flash.workflow.assignment.upsert', '写入流程任务分派', 'configure_app', 'workflow_task_assignment', 'high', true, 2, '/task_assignments', 'POST/PATCH', 'workflow', 'workflow'],
  ['flash.workflow.mapping.upsert', '写入流程状态映射', 'configure_app', 'workflow_state_mapping', 'high', true, 2, '/workflow_state_mappings', 'POST', 'app_center', 'app_center'],
  ['flash.workflow.instance.start', '启动流程实例', 'start_workflow', 'workflow_instance', 'high', true, 2, '/rpc/start_workflow_instance', 'POST', 'workflow', 'workflow'],
  ['flash.workflow.instance.transition', '推进流程实例', 'transition_workflow', 'workflow_instance', 'high', true, 2, '/rpc/transition_workflow_instance', 'POST', 'workflow', 'workflow'],
  ['flash.hr.archive.update', '更新人事档案', 'update_record', 'hr_archive', 'medium', true, 2, '/archives', 'PATCH', 'hr', 'hr'],
  ['flash.hr.attendance.init', '初始化考勤记录', 'configure_app', 'hr_attendance_record', 'high', true, 2, '/rpc/init_attendance_records', 'POST', 'hr', 'hr'],
  ['flash.inventory.draft.create', '创建库存草稿', 'create_record', 'inventory_draft', 'medium', true, 2, '/inventory_drafts', 'POST', 'scm', 'scm'],
  ['flash.inventory.batchno.generate', '生成批次号', 'configure_app', 'inventory_draft', 'medium', true, 2, '/rpc/generate_batch_no', 'POST', 'scm', 'scm'],
  ['flash.inventory.stock.in', '执行库存入库', 'update_record', 'inventory_transaction', 'high', true, 2, '/rpc/stock_in', 'POST', 'scm', 'scm'],
  ['flash.inventory.stock.out', '执行库存出库', 'update_record', 'inventory_transaction', 'high', true, 2, '/rpc/stock_out', 'POST', 'scm', 'scm'],
  ['flash.ontology.semantic.enrich', '补全本体语义', 'semantic_enrich', 'ontology_semantic', 'medium', true, 2, '/ontology_table_semantics', 'POST/PATCH', 'public', 'public'],
  ['flash.draft.read', '读取闪念草稿', 'read', 'flash_draft', 'low', false, 2, '/flash/draft', 'GET', '', ''],
  ['flash.draft.write', '写入闪念草稿', 'save', 'flash_draft', 'medium', true, 2, '/flash/draft', 'POST', '', ''],
  ['flash.attachment.upload', '上传闪念附件', 'upload', 'flash_attachment', 'medium', true, 2, '/flash/attachments', 'POST', '', ''],
  ['flash.app.save', '保存闪念应用', 'save', 'flash_application', 'medium', true, 2, '/apps', 'PATCH', 'app_center', 'app_center'],
  ['flash.app.publish', '发布闪念应用', 'publish', 'flash_application', 'high', true, 2, '/apps', 'PATCH', 'app_center', 'app_center'],
  ['flash.route.upsert', '写入发布路由', 'configure_app', 'published_route', 'high', true, 2, '/published_routes', 'POST', 'app_center', 'app_center'],
  ['flash.audit.write', '写入执行审计', 'audit', 'execution_log', 'medium', true, 2, '/execution_logs', 'POST', 'app_center', 'app_center']
]
assert.deepEqual(payload.tools.map(compactTool), expectedTools)
assert.equal(payload.tools.filter((tool) => !tool.confirm_required).length, 19)
assert.equal(payload.tools.filter((tool) => tool.confirm_required).length, 24)
assert.equal(new Set(payload.tools.map((tool) => tool.tool_id)).size, 43)

const expectedAliases = {
  'cap.app.list': 'flash.app.list',
  'cap.app.detail': 'flash.app.detail',
  'cap.app.create': 'flash.app.create',
  'cap.app.update': 'flash.app.save',
  'cap.app.delete': 'flash.app.delete',
  'cap.route.resolve': 'flash.route.resolve',
  'cap.route.upsert': 'flash.route.upsert',
  'cap.data.table.ensure': 'flash.data.table.ensure',
  'cap.data.grid.list': 'flash.data.grid.list',
  'cap.data.grid.detail': 'flash.data.grid.detail',
  'cap.data.grid.create': 'flash.data.grid.create',
  'cap.data.grid.update': 'flash.data.grid.update',
  'cap.data.grid.delete': 'flash.data.grid.delete',
  'cap.data.grid.export': 'flash.data.grid.export',
  'cap.workflow.definition.list': 'flash.workflow.definition.list',
  'cap.workflow.definition.upsert': 'flash.workflow.definition.upsert',
  'cap.workflow.assignment.list': 'flash.workflow.assignment.list',
  'cap.workflow.assignment.upsert': 'flash.workflow.assignment.upsert',
  'cap.workflow.mapping.list': 'flash.workflow.mapping.list',
  'cap.workflow.mapping.upsert': 'flash.workflow.mapping.upsert',
  'cap.workflow.instance.list': 'flash.workflow.instance.list',
  'cap.workflow.event.list': 'flash.workflow.event.list',
  'cap.workflow.instance.start': 'flash.workflow.instance.start',
  'cap.workflow.instance.transition': 'flash.workflow.instance.transition',
  'cap.hr.archive.list': 'flash.hr.archive.list',
  'cap.hr.archive.update': 'flash.hr.archive.update',
  'cap.hr.attendance.init': 'flash.hr.attendance.init',
  'cap.inventory.current.list': 'flash.inventory.current.list',
  'cap.inventory.draft.list': 'flash.inventory.draft.list',
  'cap.inventory.draft.create': 'flash.inventory.draft.create',
  'cap.inventory.batchno.generate': 'flash.inventory.batchno.generate',
  'cap.inventory.stock.in': 'flash.inventory.stock.in',
  'cap.inventory.stock.out': 'flash.inventory.stock.out',
  'cap.material.master.list': 'flash.material.master.list',
  'cap.warehouse.list': 'flash.warehouse.list',
  'cap.ontology.relation.list': 'flash.ontology.relation.list',
  'cap.ontology.semantic.list': 'flash.ontology.semantic.list',
  'cap.ontology.semantic.enrich': 'flash.ontology.semantic.enrich',
  'flash.app.read': 'flash.app.detail'
}
for (const [alias, canonical] of Object.entries(expectedAliases)) {
  assert.equal(registry.resolveFlashToolId(alias), canonical, alias)
  assert.equal(registry.getFlashToolDefinition(canonical)?.tool_id, canonical)
}
assert.equal(registry.resolveFlashToolId(' cap.app.list! '), 'flash.app.list')
assert.equal(registry.resolveFlashToolId('flash.custom@tool'), 'flash.customtool')
assert.equal(registry.resolveFlashToolId(''), '')
assert.equal(registry.getFlashToolDefinition('missing.tool'), undefined)

payload.tools[0].api.path = '/mutated'
assert.equal(registry.getFlashToolRegistryPayload().tools[0].api.path, '/apps')

const compositionRoot = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(compositionRoot, /require\('\.\/flash-tool-registry'\)/)
assert.match(compositionRoot, /createFlashToolRegistry\(/)
assert.doesNotMatch(
  compositionRoot,
  /(const flashSemanticToolRegistry|const flashSemanticToolAliases|const flashSemanticToolMap|function sanitizeToolId|function resolveFlashToolId|function getFlashToolRegistryPayload)/
)
assert.ok(compositionRoot.split(/\r?\n/).length <= 4562, 'Realtime composition root must not regain Flash tool registry implementation')

console.log('PASS: Flash tool registry locks 43 tools, 19/24 confirmation policy, aliases, public metadata and composition boundary')
