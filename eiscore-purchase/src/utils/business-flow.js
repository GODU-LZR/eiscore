// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import request from '@/utils/request'

const apiHeaders = { 'Accept-Profile': 'public', 'Content-Profile': 'public' }

export const DOC_TYPES = Object.freeze({
  SALES_ORDER: 'sales_order',
  PURCHASE_DEMAND: 'purchase_demand',
  PURCHASE_ORDER: 'purchase_order',
  PURCHASE_ARRIVAL: 'purchase_arrival',
  INVENTORY_INBOUND: 'inventory_inbound'
})

export const RELATION_TYPES = Object.freeze({
  SALES_TO_PURCHASE_DEMAND: 'sales_to_purchase_demand',
  DEMAND_TO_ORDER: 'demand_to_order',
  ORDER_TO_ARRIVAL: 'order_to_arrival',
  ARRIVAL_TO_INBOUND: 'arrival_to_inbound'
})

export const createDocumentLinkPayload = ({
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

const postOptionalRecord = async (path, payload) => {
  if (!payload) return null
  try {
    return await request({
      url: path,
      method: 'post',
      headers: {
        ...apiHeaders,
        Prefer: 'return=representation'
      },
      data: payload,
      silentError: true,
      suppressErrorMessage: true
    })
  } catch {
    return null
  }
}

const buildLinkQuery = (payload) => {
  const parts = [
    `source_doc_type=eq.${encodeURIComponent(payload.source_doc_type || '')}`,
    `target_doc_type=eq.${encodeURIComponent(payload.target_doc_type || '')}`,
    `relation_type=eq.${encodeURIComponent(payload.relation_type || '')}`,
    'status=eq.active'
  ]
  if (payload.source_doc_id) parts.push(`source_doc_id=eq.${encodeURIComponent(payload.source_doc_id)}`)
  else if (payload.source_doc_no) parts.push(`source_doc_no=eq.${encodeURIComponent(payload.source_doc_no)}`)
  if (payload.target_doc_id) parts.push(`target_doc_id=eq.${encodeURIComponent(payload.target_doc_id)}`)
  else if (payload.target_doc_no) parts.push(`target_doc_no=eq.${encodeURIComponent(payload.target_doc_no)}`)
  return parts.join('&')
}

export const tryCreateDocumentLink = async (payload) => {
  if (!payload) return null
  try {
    const rows = await request({
      url: `/document_links?${buildLinkQuery(payload)}&select=id&limit=1`,
      method: 'get',
      headers: apiHeaders,
      silentError: true,
      suppressErrorMessage: true
    })
    if (Array.isArray(rows) && rows.length > 0) return rows[0]
  } catch {
    // optional flow table may not exist yet
  }
  return postOptionalRecord('/document_links', payload)
}

export const tryCreateDocumentAudit = async (payload) => postOptionalRecord('/document_flow_audits', payload)
