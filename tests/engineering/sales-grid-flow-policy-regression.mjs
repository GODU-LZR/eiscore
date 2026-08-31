// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  SALES_FLOW_DOC_TYPES,
  SALES_FLOW_RELATION_TYPES,
  assertSalesOrderFlowSource,
  buildSalesFlowNodes,
  buildSalesOrderPropertiesPatch,
  buildSalesOutboundPlan,
  buildSalesPurchaseDemandCompletion,
  buildSalesPurchaseDemandPlan,
  buildSalesShipmentRequestPlan,
  getSalesFlowDownstreamState,
  getSalesOrderSourceDoc,
  projectSalesOutboundLink,
  projectSalesShipmentLink
} from '../../eiscore-sales/src/domain/sales-grid-flow-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const order = {
  id: 42,
  order_no: 'SO-42',
  order_status: '草稿',
  quantity: '12',
  total_amount: '345.6',
  customer_name: '客户A',
  product_name: '产品A',
  product_material_id: 7,
  unit: '件',
  delivery_date: '2026-09-10',
  owner_name: '张三',
  properties: { product_material_code: 'MAT-7', audit_status: '待审核', keep: true }
}

assert.deepEqual(SALES_FLOW_DOC_TYPES, {
  SALES_ORDER: 'sales_order',
  PURCHASE_DEMAND: 'purchase_demand',
  PURCHASE_ORDER: 'purchase_order',
  PURCHASE_ARRIVAL: 'purchase_arrival',
  INVENTORY_INBOUND: 'inventory_inbound',
  SALES_SHIPMENT: 'sales_shipment',
  INVENTORY_OUTBOUND: 'inventory_outbound'
})
assert.equal(SALES_FLOW_RELATION_TYPES.SALES_TO_OUTBOUND, 'sales_to_outbound')
assert.deepEqual(getSalesOrderSourceDoc(order), { docType: 'sales_order', docId: 42, docNo: 'SO-42' })
assert.deepEqual(getSalesOrderSourceDoc(null), { docType: 'sales_order', docId: null, docNo: '' })
assert.equal(assertSalesOrderFlowSource(order, '销售出库'), order)
assert.throws(() => assertSalesOrderFlowSource(null, '销售出库'), /销售订单缺少主键，不能下推销售出库/)
assert.throws(() => assertSalesOrderFlowSource({ id: 1, order_no: 'SO-X', status: 'deleted' }), /销售订单 SO-X 已取消或已删除/)

assert.deepEqual(projectSalesShipmentLink({
  target_doc_id: 10,
  target_doc_no: 'SHIP-1',
  payload: { status: '已确认', extra: 1 }
}), {
  id: 10,
  shipment_no: 'SHIP-1',
  docNo: 'SHIP-1',
  status: '已确认',
  payload: { status: '已确认', extra: 1 }
})
assert.equal(projectSalesShipmentLink(null), null)
assert.equal(projectSalesShipmentLink({}).status, '待仓储确认')
assert.deepEqual(projectSalesOutboundLink({ target_doc_id: 11, target_doc_no: 'SOUT-1' }), {
  id: 11,
  outbound_no: 'SOUT-1',
  docNo: 'SOUT-1',
  status: '待仓储补录'
})
assert.equal(projectSalesOutboundLink(null), null)

const docs = {
  purchaseDemand: { demand_no: 'PR-1', demand_status: '待采购' },
  purchaseOrder: { order_no: 'PO-1', order_status: '已确认' },
  purchaseArrival: { arrival_no: 'PA-1', arrival_status: '已到货' },
  inventoryInbound: { docNo: 'IN-1', status: '已入库' },
  salesShipment: { docNo: 'SHIP-1', status: '待仓储确认' },
  salesOutbound: { outbound_no: 'OUT-1', status: '已出库' }
}
assert.deepEqual(buildSalesFlowNodes({ order, docs }).map(({ key, docNo, status }) => ({ key, docNo, status })), [
  { key: 'so', docNo: 'SO-42', status: '草稿' },
  { key: 'pr', docNo: 'PR-1', status: '待采购' },
  { key: 'po', docNo: 'PO-1', status: '已确认' },
  { key: 'pa', docNo: 'PA-1', status: '已到货' },
  { key: 'in', docNo: 'IN-1', status: '已入库' },
  { key: 'ship', docNo: 'SHIP-1', status: '待仓储确认' },
  { key: 'out', docNo: 'OUT-1', status: '已出库' }
])
assert.deepEqual(getSalesFlowDownstreamState({ nextStep: 'shipment_request', docs }), {
  label: '下游出货申请', docNo: 'SHIP-1', status: '待仓储确认', buttonType: 'warning'
})
assert.deepEqual(getSalesFlowDownstreamState({ nextStep: 'sales_outbound' }), {
  label: '下游销售出库', docNo: '未生成', status: '可生成出库链路', buttonType: 'warning'
})
assert.deepEqual(getSalesFlowDownstreamState({ nextStep: 'purchase_demand' }), {
  label: '下游采购需求', docNo: '未生成', status: '可下推生成', buttonType: 'success'
})

assert.deepEqual(buildSalesOrderPropertiesPatch(order, { keep: false, added: 1 }, '已确认'), {
  properties: { product_material_code: 'MAT-7', audit_status: '待审核', keep: false, added: 1 },
  order_status: '已确认'
})

