// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const calculatePurchaseDetailPendingArrivalQuantity = (orderQuantity, arrivals = []) => {
  const totalArrived = Array.isArray(arrivals)
    ? arrivals.reduce((sum, item) => sum + (Number(item?.arrival_quantity) || 0), 0)
    : 0
  return Math.max((Number(orderQuantity) || 0) - totalArrived, 0)
}

export const resolvePurchaseDetailAcceptedQuantity = (arrivalQuantity, acceptedQuantity) => {
  const arrivalTotal = Number(arrivalQuantity) || 0
  const accepted = Number(acceptedQuantity)
  return accepted > 0 ? Math.min(accepted, arrivalTotal) : arrivalTotal
}

export const resolvePurchaseDetailLinkedArrivalQuantity = (pendingQuantity, currentArrivalQuantity) => {
  const pending = Number(pendingQuantity) || 0
  return pending > 0 ? pending : (Number(currentArrivalQuantity) || 1)
}

export const buildPurchaseDetailArrivalDraft = ({ row = {}, arrivalQuantity, arrivalNo, arrivalDate } = {}) => ({
  arrival_no: arrivalNo,
  order_id: row.id,
  order_no: row.order_no || '',
  supplier_id: row.supplier_id || null,
  supplier_name: row.supplier_name || '',
  material_name: row.material_name || '待录入物料',
  arrival_quantity: arrivalQuantity,
  accepted_quantity: 0,
  unit: row.unit || 'kg',
  arrival_date: arrivalDate,
  iqc_status: '待检',
  inbound_no: '',
  arrival_status: '待检验',
  status: 'active',
  properties: { source_order_id: row.id }
})

export const buildPurchaseDetailInboundPatch = ({ row = {}, acceptedQuantity, inboundNo } = {}) => ({
  accepted_quantity: acceptedQuantity,
  iqc_status: row.iqc_status === '让步接收' ? '让步接收' : '合格',
  inbound_no: inboundNo,
  arrival_status: '已入库',
  status: 'active'
})
