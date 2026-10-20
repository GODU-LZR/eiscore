import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { ORDER_COLUMNS } from '../eiscore-sales/src/utils/sales-apps.js'
import { evaluateFormulaExpression } from '../eiscore-sales/src/utils/formula-eval.js'
import { buildServerSummaryPayload, buildServerSummaryRow, loadServerSummary } from '../shared/eis-grid-server-summary.js'
import { shouldCalculateLoadedSummary } from '../shared/eis-grid-calculation-policy.js'

// Exercise the actual column factory without loading unrelated Vue renderers.
const core = await readFile(new URL('../shared/eis-data-grid-v2/composables/useGridCore.js', import.meta.url), 'utf8')
const factory = core.slice(core.indexOf('  const createColDef ='), core.indexOf('  const gridColumns ='))
assert.ok(factory.startsWith('  const createColDef ='))
const createColDef = vm.runInNewContext(`${factory}\ncreateColDef`, {
  getHeaderMinWidth: () => 0, getStoredColumnWidth: () => undefined,
  getCellStyle: () => ({}), cellClassRules: {}, isCellReadOnly: () => false,
  materialColumns: false, purchaseStatusEditable: false, legacyAppColumns: false,
  aclModule: { value: '' }, fieldAcl: { value: {} }, isSelectColumn: () => false
})
const props = {
  viewId: 'sales_orders', apiUrl: '/sales_orders?status=neq.deleted&order_date=gte.2026-10-01',
  summaryScope: 'server', acceptProfile: 'public', staticColumns: ORDER_COLUMNS, extraColumns: []
}
const rawRows = [
  { id: 1, quantity: 2, unit_price: 100, total_amount: 200, customer_name: 'A' },
  { id: 2, quantity: 3, unit_price: 100, total_amount: 300, customer_name: 'B' }
]
const amountCol = createColDef(ORDER_COLUMNS.find(col => col.prop === 'total_amount'), false)
assert.equal(amountCol.valueGetter({ node: {}, data: { quantity: 2, unit_price: 100, total_amount: 999 } }), 200)
for (const [rule, value] of [['sum', 500], ['avg', 250]]) {
  const summaryConfig = { label: 'Total', rules: { quantity: 'sum', total_amount: rule }, expressions: {} }
  const [row] = buildServerSummaryRow({ props, summaryConfig, evaluateFormulaExpression, response: {
    results: { quantity: { value: 5 }, total_amount: { value } }
  } })
  assert.equal(amountCol.valueGetter({ node: { rowPinned: 'bottom' }, data: row }), value, rule)
  assert.equal(amountCol.valueGetter({ node: { rowPinned: 'bottom' }, data: { ...row, unit_price: 200 } }), value)
}
assert.equal(amountCol.valueGetter({ node: { rowPinned: 'bottom' }, data: {} }), undefined)
const dynamicCol = createColDef({ prop: 'computed', type: 'formula', valueGetter: params => params.data.other * 3 }, true)
assert.equal(dynamicCol.valueGetter({ node: {}, data: { other: 4 } }), 12)
assert.equal(dynamicCol.valueGetter({ node: { rowPinned: 'bottom' }, data: { properties: { computed: 20 } } }), 20)
assert.equal(dynamicCol.valueGetter({ node: { rowPinned: 'bottom' }, data: { properties: {} } }), undefined)

const formulaProps = { ...props, extraColumns: [
  { prop: 'tax', label: 'Tax', type: 'formula' },
  { prop: 'ratio', label: 'Ratio', type: 'formula' },
  { prop: 'names', label: 'Names', type: 'formula' }
] }
const summaryConfig = {
  label: 'Total', rules: { total_amount: 'none', quantity: 'avg' },
  expressions: { tax: '{订单金额} * 0.2', ratio: '{total_amount} / {quantity}', names: '{客户名称}' }
}
const payload = buildServerSummaryPayload({ props: formulaProps, summaryConfig })
const rules = Object.fromEntries(payload.columns.map(col => [col.prop, col.rule]))
assert.equal(rules.total_amount, 'auto', 'Implicit dependencies derive their rule from filtered values')
assert.equal(rules.quantity, 'avg', 'Explicit dependency rules take precedence')
assert.equal(rules.customer_name, 'auto', 'Column type does not determine implicit dependency aggregation')
assert.equal(rules.unit_price, undefined, 'Unreferenced columns are not requested')
assert.equal(payload.base_query, 'status=neq.deleted&order_date=gte.2026-10-01')
assert.equal(payload.accept_profile, 'public')
const response = { results: { total_amount: { value: 500 }, quantity: { value: 2.5 }, customer_name: { value: 2 } } }
const [formulaRow] = await loadServerSummary({
  props: formulaProps, summaryConfig, evaluateFormulaExpression,
  request: async request => {
    assert.equal(request.url, '/rpc/eis_grid_summary')
    assert.deepEqual(request.data.payload, payload)
    assert.equal(request.headers['Content-Profile'], 'public')
    return response
  }
})
assert.equal(formulaRow.properties.tax, 100)
assert.equal(formulaRow.properties.ratio, 200)
assert.equal(formulaRow.properties.names, 2)
assert.equal(formulaRow.total_amount, undefined, 'An implicit dependency stays hidden')
assert.equal(formulaRow.quantity, 2.5)

