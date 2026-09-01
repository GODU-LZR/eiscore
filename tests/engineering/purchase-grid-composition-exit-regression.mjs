// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-purchase/src/components/PurchaseAppGrid.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 1970, `PurchaseAppGrid grew beyond its 1970-line exit baseline: ${lines.length}`)

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
assert.ok(templateEnd - templateStart + 1 <= 405)
assert.ok(scriptEnd - scriptStart + 1 <= 1226)
assert.ok(styleEnd - styleStart + 1 <= 336)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/purchase-grid-[^'"]+-policy)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/purchase-grid-column-policy',
  '@/domain/purchase-grid-data-policy',
  '@/domain/purchase-grid-flow-policy',
  '@/domain/purchase-grid-operation-policy'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-purchase/src',
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
assert.equal(policyExports, 55)

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/\brequest\s*\(\{/g) <= 24, 'PurchaseAppGrid added Request orchestration')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 23, 'PurchaseAppGrid added message orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 4, 'PurchaseAppGrid added local Router orchestration')
assert.ok(count(/navigateEnterprisePath\(/g) <= 1, 'PurchaseAppGrid added platform navigation orchestration')
assert.ok(count(/\bwatch\(/g) <= 2, 'PurchaseAppGrid added reactive watcher orchestration')
assert.ok(count(/\bpushAi(?:Context|Command)\(/g) <= 2, 'PurchaseAppGrid added AI bridge orchestration')
assert.equal(count(/\bonMounted\(/g), 2)
assert.equal(count(/\bonUnmounted\(/g), 1)
assert.ok(count(/window\.addEventListener\(/g) <= 2, 'PurchaseAppGrid added window event setup')
assert.ok(count(/window\.removeEventListener\(/g) <= 2, 'PurchaseAppGrid added window event teardown')
assert.ok(count(/\bsetTimeout\(/g) <= 2, 'PurchaseAppGrid added timer orchestration')
assert.equal(count(/\bsetInterval\(/g), 0)
assert.ok(count(/\bgetRealtimeClient\(/g) <= 1, 'PurchaseAppGrid added Realtime client orchestration')
assert.ok(count(/\.subscribe\(/g) <= 1, 'PurchaseAppGrid added Realtime subscription orchestration')

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 68, `PurchaseAppGrid callable inventory grew: ${callableDefinitions.length}`)

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
  assert.equal(forbidden.test(source), false, `PurchaseAppGrid reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  'request({',
  'pushAiContext({',
  'pushAiCommand({',
  "navigateEnterprisePath('/materials/inventory-stock-in'",
  "router.push('/app/orders')",
  "router.push('/app/arrivals')",
  "router.push('/apps')",
  'getRealtimeClient()',
  "window.addEventListener('eis-ai-apply-formula'",
  "window.removeEventListener('eis-ai-apply-formula'",
  'onMounted(() => {',
  'onUnmounted(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, `PurchaseAppGrid lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: PurchaseAppGrid composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/\brequest\s*\(\{/g)} Request operations)`)
