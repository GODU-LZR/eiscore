// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { isSalesOrderActive, toSalesAmount } from './sales-grid-data-policy.js'

export const SALES_FLOW_DOC_TYPES = Object.freeze({
  SALES_ORDER: 'sales_order',
  PURCHASE_DEMAND: 'purchase_demand',
  PURCHASE_ORDER: 'purchase_order',
  PURCHASE_ARRIVAL: 'purchase_arrival',
  INVENTORY_INBOUND: 'inventory_inbound',
  SALES_SHIPMENT: 'sales_shipment',
  INVENTORY_OUTBOUND: 'inventory_outbound'
})

export const SALES_FLOW_RELATION_TYPES = Object.freeze({
  SALES_TO_PURCHASE_DEMAND: 'sales_to_purchase_demand',
  DEMAND_TO_ORDER: 'demand_to_order',
  ORDER_TO_ARRIVAL: 'order_to_arrival',
  ARRIVAL_TO_INBOUND: 'arrival_to_inbound',
  SALES_TO_SHIPMENT_REQUEST: 'sales_to_shipment_request',
  SHIPMENT_REQUEST_TO_SALES_OUTBOUND: 'shipment_request_to_sales_outbound',
  SALES_TO_OUTBOUND: 'sales_to_outbound'
})

const requireSalesOrder = (order, missingMessage) => {
  if (!order?.id) throw new Error(missingMessage)
  if (!isSalesOrderActive(order)) {
    throw new Error(`销售订单 ${order.order_no || order.id} 已取消或已删除`)
  }
  return order
}

const requirePositiveQuantity = (order) => {
  const quantity = toSalesAmount(order.quantity)
  if (quantity <= 0) throw new Error(`销售订单 ${order.order_no || order.id} 数量必须大于 0`)
  return quantity
}

export const assertSalesOrderFlowSource = (order, target = '') => {
  const suffix = target ? `，不能下推${target}` : '，不能下推'
  return requireSalesOrder(order, `销售订单缺少主键${suffix}`)
}

export const getSalesOrderSourceDoc = (order) => ({
  docType: SALES_FLOW_DOC_TYPES.SALES_ORDER,
  docId: order?.id || null,
  docNo: order?.order_no || ''
})

export const projectSalesShipmentLink = (link) => {
  if (!link) return null
  return {
    id: link.target_doc_id,
    shipment_no: link.target_doc_no,
    docNo: link.target_doc_no,
    status: link.payload?.status || '待仓储确认',
    payload: link.payload || {}
  }
}

export const projectSalesOutboundLink = (link) => {
  if (!link) return null
  return {
    id: link.target_doc_id,
    outbound_no: link.target_doc_no,
    docNo: link.target_doc_no,
    status: link.payload?.status || '待仓储补录'
  }
}

export const buildSalesFlowNodes = ({ order = {}, docs = {} } = {}) => [
  { key: 'so', type: '销售订单', docNo: order.order_no, status: order.order_status, current: true },
  { key: 'pr', type: '采购需求', docNo: docs.purchaseDemand?.demand_no, status: docs.purchaseDemand?.demand_status },
  { key: 'po', type: '采购订单', docNo: docs.purchaseOrder?.order_no, status: docs.purchaseOrder?.order_status },
  { key: 'pa', type: '到货/检验', docNo: docs.purchaseArrival?.arrival_no, status: docs.purchaseArrival?.arrival_status },
  { key: 'in', type: '采购入库', docNo: docs.inventoryInbound?.inbound_no || docs.inventoryInbound?.docNo, status: docs.inventoryInbound?.status },
  { key: 'ship', type: '出货申请', docNo: docs.salesShipment?.shipment_no || docs.salesShipment?.docNo, status: docs.salesShipment?.status },
  { key: 'out', type: '销售出库', docNo: docs.salesOutbound?.outbound_no || docs.salesOutbound?.docNo, status: docs.salesOutbound?.status }
]

export const getSalesFlowDownstreamState = ({ nextStep, docs = {} } = {}) => {
  if (nextStep === 'shipment_request') {
    return {
      label: '下游出货申请',
      docNo: docs.salesShipment?.shipment_no || docs.salesShipment?.docNo || '未生成',
      status: docs.salesShipment?.status || '可下推生成',
      buttonType: 'warning'
    }
  }
  if (nextStep === 'sales_outbound') {
    return {
      label: '下游销售出库',
      docNo: docs.salesOutbound?.outbound_no || docs.salesOutbound?.docNo || '未生成',
      status: docs.salesOutbound?.status || '可生成出库链路',
      buttonType: 'warning'
    }
  }
  return {
    label: '下游采购需求',
    docNo: docs.purchaseDemand?.demand_no || '未生成',
    status: docs.purchaseDemand?.demand_status || '可下推生成',
    buttonType: 'success'
  }
}

export const buildSalesOrderPropertiesPatch = (order, nextProperties, nextStatus = null) => {
  const data = {
    properties: {
      ...(order?.properties || {}),
      ...nextProperties
    }
  }
  if (nextStatus) data.order_status = nextStatus
  return data
}

