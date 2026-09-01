// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EQUIPMENT_HOME_COLORS,
  buildEquipmentRecordRoute,
  buildEquipmentStatusPieStyle,
  formatEquipmentCockpitClock,
  formatEquipmentScrollDuration,
  resolveEquipmentAppRoute,
  resolveEquipmentLastSyncText,
  resolveEquipmentRealtimeStatusText
} from '../../eiscore-equipment/src/domain/equipment-home-shell-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.deepEqual(EQUIPMENT_HOME_COLORS, {
  primary: 'var(--c-primary)',
  green: 'var(--c-green)',
  amber: 'var(--c-amber)',
  red: 'var(--c-red)',
  cyan: 'var(--c-cyan)',
  violet: 'var(--c-violet)'
})

assert.equal(formatEquipmentScrollDuration(2), '12s')
assert.equal(formatEquipmentScrollDuration(5), '15s')
assert.equal(formatEquipmentScrollDuration('4', 2, 5), '8s')
assert.equal(formatEquipmentScrollDuration('invalid', 2, 5), '5s')
assert.equal(resolveEquipmentRealtimeStatusText(true), '实时传输')
assert.equal(resolveEquipmentRealtimeStatusText(false), '轮询传输')
assert.equal(resolveEquipmentRealtimeStatusText(1), '实时传输')

const clockDate = new Date(2026, 5, 2, 8, 9, 10)
assert.equal(formatEquipmentCockpitClock(clockDate), clockDate.toLocaleString('zh-CN', {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}))
assert.equal(resolveEquipmentLastSyncText(null), '等待同步')
assert.equal(resolveEquipmentLastSyncText(clockDate), `同步 ${clockDate.toLocaleTimeString('zh-CN', { hour12: false })}`)

assert.deepEqual(buildEquipmentStatusPieStyle([]), {
  background: 'conic-gradient(rgba(255,255,255,0.16) 0deg 360deg)'
})
assert.deepEqual(buildEquipmentStatusPieStyle([
  { label: '运行', value: 2, color: 'green' },
  { label: '停机', value: 1, color: 'red' },
  { label: '维修中', value: 1, color: 'amber' },
  { label: '待验收', value: 0, color: 'cyan' }
]), {
  background: 'conic-gradient(green 0deg 180deg, red 180deg 270deg, amber 270deg 360deg, cyan 360deg 360deg)'
})

assert.equal(resolveEquipmentAppRoute('assets'), '/app/assets')
assert.equal(resolveEquipmentAppRoute('checks'), '/app/checks')
assert.equal(resolveEquipmentAppRoute('issues'), '/app/issues')
assert.equal(resolveEquipmentAppRoute('work_orders'), '/app/work_orders')
assert.equal(resolveEquipmentAppRoute('plans'), '/app/plans')
assert.equal(resolveEquipmentAppRoute('standards'), '/app/standards')
assert.equal(resolveEquipmentAppRoute('unknown'), undefined)

assert.deepEqual(buildEquipmentRecordRoute({ id: 'record-1' }, 'checks'), {
  name: 'EquipmentDocumentDetail',
  params: { id: 'record-1' },
  query: { appKey: 'checks', demo: undefined }
})
assert.deepEqual(buildEquipmentRecordRoute({ id: 'demo-record-1' }, 'assets'), {
  name: 'EquipmentDocumentDetail',
  params: { id: 'demo-record-1' },
  query: { appKey: 'assets', demo: '1' }
})
assert.equal(buildEquipmentRecordRoute({}, 'assets'), null)
assert.equal(buildEquipmentRecordRoute(null, 'assets'), null)

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-equipment/src/domain/equipment-home-shell-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'new Date', 'Math.random', 'router.'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `equipment shell policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-equipment/src/views/EquipmentHome.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/equipment-home-shell-policy\.js['"]/)
for (const requiredCall of [
  'formatEquipmentCockpitClock(new Date())',
  'buildEquipmentStatusPieStyle(statusRows.value)',
  'resolveEquipmentAppRoute(key)',
  'buildEquipmentRecordRoute(row, appKey)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `EquipmentHome lost ${requiredCall}`)
}
for (const removedDefinition of [
  'const colors = {', 'const scrollDuration =', 'const appRoutes = {',
  'const statusPieStyle = computed(() => {'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `EquipmentHome reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1642)

console.log('PASS: EquipmentHome shell policy preserves colors, clocks, status pie and navigation projections')
