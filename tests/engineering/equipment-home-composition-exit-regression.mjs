// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-equipment/src/views/EquipmentHome.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)
const lineCount = lines.at(-1) === '' ? lines.length - 1 : lines.length

assert.ok(lineCount <= 1642, 'EquipmentHome grew beyond its 1642-line exit baseline: ' + lineCount)

const markerLine = (marker) => lines.findIndex((line) => line === marker)
const templateStart = markerLine('<template>')
const templateEnd = markerLine('</template>')
const scriptStart = markerLine('<script setup>')
const scriptEnd = markerLine('</script>')
const styleStart = markerLine('<style scoped>')
const styleEnd = markerLine('</style>')
assert.equal(templateStart, 0)
assert.ok(templateStart < templateEnd)
assert.ok(templateEnd < scriptStart && scriptStart < scriptEnd)
assert.ok(scriptEnd < styleStart && styleStart < styleEnd)
assert.ok(templateEnd - templateStart + 1 <= 401)
assert.ok(scriptEnd - scriptStart + 1 <= 260)
assert.ok(styleEnd - styleStart + 1 <= 978)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/equipment-home-[^'"]+-policy\.js)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/equipment-home-data-policy.js',
  '@/domain/equipment-home-load-policy.js',
  '@/domain/equipment-home-presentation-policy.js',
  '@/domain/equipment-home-shell-policy.js',
  '@/domain/equipment-home-summary-policy.js',
  '@/domain/equipment-home-timeline-policy.js'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-equipment/src',
  specifier.replace('@/', '')
))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of [
    "from 'vue'", "from 'element-plus'", 'request({', 'axios', 'fetch(', 'window.',
    'document.', 'localStorage', 'sessionStorage', 'Date.now', 'Math.random'
  ]) {
    assert.equal(policySource.includes(forbidden), false, file + ' gained runtime dependency: ' + forbidden)
  }
  assert.equal(/new Date\(\s*\)/.test(policySource), false, file + ' gained implicit current time')
}
assert.equal(policyExports, 43)

const count = (pattern) => (source.match(pattern) || []).length
assert.equal(count(/\brequest\s*\(/g), 1)
assert.equal(count(/\bbuildEquipmentHomeQueryRequests\s*\(/g), 1)
assert.equal(count(/\.subscribe\s*\(/g), 1)
assert.equal(count(/router\.push\s*\(/g), 3)
assert.equal(count(/window\.setInterval\s*\(/g), 2)
assert.equal(count(/window\.clearInterval\s*\(/g), 2)
assert.equal(count(/window\.setTimeout\s*\(/g), 1)
assert.equal(count(/window\.clearTimeout\s*\(/g), 1)
assert.equal(count(/\.requestFullscreen\s*\(/g), 1)
assert.equal(count(/document\.exitFullscreen\s*\(/g), 1)
assert.equal(count(/\bonMounted\s*\(/g), 1)
assert.equal(count(/\bonBeforeUnmount\s*\(/g), 1)
assert.equal(count(/realtimeEventCount\.value \+= 1/g), 1)

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 12, 'EquipmentHome callable inventory grew: ' + callableDefinitions.length)

for (const forbidden of [
  /\baxios\b/,
  /\bfetch\s*\(/,
  /(?:local|session)Storage/,
  /new\s+EventSource\s*\(/,
  /new\s+WebSocket\s*\(/,
  /new\s+XMLHttpRequest\s*\(/,
  /window\.location(?:\.href)?\s*=/,
  /window\.location\.(?:assign|replace)\s*\(/,
  /['"]\/(?:equipment_assets|equipment_checks|equipment_issues|equipment_work_orders|equipment_maintenance_plans|equipment_standards)\?/
]) {
  assert.equal(forbidden.test(source), false, 'EquipmentHome reintroduced forbidden runtime access: ' + forbidden)
}

for (const retainedBoundary of [
  'buildEquipmentHomeQueryRequests().map((config) => request(config))',
  'getRealtimeClient().subscribe(handleRealtimeEvent)',
  'realtimeEventCount.value += 1',
  '}, 600)',
  'router.push(path)',
  'router.push(target)',
  "router.push('/')",
  'window.setInterval(updateClock, 1000)',
  '}, 30000)',
  'window.clearInterval(clockTimer)',
  'window.clearInterval(refreshTimer)',
  'window.clearTimeout(realtimeTimer)',
  'document.documentElement.requestFullscreen()',
  'document.exitFullscreen()',
  'onMounted(() => {',
  'onBeforeUnmount(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, 'EquipmentHome lost retained composition boundary: ' + retainedBoundary)
}

console.log('PASS: EquipmentHome composition exit gate (' + lineCount + ' lines, ' + policyImports.length + ' policy modules, ' + policyExports + ' policy exports)')
