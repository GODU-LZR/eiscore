// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertPurchaseArrivalFlowSource,
  assertPurchaseDemandFlowSource,
  assertPurchaseOrderFlowSource,
  assertPurchaseOrderQuantity,
  buildPurchaseActiveSourceLinkQuery,
  buildPurchaseArrivalInboundPlan,
  buildPurchaseDemandOrderCompletion,
  buildPurchaseDemandOrderDraft,
  buildPurchaseDocumentLinkPayload,
  buildPurchaseFlowAuditPayload,
  buildPurchaseFlowView,
  buildPurchaseOrderActivationUpdate,
  buildPurchaseOrderArrivalCompletion,
  buildPurchaseOrderArrivalDraft,
  calculatePurchaseOrderPendingQuantity,
  encodePurchaseFilterValue,
  getPurchaseOrderPendingQuantityHint,
  isPurchaseArrivalPushable,
  isPurchaseDemandPushable,
  isPurchaseOrderPushable,
  pickPurchaseRowByLinkTarget,
  projectPurchaseInboundFromLink,
  PURCHASE_FLOW_DOC_TYPES,
  PURCHASE_FLOW_RELATION_TYPES,
  selectPurchaseFlowRows
} from '../../eiscore-purchase/src/domain/purchase-grid-flow-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const demand = {
  id: 11,
  demand_no: 'PD-11',
  demand_status: '待采购',
  status: 'active',
  preferred_supplier: '供应商A',
  material_name: '轴承',
  quantity: '12.5',
  unit: '件',
  required_date: '2026-09-10',
  requester_name: '李四',
  source_dept: '生产部',
  properties: { keep: true, source_order_no: 'SO-1' }
}
const order = {
  id: 22,
  order_no: 'PO-22',
  order_status: '草稿',
  status: 'draft',
  source_demand_no: 'PD-11',
  supplier_id: 3,
  supplier_name: '供应商A',
  material_name: '轴承',
  quantity: 12.5,
  unit: '件',
  properties: { keep: true }
}
const arrival = {
  id: 33,
  arrival_no: 'PA-33',
  order_id: 22,
  order_no: 'PO-22',
  arrival_status: '待检验',
  iqc_status: '让步接收',
  status: 'active',
  material_name: '轴承',
  arrival_quantity: 10,
  accepted_quantity: 8,
  unit: '件'
}

assert.equal(PURCHASE_FLOW_DOC_TYPES.PURCHASE_DEMAND, 'purchase_demand')
assert.equal(PURCHASE_FLOW_RELATION_TYPES.ARRIVAL_TO_INBOUND, 'arrival_to_inbound')
assert.equal(isPurchaseDemandPushable(demand), true)
assert.equal(isPurchaseDemandPushable({ ...demand, demand_status: '已下单' }), false)
assert.equal(isPurchaseDemandPushable({ ...demand, status: 'disabled' }), false)
assert.equal(isPurchaseOrderPushable(order), true)
assert.equal(isPurchaseOrderPushable({ ...order, order_status: '已完成' }), false)
assert.equal(isPurchaseOrderPushable({ ...order, arrival_progress: '已到齐' }), false)
assert.equal(isPurchaseOrderPushable({ ...order, status: 'deleted' }), false)
assert.equal(isPurchaseArrivalPushable(arrival), true)
assert.equal(isPurchaseArrivalPushable({ ...arrival, arrival_status: '已入库' }), false)
assert.equal(isPurchaseArrivalPushable({ ...arrival, iqc_status: '不合格' }), false)
assert.equal(isPurchaseArrivalPushable({ ...arrival, status: 'locked' }), false)
assert.throws(() => assertPurchaseDemandFlowSource({ ...demand, id: null }), /缺少主键/)
assert.throws(() => assertPurchaseOrderFlowSource({ ...order, order_status: '已取消' }), /状态不能下推/)
assert.throws(() => assertPurchaseArrivalFlowSource({ ...arrival, arrival_status: '异常' }), /不能直接入库/)
assert.equal(assertPurchaseOrderQuantity(order), 12.5)
assert.throws(() => assertPurchaseOrderQuantity({ ...order, quantity: 0 }), /数量必须大于 0/)

assert.deepEqual(selectPurchaseFlowRows([demand, { demand_no: 'PD-X' }, {}, null], 'demands'), [demand, { demand_no: 'PD-X' }])
assert.deepEqual(selectPurchaseFlowRows([order, { order_no: 'PO-X' }, {}], 'orders'), [order, { order_no: 'PO-X' }])
assert.deepEqual(selectPurchaseFlowRows([arrival, { arrival_no: 'PA-X' }, {}], 'arrivals'), [arrival, { arrival_no: 'PA-X' }])
assert.equal(encodePurchaseFilterValue('A B/1'), 'A%20B%2F1')
assert.equal(buildPurchaseActiveSourceLinkQuery('purchase order', 22, 'PO/22'),
  'source_doc_type=eq.purchase%20order&status=eq.active&or=(source_doc_id.eq.22,source_doc_no.eq.PO%2F22)&order=created_at.asc')
