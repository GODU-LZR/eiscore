// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  appendProductionCascaderChild,
  buildEmptyProductionColumnEditorDraft,
  buildProductionAvailableColumns,
  buildProductionColumnConfig,
  buildProductionColumnEditorDraft,
  buildProductionFormulaPrompt,
  getProductionCascaderChildren,
  removeProductionCascaderChild,
  resolveProductionColumnEditorTab,
  toggleProductionStaticColumn
} from '../../eiscore-production/src/domain/production-grid-column-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

const staticColumns = [{ prop: 'id', label: 'ID' }, { prop: 'status', label: '状态' }]
const extraColumns = [{ prop: 'field_1', label: '自定义列' }, { prop: 'field_2', label: '计算列' }]
assert.deepEqual(buildProductionAvailableColumns({ staticColumns, extraColumns }), [...staticColumns, ...extraColumns])
assert.deepEqual(buildProductionAvailableColumns({
  staticColumns,
  extraColumns,
  isEditing: true,
  editingIndex: 1
}), [...staticColumns, extraColumns[0]])

assert.equal(buildProductionFormulaPrompt({ label: '差额', columns: staticColumns }), [
  '请帮我生成生产模块表格“自动计算”公式。',
  '目标列：差额',
  '要求：只输出公式，不要解释。',
  '必须放在 ```formula``` 代码块中，内容示例：{需求数量}-{已领数量}。',
  '可用字段：ID、状态。'
].join('\n'))
assert.match(buildProductionFormulaPrompt(), /目标列：计算列[\s\S]*可用字段：无。/)

assert.equal(resolveProductionColumnEditorTab('formula'), 'formula')
assert.equal(resolveProductionColumnEditorTab('dropdown'), 'select')
assert.equal(resolveProductionColumnEditorTab('cascader'), 'cascader')
assert.equal(resolveProductionColumnEditorTab('geo'), 'geo')
assert.equal(resolveProductionColumnEditorTab('file'), 'file')
assert.equal(resolveProductionColumnEditorTab('unknown'), 'text')

assert.deepEqual(buildProductionColumnEditorDraft({
  label: '区域',
  prop: 'region',
  type: 'cascader',
  options: [{ label: '华东', value: 'east' }, { value: 'south' }],
  dependsOn: 'country',
  cascaderOptions: { CN: ['上海', { label: '苏州' }] },
  geoAddress: false,
  fileMaxSizeMb: 5,
  fileMaxCount: 2,
  fileAccept: '.pdf'
}), {
  label: '区域',
  prop: 'region',
  expression: '',
  options: [{ label: '华东' }, { label: 'south' }],
  dependsOn: 'country',
  cascaderMap: { CN: ['上海', '苏州'] },
  geoAddress: false,
  fileMaxSizeMb: 5,
  fileMaxCount: 2,
  fileAccept: '.pdf'
})
assert.deepEqual(buildEmptyProductionColumnEditorDraft(), {
  label: '',
  prop: '',
  expression: '',
  options: [],
  dependsOn: '',
  cascaderMap: {},
  geoAddress: true,
  fileMaxSizeMb: 20,
  fileMaxCount: 3,
  fileAccept: ''
})

assert.deepEqual(getProductionCascaderChildren({ A: ['A1'] }, 'A'), ['A1'])
assert.deepEqual(getProductionCascaderChildren({ A: 'bad' }, 'A'), [])
assert.deepEqual(appendProductionCascaderChild(['A1'], ' A2 '), { changed: true, list: ['A1', 'A2'] })
assert.deepEqual(appendProductionCascaderChild(['A1'], 'A1'), { changed: true, list: ['A1'] })
assert.deepEqual(appendProductionCascaderChild(['A1'], '  '), { changed: false, list: ['A1'] })
assert.deepEqual(removeProductionCascaderChild(['A1', 'A2', 'A1'], 'A1'), ['A2'])

assert.deepEqual(toggleProductionStaticColumn(['status'], 'status', true), [])
assert.deepEqual(toggleProductionStaticColumn([], 'status', false), ['status'])
const hidden = ['status']
assert.equal(toggleProductionStaticColumn(hidden, 'status', false), hidden)

