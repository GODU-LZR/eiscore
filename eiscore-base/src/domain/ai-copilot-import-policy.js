// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const isAiImportBlankValue = (value) => {
  if (value === undefined || value === null) return true
  return typeof value === 'string' && value.trim() === ''
}

export const hasAiImportValue = (value) => {
  if (isAiImportBlankValue(value)) return false
  if (Array.isArray(value)) return value.some(hasAiImportValue)
  if (typeof value === 'object') return Object.values(value).some(hasAiImportValue)
  return true
}

export const isAiMaterialsImportContext = (context, target) => {
  const app = String(context?.app || '').toLowerCase()
  const apiUrl = String(target?.apiUrl || context?.apiUrl || '')
  return app === 'materials' || apiUrl.includes('/raw_materials')
}

export const shouldAiImportAttachCurrentUser = (context) => {
  const columns = Array.isArray(context?.columns) ? context.columns : []
  const staticColumns = Array.isArray(context?.staticColumns) ? context.staticColumns : []
  return columns.concat(staticColumns).some((column) => column?.prop === 'created_by')
}

export const getAiImportDefaultMap = (context, target) => ({
  ...((context?.importDefaults && typeof context.importDefaults === 'object') ? context.importDefaults : {}),
  ...((target?.defaults && typeof target.defaults === 'object') ? target.defaults : {})
})

export const getAiImportRequiredFields = (context, target) => {
  const fields = []
  if (Array.isArray(context?.importRequiredFields)) fields.push(...context.importRequiredFields)
  if (Array.isArray(target?.requiredFields)) fields.push(...target.requiredFields)
  return Array.from(new Set(fields.filter(Boolean)))
}

export const getAiImportGeneratedFields = (context, target) => {
  const fields = []
  if (Array.isArray(context?.importGeneratedFields)) fields.push(...context.importGeneratedFields)
  if (Array.isArray(target?.generatedFields)) fields.push(...target.generatedFields)
  return fields.filter((field) => field?.prop)
}

export const generateAiImportCode = (prefix, index, now) => {
  const date = now instanceof Date ? now : new Date(now)
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  const seq = String(index + 1).padStart(4, '0')
  return `${prefix || 'NO-'}${yyyy}${mm}${dd}${hh}${mi}${ss}${ms}-${seq}`
}

export const normalizeAiImportRow = (row, context) => {
  const labelToProp = new Map((context?.columns || []).map((column) => [column.label, column.prop]))
  const normalized = {}
  Object.entries(row || {}).forEach(([key, value]) => {
    if (key === 'properties') return
    const prop = labelToProp.get(key) || key
    if (hasAiImportValue(normalized[prop]) && prop !== key) return
    normalized[prop] = value
  })
  if (row?.properties && typeof row.properties === 'object') normalized.properties = row.properties
  return normalized
}

export const prepareAiGenericImportRows = (
  rows,
  context,
  target,
  { generateCode = () => '' } = {}
) => {
  const defaults = getAiImportDefaultMap(context, target)
  const requiredFields = getAiImportRequiredFields(context, target)
  const generatedFields = getAiImportGeneratedFields(context, target)
  let skipped = 0
  const cleanedRows = []

  rows.forEach((row) => {
    const normalizedRow = normalizeAiImportRow(row, context)
    if (!Object.values(normalizedRow).some(hasAiImportValue)) {
      skipped += 1
      return
    }
    const nextRow = { ...defaults, ...normalizedRow }
    generatedFields.forEach((field) => {
      if (!hasAiImportValue(nextRow[field.prop])) {
        nextRow[field.prop] = generateCode(field.prefix, cleanedRows.length)
      }
    })
    if (!requiredFields.every((field) => hasAiImportValue(nextRow[field]))) {
      skipped += 1
      return
    }
    cleanedRows.push(nextRow)
  })
  return { rows: cleanedRows, skipped }
}

export const buildAiImportPayload = (rows, context, { currentUser = '' } = {}) => {
  const staticProps = new Set((context?.staticColumns || []).map((column) => column.prop))
  const labelToProp = new Map((context?.columns || []).map((column) => [column.label, column.prop]))
  const propertyFields = new Set(context?.propertyFields || [])
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return null
    const payload = { properties: {} }
    const rowProps = row.properties && typeof row.properties === 'object' ? row.properties : null
    let hasValue = false
    Object.entries(row).forEach(([key, value]) => {
      if (key === 'properties' || !hasAiImportValue(value)) return
      let prop = key
      if (!staticProps.has(prop) && labelToProp.has(prop)) prop = labelToProp.get(prop)
      hasValue = true
      if (staticProps.has(prop)) {
        if (propertyFields.has(prop)) payload.properties[prop] = value
        else payload[prop] = value
      } else {
        payload.properties[prop] = value
      }
    })
    if (rowProps) {
      Object.entries(rowProps).forEach(([key, value]) => {
        if (!hasAiImportValue(value)) return
        payload.properties[key] = value
        hasValue = true
      })
    }
    if (staticProps.has('created_by') && currentUser) payload.created_by = currentUser
    if (Object.keys(payload.properties).length === 0) delete payload.properties
    return hasValue ? payload : null
  }).filter(Boolean)
}