assert.equal(buildPurchaseActiveSourceLinkQuery('purchase_order', null, null),
  'source_doc_type=eq.purchase_order&status=eq.active&order=created_at.asc')

const link = { target_doc_id: 2, target_doc_no: 'PO-2', status: 'active' }
const linkedRows = [{ id: 1, order_no: 'PO-1' }, { id: 2, order_no: 'PO-X' }]
assert.equal(pickPurchaseRowByLinkTarget(linkedRows, link, 'order_no'), linkedRows[1])
assert.equal(pickPurchaseRowByLinkTarget(linkedRows, { target_doc_no: 'PO-1' }, 'order_no'), linkedRows[0])
assert.equal(pickPurchaseRowByLinkTarget([], link, 'order_no'), null)
assert.deepEqual(projectPurchaseInboundFromLink({ target_doc_id: 9, target_doc_no: 'IN-9', status: 'active' }), {
  id: 9, inbound_no: 'IN-9', docNo: 'IN-9', status: '已入库'
})
assert.equal(projectPurchaseInboundFromLink(null), null)

const source = { docType: 'purchase_demand', docId: 11, docNo: 'PD-11' }
const target = { docType: 'purchase_order', docId: 22, docNo: 'PO-22' }
assert.deepEqual(buildPurchaseDocumentLinkPayload({ source, target, relationType: 'demand_to_order', quantity: 12.5 }), {
  source_doc_type: 'purchase_demand', source_doc_id: 11, source_doc_no: 'PD-11',
  target_doc_type: 'purchase_order', target_doc_id: 22, target_doc_no: 'PO-22',
  relation_type: 'demand_to_order', quantity: 12.5, amount: null, status: 'active', payload: {}
})
assert.deepEqual(buildPurchaseFlowAuditPayload({ actionType: 'push', source, target, payload: { x: 1 } }), {
  action_type: 'push', source_doc_type: 'purchase_demand', source_doc_id: 11, source_doc_no: 'PD-11',
  target_doc_type: 'purchase_order', target_doc_id: 22, target_doc_no: 'PO-22', reason: '',
  actor_username: 'purchase', payload: { x: 1 }
})

const docs = {
  purchaseDemand: demand,
  purchaseOrder: { ...order, order_status: '已下单' },
  purchaseArrival: arrival,
  inventoryInbound: { inbound_no: 'IN-1', status: '已入库' }
}
const demandView = buildPurchaseFlowView({ appKey: 'demands', demand, docs })
assert.equal(demandView.dialogTitle, '采购需求业务流程')
assert.equal(demandView.primaryDocNo, 'PD-11')
assert.equal(demandView.previousDocNo, 'SO-1')
assert.equal(demandView.downstream.docNo, 'PO-22')
assert.equal(demandView.nodes.length, 5)
assert.equal(demandView.nodes[1].current, true)
assert.equal(demandView.primarySummary, '轴承 / 12.5 件')
const orderView = buildPurchaseFlowView({ appKey: 'orders', demand, order, docs })
assert.equal(orderView.selectedLabel, '已选择采购订单')
assert.deepEqual(orderView.nextStepOptions, [{ label: '到货跟踪', value: 'purchase_arrival' }])
assert.equal(orderView.previousDocNo, 'PD-11')
assert.equal(orderView.downstream.docNo, 'PA-33')
const arrivalView = buildPurchaseFlowView({ appKey: 'arrivals', demand, order, arrival, docs })
assert.equal(arrivalView.confirmButtonType, 'warning')
assert.equal(arrivalView.primaryLabel, '首个待入库到货单')
assert.equal(arrivalView.previousDocNo, 'PO-22')
assert.equal(arrivalView.downstream.docNo, 'IN-1')
assert.equal(arrivalView.primarySummary, '轴承 / 10 件')

const supplier = { id: 3, name: '供应商A', buyer_name: '王五', lead_time_days: 7 }
const orderPayload = buildPurchaseDemandOrderDraft({
  demand, supplier, orderNo: 'PO-NEW', orderDate: '2026-09-01'
})
assert.deepEqual(orderPayload, {
  order_no: 'PO-NEW', demand_id: 11, source_demand_no: 'PD-11', supplier_id: 3,
  supplier_name: '供应商A', material_name: '轴承', quantity: 12.5, unit: '件', unit_price: 0,
  total_amount: 0, order_date: '2026-09-01', expected_arrival_date: '2026-09-10', buyer_name: '王五',
  order_status: '草稿', status: 'draft',
  properties: { source_dept: '生产部', supplier_lead_time_days: 7, source_demand_id: 11, source_sales_order_no: 'SO-1' }
})
assert.throws(() => buildPurchaseDemandOrderDraft({ demand: { ...demand, quantity: 0 } }), /数量必须大于 0/)
const orderCompletion = buildPurchaseDemandOrderCompletion({
  demand,
  order: { id: 44, order_no: 'PO-SERVER' },
  orderPayload,
  pushedAt: '2026-09-01T01:00:00.000Z'
})
assert.equal(orderCompletion.demandUpdate.properties.keep, true)
assert.equal(orderCompletion.demandUpdate.properties.purchase_order_no, 'PO-SERVER')
assert.equal(orderCompletion.documentLink.relationType, 'demand_to_order')
assert.deepEqual(orderCompletion.audit.payload, { material_name: '轴承', quantity: 12.5 })

