// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const PURCHASE_ATTENTION_AUTO_VALUE = '__auto'
export const PURCHASE_ATTENTION_LEVELS = ['silent', 'normal', 'focus', 'warning', 'critical']
export const PURCHASE_ATTENTION_LEVEL_OPTIONS = [
  { label: '自动', value: PURCHASE_ATTENTION_AUTO_VALUE },
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

export const attentionLevelRank = (level) => PURCHASE_ATTENTION_LEVELS.indexOf(level)

export const normalizeAttentionLevel = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text || text === PURCHASE_ATTENTION_AUTO_VALUE) return ''
  return PURCHASE_ATTENTION_LEVELS.includes(text) ? text : ''
}

export const getManualAttentionLevel = (row = {}) => {
  return normalizeAttentionLevel(row?.properties?.attention_level ?? row?.attention_level)
}

const firstText = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && String(value).trim() !== '')
  return found === undefined ? '' : String(found)
}

export const purchaseRecordTitle = (appKey, row = {}) => {
  if (appKey === 'suppliers') return firstText(row.name, row.supplier_no, row.contact_name, row.id)
  if (appKey === 'demands') return firstText(row.demand_no, row.material_name, row.source_dept, row.id)
  if (appKey === 'orders') return firstText(row.order_no, row.supplier_name, row.material_name, row.id)
  if (appKey === 'arrivals') return firstText(row.arrival_no, row.order_no, row.material_name, row.id)
  return firstText(row.name, row.title, row.id)
}

const baseResult = (appKey, row, overrides = {}) => {
  const score = Math.max(0, Math.min(100, Math.round(overrides.score ?? 25)))
  const level = overrides.level || scoreToAttentionLevel(score)
  const meta = attentionLevelMeta(level)
  return {
    appKey,
    id: row?.id,
    title: purchaseRecordTitle(appKey, row),
    score,
    level,
    label: meta.label,
    status: meta.status,
    tagType: meta.tagType,
    reason: overrides.reason || '采购状态稳定',
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

const isDemandClosed = (row = {}) => ['已下单', '已关闭'].includes(String(row.demand_status || '').trim())
const isOrderClosed = (row = {}) => ['已完成', '已取消'].includes(String(row.order_status || '').trim())
const isArrivalClosed = (row = {}) => ['已入库', '异常'].includes(String(row.arrival_status || '').trim())

function supplierAttention(row) {
  const reviewDays = daysBetween(row.last_review_at)
  const leadTime = numberValue(row.lead_time_days)
  const candidates = []

  if (row.supplier_status === '暂停合作' || row.status === 'disabled') {
    candidates.push({ score: 88, level: 'critical', reason: '供应商暂停合作或已停用', action: '更换供应商' })
  }
  if (row.supplier_status === '待评审') {
    candidates.push({ score: 62, level: 'focus', reason: '供应商待评审', action: '完成供应商评审' })
  }
  if (['战略', '核心'].includes(row.level) && reviewDays !== null && reviewDays < -180) {
    candidates.push({ score: 68, level: 'warning', reason: `核心供应商 ${Math.abs(reviewDays)} 天未评审`, action: '安排复评' })
  }
  if (leadTime >= 21 && row.supplier_status === '合作中') {
    candidates.push({ score: 48, level: 'focus', reason: '供应商交期较长', action: '关注交付风险' })
  }

  return pickStrongest('suppliers', row, candidates, {
    score: row.supplier_status === '合作中' ? 26 : 38,
    reason: firstText(row.supplier_status, '供应商资料待维护'),
    action: row.supplier_status === '合作中' ? '保持维护' : '复核供应商状态'
  })
}

function demandAttention(row) {
  const closed = isDemandClosed(row)
  const dueDays = daysBetween(row.required_date)
  const quantity = numberValue(row.quantity)
  const candidates = []

  if (!closed && quantity <= 0) {
    candidates.push({ score: 88, level: 'critical', reason: '采购需求数量无效', action: '修正需求数量' })
  }
  if (!closed && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 86, level: 'critical', reason: `需求日期逾期 ${Math.abs(dueDays)} 天`, action: '下推采购订单' })
  } else if (!closed && dueDays !== null && dueDays <= 2) {
    candidates.push({ score: 70, level: 'warning', reason: dueDays === 0 ? '今日需要采购' : `${dueDays} 天内需要采购`, action: '下推采购订单' })
  }
  if (!closed && !row.preferred_supplier) {
    candidates.push({ score: 56, level: 'focus', reason: '缺少建议供应商', action: '补充供应商' })
  }
  if (!closed && row.demand_status === '待采购') {
    candidates.push({ score: 58, level: 'focus', reason: '采购需求待下单', action: '下推采购订单' })
  }

  return pickStrongest('demands', row, candidates, {
    score: closed ? 18 : 40,
    reason: closed ? firstText(row.demand_status, '需求已关闭') : firstText(row.demand_status, '采购需求待推进'),
    action: closed ? '归档' : '跟进采购需求'
  })
}

