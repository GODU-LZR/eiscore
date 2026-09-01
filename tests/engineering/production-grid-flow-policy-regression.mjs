// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PRODUCTION_FLOW_DOC_TYPES,
  PRODUCTION_FLOW_RELATION_TYPES,
  assertProductionIssueFlowSource,
  assertProductionWorkOrderFlowSource,
  buildProductionActiveSourceLinkQuery,
  buildProductionDocumentLinkPayload,
  buildProductionFlowAuditPayload,
  buildProductionFlowView,
  buildProductionInboundPlan,
  buildProductionMaterialOutboundPlan,
  buildProductionQualityInspectionCompletion,
  buildProductionQualityInspectionDraft,
  encodeProductionFilterValue,
  formatProductionQuantity,
  getProductionFlowSourceDoc,
  getProductionIssueDocNo,
  pickProductionRowByLinkTarget,
  projectProductionLinkedDocument,
  selectProductionFlowRows
} from '../../eiscore-production/src/domain/production-grid-flow-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const workOrder = {
  id: 42,
  work_order_no: 'WO-42',
  work_order_status: '进行中',
  planned_qty: '12.5',
  product_material_id: 7,
  product_material_code: 'P-007',
  product_material_name: '产品A',
  unit: '件',
  properties: { line_name: '一号线', batch_no: 'B-1', keep: true }
}
const issue = {
  id: 8,
  line_no: 2,
  work_order_id: 42,
  work_order_no: 'WO-42',
  required_qty: 6,
  issued_qty: 4,
  component_material_id: 9,
  component_material_code: 'M-009',
  component_material_name: '组件A',
  unit: '件',
  properties: { keep: true }
}

assert.deepEqual(PRODUCTION_FLOW_DOC_TYPES, {
  PRODUCTION_PLAN: 'production_order',
  WORK_ORDER: 'work_order',
  WORK_ORDER_ITEM: 'work_order_item',
  QUALITY_INSPECTION: 'quality_inspection',
  INVENTORY_INBOUND: 'inventory_inbound',
  INVENTORY_OUTBOUND: 'inventory_outbound'
})
assert.equal(PRODUCTION_FLOW_RELATION_TYPES.WORK_ORDER_TO_QUALITY_INSPECTION, 'work_order_to_quality_inspection')
assert.equal(PRODUCTION_FLOW_RELATION_TYPES.WORK_ORDER_ITEM_TO_MATERIAL_OUTBOUND, 'work_order_item_to_material_outbound')

assert.equal(formatProductionQuantity('12.500'), '12.5')
assert.equal(formatProductionQuantity(12), '12')
assert.equal(formatProductionQuantity('bad'), '0')
assert.equal(encodeProductionFilterValue('WO 42/1'), 'WO%2042%2F1')
assert.equal(getProductionIssueDocNo(issue), 'WO-42-2')
assert.equal(getProductionIssueDocNo({ id: 3 }), 'WO-3')
assert.equal(assertProductionWorkOrderFlowSource(workOrder, '生产检验'), workOrder)
assert.equal(assertProductionIssueFlowSource(issue), issue)
assert.throws(() => assertProductionWorkOrderFlowSource(null, '生产入库'), /不能下推生产入库/)
assert.throws(() => assertProductionIssueFlowSource({}), /领料明细缺少主键/)

assert.deepEqual(getProductionFlowSourceDoc(workOrder, PRODUCTION_FLOW_DOC_TYPES.WORK_ORDER), {
  docType: 'work_order', docId: 42, docNo: 'WO-42'
})
assert.deepEqual(getProductionFlowSourceDoc(issue, PRODUCTION_FLOW_DOC_TYPES.WORK_ORDER_ITEM), {
  docType: 'work_order_item', docId: 8, docNo: 'WO-42-2'
})

