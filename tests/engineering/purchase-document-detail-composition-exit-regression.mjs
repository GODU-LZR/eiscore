// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-purchase/src/views/PurchaseDocumentDetail.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)
const lineCount = lines.at(-1) === '' ? lines.length - 1 : lines.length

assert.ok(lineCount <= 1916, `PurchaseDocumentDetail grew beyond its 1916-line exit baseline: ${lineCount}`)

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
assert.ok(templateEnd - templateStart + 1 <= 227)
assert.ok(scriptEnd - scriptStart + 1 <= 1457)
assert.ok(styleEnd - styleStart + 1 <= 230)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/purchase-document-detail-[^'"]+-policy\.js)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/purchase-document-detail-action-policy.js',
  '@/domain/purchase-document-detail-arrival-link-policy.js',
  '@/domain/purchase-document-detail-business-flow-policy.js',
  '@/domain/purchase-document-detail-field-policy.js',
  '@/domain/purchase-document-detail-form-policy.js',
  '@/domain/purchase-document-detail-order-policy.js',
  '@/domain/purchase-document-detail-quantity-policy.js',
  '@/domain/purchase-document-detail-schema-policy.js',
  '@/domain/purchase-document-detail-status-policy.js',
  '@/domain/purchase-document-detail-template-edit-policy.js',
  '@/domain/purchase-document-detail-template-policy.js'
])

const policyFiles = policyImports.map((specifier) => resolve(
  repoRoot,
  'eiscore-purchase/src',
  specifier.replace('@/', '')
))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of [
    "from 'vue'",
    "from 'element-plus'",
    'request({',
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

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/\brequest\s*\(\{/g) <= 28, 'PurchaseDocumentDetail added Request orchestration')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 60, 'PurchaseDocumentDetail added message orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 4, 'PurchaseDocumentDetail added Router orchestration')
assert.ok(count(/\bwatch\(/g) <= 4, 'PurchaseDocumentDetail added reactive watcher orchestration')
assert.ok(count(/\bpushAi(?:Context|Command)\(/g) <= 2, 'PurchaseDocumentDetail added AI bridge orchestration')
assert.ok(count(/\btryCreateDocumentLink\(/g) <= 4, 'PurchaseDocumentDetail added document link orchestration')
assert.ok(count(/\btryCreateDocumentAudit\(/g) <= 1, 'PurchaseDocumentDetail added document audit orchestration')
assert.ok(count(/\bcreateDocumentLinkPayload\(/g) <= 4, 'PurchaseDocumentDetail added document link payload orchestration')
assert.equal(count(/\bonMounted\(/g), 1)
assert.equal(count(/\bonUnmounted\(/g), 1)
assert.equal(count(/window\.addEventListener\(/g), 1)
assert.equal(count(/window\.removeEventListener\(/g), 1)
assert.ok(count(/\bsetTimeout\(/g) <= 1, 'PurchaseDocumentDetail added timer orchestration')
assert.equal(count(/\bsetInterval\(/g), 0)
assert.ok(count(/window\.open\(/g) <= 1, 'PurchaseDocumentDetail added popup orchestration')
assert.ok(count(/\.document\.write\(/g) <= 1, 'PurchaseDocumentDetail added document write orchestration')

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 51, `PurchaseDocumentDetail callable inventory grew: ${callableDefinitions.length}`)

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
  assert.equal(forbidden.test(source), false, `PurchaseDocumentDetail reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  'request({',
  'pushAiContext(buildDocumentAgentContext({',
  'pushAiCommand({',
  'tryCreateDocumentAudit(buildPurchaseDocumentFlowAuditPayload(params))',
  'tryCreateDocumentLink(createDocumentLinkPayload({',
  "router.push('/app/orders')",
  "router.push('/app/arrivals')",
  "window.addEventListener('eis-form-templates-updated'",
  "window.removeEventListener('eis-form-templates-updated'",
  "window.open('', '_blank')",
  'onMounted(() => {',
  'onUnmounted(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, `PurchaseDocumentDetail lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: PurchaseDocumentDetail composition exit gate (${lineCount} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/\brequest\s*\(\{/g)} Request operations)`)
