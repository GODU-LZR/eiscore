// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSalesOwnerPerformance,
  buildSalesOwnerRanking,
  calculateSalesReceivableRate,
  selectSalesReceivableCustomers
} from '../../eiscore-sales/src/domain/sales-cockpit-ranking-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const customers = [
  { id: 'c1', receivable_balance: 100 },
  { id: 'c2', receivable_balance: 500 },
  { id: 'c3', receivable_balance: 0 },
  { id: 'c4', receivable_balance: '250' },
  { id: 'c5', receivable_balance: 10 },
  { id: 'c6', receivable_balance: 20 },
  { id: 'c7', receivable_balance: 30 },
  { id: 'c8', receivable_balance: 40 }
]
assert.deepEqual(selectSalesReceivableCustomers(customers).map((row) => row.id), [
  'c2', 'c4', 'c1', 'c8', 'c7', 'c6'
])
assert.equal(calculateSalesReceivableRate(customers[1], customers), 100)
assert.equal(calculateSalesReceivableRate(customers[4], customers), 8)
assert.equal(calculateSalesReceivableRate({}, []), 0)
assert.deepEqual(customers.map((row) => row.id), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'])

const orders = [
  { owner_name: '王浩', total_amount: 1000 },
  { owner_name: '王浩', total_amount: '500' },
  { owner_name: '陈雨', total_amount: 2000 },
  { owner_name: '', total_amount: 100 }
]
const opportunities = [
  { owner_name: '王浩', expected_amount: 1000 },
  { owner_name: '陈雨', expected_amount: 100 },
  { owner_name: '刘铭', expected_amount: 3000 },
  { owner_name: null, expected_amount: 100 }
]
const performance = buildSalesOwnerPerformance({ orders, opportunities })
assert.deepEqual(performance, [
  { owner: '陈雨', orderCount: 1, orderAmount: 2000, opportunityCount: 1, opportunityAmount: 100 },
  { owner: '王浩', orderCount: 2, orderAmount: 1500, opportunityCount: 1, opportunityAmount: 1000 },
  { owner: '刘铭', orderCount: 0, orderAmount: 0, opportunityCount: 1, opportunityAmount: 3000 },
  { owner: '未设置', orderCount: 1, orderAmount: 100, opportunityCount: 1, opportunityAmount: 100 }
])
assert.deepEqual(buildSalesOwnerRanking(performance), [
  { ...performance[0], rank: '01', rate: 100 },
  { ...performance[1], rank: '02', rate: 75 },
  { ...performance[2], rank: '03', rate: 8 },
  { ...performance[3], rank: '04', rate: 8 }
])
assert.deepEqual(buildSalesOwnerPerformance(), [])
assert.deepEqual(buildSalesOwnerRanking([]), [])
assert.deepEqual(orders.map((row) => row.owner_name), ['王浩', '王浩', '陈雨', ''])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-ranking-policy.js'), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit ranking policy gained runtime dependency: ' + forbidden)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-cockpit-ranking-policy\.js['"]/)
for (const requiredCall of [
  'selectSalesReceivableCustomers(activeCustomers.value)',
  'calculateSalesReceivableRate(customer, receivableCustomers.value)',
  'buildSalesOwnerPerformance({',
  'buildSalesOwnerRanking(ownerPerformance.value)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, 'SalesCockpit lost ' + requiredCall)
}
for (const removedDefinition of [
  'const receivableCustomers = computed(() => {', 'const maxReceivable = computed(',
  'const ownerPerformance = computed(() => {', 'const ownerRanking = computed(() => {'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, 'SalesCockpit reintroduced ' + removedDefinition)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1870)

console.log('PASS: SalesCockpit ranking policy preserves receivable and owner performance projections')
