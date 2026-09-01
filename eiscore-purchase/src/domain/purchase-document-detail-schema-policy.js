// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { documentSchemaExample } from '../components/eis-document-engine/documentSchemaExample.js'

export const normalizePurchaseDocumentSchemaColumns = (cols) => (
  Array.isArray(cols)
    ? cols.filter(col => col && col.label && col.prop)
    : []
)

export const resolvePurchaseDocumentSchemaWidget = (col = {}) => {
  if (col.type === 'select') return 'select'
  if (col.type === 'cascader') return 'cascader'
  if (col.type === 'number') return 'number'
  if (String(col.prop || '').includes('date') || String(col.prop || '').endsWith('_at')) return 'date'
  if (col.type === 'file') return 'image'
  return 'input'
}

export const buildPurchaseDocumentSchemaSection = (title, cols) => {
  const list = normalizePurchaseDocumentSchemaColumns(cols)
  if (!list.length) return null
  return {
    type: 'section',
    title,
    cols: 2,
    children: list.map(col => ({
      label: col.label,
      field: col.prop,
      widget: resolvePurchaseDocumentSchemaWidget(col)
    }))
  }
}

export const getPurchaseDocumentNoField = (appKey) => ({
  suppliers: 'supplier_no',
  demands: 'demand_no',
  orders: 'order_no',
  arrivals: 'arrival_no'
}[appKey] || '')

export const buildPurchaseDocumentFallbackSchema = ({
  appKey,
  pageTitle,
  scope,
  staticColumns,
  dynamicColumns
} = {}) => {
  const baseSection = buildPurchaseDocumentSchemaSection('基础信息', staticColumns || [])
  const extraSection = buildPurchaseDocumentSchemaSection('扩展信息', dynamicColumns || [])
  const layout = [baseSection, extraSection].filter(Boolean)
  if (!layout.length) return documentSchemaExample
  return {
    docType: `purchase_${appKey || 'document'}_auto`,
    title: pageTitle,
    docNo: getPurchaseDocumentNoField(appKey),
    scope,
    layout
  }
}
