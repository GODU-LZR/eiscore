// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'acorn'

const coreSource = readFileSync(new URL('../../shared/eis-data-grid-v2/composables/useGridCore.js', import.meta.url), 'utf8')
const historySource = readFileSync(new URL('../../shared/eis-data-grid-v2/composables/useGridHistory.js', import.meta.url), 'utf8')
function declaration(source, name) {
  let found
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'VariableDeclarator' && node.id.name === name) found = node.init
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  walk(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }))
  assert.ok(found, `actual source defines ${name}`)
  return source.slice(found.start, found.end)
}
const warnings = []
const ElMessage = Object.fromEntries(['warning', 'info', 'error', 'success'].map(key => [key, message => warnings.push(message)]))
function makeCore(module = 'hr_user', permissions = []) {
  const bindings = {
    aclModule: { value: module }, props: { aclModule: module, includeProperties: false },
    STATUS_TRANSITION_ACTION: 'status_transition', getPermissionList: () => permissions,
    hasPermission: code => permissions.includes(code), legacyAppColumns: false,
    columnLockState: {}, materialColumns: false, purchaseStatusEditable: false,
    getFieldAcl: () => null, shouldShowByWorkflow: () => true, canEditByWorkflow: () => true,
    activeSummaryConfig: { label: '合计' }, cellClassRules: {}, currentUser: { value: 'synthetic' }, ElMessage
  }
  for (const name of ['normalizeStatus', 'toStoredStatus', 'shouldEnforceStatusTransitionPermission', 'canTransitionStatus', 'hasOutgoingTransitionPermission', 'isAclStatusField', 'canUnlockAclRow', 'isRowLocked', 'isCellReadOnly', 'statusCol']) {
    bindings[name] = Function(...Object.keys(bindings), `return (${declaration(coreSource, name)})`)(...Object.values(bindings))
  }
  return bindings
}
const core = makeCore()
assert.equal(core.toStoredStatus('created'), 'created')
assert.equal(core.toStoredStatus('locked'), 'locked')
assert.equal(core.normalizeStatus('draft'), 'created')
assert.equal(core.normalizeStatus('disabled'), 'disabled', 'legacy disabled is not an effective lock')
for (const [from, to, allowed] of [
  ['created', 'active', true], ['created', 'locked', false], ['draft', 'locked', false],
  ['active', 'locked', true], ['active', 'created', true], ['locked', 'active', true],
  ['locked', 'created', false], ['disabled', 'active', true], ['disabled', 'locked', false],
  ['active', 'invalid', false]
]) assert.equal(core.canTransitionStatus(from, to), allowed, `${from} -> ${to}`)
assert.equal(makeCore('hr_user', ['op:hr_user.status_transition.created_active']).canTransitionStatus('active', 'locked'), false)
const legacy = makeCore('mms_materials')
assert.equal(legacy.toStoredStatus('created'), 'draft')
assert.equal(legacy.toStoredStatus('locked'), 'disabled')
assert.equal(legacy.normalizeStatus('disabled'), 'locked')
const row = { id: 'synthetic-user', status: 'active', full_name: '合成用户', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }
const params = { data: row, node: {}, colDef: { field: '_status' }, oldValue: 'active', newValue: 'locked' }
assert.equal(core.statusCol.valueSetter(params), true)
assert.equal(row.status, 'locked')
assert.equal(row._userStatusPending, true)
assert.equal(core.isCellReadOnly({ ...params, colDef: { field: 'full_name' } }), true)
assert.equal(core.statusCol.valueSetter({ ...params, oldValue: 'locked', newValue: 'active' }), false, 'pending lock must be saved before another transition')
delete row._userStatusPending
delete row._userStatusBeforeSave
assert.equal(core.isCellReadOnly(params), false, 'locked status can be independently unlocked')
assert.equal(core.statusCol.valueSetter({ ...params, oldValue: 'locked', newValue: 'created' }), false)
assert.equal(core.statusCol.valueSetter({ ...params, oldValue: 'locked', newValue: 'active' }), true)
assert.equal(core.isCellReadOnly({ ...params, colDef: { field: 'role_id' } }), true, 'unlock must save before editing a role')
assert.equal(core.statusCol.valueGetter({ ...params, data: { status: 'disabled' } }), 'disabled')
assert.equal(core.statusCol.cellEditorParams({ value: 'created' }).canSelectStatus('locked'), false)
core.props.canEdit = false
assert.equal(core.statusCol.valueSetter({ ...params, data: { status: 'active' } }), false)

