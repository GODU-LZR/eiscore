import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../eiscore-base/package.json', import.meta.url))
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')
const { ref } = require('vue')
const filename = 'BusinessFlowMap.vue'
const source = readFileSync(new URL('../../eiscore-base/src/components/business-flow/BusinessFlowMap.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(source, { filename })
assert.deepEqual(errors, [])
compileScript(descriptor, { id: 'huizhong-sales-flow' })
assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'huizhong-sales-flow' }).errors, [])

let userInfo = { app_role: 'sales_manager' }
let enterpriseConfig = {
  enterprise: { displayName: '惠众消防集团' },
  modules: { sales: true, materials: true },
  features: { salesWorkbenchFlow: true }
}
const visibility = ref({ hiddenModules: [], hiddenApps: {} })
const routes = []
const setup = new Function(
  'defineEmits', 'useRouter', 'hasPerm', 'getUserInfo', 'getEnterpriseConfig', 'isAppVisible', 'useDisplayVisibility', 'window',
  `${descriptor.scriptSetup.content.replace(/^import .*$/gm, '')}\nreturn { salesWorkbenchFlow, flowNodes, genericFlowNodes, genericFlowLines, unavailableReason, openNode }`
)
const granted = new Set(['module:mms', 'app:mms_inventory'])
const flow = setup(
  () => (_name, path) => routes.push(path),
  () => ({ push: (path) => routes.push(path) }),
  (permission) => granted.has(permission) || (userInfo.permissions || []).includes(permission),
  () => userInfo,
  () => enterpriseConfig,
  (value, moduleKey, appKey) => !value.hiddenModules.includes(moduleKey) && !(value.hiddenApps[moduleKey] || []).includes(appKey),
  () => ({ visibility }),
  {}
)

assert.deepEqual(flow.flowNodes.map(({ key }) => key), [
  'customers', 'opportunities', 'follow_ups', 'quotes', 'contracts', 'orders',
  'shipment_requests', 'sales-stock-out', 'receivables', 'payments'
])
assert.equal(flow.salesWorkbenchFlow, true)
assert.deepEqual(flow.flowNodes.map(({ route }) => route), [
  '/sales/app/customers',
  '/sales/app/opportunities',
  '/sales/app/follow_ups',
  '/sales/app/quotes',
  '/sales/app/contracts',
  '/sales/app/orders',
  '/sales/app/shipment_requests',
  '/materials/inventory-stock-out?ioType=销售出库',
  '/sales/app/receivables',
  '/sales/app/payments'
])
assert.equal(flow.flowNodes[7].visibilityKey, 'inventory-stock-out')
assert.ok(!flow.flowNodes.some(({ key }) => ['bom', 'process_template', 'equipment_check', 'production_order'].includes(key)))
assert.equal(flow.unavailableReason(flow.flowNodes[0]), '')
flow.openNode(flow.flowNodes[9])
assert.deepEqual(routes, ['/sales/app/payments'])

for (const role of ['super_admin', 'system_admin', 'admin', '超级管理员']) {
  userInfo = { role_code: role }
  assert.equal(flow.unavailableReason(flow.flowNodes[0]), '', `${role} should access visible sales flow nodes`)
  assert.equal(flow.unavailableReason(flow.flowNodes[7]), '', `${role} should access visible warehouse flow nodes`)
}

userInfo = { permissions: ['app:sales_customer'] }
assert.equal(flow.unavailableReason(flow.flowNodes[0]), '')
assert.equal(flow.unavailableReason(flow.flowNodes[1]), '无访问权限')
userInfo = { permissions: ['module:sales'] }
assert.equal(flow.unavailableReason(flow.flowNodes[1]), '')
userInfo = { app_role: 'sales_manager' }
assert.equal(flow.unavailableReason(flow.flowNodes[1]), '')
visibility.value = { hiddenModules: [], hiddenApps: { sales: ['payments'] } }
assert.equal(flow.unavailableReason(flow.flowNodes[9]), '入口已隐藏')
visibility.value = { hiddenModules: [], hiddenApps: { materials: ['inventory-stock-out'] } }
assert.equal(flow.unavailableReason(flow.flowNodes[7]), '入口已隐藏')
enterpriseConfig.modules.materials = false
assert.equal(flow.unavailableReason(flow.flowNodes[7]), '模块未启用')

enterpriseConfig.features.salesWorkbenchFlow = false
const genericFlow = setup(
  () => () => {},
  () => ({ push: () => {} }),
  (permission) => granted.has(permission) || (userInfo.permissions || []).includes(permission),
  () => userInfo,
  () => enterpriseConfig,
  (value, moduleKey, appKey) => !value.hiddenModules.includes(moduleKey) && !(value.hiddenApps[moduleKey] || []).includes(appKey),
  () => ({ visibility }),
  {}
)
assert.equal(genericFlow.salesWorkbenchFlow, false)
assert.equal(genericFlow.genericFlowNodes.length, 21)
assert.equal(genericFlow.genericFlowLines.length, 17)
assert.equal(genericFlow.genericFlowNodes.find(({ key }) => key === 'sales_order').route, '/sales/app/orders')

const home = readFileSync(new URL('../../eiscore-base/src/views/HomeView.vue', import.meta.url), 'utf8')
assert.match(home, /salesWorkbenchFlow \? '销售业务流程' : '业务流程'/)
assert.match(home, /salesWorkbenchFlow \? '客户、报价、合同到回款' : '采购、生产、质检与仓储'/)
assert.match(home, /info\.role_code, info\.roleCode, info\.dbRole, info\.db_role/)
console.log('PASS: Huizhong workbench uses the ten-stage sales flow with module, display, and permission gates')
