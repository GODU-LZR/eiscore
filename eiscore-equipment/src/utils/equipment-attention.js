// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const ATTENTION_AUTO_VALUE = '__auto'
export const ATTENTION_LEVELS = ['silent', 'normal', 'focus', 'warning', 'critical']
export const ATTENTION_LEVEL_OPTIONS = [
  { label: '自动', value: ATTENTION_AUTO_VALUE },
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

export const formatShortDate = (value) => {
  const date = parseDate(value)
  if (!date) return '--'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function calcAttentionScore(item, context = {}) {
  const urgency = item.urgency ?? 0
  const impact = item.businessImpact ?? 0
  const risk = item.risk ?? 0
  const frequency = item.frequency ?? 0
  const permissionPenalty = item.permissionSensitive && context.role !== 'admin' ? -15 : 0

  return Math.max(0, Math.min(100,
    urgency * 0.35 + impact * 0.30 + risk * 0.25 + frequency * 0.10 + permissionPenalty
  ))
}

export function scoreToAttentionLevel(score) {
  if (score >= 85) return 'critical'
  if (score >= 65) return 'warning'
  if (score >= 45) return 'focus'
  if (score >= 20) return 'normal'
  return 'silent'
}

export const attentionLevelMeta = (level) => LEVEL_META[level] || LEVEL_META.normal

export const attentionLevelRank = (level) => ATTENTION_LEVELS.indexOf(level)

export const normalizeAttentionLevel = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text || text === ATTENTION_AUTO_VALUE) return ''
  return ATTENTION_LEVELS.includes(text) ? text : ''
}

export const getManualAttentionLevel = (row = {}) => {
  return normalizeAttentionLevel(row?.properties?.attention_level ?? row?.attention_level)
}

const firstText = (...values) => {
  const found = values.find((value) => value !== null && value !== undefined && String(value).trim() !== '')
  return found === undefined ? '' : String(found)
}

export const equipmentRecordTitle = (appKey, row = {}) => {
  if (appKey === 'assets') return firstText(row.asset_name, row.asset_no, row.id)
  if (appKey === 'checks') return firstText(row.check_no, row.asset_name, row.asset_no, row.id)
  if (appKey === 'issues') return firstText(row.issue_no, row.asset_name, row.issue_desc, row.id)
  if (appKey === 'work_orders') return firstText(row.work_order_no, row.asset_name, row.task_desc, row.id)
  if (appKey === 'plans') return firstText(row.plan_name, row.plan_no, row.asset_scope, row.id)
  if (appKey === 'standards') return firstText(row.standard_name, row.standard_no, row.asset_type, row.id)
  return firstText(row.name, row.title, row.id)
}

