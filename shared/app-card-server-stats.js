// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { extractApiFilterQuery } from './eis-grid-server-summary'

const trimApiPrefix = (url) => String(url || '').replace(/^\/api\b/, '')

const safeDecode = (value) => {
  try {
    return decodeURIComponent(String(value || ''))
  } catch (e) {
    return String(value || '')
  }
}

const normalizeDate = (date = new Date()) => {
  const next = new Date(date)
  if (Number.isNaN(next.getTime())) return ''
  return next.toISOString().slice(0, 10)
}

const parseStoredToken = (raw) => {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.token) return String(parsed.token)
  } catch (e) {}
  return String(raw)
}

const getAuthToken = () => {
  if (typeof localStorage === 'undefined') return ''
  const token = parseStoredToken(localStorage.getItem('auth_token'))
  return token && token.length <= 8192 ? token : ''
}

const parseContentRangeTotal = (value) => {
  const text = String(value || '')
  const match = text.match(/\/(\d+|\*)$/)
  if (!match || match[1] === '*') return null
  const total = Number(match[1])
  return Number.isFinite(total) ? total : null
}

export const todayText = () => normalizeDate(new Date())

export const offsetDateText = (days = 0, base = new Date()) => {
  const next = new Date(base)
  next.setDate(next.getDate() + Number(days || 0))
  return normalizeDate(next)
}

export const filterPart = (field, op, value) => {
  if (!field || !op || value === undefined || value === null || value === '') return ''
  if (op === 'in' || op === 'not.in') {
    const values = Array.isArray(value) ? value : String(value).split(',')
    const cleanValues = values.map((item) => String(item).trim()).filter(Boolean)
    if (!cleanValues.length) return ''
    if (op === 'not.in') {
      return cleanValues.map((item) => `${field}=neq.${encodeURIComponent(item)}`).join('&')
    }
    return `${field}=in.(${cleanValues.map((item) => encodeURIComponent(item)).join(',')})`
  }
  return `${field}=${op}.${encodeURIComponent(String(value))}`
}

export const orFilter = (...parts) => {
  const conditions = parts
    .flatMap((part) => String(part || '').replace(/^[?&]+/, '').split('&'))
    .map((part) => safeDecode(part.trim()))
    .filter(Boolean)
    .map((part) => part.replace('=', '.'))
  return conditions.length ? `or=(${conditions.join(',')})` : ''
}

export const combineQueryParts = (...parts) => parts
  .flatMap((part) => String(part || '').replace(/^[?&]+/, '').split('&'))
  .map((part) => safeDecode(part.trim()))
  .filter(Boolean)
  .join('&')

export const appendStatsFilter = (apiUrl, filter = '') => {
  const cleanFilter = combineQueryParts(filter)
  if (!cleanFilter) return apiUrl
  return `${apiUrl}${String(apiUrl || '').includes('?') ? '&' : '?'}${cleanFilter}`
}

const normalizeStatSpec = (spec = {}) => {
  const rawFilter = spec.filter || ''
  const inferredSearch = !spec.searchFilter && String(rawFilter).trim().startsWith('or=(') ? rawFilter : ''
  return {
    key: spec.key || spec.prop || 'count',
    label: spec.label || spec.key || spec.prop || '统计',
    prop: spec.prop || spec.key || 'count',
    source: spec.source || 'column',
    type: spec.type || 'number',
    rule: spec.rule || 'count_all',
    filter: inferredSearch ? '' : rawFilter,
    searchFilter: spec.searchFilter || inferredSearch
  }
}

export const countStat = (key = 'count', filter = '', label = '记录数') => ({
  key,
  label,
  prop: key,
  rule: 'count_all',
  filter
})

export const sumStat = (key, prop, filter = '', label = key) => ({
  key,
  label,
  prop,
  rule: 'sum',
  filter
})

export const avgStat = (key, prop, filter = '', label = key) => ({
  key,
  label,
  prop,
  rule: 'avg',
  filter
})

