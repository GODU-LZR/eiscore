// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'acorn'
import { exportGridCsv, formatSelectLabel, formatStatusLabel } from '../../shared/eis-grid-export.mjs'

// Offline fixtures only: no HTTP, browser, service, database or real user records.
const repoRoot = resolve(import.meta.dirname, '../..')
const corePath = 'shared/eis-data-grid-v2/composables/useGridCore.js'
const baseline = process.argv.includes('--baseline')
const coreSource = baseline
  ? execFileSync('git', ['show', `HEAD:${corePath}`], { cwd: repoRoot, encoding: 'utf8' })
  : readFileSync(resolve(repoRoot, corePath), 'utf8')
const coreAst = parse(coreSource, { ecmaVersion: 'latest', sourceType: 'module' })
const coreBody = coreAst.body.find(node => node.declaration?.id?.name === 'useGridCore').declaration.body.body

function compileCoreVariable(name, bindings) {
  const declaration = coreBody.flatMap(node => node.declarations || []).find(node => node.id.name === name)
  assert.ok(declaration?.init, `actual Core must define ${name}`)
  return Function(...Object.keys(bindings), `return (${coreSource.slice(declaration.init.start, declaration.init.end)})`)(...Object.values(bindings))
}

function makeCore({ acl = null, materialColumns = false, legacyAppColumns = false, cellLabels = {}, dictOptions = {} } = {}) {
  const isSelectColumn = compileCoreVariable('isSelectColumn', { legacyAppColumns })
  const resolveSelectOptions = compileCoreVariable('resolveSelectOptions', { dictOptions })
  const formatSummaryCell = compileCoreVariable('formatSummaryCell', {
    getFieldAcl: () => acl,
    materialColumns,
    activeSummaryConfig: { cellLabels },
    isSelectColumn,
    resolveSelectOptions,
    formatSelectLabel
  })
  const createColDef = compileCoreVariable('createColDef', {
    getStoredColumnWidth: () => undefined,
    getHeaderMinWidth: () => 150,
    aclModule: { value: null },
    isAclStatusField: () => false,
    isRowLocked: () => false,
    canUnlockAclRow: () => false,
    normalizeStatus: value => value,
    canTransitionStatus: () => true,
    ElMessage: { warning: () => {} },
    getCellStyle: () => ({}),
    isCellReadOnly: () => false,
    cellClassRules: {},
    fieldAcl: { value: {} },
    purchaseStatusEditable: false,
    materialColumns,
    formatSummaryCell,
    isSelectColumn,
    resolveSelectOptions
  })
  return { formatSummaryCell, createColDef }
}

const options = [{ value: 7, label: '合成部门' }]
const columnConfig = { prop: 'dept_id', type: 'select', options }
const params = { value: 7, node: {}, colDef: { field: 'dept_id' } }
const core = makeCore()
assert.equal(core.formatSummaryCell(params, columnConfig), '合成部门', 'select export must format its label in the actual Core')
assert.equal(baseline, false, 'committed pre-fix Core unexpectedly passes the reproducer; inspect the baseline')

const labelCases = [
  [7, options, '合成部门'],
  ['7', options, '合成部门'],
  [0, [{ value: '0', label: '零值' }], '零值'],
  [false, [{ value: 'false', label: '否' }], '否'],
  ['false', [{ value: false, label: '否' }], '否'],
  [null, options, ''],
  [undefined, options, ''],
  ['', [{ value: '', label: '空选项' }], ''],
  [0, [{ value: 0, label: '' }], '0'],
  [false, [{ value: false, label: null }], 'false'],
  ['name-only', [{ value: '', label: 'name-only' }], 'name-only'],
  ['name-only', [{ value: null, label: 'name-only' }], 'name-only'],
  ['name-only', [{ label: 'name-only' }], 'name-only'],
  ['numeric-label', [{ value: 'numeric-label', label: 0 }], '0'],
  ['boolean-label', [{ value: 'boolean-label', label: false }], 'false'],
  [9, options, 9],
  [false, [], false],
  [0, [], 0],
  ['unknown', [null, {}], 'unknown']
]
for (const [value, choices, expected] of labelCases) {
  assert.equal(formatSelectLabel(value, choices), expected)
}
assert.equal(formatSelectLabel('unknown'), 'unknown')

