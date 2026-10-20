// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'acorn'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
function actual(source, name, bindings) {
  let declaration
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'VariableDeclarator' && node.id.name === name) declaration = node.init
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) declaration = node
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  walk(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }))
  assert.ok(declaration, `${name} exists in production source`)
  return Function(...Object.keys(bindings), `return (${source.slice(declaration.start, declaration.end)})`)(...Object.values(bindings))
}

const core = read('shared/eis-data-grid-v2/composables/useGridCore.js')
const staticColumns = [
  { prop: 'name', label: 'Name' },
  { prop: 'spec', label: 'Specification', storeInProperties: true },
  { prop: 'ratio', label: 'Ratio', storeInProperties: true, type: 'number' }
]
const createColDef = actual(core, 'createColDef', {
  getHeaderMinWidth: () => 150, getStoredColumnWidth: () => 180,
  purchaseStatusEditable: false, materialColumns: true,
  isCellReadOnly: () => false, getCellStyle: () => ({}), cellClassRules: {},
  formatSummaryCell: ({ value }) => value, aclModule: { value: 'mms_ledger' },
  fieldAcl: { value: {} }, isSelectColumn: col => col.type === 'select', resolveSelectOptions: col => col.options
})
const spec = createColDef(staticColumns[1], false)
assert.equal(spec.field, 'properties.spec', 'static properties columns use their physical JSON path')
assert.equal(spec.colId, 'spec', 'preserve existing column widths, locks and layout keys')
assert.equal(createColDef(staticColumns[0], false).field, 'name')
assert.equal(createColDef({ prop: 'custom' }, true).field, 'properties.custom')
const row = { id: 1, name: 'Owned fixture', properties: { other: 'preserved', spec: 'old', ratio: 2 } }
assert.equal(spec.valueSetter({ data: row, newValue: 'new' }), true)
assert.equal(row.properties.spec, 'new')
assert.equal(Object.hasOwn(row, 'spec'), false)
const initializedRow = { id: 2 }
assert.equal(spec.valueSetter({ data: initializedRow, newValue: 'first' }), true)
assert.deepEqual(initializedRow.properties, { spec: 'first' })
const withGetter = createColDef({ ...staticColumns[1], valueGetter: () => 'body' }, false)
assert.equal(withGetter.valueGetter({ node: { rowPinned: 'bottom' }, data: { properties: { spec: 9 } } }), 9)
const dependsOn = actual(core, 'resolveDependsOnField', { props: { staticColumns } })
assert.equal(dependsOn({ dependsOn: 'spec' }), 'properties.spec')
assert.equal(dependsOn({ dependsOn: 'name' }), 'name')
const headerScript = read('shared/eis-data-grid-v2/components/renderers/LockHeader.vue').split('<script setup>')[1].split('</script>')[0]
assert.equal(actual(headerScript, 'colKey', { props: { params: { column: { getColId: () => spec.colId } } } }), 'spec')
for (const legacyAppColumns of [false, true]) {
  const bindings = {
    props: {}, legacyAppColumns, aclModule: { value: 'mms_ledger' }, materialColumns: true,
    purchaseStatusEditable: false, columnLockState: { spec: 'fixture-user' },
    isRowLocked: () => false, getFieldAcl: () => null, shouldShowByWorkflow: () => true, canEditByWorkflow: () => true
  }
  assert.equal(actual(core, 'isCellReadOnly', bindings)({ node: {}, data: row, colDef: spec }), true, 'JSON-backed static column lock blocks editing')
  assert.equal(actual(core, 'cellClassRules', bindings)['cell-locked-pattern']({ data: row, colDef: spec }), true, 'lock stripe uses the same stable key')
}

