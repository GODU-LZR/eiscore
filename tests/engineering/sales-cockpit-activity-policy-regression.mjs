// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSalesActivityEvents } from '../../eiscore-sales/src/domain/sales-cockpit-activity-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const orders = [
  { id: 'o1', order_no: 'SO-1', customer_name: '甲公司', order_date: '2026-06-02T08:00:00+08:00', total_amount: 12500 },
  { id: '', order_no: 'SO-2', customer_name: '', order_date: 'invalid', total_amount: 100 }
]
const payments = [
  { id: 'p1', payment_no: 'PAY-1', customer_name: '乙公司', payment_date: '2026-06-03T09:00:00+08:00', amount: 20000 }
]
const followUps = [
  { id: 'f1', follow_no: 'FU-1', customer_name: '丙公司', follow_date: '2026-06-02T12:00:00+08:00', follow_result: '有意向' },
  { id: '', follow_no: 'FU-2', customer_name: '', follow_date: '2026-06-01T10:00:00+08:00', follow_result: '' }
]
assert.deepEqual(buildSalesActivityEvents({ orders, payments, followUps }), [
  { key: 'payment-p1', appKey: 'payments', type: '回款', tone: 'payment', date: '2026-06-03T09:00:00+08:00', time: '06-03', title: '乙公司', amount: '¥2.0万' },
  { key: 'follow-f1', appKey: 'follow_ups', type: '跟进', tone: 'follow', date: '2026-06-02T12:00:00+08:00', time: '06-02', title: '丙公司', amount: '有意向' },
  { key: 'order-o1', appKey: 'orders', type: '订单', tone: 'order', date: '2026-06-02T08:00:00+08:00', time: '06-02', title: '甲公司', amount: '¥1.3万' },
  { key: 'follow-FU-2', appKey: 'follow_ups', type: '跟进', tone: 'follow', date: '2026-06-01T10:00:00+08:00', time: '06-01', title: 'FU-2', amount: '-' },
  { key: 'order-SO-2', appKey: 'orders', type: '订单', tone: 'order', date: 'invalid', time: '--:--', title: 'SO-2', amount: '¥100' }
])
assert.deepEqual(buildSalesActivityEvents(), [])
assert.deepEqual(orders.map((row) => row.order_no), ['SO-1', 'SO-2'])
assert.deepEqual(payments.map((row) => row.payment_no), ['PAY-1'])
assert.deepEqual(followUps.map((row) => row.follow_no), ['FU-1', 'FU-2'])

const capped = buildSalesActivityEvents({
  orders: Array.from({ length: 13 }, (_, index) => ({
    id: String(index + 1),
    order_no: 'SO-' + String(index + 1),
    order_date: '2026-06-' + String(index + 1).padStart(2, '0'),
    total_amount: index + 1
  }))
})
assert.equal(capped.length, 12)
assert.equal(capped[0].key, 'order-13')
assert.equal(capped.at(-1).key, 'order-2')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-activity-policy.js'), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date()'
]) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit activity policy gained runtime dependency: ' + forbidden)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-cockpit-activity-policy\.js['"]/)
assert.equal(pageSource.includes('buildSalesActivityEvents({'), true)
assert.equal(pageSource.includes('const salesEvents = computed(() => {'), false)
assert.ok(pageSource.split(/\r?\n/).length <= 1786)

console.log('PASS: SalesCockpit activity policy preserves event mapping, date ordering and twelve-row cap')
