// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getAuthHeader } from '@/utils/auth'

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
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: {
        ...apiHeaders,
        ...getAuthHeader(),
        Prefer: 'return=representation',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json().catch(() => null)
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
    const existing = await fetch(`/api/document_links?${buildLinkQuery(payload)}&select=id&limit=1`, {
      method: 'GET',
      headers: { ...apiHeaders, ...getAuthHeader() }
    })
    if (existing.ok) {
      const rows = await existing.json().catch(() => [])
      if (Array.isArray(rows) && rows.length > 0) return rows[0]
    }
  } catch {
    // optional flow table may not exist yet
  }
  return postOptionalRecord('/document_links', payload)
}

export const tryCreateDocumentAudit = async (payload) => postOptionalRecord('/document_flow_audits', payload)
