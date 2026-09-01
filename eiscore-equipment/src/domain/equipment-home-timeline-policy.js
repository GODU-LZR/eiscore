// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  calculateEquipmentPercent,
  formatEquipmentNumber,
  toEquipmentNumber
} from './equipment-home-presentation-policy.js'

export const parseEquipmentDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const startOfEquipmentDay = (date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export const calculateEquipmentDaysBetween = (value, referenceDate) => {
  const target = parseEquipmentDate(value)
  if (!target) return null
  return Math.round((
    startOfEquipmentDay(target).getTime() - startOfEquipmentDay(referenceDate).getTime()
  ) / 86400000)
}

export const formatEquipmentShortDate = (value) => {
  const date = parseEquipmentDate(value)
  if (!date) return '--'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export const formatEquipmentClockTime = (value) => {
  const date = parseEquipmentDate(value)
  if (!date) return '--:--:--'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

export const buildEquipmentCheckBuckets = ({ checks = [], referenceDate } = {}) => {
  const today = startOfEquipmentDay(referenceDate)
  const buckets = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return {
      date,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: 0,
      abnormal: 0
    }
  })
  checks.forEach((row) => {
    const date = parseEquipmentDate(row.check_date)
    if (!date) return
    const diff = Math.round((
      startOfEquipmentDay(date).getTime() - startOfEquipmentDay(today).getTime()
    ) / 86400000)
    const index = diff + 6
    if (index >= 0 && index < buckets.length) {
      buckets[index].count += 1
      buckets[index].abnormal += toEquipmentNumber(row.abnormal_count)
    }
  })
  const maxCount = Math.max(...buckets.map((item) => item.count), 1)
  return buckets.map((item) => ({
    ...item,
    pct: Math.max(8, calculateEquipmentPercent(item.count, maxCount))
  }))
}

export const buildEquipmentAlertRows = ({
  assets = [],
  issues = [],
  plans = [],
  referenceDate
} = {}) => {
  const alerts = []
  assets.forEach((row) => {
    if (!['停机', '维修中'].includes(row.run_status) && toEquipmentNumber(row.health_score) >= 75) return
    alerts.push({
      id: `asset-${row.id || row.asset_no}`,
      type: row.run_status || '健康',
      message: `${row.asset_no} · ${row.asset_name} · 健康 ${formatEquipmentNumber(row.health_score)}`,
      level: row.run_status === '停机' || toEquipmentNumber(row.health_score) < 70 ? 'danger' : 'warn',
      appKey: 'assets'
    })
  })
  issues.forEach((row) => {
    if (row.issue_status === '已关闭') return
    const delta = calculateEquipmentDaysBetween(row.deadline, referenceDate)
    alerts.push({
      id: `issue-${row.id || row.issue_no}`,
      type: row.issue_level || '异常',
      message: `${row.issue_no} · ${row.issue_desc}${delta !== null ? ` · ${delta < 0 ? '逾期' + Math.abs(delta) + '天' : delta + '天内到期'}` : ''}`,
      level: (delta !== null && delta < 0) || row.issue_level === '紧急' ? 'danger' : 'warn',
      appKey: 'issues'
    })
  })
  plans.forEach((row) => {
    if (row.plan_status === '已完成') return
    const delta = calculateEquipmentDaysBetween(row.next_execute_date, referenceDate)
    if (delta !== null && delta <= 1) {
      alerts.push({
        id: `plan-${row.id || row.plan_no}`,
        type: delta < 0 ? '计划逾期' : '计划临期',
        message: `${row.plan_no} · ${row.plan_name}`,
        level: delta < 0 ? 'danger' : 'warn',
        appKey: 'plans'
      })
    }
  })
  return alerts.slice(0, 8)
}