function orderAttention(row) {
  const closed = isOrderClosed(row)
  const arrivalDays = daysBetween(row.expected_arrival_date)
  const pendingQuantity = numberValue(row.pending_quantity)
  const totalAmount = numberValue(row.total_amount)
  const deliveryRisk = row?.properties?.delivery_risk || row.delivery_risk
  const candidates = []

  if (!closed && deliveryRisk === '延期') {
    candidates.push({ score: 88, level: 'critical', reason: '订单交期风险为延期', action: '登记到货/处理延期' })
  }
  if (!closed && arrivalDays !== null && arrivalDays < 0 && row.arrival_progress !== '已到齐') {
    candidates.push({ score: 86, level: 'critical', reason: `预计到货逾期 ${Math.abs(arrivalDays)} 天`, action: '登记到货跟踪' })
  } else if (!closed && arrivalDays !== null && arrivalDays <= 3 && row.arrival_progress !== '已到齐') {
    candidates.push({ score: 70, level: 'warning', reason: arrivalDays === 0 ? '今日预计到货' : `${arrivalDays} 天内预计到货`, action: '确认到货计划' })
  }
  if (!closed && pendingQuantity > 0 && row.order_status === '部分到货') {
    candidates.push({ score: 64, level: 'focus', reason: '订单仍有待到货数量', action: '继续登记到货' })
  }
  if (!closed && (!row.supplier_name || row.supplier_name === '待选择供应商')) {
    candidates.push({ score: 58, level: 'focus', reason: '采购订单缺少有效供应商', action: '补充供应商' })
  }
  if (!closed && totalAmount >= 100000) {
    candidates.push({ score: 54, level: 'focus', reason: '大额采购订单需跟踪', action: '跟踪交期和付款' })
  }

  return pickStrongest('orders', row, candidates, {
    score: closed ? 18 : 42,
    reason: closed ? firstText(row.order_status, '订单已关闭') : firstText(row.order_status, '采购订单执行中'),
    action: closed ? '归档' : '跟踪采购订单'
  })
}

function arrivalAttention(row) {
  const closed = isArrivalClosed(row)
  const arrivalDays = daysBetween(row.arrival_date)
  const arrivalQuantity = numberValue(row.arrival_quantity)
  const acceptedQuantity = numberValue(row.accepted_quantity)
  const candidates = []

  if (row.iqc_status === '不合格' || row.arrival_status === '异常') {
    candidates.push({ score: 92, level: 'critical', reason: '到货质检不合格或已标异常', action: '处理采购异常' })
  }
  if (!closed && row.iqc_status === '待检') {
    candidates.push({ score: 72, level: 'warning', reason: '到货单待 IQC 检验', action: '完成质检判定' })
  }
  if (!closed && ['合格', '让步接收'].includes(row.iqc_status)) {
    candidates.push({ score: 66, level: 'warning', reason: '到货已通过质检待入库', action: '确认采购入库' })
  }
  if (!closed && arrivalDays !== null && arrivalDays < -3 && !row.inbound_no) {
    candidates.push({ score: 68, level: 'warning', reason: `到货 ${Math.abs(arrivalDays)} 天未入库`, action: '确认采购入库' })
  }
  if (!closed && arrivalQuantity > 0 && acceptedQuantity > 0 && acceptedQuantity < arrivalQuantity) {
    candidates.push({ score: 56, level: 'focus', reason: '存在让步或部分合格数量', action: '复核入库数量' })
  }

  return pickStrongest('arrivals', row, candidates, {
    score: row.arrival_status === '已入库' ? 18 : 40,
    reason: firstText(row.arrival_status, row.iqc_status, '到货单待跟进'),
    action: row.arrival_status === '已入库' ? '归档' : '跟踪到货'
  })
}

export function getPurchaseRecordAttention(appKey, row = {}, context = {}) {
  if (!row || typeof row !== 'object') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '无记录' })
  if (row.status === 'deleted') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '已删除' })

  const manualLevel = getManualAttentionLevel(row)
  if (manualLevel) return manualAttention(appKey, row, manualLevel)

  const resolver = {
    suppliers: supplierAttention,
    demands: demandAttention,
    orders: orderAttention,
    arrivals: arrivalAttention
  }[appKey]

  if (!resolver) {
    const score = context.task === 'monitor' ? 36 : 28
    return baseResult(appKey, row, { score })
  }
  return resolver(row)
}

export function buildPurchaseAttentionSummary(appKey, rows = []) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      row,
      attention: getPurchaseRecordAttention(appKey, row)
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

export function matchesPurchaseAttentionFilter(appKey, row = {}, filter = 'all') {
  if (filter === 'all') return true
  const attention = getPurchaseRecordAttention(appKey, row)
  if (filter === 'critical') return attention.level === 'critical'
  if (filter === 'warning') return attention.level === 'warning'
  if (filter === 'focus') return attention.level === 'focus'
  if (filter === 'risk') return ['critical', 'warning'].includes(attention.level)
  if (filter !== 'todo') return true

  if (appKey === 'suppliers') {
    const reviewDays = daysBetween(row.last_review_at)
    return row.supplier_status !== '合作中' || (reviewDays !== null && reviewDays < -180)
  }
  if (appKey === 'demands') {
    const requiredDays = daysBetween(row.required_date)
    return !isDemandClosed(row) && (
      numberValue(row.quantity) <= 0 ||
      !row.preferred_supplier ||
      (requiredDays !== null && requiredDays <= 2) ||
      row.demand_status === '待采购'
    )
  }
  if (appKey === 'orders') {
    const arrivalDays = daysBetween(row.expected_arrival_date)
    return !isOrderClosed(row) && (
      row.arrival_progress !== '已到齐' ||
      !row.supplier_name ||
      row.supplier_name === '待选择供应商' ||
      (arrivalDays !== null && arrivalDays <= 3)
    )
  }
  if (appKey === 'arrivals') {
    return row.arrival_status !== '已入库' || ['待检', '不合格'].includes(row.iqc_status)
  }
  return ['critical', 'warning', 'focus'].includes(attention.level)
}

export function getPurchaseAppAttention(appKey, rows = []) {
  const summary = buildPurchaseAttentionSummary(appKey, rows)
  const meta = attentionLevelMeta(summary.level)
  return {
    ...summary,
    status: meta.status,
    statusText: meta.label
  }
}
