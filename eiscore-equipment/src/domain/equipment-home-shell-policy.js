// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { toEquipmentNumber } from './equipment-home-presentation-policy.js'
import { formatEquipmentClockTime } from './equipment-home-timeline-policy.js'

export const EQUIPMENT_HOME_COLORS = {
  primary: 'var(--c-primary)',
  green: 'var(--c-green)',
  amber: 'var(--c-amber)',
  red: 'var(--c-red)',
  cyan: 'var(--c-cyan)',
  violet: 'var(--c-violet)'
}

const equipmentHomeAppRoutes = {
  assets: '/app/assets',
  checks: '/app/checks',
  issues: '/app/issues',
  work_orders: '/app/work_orders',
  plans: '/app/plans',
  standards: '/app/standards'
}

export const formatEquipmentScrollDuration = (count, factor = 3, min = 12) => (
  `${Math.max(toEquipmentNumber(count) * factor, min)}s`
)

export const formatEquipmentCockpitClock = (value) => value.toLocaleString('zh-CN', {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

export const resolveEquipmentRealtimeStatusText = (ready) => (ready ? '实时传输' : '轮询传输')

export const resolveEquipmentLastSyncText = (lastSyncAt) => (
  lastSyncAt ? `同步 ${formatEquipmentClockTime(lastSyncAt)}` : '等待同步'
)

export const buildEquipmentStatusPieStyle = (rows = []) => {
  const total = rows.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return { background: 'conic-gradient(rgba(255,255,255,0.16) 0deg 360deg)' }
  let cursor = 0
  const stops = rows.map((item) => {
    const start = cursor
    const size = (item.value / total) * 360
    cursor += size
    return `${item.color} ${start}deg ${cursor}deg`
  })
  return { background: `conic-gradient(${stops.join(', ')})` }
}

export const resolveEquipmentAppRoute = (key) => equipmentHomeAppRoutes[key]

export const buildEquipmentRecordRoute = (row, appKey) => {
  if (!row?.id) return null
  return {
    name: 'EquipmentDocumentDetail',
    params: { id: row.id },
    query: { appKey, demo: String(row.id).startsWith('demo-') ? '1' : undefined }
  }
}
