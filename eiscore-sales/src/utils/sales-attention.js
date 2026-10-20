// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const SALES_ATTENTION_AUTO_VALUE = '__auto'
export const SALES_ATTENTION_LEVELS = ['silent', 'normal', 'focus', 'warning', 'critical']
export const SALES_ATTENTION_LEVEL_OPTIONS = [
  { label: '自动', value: SALES_ATTENTION_AUTO_VALUE },
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

export const attentionLevelRank = (level) => SALES_ATTENTION_LEVELS.indexOf(level)

export const normalizeAttentionLevel = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text || text === SALES_ATTENTION_AUTO_VALUE) return ''
  return SALES_ATTENTION_LEVELS.includes(text) ? text : ''
}

export const getManualAttentionLevel = (row = {}) => {
  return normalizeAttentionLevel(row?.properties?.attention_level ?? row?.attention_level)
}

const firstText = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && String(value).trim() !== '')
  return found === undefined ? '' : String(found)
}

export const salesRecordTitle = (appKey, row = {}) => {
  if (appKey === 'customers') return firstText(row.name, row.customer_no, row.contact_name, row.id)
  if (appKey === 'orders' || appKey === 'shipment_requests') return firstText(row.order_no, row.customer_name, row.product_name, row.id)
  if (appKey === 'payments') return firstText(row.payment_no, row.order_no, row.customer_name, row.id)
  if (appKey === 'follow_ups') return firstText(row.follow_no, row.customer_name, row.contact_name, row.id)
  if (appKey === 'opportunities') return firstText(row.opportunity_name, row.opportunity_no, row.customer_name, row.id)
  return firstText(row.name, row.title, row.id)
}

const baseResult = (appKey, row, overrides = {}) => {
  const score = Math.max(0, Math.min(100, Math.round(overrides.score ?? 25)))
  const level = overrides.level || scoreToAttentionLevel(score)
  const meta = attentionLevelMeta(level)
  return {
    appKey,
    id: row?.id,
    title: salesRecordTitle(appKey, row),
    score,
    level,
    label: meta.label,
    status: meta.status,
    tagType: meta.tagType,
    reason: overrides.reason || '销售状态稳定',
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

const isClosedOrder = (row = {}) => ['已完成', '已取消'].includes(String(row.order_status || '').trim())
const isClosedOpportunity = (row = {}) => ['赢单', '输单', '搁置'].includes(String(row.stage || '').trim())

function customerAttention(row) {
  const creditLimit = numberValue(row.credit_limit)
  const receivable = numberValue(row.receivable_balance)
  const followDays = daysBetween(row.last_follow_up_at)
  const candidates = []

  if (creditLimit > 0 && receivable > creditLimit) {
    candidates.push({ score: 92, level: 'critical', reason: '应收余额超过信用额度', action: '登记回款' })
  } else if (creditLimit > 0 && receivable >= creditLimit * 0.8) {
    candidates.push({ score: 74, level: 'warning', reason: '应收接近信用额度', action: '跟进回款' })
  } else if (receivable > 0) {
    candidates.push({ score: 48, level: 'focus', reason: '存在未清应收余额', action: '持续跟进' })
  }
  if (row.level === '战略客户' && row.customer_status === '暂停合作') {
    candidates.push({ score: 82, level: 'warning', reason: '战略客户暂停合作', action: '复盘客户关系' })
  }
  if (followDays !== null && followDays < -30 && row.customer_status === '跟进中') {
    candidates.push({ score: 68, level: 'warning', reason: `超过 ${Math.abs(followDays)} 天未跟进`, action: '登记跟进' })
  }

  return pickStrongest('customers', row, candidates, {
    score: row.customer_status === '暂停合作' ? 42 : 26,
    reason: row.customer_status === '暂停合作' ? '客户暂停合作' : firstText(row.customer_status, '客户正常跟进'),
    action: row.customer_status === '暂停合作' ? '复核客户状态' : '保持跟进'
  })
}

function orderAttention(row, appKey = 'orders') {
  const closed = isClosedOrder(row)
  const dueDays = daysBetween(row.delivery_date)
  const amount = numberValue(row.total_amount)
  const candidates = []

  if (!closed && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 88, level: 'critical', reason: `交付日期逾期 ${Math.abs(dueDays)} 天`, action: '下推出货/出库' })
  } else if (!closed && dueDays !== null && dueDays <= 2) {
    candidates.push({ score: 72, level: 'warning', reason: dueDays === 0 ? '今日交付' : `${dueDays} 天内交付`, action: '确认交付准备' })
  }
  if (!closed && row.order_status === '草稿') {
    candidates.push({ score: 56, level: 'focus', reason: '订单仍为草稿', action: '确认订单' })
  }
  if (!closed && row.order_status === '已确认') {
    candidates.push({ score: 54, level: 'focus', reason: '订单待下游流转', action: '下推采购需求' })
  }
  if (!closed && amount >= 100000) {
    candidates.push({ score: 62, level: 'focus', reason: '大额订单需持续跟踪', action: '跟踪交付回款' })
  }
  if (appKey === 'shipment_requests' && !closed && ['已确认', '生产中'].includes(row.order_status)) {
    candidates.push({ score: 66, level: 'warning', reason: '订单待出货处理', action: '下推销售出库' })
  }

  return pickStrongest(appKey, row, candidates, {
    score: closed ? 18 : 42,
    reason: closed ? firstText(row.order_status, '订单已关闭') : firstText(row.order_status, '订单推进中'),
    action: closed ? '归档' : '跟踪订单'
  })
}

