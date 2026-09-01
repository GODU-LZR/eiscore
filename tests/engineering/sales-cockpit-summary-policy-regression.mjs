// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSalesCockpitKpiCards,
  buildSalesCockpitStats,
  buildSalesCreditUsage,
  buildSalesOpportunityFunnel,
  buildSalesOrderStageStats,
  buildSalesPaymentGauge
} from '../../eiscore-sales/src/domain/sales-cockpit-summary-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const customers = [
  { level: '战略客户', credit_limit: 1000, receivable_balance: 300 },
  { level: '普通客户', credit_limit: '500', receivable_balance: 0 }
]
const orders = [
  { order_status: '已确认', total_amount: 1000 },
  { order_status: '已发货', total_amount: '500' },
  { order_status: '已完成', total_amount: 'invalid' }
]
const payments = [
  { amount: 400, verify_status: '已核销' },
  { amount: 200, verify_status: '待核销' }
]
const activeOpportunities = [
  { stage: '需求确认', expected_amount: 1000, probability: 40 },
  { stage: '商务谈判', expected_amount: 3000, probability: 80 }
]
const opportunities = [
  ...activeOpportunities,
  { stage: '赢单', status: 'active' },
  { stage: '输单', status: 'active' },
  { stage: '赢单', status: 'deleted' }
]

const stats = buildSalesCockpitStats({
  customers, orders, opportunities, activeOpportunities, payments, followUps: [{}, {}]
})
assert.deepEqual(stats, {
  customerCount: 2,
  strategicCustomerCount: 1,
  opportunityCount: 2,
  orderCount: 3,
  paymentCount: 2,
  followCount: 2,
  orderAmount: 1500,
  paymentAmount: 600,
  opportunityAmount: 4000,
  weightedOpportunityAmount: 2800,
  receivableBalance: 300,
  avgOrderAmount: 500,
  winRate: 50,
  paymentRate: 40,
  pendingVerifyCount: 1
})
assert.equal(buildSalesCockpitStats({ orders: [{ total_amount: 100 }], payments: [{ amount: 20 }] }).receivableBalance, 80)
assert.equal(buildSalesCockpitStats().receivableBalance, 0)

assert.deepEqual(buildSalesCockpitKpiCards(stats), [
  { key: 'customers', label: '客户总数', value: '2', sub: '战略/重点 1 家', tone: 'blue' },
  { key: 'opportunities', label: '商机管道', value: '¥4,000', sub: '2 个活跃商机', tone: 'indigo' },
  { key: 'weighted', label: '加权预测', value: '¥2,800', sub: '按赢率折算', tone: 'teal' },
  { key: 'orders', label: '有效订单', value: '¥1,500', sub: '3 笔订单', tone: 'green' },
  { key: 'payments', label: '回款金额', value: '¥600', sub: '回款率 40%', tone: 'orange' },
  { key: 'receivable', label: '应收余额', value: '¥300', sub: '待核销 1 笔', tone: 'red' }
])

assert.deepEqual(buildSalesOpportunityFunnel(activeOpportunities), [
  { label: '需求确认', count: 1, amount: 1000, rate: 25 },
  { label: '商务谈判', count: 1, amount: 3000, rate: 75 }
])
assert.deepEqual(buildSalesOpportunityFunnel([]), [])
assert.deepEqual(buildSalesOrderStageStats(orders), [
  { label: '草稿', count: 0, rate: 0 },
  { label: '已确认', count: 1, rate: 33 },
  { label: '生产中', count: 0, rate: 0 },
  { label: '已发货', count: 1, rate: 33 },
  { label: '已完成', count: 1, rate: 33 }
])
assert.deepEqual(buildSalesCreditUsage({ customers, receivableBalance: 300 }), { totalCreditLimit: 1500, rate: 20 })
assert.deepEqual(buildSalesCreditUsage(), { totalCreditLimit: 0, rate: 0 })
assert.deepEqual(buildSalesCreditUsage({ customers: [{ credit_limit: 100 }], receivableBalance: 200 }), { totalCreditLimit: 100, rate: 100 })

const lowGauge = buildSalesPaymentGauge(40)
assert.equal(lowGauge.rate, 40)
assert.equal(lowGauge.color, 'var(--c-red)')
assert.equal(lowGauge.dash, `${257.61 * 0.4} ${257.61 * 0.6}`)
assert.equal(buildSalesPaymentGauge(50).color, 'var(--c-amber)')
assert.equal(buildSalesPaymentGauge(80).color, 'var(--c-green)')
assert.equal(buildSalesPaymentGauge(120).rate, 100)

assert.deepEqual(customers.map((row) => row.credit_limit), [1000, '500'])
assert.deepEqual(orders.map((row) => row.order_status), ['已确认', '已发货', '已完成'])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-summary-policy.js'), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit summary policy gained runtime dependency: ' + forbidden)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-cockpit-summary-policy\.js['"]/)
for (const requiredCall of [
  'buildSalesCockpitStats({',
  'buildSalesCockpitKpiCards(stats.value)',
  'buildSalesOpportunityFunnel(activeOpportunities.value)',
  'buildSalesOrderStageStats(activeOrders.value)',
  'buildSalesCreditUsage({',
  'buildSalesPaymentGauge(stats.value.paymentRate)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, 'SalesCockpit lost ' + requiredCall)
}
for (const removedDefinition of [
  'const stats = computed(() => {', 'const kpiCards = computed(() => [',
  'const opportunityFunnel = computed(() => {', 'const orderStageStats = computed(() => {',
  'const paymentGaugeColor = computed(() => {'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, 'SalesCockpit reintroduced ' + removedDefinition)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1900)

console.log('PASS: SalesCockpit summary policy preserves metrics, KPI, funnel, stages, credit and payment gauge projections')
