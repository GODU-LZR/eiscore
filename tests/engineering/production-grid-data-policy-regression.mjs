// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildProductionAiColumns,
  buildProductionCascaderParentColumns,
  buildProductionCascaderParentOptions,
  buildProductionDataSample,
  buildProductionDataStats,
  cloneProductionColumns,
  isProductionCascaderColumnConfig,
  isProductionSelectColumnConfig,
  normalizeProductionCascaderMap,
  normalizeProductionCascaderOption,
  resolveProductionDefaultOrder
} from '../../eiscore-production/src/domain/production-grid-data-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(resolveProductionDefaultOrder('plans'), 'product_material_code.asc')
assert.equal(resolveProductionDefaultOrder('work_order_items'), 'work_order_no.asc,line_no.asc')
assert.equal(resolveProductionDefaultOrder('work_orders'), 'created_at.desc')

assert.equal(isProductionSelectColumnConfig({ type: 'select' }), true)
assert.equal(isProductionSelectColumnConfig({ type: 'dropdown' }), true)
assert.equal(isProductionSelectColumnConfig({ options: ['A'] }), true)
assert.equal(isProductionSelectColumnConfig({ type: 'text', options: [] }), false)
assert.equal(isProductionSelectColumnConfig(null), false)
assert.equal(isProductionCascaderColumnConfig({ type: 'cascader', cascaderOptions: { A: ['A1'] } }), true)
assert.equal(isProductionCascaderColumnConfig({ type: 'cascader', cascaderOptions: {} }), false)
assert.equal(isProductionCascaderColumnConfig({ type: 'select', cascaderOptions: { A: ['A1'] } }), false)

assert.equal(normalizeProductionCascaderOption(null), null)
assert.deepEqual(normalizeProductionCascaderOption('华东'), { label: '华东', value: '华东' })
assert.deepEqual(normalizeProductionCascaderOption(3), { label: '3', value: '3' })
assert.deepEqual(normalizeProductionCascaderOption({ value: 'east' }), { label: 'east', value: 'east' })
assert.deepEqual(normalizeProductionCascaderOption({ label: '华东', value: 'east' }), { label: '华东', value: 'east' })

const columns = [
  { prop: 'region', type: 'select', options: ['华东', { label: '华南', value: 'south' }, null] },
  { prop: 'process', type: 'cascader', cascaderOptions: { A: ['下料', { label: '焊接', value: 'weld' }], B: ['下料', null] } },
  { prop: 'empty_process', type: 'cascader', cascaderOptions: {} },
  { prop: 'name', type: 'text' }
]
assert.deepEqual(buildProductionCascaderParentColumns(columns), columns.slice(0, 3))
assert.deepEqual(buildProductionCascaderParentColumns(null), [])
assert.deepEqual(buildProductionCascaderParentOptions(columns, 'region'), [
  { label: '华东', value: '华东' },
  { label: '华南', value: 'south' }
])
assert.deepEqual(buildProductionCascaderParentOptions(columns, 'process'), [
  { label: '下料', value: '下料' },
  { label: '焊接', value: 'weld' }
])
assert.deepEqual(buildProductionCascaderParentOptions(columns, 'missing'), [])

assert.deepEqual(normalizeProductionCascaderMap({
  east: ['下料', 2, { label: '焊接' }, { value: '装配' }, null, ''],
  invalid: 'not-an-array'
}), { east: ['下料', '2', '焊接', '装配'] })
assert.deepEqual(normalizeProductionCascaderMap(null), {})

const sourceColumns = [{ prop: 'status', options: [{ label: '待排产' }] }]
const clonedColumns = cloneProductionColumns(sourceColumns)
clonedColumns[0].options[0].label = '完工'
assert.equal(sourceColumns[0].options[0].label, '待排产')
assert.deepEqual(cloneProductionColumns(null), [])

assert.deepEqual(buildProductionDataStats([
  { work_order_status: '进行中', product_material_code: 'P-001' },
  { plan_status: '待下达', product_material_name: '产品A' },
  { issue_status: '缺料', product_material_code: 'P-001' },
  { status: 'active' },
  {}
]), {
  totalCount: 5,
  statusCounts: { 进行中: 1, 待下达: 1, 缺料: 1, active: 1, 未设置: 1 },
  productCounts: { 'P-001': 2, 产品A: 1 }
})
assert.deepEqual(buildProductionDataStats(null), { totalCount: 0, statusCounts: {}, productCounts: {} })

assert.deepEqual(buildProductionDataSample([
  { id: 1, name: '工单A', empty: '', properties: { status: '待排产' }, attachment: ['x'], geo: { lng: 1 } },
  { id: 2, name: '工单B', properties: { status: '完工' } }
], [
  { prop: 'name' },
  { prop: 'status' },
  { prop: 'empty' },
  { prop: 'attachment', type: 'file' },
  { prop: 'geo', type: 'geo' },
  { prop: '' }
], 1), [{ id: 1, name: '工单A', status: '待排产' }])
assert.deepEqual(buildProductionDataSample(null, []), [])

assert.deepEqual(buildProductionAiColumns([{
  label: '状态',
  prop: 'status',
  options: [{ label: '进行中', value: '进行中' }],
  dependsOn: null,
  cascaderOptions: undefined,
  expression: null
}]), [{
  label: '状态',
  prop: 'status',
  type: 'text',
  options: [{ label: '进行中', value: '进行中' }],
  dependsOn: '',
  cascaderOptions: null,
  expression: ''
}])
assert.deepEqual(buildProductionAiColumns(null), [])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-production/src/domain/production-grid-data-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request', 'axios', 'window.', 'document.', 'localStorage']) {
  assert.equal(moduleSource.includes(forbidden), false, `production grid data policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-production/src/components/ProductionAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/production-grid-data-policy['"]/)
for (const removedDefinition of [
  'const isSelectColumnConfig =',
  'const isCascaderColumnConfig =',
  'const normalizeCascaderOption =',
  'const cloneColumns =',
  'const buildDataStats =',
  'const buildDataSample =',
  'const normalizeCascaderMap ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `ProductionAppGrid reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2483)

console.log('PASS: ProductionAppGrid data policy preserves sorting, column configuration, statistics and AI samples')
