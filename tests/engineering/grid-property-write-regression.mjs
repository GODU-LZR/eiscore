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

const staticColumns = [
  { prop: 'name', label: 'Name' },
  { prop: 'spec', label: 'Specification', storeInProperties: true },
  { prop: 'ratio', label: 'Ratio', storeInProperties: true, type: 'number' }
]
const createColDef = actual(read('shared/eis-data-grid-v2/composables/useGridCore.js'), 'createColDef', {
  getHeaderMinWidth: () => 150, getStoredColumnWidth: () => 180,
  purchaseStatusEditable: false, materialColumns: true,
  isCellReadOnly: () => false, getCellStyle: () => ({}), cellClassRules: {},
  aclModule: { value: 'mms_ledger' }, fieldAcl: { value: {} },
  isSelectColumn: col => col.type === 'select', resolveSelectOptions: col => col.options
})
const spec = createColDef(staticColumns[1], false)
assert.equal(spec.field, 'properties.spec')
assert.equal(spec.colId, 'spec')
assert.equal(createColDef(staticColumns[0], false).field, 'name')
assert.equal(createColDef({ prop: 'custom' }, true).field, 'properties.custom')
const row = { id: 1, name: 'Fixture', properties: { other: 'preserved', spec: 'old', ratio: 2 } }
assert.equal(spec.valueSetter({ data: row, newValue: 'new' }), true)
assert.equal(row.properties.spec, 'new')
assert.equal(Object.hasOwn(row, 'spec'), false)
const resolveDependsOnField = actual(read('shared/eis-data-grid-v2/composables/useGridCore.js'), 'resolveDependsOnField', { props: { staticColumns } })
assert.equal(resolveDependsOnField({ dependsOn: 'spec' }), 'properties.spec')
assert.equal(resolveDependsOnField({ dependsOn: 'name' }), 'name')

const requests = []
const errors = []
const savedEvents = []
let failedIds = new Set()
let rejectBulk = false
const createHistory = actual(read('shared/eis-data-grid-v2/composables/useGridHistory.js'), 'useGridHistory', {
  reactive: value => value, ref: value => ({ value }),
  request: async config => {
    requests.push(structuredClone(config))
    const rowId = config.url.split('id=eq.')[1]
    if (config.method === 'post' && rejectBulk) throw new Error('fixture bulk write rejected')
    if (failedIds.has(rowId)) throw new Error('fixture row write rejected')
    return []
  },
  ElMessage: { success() {}, error: message => errors.push(message) }, ElMessageBox: {},
  shouldCalculateLoadedSummary: () => false, writeGridOperationLog: () => {}, DEFAULT_TEXT_FIELDS: []
})
const makeHistory = (writeMode, nodes) => createHistory(
  { staticColumns, writeMode, writeUrl: '/rows', includeProperties: true },
  { value: { refreshCells() {} } }, { value: nodes.map(node => node.data) },
  { refreshTotals() {}, calculateRowFormulas() {} }, {}, { debounce: fn => fn, onSaved: event => savedEvents.push(event) }
)

const savedNode = { data: row }
const patch = makeHistory('patch', [savedNode])
patch.pendingChanges.push({ rowNode: savedNode, colDef: spec, oldValue: 'old', newValue: 'new' })
await patch.debouncedSave()
assert.deepEqual(requests.at(-1).data, { properties: { other: 'preserved', spec: 'new', ratio: 2 } })
assert.equal(Object.hasOwn(requests.at(-1).data, 'spec'), false)

const upsert = makeHistory('upsert', [savedNode])
upsert.pendingChanges.push({ rowNode: savedNode, colDef: spec, oldValue: 'old', newValue: 'new' })
await upsert.debouncedSave()
assert.equal(requests.at(-1).data[0].properties.spec, 'new')
assert.equal(Object.hasOwn(requests.at(-1).data[0], 'spec'), false)

failedIds = new Set(['1'])
row.properties.spec = 'rejected'
const accepted = { data: { id: 3, properties: { spec: 'accepted' } } }
const partial = makeHistory('patch', [savedNode, accepted])
partial.pendingChanges.push(
  { rowNode: savedNode, colDef: spec, oldValue: 'new', newValue: 'rejected' },
  { rowNode: accepted, colDef: spec, oldValue: 'before', newValue: 'accepted' }
)
await partial.debouncedSave()
assert.equal(row.properties.spec, 'new', 'rejected property edit restores its displayed value')
assert.equal(accepted.data.properties.spec, 'accepted', 'successful row remains committed')
assert.equal(errors.at(-1), 'fixture row write rejected')
assert.equal(row.properties.other, 'preserved')
assert.deepEqual(savedEvents.at(-1)?.rows, [accepted.data], 'partially successful PATCH refreshes derived data for saved rows')

row.properties.spec = 'third'
partial.pendingChanges.push(
  { rowNode: savedNode, colDef: spec, oldValue: 'new', newValue: 'second' },
  { rowNode: savedNode, colDef: spec, oldValue: 'second', newValue: 'third' }
)
await partial.debouncedSave()
assert.equal(row.properties.spec, 'new', 'multiple rejected edits unwind to their original value')

rejectBulk = true
row.properties.spec = 'bulk rejected'
const bulk = makeHistory('upsert', [savedNode])
bulk.pendingChanges.push({ rowNode: savedNode, colDef: spec, oldValue: 'new', newValue: 'bulk rejected' })
await bulk.debouncedSave()
assert.equal(row.properties.spec, 'new', 'failed upsert restores the property edit')
rejectBulk = false

row.name = 'rejected name'
const baseField = makeHistory('patch', [savedNode])
baseField.pendingChanges.push({ rowNode: savedNode, colDef: { field: 'name' }, oldValue: 'Fixture', newValue: 'rejected name' })
await baseField.debouncedSave()
assert.equal(row.name, 'Fixture', 'failed physical-column edit also restores its displayed value')

console.log('PASS: JSON-backed static fields save through properties; rejected edits roll back without undoing successful rows')
