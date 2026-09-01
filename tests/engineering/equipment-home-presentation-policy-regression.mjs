// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildEquipmentAssetTypeRows,
  buildEquipmentHealthRiskRows,
  buildEquipmentIssueLevelRows,
  buildEquipmentPlanProgressRows,
  buildEquipmentStandardCoverageRows,
  buildEquipmentStatusRows,
  buildEquipmentVisibleWorkOrders,
  calculateEquipmentPercent,
  countEquipmentRowsBy,
  formatEquipmentNumber,
  resolveEquipmentStatusTone,
  toEquipmentNumber
} from '../../eiscore-equipment/src/domain/equipment-home-presentation-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const colors = { primary: 'blue', green: 'green', cyan: 'cyan', amber: 'amber', red: 'red', violet: 'violet' }
const assets = [
  { id: 'a1', run_status: '运行', asset_type: '泵', health_score: 90 },
  { id: 'a2', run_status: '停机', asset_type: '灌装', health_score: 60 },
  { id: 'a3', run_status: '维修中', asset_type: '泵', health_score: 70 },
  { id: 'a4', run_status: '运行', asset_type: '', health_score: 80 }
]

assert.equal(toEquipmentNumber('12.5'), 12.5)
assert.equal(toEquipmentNumber('invalid'), 0)
assert.equal(formatEquipmentNumber(12500), '1.3万')
assert.equal(formatEquipmentNumber(12), '12')
assert.equal(formatEquipmentNumber(12.25), '12.3')
assert.equal(calculateEquipmentPercent(3, 4), 75)
assert.equal(calculateEquipmentPercent(5, 4), 100)
assert.equal(calculateEquipmentPercent(-1, 4), 0)
assert.equal(calculateEquipmentPercent(1, 0), 0)
assert.deepEqual(countEquipmentRowsBy(assets, 'asset_type'), [
  { label: '泵', value: 2 }, { label: '灌装', value: 1 }, { label: '未分类', value: 1 }
])

assert.deepEqual(buildEquipmentStatusRows({ assets, colors }), [
  { label: '运行', value: 2, color: 'green' },
  { label: '停机', value: 1, color: 'red' },
  { label: '维修中', value: 1, color: 'amber' },
  { label: '待验收', value: 0, color: 'cyan' },
  { label: '报废', value: 0, color: 'violet' }
])
assert.deepEqual(buildEquipmentAssetTypeRows({ assets, colors }), [
  { label: '泵', value: 2, pct: 100, color: 'blue' },
  { label: '灌装', value: 1, pct: 50, color: 'green' },
  { label: '未分类', value: 1, pct: 50, color: 'cyan' }
])
assert.deepEqual(buildEquipmentHealthRiskRows(assets).map((row) => row.id), ['a2', 'a3', 'a4', 'a1'])

const plans = [
  { id: 'p1', plan_status: '执行中', completion_rate: 150 },
  { id: 'p2', plan_status: '执行中', completion_rate: -5 },
  { id: 'p3', plan_status: '已完成', completion_rate: 50 },
  { id: 'p4', plan_status: '计划中', completion_rate: 20 }
]
assert.deepEqual(buildEquipmentPlanProgressRows(plans).map((row) => [row.id, row.progress]), [
  ['p2', 0], ['p4', 20], ['p1', 100], ['p3', 50]
])

const standards = [
  { asset_type: '泵', standard_status: '生效' },
  { asset_type: '灌装', standard_status: '草稿' },
  { asset_type: '输送', standard_status: '生效' }
]
assert.deepEqual(buildEquipmentStandardCoverageRows({ assets, standards }), [
  { label: '灌装', total: 1, effective: 0, pct: 0 },
  { label: '未分类', total: 1, effective: 0, pct: 0 },
  { label: '泵', total: 2, effective: 2, pct: 100 }
])
assert.deepEqual(buildEquipmentStandardCoverageRows({ assets: [], standards }), [
  { label: '灌装', total: 1, effective: 0, pct: 0 },
  { label: '泵', total: 1, effective: 1, pct: 100 },
  { label: '输送', total: 1, effective: 1, pct: 100 }
])

const workOrders = [
  { id: 'w1', work_status: '已完成', plan_date: '2026-06-01' },
  { id: 'w2', work_status: '处理中', plan_date: '2026-06-03' },
  { id: 'w3', work_status: '待处理', plan_date: '2026-06-02' }
]
assert.deepEqual(buildEquipmentVisibleWorkOrders(workOrders).map((row) => row.id), ['w3', 'w2', 'w1'])
assert.deepEqual(buildEquipmentIssueLevelRows([
  { issue_status: '处理中', issue_level: '紧急' },
  { issue_status: '处理中', issue_level: '严重' },
  { issue_status: '处理中', issue_level: '一般' },
  { issue_status: '已关闭', issue_level: '紧急' }
]), [
  { label: '紧急', value: 1, level: 'danger' },
  { label: '严重', value: 1, level: 'warn' },
  { label: '一般', value: 1, level: 'info' }
])
assert.equal(resolveEquipmentStatusTone('运行'), 'ok')
assert.equal(resolveEquipmentStatusTone('停机'), 'danger')
assert.equal(resolveEquipmentStatusTone('执行中'), 'warn')
assert.equal(resolveEquipmentStatusTone('未知'), 'info')
assert.deepEqual(assets.map((row) => row.id), ['a1', 'a2', 'a3', 'a4'])
assert.deepEqual(plans.map((row) => row.id), ['p1', 'p2', 'p3', 'p4'])

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-equipment/src/domain/equipment-home-presentation-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `equipment presentation policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-equipment/src/views/EquipmentHome.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/equipment-home-presentation-policy\.js['"]/)
for (const requiredCall of [
  'buildEquipmentStatusRows({',
  'buildEquipmentAssetTypeRows({',
  'buildEquipmentHealthRiskRows(assets.value)',
  'buildEquipmentPlanProgressRows(plans.value)',
  'buildEquipmentStandardCoverageRows({',
  'buildEquipmentVisibleWorkOrders(workOrders.value)',
  'buildEquipmentIssueLevelRows(issues.value)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `EquipmentHome lost ${requiredCall}`)
}
for (const removedDefinition of [
  'const numberValue =', 'const numberText =', 'const percent =', 'const countBy =', 'const statusTone ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `EquipmentHome reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1955)

console.log('PASS: EquipmentHome presentation policy preserves numeric, distribution, risk, progress and status projections')
