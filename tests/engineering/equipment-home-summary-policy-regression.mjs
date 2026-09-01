// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildEquipmentCockpitSummary,
  buildEquipmentFlowNodes,
  buildEquipmentKpiRows,
  buildEquipmentWorkSummaryRows,
  calculateEquipmentRiskIndex
} from '../../eiscore-equipment/src/domain/equipment-home-summary-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const colors = { green: 'green', amber: 'amber', red: 'red', cyan: 'cyan' }
const assets = [
  { id: 'a1', run_status: '运行', health_score: 90 },
  { id: 'a2', run_status: '停机', health_score: 60 },
  { id: 'a3', run_status: '维修中', health_score: 'invalid' }
]
const checks = [
  { id: 'c1', check_result: '异常' },
  { id: 'c2', check_result: '停机' },
  { id: 'c3', check_result: '正常' }
]
const issues = [
  { id: 'i1', issue_status: '处理中', issue_level: '紧急' },
  { id: 'i2', issue_status: '已关闭', issue_level: '严重' },
  { id: 'i3', issue_status: '待处理', issue_level: '一般' }
]
const workOrders = [
  { id: 'w1', work_status: '处理中', downtime_hours: 1.5 },
  { id: 'w2', work_status: '待处理', downtime_hours: 'invalid' },
  { id: 'w3', work_status: '已完成', downtime_hours: 2.25 }
]
const plans = [
  { id: 'p1', plan_status: '执行中', next_execute_date: 'overdue', completion_rate: 25 },
  { id: 'p2', plan_status: '已完成', next_execute_date: 'overdue', completion_rate: 100 },
  { id: 'p3', plan_status: '计划中', next_execute_date: 'future', completion_rate: 75 },
  { id: 'p4', plan_status: '计划中', next_execute_date: 'invalid', completion_rate: 'invalid' }
]
const standards = [
  { id: 's1', standard_status: '生效' },
  { id: 's2', standard_status: '草稿' }
]
const daysUntil = (value) => ({ overdue: -1, future: 3, invalid: null })[value] ?? null

const summary = buildEquipmentCockpitSummary({
  assets,
  checks,
  issues,
  workOrders,
  plans,
  standards,
  daysUntil
})

assert.deepEqual(summary, {
  assetCount: 3,
  checkCount: 3,
  issueCount: 3,
  runningCount: 1,
  downCount: 2,
  avgHealthScore: 50,
  abnormalCheckCount: 2,
  openIssueCount: 2,
  urgentIssueCount: 2,
  activeWorkOrderCount: 2,
  completedWorkOrderCount: 1,
  totalDowntimeHours: 3.75,
  overduePlanCount: 1,
  effectiveStandardCount: 1,
  avgPlanCompletion: 50
})
assert.equal(calculateEquipmentRiskIndex(summary), 99)
assert.equal(calculateEquipmentRiskIndex({ downCount: 1 }), 16)

assert.deepEqual(buildEquipmentKpiRows({ summary, colors }), [
  { label: '设备健康评分', value: 50, sub: '3 台设备', color: 'amber', appKey: 'assets' },
  { label: '异常点检', value: 2, sub: '3 张点检单', color: 'amber', appKey: 'checks' },
  { label: '未关闭异常', value: 2, sub: '紧急/严重 2', color: 'red', appKey: 'issues' },
  { label: '处理中工单', value: 2, sub: '3.8h 停机', color: 'cyan', appKey: 'work_orders' }
])
assert.deepEqual(buildEquipmentFlowNodes(summary), [
  { label: '设备台账', value: 3, appKey: 'assets' },
  { label: '异常点检', value: 2, appKey: 'checks' },
  { label: '异常单', value: 3, appKey: 'issues' },
  { label: '维保中', value: 2, appKey: 'work_orders' },
  { label: '已完成', value: 1, appKey: 'work_orders' }
])
assert.deepEqual(buildEquipmentWorkSummaryRows(summary), [
  { label: '处理中', value: 2, appKey: 'work_orders' },
  { label: '停机小时', value: '3.8', appKey: 'work_orders' },
  { label: '计划完成', value: '50%', appKey: 'plans' },
  { label: '标准生效', value: 1, appKey: 'standards' }
])

const emptySummary = buildEquipmentCockpitSummary()
for (const value of Object.values(emptySummary)) assert.equal(value, 0)
assert.deepEqual(buildEquipmentKpiRows({ summary: emptySummary, colors }), [
  { label: '设备健康评分', value: 0, sub: '0 台设备', color: 'amber', appKey: 'assets' },
  { label: '异常点检', value: 0, sub: '0 张点检单', color: 'green', appKey: 'checks' },
  { label: '未关闭异常', value: 0, sub: '紧急/严重 0', color: 'green', appKey: 'issues' },
  { label: '处理中工单', value: 0, sub: '0h 停机', color: 'green', appKey: 'work_orders' }
])
assert.deepEqual(assets.map((row) => row.id), ['a1', 'a2', 'a3'])
assert.deepEqual(plans.map((row) => row.id), ['p1', 'p2', 'p3', 'p4'])

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-equipment/src/domain/equipment-home-summary-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `equipment summary policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-equipment/src/views/EquipmentHome.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/equipment-home-summary-policy\.js['"]/)
for (const requiredCall of [
  'buildEquipmentCockpitSummary({',
  'buildEquipmentKpiRows({',
  'calculateEquipmentRiskIndex(cockpitSummary.value)',
  'buildEquipmentFlowNodes(cockpitSummary.value)',
  'buildEquipmentWorkSummaryRows(cockpitSummary.value)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `EquipmentHome lost ${requiredCall}`)
}
for (const removedDefinition of [
  'const avgHealthScore = computed(() => {',
  'const riskIndex = computed(() => {',
  'const kpiList = computed(() => [',
  'const flowNodes = computed(() => [',
  'const workSummaryRows = computed(() => ['
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `EquipmentHome reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1932)

console.log('PASS: EquipmentHome summary policy preserves metrics, risk weights, KPI rows and cockpit summaries')
