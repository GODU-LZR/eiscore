// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const buildPurchaseArrivalOrderLookupQuery = (row = {}) => {
  const filter = row.order_no
    ? `order_no=eq.${encodeURIComponent(row.order_no)}`
    : `material_name=eq.${encodeURIComponent(row.material_name || '')}`
  return `/v_purchase_order_progress?${filter}&arrival_progress=neq.已到齐&order_status=in.(已下单,部分到货)&status=eq.active&select=id,order_no,supplier_id,supplier_name,material_name,unit,pending_quantity&order=expected_arrival_date.asc&limit=1`
}

export const selectPurchaseArrivalLinkOrder = (orders) => (
  Array.isArray(orders) && orders.length > 0 ? orders[0] : null
)

export const buildPurchaseArrivalOrderLinkPatch = ({
  row = {},
  order = {},
  arrivalQuantity,
  linkedAt
} = {}) => ({
  order_id: order.id,
  order_no: order.order_no,
  supplier_id: order.supplier_id || null,
  supplier_name: order.supplier_name || row.supplier_name || '待选择供应商',
  material_name: order.material_name || row.material_name || '待录入物料',
  unit: order.unit || row.unit || 'kg',
  arrival_quantity: arrivalQuantity,
  properties: {
    ...(row.properties || {}),
    source_order_id: order.id,
    linked_order_at: linkedAt
  }
})
