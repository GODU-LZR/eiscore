// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { buildGridAgentContext, buildGridLoadState, enrichLoadedDataStats } from './eis-grid-agent-context'

const DEFAULT_SAMPLE_LIMIT = 40

const getColumnValue = (row, col) => {
  const prop = col?.prop
  if (!prop) return undefined
  if (col.storeInProperties === true) return row?.properties?.[prop]
  return row?.[prop] ?? row?.properties?.[prop]
}

export function normalizeGridColumns(staticColumns = [], extraColumns = []) {
  return [...(staticColumns || []), ...(extraColumns || [])].map(col => ({
    label: col?.label || col?.headerName || col?.prop || '',
    prop: col?.prop || col?.field || '',
    type: col?.type || 'text',
    options: col?.options || [],
    dependsOn: col?.dependsOn || '',
    cascaderOptions: col?.cascaderOptions || col?.cascaderMap || null,
    expression: col?.expression || '',
    storeInProperties: col?.storeInProperties === true
  })).filter(col => col.prop)
}

export function buildStandardGridDataStats(rows = [], columns = []) {
  const stats = {
    totalCount: 0,
    sampleSize: 0,
    statusCounts: {},
    categoryCounts: {},
    typeCounts: {}
  }
  if (!Array.isArray(rows)) return stats
  stats.totalCount = rows.length
  stats.sampleSize = rows.length

  const statusColumn = columns.find(col => ['status', 'state', 'enabled'].includes(col.prop))
  const categoryColumn = columns.find(col => ['category', 'dept_name', 'module', 'warehouse_name'].includes(col.prop))
  const typeColumn = columns.find(col => ['type', 'io_type', 'person_type', 'action'].includes(col.prop))

  rows.forEach((row) => {
    const status = statusColumn ? getColumnValue(row, statusColumn) : (row?.status ?? row?.state)
    if (status !== undefined && status !== null && status !== '') {
      const key = String(status)
      stats.statusCounts[key] = (stats.statusCounts[key] || 0) + 1
    }

    const category = categoryColumn ? getColumnValue(row, categoryColumn) : (row?.category ?? row?.dept_name)
    if (category !== undefined && category !== null && category !== '') {
      const key = String(category)
      stats.categoryCounts[key] = (stats.categoryCounts[key] || 0) + 1
    }

    const type = typeColumn ? getColumnValue(row, typeColumn) : (row?.type ?? row?.io_type ?? row?.person_type)
    if (type !== undefined && type !== null && type !== '') {
      const key = String(type)
      stats.typeCounts[key] = (stats.typeCounts[key] || 0) + 1
    }
  })

  return stats
}

export function buildStandardGridDataSample(rows = [], columns = [], limit = DEFAULT_SAMPLE_LIMIT) {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, limit).map((row) => {
    const item = {}
    columns.forEach((col) => {
      if (!col?.prop) return
      if (col.type === 'file' || col.type === 'geo') return
      const value = getColumnValue(row, col)
      if (value !== undefined && value !== null && value !== '') {
        item[col.prop] = value
      }
    })
    if (row?.id !== undefined) item.id = row.id
    return item
  })
}

export function pushStandardGridAgentContext({
  pushAiContext,
  app = '',
  view = '',
  viewId = '',
  apiUrl = '',
  writeUrl = '',
  profile = 'public',
  contentProfile = '',
  defaultOrder = '',
  staticColumns = [],
  extraColumns = [],
  summaryConfig = { label: '合计', rules: {}, expressions: {} },
  rows = [],
  visibleRows = rows,
  payload = {},
  previousLoadState = buildGridLoadState(),
  searchText = '',
  dataScope = '',
  summaryScope = 'server',
  allowImport = true,
  aiScene = 'grid_chat',
  sampleLimit = DEFAULT_SAMPLE_LIMIT,
  additionalContext = {}
} = {}) {
  if (typeof pushAiContext !== 'function') return buildGridLoadState(payload, rows, visibleRows)

  const rawRows = Array.isArray(rows) ? rows : []
  const displayRows = Array.isArray(visibleRows) ? visibleRows : rawRows
  const columns = normalizeGridColumns(staticColumns, extraColumns)
  const nextLoadState = payload
    ? buildGridLoadState(payload, rawRows, displayRows)
    : previousLoadState
  const normalizedSearchText = String(searchText || payload?.searchText || '')
  const normalizedDataScope = dataScope || (normalizedSearchText ? '当前搜索结果' : '当前列表数据')
  const importTarget = {
    apiUrl: writeUrl || String(apiUrl || '').split('?')[0],
    profile,
    viewId
  }
  const dataStats = enrichLoadedDataStats(
    buildStandardGridDataStats(displayRows, columns),
    nextLoadState,
    displayRows
  )
  const dataSample = buildStandardGridDataSample(displayRows, columns, sampleLimit)

  pushAiContext({
    app,
    view,
    viewId,
    apiUrl,
    profile,
    columns,
    staticColumns,
    extraColumns,
    summaryConfig,
    dataStats,
    dataSample,
    dataScope: normalizedDataScope,
    searchText: normalizedSearchText,
    gridAgent: buildGridAgentContext({
      app,
      view,
      viewId,
      apiUrl,
      writeUrl,
      profile,
      contentProfile: contentProfile || profile,
      defaultOrder,
      columns,
      staticColumns,
      extraColumns,
      summaryConfig,
      searchText: normalizedSearchText,
      dataScope: normalizedDataScope,
      loadState: nextLoadState,
      allowImport,
      importTarget,
      summaryScope
    }),
    aiScene,
    allowImport,
    importTarget,
    ...additionalContext
  })

  return nextLoadState
}
