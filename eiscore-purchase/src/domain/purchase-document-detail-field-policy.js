// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const getPurchaseDocumentFieldValue = (rowData, prop) => {
  if (!rowData || !prop) return ''
  if (Object.prototype.hasOwnProperty.call(rowData, prop)) return rowData[prop]
  return rowData.properties?.[prop] ?? ''
}

export const setPurchaseDocumentFieldValue = (rowData, prop, value) => {
  if (!rowData || !prop) return
  if (Object.prototype.hasOwnProperty.call(rowData, prop)) {
    rowData[prop] = value
    return
  }
  if (!rowData.properties) rowData.properties = {}
  rowData.properties[prop] = value
}

export const normalizePurchaseDocumentOptionKey = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
}

export const normalizePurchaseDocumentOptionList = (options) => {
  if (!Array.isArray(options)) return []
  return options.map(opt => {
    if (opt && typeof opt === 'object') {
      return {
        label: opt.label ?? opt.value ?? '',
        value: opt.value ?? opt.label ?? ''
      }
    }
    return { label: String(opt), value: opt }
  })
}

export const sanitizePurchaseDocumentCascaderValues = (rowData, dynamicColumns = []) => {
  if (!rowData) return
  const cascaderColumns = (Array.isArray(dynamicColumns) ? dynamicColumns : [])
    .filter(col => col?.type === 'cascader' && col.dependsOn && col.cascaderOptions)
  cascaderColumns.forEach(col => {
    const parentValue = getPurchaseDocumentFieldValue(rowData, col.dependsOn)
    const map = col.cascaderOptions || {}
    const key = normalizePurchaseDocumentOptionKey(parentValue)
    const options = map[key] || map[parentValue] || []
    const allowed = new Set(normalizePurchaseDocumentOptionList(options)
      .map(opt => normalizePurchaseDocumentOptionKey(opt.value)))
    const current = getPurchaseDocumentFieldValue(rowData, col.prop)
    if (current && !allowed.has(normalizePurchaseDocumentOptionKey(current))) {
      setPurchaseDocumentFieldValue(rowData, col.prop, '')
    }
  })
}

export const buildPurchaseDocumentFileColumnPayload = (columns, rowData) => {
  if (!rowData) return []
  return (Array.isArray(columns) ? columns : [])
    .filter(col => col.type === 'file')
    .map(col => {
      const rawValue = getPurchaseDocumentFieldValue(rowData, col.prop)
      const rawFiles = Array.isArray(rawValue) ? rawValue : []
      const files = rawFiles
        .map(file => ({
          name: file?.name || file?.fileName || file?.filename || '文件',
          url: file?.url || file?.file_url || file?.dataUrl || ''
        }))
        .filter(file => file.name)
      return { label: col.label, prop: col.prop, files }
    })
}
