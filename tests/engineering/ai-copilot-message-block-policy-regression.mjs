// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AI_BPMN_BLOCKS,
  AI_IMPORT_BLOCKS,
  AI_MATERIAL_CATEGORY_BLOCKS,
  AI_SMART_BI_ACTION_BLOCKS,
  AI_WORKFLOW_META_BLOCKS,
  buildAiImportPreview,
  extractAiBpmnXml,
  extractAiCategoryData,
  extractAiFormTemplate,
  extractAiFormula,
  extractAiImportData,
  extractAiWorkflowMeta,
  getAiWorkflowInfo,
  normalizeAiCategoryTree
} from '../../eiscore-base/src/domain/ai-copilot-message-block-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const sanitizeJson = (value) => value
  .replace(/,\s*([\]}])/g, '$1')
  .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')

assert.deepEqual(AI_IMPORT_BLOCKS, ['data-import', 'data_import', 'grid-import', 'grid_import'])
assert.equal(AI_BPMN_BLOCKS.includes('workflow_bpmn'), true)
assert.equal(AI_WORKFLOW_META_BLOCKS.includes('workflow_meta'), true)
assert.equal(AI_SMART_BI_ACTION_BLOCKS.includes('bi_actions'), true)
assert.equal(AI_MATERIAL_CATEGORY_BLOCKS.includes('material_categories'), true)

assert.deepEqual(extractAiFormTemplate('```form_schema\n{title:"巡检",layout:[],}\n```', { sanitizeJson }), {
  schema: { title: '巡检', layout: [] }, error: null
})
assert.deepEqual(extractAiFormTemplate('```form-template\n{"title":"缺布局"}\n```'), { schema: null, error: 'invalid' })
assert.deepEqual(extractAiFormTemplate('```form-template\n{bad}\n```'), { schema: null, error: 'parse' })
assert.deepEqual(extractAiFormTemplate('普通消息'), { schema: null, error: null })

assert.deepEqual(extractAiFormula('```formula\nSUM(A1:A3)\n```'), { formula: 'SUM(A1:A3)', error: null })
assert.deepEqual(extractAiFormula('```formula\n   \n```'), { formula: null, error: 'empty' })
assert.deepEqual(extractAiFormula(''), { formula: null, error: null })

assert.deepEqual(extractAiImportData('```grid_import\n{rows:[{name:"A"}],}\n```', { sanitizeJson }), {
  rows: [{ name: 'A' }], error: null
})
assert.deepEqual(extractAiImportData('```data-import\n[{"id":1}]\n```'), { rows: [{ id: 1 }], error: null })
assert.deepEqual(extractAiImportData('```data_import\n{"other":[]}\n```'), { rows: null, error: 'invalid' })
assert.deepEqual(extractAiImportData('```data_import\n{bad}\n```'), { rows: null, error: 'parse' })

assert.deepEqual(extractAiBpmnXml('```workflow_bpmn\n<definitions />\n```'), { xml: '<definitions />', error: null })
assert.deepEqual(extractAiBpmnXml('```bpmn-xml\n \n```'), { xml: null, error: 'empty' })
assert.deepEqual(extractAiWorkflowMeta('```workflow_meta\n{name:"审批",}\n```', { sanitizeJson }), {
  meta: { name: '审批' }, error: null
})
assert.deepEqual(getAiWorkflowInfo('```bpmn_xml\n<xml />\n```\n```workflow-meta\n{"id":2}\n```'), {
  xml: '<xml />', meta: { id: 2 }, error: null
})

assert.deepEqual(normalizeAiCategoryTree([
  { code: 'A', name: '原料', items: ['钢材', { label: '', children: [{ id: 'X', label: '子类' }] }] },
  '辅料'
]), [
  { id: 'A', label: '原料', children: [
    { id: 'A.01', label: '钢材', children: undefined },
    { id: 'A.02', label: '分类2', children: [{ id: 'X', label: '子类', children: undefined }] }
  ] },
  { id: '02', label: '辅料', children: undefined }
])
assert.deepEqual(extractAiCategoryData('```materials_categories\n{categories:[{name:"金属"}],}\n```', undefined, { sanitizeJson }), {
  data: [{ id: '01', label: '金属', children: undefined }], error: null
})
assert.deepEqual(extractAiCategoryData('```material-categories\n{"value":1}\n```'), { data: null, error: 'invalid' })

const previewRows = Array.from({ length: 10 }, (_, index) => ({ extra: index, name: `N${index}` }))
assert.deepEqual(buildAiImportPreview({ rows: previewRows }, [{ prop: 'name', label: '名称' }]), {
  columns: [{ prop: 'name', label: '名称' }, { prop: 'extra', label: 'extra' }],
  rows: previewRows.slice(0, 8)
})
assert.deepEqual(buildAiImportPreview({}, null), { columns: [], rows: [] })

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/ai-copilot-message-block-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now']) {
  assert.equal(moduleSource.includes(forbidden), false, `AI Copilot message block policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ai-copilot-message-block-policy['"]/)
for (const removedDefinition of [
  'const FORM_TEMPLATE_BLOCKS =',
  'const FORMULA_BLOCKS =',
  'const IMPORT_BLOCKS =',
  'const BPMN_BLOCKS =',
  'const WORKFLOW_META_BLOCKS =',
  'const SMART_BI_ACTION_BLOCKS =',
  'const MATERIAL_CATEGORY_BLOCKS =',
  'const extractFormTemplate =',
  'const extractFormula =',
  'const extractImportData =',
  'const extractBpmnXml =',
  'const extractWorkflowMeta =',
  'const normalizeCategoryTree =',
  'const extractCategoryData ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `AiCopilot reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  "extractAiFormTemplate(msg?.content || '', { sanitizeJson })",
  "getAiWorkflowInfo(msg?.content || '', { sanitizeJson })",
  "extractAiImportData(msg?.content || '', { sanitizeJson })",
  'extractAiCategoryData(',
  'buildAiImportPreview(info, state.currentContext?.columns)'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `AiCopilot lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3818)

console.log('PASS: AiCopilot message block policy preserves fenced schemas, formulas, imports, workflows, categories and previews')
