// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSalesActionItems,
  buildSalesRiskItems
} from '../../eiscore-sales/src/domain/sales-cockpit-risk-action-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const referenceTime = new Date(2026, 5, 2, 12, 0, 0)
const risks = buildSalesRiskItems({
  referenceTime,
  orders: [
    { id: 'o1', order_no: 'SO-1', customer_name: '甲公司', delivery_date: '2026-06-04', order_status: '已确认' },
    { id: 'o2', order_no: 'SO-2', customer_name: '乙公司', delivery_date: '2026-06-06', order_status: '已确认' },
    { id: 'o3', order_no: 'SO-3', customer_name: '丙公司', delivery_date: '2026-06-01', order_status: '已完成' },
    { id: 'o4', customer_name: '', delivery_date: '2026-06-01', order_status: '生产中' }
  ],
  opportunities: [
    { id: 'p1', opportunity_name: '逾期商机', stage: '商务谈判', expected_close_date: '2026-06-01' },
    { id: 'p2', opportunity_no: 'OP-2', stage: '方案报价', expected_close_date: '2026-06-04' },
    { id: 'p3', opportunity_name: '窗口外', stage: '需求确认', expected_close_date: '2026-06-06' },
    { id: 'p4', opportunity_name: '已赢单', stage: '赢单', expected_close_date: '2026-06-01' }
  ],
  receivableCustomers: [
    { id: 'c1', name: '应收甲', receivable_balance: 12500, owner_name: '王浩' },
    { id: 'c2', customer_no: 'C-2', receivable_balance: 100, owner_name: '' },
    { id: 'c3', name: '应收丙', receivable_balance: 50, owner_name: '陈雨' },
    { id: 'c4', name: '不应出现', receivable_balance: 10, owner_name: '刘铭' }
  ]
})
assert.deepEqual(risks, [
  { key: 'delivery-o1', appKey: 'orders', label: '交付', type: 'danger', title: 'SO-1', desc: '甲公司，交付 2026-06-04' },
  { key: 'delivery-o4', appKey: 'orders', label: '交付', type: 'danger', title: '未编号订单', desc: '-，交付 2026-06-01' },
  { key: 'opportunity-p1', appKey: 'opportunities', label: '商机', type: 'danger', title: '逾期商机', desc: '商务谈判，预计成交 2026-06-01' },
  { key: 'opportunity-p2', appKey: 'opportunities', label: '商机', type: 'warning', title: 'OP-2', desc: '方案报价，预计成交 2026-06-04' },
  { key: 'receivable-c1', appKey: 'customers', label: '应收', type: 'warning', title: '应收甲', desc: '应收 ¥1.3万，负责人 王浩' },
  { key: 'receivable-c2', appKey: 'customers', label: '应收', type: 'warning', title: 'C-2', desc: '应收 ¥100，负责人 -' },
  { key: 'receivable-c3', appKey: 'customers', label: '应收', type: 'warning', title: '应收丙', desc: '应收 ¥50，负责人 陈雨' }
])
assert.equal(referenceTime.getHours(), 12)

const actions = buildSalesActionItems({
  referenceTime,
  followUps: [
    { id: 'f1', customer_name: '甲公司', next_follow_at: '2026-06-08', follow_type: '电话', owner_name: '王浩', follow_result: '待跟进' },
    { id: 'f2', follow_no: 'FU-2', next_follow_at: '2026-06-10', follow_type: '拜访', owner_name: '陈雨', follow_result: '待跟进' },
    { id: 'f3', customer_name: '已成交', next_follow_at: '2026-06-03', follow_result: '已成交' }
  ],
  opportunities: [
    { id: 'p1', opportunity_name: '行动商机', stage: '商务谈判', next_action: '提交报价' },
    { id: 'p2', opportunity_no: 'OP-2', stage: '方案报价', next_action: '安排演示' },
    { id: 'p3', opportunity_name: '已赢单', stage: '赢单', next_action: '归档' },
    { id: 'p4', opportunity_name: '无行动', stage: '需求确认', next_action: '' }
  ]
})
assert.deepEqual(actions, [
  { key: 'opp-p1', appKey: 'opportunities', label: '商机', title: '行动商机', desc: '商务谈判，提交报价' },
  { key: 'opp-p2', appKey: 'opportunities', label: '商机', title: 'OP-2', desc: '方案报价，安排演示' },
  { key: 'follow-f1', appKey: 'follow_ups', label: '跟进', title: '甲公司', desc: '2026-06-08 电话，王浩' }
])
assert.deepEqual(buildSalesRiskItems({ referenceTime }), [])
assert.deepEqual(buildSalesActionItems({ referenceTime }), [])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-risk-action-policy.js'), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date()'
]) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit risk/action policy gained runtime dependency: ' + forbidden)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-cockpit-risk-action-policy\.js['"]/)
for (const requiredCall of ['buildSalesRiskItems({', 'buildSalesActionItems({', 'referenceTime: new Date()']) {
  assert.equal(pageSource.includes(requiredCall), true, 'SalesCockpit lost ' + requiredCall)
}
for (const removedDefinition of ['const riskItems = computed(() => {', 'const actionItems = computed(() => {']) {
  assert.equal(pageSource.includes(removedDefinition), false, 'SalesCockpit reintroduced ' + removedDefinition)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1821)

console.log('PASS: SalesCockpit risk/action policy preserves deadlines, ordering, limits and presentation')