const historyAst = parse(historySource, { ecmaVersion: 'latest', sourceType: 'module' })
const historyFn = historyAst.body.find(node => node.declaration?.id?.name === 'useGridHistory').declaration
const createHistory = Function('reactive', 'ref', 'request', 'ElMessage', 'ElMessageBox', 'shouldCalculateLoadedSummary', 'writeGridOperationLog', 'DEFAULT_TEXT_FIELDS', `return (${historySource.slice(historyFn.start, historyFn.end)})`)
const calls = []
let rejectSave = false
let selectedNodes = []
let historyNode
const api = {
  refreshCells: () => {}, getSelectedNodes: () => selectedNodes,
  getRowNode: () => historyNode, getColumn: field => ({ getColDef: () => ({ field }) }),
  applyTransaction: () => { throw new Error('locked user delete must not reach transaction') }
}
const request = async config => {
  calls.push(config)
  if (config.method === 'patch') {
    if (rejectSave) throw new Error('synthetic server rejection')
    return [{ ...historyNode.data, status: config.data.status || historyNode.data.status, updated_at: '2026-10-09T00:00:00Z' }]
  }
  throw new Error('unexpected request')
}
const props = { aclModule: 'hr_user', canEdit: true, includeProperties: false, writeMode: 'patch', writeUrl: '/v_users_manage', patchRequiredFields: ['id'], staticColumns: [] }
const historyCore = makeCore()
historyNode = { data: { ...row }, setDataValue: (field, value) => { historyNode.data[field] = value; return true } }
const hooks = createHistory(x => x, value => ({ value }), request, ElMessage, { confirm: async () => {} }, () => false, () => {}, [])(
  props, { value: api }, { value: [] }, { calculateRowFormulas: () => {}, refreshTotals: () => {} }, {},
  { debounce: fn => Object.assign(fn, { cancel: () => {} }), isCellReadOnly: historyCore.isCellReadOnly, isRowLocked: historyCore.isRowLocked }
)
hooks.pendingChanges.push({ rowNode: historyNode, colDef: { field: '_status' }, newValue: 'active', oldValue: 'locked' })
await hooks.debouncedSave()
assert.equal(calls[0].method, 'patch')
assert.equal(Object.hasOwn(calls[0].data, 'updated_at'), false, 'client must not manufacture audit time')
assert.equal(Object.hasOwn(calls[0].data, 'created_at'), false)
assert.equal(Object.hasOwn(calls[0].data, '_userStatusPending'), false)
assert.equal(historyNode.data.updated_at, '2026-10-09T00:00:00Z', 'save must merge real DB representation')
assert.equal(historyNode.data._userStatusPending, undefined)
historyNode.data.status = 'locked'
selectedNodes = [historyNode]
await hooks.deleteSelectedRows()
assert.equal(calls.length, 1, 'locked rows cannot be deleted')
hooks.history.undoStack.push({ type: 'single', rowId: historyNode.data.id, colId: 'full_name', oldValue: 'before', newValue: 'after' })
hooks.performUndoRedo('undo')
assert.equal(hooks.history.undoStack.length, 1, 'blocked undo must retain history')
assert.equal(hooks.pendingChanges.length, 0)
rejectSave = true
historyNode.data.status = 'active'
historyNode.data._userStatusPending = true
historyNode.data._userStatusBeforeSave = 'locked'
hooks.pendingChanges.push({ rowNode: historyNode, colDef: { field: '_status' }, newValue: 'active', oldValue: 'locked' })
historyNode.data.full_name = 'rejected edit'
hooks.pendingChanges.push({ rowNode: historyNode, colDef: { field: 'full_name' }, newValue: 'rejected edit', oldValue: '合成用户' })
await hooks.debouncedSave()
assert.equal(historyNode.data.status, 'locked', 'failed unlock restores locked UI state')
assert.equal(historyNode.data.full_name, '合成用户', 'failed save must not leave unsaved edits on screen')
assert.equal(historyNode.data._userStatusPending, undefined)
assert.ok(warnings.includes('synthetic server rejection'), 'real save error remains visible')
console.log('PASS: actual HR Grid lifecycle, transition ACL, pending unlock, delete/undo guards and authoritative timestamps (offline fixtures)')