const shipmentPlan = buildSalesShipmentRequestPlan({
  order,
  shipmentNo: 'SHIP-42',
  pushedAt: '2026-09-01T00:00:00.000Z'
})
assert.deepEqual(shipmentPlan.documentLink, {
  source: { docType: 'sales_order', docId: 42, docNo: 'SO-42' },
  target: { docType: 'sales_shipment', docId: null, docNo: 'SHIP-42' },
  relationType: 'sales_to_shipment_request',
  quantity: 12,
  amount: 345.6,
  payload: {
    status: '待仓储确认',
    customer_name: '客户A',
    product_name: '产品A',
    product_material_id: 7,
    product_material_code: 'MAT-7',
    unit: '件',
    delivery_date: '2026-09-10'
  }
})
assert.deepEqual(shipmentPlan.audit.payload, { quantity: 12, customer_name: '客户A', product_name: '产品A' })
assert.equal(shipmentPlan.orderPatch.workflow_key, 'sales_to_shipment_outbound')
assert.deepEqual(shipmentPlan.shipment, { shipment_no: 'SHIP-42', status: '待仓储确认' })

const shipment = { id: 55, shipment_no: 'SHIP-42' }
const outboundPlan = buildSalesOutboundPlan({
  order,
  shipment,
  outboundNo: 'SOUT-42',
  pushedAt: '2026-09-01T00:01:00.000Z'
})
assert.equal(outboundPlan.shipmentLink.relationType, 'shipment_request_to_sales_outbound')
assert.deepEqual(outboundPlan.shipmentLink.source, { docType: 'sales_shipment', docId: 55, docNo: 'SHIP-42' })
assert.equal(outboundPlan.shipmentLink.payload.sales_order_id, 42)
assert.equal(outboundPlan.directLink.relationType, 'sales_to_outbound')
assert.deepEqual(outboundPlan.directLink.payload, { status: '待仓储补录', io_type: '销售出库', shipment_no: 'SHIP-42' })
assert.deepEqual(outboundPlan.audit.payload, { quantity: 12, io_type: '销售出库', customer_name: '客户A', product_name: '产品A' })
assert.equal(outboundPlan.nextOrderStatus, '已确认')
assert.deepEqual(outboundPlan.outbound, { outbound_no: 'SOUT-42', status: '待仓储补录' })

const demandPlan = buildSalesPurchaseDemandPlan({ order, demandNo: 'PR-42' })
assert.equal(demandPlan.quantity, 12)
assert.deepEqual(demandPlan.demandPayload, {
  demand_no: 'PR-42',
  material_no: 'MAT-7',
  material_name: '产品A',
  quantity: 12,
  unit: '件',
  required_date: '2026-09-10',
  source_dept: '销售订单',
  requester_name: '张三',
  preferred_supplier: '',
  demand_status: '待采购',
  status: 'active',
  properties: {
    source_type: 'sales_order',
    source_order_id: 42,
    source_order_no: 'SO-42',
    source_order_nos: 'SO-42',
    audit_status: '未提交',
    workflow_status: 'not_started',
    workflow_key: 'sales_to_purchase_inbound',
    customer_name: '客户A',
    product_name: '产品A',
    product_material_id: 7,
    product_material_code: 'MAT-7'
  }
})
const demandCompletion = buildSalesPurchaseDemandCompletion({
  order,
  demand: { id: 99, demand_no: 'PR-SERVER' },
  demandPayload: demandPlan.demandPayload,
  quantity: demandPlan.quantity,
  pushedAt: '2026-09-01T00:02:00.000Z'
})
assert.equal(demandCompletion.documentLink.relationType, 'sales_to_purchase_demand')
assert.deepEqual(demandCompletion.documentLink.target, { docType: 'purchase_demand', docId: 99, docNo: 'PR-SERVER' })
assert.deepEqual(demandCompletion.audit.payload, { quantity: 12, product_name: '产品A' })
assert.equal(demandCompletion.orderPatch.purchase_demand_no, 'PR-SERVER')
assert.equal(demandCompletion.orderPatch.audit_status, '待审核')

for (const invalid of [
  { call: () => buildSalesShipmentRequestPlan(), message: /不能下推出货申请/ },
  { call: () => buildSalesOutboundPlan({ order: { ...order, id: null } }), message: /不能下推销售出库/ },
  { call: () => buildSalesPurchaseDemandPlan({ order: { ...order, quantity: 0 } }), message: /数量必须大于 0/ },
  { call: () => buildSalesShipmentRequestPlan({ order: { ...order, order_status: '已取消' } }), message: /已取消或已删除/ }
]) {
  assert.throws(invalid.call, invalid.message)
}

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-grid-flow-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request({', 'axios', 'window.', 'document.', 'localStorage', 'Date.now', 'Math.random']) {
  assert.equal(moduleSource.includes(forbidden), false, `sales grid flow policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/components/SalesAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-grid-flow-policy['"]/)
for (const removedDefinition of [
  'const DOC_TYPES = Object.freeze(',
  'const RELATION_TYPES = Object.freeze(',
  'const getSalesOrderSourceDoc =',
  'const salesFlowNodes = computed(() => {',
  'const salesDownstreamLabel = computed(() => {',
  "if (!order?.id) throw new Error('销售订单缺少主键，不能下推出货申请')",
  "if (!order?.id) throw new Error('销售订单缺少主键，不能下推销售出库')",
  "actionType: 'push_sales_order_to_shipment_request'",
  "actionType: 'push_sales_order_to_sales_outbound'"
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `SalesAppGrid reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildSalesShipmentRequestPlan({',
  'buildSalesOutboundPlan({',
  'buildSalesPurchaseDemandPlan({',
  'buildSalesPurchaseDemandCompletion({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `SalesAppGrid lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3962)

console.log('PASS: SalesAppGrid flow policy preserves document types, validation, projections and three push plans')
