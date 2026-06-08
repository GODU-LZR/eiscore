// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const HR_ATTENTION_AUTO_VALUE = '__auto'
export const HR_ATTENTION_LEVELS = ['silent', 'normal', 'focus', 'warning', 'critical']
export const HR_ATTENTION_LEVEL_OPTIONS = [
  { label: '自动', value: HR_ATTENTION_AUTO_VALUE },
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

export const attentionLevelRank = (level) => HR_ATTENTION_LEVELS.indexOf(level)

export const normalizeAttentionLevel = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text || text === HR_ATTENTION_AUTO_VALUE) return ''
  return HR_ATTENTION_LEVELS.includes(text) ? text : ''
}

export const getManualAttentionLevel = (row = {}) => {
  return normalizeAttentionLevel(row?.properties?.attention_level ?? row?.attention_level)
}

const firstText = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && String(value).trim() !== '')
  return found === undefined ? '' : String(found)
}

export const hrRecordTitle = (appKey, row = {}) => {
  if (appKey === 'a') return firstText(row.name, row.employee_no, row.department, row.id)
  if (appKey === 'b') return firstText(row.name, row.employee_no, row.to_position, row.id)
  if (appKey === 'c') return firstText(row.name, row.employee_no, row.att_date, row.id)
  return firstText(row.name, row.title, row.id)
}

const baseResult = (appKey, row, overrides = {}) => {
  const score = Math.max(0, Math.min(100, Math.round(overrides.score ?? 25)))
  const level = overrides.level || scoreToAttentionLevel(score)
  const meta = attentionLevelMeta(level)
  return {
    appKey,
    id: row?.id,
    title: hrRecordTitle(appKey, row),
    score,
    level,
    label: meta.label,
    status: meta.status,
    tagType: meta.tagType,
    reason: overrides.reason || '人事状态稳定',
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

const propValue = (row, key) => row?.[key] ?? row?.properties?.[key]
const hasAny = (row, keys) => keys.some((key) => {
  const value = propValue(row, key)
  return value !== null && value !== undefined && String(value).trim() !== ''
})

function employeeAttention(row) {
  const status = String(row.status || '').trim()
  const entryDays = daysBetween(propValue(row, 'entry_date'))
  const candidates = []

  if (!row.name || !row.employee_no) {
    candidates.push({ score: 86, level: 'critical', reason: '员工姓名或工号缺失', action: '补齐基础档案' })
  }
  if (!row.department || row.department === '待分配') {
    candidates.push({ score: 74, level: 'warning', reason: '员工未分配部门', action: '补充分配部门' })
  }
  if (['待入职', '待开通账号'].includes(status)) {
    candidates.push({ score: 68, level: 'warning', reason: `${status}需要跟进`, action: '完成人事入职事项' })
  }
  if (entryDays !== null && entryDays >= -7 && entryDays <= 7 && status !== '离职') {
    candidates.push({ score: 56, level: 'focus', reason: entryDays >= 0 ? `${entryDays} 天内入职` : `入职 ${Math.abs(entryDays)} 天内`, action: '跟进入职资料' })
  }
  if (!hasAny(row, ['phone', 'id_card', 'position'])) {
    candidates.push({ score: 48, level: 'focus', reason: '关键联系或岗位信息缺失', action: '补齐员工信息' })
  }
  if (['离职', '已离职'].includes(status)) {
    candidates.push({ score: 18, level: 'silent', reason: '员工已离职', action: '归档' })
  }

  return pickStrongest('a', row, candidates, {
    score: status === '在职' || status === 'active' ? 26 : 36,
    reason: firstText(status, '员工档案待维护'),
    action: '维护员工档案'
  })
}

function transferAttention(row) {
  const effectiveDays = daysBetween(propValue(row, 'effective_date'))
  const status = String(row.status || '').trim()
  const approver = propValue(row, 'approver')
  const candidates = []

  if (!row.name || !row.employee_no) {
    candidates.push({ score: 82, level: 'warning', reason: '调岗记录缺少员工身份', action: '补齐员工信息' })
  }
  if (!propValue(row, 'to_dept') || !propValue(row, 'to_position')) {
    candidates.push({ score: 76, level: 'warning', reason: '调岗目标部门或岗位缺失', action: '补齐调岗目标' })
  }
  if (!approver && !['已完成', '已关闭', 'locked', 'disabled'].includes(status)) {
    candidates.push({ score: 64, level: 'focus', reason: '调岗记录缺少审批人', action: '补充审批信息' })
  }
  if (effectiveDays !== null && effectiveDays < 0 && !['已完成', '已关闭'].includes(status)) {
    candidates.push({ score: 78, level: 'warning', reason: `调岗生效已过 ${Math.abs(effectiveDays)} 天`, action: '确认调岗结果' })
  } else if (effectiveDays !== null && effectiveDays <= 3 && effectiveDays >= 0) {
    candidates.push({ score: 58, level: 'focus', reason: `${effectiveDays === 0 ? '今日' : `${effectiveDays} 天内`}调岗生效`, action: '确认交接安排' })
  }

  return pickStrongest('b', row, candidates, {
    score: ['已完成', '已关闭'].includes(status) ? 18 : 36,
    reason: firstText(status, '调岗记录待维护'),
    action: ['已完成', '已关闭'].includes(status) ? '归档' : '跟进调岗'
  })
}

function attendanceAttention(row) {
  const attStatus = String(propValue(row, 'att_status') || '').trim()
  const attDays = daysBetween(propValue(row, 'att_date'))
  const overtime = numberValue(propValue(row, 'ot_hours'))
  const abnormal = row.late_flag || row.early_flag || row.leave_flag || row.absent_flag || ['迟到', '早退', '缺勤', '请假'].includes(attStatus)
  const candidates = []

  if (row.absent_flag || attStatus === '缺勤') {
    candidates.push({ score: attDays === 0 ? 92 : 82, level: attDays === 0 ? 'critical' : 'warning', reason: attDays === 0 ? '今日缺勤' : '存在缺勤记录', action: '复核考勤异常' })
  }
  if (attDays === 0 && abnormal) {
    candidates.push({ score: 78, level: 'warning', reason: `今日考勤${attStatus || '异常'}`, action: '处理今日异常' })
  }
  if (abnormal) {
    candidates.push({ score: 62, level: 'focus', reason: `考勤${attStatus || '异常'}待复核`, action: '复核考勤记录' })
  }
  if (attDays === 0 && !propValue(row, 'check_in')) {
    candidates.push({ score: 72, level: 'warning', reason: '今日尚未签到', action: '确认出勤状态' })
  }
  if (overtime >= 4) {
    candidates.push({ score: 48, level: 'focus', reason: '加班时长较高', action: '关注工时负荷' })
  }

  return pickStrongest('c', row, candidates, {
    score: attStatus === '正常' ? 22 : 34,
    reason: firstText(attStatus, '考勤记录待维护'),
    action: attStatus === '正常' ? '保持记录' : '查看考勤'
  })
}

export function getHrRecordAttention(appKey, row = {}, context = {}) {
  if (!row || typeof row !== 'object') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '无记录' })
  if (row.status === 'deleted') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '已删除' })

  const manualLevel = getManualAttentionLevel(row)
  if (manualLevel) return manualAttention(appKey, row, manualLevel)

  const resolver = {
    a: employeeAttention,
    b: transferAttention,
    c: attendanceAttention
  }[appKey]

  if (!resolver) {
    const score = context.task === 'monitor' ? 34 : 26
    return baseResult(appKey, row, { score })
  }
  return resolver(row)
}