export const buildAppStatsPayload = ({
  app,
  apiUrl,
  profile,
  acceptProfile,
  viewId,
  stats = [],
  baseFilter = '',
  searchQuery = ''
} = {}) => {
  const sourceUrl = trimApiPrefix(apiUrl || app?.apiUrl || '')
  const [baseUrl] = sourceUrl.split('?')
  const filterQuery = combineQueryParts(extractApiFilterQuery(sourceUrl), baseFilter)
  const columns = stats.map(normalizeStatSpec).map((spec) => ({
    prop: spec.rule === 'count_all' ? spec.key : spec.prop,
    label: spec.label,
    source: spec.rule === 'count_all' ? 'column' : spec.source,
    type: spec.type,
    rule: spec.rule,
    field: spec.prop
  }))

  return {
    view_id: viewId || app?.viewId || app?.key || baseUrl || 'app_card',
    api_url: baseUrl || sourceUrl,
    accept_profile: acceptProfile || app?.acceptProfile || app?.profile || profile || 'public',
    base_query: filterQuery,
    search_query: searchQuery,
    columns
  }
}

const normalizeRpcColumns = (stats = []) => stats.map(normalizeStatSpec).map((spec) => ({
  prop: spec.rule === 'count_all' ? spec.key : spec.prop,
  label: spec.label,
  source: spec.source,
  type: spec.type,
  rule: spec.rule,
  key: spec.key
}))

async function fetchExactCount({
  apiUrl,
  profile = 'public',
  baseFilter = '',
  searchQuery = ''
} = {}) {
  if (typeof fetch !== 'function') return null
  const sourceUrl = trimApiPrefix(apiUrl || '')
  const [baseUrl] = sourceUrl.split('?')
  if (!baseUrl) return null
  const filterQuery = combineQueryParts(extractApiFilterQuery(sourceUrl), baseFilter, searchQuery, 'select=*')
  const url = `/api/${baseUrl.replace(/^\/+/, '')}${filterQuery ? `?${filterQuery}` : ''}`
  const headers = {
    'Accept-Profile': profile,
    Prefer: 'count=exact',
    Range: '0-0',
    'Range-Unit': 'items'
  }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(url, { method: 'GET', headers })
  if (!response.ok && response.status !== 206) return null
  return parseContentRangeTotal(response.headers.get('content-range'))
}

async function loadAppCardStatsRaw({
  request,
  app,
  apiUrl,
  profile = 'public',
  acceptProfile,
  viewId,
  stats = [countStat()],
  baseFilter = '',
  searchQuery = ''
} = {}) {
  if (!request || !(apiUrl || app?.apiUrl)) return {}
  const normalizedStats = stats.map(normalizeStatSpec)
  const sourceUrl = trimApiPrefix(apiUrl || app?.apiUrl || '')
  const [baseUrl] = sourceUrl.split('?')
  const filterQuery = combineQueryParts(extractApiFilterQuery(sourceUrl), baseFilter)
  const statColumns = normalizeRpcColumns(normalizedStats)
  if (!statColumns.length) return {}
  const profileName = acceptProfile || app?.acceptProfile || app?.profile || profile || 'public'
  const countAllColumns = statColumns.filter((col) => col.rule === 'count_all')
  const aggregateColumns = statColumns.filter((col) => col.rule !== 'count_all')
  const values = {}

  let exactCount = null
  if (countAllColumns.length) {
    try {
      exactCount = await fetchExactCount({
        apiUrl: baseUrl || sourceUrl,
        profile: profileName,
        baseFilter: filterQuery,
        searchQuery
      })
      if (exactCount !== null) {
        countAllColumns.forEach((col) => {
          values[col.key] = exactCount
        })
      }
    } catch (e) {
      exactCount = null
    }
  }

  const rpcColumns = exactCount !== null ? aggregateColumns : statColumns
  if (!rpcColumns.length) return values

  const payload = {
    view_id: viewId || app?.viewId || app?.key || baseUrl || 'app_card',
    api_url: baseUrl || sourceUrl,
    accept_profile: profileName,
    base_query: filterQuery,
    search_query: searchQuery,
    columns: rpcColumns.map((col) => ({
      prop: col.prop,
      label: col.label,
      source: col.source,
      type: col.type,
      rule: col.rule
    }))
  }

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

  const resultMap = response?.results || {}
  return rpcColumns.reduce((acc, col) => {
    const resultKey = col.prop
    if (!Object.prototype.hasOwnProperty.call(resultMap, resultKey)) return acc
    const value = Number(resultMap[resultKey]?.value)
    if (Number.isFinite(value)) acc[col.key] = value
    return acc
  }, values)
}

