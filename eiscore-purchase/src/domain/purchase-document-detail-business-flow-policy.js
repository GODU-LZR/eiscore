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
