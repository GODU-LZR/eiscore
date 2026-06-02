// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const DOC_TYPES = Object.freeze({
  SALES_ORDER: 'sales_order',
  BOM: 'bom',
  PRODUCTION_ORDER: 'production_order',
  WORK_ORDER: 'work_order',
  WORK_ORDER_ITEM: 'work_order_item',
  PURCHASE_DEMAND: 'purchase_demand',
  PURCHASE_ORDER: 'purchase_order',
  PURCHASE_ARRIVAL: 'purchase_arrival',
  INVENTORY_INBOUND: 'inventory_inbound',
  SALES_SHIPMENT: 'sales_shipment',
  SALES_PAYMENT: 'sales_payment'
})

export const BUSINESS_FLOW_LANES = Object.freeze([
  {
    key: DOC_TYPES.SALES_ORDER,
    title: '销售订单',
    subtitle: 'SO',
    table: 'sales_orders',
    routePrefix: '/sales/app/orders',
    noField: 'order_no',
    statusField: 'order_status'
  },
  {
    key: DOC_TYPES.BOM,
    title: 'BOM',
    subtitle: 'BOM',
    table: 'boms',
    routePrefix: '/production/app/bom_list',
    noField: 'bom_no',
    statusField: 'status'
  },
  {
    key: DOC_TYPES.PURCHASE_DEMAND,
    title: '采购需求',
    subtitle: 'PR',
    table: 'purchase_demands',
    appKey: 'demands',
    routePrefix: '/purchase/document',
    noField: 'demand_no',
    statusField: 'demand_status'
  },
  {
    key: DOC_TYPES.PURCHASE_ORDER,
    title: '采购订单',
    subtitle: 'PO',
    table: 'purchase_orders',
    appKey: 'orders',
    routePrefix: '/purchase/document',
    noField: 'order_no',
    statusField: 'order_status'
  },
  {
    key: DOC_TYPES.PURCHASE_ARRIVAL,
    title: '到货跟踪',
    subtitle: 'PA',
    table: 'purchase_arrivals',
    appKey: 'arrivals',
    routePrefix: '/purchase/document',
    noField: 'arrival_no',
    statusField: 'arrival_status'
  },
  {
    key: DOC_TYPES.INVENTORY_INBOUND,
    title: '入库结果',
    subtitle: 'IN',
    table: 'inventory_inbound',
    route: '/materials/inventory-ledger',
    noField: 'inbound_no',
    statusField: 'status'
  },
  {
    key: DOC_TYPES.PRODUCTION_ORDER,
    title: '生产订单',
    subtitle: 'MO',
    table: 'v_sales_bom_production_plan',
    routePrefix: '/production/app/plans',
    noField: 'source_order_nos',
    statusField: 'plan_status'
  },
  {
    key: DOC_TYPES.WORK_ORDER,
    title: '生产工单',
    subtitle: 'WO',
    table: 'v_production_work_orders',
    routePrefix: '/production/app/work_orders',
    noField: 'work_order_no',
    statusField: 'work_order_status'
  },
  {
    key: DOC_TYPES.WORK_ORDER_ITEM,
    title: '生产领料',
    subtitle: 'ISS',
    table: 'v_production_work_order_items',
    routePrefix: '/production/app/work_order_items',
    noField: 'work_order_no',
    statusField: 'issue_status'
  },
  {
    key: DOC_TYPES.SALES_PAYMENT,
    title: '回款记录',
    subtitle: 'PAY',
    table: 'sales_payments',
    routePrefix: '/sales/app/payments',
    noField: 'payment_no',
    statusField: 'verify_status'
  }
])

export const DOC_TYPE_LABELS = Object.freeze(
  BUSINESS_FLOW_LANES.reduce((map, item) => ({ ...map, [item.key]: item.title }), {})
)

export const RELATION_TYPES = Object.freeze({
  SALES_TO_BOM: 'sales_to_bom',
  SALES_TO_PURCHASE_DEMAND: 'sales_to_purchase_demand',
  SALES_TO_PRODUCTION_PLAN: 'sales_to_production_plan',
  PRODUCTION_PLAN_TO_WORK_ORDER: 'production_plan_to_work_order',
  WORK_ORDER_TO_ISSUE: 'work_order_to_issue',
  DEMAND_TO_ORDER: 'demand_to_order',
  ORDER_TO_ARRIVAL: 'order_to_arrival',
  ARRIVAL_TO_INBOUND: 'arrival_to_inbound',
  SALES_TO_PAYMENT: 'sales_to_payment'
})

export const BUSINESS_STATUS_META = Object.freeze({
  草稿: { label: '草稿', level: 'draft' },
  待采购: { label: '待采购', level: 'waiting' },
  已下单: { label: '已下单', level: 'active' },
  已关闭: { label: '已关闭', level: 'closed' },
  部分到货: { label: '部分到货', level: 'warning' },
  已完成: { label: '已完成', level: 'done' },
  已取消: { label: '已取消', level: 'closed' },
  已确认: { label: '已确认', level: 'active' },
  生产中: { label: '生产中', level: 'active' },
  已发货: { label: '已发货', level: 'active' },
  待到货: { label: '待到货', level: 'waiting' },
  待检验: { label: '待检验', level: 'warning' },
  已入库: { label: '已入库', level: 'done' },
  异常: { label: '异常', level: 'danger' },
  待检: { label: '待检', level: 'warning' },
  合格: { label: '合格', level: 'done' },
  不合格: { label: '不合格', level: 'danger' },
  让步接收: { label: '让步接收', level: 'warning' },
  启用: { label: '启用', level: 'active' },
  停用: { label: '停用', level: 'closed' },
  作废: { label: '作废', level: 'closed' },
  成品库存满足: { label: '成品库存满足', level: 'done' },
  已有工单: { label: '已有工单', level: 'active' },
  待生成工单: { label: '待生成工单', level: 'waiting' },
  待排产: { label: '待排产', level: 'waiting' },
  已排产: { label: '已排产', level: 'active' },
  已完工: { label: '已完工', level: 'done' },
  未领料: { label: '未领料', level: 'waiting' },
  部分领料: { label: '部分领料', level: 'warning' },
  已齐套: { label: '已齐套', level: 'done' },
  待核销: { label: '待核销', level: 'waiting' },
  部分核销: { label: '部分核销', level: 'warning' },
  已核销: { label: '已核销', level: 'done' },
  active: { label: '生效', level: 'active' },
  draft: { label: '草稿', level: 'draft' },
  disabled: { label: '停用', level: 'closed' },
  locked: { label: '锁定', level: 'closed' }
})

export const getBusinessStatusMeta = (value) => {
  const key = String(value || '').trim()
  return BUSINESS_STATUS_META[key] || { label: key || '未设置', level: 'empty' }
}

export const getLaneByDocType = (docType) => (
  BUSINESS_FLOW_LANES.find((item) => item.key === docType) || null
)
