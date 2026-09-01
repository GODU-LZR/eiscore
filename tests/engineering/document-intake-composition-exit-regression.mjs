// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-base/src/views/DocumentIntakeCenter.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)

assert.ok(lines.length <= 1973, `DocumentIntakeCenter grew beyond its 1973-line exit baseline: ${lines.length}`)

const markerLine = (marker) => lines.findIndex((line) => line === marker)
const templateStart = markerLine('<template>')
const templateEnd = markerLine('</template>')
const scriptStart = markerLine('<script setup>')
const scriptEnd = markerLine('</script>')
const styleStart = markerLine('<style scoped>')
const styleEnd = markerLine('</style>')
assert.equal(templateStart, 5)
assert.ok(templateStart < templateEnd)
assert.ok(templateEnd < scriptStart && scriptStart < scriptEnd)
assert.ok(scriptEnd < styleStart && styleStart < styleEnd)
assert.ok(templateEnd - templateStart + 1 <= 1058)
assert.ok(scriptEnd - scriptStart + 1 <= 647)
assert.ok(styleEnd - styleStart + 1 <= 260)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/document-intake-[^'"]+-policy\.js)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/document-intake-device-operation-policy.js',
  '@/domain/document-intake-entry-result-detail-policy.js',
  '@/domain/document-intake-filter-policy.js',
  '@/domain/document-intake-list-query-policy.js',
  '@/domain/document-intake-presentation-policy.js',
  '@/domain/document-intake-watch-folder-policy.js'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-base/src',
  specifier.replace('@/', '')
))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of [
    "from 'vue'",
    "from 'element-plus'",
    'axios',
    'fetch(',
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
assert.equal(policyExports, 54)

const networkFunctions = [
  'fetchDocumentIntakeOverview',
  'fetchDocumentIntakeAssets',
  'fetchDocumentIntakeDevices',
  'fetchDocumentIntakeLogs',
  'fetchDocumentIntakeEntryResults',
  'fetchDocumentIntakeEntryResultDetail',
  'updateDocumentIntakeDeviceStatus',
  'resetDocumentIntakeDeviceBindingCode',
  'fetchDocumentIntakeDeviceWatchFolders',
  'updateDocumentIntakeWatchFolder',
  'createDocumentIntakeDeviceWatchFolder',
  'updateDocumentIntakeWatchFolderStatus',
  'deleteDocumentIntakeWatchFolder'
]
const count = (pattern) => (source.match(pattern) || []).length
const networkOperations = networkFunctions.reduce((sum, name) => (
  sum + count(new RegExp(`\\b${name}\\s*\\(`, 'g'))
), 0)
assert.ok(networkOperations <= 13, `DocumentIntakeCenter added document intake API orchestration: ${networkOperations}`)
assert.ok(count(/ElMessage(?:Box)?\./g) <= 22, 'DocumentIntakeCenter added message orchestration')
assert.ok(count(/\bwatch\(/g) <= 10, 'DocumentIntakeCenter added reactive watcher orchestration')
assert.ok(count(/navigateEnterprisePath\(/g) <= 1, 'DocumentIntakeCenter added platform navigation orchestration')
assert.ok(count(/navigator\.clipboard/g) <= 2, 'DocumentIntakeCenter added Clipboard API orchestration')
assert.ok(count(/document\.execCommand\(/g) <= 1, 'DocumentIntakeCenter added legacy Clipboard fallback')
assert.equal(count(/\bonMounted\(/g), 1)
assert.equal(count(/\bonUnmounted\(/g), 0)
assert.equal(count(/\bsetTimeout\(/g), 0)
assert.equal(count(/\bsetInterval\(/g), 0)
assert.equal(count(/\.addEventListener\(/g), 0)

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 53, `DocumentIntakeCenter callable inventory grew: ${callableDefinitions.length}`)

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
  assert.equal(forbidden.test(source), false, `DocumentIntakeCenter reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  'fetchDocumentIntakeAssets(buildDocumentIntakeAssetQuery(',
  'fetchDocumentIntakeEntryResultDetail(id)',
  'updateDocumentIntakeDeviceStatus(plan.deviceId, plan.nextStatus)',
  'createDocumentIntakeDeviceWatchFolder(deviceId, plan.payload)',
  "navigateEnterprisePath(url, { tabTitle: '业务记录' })",
  'navigator.clipboard?.writeText',
  "document.execCommand('copy')",
  'onMounted(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, `DocumentIntakeCenter lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: DocumentIntakeCenter composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${networkOperations} document intake API operations)`)
