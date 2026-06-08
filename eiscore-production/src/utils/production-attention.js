// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const PRODUCTION_ATTENTION_AUTO_VALUE = '__auto'
export const PRODUCTION_ATTENTION_LEVELS = ['silent', 'normal', 'focus', 'warning', 'critical']
export const PRODUCTION_ATTENTION_LEVEL_OPTIONS = [
  { label: '自动', value: PRODUCTION_ATTENTION_AUTO_VALUE },
  { label: '紧急', value: 'critical' },
  { label: '预警', value: 'warning' },
  { label: '重点', value: 'focus' },
  { label: '正常', value: 'normal' },
  { label: '次要', value: 'silent' }
]

const LEVEL_META = {
  silent: { label: '次要', status: 'info', tagType: 'info' },
  normal: { label: '正常', status: 'ok', tagType: 'success' },
  focus: { label: '重点', status: 'info', tagType: 'primary' },
  warning: { label: '预警', status: 'warn', tagType: 'warning' },
  critical: { label: '紧急', status: 'danger', tagType: 'danger' }
}

export const numberValue = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export const parseDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const dayStart = (date = new Date()) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export const daysBetween = (value, base = new Date()) => {
  const target = parseDate(value)
  if (!target) return null
  return Math.round((dayStart(target).getTime() - dayStart(base).getTime()) / 86400000)
}

export function scoreToAttentionLevel(score) {
  if (score >= 85) return 'critical'
  if (score >= 65) return 'warning'
  if (score >= 45) return 'focus'
  if (score >= 20) return 'normal'
  return 'silent'
}

export const attentionLevelMeta = (level) => LEVEL_META[level] || LEVEL_META.normal

export const attentionLevelRank = (level) => PRODUCTION_ATTENTION_LEVELS.indexOf(level)

export const normalizeAttentionLevel = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text || text === PRODUCTION_ATTENTION_AUTO_VALUE) return ''
  return PRODUCTION_ATTENTION_LEVELS.includes(text) ? text : ''
}

export const getManualAttentionLevel = (row = {}) => {
  return normalizeAttentionLevel(row?.properties?.attention_level ?? row?.attention_level)
}

const firstText = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && String(value).trim() !== '')
  return found === undefined ? '' : String(found)
}

export const productionRecordTitle = (appKey, row = {}) => {
  if (appKey === 'plans') return firstText(row.product_material_name, row.product_material_code, row.source_order_nos, row.id)
  if (appKey === 'work_orders') return firstText(row.work_order_no, row.product_material_name, row.product_material_code, row.id)
  if (appKey === 'work_order_items') {
    const lineNo = firstText(row.line_no, row.id)
    return firstText(row.component_material_name, row.component_material_code, row.work_order_no && `${row.work_order_no}-${lineNo}`, row.id)
  }
  if (appKey === 'bom_list') return firstText(row.bom_no, row.bom_name, row.parent_material_name, row.id)
  return firstText(row.name, row.title, row.id)
}

const baseResult = (appKey, row, overrides = {}) => {
  const score = Math.max(0, Math.min(100, Math.round(overrides.score ?? 25)))
  const level = overrides.level || scoreToAttentionLevel(score)
  const meta = attentionLevelMeta(level)
  return {
    appKey,
    id: row?.id,
    title: productionRecordTitle(appKey, row),
    score,
    level,
    label: meta.label,
    status: meta.status,
    tagType: meta.tagType,
    reason: overrides.reason || '生产状态稳定',
    action: overrides.action || '保持更新'
  }
}

const pickStrongest = (appKey, row, candidates, fallback) => {
  const strongest = candidates
    .filter(Boolean)
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0]
  return baseResult(appKey, row, strongest || fallback)
}

const manualAttention = (appKey, row, level) => {
  const meta = attentionLevelMeta(level)
  const scoreMap = { critical: 92, warning: 72, focus: 52, normal: 28, silent: 12 }
  const actionMap = {
    critical: '立即处理',
    warning: '尽快跟进',
    focus: '持续跟踪',
    normal: '保持更新',
    silent: '低频查看'
  }
  return baseResult(appKey, row, {
    score: scoreMap[level] ?? 25,
    level,
    reason: `人工标记为${meta.label}`,
    action: actionMap[level] || '保持更新'
  })
}

const isClosedWorkOrder = (row = {}) => ['已完工', '已取消'].includes(String(row.work_order_status || '').trim())