export const buildSalesShipmentRequestPlan = ({ order, shipmentNo, pushedAt } = {}) => {
  requireSalesOrder(order, '销售订单缺少主键，不能下推出货申请')
  const quantity = requirePositiveQuantity(order)
  const source = getSalesOrderSourceDoc(order)
  const target = { docType: SALES_FLOW_DOC_TYPES.SALES_SHIPMENT, docId: null, docNo: shipmentNo }
  return {
    documentLink: {
      source,
      target,
      relationType: SALES_FLOW_RELATION_TYPES.SALES_TO_SHIPMENT_REQUEST,
      quantity,
      amount: toSalesAmount(order.total_amount),
      payload: {
        status: '待仓储确认',
        customer_name: order.customer_name || '',
        product_name: order.product_name || '',
        product_material_id: order.product_material_id || order.properties?.product_material_id || null,
        product_material_code: order.properties?.product_material_code || '',
        unit: order.unit || '',
        delivery_date: order.delivery_date || null
      }
    },
    audit: {
      actionType: 'push_sales_order_to_shipment_request',
      source,
      target,
      payload: {
        quantity,
        customer_name: order.customer_name || '',
        product_name: order.product_name || ''
      }
    },
    orderPatch: {
      shipment_no: shipmentNo,
      shipment_status: '待仓储确认',
      shipment_pushed_at: pushedAt,
      workflow_status: 'running',
      workflow_key: 'sales_to_shipment_outbound'
    },
    shipment: { shipment_no: shipmentNo, status: '待仓储确认' }
  }
}

export const buildSalesOutboundPlan = ({ order, shipment, outboundNo, pushedAt } = {}) => {
  requireSalesOrder(order, '销售订单缺少主键，不能下推销售出库')
  const quantity = requirePositiveQuantity(order)
  const source = {
    docType: SALES_FLOW_DOC_TYPES.SALES_SHIPMENT,
    docId: shipment?.id || null,
    docNo: shipment?.shipment_no || shipment?.docNo || ''
  }
  const orderSource = getSalesOrderSourceDoc(order)
  const target = { docType: SALES_FLOW_DOC_TYPES.INVENTORY_OUTBOUND, docId: null, docNo: outboundNo }
  const amount = toSalesAmount(order.total_amount)
  return {
    shipmentLink: {
      source,
      target,
      relationType: SALES_FLOW_RELATION_TYPES.SHIPMENT_REQUEST_TO_SALES_OUTBOUND,
      quantity,
      amount,
      payload: {
        status: '待仓储补录',
        io_type: '销售出库',
        sales_order_id: order.id,
        sales_order_no: order.order_no || '',
        customer_name: order.customer_name || '',
        product_name: order.product_name || '',
        product_material_id: order.product_material_id || order.properties?.product_material_id || null,
        product_material_code: order.properties?.product_material_code || '',
        unit: order.unit || ''
      }
    },
    directLink: {
      source: orderSource,
      target,
      relationType: SALES_FLOW_RELATION_TYPES.SALES_TO_OUTBOUND,
      quantity,
      amount,
      payload: {
        status: '待仓储补录',
        io_type: '销售出库',
        shipment_no: shipment?.shipment_no || shipment?.docNo || ''
      }
    },
    audit: {
      actionType: 'push_sales_order_to_sales_outbound',
      source: orderSource,
      target,
      payload: {
        quantity,
        io_type: '销售出库',
        customer_name: order.customer_name || '',
        product_name: order.product_name || ''
      }
    },
    orderPatch: {
      shipment_no: shipment?.shipment_no || shipment?.docNo || '',
      sales_outbound_no: outboundNo,
      sales_outbound_status: '待仓储补录',
      sales_outbound_pushed_at: pushedAt,
      workflow_status: 'running',
      workflow_key: 'sales_to_shipment_outbound'
    },
    nextOrderStatus: order.order_status === '草稿' ? '已确认' : null,
    outbound: { outbound_no: outboundNo, status: '待仓储补录' }
  }
}

export const buildSalesPurchaseDemandPlan = ({ order, demandNo } = {}) => {
  requireSalesOrder(order, '销售订单缺少主键，不能下推')
  const quantity = requirePositiveQuantity(order)
  return {
    quantity,
    demandPayload: {
      demand_no: demandNo,
      material_no: order.properties?.product_material_code || '',
      material_name: order.product_name || '待录入物料',
      quantity,
      unit: order.unit || '箱',
      required_date: order.delivery_date || null,
      source_dept: '销售订单',
      requester_name: order.owner_name || '',
      preferred_supplier: '',
      demand_status: '待采购',
      status: 'active',
      properties: {
        source_type: 'sales_order',
        source_order_id: order.id,
        source_order_no: order.order_no || '',
        source_order_nos: order.order_no || '',
        audit_status: '未提交',
        workflow_status: 'not_started',
        workflow_key: 'sales_to_purchase_inbound',
        customer_name: order.customer_name || '',
        product_name: order.product_name || '',
        product_material_id: order.product_material_id || order.properties?.product_material_id || null,
        product_material_code: order.properties?.product_material_code || ''
      }
    }
  }
}

export const buildSalesPurchaseDemandCompletion = ({
  order,
  demand,
  demandPayload,
  quantity,
  pushedAt
} = {}) => {
  const source = getSalesOrderSourceDoc(order)
  const target = {
    docType: SALES_FLOW_DOC_TYPES.PURCHASE_DEMAND,
    docId: demand?.id || null,
    docNo: demand?.demand_no || demandPayload?.demand_no
  }
  return {
    documentLink: {
      source,
      target,
      relationType: SALES_FLOW_RELATION_TYPES.SALES_TO_PURCHASE_DEMAND,
      quantity,
      amount: toSalesAmount(order?.total_amount),
      payload: {
        product_name: order?.product_name || '',
        customer_name: order?.customer_name || ''
      }
    },
    audit: {
      actionType: 'push_sales_order_to_purchase_demand',
      source,
      target,
      payload: { quantity, product_name: order?.product_name || '' }
    },
    orderPatch: {
      purchase_pushed_at: pushedAt,
      audit_status: order?.properties?.audit_status || '已审核',
      workflow_status: 'running',
      workflow_key: 'sales_to_purchase_inbound',
      purchase_demand_id: demand?.id || null,
      purchase_demand_no: demand?.demand_no || demandPayload?.demand_no
    }
  }
}
