// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const AI_FORM_TEMPLATE_BLOCKS = ['form-template', 'form_template', 'form-schema', 'form_schema']
export const AI_FORMULA_BLOCKS = ['formula']
export const AI_IMPORT_BLOCKS = ['data-import', 'data_import', 'grid-import', 'grid_import']
export const AI_BPMN_BLOCKS = ['bpmn-xml', 'bpmn_xml', 'workflow-bpmn', 'workflow_bpmn']
export const AI_WORKFLOW_META_BLOCKS = ['workflow-meta', 'workflow_meta']
export const AI_SMART_BI_ACTION_BLOCKS = ['smart-bi-actions', 'smart_bi_actions', 'bi-actions', 'bi_actions']
export const AI_MATERIAL_CATEGORY_BLOCKS = [
  'materials-categories',
  'material-categories',
  'materials_categories',
  'material_categories'
]

const findAiMessageBlock = (text, blocks) => {
  if (!text) return null
  for (const tag of blocks) {
    const regex = new RegExp(`\\\`\\\`\\\`${tag}([\\s\\S]*?)\\\`\\\`\\\``, 'i')
    const match = text.match(regex)
    if (match && match[1]) return match[1]
  }
  return null
}

const parseAiJsonBlock = (text, blocks, sanitizeJson) => {
  const block = findAiMessageBlock(text, blocks)
  if (block === null) return { value: null, error: null }
  try {
    return { value: JSON.parse(sanitizeJson(block)), error: null }
  } catch {
    return { value: null, error: 'parse' }
  }
}

export const extractAiFormTemplate = (text, { sanitizeJson = (value) => value } = {}) => {
  const { value: schema, error } = parseAiJsonBlock(text, AI_FORM_TEMPLATE_BLOCKS, sanitizeJson)
  if (error) return { schema: null, error }
  if (schema && !schema.layout) return { schema: null, error: 'invalid' }
  return { schema, error: null }
}

export const extractAiFormula = (text) => {
  const block = findAiMessageBlock(text, AI_FORMULA_BLOCKS)
  if (block === null) return { formula: null, error: null }
  const formula = block.trim()
  return formula
    ? { formula, error: null }
    : { formula: null, error: 'empty' }
}

export const extractAiImportData = (text, { sanitizeJson = (value) => value } = {}) => {
  const { value: data, error } = parseAiJsonBlock(text, AI_IMPORT_BLOCKS, sanitizeJson)
  if (error) return { rows: null, error }
  if (data === null) return { rows: null, error: null }
  const rows = Array.isArray(data) ? data : (data.rows || data.data || data.items || null)
  return Array.isArray(rows)
    ? { rows, error: null }
    : { rows: null, error: 'invalid' }
}

export const extractAiBpmnXml = (text) => {
  const block = findAiMessageBlock(text, AI_BPMN_BLOCKS)
  if (block === null) return { xml: null, error: null }
  const xml = block.trim()
  return xml
    ? { xml, error: null }
    : { xml: null, error: 'empty' }
}

export const extractAiWorkflowMeta = (text, { sanitizeJson = (value) => value } = {}) => {
  const { value: meta, error } = parseAiJsonBlock(text, AI_WORKFLOW_META_BLOCKS, sanitizeJson)
  return { meta, error }
}

export const getAiWorkflowInfo = (text, options) => {
  const { xml, error } = extractAiBpmnXml(text)
  const meta = extractAiWorkflowMeta(text, options).meta
  return { xml, meta, error }
}

export const normalizeAiCategoryTree = (list, parentId = '') => {
  if (!Array.isArray(list)) return []
  return list.map((item, index) => {
    const raw = item && typeof item === 'object' ? item : { label: String(item ?? '').trim() }
    const label = String(raw.label ?? raw.name ?? '').trim() || `分类${index + 1}`
    let id = String(raw.id ?? raw.code ?? '').trim()
    if (!id) {
      const segment = String(index + 1).padStart(2, '0')
      id = parentId ? `${parentId}.${segment}` : segment
    }
    const children = normalizeAiCategoryTree(raw.children || raw.items || [], id)
    return { id, label, children: children.length ? children : undefined }
  })
}

export const extractAiCategoryData = (
  text,
  blocks = AI_MATERIAL_CATEGORY_BLOCKS,
  { sanitizeJson = (value) => value } = {}
) => {
  const { value: json, error } = parseAiJsonBlock(text, blocks, sanitizeJson)
  if (error) return { data: null, error }
  if (json === null) return { data: null, error: null }
  const list = Array.isArray(json)
    ? json
    : (json.list || json.items || json.categories || json.data || null)
  return Array.isArray(list)
    ? { data: normalizeAiCategoryTree(list), error: null }
    : { data: null, error: 'invalid' }
}

export const buildAiImportPreview = (info, contextColumns) => {
  const rows = Array.isArray(info?.rows) ? info.rows : []
  if (rows.length === 0) return { columns: [], rows: [] }
  const keySet = new Set()
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => keySet.add(key))
  })
  const columns = Array.isArray(contextColumns) ? contextColumns : []
  const orderedKeys = []
  columns.forEach((column) => {
    if (keySet.has(column.prop)) orderedKeys.push(column.prop)
  })
  keySet.forEach((key) => {
    if (!orderedKeys.includes(key)) orderedKeys.push(key)
  })
  const labelMap = new Map(columns.map((column) => [column.prop, column.label]))
  return {
    columns: orderedKeys.map((key) => ({ prop: key, label: labelMap.get(key) || key })),
    rows: rows.slice(0, 8)
  }
}
