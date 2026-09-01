// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildEquipmentAlertRows,
  buildEquipmentCheckBuckets,
  calculateEquipmentDaysBetween,
  formatEquipmentClockTime,
  formatEquipmentShortDate,
  parseEquipmentDate,
  startOfEquipmentDay
} from '../../eiscore-equipment/src/domain/equipment-home-timeline-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const referenceDate = new Date(2026, 5, 2, 18, 30, 0)

assert.equal(parseEquipmentDate(''), null)
assert.equal(parseEquipmentDate('invalid'), null)
assert.equal(parseEquipmentDate(new Date(2026, 5, 2, 8, 9, 10)).getTime(), new Date(2026, 5, 2, 8, 9, 10).getTime())
assert.equal(startOfEquipmentDay(referenceDate).getTime(), new Date(2026, 5, 2, 0, 0, 0, 0).getTime())
assert.equal(referenceDate.getHours(), 18)
assert.equal(calculateEquipmentDaysBetween(new Date(2026, 5, 1, 23, 59), referenceDate), -1)
assert.equal(calculateEquipmentDaysBetween(new Date(2026, 5, 2, 0, 1), referenceDate), 0)
assert.equal(calculateEquipmentDaysBetween(new Date(2026, 5, 3, 0, 1), referenceDate), 1)
assert.equal(calculateEquipmentDaysBetween('invalid', referenceDate), null)
assert.equal(formatEquipmentShortDate(new Date(2026, 4, 31, 12)), '5/31')
assert.equal(formatEquipmentShortDate('invalid'), '--')
assert.equal(formatEquipmentClockTime(new Date(2026, 5, 2, 8, 9, 10)), '08:09:10')
assert.equal(formatEquipmentClockTime(null), '--:--:--')

const checks = [
  { id: 'c1', check_date: new Date(2026, 4, 27, 10), abnormal_count: 1 },
  { id: 'c2', check_date: new Date(2026, 5, 1, 8), abnormal_count: 2 },
  { id: 'c3', check_date: new Date(2026, 5, 1, 20), abnormal_count: 'invalid' },
  { id: 'c4', check_date: new Date(2026, 5, 2, 12), abnormal_count: 0 },
  { id: 'before', check_date: new Date(2026, 4, 26, 12), abnormal_count: 9 },
  { id: 'after', check_date: new Date(2026, 5, 3, 12), abnormal_count: 9 },
  { id: 'invalid', check_date: 'invalid', abnormal_count: 9 }
]
const buckets = buildEquipmentCheckBuckets({ checks, referenceDate })
assert.deepEqual(buckets.map(({ label, count, abnormal, pct }) => ({ label, count, abnormal, pct })), [
  { label: '5/27', count: 1, abnormal: 1, pct: 50 },
  { label: '5/28', count: 0, abnormal: 0, pct: 8 },
  { label: '5/29', count: 0, abnormal: 0, pct: 8 },
  { label: '5/30', count: 0, abnormal: 0, pct: 8 },
  { label: '5/31', count: 0, abnormal: 0, pct: 8 },
  { label: '6/1', count: 2, abnormal: 2, pct: 100 },
  { label: '6/2', count: 1, abnormal: 0, pct: 50 }
])
assert.equal(buckets.every((item) => item.date.getHours() === 0), true)
assert.deepEqual(checks.map((row) => row.id), ['c1', 'c2', 'c3', 'c4', 'before', 'after', 'invalid'])

