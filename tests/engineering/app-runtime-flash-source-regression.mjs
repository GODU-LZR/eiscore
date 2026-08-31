// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildFlashPublishedSrcdoc,
  extractFlashRuntimeDraftSource,
  normalizeDraftSourceText,
  parseJsonObject,
  sanitizeFlashPublishedHtml
} from '../../eiscore-apps/src/domain/app-runtime-flash-source.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')

const objectValue = { flash: {} }
assert.equal(parseJsonObject(objectValue), objectValue)
assert.deepEqual(parseJsonObject('{"flash":{"enabled":true}}'), { flash: { enabled: true } })
assert.deepEqual(parseJsonObject('[1,2]'), [1, 2])
for (const value of ['', null, undefined, 'null', 'true', 'bad json']) {
  assert.equal(parseJsonObject(value), null)
}

assert.equal(normalizeDraftSourceText('  line 1\r\nline 2\r\n  '), 'line 1\nline 2')
assert.equal(normalizeDraftSourceText(null), '')

const fallbackHtml = sanitizeFlashPublishedHtml(`
  <link rel="modulepreload" href="/entry.js">
  <link rel="preload" as="script" href="/chunk.js">
  <style>.ok { color: red }</style>
  <div class="ok">kept</div>
  <script>alert('removed')</script>
  <noscript>removed</noscript>
  //# sourceMappingURL=entry.js.map
  /*# sourceMappingURL=styles.css.map */
`)
assert.match(fallbackHtml, /<style>\.ok \{ color: red \}<\/style>/)
assert.match(fallbackHtml, /<div class="ok">kept<\/div>/)
for (const removed of ['modulepreload', 'preload', '<script', '<noscript', 'sourceMappingURL']) {
  assert.equal(fallbackHtml.includes(removed), false)
}
assert.equal(sanitizeFlashPublishedHtml(''), '')

const removedSelectors = []
const domHtml = sanitizeFlashPublishedHtml('<html><body>original</body></html>', {
  parseHtmlDocument: () => ({
    querySelectorAll: (selector) => [{ remove: () => removedSelectors.push(selector) }],
    documentElement: {
      outerHTML: '<html><head></head><body>parsed</body></html>\n//# sourceMappingURL=page.js.map'
    }
  })
})
assert.equal(domHtml, '<!doctype html>\n<html><head></head><body>parsed</body></html>')
assert.deepEqual(removedSelectors, [
  'script',
  'noscript',
  'link[rel="modulepreload"]',
  'link[rel="preload"][as="script"]'
])
assert.equal(sanitizeFlashPublishedHtml('<main>fallback</main>', {
  parseHtmlDocument: () => { throw new Error('parser failed') }
}), '<main>fallback</main>')

assert.equal(buildFlashPublishedSrcdoc(null), '')
assert.equal(buildFlashPublishedSrcdoc('{}'), '')
assert.equal(buildFlashPublishedSrcdoc('{"flash":{}}'), '')
const fragmentSrcdoc = buildFlashPublishedSrcdoc({ flash: { published_html: '<main>published</main>' } })
assert.equal(fragmentSrcdoc, '<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head><body><main>published</main></body></html>')
const fullSrcdoc = buildFlashPublishedSrcdoc({ flash: { published_html: '<HTML><body>full</body></HTML>' } })
assert.equal(fullSrcdoc, '<HTML><body>full</body></HTML>')

assert.equal(extractFlashRuntimeDraftSource({
  source_code: JSON.stringify({
    flash: {
      published_draft_source: ' published\r\nsource ',
      draft_source: 'draft fallback'
    }
  })
}), 'published\nsource')
assert.equal(extractFlashRuntimeDraftSource({
  source_code: { flash: { draft_source: ' draft only ' } }
}), 'draft only')
assert.equal(extractFlashRuntimeDraftSource({
  source_code: { flash: { published_draft_source: '   ', draft_source: 'not selected' } }
}), '')
assert.equal(extractFlashRuntimeDraftSource({ source_code: 'bad' }), '')
assert.equal(extractFlashRuntimeDraftSource(null), '')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/app-runtime-flash-source.mjs'), 'utf8')
for (const forbidden of ['from \'vue\'', 'vue-router', 'element-plus', 'axios', 'window.', 'document.', 'localStorage', 'DOMParser']) {
  assert.equal(moduleSource.includes(forbidden), false, `Flash source policy gained runtime dependency: ${forbidden}`)
}

const runtimeSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/AppRuntime.vue'), 'utf8')
assert.match(runtimeSource, /from ['"]@\/domain\/app-runtime-flash-source\.mjs['"]/)
for (const removedDefinition of [
  'const parseJsonObject =',
  'const sanitizeFlashPublishedHtml =',
  'const extractFlashRuntimeDraftSource =',
  'const normalizeDraftSourceText ='
]) {
  assert.equal(runtimeSource.includes(removedDefinition), false, `AppRuntime reintroduced ${removedDefinition}`)
}
assert.ok(runtimeSource.split(/\r?\n/).length <= 4118)

console.log('PASS: AppRuntime Flash source policy preserves JSON, sanitization, srcdoc and draft precedence')
