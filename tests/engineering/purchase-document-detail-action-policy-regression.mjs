// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseDocumentActionAvailability,
  buildPurchaseDocumentBusinessActions,
  buildPurchaseDocumentPermissionKeys
} from '../../eiscore-purchase/src/domain/purchase-document-detail-action-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const enabledKeys = (availability) => Object.entries(availability)
  .filter(([, enabled]) => enabled)
  .map(([key]) => key)

const defaultPermissionKeys = buildPurchaseDocumentPermissionKeys()
assert.deepEqual(defaultPermissionKeys, {
  edit: undefined,
  reviewSupplier: 'op:purchase_supplier.review',
  pauseSupplier: 'op:purchase_supplier.pause',
  resumeSupplier: 'op:purchase_supplier.resume',
  createOrder: 'op:purchase_demand.create_order',
  submitDemand: 'op:purchase_demand.submit',
  closeDemand: 'op:purchase_demand.close',
  reopenDemand: 'op:purchase_demand.reopen',
  registerArrival: 'op:purchase_order.register_arrival',
  confirmOrder: 'op:purchase_order.confirm',
  cancelOrder: 'op:purchase_order.cancel',
  confirmInbound: 'op:purchase_arrival.confirm_inbound',
  markException: 'op:purchase_arrival.mark_exception'
})
assert.deepEqual(buildPurchaseDocumentPermissionKeys({
  ops: { edit: 'custom.edit' },
  businessOps: { reviewSupplier: 'custom.review', createOrder: 'custom.order' }
}), {
  ...defaultPermissionKeys,
  edit: 'custom.edit',
  reviewSupplier: 'custom.review',
  createOrder: 'custom.order'
})

const allPermissions = Object.fromEntries(Object.keys(defaultPermissionKeys).map(key => [key, true]))
const availability = (appKey, row, permissions = allPermissions) => (
  buildPurchaseDocumentActionAvailability({ appKey, row, permissions })
)

assert.deepEqual(enabledKeys(availability('suppliers', {
  id: 1, supplier_status: '待评审', status: 'active'
})), ['reviewSupplier', 'pauseSupplier'])
assert.deepEqual(enabledKeys(availability('suppliers', {
  id: 1, supplier_status: '暂停合作', status: 'active'
})), ['resumeSupplier'])
assert.deepEqual(enabledKeys(availability('suppliers', {
  id: 1, supplier_status: '待评审', status: 'disabled'
})), ['resumeSupplier'])
assert.deepEqual(enabledKeys(availability('suppliers', {
  id: 1, supplier_status: '待评审', status: 'active'
}, { ...allPermissions, reviewSupplier: false })), ['pauseSupplier'])
assert.deepEqual(enabledKeys(availability('suppliers', null)), [])

assert.deepEqual(enabledKeys(availability('demands', {
  id: 2, demand_status: '草稿', status: 'draft'
})), ['submitDemand', 'createOrder', 'closeDemand', 'related'])
assert.deepEqual(enabledKeys(availability('demands', {
  id: 2, demand_status: '已下单', status: 'active'
})), ['related'])
assert.deepEqual(enabledKeys(availability('demands', {
  id: 2, demand_status: '已关闭', status: 'active'
})), ['reopenDemand', 'related'])
assert.deepEqual(enabledKeys(availability('demands', {
  id: 2, demand_status: '待采购', status: 'disabled'
})), ['reopenDemand', 'related'])
assert.deepEqual(enabledKeys(availability('demands', null)), ['related'])

