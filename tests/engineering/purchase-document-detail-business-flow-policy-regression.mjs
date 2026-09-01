// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseDocumentFlowAuditPayload,
  buildPurchaseDocumentFlowNodes,
  buildPurchaseDocumentLinkQuery,
  buildPurchaseDocumentRowsQuery,
  buildPurchaseInventoryInboundProjection,
  buildPurchaseSalesDemandReversePlan,
  canReversePurchaseSalesDemandFlow,
  encodePurchaseDocumentFilterValue,
  pickPurchaseDocumentRowForLinkSource,
  pickPurchaseDocumentRowForLinkTarget
} from '../../eiscore-purchase/src/domain/purchase-document-detail-business-flow-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(encodePurchaseDocumentFilterValue('采购 订单/1'), '%E9%87%87%E8%B4%AD%20%E8%AE%A2%E5%8D%95%2F1')
assert.equal(buildPurchaseDocumentLinkQuery({
  direction: 'source', docType: 'purchase_demand', docId: 'd 1', docNo: 'REQ/01'
}), 'source_doc_type=eq.purchase_demand&status=eq.active&or=(source_doc_id.eq.d%201,source_doc_no.eq.REQ%2F01)&order=created_at.asc')
assert.equal(buildPurchaseDocumentLinkQuery({
  direction: 'target', docType: '采购订单', docId: '', docNo: ''
}), 'target_doc_type=eq.%E9%87%87%E8%B4%AD%E8%AE%A2%E5%8D%95&status=eq.active&order=created_at.asc')

assert.equal(buildPurchaseDocumentRowsQuery({
  table: 'purchase_orders', noField: 'order_no', ids: ['id 1'], nos: ['PO/01']
}), '/purchase_orders?or=(id.in.(id%201),order_no.in.(PO%2F01))&select=*&limit=50')
assert.equal(buildPurchaseDocumentRowsQuery({ table: 'purchase_orders', noField: 'order_no', ids: ['id 1'], nos: [] }), '/purchase_orders?or=(id.in.(id%201))&select=*&limit=50')
assert.equal(buildPurchaseDocumentRowsQuery({ table: 'purchase_orders', noField: 'order_no', ids: [], nos: [] }), '')

const rows = [
  { id: 'fallback', order_no: 'PO-fallback' },
  { id: 'matched-no', order_no: 'PO-02' },
  { id: 'matched-id', order_no: 'PO-03' }
]
assert.equal(pickPurchaseDocumentRowForLinkSource(rows, { source_doc_id: 'matched-id', source_doc_no: 'PO-02' }, 'order_no').id, 'matched-id')
assert.equal(pickPurchaseDocumentRowForLinkSource(rows, { source_doc_no: 'PO-02' }, 'order_no').id, 'matched-no')
assert.equal(pickPurchaseDocumentRowForLinkSource(rows, { source_doc_id: 'missing', source_doc_no: 'missing' }, 'order_no').id, 'fallback')
assert.equal(pickPurchaseDocumentRowForLinkSource([], null, 'order_no'), null)
assert.equal(pickPurchaseDocumentRowForLinkTarget(rows, { target_doc_id: 'matched-id', target_doc_no: 'PO-02' }, 'order_no').id, 'matched-id')
assert.equal(pickPurchaseDocumentRowForLinkTarget(rows, { target_doc_no: 'PO-02' }, 'order_no').id, 'matched-no')

const flowDocs = {
  salesOrder: { order_no: 'SO-1', order_status: '已确认' },
  purchaseDemand: { demand_no: 'PR-1', demand_status: '待采购' },
  purchaseOrder: { order_no: 'PO-1', order_status: '已下单' },
  purchaseArrival: { arrival_no: 'PA-1', arrival_status: '待检验' },
  inventoryInbound: { inbound_no: 'IN-1', docNo: 'legacy-IN', status: '已入库' }
}
assert.deepEqual(buildPurchaseDocumentFlowNodes({ docs: flowDocs, currentKey: 'orders' }), [
  { key: 'so', type: '销售订单', docNo: 'SO-1', status: '已确认', current: false },
  { key: 'pr', type: '采购需求', docNo: 'PR-1', status: '待采购', current: false },
  { key: 'po', type: '采购订单', docNo: 'PO-1', status: '已下单', current: true },
  { key: 'pa', type: '到货/检验', docNo: 'PA-1', status: '待检验', current: false },
  { key: 'in', type: '采购入库', docNo: 'IN-1', status: '已入库' }
])
assert.equal(canReversePurchaseSalesDemandFlow({ docs: flowDocs, permitted: true }), false)
assert.equal(canReversePurchaseSalesDemandFlow({
  docs: { salesOrder: flowDocs.salesOrder, purchaseDemand: flowDocs.purchaseDemand },
  permitted: true
}), true)
assert.equal(canReversePurchaseSalesDemandFlow({
  docs: { salesOrder: flowDocs.salesOrder, purchaseDemand: flowDocs.purchaseDemand },
  permitted: false
}), false)
assert.deepEqual(buildPurchaseInventoryInboundProjection({
  target_doc_id: 'inbound-1', target_doc_no: 'IN-1', status: 'active'
}), { id: 'inbound-1', inbound_no: 'IN-1', docNo: 'IN-1', status: '已入库' })
assert.deepEqual(buildPurchaseInventoryInboundProjection({
  target_doc_id: 'inbound-2', target_doc_no: 'IN-2', status: 'reversed'
}), { id: 'inbound-2', inbound_no: 'IN-2', docNo: 'IN-2', status: 'reversed' })
assert.equal(buildPurchaseInventoryInboundProjection(null), null)