const historySource = read('shared/eis-data-grid-v2/composables/useGridHistory.js')
const errors = []
const requests = []
let failIds = new Set()
let rejectBulk = false
const createHistory = actual(historySource, 'useGridHistory', {
  reactive: value => value, ref: value => ({ value }),
  request: async config => {
    requests.push(structuredClone(config))
    if (config.url.endsWith('id=eq.3')) await new Promise(done => setTimeout(done, 20))
    if (config.method === 'post' && rejectBulk) throw new Error('owned fixture bulk rejected')
    if (failIds.has(config.url.split('id=eq.')[1])) {
      if (config.url.endsWith('id=eq.1')) await new Promise(done => setTimeout(done, 10))
      throw new Error('owned fixture write rejected')
    }
    return []
  },
  ElMessage: { success() {}, error: message => errors.push(message) }, ElMessageBox: {},
  shouldCalculateLoadedSummary: () => false, writeGridOperationLog: () => {}, DEFAULT_TEXT_FIELDS: []
})
function history(writeMode, nodes) {
  return createHistory({ staticColumns, writeMode, writeUrl: '/raw_materials', includeProperties: true },
    { value: { refreshCells() {} } }, { value: nodes.map(node => node.data) },
    { refreshTotals() {}, calculateRowFormulas() {} }, {},
    { debounce: fn => fn })
}
const node = { data: row }
const patch = history('patch', [node])
patch.pendingChanges.push({ rowNode: node, colDef: spec, oldValue: 'old', newValue: 'new' })
await patch.debouncedSave()
assert.deepEqual(requests.at(-1).data, { properties: { other: 'preserved', spec: 'new', ratio: 2 } })
assert.equal(Object.hasOwn(requests.at(-1).data, 'spec'), false)
const upsert = history('upsert', [node])
upsert.pendingChanges.push({ rowNode: node, colDef: spec, oldValue: 'old', newValue: 'new' })
await upsert.debouncedSave()
assert.equal(requests.at(-1).data[0].properties.spec, 'new')
assert.equal(Object.hasOwn(requests.at(-1).data[0], 'spec'), false)

// Simultaneous row saves can partially succeed; only rejected writes roll back.
failIds = new Set(['1'])
row.properties.spec = 'rejected'
const accepted = { data: { id: 3, properties: { spec: 'accepted' } } }
const mixed = history('patch', [node, accepted])
mixed.pendingChanges.push(
  { rowNode: node, colDef: spec, oldValue: 'new', newValue: 'rejected' },
  { rowNode: accepted, colDef: spec, oldValue: 'before', newValue: 'accepted' }
)
await mixed.debouncedSave()
assert.equal(row.properties.spec, 'new', 'restore rejected property edit')
assert.equal(accepted.data.properties.spec, 'accepted', 'retain independently committed row')
assert.equal(errors.at(-1), 'owned fixture write rejected')
assert.equal(row.properties.other, 'preserved')

// All batched edits to a rejected field unwind to its original displayed value.
row.properties.spec = 'third'
mixed.pendingChanges.push(
  { rowNode: node, colDef: spec, oldValue: 'new', newValue: 'second' },
  { rowNode: node, colDef: spec, oldValue: 'second', newValue: 'third' }
)
await mixed.debouncedSave()
assert.equal(row.properties.spec, 'new')

rejectBulk = true
row.properties.spec = 'bulk rejected'
const rejectedUpsert = history('upsert', [node])
rejectedUpsert.pendingChanges.push({ rowNode: node, colDef: spec, oldValue: 'new', newValue: 'bulk rejected' })
await rejectedUpsert.debouncedSave()
assert.equal(row.properties.spec, 'new', 'failed atomic upsert also restores the property edit')
rejectBulk = false

row.name = 'rejected name'
const failedBaseField = history('patch', [node])
failedBaseField.pendingChanges.push({ rowNode: node, colDef: { field: 'name' }, oldValue: 'Owned fixture', newValue: 'rejected name' })
await failedBaseField.debouncedSave()
assert.equal(row.name, 'Owned fixture', 'failed physical column edits also revert')

const summaryConfig = { label: 'Total', rules: { ratio: 'sum' }, expressions: {}, cellLabels: {} }
const formulaSource = read('shared/eis-data-grid-v2/composables/useGridFormula.js')
const calculateTotals = actual(formulaSource, 'calculateTotals', { props: { staticColumns, extraColumns: [] }, activeSummaryConfig: summaryConfig })
const totals = calculateTotals([row, { properties: { ratio: 3 } }])
assert.equal(totals[0].properties.ratio, 5)
assert.equal(Object.hasOwn(totals[0], 'ratio'), false)
const serverTotals = actual(read('shared/eis-grid-server-summary.js'), 'buildServerSummaryRow', {})({
  response: { results: { ratio: { value: 5 } } }, props: { staticColumns }, summaryConfig
})
assert.equal(serverTotals[0].properties.ratio, 5)
let formulaChanges = 0
const calculateRowFormulas = actual(formulaSource, 'calculateRowFormulas', {
  props: { staticColumns, extraColumns: [{ prop: 'double', type: 'formula', expression: '{Ratio} * 2' }] },
  evaluateFormulaExpression: expr => Function(`return (${expr})`)(),
  gridApi: { value: { refreshCells() {} } }, hooks: { pushPendingChange() { formulaChanges += 1 } }
})
calculateRowFormulas(node)
assert.equal(row.properties.double, 4)
assert.equal(formulaChanges, 1)
console.log('PASS: real Grid column/write/history/formula functions preserve property fields, totals, and rejected edits (offline fixtures)')
