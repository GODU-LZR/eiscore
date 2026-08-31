// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSalesDataSample,
  buildSalesDataStats,
  calculateSalesCustomerReceivable,
  getSalesCustomerKey,
  getSalesDateTime,
  isSalesOrderActive,
  isSalesRowActive,
  toSalesAmount
} from '../../eiscore-sales/src/domain/sales-grid-data-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(toSalesAmount('12.5'), 12.5)
assert.equal(toSalesAmount('invalid'), 0)
assert.equal(getSalesDateTime('2026-09-01T00:00:00.000Z'), Date.parse('2026-09-01T00:00:00.000Z'))
assert.equal(getSalesDateTime('invalid'), 0)
assert.equal(getSalesDateTime(''), 0)
assert.equal(isSalesOrderActive({ order_status: '已取消' }), false)
assert.equal(isSalesOrderActive({ status: 'deleted' }), false)
assert.equal(isSalesOrderActive({ order_status: '已确认' }), true)
assert.equal(isSalesRowActive({ status: 'deleted' }), false)
assert.equal(isSalesRowActive(null), true)
assert.equal(getSalesCustomerKey({ customer_id: 'customer-1', id: 'row-1' }), 'customer-1')
assert.equal(getSalesCustomerKey({ id: 'row-1', customer_name: '客户A' }), 'row-1')
assert.equal(getSalesCustomerKey({ customer_name: '客户A' }), '客户A')
assert.equal(getSalesCustomerKey(null), '')

assert.equal(calculateSalesCustomerReceivable(
  { id: 'customer-1', name: '客户A' },
  {
    orders: [
      { customer_id: 'customer-1', customer_name: '客户A', total_amount: '120', order_status: '已确认' },
      { customer_id: 'customer-1', customer_name: '客户A', total_amount: '40', order_status: '已取消' },
      { customer_id: 'other', customer_name: '客户A', total_amount: 30, order_status: '已确认' }
    ],
    payments: [
      { customer_id: 'customer-1', customer_name: '客户A', amount: 50 },
      { customer_id: 'customer-1', customer_name: '客户A', amount: 20, status: 'deleted' }
    ]
  }
), 100)
assert.equal(calculateSalesCustomerReceivable(
  { id: 'customer-1', name: '客户A' },
  { orders: [{ customer_id: 'customer-1', total_amount: 20 }], payments: [{ customer_id: 'customer-1', amount: 50 }] }
), 0)

assert.deepEqual(buildSalesDataStats('customers', [
  { customer_status: '合作中', level: 'A', owner_name: '张三', region: '华东', credit_limit: '100', receivable_balance: 30 },
  { status: 'deleted', level: '', properties: { owner_name: '李四', region: '华南' }, credit_limit: 'bad', receivable_balance: 5 }
]), {
  totalCount: 2,
  sampleSize: 2,
  statusCounts: { 合作中: 1, deleted: 1 },
  ownerCounts: { 张三: 1, 李四: 1 },
  regionCounts: { 华东: 1, 华南: 1 },
  levelCounts: { A: 1, 未设置: 1 },
  totalCreditLimit: 100,
  totalReceivableBalance: 35
})

assert.deepEqual(buildSalesDataStats('orders', [
  { order_status: '已确认', owner_name: '张三', quantity: '2', total_amount: '80', properties: { delivery_risk: '高' } },
  { status: 'active', quantity: 3, total_amount: 20, properties: { owner_name: '李四', 交付风险: '低' } }
]), {
  totalCount: 2,
  sampleSize: 2,
  statusCounts: { 已确认: 1, active: 1 },
  ownerCounts: { 张三: 1, 李四: 1 },
  regionCounts: {},
  totalQuantity: 5,
  totalAmount: 100,
  deliveryRiskCounts: { 高: 1, 低: 1 }
})

const fixedNow = new Date('2026-09-01T12:00:00+08:00')
assert.equal(buildSalesDataStats('opportunities', [
  { stage: '方案报价', expected_amount: 100, probability: 50, expected_close_date: '2026-08-31' },
  { stage: '赢单', expected_amount: 200, probability: 100, expected_close_date: '2026-08-01' }
], { now: fixedNow }).overdueOpportunityCount, 1)
assert.equal(buildSalesDataStats('opportunities', [
  { stage: '方案报价', expected_amount: 100, probability: 50 }
], { now: fixedNow }).totalWeightedAmount, 50)

assert.deepEqual(buildSalesDataStats('follow_ups', [
  { follow_result: '有意向', follow_type: '电话沟通', next_follow_at: '2026-08-31' },
  { follow_result: '报价中', follow_type: '微信沟通', next_follow_at: '2026-09-03' },
  { follow_result: '已成交', follow_type: '上门拜访', next_follow_at: '2026-08-01' }
], { now: fixedNow }), {
  totalCount: 3,
  sampleSize: 3,
  statusCounts: { 有意向: 1, 报价中: 1, 已成交: 1 },
  ownerCounts: { 未设置: 3 },
  regionCounts: {},
  resultCounts: { 有意向: 1, 报价中: 1, 已成交: 1 },
  typeCounts: { 电话沟通: 1, 微信沟通: 1, 上门拜访: 1 },
  overdueFollowCount: 1,
  upcomingFollowCount: 1
})

assert.equal(buildSalesDataStats('payments', [
  { verify_status: '待核销', payment_method: '银行转账', handler_name: '张三', amount: '88' }
]).totalAmount, 88)
assert.deepEqual(buildSalesDataStats('unknown', [{ status: 'active', handler_name: '张三', region: '华东' }]).statusCounts, { active: 1 })
assert.deepEqual(buildSalesDataStats('customers', null), {
  totalCount: 0,
  sampleSize: 0,
  statusCounts: {},
  ownerCounts: {},
  regionCounts: {}
})

assert.deepEqual(buildSalesDataSample([
  { id: 1, name: '客户A', empty: '', properties: { level: 'A', region: '华东' }, attachment: ['x'], geo: { lng: 1 } },
  { id: 2, name: '客户B', properties: { level: 'B' } }
], [
  { prop: 'name' },
  { prop: 'level' },
  { prop: 'empty' },
  { prop: 'attachment', type: 'file' },
  { prop: 'geo', type: 'geo' },
  { prop: '' }
], 1), [{ id: 1, name: '客户A', level: 'A' }])
assert.deepEqual(buildSalesDataSample(null, []), [])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-grid-data-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request', 'axios', 'window.', 'document.', 'localStorage']) {
  assert.equal(moduleSource.includes(forbidden), false, `sales grid data policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/components/SalesAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-grid-data-policy['"]/)
for (const removedDefinition of [
  'const addCount =',
  'const toAmount =',
  'const getDateTime =',
  'const isOrderActive =',
  'const isRowActive =',
  'const getCustomerKey =',
  'const calculateCustomerReceivable =',
  'const buildDataStats = (rows) => {',
  'const buildDataSample = (rows, columns, limit = 50) => {'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `SalesAppGrid reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 4389)

console.log('PASS: SalesAppGrid data policy preserves receivables, five app statistics and AI samples')