export function buildHrAttentionSummary(appKey, rows = []) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      row,
      attention: getHrRecordAttention(appKey, row)
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

export function matchesHrAttentionFilter(appKey, row = {}, filter = 'all') {
  if (filter === 'all') return true
  const attention = getHrRecordAttention(appKey, row)
  if (filter === 'critical') return attention.level === 'critical'
  if (filter === 'warning') return attention.level === 'warning'
  if (filter === 'focus') return attention.level === 'focus'
  if (filter === 'risk') return ['critical', 'warning'].includes(attention.level)
  if (filter !== 'todo') return true

  if (appKey === 'a') {
    const entryDays = daysBetween(propValue(row, 'entry_date'))
    return !row.name || !row.employee_no || !row.department || row.department === '待分配' ||
      ['待入职', '待开通账号'].includes(row.status) ||
      (entryDays !== null && entryDays >= -7 && entryDays <= 7)
  }
  if (appKey === 'b') {
    const effectiveDays = daysBetween(propValue(row, 'effective_date'))
    return !propValue(row, 'to_dept') || !propValue(row, 'to_position') ||
      (effectiveDays !== null && effectiveDays <= 3)
  }
  if (appKey === 'c') {
    const attStatus = String(propValue(row, 'att_status') || '').trim()
    return row.late_flag || row.early_flag || row.leave_flag || row.absent_flag ||
      ['迟到', '早退', '缺勤', '请假'].includes(attStatus)
  }
  return ['critical', 'warning', 'focus'].includes(attention.level)
}