const dynamicProps = { ...props, extraColumns: [
  { prop: 'fee', label: 'Fee', type: 'number' },
  { prop: 'derived', label: 'Derived', type: 'formula' }
] }
const dynamicConfig = { rules: {}, expressions: { derived: '{Fee} * 2' } }
const dynamicPayload = buildServerSummaryPayload({ props: dynamicProps, summaryConfig: dynamicConfig })
assert.deepEqual(dynamicPayload.columns.find(col => col.prop === 'fee'), {
  prop: 'fee', label: 'Fee', source: 'properties', type: 'number', rule: 'auto'
})
const [dynamicRow] = await loadServerSummary({
  props: dynamicProps, summaryConfig: dynamicConfig, evaluateFormulaExpression,
  request: async () => ({ results: { fee: { value: 15 } } })
})
assert.equal(dynamicRow.properties.derived, 30)
assert.equal(dynamicRow.properties.fee, undefined)
const [constantRow] = await loadServerSummary({
  props: dynamicProps, summaryConfig: { rules: {}, expressions: { derived: '2 + 3' } },
  evaluateFormulaExpression, request: async () => ({ results: {} })
})
assert.equal(constantRow.properties.derived, 5)

// Exercise the actual local fallback and asynchronous replacement, using raw rows.
const formula = await readFile(new URL('../shared/eis-data-grid-v2/composables/useGridFormula.js', import.meta.url), 'utf8')
const calculations = formula.slice(formula.indexOf('  const calculateTotals ='), formula.indexOf('  const recalculateServerFormulas ='))
assert.ok(calculations.startsWith('  const calculateTotals ='))
const makeTotals = (request, currentProps = props, config = { label: 'Total', rules: { total_amount: 'sum' }, expressions: {} }, rows = rawRows) => {
  const pinnedBottomRowData = { value: [] }
  const serverSummaryState = {}
  const api = { setGridOption(name, rows) { assert.equal(name, 'pinnedBottomRowData'); this.rows = rows }, refreshCells() {} }
  const totals = vm.runInNewContext(`let summarySeq = 0;\n${calculations}\n({ calculateTotals, refreshTotals })`, {
    props: currentProps, activeSummaryConfig: config, gridData: { value: rows },
    gridApi: { value: api }, pinnedBottomRowData, serverSummaryState,
    hooks: {}, request, loadServerSummary, shouldCalculateLoadedSummary,
    evaluateFormulaExpression, buildSearchQuery: () => ''
  })
  return { ...totals, pinnedBottomRowData, serverSummaryState, api }
}
const local = makeTotals(async () => response, formulaProps, summaryConfig)
const [localFormulaRow] = local.calculateTotals(rawRows)
assert.equal(localFormulaRow.properties.tax, formulaRow.properties.tax)
assert.equal(localFormulaRow.properties.ratio, formulaRow.properties.ratio)
assert.equal(localFormulaRow.properties.names, formulaRow.properties.names)