assert.deepEqual(buildProductionColumnConfig({
  draft: { label: '说明', expression: '{数量}*2' },
  type: 'formula',
  isEditing: false,
  generatedProp: 'field_1234'
}), {
  ok: true,
  column: { label: '说明', prop: 'field_1234', type: 'formula', expression: '{数量}*2' }
})
assert.deepEqual(buildProductionColumnConfig({
  draft: { label: '状态', prop: 'status_2', options: [{ label: ' 待处理 ' }, { label: '' }, { label: '完成' }] },
  type: 'select',
  isEditing: true,
  generatedProp: 'ignored'
}), {
  ok: true,
  column: {
    label: '状态',
    prop: 'status_2',
    type: 'select',
    options: [{ label: '待处理', value: '待处理' }, { label: '完成', value: '完成' }]
  }
})
assert.deepEqual(buildProductionColumnConfig({ draft: { label: '状态', options: [] }, type: 'select' }), {
  ok: false, message: '请至少添加一个选项'
})

const parentColumns = [{ prop: 'region', type: 'select' }]
const parentOptions = [{ label: '华东', value: 'east' }, { label: '华南', value: 'south' }]
assert.deepEqual(buildProductionColumnConfig({
  draft: {
    label: '城市',
    dependsOn: 'region',
    cascaderMap: { east: ['上海', '苏州'], 华南: ['广州'] }
  },
  type: 'cascader',
  generatedProp: 'field_city',
  parentColumns,
  parentOptions
}), {
  ok: true,
  column: {
    label: '城市',
    prop: 'field_city',
    type: 'cascader',
    dependsOn: 'region',
    cascaderOptions: {
      east: [{ label: '上海', value: '上海' }, { label: '苏州', value: '苏州' }],
      华东: [{ label: '上海', value: '上海' }, { label: '苏州', value: '苏州' }],
      south: [{ label: '广州', value: '广州' }],
      华南: [{ label: '广州', value: '广州' }]
    }
  }
})
assert.deepEqual(buildProductionColumnConfig({ draft: { label: '城市' }, type: 'cascader' }), {
  ok: false, message: '请选择上一级列'
})
assert.deepEqual(buildProductionColumnConfig({
  draft: { label: '城市', dependsOn: 'missing' }, type: 'cascader', parentColumns
}), { ok: false, message: '上一级必须是下拉或联动列' })
assert.deepEqual(buildProductionColumnConfig({
  draft: { label: '城市', dependsOn: 'region', cascaderMap: {} },
  type: 'cascader',
  parentColumns,
  parentOptions
}), { ok: false, message: '请至少给一个上一级配置下级选项' })

assert.deepEqual(buildProductionColumnConfig({
  draft: { label: '位置', geoAddress: 0 }, type: 'geo', generatedProp: 'field_geo'
}).column, { label: '位置', prop: 'field_geo', type: 'geo', geoAddress: false })
assert.deepEqual(buildProductionColumnConfig({
  draft: { label: '附件', fileMaxSizeMb: 0, fileMaxCount: '2', fileAccept: ' .pdf ' },
  type: 'file',
  generatedProp: 'field_file'
}).column, {
  label: '附件',
  prop: 'field_file',
  type: 'file',
  fileMaxSizeMb: 20,
  fileMaxCount: 2,
  fileAccept: '.pdf'
})

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-production/src/domain/production-grid-column-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request', 'axios', 'window.', 'document.', 'localStorage', 'Date.now', 'Math.random']) {
  assert.equal(moduleSource.includes(forbidden), false, `production grid column policy gained runtime dependency: ${forbidden}`)
}
assert.match(moduleSource, /from ['"]\.\/production-grid-data-policy\.js['"]/)

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-production/src/components/ProductionAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/production-grid-column-policy['"]/)
for (const removedDefinition of [
  'const buildFormulaPrompt =',
  "if (col.type === 'formula') addTab.value",
  "ElMessage.warning('请至少添加一个选项')",
  "ElMessage.warning('上一级必须是下拉或联动列')",
  'colConfig.fileMaxSizeMb = Math.max('
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `ProductionAppGrid reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildProductionAvailableColumns({',
  'buildProductionFormulaPrompt({',
  'buildProductionColumnEditorDraft(col)',
  'buildProductionColumnConfig({',
  'toggleProductionStaticColumn(staticHidden.value, prop, visible)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `ProductionAppGrid lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2077)

console.log('PASS: ProductionAppGrid column policy preserves editor drafts, formulas, cascaders and validation')
