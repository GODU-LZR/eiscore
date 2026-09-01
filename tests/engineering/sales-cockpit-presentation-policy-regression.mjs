// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  clampSalesCockpitRate,
  formatSalesCockpitAmount,
  formatSalesCockpitCurrency,
  formatSalesCockpitDate,
  formatSalesCockpitEventTime,
  formatSalesCockpitRefreshTime,
  formatSalesCockpitScrollDuration,
  normalizeSalesCockpitRows,
  parseSalesCockpitDateTime,
  selectActiveSalesCustomers,
  selectActiveSalesFollowUps,
  selectActiveSalesOpportunities,
  selectActiveSalesOrders,
  selectActiveSalesPayments,
  shouldAutoScrollSalesCockpitRows,
  sumSalesCockpitRowsBy,
  toSalesCockpitAmount
} from '../../eiscore-sales/src/domain/sales-cockpit-presentation-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const timestamp = new Date(2026, 5, 2, 8, 9, 10)

assert.deepEqual(normalizeSalesCockpitRows(null), [])
assert.equal(toSalesCockpitAmount('12.5'), 12.5)
assert.equal(toSalesCockpitAmount('invalid'), 0)
assert.equal(sumSalesCockpitRowsBy([{ amount: '2' }, { amount: 3 }, {}], 'amount'), 5)
assert.equal(parseSalesCockpitDateTime(null), 0)
assert.equal(parseSalesCockpitDateTime('invalid'), 0)
assert.equal(parseSalesCockpitDateTime(timestamp), timestamp.getTime())
assert.equal(formatSalesCockpitDate('2026-06-02T08:09:10Z'), '2026-06-02')
assert.equal(formatSalesCockpitDate(null), '-')
assert.equal(formatSalesCockpitRefreshTime(null), '等待首次刷新')
assert.equal(formatSalesCockpitRefreshTime(timestamp), timestamp.toLocaleTimeString('zh-CN', { hour12: false }))
assert.equal(formatSalesCockpitEventTime(timestamp), '06-02')
assert.equal(formatSalesCockpitEventTime('invalid'), '--:--')
assert.equal(formatSalesCockpitAmount(9999), '9,999')
assert.equal(formatSalesCockpitAmount(12500), '1.3万')
assert.equal(formatSalesCockpitAmount(2500000), '250万')
assert.equal(formatSalesCockpitAmount(125000000), '1.25亿')
assert.equal(formatSalesCockpitCurrency(12500), '¥1.3万')
assert.equal(clampSalesCockpitRate(-1), 0)
assert.equal(clampSalesCockpitRate(50.6), 51)
assert.equal(clampSalesCockpitRate(120), 100)
assert.equal(shouldAutoScrollSalesCockpitRows([1, 2, 3, 4], 3), true)
assert.equal(shouldAutoScrollSalesCockpitRows(null, 3), false)
assert.equal(formatSalesCockpitScrollDuration([1, 2], 6), '18s')
assert.equal(formatSalesCockpitScrollDuration([1, 2, 3, 4], 6), '24s')

const rows = [
  { id: 'active', status: 'active', order_status: '已确认', stage: '需求确认' },
  { id: 'deleted', status: 'deleted', order_status: '已确认', stage: '需求确认' },
  { id: 'cancelled', status: 'active', order_status: '已取消', stage: '需求确认' },
  { id: 'lost', status: 'active', order_status: '已确认', stage: '输单' },
  { id: 'paused', status: 'active', order_status: '已确认', stage: '搁置' }
]
assert.deepEqual(selectActiveSalesCustomers(rows).map((row) => row.id), ['active', 'cancelled', 'lost', 'paused'])
assert.deepEqual(selectActiveSalesOrders(rows).map((row) => row.id), ['active', 'lost', 'paused'])
assert.deepEqual(selectActiveSalesPayments(rows).map((row) => row.id), ['active', 'cancelled', 'lost', 'paused'])
assert.deepEqual(selectActiveSalesOpportunities(rows).map((row) => row.id), ['active', 'cancelled'])
assert.deepEqual(selectActiveSalesFollowUps(rows).map((row) => row.id), ['active', 'cancelled', 'lost', 'paused'])
assert.deepEqual(rows.map((row) => row.id), ['active', 'deleted', 'cancelled', 'lost', 'paused'])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-presentation-policy.js'), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date()'
]) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit presentation policy gained runtime dependency: ' + forbidden)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-cockpit-presentation-policy\.js['"]/)
for (const requiredCall of [
  'selectActiveSalesCustomers(customers.value)',
  'selectActiveSalesOrders(orders.value)',
  'selectActiveSalesPayments(payments.value)',
  'selectActiveSalesOpportunities(opportunities.value)',
  'selectActiveSalesFollowUps(followUps.value)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, 'SalesCockpit lost ' + requiredCall)
}
for (const removedDefinition of [
  'const toRows =', 'const toAmount =', 'const sumBy =', 'const getDateTime =',
  'const formatDate =', 'const formatRefreshTime =', 'const formatTime =',
  'const formatAmount =', 'const formatCurrency =', 'const clampRate =',
  'const shouldAutoScroll =', 'const scrollDuration ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, 'SalesCockpit reintroduced ' + removedDefinition)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1954)

console.log('PASS: SalesCockpit presentation policy preserves formatting, scrolling and active-row projections')
