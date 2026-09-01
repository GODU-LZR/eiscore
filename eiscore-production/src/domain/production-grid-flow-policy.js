// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const PRODUCTION_FLOW_DOC_TYPES = Object.freeze({
  PRODUCTION_PLAN: 'production_order',
  WORK_ORDER: 'work_order',
  WORK_ORDER_ITEM: 'work_order_item',
  QUALITY_INSPECTION: 'quality_inspection',
  INVENTORY_INBOUND: 'inventory_inbound',
  INVENTORY_OUTBOUND: 'inventory_outbound'
})

export const PRODUCTION_FLOW_RELATION_TYPES = Object.freeze({
  PRODUCTION_PLAN_TO_WORK_ORDER: 'production_plan_to_work_order',
  WORK_ORDER_TO_ISSUE: 'work_order_to_issue',
  WORK_ORDER_TO_QUALITY_INSPECTION: 'work_order_to_quality_inspection',
  WORK_ORDER_TO_PRODUCTION_INBOUND: 'work_order_to_production_inbound',
  WORK_ORDER_ITEM_TO_MATERIAL_OUTBOUND: 'work_order_item_to_material_outbound'
})

const toProductionNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export const formatProductionQuantity = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  if (Number.isInteger(number)) return String(number)
  return number.toFixed(3).replace(/\.?0+$/, '')
}

export const encodeProductionFilterValue = (value) => encodeURIComponent(String(value ?? ''))

export const getProductionIssueDocNo = (row = {}) => {
  const lineNo = row.line_no || row.id || ''
  return `${row.work_order_no || 'WO'}-${lineNo}`
}

export const assertProductionWorkOrderFlowSource = (row, target) => {
  if (!row?.id) throw new Error(`生产工单缺少主键，不能下推${target}`)
  return row
}

export const assertProductionIssueFlowSource = (row) => {
  if (!row?.id) throw new Error('领料明细缺少主键，不能下推出库')
  return row
}

export const getProductionFlowSourceDoc = (row, docType) => ({
  docType,
  docId: row?.id || null,
  docNo: docType === PRODUCTION_FLOW_DOC_TYPES.WORK_ORDER_ITEM
    ? getProductionIssueDocNo(row)
    : row?.work_order_no || ''
})

export const buildProductionDocumentLinkPayload = ({
  source,
  target,
  relationType,
  quantity = null,
  amount = null,
  payload = {}
}) => ({
  source_doc_type: source.docType,
  source_doc_id: source.docId || null,
  source_doc_no: source.docNo || '',
  target_doc_type: target.docType,
  target_doc_id: target.docId || null,
  target_doc_no: target.docNo || '',
  relation_type: relationType,
  quantity,
  amount,
  status: 'active',
  payload
})

export const buildProductionFlowAuditPayload = ({
  actionType,
  source,
  target,
  reason = '',
  actorUsername,
  payload = {}
}) => ({
  action_type: actionType,
  source_doc_type: source?.docType || '',
  source_doc_id: source?.docId || null,
  source_doc_no: source?.docNo || '',
  target_doc_type: target?.docType || '',
  target_doc_id: target?.docId || null,
  target_doc_no: target?.docNo || '',
  reason,
  actor_username: actorUsername || 'production',
  payload
})

export const buildProductionActiveSourceLinkQuery = (sourceType, sourceId, sourceNo, relationType = '') => {
  const clauses = []
  if (sourceId) clauses.push(`source_doc_id.eq.${encodeProductionFilterValue(sourceId)}`)
  if (sourceNo) clauses.push(`source_doc_no.eq.${encodeProductionFilterValue(sourceNo)}`)
  const orPart = clauses.length ? `&or=(${clauses.join(',')})` : ''
  const relationPart = relationType
    ? `&relation_type=eq.${encodeProductionFilterValue(relationType)}`
    : ''
  return `source_doc_type=eq.${encodeProductionFilterValue(sourceType)}&status=eq.active${relationPart}${orPart}&order=created_at.asc`
}

export const pickProductionRowByLinkTarget = (rows, link, noField) => {
  const candidates = Array.isArray(rows) ? rows : []
  if (!link) return candidates[0] || null
  return candidates.find((row) => {
    if (link.target_doc_id && row.id === link.target_doc_id) return true
    return noField && link.target_doc_no && row[noField] === link.target_doc_no
  }) || candidates[0] || null
}

export const projectProductionLinkedDocument = (link, numberField) => {
  if (!link) return null
  return {
    id: link.target_doc_id,
    [numberField]: link.target_doc_no,
    docNo: link.target_doc_no,
    status: link.payload?.status || (link.status === 'active' ? '已生成链路' : link.status)
  }
}

