// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const selectDocumentIntakeEntryResult = (detail, fallback = null) => (
  detail?.entryResult || fallback
)

export const getDocumentIntakeEntryResultDetailList = (detail, key) => (
  Array.isArray(detail?.[key]) ? detail[key] : []
)

export const getDocumentIntakeRejectedRows = (detail, entryResult) => {
  if (Array.isArray(detail?.rejectedRows)) return detail.rejectedRows
  const rejectedRows = entryResult?.metadata?.rejected_rows
  return Array.isArray(rejectedRows) ? rejectedRows : []
}

export const buildDocumentIntakeEntryResultDetailProjection = (detail, fallback = null) => {
  const entryResult = selectDocumentIntakeEntryResult(detail, fallback)
  return {
    entryResult,
    businessLinks: getDocumentIntakeEntryResultDetailList(detail, 'businessLinks'),
    businessCorrections: getDocumentIntakeEntryResultDetailList(detail, 'businessCorrections'),
    relatedLogs: getDocumentIntakeEntryResultDetailList(detail, 'relatedLogs'),
    unmappedFields: getDocumentIntakeEntryResultDetailList(detail, 'unmappedFields'),
    rejectedRows: getDocumentIntakeRejectedRows(detail, entryResult)
  }
}