export async function loadAppCardStats({
  request,
  app,
  apiUrl,
  profile = 'public',
  acceptProfile,
  viewId,
  stats = [countStat()],
  baseFilter = '',
  searchQuery = ''
} = {}) {
  const normalizedStats = stats.map(normalizeStatSpec)
  if (!normalizedStats.length) return {}

  const grouped = normalizedStats.reduce((acc, spec) => {
    const filter = combineQueryParts(baseFilter, spec.filter)
    const search = combineQueryParts(searchQuery, spec.searchFilter)
    const key = `${filter}|||${search}`
    if (!acc[key]) acc[key] = { filter, search, stats: [] }
    acc[key].stats.push({ ...spec, filter: '', searchFilter: '' })
    return acc
  }, {})

  const entries = await Promise.all(Object.values(grouped).map((group) => loadAppCardStatsRaw({
    request,
    app,
    apiUrl,
    profile,
    acceptProfile,
    viewId,
    stats: group.stats,
    baseFilter: group.filter,
    searchQuery: group.search
  })))

  return entries.reduce((acc, values) => ({ ...acc, ...values }), {})
}

export async function loadAppCardStatsGroup({
  request,
  app,
  profile = 'public',
  commonStats = [countStat()],
  stats = [],
  extraFilters = {},
  baseFilter = ''
} = {}) {
  const specs = [
    ...commonStats.map(normalizeStatSpec),
    ...stats.map(normalizeStatSpec)
  ]
  if (!specs.length) return {}

  const grouped = specs.reduce((acc, spec) => {
    const filter = combineQueryParts(baseFilter, extraFilters[spec.key], spec.filter)
    const searchQuery = combineQueryParts(spec.searchFilter)
    const groupKey = `${filter}|||${searchQuery}`
    if (!acc[groupKey]) acc[groupKey] = { filter, searchQuery, stats: [] }
    acc[groupKey].stats.push({ ...spec, filter: '', searchFilter: '' })
    return acc
  }, {})

  const entries = await Promise.all(Object.values(grouped).map(async (group) => {
    const values = await loadAppCardStatsRaw({
      request,
      app,
      profile,
      stats: group.stats,
      baseFilter: group.filter,
      searchQuery: group.searchQuery
    })
    return values
  }))

  return entries.reduce((acc, values) => ({ ...acc, ...values }), {})
}

export async function loadAppsCardStats({
  request,
  apps = [],
  profile = 'public',
  getStats
} = {}) {
  const results = await Promise.allSettled(apps.map(async (app) => {
    const specs = typeof getStats === 'function' ? getStats(app) : null
    if (!specs) return [app.key, {}]
    const values = await loadAppCardStatsGroup({
      request,
      app,
      profile: app.acceptProfile || app.profile || profile,
      commonStats: specs.commonStats,
      stats: specs.stats,
      extraFilters: specs.extraFilters,
      baseFilter: specs.baseFilter
    })
    return [app.key, values]
  }))

  return results.reduce((acc, result, index) => {
    const key = apps[index]?.key
    if (result.status === 'fulfilled') {
      const [resolvedKey, values] = result.value
      acc[resolvedKey || key] = values || {}
    } else if (key) {
      acc[key] = {}
    }
    return acc
  }, {})
}

export const statNumber = (stats, key, fallback = 0) => {
  const value = Number(stats?.[key])
  return Number.isFinite(value) ? value : fallback
}