function paymentAttention(row) {
  const amount = numberValue(row.amount)
  const payDays = daysBetween(row.payment_date)
  const candidates = []

  if (row.verify_status !== '已核销' && payDays !== null && payDays < -7) {
    candidates.push({ score: 82, level: 'warning', reason: `回款超过 ${Math.abs(payDays)} 天未核销`, action: '完成核销' })
  }
  if (row.verify_status === '待核销') {
    candidates.push({ score: amount >= 50000 ? 72 : 58, level: amount >= 50000 ? 'warning' : 'focus', reason: '回款待核销', action: '核销回款' })
  }
  if (row.verify_status === '部分核销') {
    candidates.push({ score: 54, level: 'focus', reason: '回款部分核销', action: '继续核销' })
  }

  return pickStrongest('payments', row, candidates, {
    score: row.verify_status === '已核销' ? 18 : 38,
    reason: row.verify_status === '已核销' ? '回款已核销' : firstText(row.verify_status, '回款状态待更新'),
    action: row.verify_status === '已核销' ? '归档' : '跟踪核销'
  })
}

function followAttention(row) {
  const nextDays = daysBetween(row.next_follow_at)
  const candidates = []

  if (row.follow_result === '有意向' || row.follow_result === '报价中') {
    candidates.push({ score: 58, level: 'focus', reason: `${row.follow_result}客户需推进`, action: '推进商机' })
  }
  if (nextDays !== null && nextDays < 0 && !['已成交', '无效', '暂缓'].includes(row.follow_result)) {
    candidates.push({ score: 78, level: 'warning', reason: `下次跟进逾期 ${Math.abs(nextDays)} 天`, action: '补登记跟进' })
  } else if (nextDays !== null && nextDays <= 1 && !['已成交', '无效', '暂缓'].includes(row.follow_result)) {
    candidates.push({ score: 62, level: 'focus', reason: nextDays === 0 ? '今日需要跟进' : '明日需要跟进', action: '安排跟进' })
  }

  return pickStrongest('follow_ups', row, candidates, {
    score: ['已成交', '无效'].includes(row.follow_result) ? 18 : 36,
    reason: firstText(row.follow_result, '跟进记录已保存'),
    action: ['已成交', '无效'].includes(row.follow_result) ? '归档' : '继续跟进'
  })
}

