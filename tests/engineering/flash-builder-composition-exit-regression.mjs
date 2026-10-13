// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-apps/src/views/FlashBuilder.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)

for (const forbidden of [
  'codeServerEnabled',
  'isCodeServerMode',
  'VITE_FLASH_CODE_SERVER_ENABLED',
  'VITE_FLASH_IDE_URL',
  '专业模式',
  'Code-Server',
  'ideIframe',
  'reloadIdeEmbed'
]) {
  assert.equal(source.includes(forbidden), false, `FlashBuilder retained removed IDE contract: ${forbidden}`)
}

assert.ok(lines.length <= 3741, `FlashBuilder grew beyond its 3741-line exit baseline: ${lines.length}`)

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
assert.ok(templateEnd - templateStart + 1 <= 366)
assert.ok(scriptEnd - scriptStart + 1 <= 2057)
assert.ok(styleEnd - styleStart + 1 <= 1315)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/flash-builder-[^'"]+-policy)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/flash-builder-draft-policy',
  '@/domain/flash-builder-preview-policy'
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
    'element-plus',
    'axios',
    'window.',
    'document.',
    'localStorage',
    'sessionStorage',
    'Date.now',
    'new Date',
    'new WebSocket',
    'fetch('
  ]) {
    assert.equal(policySource.includes(forbidden), false, `${file} gained runtime dependency: ${forbidden}`)
  }
}
assert.equal(policyExports, 16)

const count = (pattern) => (source.match(pattern) || []).length
assert.ok(count(/axios\./g) <= 1, 'FlashBuilder added direct Agent HTTP orchestration')
assert.equal(count(/\bfetch\s*\(/g), 0, 'FlashBuilder retained an IDE probe request')
assert.equal(count(/new\s+WebSocket\s*\(/g), 0, 'FlashBuilder retained a WebSocket transport')
assert.ok(count(/callFlashTool\(/g) <= 18, 'FlashBuilder added Flash tool orchestration')
assert.ok(count(/ElMessage(?:Box)?\./g) <= 6, 'FlashBuilder added message/confirmation orchestration')
assert.ok(count(/router\.(?:push|replace)\(/g) <= 2, 'FlashBuilder added Router orchestration')
assert.ok(count(/\bwatch\(/g) <= 4, 'FlashBuilder added reactive watcher orchestration')
assert.ok(count(/\bsetTimeout\(/g) <= 14, 'FlashBuilder added timer orchestration')
assert.ok(count(/\bsetInterval\(/g) <= 1, 'FlashBuilder added interval orchestration')
assert.equal(count(/\bonMounted\(/g), 1)
assert.equal(count(/\bonUnmounted\(/g), 1)

const callableDefinitions = [...source.matchAll(
  /^(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\n]*?\)\s*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\()/gm
)]
assert.ok(callableDefinitions.length <= 110, `FlashBuilder callable inventory grew: ${callableDefinitions.length}`)

for (const forbidden of [
  /(?:local|session)Storage/,
  /new\s+EventSource\s*\(/,
  /new\s+XMLHttpRequest\s*\(/,
  /window\.location(?:\.href)?\s*=/,
  /window\.location\.(?:assign|replace)\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `FlashBuilder reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of [
  "axios.post('/flash/tools/call'",
  "harnessFrameUrl = '/harness-flash-embed/#flash-builder'",
  'prepareHarnessAuth({',
  "type: 'flash:context'",
  "data.type === 'flash:harness:ready'",
  'isTrustedFlashHarnessMessage(event, {',
  'isFlashHarnessChangeMessage(data)',
  'getFlashHarnessEventKey(data)',
  "await syncDraft(); refreshPreview('正在呈现最新草稿...')",
  'sanitizeFlashPreviewSnapshotHtml(String(previewIframeRef.value?.contentDocument?.documentElement?.outerHTML || \'\'), {',
  "callFlashTool('flash.app.publish'",
  'router.push(`/app/${appId.value}`)',
  'onUnmounted(() => {'
]) {
  assert.equal(source.includes(retainedBoundary), true, `FlashBuilder lost retained composition boundary: ${retainedBoundary}`)
}

for (const removedBoundary of [
  'new WebSocket(',
  'loadFlashConversations(',
  'saveFlashConversations(',
  'shellConversations',
  'attachment',
  '附件',
  'localStorage',
  'sessionStorage'
]) {
  assert.equal(source.toLowerCase().includes(removedBoundary.toLowerCase()), false, `FlashBuilder retained removed local UI boundary: ${removedBoundary}`)
}

console.log(`PASS: FlashBuilder composition exit gate (${lines.length} lines, ${policyImports.length} policy modules, ${policyExports} policy exports, ${count(/callFlashTool\(/g)} Flash tool operations)`)
