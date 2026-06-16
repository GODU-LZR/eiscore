// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const DATE_FIELD_HINTS = [
  'date',
  'time',
  '_at',
  'created_at',
  'updated_at',
  'order_date',
  'delivery_date',
  'follow_date',
  'payment_date',
  'required_date',
  'arrival_date',
  'expected_arrival_date',
  'planned_start_date',
  'planned_finish_date',
  'inspection_date',
  'due_date',
  'plan_date',
  'finish_date',
  'check_date',
  'occurred_date',
  'effective_date',
  'next_execute_date'
]

export const GRID_TIME_MODE_OPTIONS = [
  { value: 'infinite', label: '无限滚动' },
  { value: 'day', label: '按天' },
  { value: 'month', label: '按月' },
  { value: 'year', label: '按年' },
  { value: 'custom', label: '自定义' }
]

export const pad2 = (value) => String(value).padStart(2, '0')
export const formatDate = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
export const formatMonth = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
export const formatYear = (date) => `${date.getFullYear()}`

const normalizeFallbackDate = (fallback) => {
  const date = fallback instanceof Date ? fallback : new Date(fallback)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

const isValidLocalDateParts = (year, month, day) => {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

const isValidLocalDateText = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return false
  return isValidLocalDateParts(Number(match[1]), Number(match[2]), Number(match[3]))
}

export function parseLocalDate(value, fallback = new Date()) {
  const fallbackDate = normalizeFallbackDate(fallback)
  const text = String(value || '')
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return new Date(fallbackDate)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!isValidLocalDateParts(year, month, day)) return new Date(fallbackDate)
  return new Date(year, month - 1, day)
}

export function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function addMonths(date, months) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export function addYears(date, years) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

export function appendQuery(url, query) {
  const cleanQuery = String(query || '').replace(/^[?&]+/, '')
  if (!cleanQuery) return url
  const text = String(url || '')
  const hashIndex = text.indexOf('#')
  const base = hashIndex >= 0 ? text.slice(0, hashIndex) : text
  const hash = hashIndex >= 0 ? text.slice(hashIndex) : ''
  return `${base}${base.includes('?') ? '&' : '?'}${cleanQuery}${hash}`
}

export function getMonthRange(value, fallbackDate = new Date()) {
  const fallback = normalizeFallbackDate(fallbackDate)
  const text = String(value || formatMonth(fallback))
  const match = text.match(/^(\d{4})-(\d{1,2})$/)
  const year = match ? Number(match[1]) : fallback.getFullYear()
  const month = match ? Number(match[2]) : fallback.getMonth() + 1
  if (month < 1 || month > 12) return getMonthRange(formatMonth(fallback), fallback)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return [formatDate(start), formatDate(end)]
}

export function getYearRange(value, fallbackDate = new Date()) {
  const fallback = normalizeFallbackDate(fallbackDate)
  const year = Number(value) || fallback.getFullYear()
  return [`${year}-01-01`, `${year + 1}-01-01`]
}

export function isLikelyDateColumn(col) {
  if (!col?.prop) return false
  const label = String(col.label || '')
  const prop = String(col.prop || '').toLowerCase()
  return /日期|时间|到期|交期|计划|生效|完成|检验|到货|下单|回款|跟进/.test(label)
    || DATE_FIELD_HINTS.some((hint) => prop.includes(hint))
}

export function resolveGridTimeField(app, staticColumns = []) {
  if (app?.timeField) return app.timeField
  const columns = Array.isArray(staticColumns) ? staticColumns : []
  const matched = columns.find(isLikelyDateColumn)
  return matched?.prop || ''
}

export function buildGridTimeRange({ mode, day, month, year, customRange, today = new Date() }) {
  if (mode === 'infinite') return null
  if (mode === 'day') {
    const start = isValidLocalDateText(day) ? day : formatDate(normalizeFallbackDate(today))
    return { start, end: formatDate(addDays(parseLocalDate(start, today), 1)) }
  }
  if (mode === 'month') {
    const [start, end] = getMonthRange(month, today)
    return { start, end }
  }
  if (mode === 'year') {
    const [start, end] = getYearRange(year, today)
    return { start, end }
  }
  const range = Array.isArray(customRange) ? customRange : []
  if (!range[0] || !range[1]) return null
  if (!isValidLocalDateText(range[0]) || !isValidLocalDateText(range[1])) return null
  return { start: range[0], end: formatDate(addDays(parseLocalDate(range[1], today), 1)) }
}

export function buildGridTimeScopeLabel({ mode, day, month, year, customRange, fieldLabel = '日期' }) {
  if (mode === 'infinite') return '全量滚动加载'
  if (mode === 'day') return `${fieldLabel}：${day}`
  if (mode === 'month') return `${fieldLabel}月份：${month}`
  if (mode === 'year') return `${fieldLabel}年份：${year}`
  const range = Array.isArray(customRange) ? customRange : []
  return range[0] && range[1] ? `${fieldLabel}范围：${range[0]} 至 ${range[1]}` : `请选择${fieldLabel}范围`
}

export function buildGridTimeApiUrl(baseUrl, field, range) {
  if (!field || !range?.start || !range?.end) return baseUrl
  return appendQuery(baseUrl, `${field}=gte.${range.start}&${field}=lt.${range.end}`)
}
