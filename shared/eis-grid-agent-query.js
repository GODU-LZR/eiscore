// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

const DATA_QUERY_RE = /(全量|全表|全部|总数|条数|数量|人数|员工数|多少条|多少个|多少人|有多少|几个|一共有|统计|汇总|合计|平均|最大|最小|分布|占比|排行|排名|按.+分组|分类统计|抽样|样本|最近|列出|有哪些|明细|详情|分析|overview|count|total|summary|aggregate|distribution|group|sample|top|average|avg|sum|max|min)/i
const SKIP_QUERY_RE = /(导入|上传|生成公式|公式|计算列|新增|创建|修改|删除|保存|审批|流程图|bpmn|import|formula|create|update|delete|workflow)/i

const GROUP_HINTS = [
  'status',
  'state',
  'stage',
  'department',
  'dept',
  'category',
  'type',
  'kind',
  'level',
  'priority',
  'owner',
  'handler',
  'warehouse',
  'region',
  'supplier',
  'customer',
  'material',
  'product',
  'method'
]

const NUMERIC_TYPES = new Set(['number', 'currency', 'percent', 'formula'])
const NON_QUERY_TYPES = new Set(['file', 'geo'])

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

const sanitizeSearchText = (value) => String(value || '')
  .trim()
  .replace(/[(),]/g, ' ')
  .replace(/\s+/g, ' ')
  .slice(0, 80)

const normalizeColumn = (col) => {
  const prop = String(col?.prop || '').trim()
  if (!prop || !IDENTIFIER_RE.test(prop)) return null
  const type = col?.type || 'text'
  if (NON_QUERY_TYPES.has(type)) return null
  const source = col?.source === 'properties' ? 'properties' : 'column'
  return {
    prop,
    label: col?.label || prop,
    type,
    source
  }
}

const collectGridAgentColumns = (context = {}) => {
  const gridColumns = context?.gridAgent?.searchableColumns
  if (Array.isArray(gridColumns) && gridColumns.length) return gridColumns
  return Array.isArray(context?.columns) ? context.columns : []
}

const mentionsGroupColumn = (text = '', columns = []) => {
  const normalizedText = String(text || '').toLowerCase()
  return columns
    .map(normalizeColumn)
    .filter((col) => col && !NUMERIC_TYPES.has(col.type))
    .some((col) => {
      const label = String(col.label || '').toLowerCase()
      const prop = String(col.prop || '').toLowerCase()
      return (label && normalizedText.includes(label)) || (prop && normalizedText.includes(prop))
    })
}

export function shouldPrefetchGridAgentQuery(userText, context = {}) {
  const text = String(userText || '').trim()
  if (!text || !context?.gridAgent) return false
  if (context.gridAgent?.capabilities?.serverAgentQuery !== true) return false
  if (!DATA_QUERY_RE.test(text)) return false
  if (SKIP_QUERY_RE.test(text)) return false
  return true
}

export function inferGridAgentQueryOperation(userText, context = {}) {
  const text = String(userText || '')
  const hasGroup = /(分布|占比|排行|排名|按.+分组|分类统计|group|distribution|top)/i.test(text)
  const hasNumeric = /(汇总|合计|总金额|金额|平均|最大|最小|sum|avg|average|max|min|numeric|aggregate)/i.test(text)
  const hasSample = /(抽样|样本|最近|列出|有哪些|明细|sample|list|recent)/i.test(text)
  const hasCount = /(总数|条数|数量|人数|员工数|多少条|多少个|多少人|有多少|几个|一共有|count|total)/i.test(text)
  const hasColumnGroupingIntent = /(各|每个|每一|每类|分别|按).*(统计|数量|人数|条数|个数|多少|汇总)|(分组|分部门|分状态|分仓库|分类).*(统计|数量|人数|条数|个数|多少|汇总)?|统计.*(各|每个|每一|每类|分别|按|分组|分部门|分状态|分仓库|分类)/i.test(text)
  const hasExplicitGroupColumn = mentionsGroupColumn(text, collectGridAgentColumns(context))
  const shouldGroupCount = hasGroup || ((hasCount || /统计/.test(text)) && (hasColumnGroupingIntent || hasExplicitGroupColumn))

  if (shouldGroupCount && hasNumeric) return 'overview'
  if (shouldGroupCount) return 'group_count'
  if (/(分析|统计|overview|summary)/i.test(text)) return 'overview'
  if (hasNumeric) return 'numeric_summary'
  if (hasSample) return 'sample'
  if (hasCount || context?.gridAgent?.dataAccess?.hasMore === true) return 'count'
  return 'overview'
}

