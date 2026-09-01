// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseRowActions,
  buildPurchaseRowFlowPlan,
  buildPurchaseToolbarFlowPlan,
  getPurchaseFlowDialogConfig,
  getPurchaseFlowNextStepForAction,
  getPurchaseFlowPermission,
  parsePurchaseRealtimePayload,
  PURCHASE_FLOW_NEXT_STEPS,
  shouldReloadPurchaseRealtimeEvent
} from '../../eiscore-purchase/src/domain/purchase-grid-operation-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const demand = { id: 1, demand_no: 'PD-1', demand_status: '待采购', status: 'active' }
const order = { id: 2, order_no: 'PO-2', order_status: '已下单', status: 'active' }
const arrival = { id: 3, arrival_no: 'PA-3', arrival_status: '待检验', iqc_status: '待检', status: 'active' }

assert.equal(PURCHASE_FLOW_NEXT_STEPS.DEMAND_TO_ORDER, 'purchase_order')
assert.equal(PURCHASE_FLOW_NEXT_STEPS.ORDER_TO_ARRIVAL, 'purchase_arrival')
assert.equal(PURCHASE_FLOW_NEXT_STEPS.ARRIVAL_TO_INBOUND, 'inventory_inbound')

const demandActions = buildPurchaseRowActions({ appKey: 'demands', row: demand, canPushDemand: true })
assert.equal(demandActions.length, 1)
assert.equal(demandActions[0].key, 'push-demand-order')
assert.equal(demandActions[0].sopSteps.length, 4)
assert.match(demandActions[0].sopRisk, /供应商或数量/)
assert.deepEqual(buildPurchaseRowActions({ appKey: 'demands', row: { ...demand, demand_status: '已下单' }, canPushDemand: true }), [])
assert.deepEqual(buildPurchaseRowActions({ appKey: 'demands', row: demand, canPushDemand: false }), [])

const orderActions = buildPurchaseRowActions({ appKey: 'orders', row: order, canPushOrder: true })
assert.equal(orderActions[0].key, 'push-order-arrival')
assert.equal(orderActions[0].label, '到货')
assert.deepEqual(buildPurchaseRowActions({ appKey: 'orders', row: { ...order, arrival_progress: '已到齐' }, canPushOrder: true }), [])

const arrivalActions = buildPurchaseRowActions({ appKey: 'arrivals', row: arrival, canPushArrival: true })
assert.equal(arrivalActions[0].key, 'push-arrival-inbound')
assert.equal(arrivalActions[0].type, 'warning')
assert.deepEqual(buildPurchaseRowActions({ appKey: 'arrivals', row: { ...arrival, iqc_status: '不合格' }, canPushArrival: true }), [])
assert.deepEqual(buildPurchaseRowActions({ appKey: 'suppliers', row: demand }), [])
assert.deepEqual(buildPurchaseRowActions({ appKey: 'demands', row: null }), [])

assert.deepEqual(getPurchaseFlowDialogConfig('purchase_order'), {
  mode: 'demands',
  emptyMessage: '请先在表格中选择要下推的采购需求',
  invalidMessage: '已下单、已关闭或已锁定的采购需求不能下推采购订单',
  permissionMessage: '当前账号没有下推采购订单权限'
})
assert.equal(getPurchaseFlowDialogConfig('missing'), null)

assert.deepEqual(buildPurchaseToolbarFlowPlan({ nextStep: 'purchase_order', rows: [] }), {
  ok: false, message: '请先在表格中选择要下推的采购需求'
})
assert.deepEqual(buildPurchaseToolbarFlowPlan({
  nextStep: 'purchase_order', rows: [{ ...demand, demand_status: '已下单' }]
}), { ok: false, message: '已下单、已关闭或已锁定的采购需求不能下推采购订单' })
assert.deepEqual(buildPurchaseToolbarFlowPlan({ nextStep: 'purchase_order', rows: [demand] }), {
  ok: true, nextStep: 'purchase_order', mode: 'demands', rows: [demand]
})

// Toolbar compatibility: order/arrival validation remains deferred until confirm, matching the old page.
const closedOrder = { ...order, order_status: '已完成' }
assert.deepEqual(buildPurchaseToolbarFlowPlan({ nextStep: 'purchase_arrival', rows: [closedOrder] }), {
  ok: true, nextStep: 'purchase_arrival', mode: 'orders', rows: [closedOrder]
})
const rejectedArrival = { ...arrival, iqc_status: '不合格' }
assert.deepEqual(buildPurchaseToolbarFlowPlan({ nextStep: 'inventory_inbound', rows: [rejectedArrival] }), {
  ok: true, nextStep: 'inventory_inbound', mode: 'arrivals', rows: [rejectedArrival]
})
assert.deepEqual(buildPurchaseToolbarFlowPlan({ nextStep: 'missing', rows: [demand] }), {
  ok: false, message: '请选择要下推的下一流程'
})

