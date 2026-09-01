// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const buildPurchaseDocumentFormValueKey = ({
  templateLibraryKey = '',
  templateId = ''
} = {}) => `${templateLibraryKey}:${templateId}`

export const buildPurchaseDocumentFormValuesQuery = ({
  rowId,
  templateLibraryKey,
  templateId
} = {}) => `/form_values?row_id=eq.${encodeURIComponent(String(rowId ?? ''))}&template_id=eq.${encodeURIComponent(buildPurchaseDocumentFormValueKey({ templateLibraryKey, templateId }))}`

export const splitPurchaseDocumentFormUpdate = ({
  currentRow,
  nextValue,
  knownKeys = [],
  supportsProperties = true
} = {}) => {
  const row = currentRow || {}
  const next = nextValue || {}
  const rowPatch = Object.fromEntries(
    Object.keys(row)
      .filter(key => key !== 'properties' && key in next)
      .map(key => [key, next[key]])
  )
  const nextProps = next.properties || {}
  if (!supportsProperties) return { rowPatch, properties: undefined, extraValues: { ...nextProps } }

  const known = new Set(knownKeys)
  const updatedProps = {}
  const extraValues = {}
  Object.entries(nextProps).forEach(([key, value]) => {
    if (known.has(key)) updatedProps[key] = value
    else extraValues[key] = value
  })
  const currentProps = row.properties || {}
  const properties = {}
  known.forEach((key) => {
    if (key in updatedProps) properties[key] = updatedProps[key]
    else if (key in currentProps) properties[key] = currentProps[key]
  })
  return { rowPatch, properties, extraValues }
}

export const buildPurchaseDocumentSavePayload = ({ row, supportsProperties = true } = {}) => {
  const { id, created_at, updated_at, arrived_quantity, pending_quantity, arrival_progress, ...payload } = row || {}
  if (supportsProperties) payload.properties = row?.properties || {}
  else delete payload.properties
  return payload
}
