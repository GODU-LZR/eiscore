// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_FLASH_BUILDER_DRAFT_SOURCE,
  buildFlashBuilderConfig,
  buildFlashDraftFromPublishedHtml,
  buildFlashSourceCodeWithDraft,
  indentFlashMultiline,
  normalizeFlashAppStatus,
  normalizeFlashConfig,
  normalizeFlashDraftSourceText,
  normalizeFlashSourceCode,
  resolveFlashDraftIsolation,
  stripFlashSourceMapMarkers
} from '../../eiscore-apps/src/domain/flash-builder-draft-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
assert.equal(DEFAULT_FLASH_BUILDER_DRAFT_SOURCE.includes('<template>'), true)
assert.equal(DEFAULT_FLASH_BUILDER_DRAFT_SOURCE.includes('闪念应用草稿画板'), true)
assert.deepEqual(normalizeFlashConfig('{"flash":{"mode":"legacy"}}'), { flash: { mode: 'legacy' } })
assert.deepEqual(normalizeFlashSourceCode({ flash: { draft: 1 } }), { flash: { draft: 1 } })
for (const value of [null, '', 'bad', '1', 'null']) assert.deepEqual(normalizeFlashConfig(value), {})
assert.equal(normalizeFlashDraftSourceText('  a\r\nb  '), 'a\nb')
assert.equal(normalizeFlashAppStatus(' Draft '), 'draft')
assert.equal(indentFlashMultiline('a\nb', 2), '  a\n  b')
assert.equal(stripFlashSourceMapMarkers('body\n//# sourceMappingURL=a.js.map\n/*# sourceMappingURL=b.css.map */'), 'body')

assert.equal(buildFlashDraftFromPublishedHtml('<body><h1>A</h1></body>', {
  extractBody: () => '<h1>A</h1>'
}), '<template>\n  <div class="flash-legacy-draft">\n    <h1>A</h1>\n  </div>\n</template>\n')
assert.equal(buildFlashDraftFromPublishedHtml('', { extractBody: () => '' }), '')

const source = { name: 'app', flash: { keep: true, mode: 'old' } }
assert.deepEqual(buildFlashSourceCodeWithDraft(source, '<template />', {
  draftFile: 'src/Draft.vue',
  mode: 'shell',
  updatedAt: '2026-09-01T00:00:00.000Z',
  extraFlash: { mode: 'override', extra: 1 }
}), {
  name: 'app',
  flash: {
    keep: true,
    mode: 'override',
    draft_file: 'src/Draft.vue',
    draft_source: '<template />',
    draft_updated_at: '2026-09-01T00:00:00.000Z',
    extra: 1
  }
})
assert.deepEqual(source, { name: 'app', flash: { keep: true, mode: 'old' } })

const isolationCases = [
  [{ source_code: { flash: { draft_source: ' saved ', published_draft_source: 'published' } } }, 'saved', 'restore_app_draft'],
  [{ source_code: { flash: { published_draft_source: ' published ' } } }, 'published', 'restore_published_draft'],
  [{ status: 'draft', source_code: { flash: { published_html: '<html />' } } }, 'legacy', 'restore_draft_seed'],
  [{ status: 'published', source_code: { flash: { published_html: '<html />' } } }, 'legacy', 'restore_legacy_published_snapshot'],
  [{ source_code: {} }, 'fallback', 'init_new_app_draft']
]
for (const [row, targetDraft, reason] of isolationCases) {
  const result = resolveFlashDraftIsolation(row, {
    defaultDraft: 'fallback',
    buildLegacyDraft: (html) => html ? 'legacy' : ''
  })
  assert.equal(result.targetDraft, targetDraft)
  assert.equal(result.reason, reason)
}
assert.equal(resolveFlashDraftIsolation(isolationCases[0][0], { defaultDraft: 'fallback' }).savedDraft, 'saved')

assert.deepEqual(buildFlashBuilderConfig({ keep: true, flash: { old: 1 } }, {
  codeServerEnabled: true,
  mode: 'code_server',
  shellMode: 'shell',
  draftRoot: 'src/views/drafts',
  draftFile: 'src/views/drafts/FlashDraft.vue',
  previewRoute: '/apps/preview/flash-draft',
  updatedAt: 'now'
}), {
  keep: true,
  flash: {
    old: 1,
    mode: 'code_server',
    draftRoot: 'src/views/drafts',
    draftFile: 'src/views/drafts/FlashDraft.vue',
    previewRoute: '/apps/preview/flash-draft',
    featureFlag: 'flash_builder_v2',
    updatedAt: 'now'
  }
})
assert.equal(buildFlashBuilderConfig({}, { codeServerEnabled: false, mode: 'code_server', shellMode: 'shell' }).flash.mode, 'shell')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/flash-builder-draft-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `FlashBuilder draft policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/FlashBuilder.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/flash-builder-draft-policy['"]/)
for (const removedDefinition of [
  'const DEFAULT_FLASH_DRAFT_SOURCE =',
  'const normalizeConfig =',
  'const normalizeSourceCode =',
  'const normalizeDraftSourceText =',
  'const normalizeAppStatus =',
  'const indentMultiline =',
  'const stripSourceMapMarkers ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `FlashBuilder reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'buildFlashDraftFromPublishedHtml(publishedHtml, { extractBody: extractPublishedBodyHtml })',
  'buildFlashSourceCodeWithDraft(baseSourceCode, draftSource, {',
  'resolveFlashDraftIsolation(row, {',
  'buildFlashBuilderConfig(baseConfig, {'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `FlashBuilder lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 4192)

console.log('PASS: FlashBuilder draft policy preserves defaults, source normalization, isolation priority and metadata composition')
