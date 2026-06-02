// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

/**
 * 构造 PostgREST 复杂搜索参数
 * 生成类似: &or=(name.like.*val*,properties->>size.like.*val*)
 */
export function buildSearchQuery(keyword, staticFields, dynamicFields) {
  if (!keyword) return ''

  const text = String(keyword).trim()
  if (!text) return ''
  const encodeFilterValue = (value) => encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
  const encodedText = encodeFilterValue(text)
  const isNumeric = /^-?\d+(\.\d+)?$/.test(text)
  const isDateLike = /^\d{4}-\d{1,2}-\d{1,2}$/.test(text)

  const isDateField = (field) => {
    const prop = String(field?.prop || '').toLowerCase()
    return field?.type === 'date' ||
      field?.searchType === 'date' ||
      prop.endsWith('_date') ||
      prop.endsWith('_at')
  }

  // 1. 静态字段
  const conditions = staticFields
    .filter(f => f.searchable !== false) // 允许某些列不参与搜索
    .map(field => {
      const prop = field.prop
      if (!prop) return null
      const isNumberField = field.type === 'number' || field.searchType === 'number' || prop === 'id'
      if (isNumberField) {
        return isNumeric ? `${prop}.eq.${encodedText}` : null
      }
      if (isDateField(field)) {
        return isDateLike ? `${prop}.eq.${encodedText}` : null
      }
      return `${prop}.ilike.*${encodedText}*`
    })
    .filter(Boolean)

  // 2. 动态字段 (JSONB)
  if (dynamicFields && dynamicFields.length > 0) {
    dynamicFields.forEach(col => {
      // properties->>key 表示以文本方式读取 JSON 里的值
      if (!col?.prop) return
      conditions.push(`properties->>${encodeFilterValue(col.prop)}.ilike.*${encodedText}*`)
    })
  }

  if (conditions.length === 0) return ''
  return `&or=(${conditions.join(',')})`
}
