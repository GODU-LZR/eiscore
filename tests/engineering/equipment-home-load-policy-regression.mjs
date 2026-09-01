// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EQUIPMENT_HOME_FALLBACK_SNAPSHOT,
  buildEquipmentHomeQueryRequests,
  shouldApplyEquipmentHomeFallback
} from '../../eiscore-equipment/src/domain/equipment-home-load-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

const expectedRequests = [
  { url: '/equipment_assets?status=neq.deleted&order=asset_no.asc&limit=500', method: 'get' },
  { url: '/equipment_checks?status=neq.deleted&order=check_date.desc&limit=500', method: 'get' },
  { url: '/equipment_issues?status=neq.deleted&order=deadline.asc&limit=500', method: 'get' },
  { url: '/equipment_work_orders?status=neq.deleted&order=plan_date.asc&limit=500', method: 'get' },
  { url: '/equipment_maintenance_plans?status=neq.deleted&order=next_execute_date.asc&limit=300', method: 'get' },
  { url: '/equipment_standards?status=neq.deleted&order=effective_date.desc&limit=300', method: 'get' }
]
assert.deepEqual(buildEquipmentHomeQueryRequests(), expectedRequests)
assert.notStrictEqual(buildEquipmentHomeQueryRequests(), buildEquipmentHomeQueryRequests())
assert.notStrictEqual(buildEquipmentHomeQueryRequests()[0], buildEquipmentHomeQueryRequests()[0])

assert.deepEqual(Object.keys(EQUIPMENT_HOME_FALLBACK_SNAPSHOT), [
  'assets', 'checks', 'issues', 'workOrders', 'plans', 'standards'
])
assert.deepEqual(Object.fromEntries(Object.entries(EQUIPMENT_HOME_FALLBACK_SNAPSHOT)
  .map(([key, rows]) => [key, rows.length])), {
  assets: 3,
  checks: 3,
  issues: 1,
  workOrders: 1,
  plans: 1,
  standards: 1
})
assert.deepEqual(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.assets.map((row) => row.id), [
  'demo-asset-1', 'demo-asset-2', 'demo-asset-3'
])
assert.deepEqual(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.assets.map((row) => [row.asset_no, row.run_status, row.health_score]), [
  ['EQ-FILL-002', '运行', 92],
  ['EQ-COLD-001', '维修中', 68],
  ['EQ-PACK-004', '停机', 74]
])
assert.deepEqual(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.checks.map((row) => [
  row.check_no, row.check_result, row.abnormal_count
]), [
  ['EC-20260605-001', '异常', 1],
  ['EC-20260604-012', '正常', 0],
  ['EC-20260604-008', '停机', 2]
])
assert.deepEqual(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.issues[0], {
  id: 'demo-issue-1',
  issue_no: 'EI-20260605-003',
  asset_no: 'EQ-FILL-002',
  asset_name: '二号灌装机',
  source_type: '班前点检',
  issue_desc: '旋盖扭矩持续偏低',
  issue_level: '严重',
  owner_dept: '设备部',
  owner_name: '王浩',
  occurred_date: '2026-06-05',
  deadline: '2026-06-06',
  issue_status: '处理中'
})
assert.equal(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.workOrders[0].downtime_hours, 1.5)
assert.equal(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.workOrders[0].work_status, '处理中')
assert.equal(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.plans[0].completion_rate, 62)
assert.equal(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.plans[0].plan_status, '执行中')
assert.equal(EQUIPMENT_HOME_FALLBACK_SNAPSHOT.standards[0].standard_status, '生效')

const emptySnapshot = {
  assets: [], checks: [], issues: [], workOrders: [], plans: [], standards: []
}
assert.equal(shouldApplyEquipmentHomeFallback(emptySnapshot), true)
for (const key of Object.keys(emptySnapshot)) {
  assert.equal(shouldApplyEquipmentHomeFallback({ ...emptySnapshot, [key]: [{}] }), false, `${key} must prevent fallback`)
}
assert.equal(shouldApplyEquipmentHomeFallback(), true)
assert.equal(shouldApplyEquipmentHomeFallback({ assets: null, checks: {}, issues: '', workOrders: 0 }), true)

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-equipment/src/domain/equipment-home-load-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'new Date', 'Math.random'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `equipment load policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-equipment/src/views/EquipmentHome.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/equipment-home-load-policy\.js['"]/)
for (const requiredCall of [
  'buildEquipmentHomeQueryRequests().map((config) => request(config))',
  'shouldApplyEquipmentHomeFallback({',
  'EQUIPMENT_HOME_FALLBACK_SNAPSHOT.assets',
  'EQUIPMENT_HOME_FALLBACK_SNAPSHOT.standards'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `EquipmentHome lost ${requiredCall}`)
}
for (const removedDefinition of [
  'const fallbackAssets =', 'const fallbackChecks =', 'const fallbackIssues =',
  'const fallbackWorkOrders =', 'const fallbackPlans =', 'const fallbackStandards ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `EquipmentHome reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1677)

console.log('PASS: EquipmentHome load policy preserves six query contracts and all-empty fallback snapshot')