const source = { docType: 'work_order', docId: 42, docNo: 'WO-42' }
const target = { docType: 'quality_inspection', docId: 51, docNo: 'QI-51' }
assert.deepEqual(buildProductionDocumentLinkPayload({ source, target, relationType: 'work_order_to_quality_inspection', quantity: 5 }), {
  source_doc_type: 'work_order',
  source_doc_id: 42,
  source_doc_no: 'WO-42',
  target_doc_type: 'quality_inspection',
  target_doc_id: 51,
  target_doc_no: 'QI-51',
  relation_type: 'work_order_to_quality_inspection',
  quantity: 5,
  amount: null,
  status: 'active',
  payload: {}
})
assert.deepEqual(buildProductionFlowAuditPayload({
  actionType: 'push', source, target, actorUsername: '', payload: { quantity: 5 }
}), {
  action_type: 'push',
  source_doc_type: 'work_order',
  source_doc_id: 42,
  source_doc_no: 'WO-42',
  target_doc_type: 'quality_inspection',
  target_doc_id: 51,
  target_doc_no: 'QI-51',
  reason: '',
  actor_username: 'production',
  payload: { quantity: 5 }
})
assert.equal(
  buildProductionActiveSourceLinkQuery('work_order', 42, 'WO 42', 'work_order_to_quality_inspection'),
  'source_doc_type=eq.work_order&status=eq.active&relation_type=eq.work_order_to_quality_inspection&or=(source_doc_id.eq.42,source_doc_no.eq.WO%2042)&order=created_at.asc'
)

const linkedRows = [{ id: 1, doc_no: 'QI-1' }, { id: 2, doc_no: 'QI-2' }]
assert.deepEqual(pickProductionRowByLinkTarget(linkedRows, { target_doc_id: 2 }, 'doc_no'), linkedRows[1])
assert.deepEqual(pickProductionRowByLinkTarget(linkedRows, { target_doc_no: 'QI-1' }, 'doc_no'), linkedRows[0])
assert.deepEqual(pickProductionRowByLinkTarget(linkedRows, null, 'doc_no'), linkedRows[0])
assert.equal(pickProductionRowByLinkTarget(null, null, 'doc_no'), null)
assert.deepEqual(projectProductionLinkedDocument({
  target_doc_id: 6,
  target_doc_no: 'PIN-6',
  status: 'active',
  payload: { status: '待仓储补录' }
}, 'inbound_no'), {
  id: 6,
  inbound_no: 'PIN-6',
  docNo: 'PIN-6',
  status: '待仓储补录'
})
assert.equal(projectProductionLinkedDocument(null, 'outbound_no'), null)

assert.deepEqual(selectProductionFlowRows([workOrder, issue, { id: 3 }, null], 'work_orders'), [workOrder, issue])
assert.deepEqual(selectProductionFlowRows([workOrder, issue, { id: 3 }, null], 'work_order_items'), [workOrder, issue])

const workOrderView = buildProductionFlowView({
  sourceMode: 'work_orders',
  appKey: 'work_orders',
  row: workOrder,
  docs: { qualityInspection: { doc_no: 'QI-1', result: '合格' } },
  nextStep: 'quality_inspection'
})
assert.equal(workOrderView.isIssueFlow, false)
assert.equal(workOrderView.selectedLabel, '已选择生产工单')
assert.deepEqual(workOrderView.nextStepOptions.map((option) => option.value), ['quality_inspection', 'production_inbound'])
assert.equal(workOrderView.nodes[0].docNo, 'WO-42')
assert.equal(workOrderView.primarySummary, '产品A / 12.5 件')
assert.deepEqual(workOrderView.downstream, { label: '下游生产检验', docNo: 'QI-1', status: '合格' })

const issueView = buildProductionFlowView({
  sourceMode: 'work_order_items',
  appKey: 'work_orders',
  row: issue,
  docs: { materialOutbound: { docNo: 'PICK-1', status: '已生成' } },
  nextStep: 'material_outbound'
})
assert.equal(issueView.isIssueFlow, true)
assert.equal(issueView.primaryDocNo, 'WO-42-2')
assert.equal(issueView.primarySummary, '组件A / 6 件')
assert.deepEqual(issueView.downstream, { label: '下游领料出库', docNo: 'PICK-1', status: '已生成' })

const draft = buildProductionQualityInspectionDraft({
  row: workOrder,
  inspectionNo: 'QI-42',
  inspectionDate: '2026-09-01'
})
assert.equal(draft.sampleQty, 12.5)
assert.deepEqual(draft.inspectionPayload, {
  doc_no: 'QI-42',
  inspection_type: '过程巡检',
  source_doc_no: 'WO-42',
  item_code: 'P-007',
  item_name: '产品A',
  source_name: '一号线',
  batch_no: 'B-1',
  sample_qty: 12.5,
  defect_qty: 0,
  result: '待判定',
  inspector: '',
  inspection_date: '2026-09-01',
  remark: '由生产工单 WO-42 下推生成',
  status: 'active',
  properties: {
    source_type: 'production_work_order',
    source_work_order_id: 42,
    source_work_order_no: 'WO-42',
    product_material_id: 7,
    product_material_code: 'P-007',
    planned_qty: 12.5,
    unit: '件',
    workflow_key: 'production_to_quality'
  }
})
assert.equal(buildProductionQualityInspectionDraft({
  row: { ...workOrder, planned_qty: 999 }, inspectionNo: 'QI-X', inspectionDate: '2026-09-01'
}).sampleQty, 100)

