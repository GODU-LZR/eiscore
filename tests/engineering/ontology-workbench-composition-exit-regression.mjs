// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-apps/src/views/OntologyWorkbench.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 2184, `OntologyWorkbench grew beyond its 2184-line exit baseline: ${lines.length}`)

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
assert.ok(templateEnd - templateStart + 1 <= 736)
assert.ok(scriptEnd - scriptStart + 1 <= 660)
assert.ok(styleEnd - styleStart + 1 <= 785)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/ontology-workbench-[^'"]+-policy)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/ontology-workbench-kg-policy',
  '@/domain/ontology-workbench-query-policy',
  '@/domain/ontology-workbench-relation-policy'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-apps/src',
  `${specifier.replace('@/', '')}.js`
))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of [
    'from \'vue\'',
    'from \'element-plus\'',
    'from \'echarts\'',
    'axios',
    'fetch(',
    'window.',
    'document.',
    'localStorage',
    'sessionStorage',
    'Date.now',
    'new Date'
  ]) {
    assert.equal(policySource.includes(forbidden), false, `${file} gained runtime dependency: ${forbidden}`)
  }
}
assert.equal(policyExports, 54)

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/\brequest\s*\(/g) <= 11, 'OntologyWorkbench added Request orchestration')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 16, 'OntologyWorkbench added message orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 1, 'OntologyWorkbench added Router orchestration')
assert.ok(count(/\bwatch\(/g) <= 4, 'OntologyWorkbench added reactive watcher orchestration')
assert.ok(count(/new\s+ResizeObserver\s*\(/g) <= 2, 'OntologyWorkbench added ResizeObserver orchestration')
assert.ok(count(/\bnextTick\(/g) <= 4, 'OntologyWorkbench added DOM scheduling')
assert.equal(count(/\bonMounted\(/g), 1)
assert.equal(count(/\bonBeforeUnmount\(/g), 1)
assert.equal(count(/import\(['"]echarts['"]\)/g), 1)

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 35, `OntologyWorkbench callable inventory grew: ${callableDefinitions.length}`)

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
  assert.equal(forbidden.test(source), false, `OntologyWorkbench reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  "import('echarts')",
  'const requestConfig = buildOntologyColumnSemanticsRequest(tableKey)',
  'ONTOLOGY_INSIGHT_REQUESTS.map((config) => request(config))',
  'request(buildOntologyKgNeighborRequest',
  'request(buildOntologyKgPathRequest',
  'echarts.init(host)',
  'new ResizeObserver(() => {',
  "router.push('/')",
  'watch(kgGraphPayload, () => {',
  'onBeforeUnmount(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, `OntologyWorkbench lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: OntologyWorkbench composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/\brequest\s*\(/g)} Request operations)`)
