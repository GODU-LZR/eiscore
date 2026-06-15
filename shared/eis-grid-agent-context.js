// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const GRID_AGENT_CONTEXT_VERSION = 'eis-grid-agent-context-v1'
const DEFAULT_SAMPLE_LIMIT = 40

const trimApiPrefix = (url) => String(url || '').replace(/^\/api\b/, '')

const normalizeBaseUrl = (url) => {
  const clean = trimApiPrefix(url || '').trim()
  const [baseUrl] = clean.split('?')
  return baseUrl || clean
}

const safeDecodeQueryPart = (value) => {
  try {
    return decodeURIComponent(String(value || ''))
  } catch (e) {
    return String(value || '')
  }
}

const extractApiFilterQuery = (url = '') => {
  const [, rawQuery = ''] = String(url || '').split('?')
  if (!rawQuery) return ''
  const ignored = new Set(['select', 'order', 'limit', 'offset'])
  return rawQuery
    .split('&')
    .map((item) => safeDecodeQueryPart(item.trim()))
    .filter(Boolean)
    .filter((item) => {
      const key = (item.split('=')[0] || '').trim()
      return key && !ignored.has(key)
    })
    .join('&')
}

const toSafeNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const toSafeInteger = (value, fallback = 0) => Math.max(0, Math.floor(toSafeNumber(value, fallback)))

const normalizeColumn = (col, source = '') => ({
  label: col?.label || col?.prop || '',
  prop: col?.prop || '',
  type: col?.type || 'text',
  source,
  expression: col?.expression || '',
  rule: col?.rule || '',
  optionsCount: Array.isArray(col?.options) ? col.options.length : 0
})

export function buildGridLoadState(payload = {}, rawRows = [], visibleRows = []) {
  const visibleCount = Array.isArray(visibleRows) ? visibleRows.length : 0
  const rawCount = Array.isArray(rawRows) ? rawRows.length : visibleCount
  return {
    loadedCount: toSafeInteger(payload?.loadedCount, visibleCount),
    rawLoadedCount: toSafeInteger(payload?.rawLoadedCount, rawCount),
    hasMore: payload?.hasMore === true,
    pageSize: payload?.pageSize === undefined ? null : toSafeInteger(payload.pageSize, 0),
    maxClientRows: payload?.maxClientRows === undefined ? null : toSafeInteger(payload.maxClientRows, 0),
    append: payload?.append === true
  }
}

export function enrichLoadedDataStats(stats = {}, loadState = {}, rows = []) {
  const rowCount = Array.isArray(rows) ? rows.length : 0
  const loadedCount = toSafeInteger(loadState.loadedCount, rowCount)
  const rawLoadedCount = toSafeInteger(loadState.rawLoadedCount, loadedCount)
  return {
    ...(stats && typeof stats === 'object' ? stats : {}),
    totalCount: loadedCount,
    sampleSize: rowCount,
    loadedCount,
    rawLoadedCount,
    hasMore: loadState.hasMore === true,
    scope: 'loaded_rows',
    scopeLabel: '当前前端已加载数据',
    sampleOnly: true,
    totalCountIsFull: false,
    fullTableCountKnown: false,
    fullTableNotice: 'dataStats 与 dataSample 仅基于前端已加载行，不代表数据库全量；全量统计需使用 EISGrid 服务端汇总能力。'
  }
}

