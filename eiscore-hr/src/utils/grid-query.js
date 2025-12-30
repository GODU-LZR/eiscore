/**
 * 构造 PostgREST 复杂搜索参数
 * 生成类似: &or=(name.like.*val*,properties->>size.like.*val*)
 */
export function buildSearchQuery(keyword, staticFields, dynamicFields) {
  if (!keyword) return ''

  const text = String(keyword).trim()
  if (!text) return ''
  const isNumeric = /^-?\d+(\.\d+)?$/.test(text)

  // 1. 静态字段
  const conditions = staticFields
    .filter(f => f.searchable !== false) // 允许某些列不参与搜索
    .map(field => {
      const prop = field.prop
      if (!prop) return null
      const isNumberField = field.type === 'number' || field.searchType === 'number' || prop === 'id'
      if (isNumberField) {
        return isNumeric ? `${prop}.eq.${text}` : null
      }
      return `${prop}.ilike.*${text}*`
    })
    .filter(Boolean)

  // 2. 动态字段 (JSONB)
  if (dynamicFields && dynamicFields.length > 0) {
    dynamicFields.forEach(col => {
      // properties->>key 表示以文本方式读取 JSON 里的值
      if (!col?.prop) return
      conditions.push(`properties->>${col.prop}.ilike.*${text}*`)
    })
  }

  if (conditions.length === 0) return ''
  return `&or=(${conditions.join(',')})`
}
