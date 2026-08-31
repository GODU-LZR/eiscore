// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSalesDetailBusinessMetrics,
  buildSalesDetailItems,
  buildSalesDetailPropertyItems,
  buildSalesDetailRelationSections,
  buildSalesDetailSummary,
  formatSalesAmount,
  formatSalesDetailValue,
  getSalesRowDisplayName,
  getSalesRowValue
} from '../../eiscore-sales/src/domain/sales-grid-detail-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(getSalesRowValue({ name: 'direct', properties: { name: 'fallback' } }, 'name'), 'direct')
assert.equal(getSalesRowValue({ properties: { name: 'fallback' } }, 'name'), 'fallback')
assert.equal(getSalesRowValue(null, 'name'), undefined)
assert.equal(formatSalesDetailValue(null), '-')
assert.equal(formatSalesDetailValue(['A', '', 3]), 'A、-、3')
assert.equal(formatSalesDetailValue({ a: 1 }), '{"a":1}')
assert.equal(formatSalesAmount('1234.5'), '1,234.50')
assert.equal(formatSalesAmount('bad'), 'bad')

assert.equal(getSalesRowDisplayName(null), '未选择记录')
assert.equal(getSalesRowDisplayName({ opportunity_name: '商机A', id: 1 }), '商机A')
assert.equal(getSalesRowDisplayName({ id: 0 }), '未命名记录')

const detailRow = {
  id: 1,
  name: '客户A',
  properties: { level: 'A', hidden: ['x', 'y'], empty: '' },
  attachment: ['file']
}
const detailColumns = [
  { label: '名称', prop: 'name' },
  { label: '等级', prop: 'level' },
  { label: '附件', prop: 'attachment', type: 'file' }
]
assert.deepEqual(buildSalesDetailItems({ row: detailRow, columns: detailColumns }), [
  { label: '名称', prop: 'name', value: '客户A' },
  { label: '等级', prop: 'level', value: 'A' }
])
assert.deepEqual(buildSalesDetailItems(), [])
assert.deepEqual(buildSalesDetailPropertyItems({ row: detailRow, columns: detailColumns }), [
  { key: 'hidden', value: 'x、y' },
  { key: 'empty', value: '-' }
])

const relations = {
  orders: [{ order_no: 'SO-1', product_name: '产品A', total_amount: 120, order_status: '已确认' }],
  payments: [{ payment_no: 'PAY-1', order_no: 'SO-1', amount: 20, verify_status: '待核销' }],
  followUps: [{ follow_no: 'F-1', follow_date: '2026-09-01', follow_type: '电话', follow_result: '有意向', next_follow_at: '' }],
  opportunities: [],
  customer: { customer_no: 'C-1', name: '客户A', level: 'A', receivable_balance: 100 },
  opportunity: { opportunity_no: 'OP-1', opportunity_name: '商机A', expected_amount: 200, stage: '报价', probability: '' }
}
const sections = buildSalesDetailRelationSections(relations)
assert.deepEqual(sections.map((item) => item.key), ['orders', 'payments', 'followUps', 'customer', 'opportunity'])
assert.deepEqual(sections[0].rows, [{
  order_no: 'SO-1',
  customer_name: '-',
  product_name: '产品A',
  total_amount: '120.00',
  order_status: '已确认'
}])
assert.equal(sections.at(-1).rows[0].probability, '-%')
assert.deepEqual(buildSalesDetailRelationSections(null), [])

assert.deepEqual(buildSalesDetailBusinessMetrics({
  appKey: 'customers',
  row: { receivable_balance: 150 },
  relations: {
    orders: [
      { total_amount: 200, order_status: '已确认' },
      { total_amount: 100, order_status: '已取消' }
    ],
    payments: [{ amount: 80 }, { amount: 20, status: 'deleted' }]
  }
}), [
  { key: 'orderAmount', label: '累计订单', value: '200.00' },
  { key: 'paymentAmount', label: '累计回款', value: '80.00' },
  { key: 'receivable', label: '应收余额', value: '150.00' },
  { key: 'paymentRate', label: '回款率', value: '40%' }
])
assert.deepEqual(buildSalesDetailBusinessMetrics({
  appKey: 'orders',
  row: { total_amount: 100 },
  relations: { payments: [{ amount: 30 }] }
}).map((item) => item.value), ['100.00', '30.00', '70.00', '30%'])
assert.deepEqual(buildSalesDetailBusinessMetrics({
  appKey: 'opportunities',
  row: { expected_amount: 200, probability: 25, stage: '方案报价' }
}).map((item) => item.value), ['200.00', '25%', '50.00', '方案报价'])
assert.deepEqual(buildSalesDetailBusinessMetrics({
  appKey: 'follow_ups',
  row: { follow_date: '2026-09-01', follow_result: '有意向', next_follow_at: '', owner_name: '张三' }
}).map((item) => item.value), ['2026-09-01', '有意向', '-', '张三'])
assert.deepEqual(buildSalesDetailBusinessMetrics({ appKey: 'payments', row: {} }), [])
assert.deepEqual(buildSalesDetailBusinessMetrics(), [])

assert.equal(buildSalesDetailSummary({
  appName: '客户档案',
  row: detailRow,
  items: [
    { label: '名称', value: '客户A' },
    { label: '空值', value: '-' }
  ],
  propertyItems: [{ key: '等级', value: 'A' }],
  relationSections: sections
}), [
  '客户档案：客户A',
  '名称：客户A',
  '扩展字段：',
  '等级：A',
  '关联记录：',
  '相关订单：1 条',
  'SO-1 / 产品A / 120.00 / 已确认',
  '相关回款：1 条',
  'PAY-1 / SO-1 / 20.00 / 待核销',
  '跟进记录：1 条',
  'F-1 / 2026-09-01 / 电话 / 有意向',
  '对应客户：1 条',
  'C-1 / 客户A / A / 100.00',
  '对应商机：1 条',
  'OP-1 / 商机A / 200.00 / 报价 / -%'
].join('\n'))
assert.equal(buildSalesDetailSummary(), '')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-grid-detail-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request', 'axios', 'window.', 'document.', 'localStorage']) {
  assert.equal(moduleSource.includes(forbidden), false, `sales grid detail policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/components/SalesAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-grid-detail-policy['"]/)
for (const removedDefinition of [
  'const getRowValue =',
  'const formatDetailValue =',
  'const formatAmount =',
  'const mapOrderRelation =',
  'const mapPaymentRelation =',
  'const mapFollowRelation =',
  'const mapOpportunityRelation =',
  'const mapCustomerRelation =',
  'const getRowDisplayName =',
  'const detailRelationSections = computed(() => {',
  'const detailBusinessMetrics = computed(() => {'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `SalesAppGrid reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 4161)

console.log('PASS: SalesAppGrid detail policy preserves fields, seven relation sections, metrics and summaries')
