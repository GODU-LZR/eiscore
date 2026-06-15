// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { evaluateFormulaExpression } from './utils/formula-eval'

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

const normalizeColumn = (col, source = 'column') => ({
  label: col?.label || col?.headerName || col?.prop || col?.field || '',
  prop: col?.prop || col?.field || '',
  type: col?.type || 'text',
  source,
  expression: col?.expression || '',
  options: Array.isArray(col?.options) ? col.options : [],
  dependsOn: col?.dependsOn || '',
  cascaderOptions: col?.cascaderOptions || col?.cascaderMap || null
})

export function normalizeDocumentColumns(staticColumns = [], dynamicColumns = []) {
  const staticList = Array.isArray(staticColumns) ? staticColumns : []
  const dynamicList = Array.isArray(dynamicColumns) ? dynamicColumns : []
  return [
    ...staticList.map(col => normalizeColumn(col, 'column')),
    ...dynamicList.map(col => normalizeColumn(col, 'properties'))
  ].filter(col => col.prop)
}

export function getDocumentFieldValue(rowData, prop) {
  if (!rowData || !prop) return ''
  if (Object.prototype.hasOwnProperty.call(rowData, prop)) return rowData[prop]
  return rowData.properties?.[prop] ?? ''
}

export function setDocumentFieldValue(rowData, prop, value) {
  if (!rowData || !prop) return
  if (Object.prototype.hasOwnProperty.call(rowData, prop)) {
    rowData[prop] = value
    return
  }
  if (!rowData.properties) rowData.properties = {}
  rowData.properties[prop] = value
}

export function getDocumentFormulaColumns(dynamicColumns = []) {
  return (Array.isArray(dynamicColumns) ? dynamicColumns : []).filter((col) => (
    col?.prop &&
    IDENTIFIER_RE.test(col.prop) &&
    col.type === 'formula' &&
    String(col.expression || '').trim()
  ))
}

export function applyDocumentFormulaUpdates({
  rowData,
  staticColumns = [],
  dynamicColumns = [],
  precision = 2
} = {}) {
  if (!rowData) return []
  const formulaColumns = getDocumentFormulaColumns(
    Array.isArray(dynamicColumns) && dynamicColumns.length ? dynamicColumns : normalizedColumns
  )
  if (!formulaColumns.length) return []

  const columns = normalizeDocumentColumns(staticColumns, dynamicColumns)
  const rowDataMap = {}
  columns.forEach((col) => {
    const value = getDocumentFieldValue(rowData, col.prop)
    rowDataMap[col.prop] = value
    if (col.label) rowDataMap[col.label] = value
  })

  const updated = []
  formulaColumns.forEach((col) => {
    try {
      const evalExpr = String(col.expression || '').replace(/\{(.+?)\}/g, (match, key) => {
        const num = Number.parseFloat(rowDataMap[String(key).trim()])
        return Number.isFinite(num) ? num : 0
      })
      const result = evaluateFormulaExpression(evalExpr)
      if (result !== undefined && result !== null && Number.isFinite(Number(result))) {
        const finalValue = Number(Number(result).toFixed(precision))
        setDocumentFieldValue(rowData, col.prop, finalValue)
        updated.push({ prop: col.prop, label: col.label || col.prop, value: finalValue })
      }
    } catch {
      // Ignore invalid custom formulas; the grid formula editor is responsible for validation.
    }
  })
  return updated
}

export function buildDocumentDataSample(rowData, columns = []) {
  if (!rowData) return []
  const sample = {}
  columns.forEach((col) => {
    if (!col?.prop || col.type === 'file' || col.type === 'geo') return
    const value = getDocumentFieldValue(rowData, col.prop)
    if (value !== undefined && value !== null && value !== '') {
      sample[col.prop] = value
    }
  })
  if (rowData.id !== undefined) sample.id = rowData.id
  return [sample]
}

export function buildDocumentDataStats(rowData, columns = []) {
  const formulaColumns = columns.filter(col => col.type === 'formula')
  const fileColumns = columns.filter(col => col.type === 'file')
  return {
    totalCount: rowData ? 1 : 0,
    sampleSize: rowData ? 1 : 0,
    loadedCount: rowData ? 1 : 0,
    scope: 'current_record',
    scopeLabel: '当前单据或当前记录',
    sampleOnly: true,
    totalCountIsFull: true,
    formulaColumnCount: formulaColumns.length,
    fileColumnCount: fileColumns.length
  }
}

