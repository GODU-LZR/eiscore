// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildAiTemplateRecord,
  getAiTemplateRecordScope,
  getAiTemplateSectionCount,
  getAiTemplateTableCount,
  isAiSameTemplateScope,
  mergeAiTemplateRecord,
  resolveAiTemplateLibraryKey,
  resolveAiTemplateScope
} from '../../eiscore-base/src/domain/ai-copilot-template-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const schema = {
  docType: 'inspection',
  title: '巡检模板',
  scope: { app: 'legacy', keep: true },
  layout: [{ type: 'section' }, { type: 'table' }, { type: 'section' }, { type: 'field' }]
}
const context = {
  formTemplateKey: 'plant_templates',
  formTemplateScope: { app: 'quality', key: 2 }
}

assert.equal(getAiTemplateSectionCount(schema), 2)
assert.equal(getAiTemplateTableCount(schema), 1)
assert.equal(getAiTemplateSectionCount({}), 0)
assert.equal(resolveAiTemplateLibraryKey(context), 'plant_templates')
assert.equal(resolveAiTemplateLibraryKey({ templateLibraryKey: 'primary', formTemplateKey: 'fallback' }), 'primary')
for (const invalid of [null, {}, { templateLibraryKey: 2 }, { templateLibraryKey: '' }]) {
  assert.equal(resolveAiTemplateLibraryKey(invalid), 'form_templates')
}
assert.deepEqual(resolveAiTemplateScope(context), { app: 'quality', key: 2 })
assert.deepEqual(resolveAiTemplateScope({ templateScope: { app: 'sales' }, formTemplateScope: { app: 'quality' } }), { app: 'sales' })
assert.deepEqual(resolveAiTemplateScope({ templateScope: 'bad' }), {})

const record = buildAiTemplateRecord(schema, context, {
  nowIso: '2026-09-01T00:00:00.000Z',
  nowMs: 1788220800000
})
assert.deepEqual(record, {
  id: 'inspection',
  name: '巡检模板',
  schema: {
    ...schema,
    scope: { app: 'quality', keep: true, key: 2, templateLibraryKey: 'plant_templates' }
  },
  scope: { app: 'quality', key: 2, templateLibraryKey: 'plant_templates' },
  source: 'ai',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z'
})
assert.equal(buildAiTemplateRecord({}, {}, { nowIso: 'now', nowMs: 7 }).id, 'tpl_7')
assert.equal(buildAiTemplateRecord({}, {}, { nowIso: 'now', nowMs: 7 }).name, 'AI生成模板')

assert.deepEqual(getAiTemplateRecordScope({ schema: { scope: { app: 'nested' } } }), { app: 'nested' })
assert.deepEqual(getAiTemplateRecordScope({ scope: { app: 'top' }, schema: { scope: { app: 'nested' } } }), { app: 'top' })
assert.deepEqual(getAiTemplateRecordScope(null), {})
assert.equal(isAiSameTemplateScope({ app: 'quality', key: 2 }, { app: 'quality', key: '2' }), true)
assert.equal(isAiSameTemplateScope({ app: 'quality', extra: 1 }, { app: 'quality', extra: 2 }), true)
assert.equal(isAiSameTemplateScope({ appId: 1 }, { appId: 2 }), false)

const otherScope = { ...record, scope: { ...record.scope, app: 'sales' } }
const existing = { ...record, name: '旧名', created_at: 'old', updated_at: 'old' }
const source = [otherScope, existing]
const merged = mergeAiTemplateRecord(source, { ...record, name: '新名' }, { updatedAt: 'updated' })
assert.equal(merged.length, 2)
assert.equal(merged[0], otherScope)
assert.deepEqual(merged[1], { ...record, name: '新名', updated_at: 'updated' })
assert.equal(source[1], existing)
assert.deepEqual(mergeAiTemplateRecord([otherScope], record, { updatedAt: 'updated' }), [record, otherScope])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/ai-copilot-template-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `AI Copilot template policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ai-copilot-template-policy['"]/)
for (const removedDefinition of [
  'const getTemplateSectionCount =',
  'const getTemplateTableCount =',
  'const getCurrentTemplateScope =',
  'const getTemplateRecordScope =',
  'const isSameTemplateScope ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `AiCopilot reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'resolveAiTemplateLibraryKey(state.currentContext)',
  'buildAiTemplateRecord(schema, state.currentContext, { nowIso: now, nowMs: Date.now() })',
  'mergeAiTemplateRecord(templates, record, { updatedAt: new Date().toISOString() })'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `AiCopilot lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3768)

console.log('PASS: AiCopilot template policy preserves counts, keys, scopes, records and scope-aware replacement')
