// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const resolveProductionDefaultOrder = (appKey) => {
  if (appKey === 'plans') return 'product_material_code.asc'
  if (appKey === 'work_order_items') return 'work_order_no.asc,line_no.asc'
  return 'created_at.desc'
}

export const isProductionSelectColumnConfig = (column) => {
  if (!column) return false
  if (column.type === 'select' || column.type === 'dropdown') return true
  return Array.isArray(column.options) && column.options.length > 0
}

export const isProductionCascaderColumnConfig = (column) => {
  if (!column || column.type !== 'cascader') return false
  return Boolean(column.cascaderOptions && Object.keys(column.cascaderOptions).length > 0)
}

export const normalizeProductionCascaderOption = (option) => {
  if (option === null || option === undefined) return null
  if (typeof option === 'string' || typeof option === 'number') {
    const text = String(option)
    return { label: text, value: text }
  }
  const label = option.label ?? option.value ?? ''
  const value = option.value ?? option.label ?? ''
  return {
    label: String(label || value),
    value: String(value || label)
  }
}

export const buildProductionCascaderParentColumns = (columns) => {
  if (!Array.isArray(columns)) return []
  return columns.filter((column) => (
    isProductionSelectColumnConfig(column)
    || isProductionCascaderColumnConfig(column)
    || column?.type === 'cascader'
  ))
}

export const buildProductionCascaderParentOptions = (columns, dependsOn) => {
  const parentColumn = (Array.isArray(columns) ? columns : []).find((column) => column?.prop === dependsOn)
  if (!parentColumn) return []
  if (Array.isArray(parentColumn.options)) {
    return parentColumn.options
      .map(normalizeProductionCascaderOption)
      .filter((option) => option && option.label !== '')
  }
  if (parentColumn.type !== 'cascader' || !parentColumn.cascaderOptions) return []

  const options = []
  const seen = new Set()
  Object.values(parentColumn.cascaderOptions).forEach((items) => {
    if (!Array.isArray(items)) return
    items.forEach((item) => {
      const normalized = normalizeProductionCascaderOption(item)
      if (!normalized || normalized.label === '') return
      const key = String(normalized.value)
      if (seen.has(key)) return
      seen.add(key)
      options.push(normalized)
    })
  })
  return options
}

export const normalizeProductionCascaderMap = (map) => {
  const result = {}
  if (!map || typeof map !== 'object') return result
  Object.entries(map).forEach(([key, list]) => {
    if (!Array.isArray(list)) return
    result[String(key)] = list
      .map((item) => {
        if (item === null || item === undefined) return ''
        if (typeof item === 'string' || typeof item === 'number') return String(item)
        return String(item.label ?? item.value ?? '')
      })
      .filter(Boolean)
  })
  return result
}

export const cloneProductionColumns = (columns) => JSON.parse(JSON.stringify(columns || []))

export const buildProductionDataStats = (rows) => {
  const stats = { totalCount: 0, statusCounts: {}, productCounts: {} }
  if (!Array.isArray(rows)) return stats
  stats.totalCount = rows.length
  rows.forEach((row) => {
    const status = row?.work_order_status || row?.plan_status || row?.issue_status || row?.status || '未设置'
    stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1
    const product = row?.product_material_code || row?.product_material_name
    if (product) stats.productCounts[product] = (stats.productCounts[product] || 0) + 1
  })
  return stats
}

export const buildProductionDataSample = (rows, columns, limit = 50) => {
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

export const buildProductionAiColumns = (columns) => {
  if (!Array.isArray(columns)) return []
  return columns.map((column) => ({
    label: column.label,
    prop: column.prop,
    type: column.type || 'text',
    options: column.options || [],
    dependsOn: column.dependsOn || '',
    cascaderOptions: column.cascaderOptions || null,
    expression: column.expression || ''
  }))
}