// Compare the real local formula calculator with RPC results for columns whose
// declared type cannot tell us whether their current values are numeric.
const dependencyCases = [
  { viewId: 'employee_list', prop: 'salary', label: '工资', type: 'text', dynamic: true,
    values: ['1200.5', '300', null, '', undefined], expected: 1500.5 },
  { viewId: 'employee_list', prop: 'salary', label: '工资', type: 'text', dynamic: true,
    values: ['1200.5', '待定', 300, null, ''], expected: 3 },
  { viewId: 'inventory_ledger', prop: 'quantity', label: '变动数量',
    values: [12, '8.5', null, undefined, ''], expected: 20.5 },
  { viewId: 'inventory_current', prop: 'available_qty', label: '可用库存',
    values: [0, '18', -3, null, ''], expected: 15 },
  { viewId: 'attendance_day', prop: 'overtime_minutes', label: '加班分钟',
    values: [60, '30', null, ''], expected: 90 },
  { viewId: 'attendance_month', prop: 'total_days', label: '出勤天数',
    values: [20, '22', null, ''], expected: 42 },
  { viewId: 'attendance_month', prop: 'overtime_minutes', label: '加班分钟',
    values: ['120', 60, undefined, ''], expected: 180 },
  { viewId: 'employee_list', prop: 'remark', label: '备注', type: 'text', dynamic: true,
    values: ['待跟进', '已确认', null, ''], expected: 2 },
  { viewId: 'inventory_current', prop: 'available_qty', label: '可用库存',
    values: [null, '', undefined], expected: 0 }
]
for (const entry of dependencyCases) {
  const column = { prop: entry.prop, label: entry.label, ...(entry.type ? { type: entry.type } : {}) }
  const caseProps = {
    ...props, viewId: entry.viewId,
    staticColumns: entry.dynamic ? [] : [column],
    extraColumns: [...(entry.dynamic ? [column] : []), { prop: 'derived', label: '结果', type: 'formula' }]
  }
  const config = { label: '合计', rules: { [entry.prop]: 'none' }, expressions: { derived: `{${entry.label}}` } }
  const rows = entry.values.map((value, id) => entry.dynamic
    ? { id, properties: { [entry.prop]: value } }
    : { id, [entry.prop]: value })
  const casePayload = buildServerSummaryPayload({ props: caseProps, summaryConfig: config })
  const dependency = casePayload.columns.find(col => col.prop === entry.prop)
  assert.equal(dependency.rule, 'auto', `${entry.viewId}.${entry.prop}`)
  assert.equal(dependency.source, entry.dynamic ? 'properties' : 'column')
  const state = makeTotals(async () => ({ results: { [entry.prop]: { value: entry.expected } } }), caseProps, config, rows)
  const [localRow] = state.calculateTotals(rows)
  assert.equal(localRow.properties.derived, entry.expected, `Local ${entry.viewId}.${entry.prop}`)
  await state.refreshTotals()
  const [serverRow] = state.pinnedBottomRowData.value
  assert.equal(state.serverSummaryState.available, true)
  assert.equal(serverRow.properties.derived, localRow.properties.derived, `RPC ${entry.viewId}.${entry.prop}`)
  assert.equal(entry.dynamic ? serverRow.properties[entry.prop] : serverRow[entry.prop], undefined, 'Implicit values stay hidden')
}

for (const [rule, expected] of [['avg', 150], ['count', 2]]) {
  const caseProps = { ...props, staticColumns: [], extraColumns: [
    { prop: 'salary', label: '工资', type: 'text' }, { prop: 'derived', label: '结果', type: 'formula' }
  ] }
  const config = { rules: { salary: rule }, expressions: { derived: '{salary}' } }
  const rows = [{ properties: { salary: '100' } }, { properties: { salary: '200' } }]
  const casePayload = buildServerSummaryPayload({ props: caseProps, summaryConfig: config })
  assert.equal(casePayload.columns.find(col => col.prop === 'salary').rule, rule)
  const state = makeTotals(async () => ({ results: { salary: { value: expected } } }), caseProps, config, rows)
  assert.equal(state.calculateTotals(rows)[0].properties.derived, expected)
  await state.refreshTotals()
  assert.equal(state.pinnedBottomRowData.value[0].properties.derived, expected)
  assert.equal(state.pinnedBottomRowData.value[0].properties.salary, expected, 'Explicit rules stay visible')
}

// Material fields can be displayed as static columns while stored in JSON.
// The request must read JSON, and the pinned row must retain its static field.
const storedProps = { ...props, staticColumns: [
  { prop: 'conversion_ratio', label: '换算比例', type: 'number', storeInProperties: true },
  { prop: 'spec', label: '规格', storeInProperties: true }
], extraColumns: [{ prop: 'derived', label: '结果', type: 'formula' }] }
const storedConfig = { rules: { conversion_ratio: 'sum', spec: 'count' }, expressions: { derived: '{换算比例} * 2' } }
const storedPayload = buildServerSummaryPayload({ props: storedProps, summaryConfig: storedConfig })
assert.equal(storedPayload.columns.find(col => col.prop === 'conversion_ratio').source, 'properties')
assert.equal(storedPayload.columns.find(col => col.prop === 'spec').source, 'properties')
const [storedRow] = await loadServerSummary({
  props: storedProps, summaryConfig: storedConfig, evaluateFormulaExpression,
  request: async () => ({ results: { conversion_ratio: { value: 15 }, spec: { value: 2 } } })
})
assert.equal(storedRow.conversion_ratio, 15)
assert.equal(storedRow.spec, 2)
assert.equal(storedRow.properties.conversion_ratio, undefined)
assert.equal(storedRow.properties.derived, 30)
assert.equal(createColDef(storedProps.staticColumns[0], false).field, 'conversion_ratio')
const storedRows = [
  { properties: { conversion_ratio: 10, spec: 'DN100' } },
  { properties: { conversion_ratio: 5, spec: 'DN200' } }
]
const storedLocal = makeTotals(async () => { throw new Error('RPC unavailable') }, storedProps, storedConfig, storedRows)
assert.equal(storedLocal.calculateTotals(storedRows)[0].conversion_ratio, storedRow.conversion_ratio)
assert.equal(storedLocal.calculateTotals(storedRows)[0].spec, storedRow.spec)
assert.equal(storedLocal.calculateTotals(storedRows)[0].properties.derived, storedRow.properties.derived)
await storedLocal.refreshTotals()
assert.equal(storedLocal.serverSummaryState.available, false)
assert.equal(storedLocal.pinnedBottomRowData.value[0].conversion_ratio, 15)

