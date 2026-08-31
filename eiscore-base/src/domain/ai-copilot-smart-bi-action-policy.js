// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { SMART_BI_DOMAINS } from '../../../shared/smart-bi-config.js'

export const AI_SMART_BI_CLOSURE_WORKFLOW_NAME = '智能BI经营闭环流程'

const SMART_BI_ACTION_BLOCKS = ['smart-bi-actions', 'smart_bi_actions', 'bi-actions', 'bi_actions']

const SMART_BI_RISK_LABELS = {
  normal: '正常',
  focus: '关注',
  warning: '预警',
  critical: '严重'
}

export const normalizeAiSmartBiActionDomain = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  const matched = SMART_BI_DOMAINS.find((domain) => (
    domain.key === raw
    || domain.label === value
    || domain.aliases.some((alias) => String(alias).toLowerCase() === raw)
  ))
  return matched?.key || raw || 'overview'
}

export const getAiSmartBiDomainLabel = (key) => {
  if (key === 'overview') return '经营总览'
  return SMART_BI_DOMAINS.find((domain) => domain.key === key)?.label || key || '经营'
}

export const normalizeAiSmartBiRiskLevel = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (['critical', 'serious', '严重', '高', '高风险'].includes(raw)) return 'critical'
  if (['warning', 'warn', '预警', '中', '中风险'].includes(raw)) return 'warning'
  if (['focus', '关注', '低', '低风险'].includes(raw)) return 'focus'
  return 'normal'
}

export const normalizeAiSmartBiAction = (item, index = 0) => {
  if (!item || typeof item !== 'object') return null
  const domain = normalizeAiSmartBiActionDomain(item.domain || item.domain_key || item.module || item.scope)
  const riskLevel = normalizeAiSmartBiRiskLevel(item.risk_level || item.riskLevel || item.risk || item.priority)
  const title = String(item.title || item.name || item.action || item.suggestion || '').trim()
    || `${getAiSmartBiDomainLabel(domain)}行动建议${index + 1}`
  const ownerRole = String(item.owner_role || item.ownerRole || item.role || '').trim()
  const ownerName = String(item.owner_name || item.ownerName || item.owner || item.responsible || '').trim()
  const dueDays = Number(item.due_days ?? item.dueDays ?? item.days ?? '')
  return {
    title,
    domain,
    domainLabel: getAiSmartBiDomainLabel(domain),
    riskLevel,
    riskLabel: SMART_BI_RISK_LABELS[riskLevel] || '正常',
    ownerRole,
    ownerName,
    dueDays: Number.isFinite(dueDays) && dueDays > 0 ? Math.floor(dueDays) : null,
    dueAt: item.due_at || item.dueAt || '',
    reason: String(item.reason || item.risk_reason || item.riskReason || item.problem || '').trim(),
    target: String(item.target || item.goal || item.expected_result || item.expectedResult || '').trim(),
    nextStep: String(item.next_step || item.nextStep || item.measure || item.todo || '').trim(),
    businessTable: String(item.business_table || item.businessTable || item.table || '').trim(),
    businessKey: String(item.business_key || item.businessKey || item.record_id || item.recordId || '').trim(),
    raw: item
  }
}

export const extractAiSmartBiActions = (text, { sanitizeJson = (value) => value } = {}) => {
  if (!text) return { actions: [], error: null }
  for (const tag of SMART_BI_ACTION_BLOCKS) {
    const regex = new RegExp(`\\\`\\\`\\\`${tag}([\\s\\S]*?)\\\`\\\`\\\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      try {
        const raw = sanitizeJson(match[1])
        const data = JSON.parse(raw)
        const list = Array.isArray(data) ? data : (data.actions || data.items || data.todos || [])
        if (!Array.isArray(list)) return { actions: [], error: 'invalid' }
        return {
          actions: list.map(normalizeAiSmartBiAction).filter(Boolean).slice(0, 5),
          error: null
        }
      } catch {
        return { actions: [], error: 'parse' }
      }
    }
  }
  return { actions: [], error: null }
}

export const stripAiSmartBiReportBlocks = (text = '') => String(text || '')
  .replace(/```(?:echarts|mermaid|smart-bi-actions|smart_bi_actions|bi-actions|bi_actions|bpmn-xml|workflow-meta)[\s\S]*?```/gi, '')
  .replace(/\s+/g, ' ')
  .trim()

export const buildAiSmartBiActionItemMap = (items = []) => {
  const map = {}
  if (!Array.isArray(items)) return map
  items.forEach((item) => {
    const messageTime = String(item?.source_message_time || '').trim()
    const actionIndex = String(item?.source_action_index ?? '').trim()
    if (messageTime && actionIndex) map[`${messageTime}-${actionIndex}`] = item
  })
  return map
}

export const resolveAiSmartBiActionDueAt = (action, { now = 0 } = {}) => {
  if (action?.dueAt) {
    const time = Date.parse(action.dueAt)
    if (Number.isFinite(time)) return new Date(time).toISOString()
  }
  if (action?.dueDays) return new Date(now + action.dueDays * 86400000).toISOString()
  return null
}

export const getAiPreviousUserQuestion = (msg, messages = [], limit = 500) => {
  const messageTime = Number(msg?.time || 0)
  const source = Array.isArray(messages) ? messages : []
  for (let index = source.length - 1; index >= 0; index -= 1) {
    const item = source[index]
    if (item?.role !== 'user') continue
    if (messageTime && Number(item?.time || 0) > messageTime) continue
    const text = String(item?.content || '').trim()
    if (text) return text.slice(0, limit)
  }
  return ''
}