const demand = { id: 'demand-1', demand_no: 'PR/1', properties: { source: 'sales', audit_status: '旧状态' } }
const salesOrder = { id: 'sales-1', order_no: 'SO-1' }
assert.deepEqual(buildPurchaseSalesDemandReversePlan({
  link: { id: 'link/1' },
  demand,
  salesOrder,
  reason: '重复下推',
  linkReversedAt: '2026-09-02T01:00:00.000Z',
  demandReversedAt: '2026-09-02T01:00:01.000Z',
  docTypes: { SALES_ORDER: 'sales_order', PURCHASE_DEMAND: 'purchase_demand' }
}), {
  linkPatch: {
    url: '/document_links?id=eq.link%2F1',
    data: { status: 'reversed', reversed_by: 'purchase', reversed_at: '2026-09-02T01:00:00.000Z', reverse_reason: '重复下推' }
  },
  demandPatch: {
    url: '/purchase_demands?id=eq.demand-1',
    data: {
      demand_status: '已关闭', status: 'disabled',
      properties: { source: 'sales', audit_status: '已反审核', reverse_audit_reason: '重复下推', reverse_audit_at: '2026-09-02T01:00:01.000Z' }
    }
  },
  audit: {
    actionType: 'reverse_sales_order_purchase_demand',
    source: { docType: 'sales_order', docId: 'sales-1', docNo: 'SO-1' },
    target: { docType: 'purchase_demand', docId: 'demand-1', docNo: 'PR/1' },
    reason: '重复下推'
  }
})
assert.equal(buildPurchaseSalesDemandReversePlan({ demand }).linkPatch, null)
assert.deepEqual(demand.properties, { source: 'sales', audit_status: '旧状态' })

const auditPayload = { material_name: '轴承', quantity: 3 }
assert.deepEqual(buildPurchaseDocumentFlowAuditPayload({
  actionType: 'confirm_arrival_inbound',
  source: { docType: 'purchase_arrival', docId: 'arrival-1', docNo: 'PA-1' },
  target: { docType: 'inventory_inbound', docId: null, docNo: 'IN-1' },
  reason: '质检合格',
  payload: auditPayload
}), {
  action_type: 'confirm_arrival_inbound',
  source_doc_type: 'purchase_arrival', source_doc_id: 'arrival-1', source_doc_no: 'PA-1',
  target_doc_type: 'inventory_inbound', target_doc_id: null, target_doc_no: 'IN-1',
  reason: '质检合格', actor_username: 'admin', payload: auditPayload
})
assert.deepEqual(buildPurchaseDocumentFlowAuditPayload({ actionType: 'empty', actorUsername: 'operator' }), {
  action_type: 'empty',
  source_doc_type: '', source_doc_id: null, source_doc_no: '',
  target_doc_type: '', target_doc_id: null, target_doc_no: '',
  reason: '', actor_username: 'operator', payload: {}
})
assert.deepEqual(auditPayload, { material_name: '轴承', quantity: 3 })

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-business-flow-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `business flow policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-business-flow-policy\.js['"]/) 
for (const removedDefinition of [
  'const safeEq =',
  'const activeSourceLinkQuery =',
  'const activeTargetLinkQuery =',
  'const loadRowsByIdsOrNos =',
  'const pickRowForLinkSource =',
  'const pickRowForLinkTarget ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `PurchaseDocumentDetail reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildPurchaseDocumentLinkQuery({ direction: \'target\'',
  'buildPurchaseDocumentRowsQuery(params)',
  'pickPurchaseDocumentRowForLinkSource',
  'pickPurchaseDocumentRowForLinkTarget',
  'buildPurchaseDocumentFlowNodes({',
  'canReversePurchaseSalesDemandFlow({',
  'buildPurchaseInventoryInboundProjection(inboundLink)',
  'buildPurchaseSalesDemandReversePlan({',
  'buildPurchaseDocumentFlowAuditPayload(params)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1919)

console.log('PASS: PurchaseDocumentDetail business-flow policy preserves queries, projections, reversal plans and audit payloads')
