import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const taskDir = path.dirname(fileURLToPath(import.meta.url))
const sourceDir = path.resolve(taskDir, '../../..')
const requireSales = createRequire(path.join(sourceDir, 'eiscore-sales/package.json'))
const { parse, compileScript, compileTemplate } = requireSales('@vue/compiler-sfc')
const read = (relative) => fs.readFileSync(path.join(sourceDir, relative), 'utf8')
const importSource = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const { SALES_APPS, findSalesApp } = await importSource(read('eiscore-sales/src/utils/sales-apps.js'))
const { isEnterpriseModuleEnabled } = await importSource(read('packages/eiscore-platform/src/enterprise-config.mjs'))
const filename = path.join(sourceDir, 'eiscore-sales/src/components/SalesAppGrid.vue')
const sfc = read('eiscore-sales/src/components/SalesAppGrid.vue')
const parsed = parse(sfc, { filename })
assert.deepEqual(parsed.errors, [])
const compiled = compileScript(parsed.descriptor, { id: 'sales-delivery-audit' })
const template = compileTemplate({ source: parsed.descriptor.template.content, filename, id: 'sales-delivery-audit', compilerOptions: { bindingMetadata: compiled.bindings } })
assert.deepEqual(template.errors, [])

const setup = parsed.descriptor.scriptSetup.content
const declared = new Map(compiled.scriptSetupAst.flatMap((statement) => statement.type === 'VariableDeclaration'
  ? statement.declarations.filter((item) => item.id.type === 'Identifier').map((item) => [item.id.name, `const ${setup.slice(item.start, item.end)}`])
  : []))
const selectedNames = [
  'opPerms', 'readOnly', 'purchaseEnabled', 'canCreate', 'canEdit', 'canDelete', 'canConfig', 'canExport',
  'resolveRowActions', 'handleCreate', 'handleRowAction', 'openBatchPushFlowDialog', 'openSalesFlowDialogForRow', 'pushOrderToPurchaseDemand'
]
const createSubject = (appKey, purchase) => {
  let writes = 0
  const context = vm.createContext({
    app: { value: findSalesApp(appKey) },
    computed: (getter) => ({ get value() { return getter() } }),
    hasPerm: () => true,
    window: {},
    getEnterpriseConfig: () => ({ modules: { purchase } }),
    isEnterpriseModuleEnabled,
    request: async () => { writes++; throw new Error('Unexpected business write during guard test') },
    getSelectedSalesOrders: () => { throw new Error('Disabled purchase should stop before selection') },
    openOrderDialog: () => { writes++ },
    openPaymentDialog: () => { writes++ },
    ElMessage: { warning() {} }
  })
  vm.runInContext(`${selectedNames.map((name) => declared.get(name) || assert.fail(`Missing ${name}`)).join('\n')}\nglobalThis.subject = {${selectedNames.join(',')}}`, context)
  return { subject: context.subject, writes: () => writes }
}

for (const [key, api, required] of [
  ['quotes', '/sales_quotes?', ['quote_no', 'approval_status', 'total_amount']],
  ['contracts', '/sales_contracts?', ['contract_no', 'approval_status', 'signing_status']],
  ['receivables', '/v_sales_receivable_aging?', ['schedule_no', 'outstanding_amount', 'aging_status']]
]) {
  const config = findSalesApp(key)
  assert.equal(config.route, `/app/${key}`)
  assert.ok(config.apiUrl.startsWith(api))
  assert.equal(config.showStatusCol, false)
  assert.equal(config.showActionCol, false)
  for (const prop of required) assert.ok(config.staticColumns.some((column) => column.prop === prop), `${key}.${prop}`)
  const { subject, writes } = createSubject(key, false)
  for (const operation of ['canCreate', 'canEdit', 'canDelete', 'canConfig']) assert.equal(subject[operation].value, false, `${key}.${operation}`)
  assert.equal(subject.canExport.value, true)
  assert.equal(subject.resolveRowActions({ id: 'demo', approval_status: '待审批' }).length, 0)
  await subject.handleCreate()
  subject.handleRowAction({ action: { key: 'create-payment' }, row: { id: 'demo' } })
  assert.equal(writes(), 0)
}

for (const key of ['customers', 'opportunities', 'follow_ups', 'orders', 'shipment_requests', 'payments']) {
  const config = findSalesApp(key)
  assert.ok(config?.apiUrl, `${key} existing route has an API`)
  assert.notEqual(config.readOnly, true)
}
assert.equal(SALES_APPS.length, 9)

const disabled = createSubject('orders', false)
const enabled = createSubject('orders', true)
assert.ok(!disabled.subject.resolveRowActions({ id: 'demo' }).some((action) => action.key === 'push-purchase'))
assert.ok(disabled.subject.resolveRowActions({ id: 'demo' }).some((action) => action.key === 'push-shipment'))
assert.ok(enabled.subject.resolveRowActions({ id: 'demo' }).some((action) => action.key === 'push-purchase'))
await disabled.subject.openBatchPushFlowDialog()
await disabled.subject.openSalesFlowDialogForRow({ id: 'demo' }, 'purchase_demand')
await disabled.subject.pushOrderToPurchaseDemand()
assert.equal(disabled.writes(), 0)

const routeSource = read('eiscore-sales/src/router/index.js')
assert.ok(routeSource.includes('/app/:key'))
const viewSource = read('eiscore-sales/src/views/SalesAppView.vue')
assert.ok(viewSource.includes('findSalesApp(appKey.value)'))
console.log('PASS: sales SFC script/template compile; 9 app configurations; 3 read-only ledgers with export; disabled purchase blocked before reads/writes; shipment actions retained; dynamic routes resolve.')
