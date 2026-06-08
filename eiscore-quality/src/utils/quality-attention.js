// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const QUALITY_ATTENTION_AUTO_VALUE = '__auto'
export const QUALITY_ATTENTION_LEVELS = ['silent', 'normal', 'focus', 'warning', 'critical']
export const QUALITY_ATTENTION_LEVEL_OPTIONS = [
  { label: '自动', value: QUALITY_ATTENTION_AUTO_VALUE },
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

export const percentText = (value) => {
  const num = numberValue(value)
  return Number.isInteger(num) ? `${num}%` : `${num.toFixed(1)}%`
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

export const formatShortDate = (value) => {
  const date = parseDate(value)
  if (!date) return '--'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function scoreToAttentionLevel(score) {
  if (score >= 85) return 'critical'
  if (score >= 65) return 'warning'
  if (score >= 45) return 'focus'
  if (score >= 20) return 'normal'
  return 'silent'
}

export const attentionLevelMeta = (level) => LEVEL_META[level] || LEVEL_META.normal

export const attentionLevelRank = (level) => QUALITY_ATTENTION_LEVELS.indexOf(level)

export const normalizeAttentionLevel = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text || text === QUALITY_ATTENTION_AUTO_VALUE) return ''
  return QUALITY_ATTENTION_LEVELS.includes(text) ? text : ''
}

export const getManualAttentionLevel = (row = {}) => {
  return normalizeAttentionLevel(row?.properties?.attention_level ?? row?.attention_level)
}

const firstText = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && String(value).trim() !== '')
  return found === undefined ? '' : String(found)
}

export const qualityRecordTitle = (appKey, row = {}) => {
  if (appKey === 'inspections') return firstText(row.doc_no, row.item_name, row.item_code, row.id)
  if (appKey === 'ncr') return firstText(row.doc_no, row.issue_desc, row.source_doc_no, row.id)
  if (appKey === 'actions') return firstText(row.action_no, row.task_desc, row.ncr_doc_no, row.id)
  if (appKey === 'audits') return firstText(row.audit_no, row.audit_scope, row.audit_type, row.id)
  if (appKey === 'standards') return firstText(row.standard_name, row.standard_no, row.item_category, row.id)
  return firstText(row.name, row.title, row.id)
}

const baseResult = (appKey, row, overrides = {}) => {
  const score = Math.max(0, Math.min(100, Math.round(overrides.score ?? 25)))
  const level = overrides.level || scoreToAttentionLevel(score)
  const meta = attentionLevelMeta(level)
  return {
    appKey,
    id: row?.id,
    title: qualityRecordTitle(appKey, row),
    score,
    level,
    label: meta.label,
    status: meta.status,
    tagType: meta.tagType,
    reason: overrides.reason || '质量状态稳定',
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

const hasLinkedNcr = (row = {}) => {
  return Boolean(row?.properties?.ncr_doc_no || row?.properties?.ncr_id || row?.ncr_doc_no || row?.ncr_id)
}

function inspectionAttention(row) {
  const sample = numberValue(row.sample_qty)
  const defect = numberValue(row.defect_qty)
  const defectRate = sample > 0 ? (defect / sample) * 100 : 0
  const linkedNcr = hasLinkedNcr(row)
  const candidates = []

  if (row.result === '不合格' && linkedNcr) {
    candidates.push({ score: 74, level: 'warning', reason: '不合格已生成异常单', action: '跟踪整改' })
  } else if (row.result === '不合格') {
    candidates.push({ score: 90, level: 'critical', reason: '检验结果不合格，阻塞放行', action: '发起异常' })
  }
  if (row.result === '待判定') {
    candidates.push({ score: 62, level: 'focus', reason: '检验结果待判定', action: '完成判定' })
  }
  if (row.result === '让步接收') {
    candidates.push({ score: 56, level: 'focus', reason: '让步接收需保留风险说明', action: '补充处置依据' })
  }
  if (defectRate >= 5) {
    candidates.push({ score: 82, level: 'warning', reason: `不良率 ${defectRate.toFixed(1)}% 偏高`, action: '复核批次' })
  } else if (defect > 0) {
    candidates.push({ score: 52, level: 'focus', reason: `发现 ${defect} 个不良`, action: '记录缺陷' })
  }

  return pickStrongest('inspections', row, candidates, {
    score: row.result === '合格' ? 24 : 35,
    reason: row.result === '合格' ? '检验结果合格' : firstText(row.result, '检验状态已记录')
  })
}

function ncrAttention(row) {
  const open = row.ncr_status !== '已关闭'
  const dueDays = daysBetween(row.deadline)
  const criticalSeverity = row.severity === '关键'
  const seriousSeverity = row.severity === '严重'
  const candidates = []

  if (open && criticalSeverity && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 98, level: 'critical', reason: `关键异常逾期 ${Math.abs(dueDays)} 天`, action: '立即升级' })
  }
  if (open && criticalSeverity) {
    candidates.push({ score: 90, level: 'critical', reason: '关键质量异常未关闭', action: '优先闭环' })
  }
  if (open && seriousSeverity) {
    candidates.push({ score: 76, level: 'warning', reason: '严重质量异常未关闭', action: '推进整改' })
  }
  if (open && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 86, level: 'critical', reason: `整改期限逾期 ${Math.abs(dueDays)} 天`, action: '升级处理' })
  } else if (open && dueDays !== null && dueDays <= 1) {
    candidates.push({ score: 70, level: 'warning', reason: dueDays === 0 ? '今日到整改期限' : '明日到整改期限', action: '确认责任人' })
  }
  if (open && row.ncr_status === '待整改') {
    candidates.push({ score: 66, level: 'warning', reason: '异常待整改', action: '分派措施' })
  }

  return pickStrongest('ncr', row, candidates, {
    score: open ? 48 : 18,
    reason: open ? firstText(row.ncr_status, '异常处理中') : '异常已关闭',
    action: open ? '跟踪闭环' : '归档'
  })
}

