// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const MATERIAL_ATTENTION_AUTO_VALUE = '__auto'
export const MATERIAL_ATTENTION_LEVELS = ['silent', 'normal', 'focus', 'warning', 'critical']
export const MATERIAL_ATTENTION_LEVEL_OPTIONS = [
  { label: '自动', value: MATERIAL_ATTENTION_AUTO_VALUE },
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

export const attentionLevelRank = (level) => MATERIAL_ATTENTION_LEVELS.indexOf(level)

export const normalizeAttentionLevel = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text || text === MATERIAL_ATTENTION_AUTO_VALUE) return ''
  return MATERIAL_ATTENTION_LEVELS.includes(text) ? text : ''
}

export const getManualAttentionLevel = (row = {}) => {
  return normalizeAttentionLevel(row?.properties?.attention_level ?? row?.attention_level)
}

const propValue = (row, key) => row?.[key] ?? row?.properties?.[key]

const firstText = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && String(value).trim() !== '')
  return found === undefined ? '' : String(found)
}

const hasText = (value) => value !== null && value !== undefined && String(value).trim() !== ''

const hasPositiveQty = (value) => {
  const qty = Number(value)
  return Number.isFinite(qty) && qty > 0
}

const hasNumericValue = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))

const normalizeStatus = (status) => String(status || '').trim().toLowerCase()

const isClosedDraftStatus = (status) => {
  const text = normalizeStatus(status)
  return ['active', 'locked', 'completed', 'done', 'void', 'cancelled', 'canceled', '已完成', '已生效', '已取消'].includes(text)
}

export const materialRecordTitle = (appKey, row = {}) => {
  if (appKey === 'inventory-current') return firstText(row.material_name, row.material_code, row.batch_no, row.id)
  if (appKey === 'inventory-stock-in' || appKey === 'inventory-stock-out') {
    return firstText(row.transaction_no, row.material_name, row.material_code, row.batch_no, row.id)
  }
  return firstText(row.name, row.batch_no, row.material_name, row.material_code, row.id)
}

