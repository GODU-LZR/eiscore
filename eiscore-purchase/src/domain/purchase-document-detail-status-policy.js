// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const buildPurchaseSupplierReviewPatch = ({ row = {}, reviewDate = '', reviewedAt = '' } = {}) => ({
  supplier_status: '合作中',
  status: 'active',
  last_review_at: reviewDate,
  properties: { ...(row.properties || {}), reviewed_at: reviewedAt }
})

export const buildPurchaseSupplierPausePatch = ({ row = {}, reason = '', pausedAt = '' } = {}) => ({
  supplier_status: '暂停合作',
  status: 'disabled',
  properties: { ...(row.properties || {}), pause_reason: reason, paused_at: pausedAt }
})

export const buildPurchaseSupplierResumePatch = ({ row = {}, resumedAt = '' } = {}) => ({
  supplier_status: '合作中',
  status: 'active',
  properties: { ...(row.properties || {}), resumed_at: resumedAt }
})

export const buildPurchaseDemandSubmitPatch = () => ({
  demand_status: '待采购',
  status: 'active'
})

export const buildPurchaseDemandClosePatch = ({ row = {}, reason = '', closedAt = '' } = {}) => ({
  demand_status: '已关闭',
  status: 'disabled',
  properties: { ...(row.properties || {}), close_reason: reason, closed_at: closedAt }
})

export const buildPurchaseDemandReopenPatch = ({ row = {}, reopenedAt = '' } = {}) => ({
  demand_status: '待采购',
  status: 'active',
  properties: { ...(row.properties || {}), reopened_at: reopenedAt }
})

export const buildPurchaseOrderConfirmPatch = () => ({
  order_status: '已下单',
  status: 'active'
})

export const buildPurchaseOrderCancelPatch = ({ row = {}, reason = '', canceledAt = '' } = {}) => ({
  order_status: '已取消',
  status: 'disabled',
  properties: { ...(row.properties || {}), cancel_reason: reason, canceled_at: canceledAt }
})

export const buildPurchaseArrivalExceptionPatch = ({ row = {}, reason = '' } = {}) => ({
  accepted_quantity: 0,
  iqc_status: '不合格',
  arrival_status: '异常',
  status: 'active',
  properties: { ...(row.properties || {}), exception_note: reason }
})
