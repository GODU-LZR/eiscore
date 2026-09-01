// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { normalizePurchaseCascaderMap } from './purchase-grid-data-policy.js'

export const buildPurchaseAvailableColumns = ({
  staticColumns = [],
  extraColumns = [],
  isEditing = false,
  editingIndex = -1
} = {}) => {
  const columns = [...staticColumns, ...extraColumns]
  if (!isEditing) return columns
  return columns.filter((column, index) => index !== staticColumns.length + editingIndex)
}

export const buildPurchaseFormulaPrompt = ({ label, columns = [] } = {}) => {
  const targetLabel = label || '计算列'
  const variables = columns.map((column) => column.label).join('、')
  return [
    '请帮我生成表格“自动计算”公式。',
    `目标列：${targetLabel}`,
    '要求：只输出公式，不要解释。',
    '必须放在 ```formula``` 代码块中，内容示例：{数量}*{单价}。',
    `可用字段：${variables || '无'}。`
  ].join('\n')
}

export const resolvePurchaseColumnEditorTab = (type) => {
  if (type === 'formula') return 'formula'
  if (type === 'select' || type === 'dropdown') return 'select'
  if (type === 'cascader') return 'cascader'
  if (type === 'geo') return 'geo'
  if (type === 'file') return 'file'
  return 'text'
}

export const buildPurchaseColumnEditorDraft = (column = {}) => ({
  label: column.label,
  prop: column.prop,
  expression: column.expression || '',
  options: Array.isArray(column.options)
    ? column.options.map((option) => ({ label: option.label ?? option.value ?? '' }))
    : [],
  dependsOn: column.dependsOn || '',
  cascaderMap: normalizePurchaseCascaderMap(column.cascaderOptions),
  geoAddress: column.geoAddress !== false,
  fileMaxSizeMb: column.fileMaxSizeMb || 20,
  fileMaxCount: column.fileMaxCount || 3,
  fileAccept: column.fileAccept || ''
})

export const buildEmptyPurchaseColumnEditorDraft = () => ({
  label: '',
  prop: '',
  expression: '',
  options: [],
  dependsOn: '',
  cascaderMap: {},
  geoAddress: true,
  fileMaxSizeMb: 20,
  fileMaxCount: 3,
  fileAccept: ''
})

export const getPurchaseCascaderChildren = (map, key) => {
  const list = map?.[String(key)] || []
  return Array.isArray(list) ? list : []
}

export const appendPurchaseCascaderChild = (list, rawValue) => {
  const text = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim()
  if (!text) return { changed: false, list: Array.isArray(list) ? list : [] }
  const next = Array.isArray(list) ? [...list] : []
  if (!next.includes(text)) next.push(text)
  return { changed: true, list: next }
}

export const removePurchaseCascaderChild = (list, child) => (
  (Array.isArray(list) ? list : []).filter((item) => item !== child)
)

export const togglePurchaseStaticColumn = (hiddenColumns, prop, visible) => {
  const hidden = Array.isArray(hiddenColumns) ? hiddenColumns : []
  const has = hidden.includes(prop)
  if (visible && has) return hidden.filter((item) => item !== prop)
  if (!visible && !has) return [...hidden, prop]
  return hidden
}

export const buildPurchaseColumnConfig = ({
  draft = {},
  type,
  isEditing,
  generatedProp,
  parentColumns = [],
  parentOptions = []
} = {}) => {
  const column = {
    label: draft.label,
    prop: isEditing ? draft.prop : generatedProp,
    type
  }

  if (type === 'formula') {
    column.expression = draft.expression
  } else if (type === 'select') {
    const options = (Array.isArray(draft.options) ? draft.options : [])
      .map((option) => String(option.label ?? '').trim())
      .filter(Boolean)
      .map((text) => ({ label: text, value: text }))
    if (!options.length) return { ok: false, message: '请至少添加一个选项' }
    column.options = options
  } else if (type === 'cascader') {
    if (!draft.dependsOn) return { ok: false, message: '请选择上一级列' }
    if (!parentColumns.find((parent) => parent.prop === draft.dependsOn)) {
      return { ok: false, message: '上一级必须是下拉或联动列' }
    }
    const cascaderOptions = {}
    parentOptions.forEach((option) => {
      const valueKey = String(option.value)
      const labelKey = String(option.label)
      const list = draft.cascaderMap?.[valueKey] || draft.cascaderMap?.[labelKey] || []
      const normalizedList = list.map((item) => ({ label: item, value: item }))
      cascaderOptions[valueKey] = normalizedList
      if (labelKey !== valueKey && !(labelKey in cascaderOptions)) {
        cascaderOptions[labelKey] = normalizedList
      }
    })
    const hasAny = Object.values(cascaderOptions).some((list) => Array.isArray(list) && list.length > 0)
    if (!hasAny) return { ok: false, message: '请至少给一个上一级配置下级选项' }
    column.dependsOn = draft.dependsOn
    column.cascaderOptions = cascaderOptions
  } else if (type === 'geo') {
    column.geoAddress = Boolean(draft.geoAddress)
  } else if (type === 'file') {
    column.fileMaxSizeMb = Math.max(1, Number(draft.fileMaxSizeMb) || 20)
    column.fileMaxCount = Math.max(1, Number(draft.fileMaxCount) || 3)
    column.fileAccept = draft.fileAccept?.trim() || ''
  }

  return { ok: true, column }
}
