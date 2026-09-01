// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const cloneSchema = (schema) => JSON.parse(JSON.stringify(schema || {}))

export const renamePurchaseDocumentTemplate = ({
  templates = [],
  templateId,
  name,
  updatedAt,
  scope = {},
  applyScope
} = {}) => {
  const list = Array.isArray(templates) ? templates.map(template => ({ ...template })) : []
  const index = list.findIndex(template => template.id === templateId)
  if (index < 0) return list
  const nextSchema = { ...((list[index] || {}).schema || {}), title: name }
  const record = { ...list[index], name, schema: nextSchema, updated_at: updatedAt }
  list[index] = typeof applyScope === 'function' ? applyScope(record, scope) : record
  return list
}

export const buildPurchaseDocumentManualTemplate = ({
  id,
  name,
  schema,
  now,
  scope = {},
  applyScope
} = {}) => {
  const nextSchema = cloneSchema(schema)
  nextSchema.title = name
  nextSchema.docType = id
  const record = {
    id,
    name,
    schema: nextSchema,
    source: 'manual',
    created_at: now,
    updated_at: now
  }
  return typeof applyScope === 'function' ? applyScope(record, scope) : record
}

export const removePurchaseDocumentTemplate = ({
  templates = [],
  templateId,
  selectedId = ''
} = {}) => {
  const list = (Array.isArray(templates) ? templates : []).filter(template => template.id !== templateId)
  return {
    templates: list,
    selectedId: selectedId === templateId ? list[0]?.id || '' : selectedId
  }
}
