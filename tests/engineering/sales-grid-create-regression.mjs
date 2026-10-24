import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import * as quickPolicy from '../../eiscore-sales/src/domain/sales-grid-quick-entry-policy.js'

const componentUrl = new URL('../../eiscore-sales/src/components/SalesAppGrid.vue', import.meta.url)
const source = fs.readFileSync(componentUrl, 'utf8')
const start = source.indexOf('const submitQuickOrder =')
const end = source.indexOf('const buildImportMeta =', start)
const createStart = source.indexOf('const handleCreate =')
const createEnd = source.indexOf('const goApps =', createStart)
assert.ok(start > 0 && end > start && createStart > 0 && createEnd > createStart)
const handlers = source.slice(start, end) + source.slice(createStart, createEnd)

function setup({ key = 'customers', accepted = true, fail = false, mode = '', invalid = false } = {}) {
  const calls = []
  const row = { id: '895f0d1b-4b0d-4d69-9e54-d5895ed1fd23', created_at: '2026-10-21T12:00:00Z', name: '服务端客户' }
  const customer = { id: 'customer-1', name: '惠众客户' }
  const context = {
    ...quickPolicy,
    console: { error() {} },
    app: { value: { key, apiUrl: '/sales_customers?status=neq.deleted', writeUrl: '/sales_customers', createPayload: () => ({ name: '新客户' }) } },
    canCreate: { value: true },
    gridRef: { value: { prependRow: async (created) => { calls.push(['prepend', created]); return accepted }, loadData: async () => calls.push(['reload']) } },
    request: async (config) => { calls.push(['request', config]); if (fail) throw new Error('写入失败'); return [row] },
    ElMessage: Object.fromEntries(['warning', 'success', 'error'].map((name) => [name, (...args) => calls.push([name, ...args])])),
    normalizeApiBaseUrl: (url) => url.split('?')[0],
    todayText: () => '2026-10-21',
    selectedQuickCustomer: { value: invalid ? null : customer },
    selectedQuickBomProduct: { value: null },
    selectedQuickOrder: { value: null },
    selectedOpportunityCustomer: { value: customer },
    selectedFollowCustomer: { value: customer },
    orderForm: { ...quickPolicy.buildSalesQuickOrderForm(), product_name: '消防管道' },
    paymentForm: { customer_name: '惠众客户', amount: 100 },
    opportunityForm: { opportunity_name: '消防项目' },
    followForm: { follow_content: '确认交付日期' },
    currentOrderSource: { value: null },
    isMissingColumnError: () => false,
    syncCustomerReceivableFromRow: async () => calls.push(['receivable-sync']),
    safeEq: encodeURIComponent,
    quickMode: { value: mode },
    quickSubmitting: { value: false },
    quickDialogVisible: { value: true },
    selectedDetailRow: { value: null },
    refreshSelectedDetail: async () => calls.push(['detail-refresh']),
    getErrorMessage: (_error, fallback) => fallback,
    createSalesRow: async (table, data, options = {}) => {
      calls.push(['request', { url: `/${table}`, method: 'post', headers: { Prefer: 'return=representation' }, data, ...options }])
      if (fail) throw new Error('写入失败')
      return [row]
    },
    applyCreatedRow: async (targetAppKey, created) => {
      if (targetAppKey !== context.app.value.key) {
        await context.gridRef.value.loadData()
        return false
      }
      const inserted = await context.gridRef.value.prependRow?.(created)
      if (!inserted) await context.gridRef.value.loadData()
      return inserted
    },
    openOrderDialog: async () => calls.push(['dialog', 'order']),
    openPaymentDialog: async () => calls.push(['dialog', 'payment']),
    openOpportunityDialog: async () => calls.push(['dialog', 'opportunity']),
    openFollowDialog: async () => calls.push(['dialog', 'follow'])
  }
  vm.runInNewContext(`${handlers}\nglobalThis.test = { handleCreate, submitQuickDialog };`, context)
  return { calls, row, context, test: context.test }
}

