// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-production/src/components/ProductionAppGrid.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 2077, `ProductionAppGrid grew beyond its 2077-line exit baseline: ${lines.length}`)

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
assert.ok(templateEnd - templateStart + 1 <= 556)
assert.ok(scriptEnd - scriptStart + 1 <= 1124)
assert.ok(styleEnd - styleStart + 1 <= 394)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/production-grid-[^'"]+-policy)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/production-grid-column-policy',
  '@/domain/production-grid-data-policy',
  '@/domain/production-grid-flow-policy',
  '@/domain/production-grid-operation-policy'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-production/src',
  `${specifier.replace('@/', '')}.js`
))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of [
    'from \'vue\'',
    'from \'element-plus\'',
    'request({',
    'axios',
    'window.',
    'document.',
    'localStorage',
    'sessionStorage',
    'Date.now',
    'Math.random',
    'new Date'
  ]) {
    assert.equal(policySource.includes(forbidden), false, `${file} gained runtime dependency: ${forbidden}`)
  }
}
assert.equal(policyExports, 49)

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/\brequest\s*\(\{/g) <= 15, 'ProductionAppGrid added Request orchestration')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 27, 'ProductionAppGrid added message orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 2, 'ProductionAppGrid added local Router orchestration')
assert.ok(count(/navigateEnterprisePath\(/g) <= 1, 'ProductionAppGrid added platform navigation orchestration')
assert.ok(count(/\bwatch\(/g) <= 3, 'ProductionAppGrid added reactive watcher orchestration')
assert.ok(count(/\bpushAi(?:Context|Command)\(/g) <= 2, 'ProductionAppGrid added AI bridge orchestration')
assert.equal(count(/\bonMounted\(/g), 1)
assert.equal(count(/\bonUnmounted\(/g), 1)
assert.ok(count(/window\.addEventListener\(/g) <= 1, 'ProductionAppGrid added window event setup')
assert.ok(count(/window\.removeEventListener\(/g) <= 1, 'ProductionAppGrid added window event teardown')
assert.equal(count(/\bsetTimeout\(/g), 0)
assert.equal(count(/\bsetInterval\(/g), 0)

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 66, `ProductionAppGrid callable inventory grew: ${callableDefinitions.length}`)

for (const forbidden of [
  /\baxios\b/,
  /\bfetch\s*\(/,
  /(?:local|session)Storage/,
  /new\s+EventSource\s*\(/,
  /new\s+WebSocket\s*\(/,
  /new\s+XMLHttpRequest\s*\(/,
  /window\.location(?:\.href)?\s*=/,
  /window\.location\.(?:assign|replace)\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `ProductionAppGrid reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  'request({',
  'pushAiContext({',
  'pushAiCommand({',
  'navigateEnterprisePath(path, { tabTitle })',
  "router.push('/bom')",
  "router.push('/apps')",
  "window.addEventListener('eis-ai-apply-formula'",
  "window.removeEventListener('eis-ai-apply-formula'",
  'onMounted(() => {',
  'onUnmounted(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, `ProductionAppGrid lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: ProductionAppGrid composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/\brequest\s*\(\{/g)} Request operations)`)