// Use the actual attendance column metadata, without executing its row getter.
const attendance = await readFile(new URL('../eiscore-hr/src/views/HrAttendanceView.vue', import.meta.url), 'utf8')
const punchColumnSource = attendance.match(/\{\s*label: '打卡次数',[\s\S]*?\n  \}/)?.[0]
assert.ok(punchColumnSource)
const punchColumn = vm.runInNewContext(`(${punchColumnSource})`, {
  normalizePunchTimes() { throw new Error('A summary must not execute the ordinary row getter') }
})
assert.equal(punchColumn.summaryField, 'punch_times')
assert.equal(punchColumn.summaryTransform, 'array_length')
const punchProps = { ...props, viewId: 'attendance_day', apiUrl: '/attendance_records', acceptProfile: 'hr',
  staticColumns: [punchColumn], extraColumns: [{ prop: 'derived', label: '结果', type: 'formula' }]
}
const punchRows = [
  { punch_times: ['08:00', '12:00', '13:00', '18:00'] },
  { punch_times: ['08:00', '18:00'] }, { punch_times: [] }, { punch_times: null }
]
const punchColDef = createColDef(punchColumn, false)
for (const [rule, expected] of [['sum', 6], ['avg', 1.5], ['count', 4], ['max', 4], ['min', 0], ['none', 6]]) {
  const config = { label: '合计', rules: { punch_count: rule }, expressions: { derived: '{打卡次数}' } }
  const punchPayload = buildServerSummaryPayload({ props: punchProps, summaryConfig: config })
  const dependency = punchPayload.columns.find(col => col.prop === 'punch_count')
  assert.equal(dependency.field, 'punch_times')
  assert.equal(dependency.transform, 'array_length')
  assert.equal(dependency.source, 'column')
  assert.equal(dependency.rule, rule === 'none' ? 'auto' : rule)
  const state = makeTotals(async () => ({ results: { punch_count: { value: expected } } }), punchProps, config, punchRows)
  const [localPunchRow] = state.calculateTotals(punchRows)
  assert.equal(localPunchRow.properties.derived, expected, `Local punch_count ${rule}`)
  await state.refreshTotals()
  const [serverPunchRow] = state.pinnedBottomRowData.value
  assert.equal(state.serverSummaryState.available, true)
  assert.equal(serverPunchRow.properties.derived, localPunchRow.properties.derived, `RPC punch_count ${rule}`)
  assert.equal(punchColDef.valueGetter({ node: { rowPinned: 'bottom' }, data: serverPunchRow }), rule === 'none' ? undefined : expected)
}
assert.equal(payload.columns.some(col => 'field' in col || 'transform' in col), false, 'Ordinary columns do not send transform metadata')

for (const request of [async () => ({ results: {} }), async () => { throw new Error('RPC unavailable') }]) {
  const state = makeTotals(request)
  await state.refreshTotals()
  assert.equal(state.pinnedBottomRowData.value[0].total_amount, 500)
  assert.equal(amountCol.valueGetter({ node: { rowPinned: 'bottom' }, data: state.api.rows[0] }), 500)
  assert.equal(state.serverSummaryState.available, false)
  assert.ok(state.serverSummaryState.error)
}
const avg = makeTotals(async () => ({ results: { total_amount: { value: 250 } } }), props, {
  label: 'Total', rules: { total_amount: 'avg' }, expressions: {}
})
await avg.refreshTotals()
assert.equal(avg.serverSummaryState.available, true)
assert.equal(amountCol.valueGetter({ node: { rowPinned: 'bottom' }, data: avg.api.rows[0] }), 250)
assert.equal(avg.calculateTotals(rawRows)[0].total_amount, 250)
console.log('PASS: actual grid column definitions and local formula calculator; auto dependencies for text numbers, mixed text, empty values, inventory and attendance fields; explicit rules, hidden values, JSON-backed static fields, attendance array lengths and filtered RPC payloads; raw-row fallback survives incomplete/failed RPC')
