// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const TEXT_JSON_TYPES = new Set(['text', 'select', 'cascader', 'status'])
const NON_QUERY_TYPES = new Set(['file', 'geo', 'array', 'json', 'display'])

const encodeFilterValue = (value) => encodeURIComponent(String(value))
  .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)

const normalizeProp = (field) => {
  const prop = String(field?.prop || '').trim()
  return IDENTIFIER_RE.test(prop) ? prop : ''
}

const isNumericText = (value) => /^-?\d+(\.\d+)?$/.test(value)
const isDateText = (value) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(value)
const isUuidText = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const isBoolText = (value) => /^(true|false)$/i.test(value)

const isPropertyField = (field) => field?.storeInProperties === true || field?.source === 'properties'

const isDateField = (field) => {
  const prop = normalizeProp(field).toLowerCase()
  return field?.type === 'date' ||
    field?.searchType === 'date' ||
    prop === 'deadline' ||
    prop === 'effective_from' ||
    prop.endsWith('_date') ||
    prop.endsWith('_at')
}

const isIdField = (field) => {
  const prop = normalizeProp(field).toLowerCase()
  return prop === 'id' || prop.endsWith('_id')
}

const isNumberField = (field) => {
  const prop = normalizeProp(field).toLowerCase()
  return field?.type === 'number' ||
    field?.searchType === 'number' ||
    field?.searchType === 'integer' ||
    ['currency', 'percent', 'formula'].includes(field?.type) ||
    prop === 'id' ||
    prop === 'line_no' ||
    prop === 'quantity' ||
    prop.endsWith('_qty') ||
    prop.endsWith('_count') ||
    prop.endsWith('_amount') ||
    prop.endsWith('_days') ||
    prop.endsWith('_hours') ||
    prop.endsWith('_minutes') ||
    prop.endsWith('_score')
}

const isBooleanField = (field) => {
  const prop = normalizeProp(field).toLowerCase()
  return field?.type === 'boolean' ||
    field?.searchType === 'boolean' ||
    prop.endsWith('_flag') ||
    prop.startsWith('is_') ||
    prop.startsWith('has_')
}

const buildStaticCondition = (field, encodedText, rawText) => {
  if (!field || field.searchable === false) return null
  const prop = normalizeProp(field)
  if (!prop || NON_QUERY_TYPES.has(field.type)) return null
  if (isPropertyField(field)) return `properties->>${prop}.ilike.*${encodedText}*`

  if (isIdField(field)) {
    if (field.searchType === 'uuid') return isUuidText(rawText) ? `${prop}.eq.${encodedText}` : null
    if (field.searchType === 'number' || field.searchType === 'integer' || prop === 'id') {
      return isNumericText(rawText) ? `${prop}.eq.${encodedText}` : null
    }
    return isUuidText(rawText) ? `${prop}.eq.${encodedText}` : null
  }
  if (isNumberField(field)) return isNumericText(rawText) ? `${prop}.eq.${encodedText}` : null
  if (isDateField(field)) return isDateText(rawText) ? `${prop}.eq.${encodedText}` : null
  if (isBooleanField(field)) return isBoolText(rawText) ? `${prop}.eq.${encodedText.toLowerCase()}` : null

  const type = field?.type || 'text'
  if (!TEXT_JSON_TYPES.has(type) && field.searchType !== 'text' && field.type) return null
  return `${prop}.ilike.*${encodedText}*`
}

/**
 * 构造 PostgREST 复杂搜索参数。
 * 只对可文本匹配字段使用 ilike，避免 date/uuid/number 字段触发类型错误。
 */
export function buildSearchQuery(keyword, staticFields = [], dynamicFields = []) {
  const text = String(keyword || '').trim()
  if (!text) return ''
  const encodedText = encodeFilterValue(text)

  const conditions = (staticFields || [])
    .map((field) => buildStaticCondition(field, encodedText, text))
    .filter(Boolean)

  ;(dynamicFields || []).forEach((col) => {
    if (!col || col.searchable === false || NON_QUERY_TYPES.has(col.type)) return
    const prop = normalizeProp(col)
    if (!prop) return
    conditions.push(`properties->>${prop}.ilike.*${encodedText}*`)
  })

  return conditions.length ? `&or=(${conditions.join(',')})` : ''
}