let checked = 0
{
  const { calls, row, test } = setup()
  await test.handleCreate()
  assert.equal(calls[0][1].headers.Prefer, 'return=representation')
  assert.equal(calls.find(([kind]) => kind === 'prepend')[1], row)
  assert.equal(calls.some(([kind]) => kind === 'reload'), false)
  assert.equal(calls.some(([kind]) => kind === 'success'), true)
  checked++
}
for (const accepted of [false, undefined]) {
  const state = setup({ accepted: false })
  if (accepted === undefined) delete state.context.gridRef.value.prependRow
  await state.test.handleCreate()
  assert.equal(state.calls.filter(([kind]) => kind === 'reload').length, 1)
  checked++
}
{
  const { calls, test } = setup({ fail: true })
  await test.handleCreate()
  assert.equal(calls.some(([kind]) => ['success', 'prepend', 'reload'].includes(kind)), false)
  assert.equal(calls.some(([kind]) => kind === 'error'), true)
  checked++
}
for (const [mode, key] of [['order', 'orders'], ['opportunity', 'opportunities'], ['follow', 'follow_ups']]) {
  const { calls, row, context, test } = setup({ key, mode })
  await test.submitQuickDialog()
  const posts = calls.filter(([kind, config]) => kind === 'request' && config.method === 'post')
  assert.equal(posts.length, 1)
  assert.equal(posts[0][1].headers.Prefer, 'return=representation')
  assert.equal(calls.find(([kind]) => kind === 'prepend')[1], row)
  assert.equal(calls.some(([kind]) => kind === 'reload'), false)
  assert.equal(context.quickDialogVisible.value, false)
  assert.equal(context.quickSubmitting.value, false)
  checked++
}
{
  const { calls, test } = setup({ key: 'customers', mode: 'follow' })
  await test.submitQuickDialog()
  assert.equal(calls.some(([kind]) => kind === 'prepend'), false)
  assert.equal(calls.filter(([kind]) => kind === 'reload').length, 1)
  assert.ok(calls.some(([kind, config]) => kind === 'request' && config.method === 'patch' && config.url.startsWith('/sales_customers?')))
  checked++
}
for (const options of [{ fail: true }]) {
  const { calls, context, test } = setup({ key: 'orders', mode: 'order', ...options })
  await test.submitQuickDialog()
  assert.equal(context.quickDialogVisible.value, true)
  assert.equal(context.quickSubmitting.value, false)
  assert.equal(calls.some(([kind]) => ['success', 'prepend', 'reload'].includes(kind)), false)
  checked++
}
{
  const { calls, test } = setup()
  for (const [key, mode] of [['orders', 'order'], ['payments', 'payment'], ['opportunities', 'opportunity'], ['follow_ups', 'follow']]) {
    const state = setup({ key })
    await state.test.handleCreate()
    assert.deepEqual(state.calls, [['dialog', mode]])
  }
  assert.equal(calls.length, 0)
  checked++
}
assert.equal((source.match(/app\.value\.defaultOrder \|\| 'created_at\.desc\.nullslast,id\.desc'/g) || []).length, 1)
assert.ok(source.includes(':default-order="app.defaultOrder || \'created_at.desc.nullslast,id.desc\'"'))

const documentFlowSource = await fs.promises.readFile(new URL('../../eiscore-sales/src/composables/use-sales-document-flow.js', import.meta.url), 'utf8')
const paymentStart = documentFlowSource.indexOf('const submitQuickPayment = async () =>')
const paymentEnd = documentFlowSource.indexOf('const quoteItemAmount =', paymentStart)
assert.ok(paymentStart > 0 && paymentEnd > paymentStart)
const paymentRow = { id: 'payment-row-1', created_at: '2026-10-24T10:00:00Z' }
const paymentContext = {
  buildSalesQuickPaymentEntry: () => ({ payload: { amount: 25 } }),
  paymentForm: {},
  selectedQuickOrder: { value: null },
  selectedQuickReceivable: { value: null },
  nextDocNo: () => 'PAY-1',
  todayText: () => '2026-10-24',
  request: async config => { paymentContext.requestConfig = config; return [paymentRow] },
  createSalesRow: async (table, data) => paymentContext.request({ url: `/${table}`, method: 'post', data, headers: { Prefer: 'return=representation' } }),
  syncCustomerReceivableFromRow: async () => {},
  loadQuickReceivableSchedules: async () => {},
  ElMessage: { warning() {}, success() {} }
}
vm.runInNewContext(`${documentFlowSource.slice(paymentStart, paymentEnd)}\nglobalThis.submitQuickPayment = submitQuickPayment`, paymentContext)
assert.equal((await paymentContext.submitQuickPayment()).row.id, paymentRow.id)
assert.equal(paymentContext.requestConfig.headers.Prefer, 'return=representation')
console.log(JSON.stringify({ passed: true, behavioralChecks: checked }))