const baseResult = (appKey, row, overrides = {}) => {
  const score = Math.max(0, Math.min(100, Math.round(overrides.score ?? 25)))
  const level = overrides.level || scoreToAttentionLevel(score)
  const meta = attentionLevelMeta(level)
  return {
    appKey,
    id: row?.id,
    title: equipmentRecordTitle(appKey, row),
    score,
    level,
    label: meta.label,
    status: meta.status,
    tagType: meta.tagType,
    reason: overrides.reason || '状态稳定',
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

function assetAttention(row) {
  const candidates = []
  const health = numberValue(row.health_score)
  const dueDays = daysBetween(row.next_maint_date)
  const isKeyAsset = row.asset_level === '关键'

  if (row.run_status === '停机') {
    candidates.push({ score: 96, level: 'critical', reason: '设备停机，影响生产连续性', action: '优先派工' })
  }
  if (row.run_status === '维修中') {
    candidates.push({ score: 78, level: 'warning', reason: '设备维修中，需要跟踪恢复时间', action: '跟踪工单' })
  }
  if (row.run_status === '待验收') {
    candidates.push({ score: 56, level: 'focus', reason: '设备等待验收确认', action: '完成验收' })
  }
  if (health > 0 && health < 60) {
    candidates.push({ score: 88, level: 'critical', reason: `健康评分 ${health}，存在高风险`, action: '安排检修' })
  } else if (health > 0 && health < 75) {
    candidates.push({ score: 72, level: 'warning', reason: `健康评分 ${health}，需要复检`, action: '安排复检' })
  } else if (health > 0 && health < 85) {
    candidates.push({ score: 50, level: 'focus', reason: `健康评分 ${health}，持续关注`, action: '查看趋势' })
  }
  if (dueDays !== null && dueDays < 0) {
    candidates.push({ score: 86, level: 'critical', reason: `保养逾期 ${Math.abs(dueDays)} 天`, action: '补做保养' })
  } else if (dueDays !== null && dueDays <= 3) {
    candidates.push({ score: 68, level: 'warning', reason: `${dueDays === 0 ? '今日' : `${dueDays} 天后`}到保养日`, action: '准备保养' })
  }
  if (isKeyAsset && candidates.length) {
    candidates[0].score = Math.min(100, candidates[0].score + 4)
  }
  return pickStrongest('assets', row, candidates, {
    score: row.run_status === '报废' ? 15 : 28,
    reason: row.run_status === '运行' ? '设备运行状态正常' : firstText(row.run_status, '设备状态已记录')
  })
}

function checkAttention(row) {
  const abnormal = numberValue(row.abnormal_count)
  const candidates = []
  if (row.check_result === '停机') {
    candidates.push({ score: 95, level: 'critical', reason: '点检结果触发停机', action: '转异常工单' })
  }
  if (row.check_result === '异常' || abnormal > 0) {
    candidates.push({
      score: abnormal >= 2 ? 80 : 72,
      level: 'warning',
      reason: abnormal > 0 ? `发现 ${abnormal} 个异常项` : '点检结果异常',
      action: '登记异常'
    })
  }
  if (row.check_result === '待处理') {
    candidates.push({ score: 54, level: 'focus', reason: '点检单待处理', action: '完成点检' })
  }
  return pickStrongest('checks', row, candidates, {
    score: row.check_result === '正常' ? 25 : 35,
    reason: row.check_result === '正常' ? '点检结果正常' : firstText(row.check_result, '点检状态已记录')
  })
}

function issueAttention(row) {
  const open = row.issue_status !== '已关闭'
  const urgent = ['紧急', '严重'].includes(row.issue_level)
  const dueDays = daysBetween(row.deadline)
  const candidates = []

  if (open && urgent && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 98, level: 'critical', reason: `${row.issue_level}异常逾期 ${Math.abs(dueDays)} 天`, action: '立即闭环' })
  }
  if (open && urgent) {
    candidates.push({ score: row.issue_level === '紧急' ? 90 : 76, level: row.issue_level === '紧急' ? 'critical' : 'warning', reason: `${row.issue_level}异常未关闭`, action: '推进处理' })
  }
  if (open && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 86, level: 'critical', reason: `处理期限逾期 ${Math.abs(dueDays)} 天`, action: '升级处理' })
  } else if (open && dueDays !== null && dueDays <= 1) {
    candidates.push({ score: 70, level: 'warning', reason: dueDays === 0 ? '今日到处理期限' : '明日到处理期限', action: '确认责任人' })
  }
  if (open && row.issue_status === '待处理') {
    candidates.push({ score: 66, level: 'warning', reason: '异常待处理', action: '分派责任人' })
  }
  return pickStrongest('issues', row, candidates, {
    score: open ? 48 : 18,
    reason: open ? firstText(row.issue_status, '异常处理中') : '异常已关闭',
    action: open ? '跟踪闭环' : '归档'
  })
}

function workOrderAttention(row) {
  const active = row.work_status !== '已完成'
  const dueDays = daysBetween(row.plan_date)
  const downtime = numberValue(row.downtime_hours)
  const candidates = []

  if (active && dueDays !== null && dueDays < 0 && downtime >= 2) {
    candidates.push({ score: 91, level: 'critical', reason: `工单逾期且停机 ${downtime}h`, action: '优先处理' })
  } else if (active && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 78, level: 'warning', reason: `计划日期逾期 ${Math.abs(dueDays)} 天`, action: '调整排程' })
  }
  if (active && downtime >= 4) {
    candidates.push({ score: 88, level: 'critical', reason: `停机时长 ${downtime}h`, action: '压缩停机' })
  } else if (active && downtime > 0) {
    candidates.push({ score: 68, level: 'warning', reason: `已产生停机 ${downtime}h`, action: '跟踪恢复' })
  }
  if (active && row.work_status === '待派工') {
    candidates.push({ score: 60, level: 'focus', reason: '工单待派工', action: '安排维修人员' })
  }
  if (active && row.work_status === '待验收') {
    candidates.push({ score: 52, level: 'focus', reason: '工单待验收', action: '确认结果' })
  }
  return pickStrongest('work_orders', row, candidates, {
    score: active ? 45 : 18,
    reason: active ? firstText(row.work_status, '工单处理中') : '工单已完成',
    action: active ? '推进工单' : '归档'
  })
}

