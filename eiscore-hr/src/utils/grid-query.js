/**
 * 构造 PostgREST 复杂搜索参数
 * 生成类似: &or=(name.like.*val*,properties->>size.like.*val*)
 */
export function buildSearchQuery(keyword, staticFields, dynamicFields) {
  if (!keyword) return ''

  // 1. 静态字段
  const conditions = staticFields
    .filter(f => f.searchable !== false) // 允许某些列不参与搜索
    .map(field => `${field.prop}.like.*${keyword}*`)

  // 2. 动态字段 (JSONB)
  if (dynamicFields && dynamicFields.length > 0) {
    dynamicFields.forEach(col => {
      // properties->>key 表示以文本方式读取 JSON 里的值
      conditions.push(`properties->>${col.prop}.like.*${keyword}*`)
    })
  }

  return `&or=(${conditions.join(',')})`
}