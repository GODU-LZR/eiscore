// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const isPurchaseRowActive = (row) => row?.status !== 'deleted'

export const isPurchaseSelectColumnConfig = (column) => (
  Boolean(column && Array.isArray(column.options) && column.options.length > 0)
)

export const isPurchaseCascaderColumnConfig = (column) => (
  Boolean(column?.type === 'cascader' && column.cascaderOptions && Object.keys(column.cascaderOptions).length > 0)
)

export const normalizePurchaseCascaderOption = (option) => {
  if (option === null || option === undefined) return null
  if (typeof option === 'string' || typeof option === 'number') {
    const text = String(option)
    return { label: text, value: text }
  }
  const label = option.label ?? option.value ?? ''
  const value = option.value ?? option.label ?? ''
  return { label: String(label || value), value: String(value || label) }
}

export const buildPurchaseCascaderParentColumns = (columns) => (
  (Array.isArray(columns) ? columns : []).filter((column) => (
    isPurchaseSelectColumnConfig(column)
    || isPurchaseCascaderColumnConfig(column)
    || column?.type === 'cascader'
  ))
)

export const buildPurchaseCascaderParentOptions = (columns, dependsOn) => {
  const parent = (Array.isArray(columns) ? columns : []).find((column) => column?.prop === dependsOn)
  if (!parent) return []
  if (Array.isArray(parent.options)) {
    return parent.options.map(normalizePurchaseCascaderOption).filter((option) => option && option.label !== '')
  }
  if (parent.type !== 'cascader' || !parent.cascaderOptions) return []
  const result = []
  const seen = new Set()
  Object.values(parent.cascaderOptions).forEach((items) => {
    if (!Array.isArray(items)) return
    items.forEach((item) => {
      const normalized = normalizePurchaseCascaderOption(item)
      if (!normalized || normalized.label === '') return
      const key = String(normalized.value)
      if (seen.has(key)) return
      seen.add(key)
      result.push(normalized)
    })
  })
  return result
}

export const normalizePurchaseCascaderMap = (map) => {
  const result = {}
  if (!map || typeof map !== 'object') return result
  Object.entries(map).forEach(([key, list]) => {
    if (!Array.isArray(list)) return
    result[String(key)] = list.map((item) => {
      if (item === null || item === undefined) return ''
      if (typeof item === 'string' || typeof item === 'number') return String(item)
      return String(item.label ?? item.value ?? '')
    }).filter(Boolean)
  })
  return result
}

export const clonePurchaseColumns = (columns) => JSON.parse(JSON.stringify(columns || []))

export const buildPurchaseDataStats = (rows) => {
  const stats = { totalCount: 0, sampleSize: 0, statusCounts: {}, buyerCounts: {}, supplierCounts: {} }
  if (!Array.isArray(rows)) return stats
  stats.totalCount = rows.length
  stats.sampleSize = rows.length
  rows.forEach((row) => {
    const status = row?.properties?.status || row?.status || '未设置'
    stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1
    const buyer = row?.buyer_name || row?.properties?.buyer_name
    if (buyer) stats.buyerCounts[buyer] = (stats.buyerCounts[buyer] || 0) + 1
    const supplier = row?.supplier_name || row?.name || row?.properties?.supplier_name
    if (supplier) stats.supplierCounts[supplier] = (stats.supplierCounts[supplier] || 0) + 1
  })
  return stats
}

export const buildPurchaseDataSample = (rows, columns, limit = 50) => {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, limit).map((row) => {
    const item = {}
    columns.forEach((column) => {
      const prop = column.prop
      if (!prop || column.type === 'file' || column.type === 'geo') return
      const value = row?.[prop] ?? row?.properties?.[prop]
      if (value !== undefined && value !== null && value !== '') item[prop] = value
    })
    if (row?.id !== undefined) item.id = row.id
    return item
  })
}

export const buildPurchaseAiColumns = (columns) => (
  (Array.isArray(columns) ? columns : []).map((column) => ({
    label: column.label,
    prop: column.prop,
    type: column.type || 'text',
    options: column.options || [],
    dependsOn: column.dependsOn || '',
    cascaderOptions: column.cascaderOptions || null,
    expression: column.expression || ''
  }))
)