assert.deepEqual(enabledKeys(availability('orders', {
  id: 3, order_status: '草稿', status: 'draft', arrived_quantity: 0
})), ['confirmOrder', 'cancelOrder', 'related'])
assert.deepEqual(enabledKeys(availability('orders', {
  id: 3, order_status: '已下单', status: 'active', arrived_quantity: 0
})), ['cancelOrder', 'registerArrival', 'related'])
assert.deepEqual(enabledKeys(availability('orders', {
  id: 3, order_status: '部分到货', status: 'active', arrived_quantity: '2'
})), ['registerArrival', 'related'])
assert.deepEqual(enabledKeys(availability('orders', {
  id: 3, order_status: '部分到货', status: 'active', arrival_progress: '已到齐'
})), ['cancelOrder', 'related'])
// Compatibility: the existing detail page did not apply locked/disabled to confirm-order eligibility.
assert.equal(availability('orders', {
  id: 3, order_status: '草稿', status: 'locked'
}).confirmOrder, true)
assert.deepEqual(enabledKeys(availability('orders', null)), ['related'])

assert.deepEqual(enabledKeys(availability('arrivals', {
  id: 4, arrival_status: '待检验', iqc_status: '待检', status: 'active'
})), ['linkArrival', 'confirmInbound', 'markException'])
assert.deepEqual(enabledKeys(availability('arrivals', {
  id: 4, order_id: 3, arrival_status: '待检验', iqc_status: '待检', status: 'active'
})), ['confirmInbound', 'markException'])
assert.deepEqual(enabledKeys(availability('arrivals', {
  id: 4, arrival_status: '待检验', iqc_status: '不合格', status: 'active'
})), ['markException'])
assert.deepEqual(enabledKeys(availability('arrivals', {
  id: 4, arrival_status: '已入库', iqc_status: '合格', status: 'active'
})), [])
assert.deepEqual(enabledKeys(availability('arrivals', null)), [])
assert.deepEqual(enabledKeys(availability('unknown', { id: 5 })), [])

const handler = () => 'handled'
const handlers = Object.fromEntries([
  'reviewSupplier', 'pauseSupplier', 'resumeSupplier', 'submitDemand', 'createOrder',
  'closeDemand', 'reopenDemand', 'confirmOrder', 'cancelOrder', 'registerArrival',
  'linkArrival', 'confirmInbound', 'markException', 'related'
].map(key => [key, handler]))
const allActions = buildPurchaseDocumentBusinessActions({
  appKey: 'demands',
  availability: Object.fromEntries(Object.keys(handlers).map(key => [key, true])),
  handlers
})
assert.deepEqual(allActions.map(action => action.key), Object.keys(handlers))
assert.equal(allActions[0].label, '完成评审')
assert.equal(allActions[0].type, 'primary')
assert.equal(allActions[0].plain, false)
assert.equal(allActions[0].handler, handler)
assert.equal(allActions[0].sopAction, 'purchase-detail-reviewSupplier')
assert.equal(allActions[0].sopTitle, '供应商完成评审')
assert.match(allActions[0].sopSteps, /确认供应商名称.*\|.*回到供应商表格复核供应商状态/)
assert.match(allActions[0].sopRisk, /资质、风险和审批记录/)
assert.equal(allActions.find(action => action.key === 'pauseSupplier').plain, undefined)
assert.equal(allActions.at(-1).label, '查看采购订单')
assert.equal(buildPurchaseDocumentBusinessActions({
  appKey: 'orders', availability: { related: true }, handlers
})[0].label, '查看到货跟踪')
assert.deepEqual(buildPurchaseDocumentBusinessActions(), [])

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-action-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'",
  'element-plus',
  'request',
  'axios',
  'fetch(',
  'window.',
  'document.',
  'localStorage',
  'sessionStorage',
  'Date.now',
  'Math.random',
  'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `purchase document action policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-action-policy\.js['"]/) 
for (const removedDefinition of [
  'const detailBusinessActionSopMap =',
  'const canReviewSupplier = computed',
  'const canRegisterArrival = computed',
  "sopAction: `purchase-detail-${action.key}`"
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `PurchaseDocumentDetail reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildPurchaseDocumentPermissionKeys({',
  'buildPurchaseDocumentActionAvailability({',
  'buildPurchaseDocumentBusinessActions({',
  'reviewSupplier,',
  'registerArrival: registerArrivalFromOrder,',
  'related: goRelatedApp'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2140)

console.log('PASS: PurchaseDocumentDetail action policy preserves permissions, status eligibility, action order and SOP metadata')
