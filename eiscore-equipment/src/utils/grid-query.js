// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export function buildSearchQuery(keyword, staticFields, dynamicFields) {
  if (!keyword) return ''
  const text = String(keyword).trim()
  if (!text) return ''
  const isNumeric = /^-?\d+(\.\d+)?$/.test(text)

  const conditions = staticFields
    .filter((field) => field.searchable !== false)
    .map((field) => {
      const prop = field.prop
      if (!prop) return null
      const isNumberField = field.type === 'number' || field.searchType === 'number' || prop === 'id'
      if (isNumberField) return isNumeric ? `${prop}.eq.${text}` : null
      return `${prop}.ilike.*${text}*`
    })
    .filter(Boolean)

  ;(dynamicFields || []).forEach((col) => {
    if (!col?.prop) return
    conditions.push(`properties->>${col.prop}.ilike.*${text}*`)
  })

  return conditions.length ? `&or=(${conditions.join(',')})` : ''
}

