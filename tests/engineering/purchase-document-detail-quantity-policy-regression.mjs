// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseDetailArrivalDraft,
  buildPurchaseDetailInboundPatch,
  calculatePurchaseDetailPendingArrivalQuantity,
  resolvePurchaseDetailAcceptedQuantity,
  resolvePurchaseDetailLinkedArrivalQuantity
} from '../../eiscore-purchase/src/domain/purchase-document-detail-quantity-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const row = {
  id: 'order-1', order_no: 'PO-1', supplier_id: 'supplier-1', supplier_name: '供应商',
  material_name: '物料', unit: 'kg', iqc_status: '让步接收', properties: { source: 'keep' }
}

assert.equal(calculatePurchaseDetailPendingArrivalQuantity(10, [{ arrival_quantity: 3 }, { arrival_quantity: '2' }]), 5)
assert.equal(calculatePurchaseDetailPendingArrivalQuantity('4', null), 4)
assert.equal(calculatePurchaseDetailPendingArrivalQuantity(2, [{ arrival_quantity: 5 }]), 0)
assert.equal(resolvePurchaseDetailAcceptedQuantity(10, 3), 3)
assert.equal(resolvePurchaseDetailAcceptedQuantity(10, 0), 10)
assert.equal(resolvePurchaseDetailAcceptedQuantity(10, '12'), 10)
assert.equal(resolvePurchaseDetailLinkedArrivalQuantity(5, 2), 5)
assert.equal(resolvePurchaseDetailLinkedArrivalQuantity(0, 2), 2)
assert.equal(resolvePurchaseDetailLinkedArrivalQuantity(null, 0), 1)

assert.deepEqual(buildPurchaseDetailArrivalDraft({
  row, arrivalQuantity: 5, arrivalNo: 'PA-1', arrivalDate: '2026-09-02'
}), {
  arrival_no: 'PA-1', order_id: 'order-1', order_no: 'PO-1', supplier_id: 'supplier-1', supplier_name: '供应商',
  material_name: '物料', arrival_quantity: 5, accepted_quantity: 0, unit: 'kg', arrival_date: '2026-09-02',
  iqc_status: '待检', inbound_no: '', arrival_status: '待检验', status: 'active', properties: { source_order_id: 'order-1' }
})
assert.deepEqual(buildPurchaseDetailInboundPatch({ row, acceptedQuantity: 3, inboundNo: 'IN-1' }), {
  accepted_quantity: 3, iqc_status: '让步接收', inbound_no: 'IN-1', arrival_status: '已入库', status: 'active'
})
assert.deepEqual(buildPurchaseDetailInboundPatch({ row: { iqc_status: '待检' }, acceptedQuantity: 3, inboundNo: 'IN-1' }).iqc_status, '合格')
assert.deepEqual(row.properties, { source: 'keep' })

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-quantity-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `quantity policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-quantity-policy\.js['"]/) 
for (const requiredCall of [
  'calculatePurchaseDetailPendingArrivalQuantity(',
  'resolvePurchaseDetailAcceptedQuantity(',
  'resolvePurchaseDetailLinkedArrivalQuantity(',
  'buildPurchaseDetailArrivalDraft({',
  'buildPurchaseDetailInboundPatch({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1965)

console.log('PASS: PurchaseDocumentDetail quantity policy preserves pending, accepted and linked arrival calculations')
