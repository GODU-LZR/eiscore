// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const encodePurchaseDocumentFilterValue = (value) => (
  encodeURIComponent(String(value ?? ''))
)

export const buildPurchaseDocumentLinkQuery = ({
  direction = 'source',
  docType,
  docId,
  docNo
} = {}) => {
  const fieldPrefix = direction === 'target' ? 'target' : 'source'
  const clauses = []
  if (docId) clauses.push(`${fieldPrefix}_doc_id.eq.${encodePurchaseDocumentFilterValue(docId)}`)
  if (docNo) clauses.push(`${fieldPrefix}_doc_no.eq.${encodePurchaseDocumentFilterValue(docNo)}`)
  const orPart = clauses.length ? `&or=(${clauses.join(',')})` : ''
  return `${fieldPrefix}_doc_type=eq.${encodePurchaseDocumentFilterValue(docType)}&status=eq.active${orPart}&order=created_at.asc`
}

export const buildPurchaseDocumentRowsQuery = ({
  table,
  noField,
  ids = [],
  nos = [],
  limit = 50
} = {}) => {
  const clauses = []
  const cleanIds = ids.filter(Boolean).map(encodePurchaseDocumentFilterValue)
  const cleanNos = nos.filter(Boolean).map(encodePurchaseDocumentFilterValue)
  if (cleanIds.length) clauses.push(`id.in.(${cleanIds.join(',')})`)
  if (noField && cleanNos.length) clauses.push(`${noField}.in.(${cleanNos.join(',')})`)
  if (!clauses.length) return ''
  return `/${table}?or=(${clauses.join(',')})&select=*&limit=${limit}`
}

export const pickPurchaseDocumentRowForLinkSource = (rows, link, noField) => (
  (link?.source_doc_id && rows.find(item => item.id === link.source_doc_id))
    || (noField && link?.source_doc_no && rows.find(item => item[noField] === link.source_doc_no))
    || rows[0]
    || null
)

export const pickPurchaseDocumentRowForLinkTarget = (rows, link, noField) => (
  (link?.target_doc_id && rows.find(item => item.id === link.target_doc_id))
    || (noField && link?.target_doc_no && rows.find(item => item[noField] === link.target_doc_no))
    || rows[0]
    || null
)

export const buildPurchaseDocumentFlowNodes = ({ docs = {}, currentKey } = {}) => ([
  { key: 'so', type: '销售订单', docNo: docs.salesOrder?.order_no, status: docs.salesOrder?.order_status, current: false },
  { key: 'pr', type: '采购需求', docNo: docs.purchaseDemand?.demand_no, status: docs.purchaseDemand?.demand_status, current: currentKey === 'demands' },
  { key: 'po', type: '采购订单', docNo: docs.purchaseOrder?.order_no, status: docs.purchaseOrder?.order_status, current: currentKey === 'orders' },
  { key: 'pa', type: '到货/检验', docNo: docs.purchaseArrival?.arrival_no, status: docs.purchaseArrival?.arrival_status, current: currentKey === 'arrivals' },
  { key: 'in', type: '采购入库', docNo: docs.inventoryInbound?.inbound_no || docs.inventoryInbound?.docNo, status: docs.inventoryInbound?.status }
])

export const canReversePurchaseSalesDemandFlow = ({ docs = {}, permitted = false } = {}) => (
  Boolean(docs.salesOrder)
    && Boolean(docs.purchaseDemand)
    && !docs.purchaseOrder
    && Boolean(permitted)
)

export const buildPurchaseInventoryInboundProjection = (inboundLink) => (
  inboundLink
    ? {
        id: inboundLink.target_doc_id,
        inbound_no: inboundLink.target_doc_no,
        docNo: inboundLink.target_doc_no,
        status: inboundLink.status === 'active' ? '已入库' : inboundLink.status
      }
    : null
)

export const buildPurchaseSalesDemandReversePlan = ({
  link,
  demand = {},
  salesOrder = {},
  reason = '',
  linkReversedAt,
  demandReversedAt,
  docTypes = {}
} = {}) => ({
  linkPatch: link?.id
    ? {
        url: `/document_links?id=eq.${encodePurchaseDocumentFilterValue(link.id)}`,
        data: {
          status: 'reversed',
          reversed_by: 'purchase',
          reversed_at: linkReversedAt,
          reverse_reason: reason
        }
      }
    : null,
  demandPatch: {
    url: `/purchase_demands?id=eq.${encodePurchaseDocumentFilterValue(demand.id)}`,
    data: {
      demand_status: '已关闭',
      status: 'disabled',
      properties: {
        ...(demand.properties || {}),
        audit_status: '已反审核',
        reverse_audit_reason: reason,
        reverse_audit_at: demandReversedAt
      }
    }
  },
  audit: {
    actionType: 'reverse_sales_order_purchase_demand',
    source: { docType: docTypes.SALES_ORDER, docId: salesOrder.id, docNo: salesOrder.order_no || '' },
    target: { docType: docTypes.PURCHASE_DEMAND, docId: demand.id, docNo: demand.demand_no || '' },
    reason
  }
})
