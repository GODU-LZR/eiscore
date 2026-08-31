// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-sales/src/components/SalesAppGrid.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 3822, `SalesAppGrid grew beyond its 3822-line exit baseline: ${lines.length}`)

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
assert.ok(templateEnd - templateStart + 1 <= 833)
assert.ok(scriptEnd - scriptStart + 1 <= 2541)
assert.ok(styleEnd - styleStart + 1 <= 445)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/sales-grid-[^'"]+-policy)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/sales-grid-data-policy',
  '@/domain/sales-grid-detail-policy',
  '@/domain/sales-grid-flow-policy',
  '@/domain/sales-grid-quick-entry-policy'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-sales/src',
  `${specifier.replace('@/', '')}.js`
))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of ['from \'vue\'', 'element-plus', 'request({', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage']) {
    assert.equal(policySource.includes(forbidden), false, `${file} gained runtime dependency: ${forbidden}`)
  }
}
assert.equal(policyExports, 40)

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/\brequest\(\{/g) <= 53, 'SalesAppGrid added Request orchestration')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 57, 'SalesAppGrid added message/confirmation orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 1, 'SalesAppGrid added local Router orchestration')
assert.equal(count(/\bonMounted\(/g), 2)
assert.equal(count(/\bonUnmounted\(/g), 1)
assert.ok(count(/\bwatch\(/g) <= 8, 'SalesAppGrid added reactive watcher orchestration')

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 124, `SalesAppGrid callable inventory grew: ${callableDefinitions.length}`)

for (const forbidden of [
  /\bfetch\s*\(/,
  /\baxios\b/,
  /(?:local|session)Storage/,
  /new\s+EventSource\s*\(/,
  /new\s+WebSocket\s*\(/,
  /new\s+XMLHttpRequest\s*\(/,
  /window\.location(?:\.href)?\s*=/,
  /window\.location\.(?:assign|replace)\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `SalesAppGrid reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  'request({',
  'ElMessageBox.prompt(',
  "router.push('/apps')",
  'getRealtimeClient()',
  'setTimeout(',
  "window.addEventListener('eis-ai-apply-formula'",
  "window.removeEventListener('eis-ai-apply-formula'"
]) {
  assert.equal(source.includes(retainedBoundary), true, `SalesAppGrid lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: SalesAppGrid composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/\brequest\(\{/g)} Request operations)`)