function planAttention(row) {
  const active = row.plan_status !== '已完成'
  const dueDays = daysBetween(row.next_execute_date)
  const completion = numberValue(row.completion_rate)
  const candidates = []

  if (active && dueDays !== null && dueDays < 0) {
    candidates.push({ score: 90, level: 'critical', reason: `计划逾期 ${Math.abs(dueDays)} 天`, action: '补执行' })
  } else if (active && dueDays !== null && dueDays <= 3) {
    candidates.push({ score: 70, level: 'warning', reason: `${dueDays === 0 ? '今日' : `${dueDays} 天后`}执行`, action: '准备执行' })
  }
  if (active && completion > 0 && completion < 50) {
    candidates.push({ score: 67, level: 'warning', reason: `完成率 ${completion}% 偏低`, action: '补齐任务' })
  } else if (active && completion > 0 && completion < 80) {
    candidates.push({ score: 50, level: 'focus', reason: `完成率 ${completion}%`, action: '跟踪进度' })
  }
  if (row.plan_status === '已暂停') {
    candidates.push({ score: 58, level: 'focus', reason: '计划已暂停', action: '复核计划' })
  }
  return pickStrongest('plans', row, candidates, {
    score: active ? 42 : 18,
    reason: active ? firstText(row.plan_status, '计划执行中') : '计划已完成',
    action: active ? '跟踪计划' : '归档'
  })
}

function standardAttention(row) {
  const effectiveDays = daysBetween(row.effective_date)
  const candidates = []
  if (row.standard_status === '作废') {
    candidates.push({ score: 64, level: 'focus', reason: '标准已作废，需确认替代版本', action: '查看新版本' })
  }
  if (row.standard_status === '修订中') {
    candidates.push({ score: 58, level: 'focus', reason: '标准修订中', action: '确认发布' })
  }
  if (row.standard_status === '草稿') {
    candidates.push({ score: 52, level: 'focus', reason: '标准未生效', action: '完善标准' })
  }
  if (row.standard_status === '生效' && effectiveDays !== null && effectiveDays > 0) {
    candidates.push({ score: 68, level: 'warning', reason: `${effectiveDays} 天后生效`, action: '通知相关人员' })
  }
  return pickStrongest('standards', row, candidates, {
    score: row.standard_status === '生效' ? 24 : 40,
    reason: row.standard_status === '生效' ? '标准已生效' : firstText(row.standard_status, '标准状态已记录')
  })
}

export function getEquipmentRecordAttention(appKey, row = {}, context = {}) {
  if (!row || typeof row !== 'object') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '无记录' })
  if (row.status === 'deleted') return baseResult(appKey, row, { score: 0, level: 'silent', reason: '已删除' })

  const manualLevel = getManualAttentionLevel(row)
  if (manualLevel) return manualAttention(appKey, row, manualLevel)

  const resolver = {
    assets: assetAttention,
    checks: checkAttention,
    issues: issueAttention,
    work_orders: workOrderAttention,
    plans: planAttention,
    standards: standardAttention
  }[appKey]

  if (!resolver) {
    const score = calcAttentionScore({
      id: row.id,
      title: equipmentRecordTitle(appKey, row),
      type: 'table-row',
      urgency: row.status === 'draft' ? 35 : 20,
      businessImpact: 20,
      risk: 15,
      frequency: 10
    }, context)
    return baseResult(appKey, row, { score })
  }
  return resolver(row)
}

export function buildEquipmentAttentionSummary(appKey, rows = []) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      row,
      attention: getEquipmentRecordAttention(appKey, row)
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

export function matchesEquipmentAttentionFilter(appKey, row = {}, filter = 'all') {
  if (filter === 'all') return true
  const attention = getEquipmentRecordAttention(appKey, row)
  if (filter === 'critical') return attention.level === 'critical'
  if (filter === 'warning') return attention.level === 'warning'
  if (filter === 'focus') return attention.level === 'focus'
  if (filter === 'risk') return ['critical', 'warning'].includes(attention.level)
  if (filter !== 'todo') return true

  if (appKey === 'assets') {
    const dueDays = daysBetween(row.next_maint_date)
    return row.run_status !== '运行' || numberValue(row.health_score) < 80 || (dueDays !== null && dueDays <= 7)
  }
  if (appKey === 'checks') return row.check_result !== '正常'
  if (appKey === 'issues') return row.issue_status !== '已关闭'
  if (appKey === 'work_orders') return row.work_status !== '已完成'
  if (appKey === 'plans') return row.plan_status !== '已完成'
  if (appKey === 'standards') return row.standard_status !== '生效'
  return attention.level !== 'normal'
}

export function getEquipmentAppAttention(appKey, rows = []) {
  const summary = buildEquipmentAttentionSummary(appKey, rows)
  const meta = attentionLevelMeta(summary.level)
  return {
    ...summary,
    status: meta.status,
    statusText: meta.label
  }
}