const assets = [
  { id: 'a1', asset_no: 'EQ-1', asset_name: '运行设备', run_status: '运行', health_score: 75 },
  { id: 'a2', asset_no: 'EQ-2', asset_name: '低健康设备', run_status: '运行', health_score: 74 },
  { id: 'a3', asset_no: 'EQ-3', asset_name: '维修设备', run_status: '维修中', health_score: 80 },
  { id: 'a4', asset_no: 'EQ-4', asset_name: '停机设备', run_status: '停机', health_score: 90 },
  { id: 'a5', asset_no: 'EQ-5', asset_name: '危险设备', run_status: '', health_score: 68 }
]
const issues = [
  { id: 'i1', issue_no: 'I-1', issue_desc: '已逾期', issue_status: '处理中', issue_level: '严重', deadline: new Date(2026, 4, 31, 12) },
  { id: 'i2', issue_no: 'I-2', issue_desc: '今天到期', issue_status: '待处理', issue_level: '一般', deadline: new Date(2026, 5, 2, 1) },
  { id: 'i3', issue_no: 'I-3', issue_desc: '无日期紧急', issue_status: '待处理', issue_level: '紧急', deadline: 'invalid' },
  { id: 'closed', issue_no: 'I-4', issue_desc: '已关闭', issue_status: '已关闭', issue_level: '紧急', deadline: new Date(2026, 4, 1) }
]
const plans = [
  { id: 'p1', plan_no: 'P-1', plan_name: '逾期计划', plan_status: '执行中', next_execute_date: new Date(2026, 5, 1) },
  { id: 'p2', plan_no: 'P-2', plan_name: '今日计划', plan_status: '计划中', next_execute_date: new Date(2026, 5, 2) },
  { id: 'p3', plan_no: 'P-3', plan_name: '明日计划', plan_status: '计划中', next_execute_date: new Date(2026, 5, 3) },
  { id: 'p4', plan_no: 'P-4', plan_name: '后日计划', plan_status: '计划中', next_execute_date: new Date(2026, 5, 4) },
  { id: 'done', plan_no: 'P-5', plan_name: '完成计划', plan_status: '已完成', next_execute_date: new Date(2026, 5, 1) }
]

const alerts = buildEquipmentAlertRows({ assets, issues, plans, referenceDate })
assert.equal(alerts.length, 8)
assert.deepEqual(alerts.map((row) => row.id), [
  'asset-a2', 'asset-a3', 'asset-a4', 'asset-a5',
  'issue-i1', 'issue-i2', 'issue-i3', 'plan-p1'
])
assert.deepEqual(alerts[0], {
  id: 'asset-a2', type: '运行', message: 'EQ-2 · 低健康设备 · 健康 74', level: 'warn', appKey: 'assets'
})
assert.equal(alerts[2].level, 'danger')
assert.equal(alerts[3].type, '健康')
assert.equal(alerts[4].message, 'I-1 · 已逾期 · 逾期2天')
assert.equal(alerts[4].level, 'danger')
assert.equal(alerts[5].message, 'I-2 · 今天到期 · 0天内到期')
assert.equal(alerts[5].level, 'warn')
assert.equal(alerts[6].message, 'I-3 · 无日期紧急')
assert.equal(alerts[6].level, 'danger')

assert.deepEqual(buildEquipmentAlertRows({ plans, referenceDate }), [
  { id: 'plan-p1', type: '计划逾期', message: 'P-1 · 逾期计划', level: 'danger', appKey: 'plans' },
  { id: 'plan-p2', type: '计划临期', message: 'P-2 · 今日计划', level: 'warn', appKey: 'plans' },
  { id: 'plan-p3', type: '计划临期', message: 'P-3 · 明日计划', level: 'warn', appKey: 'plans' }
])
assert.deepEqual(assets.map((row) => row.id), ['a1', 'a2', 'a3', 'a4', 'a5'])
assert.deepEqual(plans.map((row) => row.id), ['p1', 'p2', 'p3', 'p4', 'done'])

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-equipment/src/domain/equipment-home-timeline-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'new Date()', 'Math.random'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `equipment timeline policy gained implicit runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-equipment/src/views/EquipmentHome.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/equipment-home-timeline-policy\.js['"]/)
for (const requiredCall of [
  'buildEquipmentCheckBuckets({',
  'buildEquipmentAlertRows({',
  'calculateEquipmentDaysBetween(value, new Date())'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `EquipmentHome lost ${requiredCall}`)
}
for (const removedDefinition of [
  'const parseDate =', 'const dayStart =', 'const formatShortDate =', 'const formatClockTime =',
  'const checkBuckets = computed(() => {', 'const alertList = computed(() => {'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `EquipmentHome reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1855)

console.log('PASS: EquipmentHome timeline policy preserves local-day buckets, explicit date deltas and alert priority')