export const selectProductionFlowRows = (rows, mode) => {
  const candidates = Array.isArray(rows) ? rows : []
  if (mode === 'work_order_items') {
    return candidates.filter((row) => row?.id && (row.work_order_no || row.work_order_id))
  }
  return candidates.filter((row) => row?.id && row.work_order_no)
}

export const buildProductionFlowView = ({ sourceMode, appKey, row = {}, docs = {}, nextStep } = {}) => {
  const isIssueFlow = sourceMode === 'work_order_items' || appKey === 'work_order_items'
  const workOrderNo = row.work_order_no || docs.workOrder?.work_order_no
  const primaryDocNo = isIssueFlow
    ? (row.work_order_no ? `${row.work_order_no}-${row.line_no || row.id || ''}` : row.id || '-')
    : row.work_order_no || row.id || '-'
  const primarySummary = isIssueFlow
    ? `${row.component_material_name || row.component_material_code || '-'} / ${formatProductionQuantity(row.required_qty)} ${row.unit || ''}`
    : `${row.product_material_name || row.product_material_code || '-'} / ${formatProductionQuantity(row.planned_qty)} ${row.unit || ''}`

  let downstream = {
    label: '下游领料出库',
    docNo: docs.materialOutbound?.outbound_no || docs.materialOutbound?.docNo || '未生成',
    status: docs.materialOutbound?.status || '可生成出库链路'
  }
  if (nextStep === 'quality_inspection') {
    downstream = {
      label: '下游生产检验',
      docNo: docs.qualityInspection?.doc_no || '未生成',
      status: docs.qualityInspection?.result || '可下推生成'
    }
  } else if (nextStep === 'production_inbound') {
    downstream = {
      label: '下游生产入库',
      docNo: docs.productionInbound?.inbound_no || docs.productionInbound?.docNo || '未生成',
      status: docs.productionInbound?.status || '可生成入库链路'
    }
  }

  return {
    isIssueFlow,
    selectedLabel: isIssueFlow ? '已选择领料明细' : '已选择生产工单',
    nextStepOptions: isIssueFlow
      ? [{ label: '生产领料出库', value: 'material_outbound' }]
      : [
          { label: '生产检验', value: 'quality_inspection' },
          { label: '生产入库', value: 'production_inbound' }
        ],
    nodes: [
      { key: 'wo', type: '生产工单', docNo: workOrderNo, status: row.work_order_status || docs.workOrder?.work_order_status, current: !isIssueFlow },
      { key: 'issue', type: '生产领料', docNo: docs.materialOutbound?.outbound_no || docs.materialOutbound?.docNo || (isIssueFlow ? `${row.work_order_no || ''}-${row.line_no || row.id || ''}` : ''), status: docs.materialOutbound?.status || row.issue_status, current: isIssueFlow },
      { key: 'qc', type: '生产检验', docNo: docs.qualityInspection?.doc_no, status: docs.qualityInspection?.result },
      { key: 'in', type: '生产入库', docNo: docs.productionInbound?.inbound_no || docs.productionInbound?.docNo, status: docs.productionInbound?.status }
    ],
    primaryLabel: isIssueFlow ? '首个待下推用料' : '首个待下推工单',
    primaryDocNo,
    primarySummary,
    downstream
  }
}

export const buildProductionQualityInspectionDraft = ({ row, inspectionNo, inspectionDate } = {}) => {
  assertProductionWorkOrderFlowSource(row, '生产检验')
  const plannedQuantity = toProductionNumber(row.planned_qty)
  const sampleQty = Math.max(1, Math.min(plannedQuantity, 100) || 1)
  return {
    sampleQty,
    inspectionPayload: {
      doc_no: inspectionNo,
      inspection_type: '过程巡检',
      source_doc_no: row.work_order_no || '',
      item_code: row.product_material_code || '',
      item_name: row.product_material_name || row.product_material_code || '生产产品',
      source_name: row.properties?.line_name || row.properties?.workshop || '生产现场',
      batch_no: row.properties?.batch_no || '',
      sample_qty: sampleQty,
      defect_qty: 0,
      result: '待判定',
      inspector: '',
      inspection_date: inspectionDate,
      remark: `由生产工单 ${row.work_order_no || ''} 下推生成`,
      status: 'active',
      properties: {
        source_type: 'production_work_order',
        source_work_order_id: row.id,
        source_work_order_no: row.work_order_no || '',
        product_material_id: row.product_material_id || null,
        product_material_code: row.product_material_code || '',
        planned_qty: plannedQuantity,
        unit: row.unit || '',
        workflow_key: 'production_to_quality'
      }
    }
  }
}

