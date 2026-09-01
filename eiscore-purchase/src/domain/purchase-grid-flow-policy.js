// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const PURCHASE_FLOW_DOC_TYPES = Object.freeze({
  SALES_ORDER: 'sales_order',
  PURCHASE_DEMAND: 'purchase_demand',
  PURCHASE_ORDER: 'purchase_order',
  PURCHASE_ARRIVAL: 'purchase_arrival',
  INVENTORY_INBOUND: 'inventory_inbound'
})

export const PURCHASE_FLOW_RELATION_TYPES = Object.freeze({
  SALES_TO_PURCHASE_DEMAND: 'sales_to_purchase_demand',
  DEMAND_TO_ORDER: 'demand_to_order',
  ORDER_TO_ARRIVAL: 'order_to_arrival',
  ARRIVAL_TO_INBOUND: 'arrival_to_inbound'
})

export const encodePurchaseFilterValue = (value) => encodeURIComponent(String(value ?? ''))

export const isPurchaseDemandPushable = (row) => {
  if (!row?.id) return false
  const closedStatuses = ['已下单', '已关闭', 'locked', 'disabled']
  return !closedStatuses.includes(row.demand_status) && !closedStatuses.includes(row.status)
}

export const isPurchaseOrderPushable = (row) => {
  if (!row?.id) return false
  if (!['草稿', '已下单', '部分到货'].includes(row.order_status)) return false
  if (['已完成', '已取消', 'locked', 'disabled'].includes(row.order_status)) return false
  if (['locked', 'disabled', 'deleted'].includes(row.status)) return false
  return row.arrival_progress !== '已到齐'
}

export const isPurchaseArrivalPushable = (row) => {
  if (!row?.id) return false
  if (row.arrival_status === '已入库' || row.arrival_status === '异常') return false
  if (row.iqc_status === '不合格') return false
  return !['locked', 'disabled', 'deleted'].includes(row.status)
}

export const assertPurchaseDemandFlowSource = (demand) => {
  if (!demand?.id) throw new Error('采购需求缺少主键，不能下推')
  if (!isPurchaseDemandPushable(demand)) throw new Error(`采购需求 ${demand.demand_no || demand.id} 当前状态不能下推`)
  return demand
}

export const assertPurchaseOrderFlowSource = (order) => {
  if (!order?.id) throw new Error('采购订单缺少主键，不能下推')
  if (!isPurchaseOrderPushable(order)) {
    throw new Error(`采购订单 ${order.order_no || order.id} 状态不能下推，请确认不是已完成、已取消或已到齐`)
  }
  return order
}

export const assertPurchaseArrivalFlowSource = (arrival) => {
  if (!arrival?.id) throw new Error('到货单缺少主键，不能入库')
  if (!isPurchaseArrivalPushable(arrival)) {
    throw new Error(`到货单 ${arrival.arrival_no || arrival.id} 已入库、异常或不合格，不能直接入库`)
  }
  return arrival
}

export const selectPurchaseFlowRows = (rows, mode) => {
  const candidates = Array.isArray(rows) ? rows : []
  if (mode === 'orders') return candidates.filter((row) => row?.id || row?.order_no)
  if (mode === 'arrivals') return candidates.filter((row) => row?.id || row?.arrival_no)
  return candidates.filter((row) => row?.id || row?.demand_no)
}

export const buildPurchaseActiveSourceLinkQuery = (sourceType, sourceId, sourceNo) => {
  const clauses = []
  if (sourceId) clauses.push(`source_doc_id.eq.${encodePurchaseFilterValue(sourceId)}`)
  if (sourceNo) clauses.push(`source_doc_no.eq.${encodePurchaseFilterValue(sourceNo)}`)
  const orPart = clauses.length ? `&or=(${clauses.join(',')})` : ''
  return `source_doc_type=eq.${encodePurchaseFilterValue(sourceType)}&status=eq.active${orPart}&order=created_at.asc`
}