function planAttention(row) {
  const plannedQty = numberValue(row.planned_qty)
  const openWorkOrders = numberValue(row.open_work_order_count)
  const dueDays = daysBetween(row.earliest_delivery_date)
  const candidates = []

  if (plannedQty > 0 && !row.bom_no) {
    candidates.push({ score: 88, level: 'critical', reason: '建议生产但缺少可用配方', action: '完善配方' })
  }
  if (plannedQty > 0 && dueDays !== null && dueDays < 0 && openWorkOrders === 0) {
    candidates.push({ score: 86, level: 'critical', reason: `交期已逾期 ${Math.abs(dueDays)} 天且未生成工单`, action: '生成工单' })
  } else if (plannedQty > 0 && dueDays !== null && dueDays <= 2 && openWorkOrders === 0) {
    candidates.push({ score: 70, level: 'warning', reason: dueDays === 0 ? '今日交付且未生成工单' : `${dueDays} 天内交付且未生成工单`, action: '生成工单' })
  }
  if (plannedQty > 0 && row.plan_status === '待生成工单') {
    candidates.push({ score: 64, level: 'focus', reason: '生产建议待转工单', action: '批量生成工单' })
  }
  if (openWorkOrders > 0) {
    candidates.push({ score: 42, level: 'normal', reason: `已有 ${openWorkOrders} 张未关闭工单`, action: '跟踪工单' })
  }

  return pickStrongest('plans', row, candidates, {
    score: plannedQty > 0 ? 40 : 18,
    reason: plannedQty > 0 ? firstText(row.plan_status, '存在生产建议') : '成品库存满足',
    action: plannedQty > 0 ? '跟踪建议' : '归档'
  })
}

function workOrderAttention(row) {
  const closed = isClosedWorkOrder(row)
  const shortage = numberValue(row.shortage_item_count)
  const dueDays = daysBetween(row.planned_finish_date)
  const candidates = []

  if (!closed && shortage > 0 && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 96, level: 'critical', reason: `工单逾期且 ${shortage} 项缺料`, action: '优先排缺料' })
  } else if (!closed && shortage > 0) {
    candidates.push({ score: 88, level: 'critical', reason: `${shortage} 项用料短缺`, action: '处理缺料' })
  }
  if (!closed && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 84, level: 'warning', reason: `计划完工逾期 ${Math.abs(dueDays)} 天`, action: '调整排产' })
  } else if (!closed && dueDays !== null && dueDays <= 1) {
    candidates.push({ score: 68, level: 'warning', reason: dueDays === 0 ? '今日计划完工' : '明日计划完工', action: '确认进度' })
  }
  if (!closed && row.priority === '紧急') {
    candidates.push({ score: 74, level: 'warning', reason: '紧急优先级工单未关闭', action: '优先处理' })
  } else if (!closed && row.priority === '高') {
    candidates.push({ score: 56, level: 'focus', reason: '高优先级工单', action: '持续跟踪' })
  }
  if (!closed && row.work_order_status === '待排产') {
    candidates.push({ score: 54, level: 'focus', reason: '工单待排产', action: '处理工单' })
  }
  if (!closed && row.work_order_status === '生产中') {
    candidates.push({ score: 46, level: 'focus', reason: '工单生产中', action: '跟进报工' })
  }

  return pickStrongest('work_orders', row, candidates, {
    score: closed ? 18 : 42,
    reason: closed ? firstText(row.work_order_status, '工单已关闭') : firstText(row.work_order_status, '工单处理中'),
    action: closed ? '归档' : '跟踪生产'
  })
}

function workOrderItemAttention(row) {
  const required = numberValue(row.required_qty)
  const issued = numberValue(row.issued_qty)
  const shortage = numberValue(row.shortage_qty)
  const available = numberValue(row.available_qty ?? row.properties?.available_qty)
  const candidates = []

  if (shortage > 0 && available <= 0) {
    candidates.push({ score: 94, level: 'critical', reason: `缺料 ${shortage} 且无可用库存`, action: '协调补料' })
  } else if (shortage > 0) {
    candidates.push({ score: 82, level: 'warning', reason: `缺料 ${shortage}`, action: '补齐领料' })
  }
  if (required > 0 && issued <= 0 && row.issue_status === '未领料') {
    candidates.push({ score: 66, level: 'warning', reason: '生产用料未领取', action: '登记领料' })
  }
  if (row.issue_status === '部分领料') {
    candidates.push({ score: 58, level: 'focus', reason: '用料部分领取', action: '继续领料' })
  }
  if (required > 0 && issued >= required) {
    candidates.push({ score: 20, level: 'normal', reason: '用料已齐套', action: '跟踪消耗' })
  }

  return pickStrongest('work_order_items', row, candidates, {
    score: row.issue_status === '已齐套' ? 20 : 40,
    reason: row.issue_status === '已齐套' ? '用料已齐套' : firstText(row.issue_status, '领料状态待更新'),
    action: row.issue_status === '已齐套' ? '保持更新' : '登记领料'
  })
}