for (const [value, expected] of [
  ['created', '创建'],
  ['active', '生效'],
  ['locked', '锁定'],
  ['disabled', '停用'],
  ['', ''],
  ['unknown', 'unknown']
]) {
  assert.equal(formatStatusLabel(value), expected)
}

options[0].label = '更新后的部门'
assert.equal(core.formatSummaryCell(params, columnConfig), '更新后的部门', 'live option updates must not use stale labels')
options.push({ value: 9, label: '新增部门' })
assert.equal(core.formatSummaryCell({ ...params, value: 9 }, columnConfig), '新增部门')

for (const config of [
  columnConfig,
  { ...columnConfig, type: 'dropdown' },
  { prop: 'dept_id', options },
  { prop: 'dept_id', dictKey: 'departments' }
]) {
  const currentCore = makeCore({ dictOptions: { departments: options } })
  assert.equal(currentCore.formatSummaryCell(params, config), '更新后的部门')
  assert.equal(currentCore.formatSummaryCell({ ...params, value: 11 }, config), 11)
}
const deniedCore = makeCore({ acl: { canView: false } })
assert.equal(deniedCore.formatSummaryCell(params, { ...columnConfig, formatter: () => { throw new Error('formatter bypassed ACL') } }), '*******')
assert.equal(core.formatSummaryCell(params, { ...columnConfig, formatter: () => '自定义显示' }), '自定义显示')
assert.equal(makeCore({ materialColumns: true }).formatSummaryCell(params, {
  ...columnConfig,
  valueFormatter: () => '仓储格式',
  formatter: () => '后续格式'
}), '仓储格式')
assert.equal(core.formatSummaryCell({ ...params, value: ['a', 'b'] }, { type: 'text' }), 'a  b')
assert.equal(core.formatSummaryCell({ ...params, value: 0 }, { type: 'number' }), 0)

const pinned = { ...params, node: { rowPinned: 'bottom' } }
assert.equal(core.formatSummaryCell(pinned, { ...columnConfig, formatter: () => '不得覆盖汇总' }), 7)
assert.equal(core.formatSummaryCell(pinned, { type: 'check' }), '')
const summaryCore = makeCore({ cellLabels: { dept_id: '计数' } })
assert.equal(summaryCore.formatSummaryCell(pinned, columnConfig), '计数: 7')
for (const value of [null, undefined, '']) {
  assert.equal(summaryCore.formatSummaryCell({ ...pinned, value }, columnConfig), '')
}
assert.equal(summaryCore.formatSummaryCell({ ...pinned, value: 0 }, columnConfig), '计数: 0')

const excludedConfig = { label: '合成敏感列', prop: 'restricted_field', type: 'text', suppressCsvExport: true }
for (const dynamic of [false, true]) {
  const definition = core.createColDef(excludedConfig, dynamic)
  assert.equal(definition.context?.suppressCsvExport, true, 'configured exclusion must reach AG Grid legal context metadata')
  assert.equal(Object.hasOwn(definition, 'suppressCsvExport'), false)
  assert.equal(definition.field, dynamic ? 'properties.restricted_field' : 'restricted_field')
}
assert.equal(core.createColDef({ ...excludedConfig, suppressCsvExport: false }, false).context?.suppressCsvExport, false)
const selectableDefinition = core.createColDef(columnConfig, false)
assert.equal(selectableDefinition.valueFormatter({ ...params, colDef: selectableDefinition }), '更新后的部门')