assert.deepEqual(buildPurchaseOrderActivationUpdate({ order, confirmedAt: '2026-09-01T02:00:00.000Z' }), {
  order_status: '已下单', status: 'active',
  properties: { keep: true, auto_confirmed_before_arrival_at: '2026-09-01T02:00:00.000Z' }
})
assert.equal(getPurchaseOrderPendingQuantityHint({ ...order, pending_quantity: 3 }), 3)
assert.equal(getPurchaseOrderPendingQuantityHint({ ...order, quantity: 0 }), 0)
assert.equal(getPurchaseOrderPendingQuantityHint(order), null)
assert.equal(calculatePurchaseOrderPendingQuantity(order, [{ arrival_quantity: 3 }, { arrival_quantity: '2.5' }]), 7)
assert.equal(calculatePurchaseOrderPendingQuantity({ ...order, pending_quantity: 4 }, [{ arrival_quantity: 9 }]), 4)
assert.equal(calculatePurchaseOrderPendingQuantity(order, [{ arrival_quantity: 20 }]), 0)

const activatedOrder = { ...order, order_status: '已下单', status: 'active' }
const arrivalPayload = buildPurchaseOrderArrivalDraft({
  order: activatedOrder,
  arrivalQuantity: 7,
  arrivalNo: 'PA-NEW',
  arrivalDate: '2026-09-01'
})
assert.deepEqual(arrivalPayload, {
  arrival_no: 'PA-NEW', order_id: 22, order_no: 'PO-22', supplier_id: 3, supplier_name: '供应商A',
  material_name: '轴承', arrival_quantity: 7, accepted_quantity: 0, unit: '件', arrival_date: '2026-09-01',
  iqc_status: '待检', inbound_no: '', arrival_status: '待检验', status: 'active', properties: { source_order_id: 22 }
})
assert.throws(() => buildPurchaseOrderArrivalDraft({ order: activatedOrder, arrivalQuantity: 0 }), /待到货数量必须大于 0/)
const arrivalCompletion = buildPurchaseOrderArrivalCompletion({
  order: activatedOrder,
  arrival: { id: 55, arrival_no: 'PA-SERVER' },
  arrivalPayload
})
assert.equal(arrivalCompletion.documentLink.relationType, 'order_to_arrival')
assert.equal(arrivalCompletion.documentLink.target.docNo, 'PA-SERVER')
assert.deepEqual(arrivalCompletion.audit.payload, { material_name: '轴承', quantity: 7 })

const inboundPlan = buildPurchaseArrivalInboundPlan({ arrival, inboundNo: 'IN-NEW' })
assert.equal(inboundPlan.acceptedQuantity, 8)
assert.deepEqual(inboundPlan.arrivalUpdate, {
  accepted_quantity: 8, iqc_status: '让步接收', inbound_no: 'IN-NEW', arrival_status: '已入库', status: 'active'
})
assert.equal(inboundPlan.documentLink.relationType, 'arrival_to_inbound')
assert.deepEqual(inboundPlan.audit.payload, { material_name: '轴承', quantity: 8 })
assert.equal(buildPurchaseArrivalInboundPlan({
  arrival: { ...arrival, accepted_quantity: 20 }, inboundNo: 'IN-2'
}).acceptedQuantity, 10)
assert.throws(() => buildPurchaseArrivalInboundPlan({
  arrival: { ...arrival, arrival_quantity: 0 }, inboundNo: 'IN-3'
}), /到货数量必须大于 0/)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-purchase/src/domain/purchase-grid-flow-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request({', 'axios', 'window.', 'document.', 'localStorage', 'Date.now', 'Math.random']) {
  assert.equal(moduleSource.includes(forbidden), false, `purchase grid flow policy gained runtime dependency: ${forbidden}`)
}
const pageSource = readFileSync(resolve(repoRoot, 'eiscore-purchase/src/components/PurchaseAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-grid-flow-policy['"]/)
for (const removedDefinition of [
  'const isDemandPushable =', 'const isOrderPushable =', 'const isArrivalPushable =',
  'const activeSourceLinkQuery =', 'const pickFirstByLinkTarget ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `PurchaseAppGrid reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildPurchaseFlowView({', 'buildPurchaseDemandOrderDraft({', 'buildPurchaseDemandOrderCompletion({',
  'buildPurchaseOrderArrivalDraft({', 'buildPurchaseOrderArrivalCompletion({', 'buildPurchaseArrivalInboundPlan({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseAppGrid lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2207)

const utilitySource = readFileSync(resolve(repoRoot, 'eiscore-purchase/src/utils/business-flow.js'), 'utf8')
assert.match(utilitySource, /export const DOC_TYPES = PURCHASE_FLOW_DOC_TYPES/)
assert.match(utilitySource, /export const createDocumentLinkPayload = buildPurchaseDocumentLinkPayload/)

console.log('PASS: PurchaseAppGrid flow policy preserves eligibility, views, links and three push plans')
