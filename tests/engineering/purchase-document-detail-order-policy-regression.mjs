// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseOrderDraft,
  buildPurchaseOrderDuplicateQuery
} from '../../eiscore-purchase/src/domain/purchase-document-detail-order-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const row = {
  id: 'demand-1', demand_no: 'REQ/01', preferred_supplier: '默认供应商', material_name: '物料',
  quantity: '12', unit: 'kg', required_date: '2026-09-10', requester_name: '申请人', source_dept: '研发'
}
const supplier = { id: 'supplier-1', name: '合作供应商', buyer_name: '采购员', lead_time_days: 7 }

assert.equal(buildPurchaseOrderDuplicateQuery({ demandId: 'demand-1', demandNo: 'REQ/01' }),
  '/purchase_orders?or=(demand_id.eq.demand-1,source_demand_no.eq.REQ%2F01)&order_status=neq.已取消&status=neq.disabled&select=id,order_no&limit=1')
assert.equal(buildPurchaseOrderDuplicateQuery({ demandId: 'demand-1' }),
  '/purchase_orders?or=(demand_id.eq.demand-1)&order_status=neq.已取消&status=neq.disabled&select=id,order_no&limit=1')

assert.deepEqual(buildPurchaseOrderDraft({ row, supplier, orderNo: 'PO-1', orderDate: '2026-09-02' }), {
  order_no: 'PO-1', demand_id: 'demand-1', source_demand_no: 'REQ/01', supplier_id: 'supplier-1',
  supplier_name: '合作供应商', material_name: '物料', quantity: 12, unit: 'kg', unit_price: 0,
  total_amount: 0, order_date: '2026-09-02', expected_arrival_date: '2026-09-10', buyer_name: '采购员',
  order_status: '草稿', status: 'draft',
  properties: { source_dept: '研发', supplier_lead_time_days: 7, source_demand_id: 'demand-1' }
})
assert.deepEqual(buildPurchaseOrderDraft({
  row: { id: 'demand-2', preferred_supplier: '', quantity: 0 }, orderNo: 'PO-2', orderDate: '2026-09-02'
}), {
  order_no: 'PO-2', demand_id: 'demand-2', source_demand_no: '', supplier_id: null,
  supplier_name: '待选择供应商', material_name: '待录入物料', quantity: 0, unit: 'kg', unit_price: 0,
  total_amount: 0, order_date: '2026-09-02', expected_arrival_date: null, buyer_name: '',
  order_status: '草稿', status: 'draft',
  properties: { source_dept: '', supplier_lead_time_days: null, source_demand_id: 'demand-2' }
})

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-order-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `order policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-order-policy\.js['"]/)
assert.equal(pageSource.includes('buildPurchaseOrderDuplicateQuery({'), true)
assert.equal(pageSource.includes('buildPurchaseOrderDraft({'), true)
assert.equal(pageSource.includes('const duplicateConditions ='), false)
assert.equal(pageSource.includes('const payload = {'), false)
assert.ok(pageSource.split(/\r?\n/).length <= 1951)

console.log('PASS: PurchaseDocumentDetail order policy preserves duplicate detection and draft payload defaults')