function makeColumn(id, definition) {
  return { getColId: () => id, getColDef: () => definition }
}
const visibleSecond = makeColumn('dept_id', selectableDefinition)
const visibleFirst = makeColumn('full_name', { field: 'full_name' })
const sensitiveColumns = [
  makeColumn('password', { field: 'password' }),
  makeColumn('dynamic-secret', { field: 'properties.password' }),
  makeColumn('Password', {}),
  makeColumn('password', { field: 'aliased_secret' }),
  makeColumn('properties.PASSWORD', {}),
  makeColumn('flagged', core.createColDef(excludedConfig, false))
]
const calls = []
const api = {
  getAllDisplayedColumns: () => [visibleSecond, ...sensitiveColumns, visibleFirst],
  getColumns: () => { throw new Error('export must not include hidden columns') },
  exportDataAsCsv: args => calls.push(args)
}
exportGridCsv(api)
assert.equal(calls.length, 1)
assert.deepEqual(calls[0].columnKeys, [visibleSecond, visibleFirst], 'export must preserve displayed column order and exclude sensitive fields')
assert.equal(calls[0].fileName, '导出数据.csv')
assert.equal(Object.hasOwn(calls[0], 'processCellCallback'), false, 'CSV must retain the actual column valueFormatter path')
assert.equal(Object.hasOwn(calls[0], 'allColumns'), false)
exportGridCsv({ ...api, getAllDisplayedColumns: () => [] })
exportGridCsv({ ...api, getAllDisplayedColumns: () => sensitiveColumns })
exportGridCsv(null)
exportGridCsv(undefined)
assert.equal(calls.length, 1, 'empty safe-column lists must not trigger AG Grid all-column fallback')

globalThis.__EISCORE_ENTERPRISE_CONFIG__ = { enterprise: { displayName: '测试系统/系统' } }
exportGridCsv(api, { appName: '角色列表' })
assert.equal(calls[1].fileName, '测试系统-系统-角色列表.csv')

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-hr/src/views/HrUserManage.vue'), 'utf8')
const script = pageSource.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
assert.ok(script)
const pageAst = parse(script, { ecmaVersion: 'latest', sourceType: 'module' })
const staticColumns = pageAst.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'staticColumnsAll').init.arguments[0].body.elements
const passwordNode = staticColumns.find(node => node.properties.some(property => property.key.name === 'prop' && property.value.value === 'password'))
const passwordConfig = Function(`return (${script.slice(passwordNode.start, passwordNode.end)})`)()
assert.equal(passwordConfig.suppressCsvExport, true)
assert.equal(typeof passwordConfig.formatter, 'function')
assert.equal(passwordConfig.formatter({ value: 'synthetic-value' }), '******')
assert.equal(passwordConfig.formatter({ value: '' }), '')
const passwordDefinition = core.createColDef(passwordConfig, false)
assert.equal(passwordDefinition.valueFormatter({ ...params, value: 'synthetic-value', colDef: passwordDefinition }), '******')

const entrySource = readFileSync(resolve(repoRoot, 'shared/eis-data-grid-v2/index.vue'), 'utf8')
assert.match(entrySource, /@export="handleExport"/)
assert.match(entrySource, /const handleExport = \(\) => exportGridCsv\(gridApi\.value, \{ appName: gridProps\.exportName \}\)/)
assert.match(entrySource, /exportName: \{ type: String, default: '' \}/)
assert.match(entrySource, /import\s*{\s*exportGridCsv\s*}\s*from\s*['"]@shared\/eis-grid-export\.mjs['"]/)
assert.match(coreSource, new RegExp(String.raw`import\s*{\s*formatSelectLabel\s*,\s*formatStatusLabel\s*}\s*from\s*['"]@shared/eis-grid-export\.mjs['"]`))
assert.match(coreSource, /formatStatusLabel\(params\.value\)/)

console.log('PASS: offline Grid CSV labels, exclusions, ACL, summary and shared-entry regression (synthetic fixtures only)')
