// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HOST_ENTRY_TAB_KEY,
  buildDefaultHostTabKey,
  buildHostTabRouteId,
  getAppRuntimeIdFromHostPath,
  getHostDirectAppRoute,
  getHostEntryTitle,
  getHostModuleAppKeyTitle,
  getHostPurchaseDocumentAppKey,
  isHostModuleAppPath,
  isHostModuleEntryPath,
  normalizeHostFallbackTitle,
  normalizeHostTabPath,
  normalizeHostTabQuery,
  resolveHostTabDot,
  resolveHostTabTitle,
  serializeHostTabQuery
} from '../../eiscore-base/src/domain/base-layout-host-tab-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(HOST_ENTRY_TAB_KEY, '/')
for (const [input, expected] of [
  ['', '/'], ['apps', '/apps/'], ['/apps/index.html', '/apps/'], ['/materials/', '/materials'],
  ['/sales/apps/', '/sales'], ['/materials/sales/app/orders', '/sales/app/orders'],
  ['/materials/inventory-stock-in', '/materials/inventory-stock-in'],
  ['/apps/config-center/advanced', '/apps/config-center'], ['/ai/enterprise/chat', '/ai/enterprise']
]) {
  assert.equal(normalizeHostTabPath(input), expected)
}

assert.deepEqual(normalizeHostTabQuery({ z: ' 2 ', a: [' 1 ', '', null], empty: '', nil: null }), { a: '1', z: '2' })
assert.deepEqual(normalizeHostTabQuery(null), {})
assert.equal(serializeHostTabQuery({ z: 'a b', a: '1' }), 'a=1&z=a+b')
assert.equal(buildHostTabRouteId('/sales', { z: 'a b', a: '1' }), '/sales?a=1&z=a+b')
assert.equal(buildHostTabRouteId('/sales'), '/sales')

assert.equal(resolveHostTabDot('/'), 'home')
assert.equal(resolveHostTabDot('/quality/dashboard'), 'quality')
assert.equal(resolveHostTabDot('/unknown'), 'default')
assert.equal(getHostEntryTitle('/apps/'), '应用中心')
assert.equal(getHostEntryTitle('/unknown'), '首页')
assert.equal(isHostModuleEntryPath('/apps'), true)
assert.equal(isHostModuleEntryPath('/apps/config-center'), false)
assert.equal(getHostModuleAppKeyTitle('/sales/app/orders'), '销售订单')
assert.equal(getHostModuleAppKeyTitle('/quality/app/unknown'), '')
assert.deepEqual(getHostDirectAppRoute('/materials/material/detail/1'), {
  path: '/materials/material/detail', title: '物料', tabKey: '/materials/app/a'
})
assert.equal(getHostDirectAppRoute('/unknown'), null)
assert.equal(getHostPurchaseDocumentAppKey('/purchase/document/1', {}), 'suppliers')
assert.equal(getHostPurchaseDocumentAppKey('/purchase/document/1', { appKey: 'orders' }), 'orders')
assert.equal(getHostPurchaseDocumentAppKey('/purchase/app/orders', {}), '')
assert.equal(isHostModuleAppPath('/purchase/document/1'), true)
assert.equal(isHostModuleAppPath('/unknown'), false)
assert.equal(getAppRuntimeIdFromHostPath('/apps/app/a%20b'), 'a b')
assert.equal(normalizeHostFallbackTitle(' 应用一 '), '应用一')
assert.equal(normalizeHostFallbackTitle('应用运行'), '')

const titleCases = [
  ['/purchase/document/1', { appKey: 'orders' }, '', '采购订单'],
  ['/materials', {}, '', '仓储管理'],
  ['/sales/app/customers', {}, '', '客户档案'],
  ['/quality/dashboard/detail', {}, '', '质量总览'],
  ['/apps/config-center', {}, '', '应用配置中心'],
  ['/apps/workflow-designer/1', { appName: '流程 A' }, '', '流程 A'],
  ['/apps/flash-builder/1', {}, '', '闪念应用'],
  ['/apps/data-app/1', {}, '数据 A', '数据 A'],
  ['/apps/ontology-relations/1', {}, '', '本体关系工作台'],
  ['/settings', {}, '', '系统设置'],
  ['/ai/enterprise/chat', {}, '', '企业助手'],
  ['/other', {}, ' 自定义 ', '自定义'],
  ['/other', {}, '', '页面']
]
for (const [path, query, fallback, expected] of titleCases) {
  assert.equal(resolveHostTabTitle(path, query, fallback), expected)
}
assert.equal(resolveHostTabTitle('/apps/app/runtime-1', {}, '', { getRuntimeTitle: (id) => id === 'runtime-1' ? '运行应用' : '' }), '运行应用')
assert.equal(resolveHostTabTitle('/apps/app/runtime-1', { name: '查询标题' }, '优先标题'), '优先标题')

for (const [path, query, expected] of [
  ['/materials', {}, '/'],
  ['/purchase/document/1', { appKey: 'orders' }, '/purchase/app/orders'],
  ['/materials/material/detail/1', {}, '/materials/app/a'],
  ['/sales/app/orders/1', {}, '/sales/app/orders'],
  ['/apps/config-center', {}, '/apps/config-center'],
  ['/settings', {}, '/settings'],
  ['/ai/enterprise/chat', {}, '/ai/enterprise'],
  ['/apps/app/runtime-1', {}, '/apps/app/runtime-1']
]) {
  assert.equal(buildDefaultHostTabKey(path, query), expected)
}

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/base-layout-host-tab-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `base layout host-tab policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/base-layout-host-tab-policy['"]/)
for (const removedDefinition of [
  'const MODULE_ENTRY_TITLES =',
  'const MODULE_APP_KEY_TITLES =',
  'const MODULE_DIRECT_APP_ROUTES =',
  'const normalizeHostPath =',
  'const normalizeHostQuery =',
  'const serializeHostQuery =',
  'const buildHostRouteId =',
  'const resolveHostTabDot =',
  'const getModuleAppKeyTitle =',
  'const getDirectAppRoute =',
  'const getPurchaseDocumentAppKey =',
  'const buildDefaultTabKey ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `base layout reintroduced ${removedDefinition}`)
}
assert.equal(pageSource.includes('resolveHostTabTitlePolicy('), true)
assert.equal(pageSource.includes('{ getRuntimeTitle: getAppRuntimeTitle }'), true)
assert.ok(pageSource.split(/\r?\n/).length <= 3766)

console.log('PASS: base layout host-tab policy preserves paths, queries, route ids, titles, dots and stable tab keys')
