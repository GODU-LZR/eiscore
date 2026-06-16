// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const SERVER_SUMMARY_SCOPE_SERVER = 'server'
export const SERVER_SUMMARY_SCOPE_LOADED = 'loaded'

const stripHash = (url) => String(url || '').split('#')[0]

const trimApiPrefix = (url) => stripHash(url).replace(/^\/api\b/, '')

const safeDecodeQueryPart = (value) => {
  try {
    return decodeURIComponent(String(value || ''))
  } catch (e) {
    return String(value || '')
  }
}

const normalizeQueryPart = (value) => safeDecodeQueryPart(value).replace(/^[?&]+/, '')

export function extractApiFilterQuery(url = '') {
  const [, rawQuery = ''] = stripHash(url).split('?')
  if (!rawQuery) return ''
  const ignored = new Set(['select', 'order', 'limit', 'offset'])
  const parts = rawQuery
    .split('&')
    .map((item) => safeDecodeQueryPart(item.trim()))
    .filter(Boolean)
    .filter((item) => {
      const key = (item.split('=')[0] || '').trim()
      return key && !ignored.has(key)
    })
  return parts.join('&')
}

export function normalizeSummaryScope(value) {
  return value === SERVER_SUMMARY_SCOPE_LOADED ? SERVER_SUMMARY_SCOPE_LOADED : SERVER_SUMMARY_SCOPE_SERVER
}

export function shouldUseServerSummary(props) {
  if (!props || normalizeSummaryScope(props.summaryScope) !== SERVER_SUMMARY_SCOPE_SERVER) return false
  if (!props.apiUrl || !props.viewId) return false
  return true
}

export function buildServerSummaryPayload({ props, summaryConfig, searchText, buildSearchQuery }) {
  const apiUrl = trimApiPrefix(props.apiUrl || '')
  const [baseUrl] = apiUrl.split('?')
  const columns = [...(props.staticColumns || []), ...(props.extraColumns || [])]
  const rules = summaryConfig?.rules || {}
  const expressions = summaryConfig?.expressions || {}
  const requestedColumns = columns
    .filter((col) => {
      if (!col?.prop) return false
      const rule = rules[col.prop]
      return (rule && rule !== 'none') || !!expressions[col.prop]
    })
    .map((col) => ({
      prop: col.prop,
      label: col.label || col.prop,
      source: (props.staticColumns || []).some((item) => item.prop === col.prop) ? 'column' : 'properties',
      type: col.type || 'text',
      rule: rules[col.prop] || 'none'
    }))

  if (!requestedColumns.length) return null

  let searchQuery = ''
  const text = String(searchText || '').trim()
  if (text && typeof buildSearchQuery === 'function') {
    searchQuery = normalizeQueryPart(buildSearchQuery(text, props.staticColumns || [], props.extraColumns || []))
  }

  return {
    view_id: props.viewId,
    api_url: baseUrl || apiUrl,
    accept_profile: props.acceptProfile || props.profile || 'public',
    base_query: extractApiFilterQuery(apiUrl),
    search_query: searchQuery,
    columns: requestedColumns
  }
}

export function buildServerSummaryRow({
  response,
  props,
  summaryConfig,
  evaluateFormulaExpression
}) {
  const columns = [...(props.staticColumns || []), ...(props.extraColumns || [])]
  const totalRow = {
    id: 'bottom_total',
    _status: `${summaryConfig?.label || '合计'}(全量)`,
    properties: {}
  }
  const resultMap = response?.results || {}
  const valueMap = {}

  columns.forEach((col) => {
    const item = resultMap[col.prop] || {}
    const value = item.value
    const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0
    valueMap[col.prop] = safeValue
    if (col.label) valueMap[col.label] = safeValue

    const rule = summaryConfig?.rules?.[col.prop]
    if (rule && rule !== 'none' && typeof value === 'number' && Number.isFinite(value)) {
      const displayVal = Number(value.toFixed(2))
      const isProp = !(props.staticColumns || []).some((item) => item.prop === col.prop)
      if (isProp) totalRow.properties[col.prop] = displayVal
      else totalRow[col.prop] = displayVal
    }
  })

  columns.forEach((col) => {
    const expr = summaryConfig?.expressions?.[col.prop]
    if (!expr) return
    try {
      const evaluated = evaluateFormulaExpression(expr.replace(/\{(.+?)\}/g, (match, key) => valueMap[key] ?? 0))
      if (evaluated !== undefined && !Number.isNaN(evaluated) && Number.isFinite(evaluated)) {
        const displayVal = Number(evaluated.toFixed(2))
        const isProp = !(props.staticColumns || []).some((item) => item.prop === col.prop)
        if (isProp) totalRow.properties[col.prop] = displayVal
        else totalRow[col.prop] = displayVal
      }
    } catch (e) {}
  })

  return [totalRow]
}

export async function loadServerSummary({
  request,
  props,
  summaryConfig,
  searchText,
  buildSearchQuery,
  evaluateFormulaExpression
}) {
  if (!shouldUseServerSummary(props)) return null
  const payload = buildServerSummaryPayload({ props, summaryConfig, searchText, buildSearchQuery })
  if (!payload) return null

  const response = await request({
    url: '/rpc/eis_grid_summary',
    method: 'post',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    },
    data: { payload },
    silentError: true,
    suppressErrorMessage: true
  })

  return buildServerSummaryRow({
    response,
    props,
    summaryConfig,
    evaluateFormulaExpression
  })
}
