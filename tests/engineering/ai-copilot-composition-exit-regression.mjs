// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 3522, `AiCopilot grew beyond its 3522-line exit baseline: ${lines.length}`)

const markerLine = (marker) => lines.findIndex((line) => line === marker)
const templateStart = markerLine('<template>')
const templateEnd = markerLine('</template>')
const scriptStart = markerLine('<script setup>')
const scriptEnd = markerLine('</script>')
const styleStart = markerLine('<style scoped lang="scss">')
const styleEnd = markerLine('</style>')
assert.equal(templateStart, 0)
assert.ok(templateStart < templateEnd)
assert.ok(templateEnd < scriptStart && scriptStart < scriptEnd)
assert.ok(scriptEnd < styleStart && styleStart < styleEnd)
assert.ok(templateEnd - templateStart + 1 <= 509)
assert.ok(scriptEnd - scriptStart + 1 <= 1765)
assert.ok(styleEnd - styleStart + 1 <= 1245)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/ai-copilot-[^'"]+-policy)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/ai-copilot-chart-policy',
  '@/domain/ai-copilot-import-policy',
  '@/domain/ai-copilot-message-block-policy',
  '@/domain/ai-copilot-report-policy',
  '@/domain/ai-copilot-smart-bi-action-policy',
  '@/domain/ai-copilot-template-policy',
  '@/domain/ai-copilot-workflow-policy'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-base/src',
  `${specifier.replace('@/', '')}.js`
))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of [
    'from \'vue\'',
    'element-plus',
    'requestJson',
    'axios',
    'window.',
    'document.',
    'localStorage',
    'sessionStorage'
  ]) {
    assert.equal(policySource.includes(forbidden), false, `${file} gained runtime dependency: ${forbidden}`)
  }
}
assert.equal(policyExports, 77)

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/\.requestJson\(/g) <= 8, 'AiCopilot added host HTTP orchestration')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 24, 'AiCopilot added message/confirmation orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 2, 'AiCopilot added local Router orchestration')
assert.ok(count(/\bwatch\(/g) <= 6, 'AiCopilot added reactive watcher orchestration')
assert.equal(count(/\bonMounted\(/g), 1)
assert.equal(count(/\bonUpdated\(/g), 1)
assert.equal(count(/\bonBeforeUnmount\(/g), 1)

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 94, `AiCopilot callable inventory grew: ${callableDefinitions.length}`)

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
  assert.equal(forbidden.test(source), false, `AiCopilot reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  'getHostHttpClient().requestJson(',
  'createBusinessSnapshotLoader({',
  'aiBridge.sendMessage(',
  'new DOMParser()',
  'document.querySelectorAll(',
  'navigator.clipboard.writeText(',
  "window.open('', '_blank')",
  'new CustomEvent(',
  'onBeforeUnmount(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, `AiCopilot lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: AiCopilot composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/\.requestJson\(/g)} host HTTP operations)`)
