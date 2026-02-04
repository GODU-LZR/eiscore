/**
 * 构造 PostgREST 复杂搜索参数
 */
export function buildSearchQuery(keyword, staticFields, dynamicFields) {
  if (!keyword) return ''

  const text = String(keyword).trim()
  if (!text) return ''
  const isNumeric = /^-?\d+(\.\d+)?$/.test(text)

  const conditions = staticFields
    .filter((f) => f.searchable !== false)
    .map((field) => {
      const prop = field.prop
      if (!prop) return null
      const isNumberField = field.type === 'number' || field.searchType === 'number' || prop === 'id'
      if (isNumberField) {
        return isNumeric ? `${prop}.eq.${text}` : null
      }
      return `${prop}.ilike.*${text}*`
    })
    .filter(Boolean)

  if (dynamicFields && dynamicFields.length > 0) {
    dynamicFields.forEach((col) => {
      if (!col?.prop) return
      conditions.push(`properties->>${col.prop}.ilike.*${text}*`)
    })
  }

  if (conditions.length === 0) return ''
  return `&or=(${conditions.join(',')})`
}
