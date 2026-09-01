// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const EQUIPMENT_REALTIME_TABLES = Object.freeze([
  'equipment_assets',
  'equipment_checks',
  'equipment_issues',
  'equipment_work_orders',
  'equipment_maintenance_plans',
  'equipment_standards'
])

const equipmentRealtimeTableSet = new Set(EQUIPMENT_REALTIME_TABLES)

export const toEquipmentSignatureValue = (value) => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const buildEquipmentRowSignature = (row) => {
  if (!row || typeof row !== 'object') return toEquipmentSignatureValue(row)
  return Object.keys(row)
    .sort()
    .map((key) => `${key}:${toEquipmentSignatureValue(row[key])}`)
    .join('\u001f')
}

export const buildEquipmentRowsSignature = (rows) => (
  Array.isArray(rows) ? rows.map(buildEquipmentRowSignature).join('\u001e') : ''
)

export const normalizeEquipmentRows = (rows) => (Array.isArray(rows) ? rows : [])

export const shouldReplaceEquipmentRows = (currentRows, nextRows) => (
  buildEquipmentRowsSignature(currentRows) !== buildEquipmentRowsSignature(normalizeEquipmentRows(nextRows))
)

export const parseEquipmentRealtimePayload = (event) => {
  if (!event) return null
  if (event.payload && typeof event.payload === 'string') {
    try {
      return JSON.parse(event.payload)
    } catch (error) {
      return null
    }
  }
  if (event.payload && typeof event.payload === 'object') return event.payload
  return event.schema && event.table ? event : null
}

export const isEquipmentRealtimePayloadRelevant = (payload) => (
  payload?.schema === 'public' && equipmentRealtimeTableSet.has(payload.table)
)