const baseResult = (appKey, row, overrides = {}) => {
  const score = Math.max(0, Math.min(100, Math.round(overrides.score ?? 25)))
  const level = overrides.level || scoreToAttentionLevel(score)
  const meta = attentionLevelMeta(level)
  return {
    appKey,
    id: row?.id,
    title: materialRecordTitle(appKey, row),
    score,
    level,
    label: meta.label,
    status: meta.status,
    tagType: meta.tagType,
    reason: overrides.reason || '物料状态稳定',
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

function materialMasterAttention(row) {
  const candidates = []
  const status = String(row.status || row?.properties?.status || '').trim()
  const hasUnit = !!propValue(row, 'unit') || !!propValue(row, 'measure_unit')
  const hasFinance = !!propValue(row, 'finance_attribute')

  if (!row.name || !row.batch_no) {
    candidates.push({ score: 88, level: 'critical', reason: '物料编码或名称缺失', action: '补齐物料主数据' })
  }
  if (!row.category) {
    candidates.push({ score: 74, level: 'warning', reason: '物料未归类', action: '补充分配物料分类' })
  }
  if (!hasUnit) {
    candidates.push({ score: 62, level: 'focus', reason: '缺少计量单位', action: '补充单位和换算关系' })
  }
  if (!hasFinance) {
    candidates.push({ score: 54, level: 'focus', reason: '财务属性未维护', action: '补充财务属性' })
  }
  if (['disabled', 'locked', '停用'].includes(status)) {
    candidates.push({ score: 18, level: 'silent', reason: '物料已停用或锁定', action: '低频查看' })
  }

  return pickStrongest('a', row, candidates, {
    score: 28,
    reason: '物料主数据可用',
    action: '维护物料档案'
  })
}

function currentStockAttention(row) {
  const available = numberValue(row.available_qty)
  const total = numberValue(row.total_qty)
  const locked = numberValue(row.locked_qty)
  const expiryDays = daysBetween(row.expiry_date)
  const candidates = []

  if (expiryDays !== null && expiryDays < 0 && total > 0) {
    candidates.push({ score: 92, level: 'critical', reason: `批次已过期 ${Math.abs(expiryDays)} 天`, action: '隔离或处理过期批次' })
  }
  if (available <= 0 && total > 0) {
    candidates.push({ score: 86, level: 'critical', reason: '可用库存为零但存在库存占用', action: '复核锁定和出库占用' })
  } else if (available <= 0) {
    candidates.push({ score: 82, level: 'warning', reason: '可用库存为零', action: '评估补货或替代物料' })
  } else if (available <= 10) {
    candidates.push({ score: 68, level: 'warning', reason: '可用库存偏低', action: '关注补货需求' })
  }
  if (expiryDays !== null && expiryDays >= 0 && expiryDays <= 30 && total > 0) {
    candidates.push({ score: expiryDays <= 7 ? 76 : 66, level: 'warning', reason: `${expiryDays} 天后过期`, action: '优先消耗临期批次' })
  }
  if (locked > 0 && total > 0 && locked / total >= 0.8) {
    candidates.push({ score: 58, level: 'focus', reason: '库存大部分被锁定', action: '复核占用单据' })
  }

  return pickStrongest('inventory-current', row, candidates, {
    score: 26,
    reason: '库存批次状态正常',
    action: '保持库存跟踪'
  })
}

function stockInDraftAttention(row) {
  const status = normalizeStatus(row.status || 'created')
  const createdAge = daysBetween(row.created_at)
  const candidates = []

  if (isClosedDraftStatus(status)) {
    return baseResult('inventory-stock-in', row, {
      score: 18,
      level: 'silent',
      reason: '入库草稿已生效',
      action: '查看入库流水'
    })
  }

  if (!hasText(row.material_id)) {
    candidates.push({ score: 94, level: 'critical', reason: '入库草稿缺少物料', action: '补齐物料后再生效' })
  }
  if (!hasText(row.warehouse_id)) {
    candidates.push({ score: 92, level: 'critical', reason: '入库草稿缺少库位', action: '选择仓库库位' })
  }
  if (!hasPositiveQty(row.quantity)) {
    candidates.push({ score: 90, level: 'critical', reason: '入库数量无效', action: '修正入库数量' })
  }
  if (!hasText(row.unit)) {
    candidates.push({ score: 82, level: 'warning', reason: '入库单位缺失', action: '补充计量单位' })
  }
  if (!hasText(row.io_type)) {
    candidates.push({ score: 78, level: 'warning', reason: '入库类型缺失', action: '选择入库类型' })
  }
  if (!hasText(row.batch_no)) {
    candidates.push({ score: 86, level: 'critical', reason: '入库批次号缺失', action: '生成或填写批次号' })
  }
  if (!hasText(row.production_date)) {
    candidates.push({ score: 48, level: 'focus', reason: '生产日期未维护', action: '补充批次追溯日期' })
  }
  if (createdAge !== null && createdAge <= -7) {
    candidates.push({ score: 76, level: 'warning', reason: `入库草稿已停留 ${Math.abs(createdAge)} 天`, action: '确认或作废草稿' })
  } else if (createdAge !== null && createdAge <= -2) {
    candidates.push({ score: 54, level: 'focus', reason: `入库草稿已停留 ${Math.abs(createdAge)} 天`, action: '尽快确认入库' })
  }

  return pickStrongest('inventory-stock-in', row, candidates, {
    score: 38,
    level: 'normal',
    reason: '入库草稿待确认',
    action: '检查后切换为生效'
  })
}

function stockOutDraftAttention(row) {
  const status = normalizeStatus(row.status || 'created')
  const createdAge = daysBetween(row.created_at)
  const qty = numberValue(row.quantity)
  const available = numberValue(row.available_qty)
  const candidates = []

  if (isClosedDraftStatus(status)) {
    return baseResult('inventory-stock-out', row, {
      score: 18,
      level: 'silent',
      reason: '出库草稿已生效',
      action: '查看出库流水'
    })
  }

  if (!hasText(row.material_id)) {
    candidates.push({ score: 94, level: 'critical', reason: '出库草稿缺少物料', action: '选择可出库物料' })
  }
  if (!hasText(row.warehouse_id)) {
    candidates.push({ score: 92, level: 'critical', reason: '出库草稿缺少库位', action: '选择出库库位' })
  }
  if (!hasPositiveQty(row.quantity)) {
    candidates.push({ score: 90, level: 'critical', reason: '出库数量无效', action: '修正出库数量' })
  }
  if (!hasText(row.unit)) {
    candidates.push({ score: 82, level: 'warning', reason: '出库单位缺失', action: '补充计量单位' })
  }
  if (!hasText(row.io_type)) {
    candidates.push({ score: 78, level: 'warning', reason: '出库类型缺失', action: '选择出库类型' })
  }
  if (!hasText(row.batch_no)) {
    candidates.push({ score: 88, level: 'critical', reason: '出库批次号缺失', action: '选择可用批次' })
  } else if (!hasText(row.batch_id)) {
    candidates.push({ score: 58, level: 'focus', reason: '出库批次未绑定库存批次', action: '复核批次来源' })
  }
  if (hasNumericValue(row.available_qty)) {
    if (available <= 0) {
      candidates.push({ score: 92, level: 'critical', reason: '出库批次无可用库存', action: '更换批次或补足库存' })
    } else if (qty > available) {
      candidates.push({ score: 96, level: 'critical', reason: '出库数量超过可用库存', action: '调整数量或批次' })
    } else if (available - qty <= 10) {
      candidates.push({ score: 62, level: 'focus', reason: '出库后可用库存偏低', action: '关注补货需求' })
    }
  }
  if (createdAge !== null && createdAge <= -7) {
    candidates.push({ score: 76, level: 'warning', reason: `出库草稿已停留 ${Math.abs(createdAge)} 天`, action: '确认或作废草稿' })
  } else if (createdAge !== null && createdAge <= -2) {
    candidates.push({ score: 54, level: 'focus', reason: `出库草稿已停留 ${Math.abs(createdAge)} 天`, action: '尽快确认出库' })
  }

  return pickStrongest('inventory-stock-out', row, candidates, {
    score: 40,
    level: 'normal',
    reason: '出库草稿待确认',
    action: '检查后切换为生效'
  })
}

export function getMaterialRecordAttention(appKey, row = {}, context = {}) {
  if (!row || typeof row !== 'object') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '无记录' })
  if (row.status === 'deleted') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '已删除' })

  const manualLevel = getManualAttentionLevel(row)
  if (manualLevel) return manualAttention(appKey, row, manualLevel)

  if (appKey === 'inventory-current') return currentStockAttention(row)
  if (appKey === 'inventory-stock-in') return stockInDraftAttention(row)
  if (appKey === 'inventory-stock-out') return stockOutDraftAttention(row)
  if (appKey === 'a') return materialMasterAttention(row)

  const score = context.task === 'monitor' ? 34 : 26
  return baseResult(appKey, row, { score })
}

