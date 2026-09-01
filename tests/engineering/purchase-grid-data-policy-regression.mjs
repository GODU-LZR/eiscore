// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseAiColumns,
  buildPurchaseCascaderParentColumns,
  buildPurchaseCascaderParentOptions,
  buildPurchaseDataSample,
  buildPurchaseDataStats,
  clonePurchaseColumns,
  isPurchaseCascaderColumnConfig,
  isPurchaseRowActive,
  isPurchaseSelectColumnConfig,
  normalizePurchaseCascaderMap,
  normalizePurchaseCascaderOption
} from '../../eiscore-purchase/src/domain/purchase-grid-data-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(isPurchaseRowActive({ status: 'deleted' }), false)
assert.equal(isPurchaseRowActive(null), true)
assert.equal(isPurchaseSelectColumnConfig({ type: 'select', options: [] }), false)
assert.equal(isPurchaseSelectColumnConfig({ type: 'text', options: ['A'] }), true)
assert.equal(isPurchaseCascaderColumnConfig({ type: 'cascader', cascaderOptions: { A: ['A1'] } }), true)
assert.equal(isPurchaseCascaderColumnConfig({ type: 'cascader', cascaderOptions: {} }), false)
assert.deepEqual(normalizePurchaseCascaderOption('华东'), { label: '华东', value: '华东' })
assert.deepEqual(normalizePurchaseCascaderOption({ value: 'east' }), { label: 'east', value: 'east' })

const columns = [
  { prop: 'region', options: ['华东', { label: '华南', value: 'south' }] },
  { prop: 'city', type: 'cascader', cascaderOptions: { east: ['上海', '苏州'], south: ['上海'] } },
  { prop: 'empty', type: 'cascader', cascaderOptions: {} },
  { prop: 'name', type: 'text' }
]
assert.deepEqual(buildPurchaseCascaderParentColumns(columns), columns.slice(0, 3))
assert.deepEqual(buildPurchaseCascaderParentOptions(columns, 'region'), [
  { label: '华东', value: '华东' }, { label: '华南', value: 'south' }
])
assert.deepEqual(buildPurchaseCascaderParentOptions(columns, 'city'), [
  { label: '上海', value: '上海' }, { label: '苏州', value: '苏州' }
])
assert.deepEqual(normalizePurchaseCascaderMap({ A: ['A1', 2, { label: 'A3' }, null] }), { A: ['A1', '2', 'A3'] })

const original = [{ options: [{ label: 'A' }] }]
const cloned = clonePurchaseColumns(original)
cloned[0].options[0].label = 'B'
assert.equal(original[0].options[0].label, 'A')

assert.deepEqual(buildPurchaseDataStats([
  { status: 'active', buyer_name: '张三', supplier_name: '供应商A' },
  { properties: { status: 'pending', buyer_name: '李四', supplier_name: '供应商A' } },
  { name: '供应商B' }
]), {
  totalCount: 3,
  sampleSize: 3,
  statusCounts: { active: 1, pending: 1, 未设置: 1 },
  buyerCounts: { 张三: 1, 李四: 1 },
  supplierCounts: { 供应商A: 2, 供应商B: 1 }
})
assert.deepEqual(buildPurchaseDataStats(null), {
  totalCount: 0, sampleSize: 0, statusCounts: {}, buyerCounts: {}, supplierCounts: {}
})
assert.deepEqual(buildPurchaseDataSample([
  { id: 1, name: '供应商A', properties: { status: 'active' }, file: ['x'], geo: { lng: 1 } },
  { id: 2, name: '供应商B' }
], [
  { prop: 'name' }, { prop: 'status' }, { prop: 'file', type: 'file' }, { prop: 'geo', type: 'geo' }
], 1), [{ id: 1, name: '供应商A', status: 'active' }])
assert.deepEqual(buildPurchaseAiColumns([{ label: '状态', prop: 'status' }]), [{
  label: '状态', prop: 'status', type: 'text', options: [], dependsOn: '', cascaderOptions: null, expression: ''
}])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-purchase/src/domain/purchase-grid-data-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request', 'axios', 'window.', 'document.', 'localStorage']) {
  assert.equal(moduleSource.includes(forbidden), false, `purchase grid data policy gained runtime dependency: ${forbidden}`)
}
const pageSource = readFileSync(resolve(repoRoot, 'eiscore-purchase/src/components/PurchaseAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-grid-data-policy['"]/)
for (const removed of [
  'const isSelectColumnConfig =', 'const isCascaderColumnConfig =', 'const normalizeCascaderOption =',
  'const cloneColumns =', 'const buildDataStats =', 'const buildDataSample =', 'const normalizeCascaderMap ='
]) assert.equal(pageSource.includes(removed), false, `PurchaseAppGrid reintroduced ${removed}`)
assert.ok(pageSource.split(/\r?\n/).length <= 2412)

console.log('PASS: PurchaseAppGrid data policy preserves active rows, columns, statistics and AI samples')
