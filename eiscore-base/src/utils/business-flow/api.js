// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import request from '@/utils/request'
import {
  BUSINESS_FLOW_LANES,
  DOC_TYPES,
  RELATION_TYPES,
  getLaneByDocType
} from './config'

const apiHeaders = { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
const scmHeaders = { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' }

const asArray = (value) => (Array.isArray(value) ? value : [])

const normalizeNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const optionalRequest = async (config, fallback = []) => {
  try {
    const res = await request(config)
    return Array.isArray(res) ? res : fallback
  } catch (error) {
    return fallback
  }
}

const splitDocNos = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const newestDate = (...values) => values.find((item) => item) || ''

const getDocNo = (lane, row) => String(row?.[lane.noField] || '').trim()

const getDocStatus = (lane, row) => String(row?.[lane.statusField] || row?.status || '').trim()

const buildDocNode = (lane, row, extra = {}) => {
  const docNo = extra.docNo || getDocNo(lane, row)
  return {
    id: `${lane.key}:${row.id || docNo || extra.fallbackId || Date.now()}`,
    docType: lane.key,
    docTitle: lane.title,
    appKey: lane.appKey || '',
    table: lane.table,
    rowId: row.id || '',
    docNo,
    title: docNo || row.name || row.material_name || row.product_material_name || row.product_name || lane.title,
    materialName: row.material_name || row.product_material_name || row.product_name || '',
    docName: row.product_name || row.product_material_name || row.bom_name || row.customer_name || row.material_name || '',
    quantity: normalizeNumber(row.quantity ?? row.arrival_quantity ?? row.accepted_quantity ?? row.planned_qty ?? row.required_qty),
    unit: row.unit || '',
    amount: normalizeNumber(row.total_amount),
    owner: row.buyer_name || row.requester_name || row.owner_name || row.handler_name || '',
    supplierName: row.supplier_name || row.preferred_supplier || row.customer_name || '',
    status: getDocStatus(lane, row),
    rawStatus: row.status || '',
    date: newestDate(row.required_date, row.order_date, row.arrival_date, row.payment_date, row.planned_start_date, row.expected_arrival_date, row.delivery_date),
    route: extra.route || lane.route || `${lane.routePrefix}/${row.id}?appKey=${lane.appKey}`,
    properties: row.properties || {},
    source: row,
    ...extra
  }
}

const buildLink = (source, target, relationType, extra = {}) => ({
  id: `${source.id}->${target.id}:${relationType}`,
  source: source.id,
  target: target.id,
  sourceDocNo: source.docNo,
  targetDocNo: target.docNo,
  relationType,
  label: extra.label || '',
  status: extra.status || 'active',
  quantity: extra.quantity ?? null,
  amount: extra.amount ?? null,
  reversible: extra.reversible !== false,
  ...extra
})

const linkKey = (link) => [
  link.relationType || '',
  link.source || link.sourceDocNo || '',
  link.target || link.targetDocNo || ''
].join('|')

const pushUniqueLink = (links, link) => {
  if (!link) return
  const key = linkKey(link)
  if (links.some((item) => linkKey(item) === key)) return
  links.push(link)
}

const buildPersistedLink = (row, nodeByDocKey) => {
  const source = nodeByDocKey.get(`${row.source_doc_type}:${row.source_doc_id}`)
    || nodeByDocKey.get(`${row.source_doc_type}:${row.source_doc_no}`)
  const target = nodeByDocKey.get(`${row.target_doc_type}:${row.target_doc_id}`)
    || nodeByDocKey.get(`${row.target_doc_type}:${row.target_doc_no}`)
  if (!source || !target) return null
  return buildLink(source, target, row.relation_type, {
    id: row.id || `${source.id}->${target.id}:${row.relation_type}`,
    label: row.payload?.label || '',
    status: row.status || 'active',
    quantity: row.quantity ?? null,
    amount: row.amount ?? null,
    persisted: true,
    reversible: row.relation_type !== RELATION_TYPES.ARRIVAL_TO_INBOUND
  })
}

const getSelectFields = () => ({
  salesOrders: 'id,order_no,customer_name,product_name,quantity,unit,total_amount,order_date,delivery_date,order_status,status,properties,created_at,updated_at',
  salesPayments: 'id,payment_no,order_id,order_no,customer_name,amount,payment_date,verify_status,handler_name,status,properties,created_at,updated_at',
  demands: 'id,demand_no,material_no,material_name,quantity,unit,required_date,source_dept,requester_name,preferred_supplier,demand_status,status,properties,created_at,updated_at',
  orders: 'id,order_no,demand_id,source_demand_no,supplier_id,supplier_name,material_name,quantity,unit,unit_price,total_amount,order_date,expected_arrival_date,buyer_name,order_status,status,properties,created_at,updated_at',
  arrivals: 'id,arrival_no,order_id,order_no,supplier_id,supplier_name,material_name,arrival_quantity,accepted_quantity,unit,arrival_date,iqc_status,arrival_status,inbound_no,status,properties,created_at,updated_at',
  boms: 'id,bom_no,bom_name,parent_material_id,parent_material_code,parent_material_name,version,status,properties,updated_at',
  productionPlans: 'row_no,product_material_id,product_material_code,product_material_name,sales_qty,finished_available_qty,planned_qty,unit,source_order_nos,bom_id,bom_no,bom_version,plan_status',
  workOrders: 'id,work_order_no,product_material_id,product_material_code,product_material_name,planned_qty,unit,planned_start_date,planned_finish_date,work_order_status,bom_id,bom_no,bom_version,source_order_nos,priority,properties,updated_at',
  workOrderItems: 'id,work_order_id,work_order_no,product_material_id,product_material_code,product_material_name,line_no,component_material_code,component_material_name,required_qty,issued_qty,shortage_qty,unit,issue_status,properties,updated_at'
})

export const loadPurchaseFlowData = async () => {
  const fields = getSelectFields()
  const [
    salesOrdersRes,
    salesPaymentsRes,
    demandsRes,
    ordersRes,
    arrivalsRes,
    bomsRes,
    productionPlansRes,
    workOrdersRes,
    workOrderItemsRes
  ] = await Promise.all([
    optionalRequest({
      url: `/api/sales_orders?status=neq.deleted&select=${fields.salesOrders}&order=updated_at.desc&limit=100`,
      method: 'get',
      headers: apiHeaders
    }),
    optionalRequest({
      url: `/api/sales_payments?status=neq.deleted&select=${fields.salesPayments}&order=updated_at.desc&limit=100`,
      method: 'get',
      headers: apiHeaders
    }),
    optionalRequest({
      url: `/api/purchase_demands?status=neq.deleted&select=${fields.demands}&order=updated_at.desc&limit=200`,
      method: 'get',
      headers: apiHeaders
    }),
    optionalRequest({
      url: `/api/purchase_orders?status=neq.deleted&select=${fields.orders}&order=updated_at.desc&limit=200`,
      method: 'get',
      headers: apiHeaders
    }),
    optionalRequest({
      url: `/api/purchase_arrivals?status=neq.deleted&select=${fields.arrivals}&order=updated_at.desc&limit=300`,
      method: 'get',
      headers: apiHeaders
    }),
    optionalRequest({
      url: `/api/v_boms?select=${fields.boms}&order=updated_at.desc&limit=100`,
      method: 'get',
      headers: scmHeaders
    }),
    optionalRequest({
      url: `/api/v_sales_bom_production_plan?select=${fields.productionPlans}&limit=100`,
      method: 'get',
      headers: scmHeaders
    }),
    optionalRequest({
      url: `/api/v_production_work_orders?select=${fields.workOrders}&order=updated_at.desc&limit=100`,
      method: 'get',
      headers: scmHeaders
    }),
    optionalRequest({
      url: `/api/v_production_work_order_items?select=${fields.workOrderItems}&order=updated_at.desc&limit=200`,
      method: 'get',
      headers: scmHeaders
    })
  ])

  const salesOrderLane = getLaneByDocType(DOC_TYPES.SALES_ORDER)
  const paymentLane = getLaneByDocType(DOC_TYPES.SALES_PAYMENT)
  const bomLane = getLaneByDocType(DOC_TYPES.BOM)
  const demandLane = getLaneByDocType(DOC_TYPES.PURCHASE_DEMAND)
  const orderLane = getLaneByDocType(DOC_TYPES.PURCHASE_ORDER)
  const arrivalLane = getLaneByDocType(DOC_TYPES.PURCHASE_ARRIVAL)
  const inboundLane = getLaneByDocType(DOC_TYPES.INVENTORY_INBOUND)
  const planLane = getLaneByDocType(DOC_TYPES.PRODUCTION_ORDER)
  const workOrderLane = getLaneByDocType(DOC_TYPES.WORK_ORDER)
  const workOrderItemLane = getLaneByDocType(DOC_TYPES.WORK_ORDER_ITEM)

  const salesOrderNodes = asArray(salesOrdersRes).map((row) => buildDocNode(salesOrderLane, row, {
    materialName: row.product_name || row.properties?.product_material_code || '',
    route: '/sales/app/orders'
  }))
  const paymentNodes = asArray(salesPaymentsRes).map((row) => buildDocNode(paymentLane, row, {
    amount: normalizeNumber(row.amount),
    route: '/sales/app/payments'
  }))
  const bomNodes = asArray(bomsRes).map((row) => buildDocNode(bomLane, row, {
    materialName: row.parent_material_name || '',
    route: '/production/app/bom_list'
  }))
  const demandNodes = asArray(demandsRes).map((row) => buildDocNode(demandLane, row))
  const orderNodes = asArray(ordersRes).map((row) => buildDocNode(orderLane, row))
  const arrivalNodes = asArray(arrivalsRes).map((row) => buildDocNode(arrivalLane, row))
  const inboundNodes = asArray(arrivalsRes)
    .filter((row) => String(row.inbound_no || '').trim())
    .map((row) => buildDocNode(inboundLane, {
      id: `inbound-${row.id}`,
      inbound_no: row.inbound_no,
      material_name: row.material_name,
      accepted_quantity: row.accepted_quantity,
      unit: row.unit,
      status: '已入库',
      arrival_date: row.arrival_date,
      supplier_name: row.supplier_name,
      properties: {
        source_arrival_id: row.id,
        source_arrival_no: row.arrival_no
      }
    }, { sourceArrivalId: row.id, sourceArrivalNo: row.arrival_no }))
  const planNodes = asArray(productionPlansRes).map((row) => buildDocNode(planLane, {
    id: `plan-${row.product_material_id || row.row_no}`,
    source_order_nos: row.source_order_nos || row.product_material_code || '',
    product_material_name: row.product_material_name,
    planned_qty: row.planned_qty,
    unit: row.unit,
    plan_status: row.plan_status,
    properties: {
      source_order_nos: row.source_order_nos || '',
      bom_no: row.bom_no || '',
      bom_id: row.bom_id || '',
      product_material_id: row.product_material_id || ''
    }
  }, {
    docNo: row.product_material_code || row.source_order_nos || '',
    materialName: row.product_material_name || '',
    quantity: normalizeNumber(row.planned_qty),
    route: '/production/app/plans',
    fallbackId: row.row_no || row.product_material_id
  }))
  const workOrderNodes = asArray(workOrdersRes).map((row) => buildDocNode(workOrderLane, row, {
    materialName: row.product_material_name || '',
    quantity: normalizeNumber(row.planned_qty),
    route: '/production/app/work_orders'
  }))
  const workOrderItemNodes = asArray(workOrderItemsRes).map((row) => buildDocNode(workOrderItemLane, row, {
    docNo: `${row.work_order_no || ''}-${row.line_no || row.id || ''}`,
    materialName: row.component_material_name || '',
    quantity: normalizeNumber(row.required_qty),
    route: '/production/app/work_order_items'
  }))

  const nodes = [
    ...salesOrderNodes,
    ...paymentNodes,
    ...bomNodes,
    ...demandNodes,
    ...orderNodes,
    ...arrivalNodes,
    ...inboundNodes,
    ...planNodes,
    ...workOrderNodes,
    ...workOrderItemNodes
  ]
  const nodeById = new Map(nodes.map((item) => [item.id, item]))
  const nodeByDocKey = new Map()
  nodes.forEach((item) => {
    if (item.rowId) nodeByDocKey.set(`${item.docType}:${item.rowId}`, item)
    if (item.docNo) nodeByDocKey.set(`${item.docType}:${item.docNo}`, item)
  })
  const demandById = new Map(demandNodes.map((item) => [String(item.rowId), item]))
  const demandByNo = new Map(demandNodes.map((item) => [item.docNo, item]).filter(([, value]) => value))
  const orderById = new Map(orderNodes.map((item) => [String(item.rowId), item]))
  const orderByNo = new Map(orderNodes.map((item) => [item.docNo, item]).filter(([, value]) => value))
  const arrivalById = new Map(arrivalNodes.map((item) => [String(item.rowId), item]))
  const salesOrderById = new Map(salesOrderNodes.map((item) => [String(item.rowId), item]))
  const salesOrderByNo = new Map(salesOrderNodes.map((item) => [item.docNo, item]).filter(([, value]) => value))
  const bomById = new Map(bomNodes.map((item) => [String(item.rowId), item]))
  const bomByNo = new Map(bomNodes.map((item) => [item.docNo, item]).filter(([, value]) => value))
  const planByProduct = new Map(planNodes.map((item) => [String(item.properties?.product_material_id || ''), item]).filter(([, value]) => value))
  const workOrderById = new Map(workOrderNodes.map((item) => [String(item.rowId), item]))
  const workOrderByNo = new Map(workOrderNodes.map((item) => [item.docNo, item]).filter(([, value]) => value))

  let links = []

  try {
    const persisted = await request({
      url: '/api/document_links?status=eq.active&select=id,source_doc_type,source_doc_id,source_doc_no,target_doc_type,target_doc_id,target_doc_no,relation_type,quantity,amount,status,payload,created_at&order=created_at.desc&limit=1000',
      method: 'get',
      headers: apiHeaders
    })
    links = asArray(persisted)
      .map((item) => buildPersistedLink(item, nodeByDocKey))
      .filter(Boolean)
  } catch (error) {
    links = []
  }

  asArray(ordersRes).forEach((row) => {
    const source = demandById.get(String(row.demand_id || '')) || demandByNo.get(String(row.source_demand_no || '').trim())
    const target = orderById.get(String(row.id || ''))
    if (!source || !target) return
    pushUniqueLink(links, buildLink(source, target, RELATION_TYPES.DEMAND_TO_ORDER, {
      label: '生成订单',
      quantity: normalizeNumber(row.quantity),
      amount: normalizeNumber(row.total_amount)
    }))
  })

  asArray(demandsRes).forEach((row) => {
    const sourceOrderNos = splitDocNos(row.properties?.source_order_nos)
    const target = demandById.get(String(row.id || ''))
    sourceOrderNos.forEach((orderNo) => {
      const source = salesOrderByNo.get(orderNo)
      if (!source || !target) return
      pushUniqueLink(links, buildLink(source, target, RELATION_TYPES.SALES_TO_PURCHASE_DEMAND, {
        label: 'MRP生成需求',
        quantity: normalizeNumber(row.quantity)
      }))
    })
  })

  asArray(arrivalsRes).forEach((row) => {
    const source = orderById.get(String(row.order_id || '')) || orderByNo.get(String(row.order_no || '').trim())
    const target = arrivalById.get(String(row.id || ''))
    if (!source || !target) return
    pushUniqueLink(links, buildLink(source, target, RELATION_TYPES.ORDER_TO_ARRIVAL, {
      label: '登记到货',
      quantity: normalizeNumber(row.arrival_quantity)
    }))
  })

  asArray(productionPlansRes).forEach((row) => {
    const plan = planByProduct.get(String(row.product_material_id || ''))
    const bom = bomById.get(String(row.bom_id || '')) || bomByNo.get(String(row.bom_no || '').trim())
    if (bom && plan) {
      pushUniqueLink(links, buildLink(bom, plan, RELATION_TYPES.SALES_TO_BOM, {
        label: 'BOM参与计划',
        quantity: normalizeNumber(row.planned_qty)
      }))
    }
    splitDocNos(row.source_order_nos).forEach((orderNo) => {
        const salesOrder = salesOrderByNo.get(orderNo)
        if (!salesOrder || !plan) return
        pushUniqueLink(links, buildLink(salesOrder, plan, RELATION_TYPES.SALES_TO_PRODUCTION_PLAN, {
          label: '销售生成生产建议',
          quantity: normalizeNumber(row.planned_qty)
        }))
      })
  })

  asArray(workOrdersRes).forEach((row) => {
    const plan = planByProduct.get(String(row.product_material_id || ''))
    const target = workOrderById.get(String(row.id || ''))
    if (plan && target) {
      pushUniqueLink(links, buildLink(plan, target, RELATION_TYPES.PRODUCTION_PLAN_TO_WORK_ORDER, {
        label: '生成生产工单',
        quantity: normalizeNumber(row.planned_qty)
      }))
    }
    splitDocNos(row.source_order_nos).forEach((orderNo) => {
        const source = salesOrderByNo.get(orderNo)
        if (!source || !target) return
        pushUniqueLink(links, buildLink(source, target, RELATION_TYPES.SALES_TO_PRODUCTION_PLAN, {
          label: '销售关联工单',
          quantity: normalizeNumber(row.planned_qty)
        }))
      })
  })

  asArray(workOrderItemsRes).forEach((row) => {
    const source = workOrderById.get(String(row.work_order_id || '')) || workOrderByNo.get(String(row.work_order_no || '').trim())
    const target = workOrderItemNodes.find((item) => item.rowId === row.id)
    if (!source || !target) return
    pushUniqueLink(links, buildLink(source, target, RELATION_TYPES.WORK_ORDER_TO_ISSUE, {
      label: '生成领料清单',
      quantity: normalizeNumber(row.required_qty),
      reversible: false
    }))
  })

  asArray(salesPaymentsRes).forEach((row) => {
    const source = salesOrderById.get(String(row.order_id || '')) || salesOrderByNo.get(String(row.order_no || '').trim())
    const target = paymentNodes.find((item) => item.rowId === row.id)
    if (!source || !target) return
    pushUniqueLink(links, buildLink(source, target, RELATION_TYPES.SALES_TO_PAYMENT, {
      label: '订单回款',
      amount: normalizeNumber(row.amount),
      reversible: false
    }))
  })

  inboundNodes.forEach((target) => {
    const source = arrivalById.get(String(target.sourceArrivalId || ''))
    if (!source) return
    pushUniqueLink(links, buildLink(source, target, RELATION_TYPES.ARRIVAL_TO_INBOUND, {
      label: '确认入库',
      quantity: normalizeNumber(target.quantity),
      reversible: false
    }))
  })

  return {
    lanes: BUSINESS_FLOW_LANES.map((lane) => ({
      ...lane,
      nodes: nodes.filter((node) => node.docType === lane.key)
    })),
    nodes,
    nodeById,
    links,
    stats: {
      demandCount: demandNodes.length,
      salesOrderCount: salesOrderNodes.length,
      bomCount: bomNodes.length,
      productionPlanCount: planNodes.length,
      workOrderCount: workOrderNodes.length,
      orderCount: orderNodes.length,
      arrivalCount: arrivalNodes.length,
      inboundCount: inboundNodes.length,
      paymentCount: paymentNodes.length,
      linkCount: links.length,
      exceptionCount: nodes.filter((item) => ['异常', '不合格', '已取消', '已关闭'].includes(item.status)).length
    }
  }
}

export const tryCreateDocumentLink = async (payload) => {
  if (!payload) return null
  try {
    return await request({
      url: '/api/document_links',
      method: 'post',
      headers: { ...apiHeaders, Prefer: 'return=representation' },
      data: payload
    })
  } catch (error) {
    if (error?.response?.status !== 404) console.warn('[business-flow] document link write skipped:', error)
    return null
  }
}

export const tryCreateDocumentAudit = async (payload) => {
  if (!payload) return null
  try {
    return await request({
      url: '/api/document_flow_audits',
      method: 'post',
      headers: { ...apiHeaders, Prefer: 'return=minimal' },
      data: payload
    })
  } catch (error) {
    if (error?.response?.status !== 404) console.warn('[business-flow] audit write skipped:', error)
    return null
  }
}