export function buildDocumentFileColumnPayload(columns = [], rowData = {}) {
  return (Array.isArray(columns) ? columns : [])
    .filter(col => col?.type === 'file')
    .map((col) => {
      const rawValue = getDocumentFieldValue(rowData, col.prop)
      const rawFiles = Array.isArray(rawValue) ? rawValue : []
      const files = rawFiles
        .map(file => ({
          name: file?.name || file?.fileName || file?.filename || '文件',
          url: file?.url || file?.file_url || file?.dataUrl || ''
        }))
        .filter(file => file.name)
      return { label: col.label || col.prop, prop: col.prop, files }
    })
}

export function buildDocumentAgentContext({
  app = '',
  view = '',
  viewName = '',
  apiUrl = '',
  writeUrl = '',
  rowId = '',
  rowData = null,
  staticColumns = [],
  dynamicColumns = [],
  columns = null,
  templateScope = null,
  templateLibraryKey = 'form_templates',
  aiScene = 'form',
  allowImport = false,
  additionalContext = {}
} = {}) {
  const normalizedColumns = Array.isArray(columns) && columns.length
    ? columns.map(col => normalizeColumn(col, col.source || 'column')).filter(col => col.prop)
    : normalizeDocumentColumns(staticColumns, dynamicColumns)
  const formulaColumns = getDocumentFormulaColumns(dynamicColumns)
  const fileColumns = buildDocumentFileColumnPayload(normalizedColumns, rowData || {})
  const dataStats = buildDocumentDataStats(rowData, normalizedColumns)
  const dataSample = buildDocumentDataSample(rowData, normalizedColumns)

  return {
    app,
    view,
    viewName,
    apiUrl,
    writeUrl: writeUrl || apiUrl,
    rowId,
    columns: normalizedColumns,
    staticColumns,
    extraColumns: dynamicColumns,
    fileColumns,
    formulaColumns: formulaColumns.map(col => ({
      prop: col.prop,
      label: col.label || col.prop,
      expression: col.expression
    })),
    dataStats,
    dataSample,
    documentAgent: {
      kind: 'eis-document-detail',
      scope: 'current_record',
      templateScope,
      templateLibraryKey,
      supportsFormula: formulaColumns.length > 0,
      supportsTemplateGeneration: true,
      supportsImport: allowImport === true
    },
    templateScope,
    templateLibraryKey,
    aiScene,
    allowFormula: formulaColumns.length > 0,
    allowImport,
    ...additionalContext
  }
}

export function buildDocumentFormPrompt({
  title = '当前单据',
  columns = [],
  rowData = null
} = {}) {
  const normalizedColumns = (Array.isArray(columns) ? columns : []).map(col => normalizeColumn(col)).filter(col => col.prop)
  const columnValues = normalizedColumns.map((col) => {
    const value = getDocumentFieldValue(rowData || {}, col.prop)
    if (col.type === 'file') {
      const files = Array.isArray(value)
        ? value.map(file => ({ name: file?.name || file?.fileName || file?.filename || '文件' }))
        : []
      return { label: col.label, prop: col.prop, type: col.type, value: files }
    }
    return { label: col.label, prop: col.prop, type: col.type, value: value ?? '' }
  })
  const fileColumns = buildDocumentFileColumnPayload(normalizedColumns, rowData || {})

  return [
    `请根据“${title}”当前表格列生成单据模板。`,
    '优先使用列里的 prop 作为字段。',
    '如果用户表单需要但系统列里没有，可以新增扩展字段，field 建议用 ext_ 开头（如 ext_note）。',
    '把“当前行已存在的数据”中的值填入对应字段，没有值就留空。',
    '必须只输出一个模板 JSON，并放在 ```form-template``` 代码块中。',
    '如果是图片/文件字段，请使用 widget=image，并设置 fileSource 为对应文件列 prop。',
    '如果字段是 select/cascader，请使用 widget=select 或 widget=cascader，并给出 options/cascaderOptions。',
    '如果字段是 formula，请保留为只读展示字段，不要让用户手工填写。',
    '当前表格列：',
    JSON.stringify(normalizedColumns, null, 2),
    '当前行已存在的数据：',
    JSON.stringify(columnValues, null, 2),
    '可用文件列素材：',
    JSON.stringify(fileColumns, null, 2)
  ].join('\n')
}