const completion = buildProductionQualityInspectionCompletion({
  row: workOrder,
  inspection: { id: 51, doc_no: 'QI-SERVER' },
  inspectionPayload: draft.inspectionPayload,
  sampleQty: draft.sampleQty,
  pushedAt: '2026-09-01T01:00:00.000Z'
})
assert.equal(completion.documentLink.relationType, 'work_order_to_quality_inspection')
assert.deepEqual(completion.documentLink.target, { docType: 'quality_inspection', docId: 51, docNo: 'QI-SERVER' })
assert.deepEqual(completion.audit.payload, { sample_qty: 12.5, product_material_name: '产品A' })
assert.equal(completion.orderProperties.keep, true)
assert.equal(completion.orderProperties.quality_inspection_no, 'QI-SERVER')

const inboundPlan = buildProductionInboundPlan({
  row: workOrder,
  inboundNo: 'PIN-42',
  pushedAt: '2026-09-01T02:00:00.000Z'
})
assert.equal(inboundPlan.documentLink.quantity, 12.5)
assert.equal(inboundPlan.documentLink.relationType, 'work_order_to_production_inbound')
assert.deepEqual(inboundPlan.audit.payload, { quantity: 12.5, io_type: '生产入库', product_material_name: '产品A' })
assert.equal(inboundPlan.orderProperties.production_inbound_pushed_at, '2026-09-01T02:00:00.000Z')
assert.deepEqual(inboundPlan.inbound, { inbound_no: 'PIN-42', status: '待仓储补录' })

const outboundPlan = buildProductionMaterialOutboundPlan({
  row: issue,
  issuedQty: 5,
  outboundNo: 'PICK-8',
  pushedAt: '2026-09-01T03:00:00.000Z'
})
assert.equal(outboundPlan.documentLink.quantity, 5)
assert.equal(outboundPlan.documentLink.relationType, 'work_order_item_to_material_outbound')
assert.equal(outboundPlan.documentLink.payload.component_material_code, 'M-009')
assert.deepEqual(outboundPlan.audit.payload, { quantity: 5, io_type: '生产领料', component_material_name: '组件A' })
assert.equal(outboundPlan.issueProperties.keep, true)
assert.deepEqual(outboundPlan.outbound, { outbound_no: 'PICK-8', status: '待仓储补录' })

assert.throws(() => buildProductionInboundPlan({ row: { ...workOrder, planned_qty: 0 } }), /计划数量必须大于 0/)
assert.throws(() => buildProductionMaterialOutboundPlan({ row: { ...issue, issued_qty: 0, required_qty: 0 } }), /数量必须大于 0/)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-production/src/domain/production-grid-flow-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request({', 'axios', 'window.', 'document.', 'localStorage', 'Date.now', 'Math.random']) {
  assert.equal(moduleSource.includes(forbidden), false, `production grid flow policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-production/src/components/ProductionAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/production-grid-flow-policy['"]/)
for (const removedDefinition of [
  'const DOC_TYPES = Object.freeze(',
  'const RELATION_TYPES = Object.freeze(',
  'const formatQty =',
  'const safeEq =',
  'const toNumber =',
  'const getIssueDocNo =',
  'const getFlowSourceDoc =',
  'const createDocumentLinkPayload =',
  'const activeSourceLinkQuery =',
  'const pickFirstByLinkTarget =',
  'const productionFlowNodes = computed(() => {'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `ProductionAppGrid reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildProductionFlowView({',
  'buildProductionQualityInspectionDraft({',
  'buildProductionQualityInspectionCompletion({',
  'buildProductionInboundPlan({',
  'buildProductionMaterialOutboundPlan({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `ProductionAppGrid lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2278)

console.log('PASS: ProductionAppGrid flow policy preserves document links, views and three push plans')
