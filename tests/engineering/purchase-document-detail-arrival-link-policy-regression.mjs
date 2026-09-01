// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseArrivalOrderLinkPatch,
  buildPurchaseArrivalOrderLookupQuery,
  selectPurchaseArrivalLinkOrder
} from '../../eiscore-purchase/src/domain/purchase-document-detail-arrival-link-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(buildPurchaseArrivalOrderLookupQuery({ order_no: 'PO/01', material_name: '忽略' }),
  '/v_purchase_order_progress?order_no=eq.PO%2F01&arrival_progress=neq.已到齐&order_status=in.(已下单,部分到货)&status=eq.active&select=id,order_no,supplier_id,supplier_name,material_name,unit,pending_quantity&order=expected_arrival_date.asc&limit=1')
assert.equal(buildPurchaseArrivalOrderLookupQuery({ material_name: '轴 承' }),
  '/v_purchase_order_progress?material_name=eq.%E8%BD%B4%20%E6%89%BF&arrival_progress=neq.已到齐&order_status=in.(已下单,部分到货)&status=eq.active&select=id,order_no,supplier_id,supplier_name,material_name,unit,pending_quantity&order=expected_arrival_date.asc&limit=1')
assert.equal(selectPurchaseArrivalLinkOrder([{ id: 'order-1' }, { id: 'order-2' }]).id, 'order-1')
assert.equal(selectPurchaseArrivalLinkOrder([]), null)
assert.equal(selectPurchaseArrivalLinkOrder(null), null)

const row = {
  supplier_name: '原供应商', material_name: '原物料', unit: '件',
  properties: { source: 'manual', source_order_id: 'old' }
}
assert.deepEqual(buildPurchaseArrivalOrderLinkPatch({
  row,
  order: { id: 'order-1', order_no: 'PO-1', supplier_id: 'supplier-1', supplier_name: '新供应商', material_name: '新物料', unit: 'kg' },
  arrivalQuantity: 8,
  linkedAt: '2026-09-02T00:00:00.000Z'
}), {
  order_id: 'order-1', order_no: 'PO-1', supplier_id: 'supplier-1', supplier_name: '新供应商',
  material_name: '新物料', unit: 'kg', arrival_quantity: 8,
  properties: { source: 'manual', source_order_id: 'order-1', linked_order_at: '2026-09-02T00:00:00.000Z' }
})
assert.deepEqual(buildPurchaseArrivalOrderLinkPatch({
  row: { supplier_name: '', material_name: '', unit: '', properties: null },
  order: { id: 'order-2', order_no: 'PO-2' },
  arrivalQuantity: 1,
  linkedAt: 'now'
}), {
  order_id: 'order-2', order_no: 'PO-2', supplier_id: null, supplier_name: '待选择供应商',
  material_name: '待录入物料', unit: 'kg', arrival_quantity: 1,
  properties: { source_order_id: 'order-2', linked_order_at: 'now' }
})
assert.deepEqual(row.properties, { source: 'manual', source_order_id: 'old' })

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-arrival-link-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `arrival link policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-arrival-link-policy\.js['"]/)
for (const requiredCall of [
  'buildPurchaseArrivalOrderLookupQuery(row.value)',
  'selectPurchaseArrivalLinkOrder(orders)',
  'buildPurchaseArrivalOrderLinkPatch({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.equal(pageSource.includes('const query = row.value.order_no'), false)
assert.ok(pageSource.split(/\r?\n/).length <= 1945)

console.log('PASS: PurchaseDocumentDetail arrival link policy preserves lookup priority, first-match selection and patch fallbacks')
