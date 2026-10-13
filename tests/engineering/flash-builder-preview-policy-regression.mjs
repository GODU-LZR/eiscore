// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildFlashPreviewStageStyle,
  buildFlashSourceSnapshotHtml,
  parseFlashPreviewRatio,
  sanitizeFlashPreviewSnapshotHtml
} from '../../eiscore-apps/src/domain/flash-builder-preview-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(parseFlashPreviewRatio('16', '9'), 16 / 9)
assert.equal(parseFlashPreviewRatio(' 1 ', ' 2 '), 0.5)
for (const values of [['', '9'], ['a', '1'], ['1', '0'], ['1', '-1'], ['0.39', '1'], ['4.01', '1']]) {
  assert.equal(parseFlashPreviewRatio(...values), null)
}
assert.deepEqual(buildFlashPreviewStageStyle(16 / 9), {
  width: `min(100%, calc((100dvh - 240px) * ${16 / 9}))`,
  maxWidth: '100%',
  margin: '0 auto',
  flex: 'none',
  aspectRatio: String(16 / 9),
  maxHeight: 'calc(100dvh - 240px)'
})
assert.equal(buildFlashPreviewStageStyle(null), null)
assert.deepEqual(buildFlashPreviewStageStyle(1), {
  width: 'min(100%, calc((100dvh - 240px) * 1))',
  maxWidth: '100%',
  margin: '0 auto',
  flex: 'none',
  aspectRatio: '1',
  maxHeight: 'calc(100dvh - 240px)'
})

const rawSnapshot = '<html><head><link rel="modulepreload" href="x"><link rel="preload" as="script" href="y"></head><body><script>x</script><noscript>n</noscript><p>keep</p></body></html>'
assert.equal(sanitizeFlashPreviewSnapshotHtml(rawSnapshot), '<html><head></head><body><p>keep</p></body></html>')
const removedSelectors = []
const parsedSnapshot = sanitizeFlashPreviewSnapshotHtml(rawSnapshot, {
  parseDocument: () => ({
    querySelectorAll: (selector) => [{ remove: () => removedSelectors.push(selector) }],
    documentElement: { outerHTML: '<html><body><p>parsed</p></body></html>' }
  })
})
assert.equal(parsedSnapshot, '<!doctype html>\n<html><body><p>parsed</p></body></html>')
assert.equal(removedSelectors.length, 4)
assert.equal(sanitizeFlashPreviewSnapshotHtml(rawSnapshot, { parseDocument: () => { throw new Error('bad DOM') } }), '<html><head></head><body><p>keep</p></body></html>')

assert.equal(buildFlashSourceSnapshotHtml(''), '')
const sourceSnapshot = buildFlashSourceSnapshotHtml(' <template><img onerror="x"></template> ', { title: '应用 A' })
assert.equal(sourceSnapshot.includes('<title>应用 A</title>'), true)
assert.equal(sourceSnapshot.includes('&lt;template&gt;&lt;img onerror=&quot;x&quot;&gt;&lt;/template&gt;'), true)
assert.equal(sourceSnapshot.includes('<template>'), false)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/flash-builder-preview-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date', 'new DOMParser']) {
  assert.equal(moduleSource.includes(forbidden), false, `FlashBuilder preview policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/FlashBuilder.vue'), 'utf8')
const previewSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/FlashDraftPreview.vue'), 'utf8')
assert.match(previewSource, /Number\(error\?\.status\) === 404/)
assert.match(previewSource, /else throw error/)
assert.match(pageSource, /from ['"]@\/domain\/flash-builder-preview-policy['"]/)
for (const removedDefinition of [
  'const isLikelyCodeServerHtml =',
  'const isLikelyEiscoreShellHtml ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `FlashBuilder reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'parseFlashPreviewRatio(',
  'buildFlashPreviewStageStyle(',
  'sanitizeFlashPreviewSnapshotHtml(String(previewIframeRef.value?.contentDocument?.documentElement?.outerHTML || \'\'), {',
  "buildFlashSourceSnapshotHtml(draft, { title: appData.value.name || '闪念应用' })"
]) {
  assert.equal(pageSource.includes(requiredUse), true, `FlashBuilder lost ${requiredUse}`)
}
assert.equal(pageSource.includes('escapeHtml(source)'), false)
assert.ok(pageSource.split(/\r?\n/).length <= 3741)

console.log('PASS: FlashBuilder preview policy preserves ratios, snapshot cleanup and source fallback')
