// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-base/src/layout/index.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 3535, `base layout grew beyond its 3535-line exit baseline: ${lines.length}`)

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
assert.ok(templateEnd - templateStart + 1 <= 248)
assert.ok(scriptEnd - scriptStart + 1 <= 2908)
assert.ok(styleEnd - styleStart + 1 <= 376)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/base-layout-[^'"]+-policy)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/base-layout-guide-policy',
  '@/domain/base-layout-host-tab-policy',
  '@/domain/base-layout-micro-app-policy',
  '@/domain/base-layout-shell-policy'
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
    'from \'element-plus\'',
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
assert.equal(policyExports, 41)

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/\.requestJson\(/g) <= 6, 'base layout added host HTTP orchestration')
assert.ok(count(/\bfetch\s*\(/g) <= 2, 'base layout added static asset requests')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 2, 'base layout added message orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 5, 'base layout added Router orchestration')
assert.ok(count(/\bwatch\(/g) <= 6, 'base layout added reactive watcher orchestration')
assert.ok(count(/\bsetTimeout\(/g) <= 10, 'base layout added timer orchestration')
assert.ok(count(/\bsetInterval\(/g) <= 1, 'base layout added interval orchestration')
assert.ok(count(/\.addEventListener\(/g) <= 8, 'base layout added window event subscriptions')
assert.equal(count(/\.addEventListener\(/g), count(/\.removeEventListener\(/g))
assert.equal(count(/new\s+MutationObserver\s*\(/g), 1)
assert.equal(count(/\bonMounted\(/g), 2)
assert.equal(count(/\bonUnmounted\(/g), 2)

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 83, `base layout callable inventory grew: ${callableDefinitions.length}`)

for (const forbidden of [
  /\baxios\b/,
  /(?:local|session)Storage/,
  /new\s+EventSource\s*\(/,
  /new\s+WebSocket\s*\(/,
  /new\s+XMLHttpRequest\s*\(/,
  /window\.location(?:\.href)?\s*=/,
  /window\.location\.(?:assign|replace)\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `base layout reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  'getHostHttpClient().requestJson(',
  'microAppManifestPromise = fetch(',
  'useDisplayVisibility()',
  'new MutationObserver(scheduleGuideDomRefresh)',
  'readGuideProgress(guideUserKey.value)',
  'writeGuideProgress(guideUserKey.value, guideProgress.value || {})',
  'driver({',
  'const parsed = readHostTabs()',
  'writeHostTabs(payload)',
  'router.push({',
  "window.addEventListener('eis:open-host-tab'",
  'onUnmounted(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, `base layout lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: base layout composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/\.requestJson\(/g)} host HTTP operations)`)