export function buildGridAgentContext({
  app = '',
  view = '',
  viewId = '',
  apiUrl = '',
  writeUrl = '',
  profile = 'public',
  contentProfile = '',
  defaultOrder = '',
  columns = [],
  staticColumns = [],
  extraColumns = [],
  summaryConfig = {},
  searchText = '',
  dataScope = '',
  loadState = {},
  sampleLimit = DEFAULT_SAMPLE_LIMIT,
  allowImport = false,
  importTarget = null,
  summaryScope = 'server'
} = {}) {
  const normalizedApiUrl = normalizeBaseUrl(apiUrl)
  const normalizedWriteUrl = normalizeBaseUrl(writeUrl || apiUrl)
  const staticProps = new Set((staticColumns || []).map(col => col?.prop).filter(Boolean))
  const schemaColumns = (columns || [])
    .filter(col => col?.prop)
    .map((col) => normalizeColumn(col, staticProps.has(col.prop) ? 'column' : 'properties'))

  const formulaColumns = schemaColumns
    .filter(col => col.type === 'formula' && String(col.expression || '').trim())
    .map(col => ({
      prop: col.prop,
      label: col.label,
      expression: col.expression,
      source: col.source
    }))

  const summaryRules = summaryConfig?.rules || {}
  const summaryExpressions = summaryConfig?.expressions || {}
  const summaryColumns = schemaColumns
    .filter(col => {
      const rule = summaryRules[col.prop]
      return (rule && rule !== 'none') || !!summaryExpressions[col.prop]
    })
    .map(col => ({
      prop: col.prop,
      label: col.label,
      rule: summaryRules[col.prop] || 'none',
      hasExpression: !!summaryExpressions[col.prop],
      source: col.source
    }))

  const pageSize = loadState.pageSize === null || loadState.pageSize === undefined
    ? null
    : toSafeInteger(loadState.pageSize, 0)
  const maxClientRows = loadState.maxClientRows === null || loadState.maxClientRows === undefined
    ? null
    : toSafeInteger(loadState.maxClientRows, 0)

  const serverAgentQueryAvailable = !!normalizedApiUrl && summaryScope !== 'loaded'
  const serverSummaryAvailable = !!viewId && !!normalizedApiUrl && summaryScope !== 'loaded'
  const serverFormulaAvailable = !!viewId && !!normalizedWriteUrl && formulaColumns.length > 0
  const importAvailable = allowImport === true && !!(importTarget && typeof importTarget === 'object' && importTarget.apiUrl)

  return {
    version: GRID_AGENT_CONTEXT_VERSION,
    kind: 'eis-data-grid-v2',
    app,
    view,
    viewId,
    relation: {
      apiUrl: normalizedApiUrl,
      writeUrl: normalizedWriteUrl,
      acceptProfile: profile || 'public',
      contentProfile: contentProfile || profile || 'public',
      defaultOrder,
      baseQuery: extractApiFilterQuery(apiUrl)
    },
    dataAccess: {
      mode: 'paged-server-backed',
      dataScope,
      searchText: String(searchText || ''),
      loadedCount: toSafeInteger(loadState.loadedCount, 0),
      rawLoadedCount: toSafeInteger(loadState.rawLoadedCount, 0),
      hasMore: loadState.hasMore === true,
      pageSize,
      maxClientRows,
      sampleLimit: toSafeInteger(sampleLimit, DEFAULT_SAMPLE_LIMIT),
      sampleScope: 'frontend-loaded-rows-only',
      fullDataNotice: 'dataSample/dataStats 只表示浏览器当前已加载行。百万行或全量统计必须走服务端汇总或受控后端能力，不要据此编造全量结论。'
    },
    capabilities: {
      frontendSample: true,
      infiniteScroll: true,
      serverSummary: serverSummaryAvailable,
      serverAgentQuery: serverAgentQueryAvailable,
      serverFormulaRecalculate: serverFormulaAvailable,
      rowFormula: formulaColumns.length > 0,
      summaryFormula: summaryColumns.some(col => col.hasExpression),
      import: importAvailable,
      safeQueryOnly: true
    },
    serverTools: [
      serverAgentQueryAvailable
        ? {
            name: 'eis_grid_agent_query',
            scope: 'server',
            endpoint: '/api/rpc/eis_grid_agent_query',
            operations: ['count', 'sample', 'group_count', 'numeric_summary', 'overview'],
            readOnly: true,
            description: '按当前视图和搜索条件执行受控只读查询，支持全量计数、样本、分组计数和数值汇总。'
          }
        : null,
      serverSummaryAvailable
        ? {
            name: 'eis_grid_summary',
            scope: 'server',
            endpoint: '/api/rpc/eis_grid_summary',
            description: '按当前视图、搜索条件和汇总配置执行服务端全量汇总。'
          }
        : null,
      serverFormulaAvailable
        ? {
            name: 'eis_grid_formula_recalculate',
            scope: 'server',
            endpoint: '/api/rpc/eis_grid_formula_recalculate',
            description: '按当前视图、搜索条件和公式列批量重算并写回。'
          }
        : null
    ].filter(Boolean),
    formulaColumns,
    summaryColumns,
    searchableColumns: schemaColumns
      .filter(col => col.type !== 'file' && col.type !== 'geo')
      .slice(0, 80)
      .map(col => ({ prop: col.prop, label: col.label, type: col.type, source: col.source })),
    agentRules: [
      '回答表格数量、统计、分布时必须说明 dataStats 的 scope；scope=loaded_rows 时只能称为已加载数据。',
      '不要把 dataSample 当成数据库全量数据。',
      '需要全量统计、分布、样本或数值汇总时，优先使用 eis_grid_agent_query 或服务端汇总能力。',
      '生成公式时只使用当前列 schema 中存在的字段。'
    ]
  }
}
