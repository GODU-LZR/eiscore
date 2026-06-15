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

export function parseLocalDate(value, fallback = new Date()) {
  const text = String(value || '')
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return new Date(fallback)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
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
  return `${url}${String(url).includes('?') ? '&' : '?'}${cleanQuery}`
}

export function getMonthRange(value, fallbackDate = new Date()) {
  const [year, month] = String(value || formatMonth(fallbackDate)).split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return [formatDate(start), formatDate(end)]
}

export function getYearRange(value, fallbackDate = new Date()) {
  const year = Number(value) || fallbackDate.getFullYear()
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
    const start = day || formatDate(today)
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
