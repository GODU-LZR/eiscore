// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const buildPurchaseOrderDuplicateQuery = ({ demandId, demandNo } = {}) => {
  const conditions = [`demand_id.eq.${demandId}`]
  if (demandNo) conditions.push(`source_demand_no.eq.${encodeURIComponent(demandNo)}`)
  return `/purchase_orders?or=(${conditions.join(',')})&order_status=neq.已取消&status=neq.disabled&select=id,order_no&limit=1`
}

export const buildPurchaseOrderDraft = ({ row = {}, supplier = null, orderNo, orderDate } = {}) => ({
  order_no: orderNo,
  demand_id: row.id,
  source_demand_no: row.demand_no || '',
  supplier_id: supplier?.id || null,
  supplier_name: supplier?.name || row.preferred_supplier || '待选择供应商',
  material_name: row.material_name || '待录入物料',
  quantity: Number(row.quantity) || 0,
  unit: row.unit || 'kg',
  unit_price: 0,
  total_amount: 0,
  order_date: orderDate,
  expected_arrival_date: row.required_date || null,
  buyer_name: supplier?.buyer_name || row.requester_name || '',
  order_status: '草稿',
  status: 'draft',
  properties: {
    source_dept: row.source_dept || '',
    supplier_lead_time_days: supplier?.lead_time_days ?? null,
    source_demand_id: row.id
  }
})
