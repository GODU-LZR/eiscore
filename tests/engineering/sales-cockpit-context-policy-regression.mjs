// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSalesCockpitAiContext } from '../../eiscore-sales/src/domain/sales-cockpit-context-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const stats = { orderAmount: 1200, paymentRate: 75 }
const kpis = [{ key: 'orders', value: '¥1,200' }]
const funnel = [{ label: '需求确认', count: 2 }]
const owners = [{ owner: '王浩', orderAmount: 1200 }]
const risks = [{ key: 'delivery-o1' }]
const actions = [{ key: 'opp-p1' }]
const events = [{ key: 'order-o1' }]
assert.deepEqual(buildSalesCockpitAiContext({
  stats,
  kpis,
  funnel,
  ownerPerformance: owners,
  receivableCustomers: [
    { customer_no: 'C-1', name: '甲公司', owner_name: '王浩', receivable_balance: '250.5', credit_limit: null }
  ],
  risks,
  actions,
  events
}), {
  app: 'sales',
  view: 'sales_cockpit',
  viewId: 'sales_cockpit',
  profile: 'public',
  aiScene: 'sales_cockpit',
  allowImport: false,
  allowFormula: false,
  dataStats: stats,
  cockpit: {
    kpis,
    funnel,
    ownerPerformance: owners,
    receivableCustomers: [{
      customerNo: 'C-1',
      customerName: '甲公司',
      ownerName: '王浩',
      receivableBalance: 250.5,
      creditLimit: 0
    }],
    risks,
    actions,
    events
  },
  moduleTips: [
    '销售驾驶舱用于面向管理层查看销售经营指标。',
    '商机管道和加权预测用于评估后续销售增长。',
    '风险预警聚合交付、商机逾期和应收问题。'
  ]
})
assert.deepEqual(buildSalesCockpitAiContext(), {
  app: 'sales',
  view: 'sales_cockpit',
  viewId: 'sales_cockpit',
  profile: 'public',
  aiScene: 'sales_cockpit',
  allowImport: false,
  allowFormula: false,
  dataStats: {},
  cockpit: { kpis: [], funnel: [], ownerPerformance: [], receivableCustomers: [], risks: [], actions: [], events: [] },
  moduleTips: [
    '销售驾驶舱用于面向管理层查看销售经营指标。',
    '商机管道和加权预测用于评估后续销售增长。',
    '风险预警聚合交付、商机逾期和应收问题。'
  ]
})

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-context-policy.js'), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'pushAiContext', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit context policy gained runtime dependency: ' + forbidden)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-cockpit-context-policy\.js['"]/)
assert.equal(pageSource.includes('buildSalesCockpitAiContext({'), true)
assert.equal(pageSource.includes("app: 'sales',"), false)
assert.equal(pageSource.includes('pushAiContext(buildCockpitContext())'), true)

console.log('PASS: SalesCockpit context policy preserves AI metadata and cockpit projections')