export const pickPurchaseRowByLinkTarget = (rows, link, noField) => {
  const candidates = Array.isArray(rows) ? rows : []
  if (!link) return candidates[0] || null
  return candidates.find((row) => {
    if (link.target_doc_id && row.id === link.target_doc_id) return true
    return noField && link.target_doc_no && row[noField] === link.target_doc_no
  }) || candidates[0] || null
}

export const projectPurchaseInboundFromLink = (link) => {
  if (!link) return null
  return {
    id: link.target_doc_id,
    inbound_no: link.target_doc_no,
    docNo: link.target_doc_no,
    status: link.status === 'active' ? '已入库' : link.status
  }
}

export const buildPurchaseDocumentLinkPayload = ({
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

export const buildPurchaseFlowAuditPayload = ({
  actionType,
  source,
  target,
  reason = '',
  actorUsername = 'purchase',
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
  actor_username: actorUsername,
  payload
})

export const buildPurchaseFlowView = ({ appKey, demand = {}, order = {}, arrival = {}, docs = {} } = {}) => {
  const primary = appKey === 'orders' ? order : (appKey === 'arrivals' ? arrival : demand)
  let view = {
    dialogTitle: '采购需求业务流程',
    selectedLabel: '已选择采购需求',
    nextStepOptions: [{ label: '采购订单', value: 'purchase_order' }],
    confirmButtonType: 'success',
    primaryLabel: '首个待下推需求',
    primaryDocNo: demand.demand_no || demand.id || '-',
    previousDocNo: demand.properties?.source_order_no || demand.properties?.source_order_nos || '采购需求',
    previousSummary: demand.source_dept || '当前链路节点',
    downstream: {
      label: '下游采购订单',
      docNo: docs.purchaseOrder?.order_no || '未生成',
      status: docs.purchaseOrder?.order_status || '可下推生成'
    }
  }
  if (appKey === 'orders') {
    view = {
      ...view,
      dialogTitle: '采购订单业务流程',
      selectedLabel: '已选择采购订单',
      nextStepOptions: [{ label: '到货跟踪', value: 'purchase_arrival' }],
      primaryLabel: '首个待下推订单',
      primaryDocNo: order.order_no || order.id || '-',
      previousDocNo: order.source_demand_no || docs.purchaseDemand?.demand_no || '采购需求',
      previousSummary: '当前链路上游需求',
      downstream: {
        label: '下游到货跟踪',
        docNo: docs.purchaseArrival?.arrival_no || '未生成',
        status: docs.purchaseArrival?.arrival_status || '可下推生成'
      }
    }
  } else if (appKey === 'arrivals') {
    view = {
      ...view,
      dialogTitle: '到货入库业务流程',
      selectedLabel: '已选择到货单',
      nextStepOptions: [{ label: '采购入库', value: 'inventory_inbound' }],
      confirmButtonType: 'warning',
      primaryLabel: '首个待入库到货单',
      primaryDocNo: arrival.arrival_no || arrival.id || '-',
      previousDocNo: arrival.order_no || docs.purchaseOrder?.order_no || '采购订单',
      previousSummary: '当前链路上游订单',
      downstream: {
        label: '下游采购入库',
        docNo: docs.inventoryInbound?.inbound_no || docs.inventoryInbound?.docNo || '未生成',
        status: docs.inventoryInbound?.status || '可确认入库'
      }
    }
  }
  return {
    ...view,
    nodes: [
      { key: 'sales', type: '销售订单', docNo: demand.properties?.source_order_no || demand.properties?.source_order_nos, status: '上游来源' },
      { key: 'demand', type: '采购需求', docNo: demand.demand_no, status: demand.demand_status, current: appKey === 'demands' },
      { key: 'order', type: '采购订单', docNo: order.order_no, status: order.order_status, current: appKey === 'orders' },
      { key: 'arrival', type: '到货跟踪', docNo: arrival.arrival_no, status: arrival.arrival_status, current: appKey === 'arrivals' },
      { key: 'inbound', type: '采购入库', docNo: docs.inventoryInbound?.inbound_no || docs.inventoryInbound?.docNo, status: docs.inventoryInbound?.status }
    ],
    primarySummary: `${primary.material_name || '-'} / ${primary.quantity || primary.arrival_quantity || 0} ${primary.unit || ''}`
  }
}

export const buildPurchaseDemandOrderDraft = ({ demand, supplier, orderNo, orderDate } = {}) => {
  assertPurchaseDemandFlowSource(demand)
  const orderPayload = {
    order_no: orderNo,
    demand_id: demand.id,
    source_demand_no: demand.demand_no || '',
    supplier_id: supplier?.id || null,
    supplier_name: supplier?.name || demand.preferred_supplier || '待选择供应商',
    material_name: demand.material_name || '待录入物料',
    quantity: Number(demand.quantity) || 0,
    unit: demand.unit || 'kg',
    unit_price: 0,
    total_amount: 0,
    order_date: orderDate,
    expected_arrival_date: demand.required_date || null,
    buyer_name: supplier?.buyer_name || demand.requester_name || '',
    order_status: '草稿',
    status: 'draft',
    properties: {
      source_dept: demand.source_dept || '',
      supplier_lead_time_days: supplier?.lead_time_days ?? null,
      source_demand_id: demand.id,
      source_sales_order_no: demand.properties?.source_order_no || demand.properties?.source_order_nos || ''
    }
  }
  if (orderPayload.quantity <= 0) throw new Error(`采购需求 ${demand.demand_no || demand.id} 数量必须大于 0`)
  return orderPayload
}

export const buildPurchaseDemandOrderCompletion = ({ demand, order, orderPayload, pushedAt } = {}) => {
  const source = {
    docType: PURCHASE_FLOW_DOC_TYPES.PURCHASE_DEMAND,
    docId: demand.id,
    docNo: demand.demand_no || ''
  }
  const target = {
    docType: PURCHASE_FLOW_DOC_TYPES.PURCHASE_ORDER,
    docId: order?.id || null,
    docNo: order?.order_no || orderPayload.order_no
  }
  return {
    demandUpdate: {
      demand_status: '已下单',
      status: 'active',
      properties: {
        ...(demand.properties || {}),
        purchase_order_id: order?.id || null,
        purchase_order_no: order?.order_no || orderPayload.order_no,
        workflow_status: 'running',
        pushed_to_order_at: pushedAt
      }
    },
    documentLink: {
      source,
      target,
      relationType: PURCHASE_FLOW_RELATION_TYPES.DEMAND_TO_ORDER,
      quantity: orderPayload.quantity,
      amount: orderPayload.total_amount,
      payload: { material_name: orderPayload.material_name }
    },
    audit: {
      actionType: 'create_order_from_demand',
      source,
      target,
      payload: { material_name: orderPayload.material_name, quantity: orderPayload.quantity }
    }
  }
}

export const buildPurchaseOrderActivationUpdate = ({ order, confirmedAt } = {}) => ({
  order_status: '已下单',
  status: 'active',
  properties: {
    ...(order?.properties || {}),
    auto_confirmed_before_arrival_at: confirmedAt
  }
})

export const assertPurchaseOrderQuantity = (order) => {
  const quantity = Number(order?.quantity) || 0
  if (quantity <= 0) throw new Error(`采购订单 ${order?.order_no || order?.id} 数量必须大于 0`)
  return quantity
}

export const getPurchaseOrderPendingQuantityHint = (order) => {
  const directPending = Number(order?.pending_quantity)
  if (Number.isFinite(directPending) && directPending > 0) return directPending
  const orderQuantity = Number(order?.quantity) || 0
  return orderQuantity <= 0 ? 0 : null
}

export const calculatePurchaseOrderPendingQuantity = (order, arrivals = []) => {
  const pendingHint = getPurchaseOrderPendingQuantityHint(order)
  if (pendingHint !== null) return pendingHint
  const orderQuantity = Number(order?.quantity) || 0
  const arrivedQuantity = Array.isArray(arrivals)
    ? arrivals.reduce((sum, item) => sum + (Number(item.arrival_quantity) || 0), 0)
    : 0
  return Math.max(orderQuantity - arrivedQuantity, 0)
}

export const buildPurchaseOrderArrivalDraft = ({ order, arrivalQuantity, arrivalNo, arrivalDate } = {}) => {
  assertPurchaseOrderFlowSource(order)
  if (arrivalQuantity <= 0) throw new Error(`采购订单 ${order.order_no || order.id} 待到货数量必须大于 0`)
  return {
    arrival_no: arrivalNo,
    order_id: order.id,
    order_no: order.order_no || '',
    supplier_id: order.supplier_id || null,
    supplier_name: order.supplier_name || '',
    material_name: order.material_name || '待录入物料',
    arrival_quantity: arrivalQuantity,
    accepted_quantity: 0,
    unit: order.unit || 'kg',
    arrival_date: arrivalDate,
    iqc_status: '待检',
    inbound_no: '',
    arrival_status: '待检验',
    status: 'active',
    properties: { source_order_id: order.id }
  }
}

export const buildPurchaseOrderArrivalCompletion = ({ order, arrival, arrivalPayload } = {}) => {
  const source = {
    docType: PURCHASE_FLOW_DOC_TYPES.PURCHASE_ORDER,
    docId: order.id,
    docNo: order.order_no || ''
  }
  const target = {
    docType: PURCHASE_FLOW_DOC_TYPES.PURCHASE_ARRIVAL,
    docId: arrival?.id || null,
    docNo: arrival?.arrival_no || arrivalPayload.arrival_no
  }
  return {
    documentLink: {
      source,
      target,
      relationType: PURCHASE_FLOW_RELATION_TYPES.ORDER_TO_ARRIVAL,
      quantity: arrivalPayload.arrival_quantity,
      payload: { material_name: arrivalPayload.material_name }
    },
    audit: {
      actionType: 'register_arrival_from_order',
      source,
      target,
      payload: { material_name: arrivalPayload.material_name, quantity: arrivalPayload.arrival_quantity }
    }
  }
}

export const buildPurchaseArrivalInboundPlan = ({ arrival, inboundNo } = {}) => {
  assertPurchaseArrivalFlowSource(arrival)
  const arrivalQuantity = Number(arrival.arrival_quantity) || 0
  if (arrivalQuantity <= 0) throw new Error(`到货单 ${arrival.arrival_no || arrival.id} 到货数量必须大于 0`)
  const acceptedQuantity = Number(arrival.accepted_quantity) > 0
    ? Math.min(Number(arrival.accepted_quantity), arrivalQuantity)
    : arrivalQuantity
  const source = {
    docType: PURCHASE_FLOW_DOC_TYPES.PURCHASE_ARRIVAL,
    docId: arrival.id,
    docNo: arrival.arrival_no || ''
  }
  const target = {
    docType: PURCHASE_FLOW_DOC_TYPES.INVENTORY_INBOUND,
    docId: null,
    docNo: inboundNo
  }
  return {
    acceptedQuantity,
    arrivalUpdate: {
      accepted_quantity: acceptedQuantity,
      iqc_status: arrival.iqc_status === '让步接收' ? '让步接收' : '合格',
      inbound_no: inboundNo,
      arrival_status: '已入库',
      status: 'active'
    },
    documentLink: {
      source,
      target,
      relationType: PURCHASE_FLOW_RELATION_TYPES.ARRIVAL_TO_INBOUND,
      quantity: acceptedQuantity,
      payload: { material_name: arrival.material_name || '' }
    },
    audit: {
      actionType: 'confirm_arrival_inbound',
      source,
      target,
      payload: { material_name: arrival.material_name || '', quantity: acceptedQuantity }
    }
  }
}
