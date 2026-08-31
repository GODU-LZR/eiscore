// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const TEMPLATE_SCOPE_KEYS = ['app', 'key', 'appId', 'configKey', 'apiUrl', 'templateLibraryKey']

export const getAiTemplateSectionCount = (schema) => {
  if (!schema?.layout) return 0
  return schema.layout.filter((item) => item.type === 'section').length
}

export const getAiTemplateTableCount = (schema) => {
  if (!schema?.layout) return 0
  return schema.layout.filter((item) => item.type === 'table').length
}

export const resolveAiTemplateLibraryKey = (context) => {
  const key = context?.templateLibraryKey || context?.formTemplateKey
  return key && typeof key === 'string' ? key : 'form_templates'
}

export const resolveAiTemplateScope = (context) => {
  const scope = context?.templateScope || context?.formTemplateScope || null
  return scope && typeof scope === 'object' ? scope : {}
}

export const getAiTemplateRecordScope = (template) => {
  const scope = template?.scope || template?.schema?.scope || null
  return scope && typeof scope === 'object' ? scope : {}
}

export const isAiSameTemplateScope = (left, right) => TEMPLATE_SCOPE_KEYS.every((key) => (
  String(left?.[key] ?? '') === String(right?.[key] ?? '')
))

export const buildAiTemplateRecord = (
  schema,
  context,
  { nowIso, nowMs } = {}
) => {
  const scope = {
    ...resolveAiTemplateScope(context),
    templateLibraryKey: resolveAiTemplateLibraryKey(context)
  }
  const scopedSchema = {
    ...schema,
    scope: {
      ...(schema.scope || {}),
      ...scope
    }
  }
  return {
    id: schema.templateId || schema.docType || `tpl_${nowMs}`,
    name: schema.title || schema.name || 'AI生成模板',
    schema: scopedSchema,
    scope,
    source: 'ai',
    created_at: nowIso,
    updated_at: nowIso
  }
}

export const mergeAiTemplateRecord = (
  templates,
  record,
  { updatedAt } = {}
) => {
  const index = templates.findIndex((item) => (
    item.id === record.id && isAiSameTemplateScope(getAiTemplateRecordScope(item), record.scope)
  ))
  if (index < 0) return [record, ...templates]
  return templates.map((item, itemIndex) => (
    itemIndex === index ? { ...item, ...record, updated_at: updatedAt } : item
  ))
}
