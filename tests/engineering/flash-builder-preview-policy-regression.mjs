// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildFlashPreviewStageStyle,
  buildFlashSourceSnapshotHtml,
  isLikelyFlashCodeServerHtml,
  isLikelyFlashEiscoreShellHtml,
  parseFlashPreviewRatio,
  resolveFlashPreviewGlassText,
  sanitizeFlashPreviewSnapshotHtml
} from '../../eiscore-apps/src/domain/flash-builder-preview-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

for (const marker of ['code-server', 'VSCode', 'Monaco', 'workbench']) {
  assert.equal(isLikelyFlashCodeServerHtml(`<html>${marker}</html>`), true)
}
assert.equal(isLikelyFlashCodeServerHtml('x'.repeat(12000) + 'monaco'), false)
for (const marker of ['<title>EISCore', 'eiscore-client-assets', '/mobile/index.html', '/asset-manifest.json']) {
  assert.equal(isLikelyFlashEiscoreShellHtml(`<html>${marker}</html>`), true)
}
assert.equal(isLikelyFlashEiscoreShellHtml('<title>other</title>'), false)

assert.equal(resolveFlashPreviewGlassText({ shellBusy: true }), 'AI 正在加工界面...')
assert.equal(resolveFlashPreviewGlassText({ shellBusy: true, hasFirstChunk: true }), 'AI 正在完善细节...')
assert.equal(resolveFlashPreviewGlassText({ previewFatal: true, maskText: 'custom' }), '预览恢复中，请稍候...')
assert.equal(resolveFlashPreviewGlassText({ maskText: 'custom' }), 'custom')
assert.equal(resolveFlashPreviewGlassText(), '正在加载预览...')

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
assert.equal(buildFlashPreviewStageStyle(1, { codeServerMode: true }), null)

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
assert.match(pageSource, /from ['"]@\/domain\/flash-builder-preview-policy['"]/)
for (const removedDefinition of [
  'const isLikelyCodeServerHtml =',
  'const isLikelyEiscoreShellHtml ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `FlashBuilder reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'resolveFlashPreviewGlassText({',
  'parseFlashPreviewRatio(',
  'buildFlashPreviewStageStyle(',
  'sanitizeFlashPreviewSnapshotHtml(rawHtml, {',
  'buildFlashSourceSnapshotHtml(draftSource, {'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `FlashBuilder lost ${requiredUse}`)
}
assert.equal(pageSource.includes('escapeHtml(source)'), false)
assert.ok(pageSource.split(/\r?\n/).length <= 3741)

console.log('PASS: FlashBuilder preview policy preserves IDE probes, glass text, ratios, snapshot cleanup and source fallback')