export function buildGridAgentSearchQuery(searchText, columns = []) {
  const text = sanitizeSearchText(searchText)
  if (!text) return ''
  const isNumeric = /^-?\d+(\.\d+)?$/.test(text)
  const isDateLike = /^\d{4}-\d{1,2}-\d{1,2}$/.test(text)

  const conditions = []
  columns.slice(0, 60).forEach((col) => {
    const item = normalizeColumn(col)
    if (!item) return
    const prop = item.prop
    const lower = prop.toLowerCase()
    const isNumberField = NUMERIC_TYPES.has(item.type) || prop === 'id'
    const isDateField = item.type === 'date' || lower.endsWith('_date') || lower.endsWith('_at')

    if (isNumberField) {
      if (isNumeric) conditions.push(`${prop}.eq.${text}`)
      return
    }
    if (isDateField) {
      if (isDateLike) conditions.push(`${prop}.eq.${text}`)
      return
    }
    if (item.source === 'properties') {
      conditions.push(`properties->>${prop}.ilike.*${text}*`)
    } else {
      conditions.push(`${prop}.ilike.*${text}*`)
    }
  })

  return conditions.length ? `&or=(${conditions.join(',')})` : ''
}

export function pickGridAgentGroupColumn(userText, columns = []) {
  const text = String(userText || '').toLowerCase()
  const normalized = columns.map(normalizeColumn).filter(Boolean)
  const explicit = normalized.find((col) => {
    const label = String(col.label || '').toLowerCase()
    const prop = String(col.prop || '').toLowerCase()
    return (label && text.includes(label)) || (prop && text.includes(prop))
  })
  if (explicit && !NUMERIC_TYPES.has(explicit.type)) return explicit

  const scored = normalized
    .filter((col) => !NUMERIC_TYPES.has(col.type))
    .map((col) => {
      const key = `${col.prop} ${col.label}`.toLowerCase()
      const score = GROUP_HINTS.reduce((sum, hint, index) => (
        key.includes(hint) ? sum + (GROUP_HINTS.length - index) : sum
      ), 0)
      return { col, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.col || normalized.find((col) => !NUMERIC_TYPES.has(col.type)) || null
}

export function buildGridAgentQueryPayload({ context = {}, userText = '' } = {}) {
  if (!shouldPrefetchGridAgentQuery(userText, context)) return null
  const gridAgent = context.gridAgent || {}
  const relation = gridAgent.relation || {}
  const apiUrl = normalizeBaseUrl(relation.apiUrl || context.apiUrl || '')
  if (!apiUrl) return null

  const columns = Array.isArray(gridAgent.searchableColumns) && gridAgent.searchableColumns.length
    ? gridAgent.searchableColumns
    : (Array.isArray(context.columns) ? context.columns : [])
  const normalizedColumns = columns.map(normalizeColumn).filter(Boolean).slice(0, 80)
  const operation = inferGridAgentQueryOperation(userText, context)
  const groupColumn = ['group_count', 'overview'].includes(operation)
    ? pickGridAgentGroupColumn(userText, normalizedColumns)
    : null
  const searchText = gridAgent.dataAccess?.searchText ?? context.searchText ?? ''

  return {
    operation,
    api_url: apiUrl,
    accept_profile: relation.acceptProfile || context.profile || 'public',
    base_query: relation.baseQuery || extractApiFilterQuery(context.apiUrl || ''),
    search_query: safeDecodeQueryPart(buildGridAgentSearchQuery(searchText, normalizedColumns)),
    group_by: groupColumn?.prop || '',
    sample_limit: operation === 'sample' ? 20 : 8,
    group_limit: 12,
    columns: normalizedColumns
  }
}

export function formatGridAgentQueryResultForPrompt(result) {
  if (!result || typeof result !== 'object') return ''
  const compact = {
    scope: result.scope || 'server',
    operation: result.operation || '',
    table: result.table ? `${result.schema || 'public'}.${result.table}` : '',
    searchApplied: result.searchApplied === true,
    totalCount: result.totalCount,
    groupBy: result.groupBy || null,
    numericSummary: result.numericSummary || {},
    sample: Array.isArray(result.sample) ? result.sample.slice(0, 8) : [],
    durationMs: result.durationMs
  }
  return `\n\n【EISGrid 服务端受控查询结果】\n${JSON.stringify(compact, null, 2)}\n请优先使用这份 scope=server 的结果回答全量数量、分布、汇总问题；不要再把前端 dataSample 当成全量。`
}
