// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const isPurchaseDocumentTemplate = (template) => Boolean(
  template && template.schema && Array.isArray(template.schema.layout)
)

export const applyPurchaseDocumentTemplateScope = (template, scope = {}) => ({
  ...template,
  scope: {
    ...(template.scope || {}),
    ...scope
  },
  schema: {
    ...(template.schema || {}),
    scope: {
      ...((template.schema || {}).scope || {}),
      ...scope
    }
  }
})

export const normalizePurchaseDocumentTemplates = (templates, scope = {}) => (
  Array.isArray(templates)
    ? templates.filter(isPurchaseDocumentTemplate)
      .map(template => applyPurchaseDocumentTemplateScope(template, scope))
    : []
)

export const selectPurchaseDocumentTemplateId = ({
  recordId,
  currentId,
  templates = []
} = {}) => recordId || currentId || templates[0]?.id || ''