export const buildProductionQualityInspectionCompletion = ({
  row,
  inspection,
  inspectionPayload,
  sampleQty,
  pushedAt
} = {}) => {
  const source = getProductionFlowSourceDoc(row, PRODUCTION_FLOW_DOC_TYPES.WORK_ORDER)
  const target = {
    docType: PRODUCTION_FLOW_DOC_TYPES.QUALITY_INSPECTION,
    docId: inspection?.id || null,
    docNo: inspection?.doc_no || inspectionPayload?.doc_no
  }
  return {
    documentLink: {
      source,
      target,
      relationType: PRODUCTION_FLOW_RELATION_TYPES.WORK_ORDER_TO_QUALITY_INSPECTION,
      quantity: sampleQty,
      payload: {
        product_material_code: row?.product_material_code || '',
        product_material_name: row?.product_material_name || ''
      }
    },
    audit: {
      actionType: 'push_work_order_to_quality_inspection',
      source,
      target,
      payload: { sample_qty: sampleQty, product_material_name: row?.product_material_name || '' }
    },
    orderProperties: {
      ...(row?.properties || {}),
      quality_inspection_id: inspection?.id || null,
      quality_inspection_no: inspection?.doc_no || inspectionPayload?.doc_no,
      quality_pushed_at: pushedAt
    }
  }
}

export const buildProductionInboundPlan = ({ row, inboundNo, pushedAt } = {}) => {
  assertProductionWorkOrderFlowSource(row, '生产入库')
  const quantity = toProductionNumber(row.planned_qty)
  if (quantity <= 0) throw new Error(`生产工单 ${row.work_order_no || row.id} 计划数量必须大于 0`)
  const source = getProductionFlowSourceDoc(row, PRODUCTION_FLOW_DOC_TYPES.WORK_ORDER)
  const target = { docType: PRODUCTION_FLOW_DOC_TYPES.INVENTORY_INBOUND, docId: null, docNo: inboundNo }
  return {
    documentLink: {
      source,
      target,
      relationType: PRODUCTION_FLOW_RELATION_TYPES.WORK_ORDER_TO_PRODUCTION_INBOUND,
      quantity,
      payload: {
        status: '待仓储补录',
        io_type: '生产入库',
        product_material_id: row.product_material_id || null,
        product_material_code: row.product_material_code || '',
        product_material_name: row.product_material_name || '',
        unit: row.unit || ''
      }
    },
    audit: {
      actionType: 'push_work_order_to_production_inbound',
      source,
      target,
      payload: { quantity, io_type: '生产入库', product_material_name: row.product_material_name || '' }
    },
    orderProperties: {
      ...(row.properties || {}),
      production_inbound_no: inboundNo,
      production_inbound_status: '待仓储补录',
      production_inbound_pushed_at: pushedAt
    },
    inbound: { inbound_no: inboundNo, status: '待仓储补录' }
  }
}

export const buildProductionMaterialOutboundPlan = ({ row, issuedQty, outboundNo, pushedAt } = {}) => {
  assertProductionIssueFlowSource(row)
  const quantity = toProductionNumber(issuedQty ?? row.issued_qty ?? row.required_qty)
  if (quantity <= 0) throw new Error(`领料明细 ${getProductionIssueDocNo(row)} 数量必须大于 0`)
  const source = getProductionFlowSourceDoc(row, PRODUCTION_FLOW_DOC_TYPES.WORK_ORDER_ITEM)
  const target = { docType: PRODUCTION_FLOW_DOC_TYPES.INVENTORY_OUTBOUND, docId: null, docNo: outboundNo }
  return {
    documentLink: {
      source,
      target,
      relationType: PRODUCTION_FLOW_RELATION_TYPES.WORK_ORDER_ITEM_TO_MATERIAL_OUTBOUND,
      quantity,
      payload: {
        status: '待仓储补录',
        io_type: '生产领料',
        work_order_id: row.work_order_id || null,
        work_order_no: row.work_order_no || '',
        component_material_id: row.component_material_id || null,
        component_material_code: row.component_material_code || '',
        component_material_name: row.component_material_name || '',
        unit: row.unit || ''
      }
    },
    audit: {
      actionType: 'push_work_order_item_to_material_outbound',
      source,
      target,
      payload: { quantity, io_type: '生产领料', component_material_name: row.component_material_name || '' }
    },
    issueProperties: {
      ...(row.properties || {}),
      material_outbound_no: outboundNo,
      material_outbound_status: '待仓储补录',
      material_outbound_pushed_at: pushedAt
    },
    outbound: { outbound_no: outboundNo, status: '待仓储补录' }
  }
}