function actionAttention(row) {
  const active = row.action_status !== '已完成'
  const dueDays = daysBetween(row.due_date)
  const candidates = []

  if (active && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 88, level: 'critical', reason: `整改任务逾期 ${Math.abs(dueDays)} 天`, action: '补齐措施' })
  } else if (active && dueDays !== null && dueDays <= 1) {
    candidates.push({ score: 68, level: 'warning', reason: dueDays === 0 ? '今日到期' : '明日到期', action: '确认完成证据' })
  }
  if (active && row.action_status === '待验证') {
    candidates.push({ score: 58, level: 'focus', reason: '整改结果待验证', action: '安排验证' })
  }
  if (active && row.action_status === '待处理') {
    candidates.push({ score: 55, level: 'focus', reason: '整改任务待处理', action: '启动整改' })
  }

  return pickStrongest('actions', row, candidates, {
    score: active ? 42 : 18,
    reason: active ? firstText(row.action_status, '整改推进中') : '整改已完成',
    action: active ? '跟踪责任人' : '归档'
  })
}

function auditAttention(row) {
  const active = row.audit_status !== '已关闭'
  const dueDays = daysBetween(row.plan_date)
  const findingCount = numberValue(row.finding_count)
  const candidates = []

  if (active && row.audit_status === '待整改' && findingCount >= 3) {
    candidates.push({ score: 82, level: 'warning', reason: `审核发现 ${findingCount} 项待整改`, action: '拆解整改任务' })
  }
  if (active && row.audit_status === '待整改') {
    candidates.push({ score: 66, level: 'warning', reason: '审核发现项待整改', action: '跟踪整改' })
  }
  if (active && dueDays !== null && dueDays < 0 && row.audit_status === '计划中') {
    candidates.push({ score: 74, level: 'warning', reason: `审核计划逾期 ${Math.abs(dueDays)} 天`, action: '调整审核计划' })
  } else if (active && dueDays !== null && dueDays <= 1 && row.audit_status === '计划中') {
    candidates.push({ score: 54, level: 'focus', reason: dueDays === 0 ? '今日计划审核' : '明日计划审核', action: '准备审核' })
  }

  return pickStrongest('audits', row, candidates, {
    score: active ? 40 : 18,
    reason: active ? firstText(row.audit_status, '审核推进中') : '审核已关闭',
    action: active ? '跟踪审核' : '归档'
  })
}

function standardAttention(row) {
  const effectiveDays = daysBetween(row.effective_date)
  const candidates = []

  if (row.standard_status === '作废') {
    candidates.push({ score: 64, level: 'focus', reason: '检验标准已作废', action: '确认替代版本' })
  }
  if (row.standard_status === '修订中') {
    candidates.push({ score: 58, level: 'focus', reason: '检验标准修订中', action: '确认发布时间' })
  }
  if (row.standard_status === '草稿') {
    candidates.push({ score: 52, level: 'focus', reason: '检验标准未生效', action: '完善标准' })
  }
  if (row.standard_status === '生效' && effectiveDays !== null && effectiveDays > 0) {
    candidates.push({ score: 68, level: 'warning', reason: `${effectiveDays} 天后生效`, action: '通知检验员' })
  }

  return pickStrongest('standards', row, candidates, {
    score: row.standard_status === '生效' ? 24 : 40,
    reason: row.standard_status === '生效' ? '检验标准已生效' : firstText(row.standard_status, '标准状态已记录')
  })
}

export function getQualityRecordAttention(appKey, row = {}, context = {}) {
  if (!row || typeof row !== 'object') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '无记录' })
  if (row.status === 'deleted') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '已删除' })

  const manualLevel = getManualAttentionLevel(row)
  if (manualLevel) return manualAttention(appKey, row, manualLevel)

  const resolver = {
    inspections: inspectionAttention,
    ncr: ncrAttention,
    actions: actionAttention,
    audits: auditAttention,
    standards: standardAttention
  }[appKey]

  if (!resolver) {
    const score = Math.max(20, Math.min(60, context.task === 'monitor' ? 36 : 28))
    return baseResult(appKey, row, { score })
  }
  return resolver(row)
}

export function buildQualityAttentionSummary(appKey, rows = []) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      row,
      attention: getQualityRecordAttention(appKey, row)
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

export function getQualityAppAttention(appKey, rows = []) {
  const summary = buildQualityAttentionSummary(appKey, rows)
  const meta = attentionLevelMeta(summary.level)
  return {
    ...summary,
    status: meta.status,
    statusText: meta.label
  }
}