function opportunityAttention(row) {
  const closed = isClosedOpportunity(row)
  const closeDays = daysBetween(row.expected_close_date)
  const amount = numberValue(row.expected_amount)
  const probability = numberValue(row.probability)
  const candidates = []

  if (!closed && closeDays !== null && closeDays < 0) {
    candidates.push({ score: 82, level: 'warning', reason: `预计成交逾期 ${Math.abs(closeDays)} 天`, action: '更新阶段' })
  } else if (!closed && closeDays !== null && closeDays <= 3) {
    candidates.push({ score: 66, level: 'warning', reason: `${closeDays === 0 ? '今日' : `${closeDays} 天内`}预计成交`, action: '确认下一步' })
  }
  if (!closed && amount >= 100000 && probability >= 60) {
    candidates.push({ score: 72, level: 'warning', reason: '高金额高赢率商机', action: '转销售订单' })
  } else if (!closed && probability >= 50) {
    candidates.push({ score: 54, level: 'focus', reason: '商机赢率较高', action: '推进成交' })
  }
  if (!closed && !row.next_action) {
    candidates.push({ score: 46, level: 'focus', reason: '缺少下一步动作', action: '补充行动' })
  }

  return pickStrongest('opportunities', row, candidates, {
    score: closed ? 18 : 38,
    reason: closed ? firstText(row.stage, '商机已关闭') : firstText(row.stage, '商机推进中'),
    action: closed ? '归档' : '推进商机'
  })
}

export function getSalesRecordAttention(appKey, row = {}, context = {}) {
  if (!row || typeof row !== 'object') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '无记录' })
  if (row.status === 'deleted') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '已删除' })

  const manualLevel = getManualAttentionLevel(row)
  if (manualLevel) return manualAttention(appKey, row, manualLevel)

  const resolver = {
    customers: customerAttention,
    orders: (item) => orderAttention(item, 'orders'),
    shipment_requests: (item) => orderAttention(item, 'shipment_requests'),
    payments: paymentAttention,
    follow_ups: followAttention,
    opportunities: opportunityAttention
  }[appKey]

  if (!resolver) {
    const score = context.task === 'monitor' ? 36 : 28
    return baseResult(appKey, row, { score })
  }
  return resolver(row)
}

export function buildSalesAttentionSummary(appKey, rows = []) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      row,
      attention: getSalesRecordAttention(appKey, row)
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

export function matchesSalesAttentionFilter(appKey, row = {}, filter = 'all') {
  if (filter === 'all') return true
  const attention = getSalesRecordAttention(appKey, row)
  if (filter === 'critical') return attention.level === 'critical'
  if (filter === 'warning') return attention.level === 'warning'
  if (filter === 'focus') return attention.level === 'focus'
  if (filter === 'risk') return ['critical', 'warning'].includes(attention.level)
  if (filter !== 'todo') return true

  if (appKey === 'customers') {
    return numberValue(row.receivable_balance) > 0 || row.customer_status === '跟进中'
  }
  if (appKey === 'orders' || appKey === 'shipment_requests') {
    const deliveryDays = daysBetween(row.delivery_date)
    return !isClosedOrder(row) && ((deliveryDays !== null && deliveryDays <= 2) || ['草稿', '已确认', '生产中'].includes(row.order_status))
  }
  if (appKey === 'payments') return row.verify_status !== '已核销'
  if (appKey === 'follow_ups') {
    const nextDays = daysBetween(row.next_follow_at)
    return !['已成交', '无效'].includes(row.follow_result) && (nextDays === null || nextDays <= 1)
  }
  if (appKey === 'opportunities') return !isClosedOpportunity(row)
  return ['critical', 'warning', 'focus'].includes(attention.level)
}

export function getSalesAppAttention(appKey, rows = []) {
  const summary = buildSalesAttentionSummary(appKey, rows)
  const meta = attentionLevelMeta(summary.level)
  return {
    ...summary,
    status: meta.status,
    statusText: meta.label
  }
}
