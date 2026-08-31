// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildAiImportPayload,
  generateAiImportCode,
  getAiImportDefaultMap,
  getAiImportGeneratedFields,
  getAiImportRequiredFields,
  hasAiImportValue,
  isAiImportBlankValue,
  isAiMaterialsImportContext,
  normalizeAiImportRow,
  prepareAiGenericImportRows,
  shouldAiImportAttachCurrentUser
} from '../../eiscore-base/src/domain/ai-copilot-import-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
for (const value of [undefined, null, '', '   ']) assert.equal(isAiImportBlankValue(value), true)
for (const value of [0, false, [], {}, '0']) assert.equal(isAiImportBlankValue(value), false)
assert.equal(hasAiImportValue([]), false)
assert.equal(hasAiImportValue([null, { a: '' }, 0]), true)
assert.equal(hasAiImportValue({ a: '', nested: { value: null } }), false)
assert.equal(hasAiImportValue({ a: false }), true)

assert.equal(isAiMaterialsImportContext({ app: 'MATERIALS' }, {}), true)
assert.equal(isAiMaterialsImportContext({}, { apiUrl: '/api/raw_materials' }), true)
assert.equal(isAiMaterialsImportContext({ apiUrl: '/sales_orders' }), false)
assert.equal(shouldAiImportAttachCurrentUser({ columns: [{ prop: 'created_by' }] }), true)
assert.equal(shouldAiImportAttachCurrentUser({ staticColumns: [{ prop: 'name' }] }), false)

const context = {
  columns: [{ label: '名称', prop: 'name' }, { label: '状态', prop: 'status' }],
  staticColumns: [{ prop: 'name' }, { prop: 'status' }, { prop: 'created_by' }, { prop: 'property_static' }],
  propertyFields: ['property_static'],
  importDefaults: { status: 'draft', owner: 'context' },
  importRequiredFields: ['name', 'name', 'code'],
  importGeneratedFields: [{ prop: 'code', prefix: 'AI-' }, { prefix: 'bad' }]
}
const target = {
  defaults: { status: 'active', targetOnly: true },
  requiredFields: ['status'],
  generatedFields: [{ prop: 'serial', prefix: 'S-' }]
}
assert.deepEqual(getAiImportDefaultMap(context, target), { status: 'active', owner: 'context', targetOnly: true })
assert.deepEqual(getAiImportRequiredFields(context, target), ['name', 'code', 'status'])
assert.deepEqual(getAiImportGeneratedFields(context, target), [
  { prop: 'code', prefix: 'AI-' },
  { prop: 'serial', prefix: 'S-' }
])

assert.equal(generateAiImportCode('AI-', 2, new Date(2026, 8, 1, 2, 3, 4, 5)), 'AI-20260901020304005-0003')
assert.equal(generateAiImportCode('', 0, new Date(2026, 0, 2, 0, 0, 0, 0)), 'NO-20260102000000000-0001')

assert.deepEqual(normalizeAiImportRow({ 名称: '标签值', name: '直值', 状态: 'active', properties: { extra: 1 } }, context), {
  name: '直值', status: 'active', properties: { extra: 1 }
})
assert.deepEqual(normalizeAiImportRow({ name: '直值', 名称: '标签值' }, context), { name: '直值' })

const generated = []
const prepared = prepareAiGenericImportRows([
  { 名称: 'A' },
  { 名称: '' },
  { 状态: 'active' },
  { name: 'B', code: 'MANUAL', serial: 'S-MANUAL' }
], context, target, {
  generateCode: (prefix, index) => {
    generated.push([prefix, index])
    return `${prefix}${index + 1}`
  }
})
assert.deepEqual(prepared, {
  rows: [
    { status: 'active', owner: 'context', targetOnly: true, name: 'A', code: 'AI-1', serial: 'S-1' },
    { status: 'active', owner: 'context', targetOnly: true, name: 'B', code: 'MANUAL', serial: 'S-MANUAL' }
  ],
  skipped: 2
})
assert.deepEqual(generated, [['AI-', 0], ['S-', 0], ['AI-', 1], ['S-', 1]])

assert.deepEqual(buildAiImportPayload([
  {
    名称: 'A',
    状态: 'active',
    property_static: 'nested',
    extra: 0,
    blank: '',
    properties: { fromProperties: false, ignored: '' }
  },
  null,
  { blank: '' }
], context, { currentUser: 'operator' }), [{
  name: 'A',
  status: 'active',
  created_by: 'operator',
  properties: { property_static: 'nested', extra: 0, fromProperties: false }
}])
assert.deepEqual(buildAiImportPayload([{ name: 'A' }], { staticColumns: [{ prop: 'name' }] }), [{ name: 'A' }])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/ai-copilot-import-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now']) {
  assert.equal(moduleSource.includes(forbidden), false, `AI Copilot import policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ai-copilot-import-policy['"]/)
for (const removedDefinition of [
  'const isImportBlankValue =',
  'const hasImportValue =',
  'const isMaterialsImportContext = (context, target) =>',
  'const shouldAttachCurrentUser = (context) =>',
  'const getImportDefaultMap =',
  'const getImportRequiredFields =',
  'const getImportGeneratedFields =',
  'const normalizeImportRow ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `AiCopilot reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'generateAiImportCode(prefix, index, new Date())',
  'prepareAiGenericImportRows(',
  'buildAiImportPayload(rows, context, { currentUser })'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `AiCopilot lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3966)

console.log('PASS: AiCopilot import policy preserves blank values, contexts, defaults, generated fields, normalized rows and payloads')
