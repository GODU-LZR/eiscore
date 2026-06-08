// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const CARD_LEVEL_RANK = { critical: 5, warning: 4, focus: 3, normal: 2, silent: 1 }

const LEVEL_META = {
  critical: { status: 'danger', statusText: '紧急' },
  warning: { status: 'warn', statusText: '预警' },
  focus: { status: 'info', statusText: '重点' },
  normal: { status: 'ok', statusText: '正常' },
  silent: { status: 'info', statusText: '次要' }
}

export const numberValue = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export const daysBetween = (value, base = new Date()) => {
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / 86400000)
}

export const moneyText = (value) => {
  const num = numberValue(value)
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}万`
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

export const percentText = (value) => {
  const num = numberValue(value)
  return Number.isInteger(num) ? `${num}%` : `${num.toFixed(1)}%`
}

export const levelFromScore = (score) => {
  if (score >= 85) return 'critical'
  if (score >= 65) return 'warning'
  if (score >= 45) return 'focus'
  if (score >= 20) return 'normal'
  return 'silent'
}

export const cardFromScore = ({ score = 25, metrics = [], brief = '保持更新' } = {}) => {
  const level = levelFromScore(score)
  return {
    score,
    attentionLevel: level,
    status: LEVEL_META[level].status,
    statusText: LEVEL_META[level].statusText,
    metrics,
    brief
  }
}

export const sortByAttention = (a, b) => {
  const rankDiff = (CARD_LEVEL_RANK[b.card?.attentionLevel] || 0) - (CARD_LEVEL_RANK[a.card?.attentionLevel] || 0)
  if (rankDiff) return rankDiff
  return (b.card?.score || 0) - (a.card?.score || 0)
}

export const buildGenericCard = (app, rows = [], loading = false) => {
  const count = Array.isArray(rows) ? rows.length : 0
  return {
    attentionLevel: 'normal',
    status: loading ? 'info' : 'ok',
    statusText: loading ? '同步中' : '正常',
    metrics: [
      { label: '记录数', value: `${count}` },
      { label: '状态', value: loading ? '同步' : '可用' }
    ],
    brief: app?.desc || '进入处理'
  }
}

export const appendQuery = (url, params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (!entries.length) return url
  const query = entries.map(([key, value]) => `${encodeURIComponent(key)}=${value}`).join('&')
  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}
