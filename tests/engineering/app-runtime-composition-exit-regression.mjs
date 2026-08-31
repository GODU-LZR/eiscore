// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const runtimePath = resolve(repoRoot, 'eiscore-apps/src/views/AppRuntime.vue')
const source = readFileSync(runtimePath, 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 3725, `AppRuntime grew beyond its ${3725}-line exit baseline: ${lines.length}`)

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
assert.ok(templateEnd - templateStart + 1 <= 849)
assert.ok(scriptEnd - scriptStart + 1 <= 2167)
assert.ok(styleEnd - styleStart + 1 <= 706)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/[^'"]+)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/app-runtime-bpmn.mjs',
  '@/domain/app-runtime-flash-source.mjs',
  '@/domain/app-runtime-navigation-policy.mjs',
  '@/domain/app-runtime-workflow-policy.mjs'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-apps/src',
  specifier.replace('@/', '')
))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of ['from \'vue\'', 'element-plus', 'axios', 'localStorage', 'sessionStorage']) {
    assert.equal(policySource.includes(forbidden), false, `${file} gained runtime dependency: ${forbidden}`)
  }
}
assert.equal(policyExports, 94)

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/axios\.(?:get|post|patch|delete)\(/g) <= 29, 'AppRuntime added direct Axios orchestration')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 60, 'AppRuntime added message/confirmation orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 5, 'AppRuntime added local Router orchestration')
assert.equal(count(/\bonMounted\(/g), 1)
assert.equal(count(/\bonUnmounted\(/g), 1)

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 118, `AppRuntime callable inventory grew: ${callableDefinitions.length}`)

for (const forbidden of [
  /\bfetch\s*\(/,
  /(?:local|session)Storage/,
  /new\s+EventSource\s*\(/,
  /new\s+WebSocket\s*\(/,
  /window\.location(?:\.href)?\s*=/,
  /window\.location\.(?:assign|replace)\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `AppRuntime reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  'new DOMParser().parseFromString',
  'window.location.pathname',
  'window.setInterval(',
  "window.addEventListener('mousemove'",
  'await axios.get(',
  'await axios.post(',
  'ElMessageBox.confirm(',
  'router.push('
]) {
  assert.equal(source.includes(retainedBoundary), true, `AppRuntime lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: AppRuntime composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/axios\.(?:get|post|patch|delete)\(/g)} Axios operations)`)
