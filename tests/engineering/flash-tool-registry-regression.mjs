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
assert.equal(registry.registryVersion, 'flash-tools-v3-programming-only')
assert.equal(registry.registryCount, 19)

const payload = registry.getFlashToolRegistryPayload()
assert.equal(payload.registry_version, 'flash-tools-v3-programming-only')
assert.equal(payload.tools_count, 19)
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
  ['flash.app.create', '创建应用', 'create_record', 'app_registry', 'high', true, 2, '/apps', 'POST', 'app_center', 'app_center'],
  ['flash.app.delete', '删除应用', 'delete_record', 'app_registry', 'high', true, 2, '/apps', 'DELETE', 'app_center', 'app_center'],
  ['flash.data.table.ensure', '初始化数据应用表', 'configure_app', 'data_table', 'medium', true, 2, '/rpc/create_flash_data_app_table', 'POST', 'app_center', 'app_center'],
  ['flash.data.grid.create', '新增表格记录', 'create_record', 'data_table', 'medium', true, 2, '/{table}', 'POST', '', ''],
  ['flash.data.grid.update', '更新表格记录', 'update_record', 'data_table', 'medium', true, 2, '/{table}', 'PATCH', '', ''],
  ['flash.data.grid.delete', '删除表格记录', 'delete_record', 'data_table', 'high', true, 2, '/{table}', 'DELETE', '', ''],
  ['flash.draft.read', '读取闪念草稿', 'read', 'flash_draft', 'low', false, 2, '/flash/draft', 'GET', '', ''],
  ['flash.draft.write', '写入闪念草稿', 'save', 'flash_draft', 'medium', true, 2, '/flash/draft', 'POST', '', ''],
  ['flash.attachment.upload', '上传闪念附件', 'upload', 'flash_attachment', 'medium', true, 2, '/flash/attachments', 'POST', '', ''],
  ['flash.app.save', '保存闪念应用', 'save', 'flash_application', 'medium', true, 2, '/apps', 'PATCH', 'app_center', 'app_center'],
  ['flash.app.publish', '发布闪念应用', 'publish', 'flash_application', 'high', true, 2, '/apps', 'PATCH', 'app_center', 'app_center'],
  ['flash.route.upsert', '写入发布路由', 'configure_app', 'published_route', 'high', true, 2, '/published_routes', 'POST', 'app_center', 'app_center'],
  ['flash.audit.write', '写入执行审计', 'audit', 'execution_log', 'medium', true, 2, '/execution_logs', 'POST', 'app_center', 'app_center']
]
assert.deepEqual(payload.tools.map(compactTool), expectedTools)
assert.equal(payload.tools.filter((tool) => !tool.confirm_required).length, 7)
assert.equal(payload.tools.filter((tool) => tool.confirm_required).length, 12)
assert.equal(new Set(payload.tools.map((tool) => tool.tool_id)).size, 19)

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

console.log('PASS: Flash tool registry locks 19 programming tools, confirmation policy, aliases, public metadata and composition boundary')