export function buildMaterialAttentionSummary(appKey, rows = []) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      row,
      attention: getMaterialRecordAttention(appKey, row)
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

export function matchesMaterialAttentionFilter(appKey, row = {}, filter = 'all') {
  if (filter === 'all') return true
  const attention = getMaterialRecordAttention(appKey, row)
  if (filter === 'critical') return attention.level === 'critical'
  if (filter === 'warning') return attention.level === 'warning'
  if (filter === 'focus') return attention.level === 'focus'
  if (filter === 'risk') return ['critical', 'warning'].includes(attention.level)
  if (filter !== 'todo') return true

  if (appKey === 'inventory-current') {
    const available = numberValue(row.available_qty)
    const total = numberValue(row.total_qty)
    const expiryDays = daysBetween(row.expiry_date)
    return available <= 10 || (expiryDays !== null && expiryDays <= 30 && total > 0)
  }
  if (appKey === 'a') {
    return !row.name || !row.batch_no || !row.category || !propValue(row, 'unit') || !propValue(row, 'finance_attribute')
  }
  if (appKey === 'inventory-stock-in') {
    return !isClosedDraftStatus(row.status)
      && (
        !hasText(row.material_id)
        || !hasText(row.warehouse_id)
        || !hasPositiveQty(row.quantity)
        || !hasText(row.unit)
        || !hasText(row.io_type)
        || !hasText(row.batch_no)
        || ['critical', 'warning', 'focus'].includes(attention.level)
      )
  }
  if (appKey === 'inventory-stock-out') {
    return !isClosedDraftStatus(row.status)
      && (
        !hasText(row.material_id)
        || !hasText(row.warehouse_id)
        || !hasPositiveQty(row.quantity)
        || !hasText(row.unit)
        || !hasText(row.io_type)
        || !hasText(row.batch_no)
        || (hasNumericValue(row.available_qty) && numberValue(row.quantity) > numberValue(row.available_qty))
        || ['critical', 'warning', 'focus'].includes(attention.level)
      )
  }
  return ['critical', 'warning', 'focus'].includes(attention.level)
}