function bomAttention(row) {
  const itemCount = numberValue(row.item_count)
  const candidates = []

  if (row.status === '启用' && itemCount <= 0) {
    candidates.push({ score: 78, level: 'warning', reason: '启用配方缺少用料项', action: '补齐用料' })
  }
  if (row.status === '草稿') {
    candidates.push({ score: 54, level: 'focus', reason: '配方仍为草稿', action: '完善后启用' })
  }
  if (['停用', '作废'].includes(row.status)) {
    candidates.push({ score: 45, level: 'focus', reason: `配方${row.status}`, action: '确认替代版本' })
  }

  return pickStrongest('bom_list', row, candidates, {
    score: row.status === '启用' ? 24 : 38,
    reason: row.status === '启用' ? '配方已启用' : firstText(row.status, '配方状态已记录'),
    action: row.status === '启用' ? '保持版本' : '维护配方'
  })
}

export function getProductionRecordAttention(appKey, row = {}, context = {}) {
  if (!row || typeof row !== 'object') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '无记录' })
  if (row.status === 'deleted') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '已删除' })

  const manualLevel = getManualAttentionLevel(row)
  if (manualLevel) return manualAttention(appKey, row, manualLevel)

  const resolver = {
    plans: planAttention,
    work_orders: workOrderAttention,
    work_order_items: workOrderItemAttention,
    bom_list: bomAttention
  }[appKey]

  if (!resolver) {
    const score = context.task === 'monitor' ? 36 : 28
    return baseResult(appKey, row, { score })
  }
  return resolver(row)
}

export function buildProductionAttentionSummary(appKey, rows = []) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      row,
      attention: getProductionRecordAttention(appKey, row)
    }))
    .sort((a, b) => b.attention.score - a.attention.score)

  const counts = { critical: 0, warning: 0, focus: 0, normal: 0, silent: 0 }
  items.forEach(({ attention }) => {
    counts[attention.level] = (counts[attention.level] || 0) + 1
  })

  const primary = items.find(({ attention }) => ['critical', 'warning', 'focus'].includes(attention.level))?.attention
    || items[0]?.attention
    || baseResult(appKey, {}, {
      score: 20,
      level: 'normal',
      reason: '暂无可显示记录',
      action: '新增记录'
    })

  return {
    total: items.length,
    counts,
    primary,
    topItems: items.slice(0, 3).map((item) => item.attention),
    level: primary.level,
    status: primary.status
  }
}

export function matchesProductionAttentionFilter(appKey, row = {}, filter = 'all') {
  if (filter === 'all') return true
  const attention = getProductionRecordAttention(appKey, row)
  if (filter === 'critical') return attention.level === 'critical'
  if (filter === 'warning') return attention.level === 'warning'
  if (filter === 'focus') return attention.level === 'focus'
  if (filter === 'risk') return ['critical', 'warning'].includes(attention.level)
  if (filter !== 'todo') return true

  if (appKey === 'plans') {
    return numberValue(row.planned_qty) > 0 && (!row.bom_no || row.plan_status === '待生成工单' || numberValue(row.open_work_order_count) === 0)
  }
  if (appKey === 'work_orders') {
    return !isClosedWorkOrder(row) && (
      numberValue(row.shortage_item_count) > 0 ||
      ['待排产', '生产中'].includes(row.work_order_status) ||
      ['高', '紧急'].includes(row.priority)
    )
  }
  if (appKey === 'work_order_items') {
    return numberValue(row.shortage_qty) > 0 || row.issue_status !== '已齐套'
  }
  if (appKey === 'bom_list') return row.status !== '启用' || numberValue(row.item_count) <= 0
  return ['critical', 'warning', 'focus'].includes(attention.level)
}

export function getProductionAppAttention(appKey, rows = []) {
  const summary = buildProductionAttentionSummary(appKey, rows)
  const meta = attentionLevelMeta(summary.level)
  return {
    ...summary,
    status: meta.status,
    statusText: meta.label
  }
}