assert.deepEqual(buildPurchaseRowFlowPlan({ nextStep: 'purchase_order', row: demand, permitted: false }), {
  ok: false, message: '当前账号没有下推采购订单权限'
})
assert.deepEqual(buildPurchaseRowFlowPlan({
  nextStep: 'purchase_arrival', row: closedOrder, permitted: true
}), { ok: false, message: '该采购订单当前状态不能登记到货' })
assert.deepEqual(buildPurchaseRowFlowPlan({
  nextStep: 'inventory_inbound', row: rejectedArrival, permitted: true
}), { ok: false, message: '该到货单已入库、异常或不合格，不能直接入库' })
assert.deepEqual(buildPurchaseRowFlowPlan({ nextStep: 'purchase_arrival', row: order, permitted: true }), {
  ok: true, nextStep: 'purchase_arrival', mode: 'orders', rows: [order]
})
assert.deepEqual(buildPurchaseRowFlowPlan({ nextStep: 'missing', row: order, permitted: true }), {
  ok: false, silent: true
})

assert.equal(getPurchaseFlowNextStepForAction('push-demand-order'), 'purchase_order')
assert.equal(getPurchaseFlowNextStepForAction('push-order-arrival'), 'purchase_arrival')
assert.equal(getPurchaseFlowNextStepForAction('push-arrival-inbound'), 'inventory_inbound')
assert.equal(getPurchaseFlowNextStepForAction('unknown'), '')
assert.equal(getPurchaseFlowPermission({ nextStep: 'purchase_order', canPushDemand: 1 }), true)
assert.equal(getPurchaseFlowPermission({ nextStep: 'purchase_arrival', canPushOrder: 0 }), false)
assert.equal(getPurchaseFlowPermission({ nextStep: 'inventory_inbound', canPushArrival: true }), true)
assert.equal(getPurchaseFlowPermission({ nextStep: 'missing', canPushDemand: true }), false)

assert.deepEqual(parsePurchaseRealtimePayload({ payload: '{"schema":"public","table":"purchase_orders"}' }), {
  schema: 'public', table: 'purchase_orders'
})
const objectPayload = { schema: 'public', table: 'purchase_arrivals' }
assert.equal(parsePurchaseRealtimePayload({ payload: objectPayload }), objectPayload)
assert.equal(parsePurchaseRealtimePayload({ payload: '{bad' }), null)
assert.equal(parsePurchaseRealtimePayload({ payload: 1 }), null)
assert.equal(parsePurchaseRealtimePayload(null), null)
assert.equal(shouldReloadPurchaseRealtimeEvent({ payload: objectPayload }, '/purchase_arrivals?select=*'), true)
assert.equal(shouldReloadPurchaseRealtimeEvent({ payload: { ...objectPayload, schema: 'scm' } }, '/purchase_arrivals'), false)
assert.equal(shouldReloadPurchaseRealtimeEvent({ payload: objectPayload }, '/purchase_orders'), false)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-purchase/src/domain/purchase-grid-operation-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request', 'axios', 'window.', 'document.', 'localStorage', 'Date.now', 'Math.random']) {
  assert.equal(moduleSource.includes(forbidden), false, `purchase grid operation policy gained runtime dependency: ${forbidden}`)
}
assert.match(moduleSource, /from ['"]\.\/purchase-grid-flow-policy\.js['"]/)

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-purchase/src/components/PurchaseAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-grid-operation-policy['"]/)
for (const removedDefinition of [
  "key: 'push-demand-order'",
  "key: 'push-order-arrival'",
  "key: 'push-arrival-inbound'",
  'const parseRealtimePayload =',
  "ElMessage.warning('当前账号没有登记到货权限')"
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `PurchaseAppGrid reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildPurchaseRowActions({',
  'buildPurchaseToolbarFlowPlan({',
  'buildPurchaseRowFlowPlan({ nextStep, row, permitted })',
  'getPurchaseFlowNextStepForAction(action.key)',
  'shouldReloadPurchaseRealtimeEvent(event, app.value.apiUrl)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseAppGrid lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1970)

console.log('PASS: PurchaseAppGrid operation policy preserves row actions, dialog validation and realtime reloads')
