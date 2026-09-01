// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const ONTOLOGY_STATIC_TABLE_LABELS = {
  'public.users': '用户',
  'public.roles': '角色',
  'public.permissions': '权限点',
  'public.user_roles': '用户角色关系',
  'public.role_permissions': '角色权限关系',
  'public.v_permission_ontology': '权限语义视图',
  'public.ontology_inference_rules': '本体推理规则',
  'public.ontology_inferred_facts': '本体推理事实',
  'public.ontology_reasoning_runs': '本体推理运行',
  'public.v_ontology_reasoning_facts': '本体推理事实视图',
  'public.v_ontology_reasoning_edges': '本体推理边视图',
  'public.v_ontology_reasoning_summary': '本体推理摘要',
  'public.v_ontology_reasoning_rule_stats': '本体推理规则统计',
  'public.v_ontology_role_access_insights': '角色访问洞察',
  'public.v_ontology_sensitive_access_paths': '敏感字段访问路径',
  'public.v_ontology_table_dependency_paths': '表依赖路径',
  'public.v_ontology_table_impact_insights': '表影响洞察',
  'public.v_ontology_reasoning_health': '本体推理健康状态',
  'public.v_ontology_kg_nodes': '知识图谱节点视图',
  'workflow.definitions': '流程定义',
  'workflow.instances': '流程实例',
  'workflow.task_assignments': '任务分派',
  'app_center.apps': '应用中心应用',
  'app_center.workflow_state_mappings': '流程状态映射'
}

const SEMANTIC_CLASS_LABELS = {
  business_attribute: '业务属性',
  enum_attribute: '枚举属性',
  hierarchy_attribute: '层级属性',
  geo_attribute: '地理属性',
  file_attribute: '文件属性',
  derived_metric: '派生指标',
  time_attribute: '时间属性',
  json_attribute: 'JSON属性',
  identifier: '标识',
  reference_attribute: '引用属性',
  boolean_attribute: '布尔属性'
}

export const filterOntologyRelations = (relations, { relationType = 'ontology', searchText = '' } = {}) => {
  const keyword = String(searchText || '').trim().toLowerCase()
  return (Array.isArray(relations) ? relations : []).filter((item) => {
    const typePass = relationType === 'all' || item.relation_type === relationType
    if (!typePass) return false
    if (!keyword) return true
    const haystack = [
      item.subject_table,
      item.subject_column,
      item.predicate,
      item.object_table,
      item.object_column,
      item.subject_semantic_name,
      item.object_semantic_name,
      item.bridge_table,
      item.details
    ].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
}

export const collectOntologyRelationTables = (relations) => {
  const set = new Set()
  ;(Array.isArray(relations) ? relations : []).forEach((item) => {
    if (item.subject_table) set.add(item.subject_table)
    if (item.object_table) set.add(item.object_table)
  })
  return Array.from(set).sort((left, right) => left.localeCompare(right))
}

export const filterOntologyRelationsByTable = (relations, selectedTable) => {
  const list = Array.isArray(relations) ? relations : []
  if (!selectedTable) return list
  return list.filter((item) => item.subject_table === selectedTable || item.object_table === selectedTable)
}

export const countOntologyRelationTypes = (relations) => {
  const list = Array.isArray(relations) ? relations : []
  return {
    ontology: list.filter((item) => item.relation_type === 'ontology').length,
    foreignKey: list.filter((item) => item.relation_type === 'foreign_key').length
  }
}

export const getOntologyColumnTables = (selectedTable, pickedRelation) => {
  if (selectedTable) return [selectedTable]
  if (!pickedRelation) return []
  return Array.from(new Set([pickedRelation.subject_table, pickedRelation.object_table].filter(Boolean)))
}

export const flattenOntologyColumnSemantics = (tableKeys, semanticsCache) => (
  (Array.isArray(tableKeys) ? tableKeys : []).flatMap((tableKey) => {
    const rows = semanticsCache?.[tableKey] || []
    return rows.map((row) => ({ ...row, table_key: tableKey }))
  })
)

export const buildOntologyReasoningMetricCards = (summary = {}) => [
  { key: 'facts', label: '事实总数', value: summary.facts_total || 0 },
  { key: 'inferred', label: '推理事实', value: summary.inferred_facts || 0 },
  { key: 'app', label: '角色-应用', value: summary.role_app_access_facts || 0 },
  { key: 'table', label: '角色-业务表', value: summary.role_table_access_facts || 0 },
  { key: 'sensitive', label: '敏感可达', value: summary.sensitive_exposure_facts || 0 },
  { key: 'dependency', label: '传递依赖', value: summary.transitive_dependency_facts || 0 }
]

export const getOntologyReasoningHealthTagType = (health = {}) => {
  if (health.is_healthy === true) return 'success'
  if (health.health_code) return 'danger'
  return 'info'
}

export const buildOntologyInsightMetricCards = ({
  health = {},
  roleAccessInsights = [],
  tableImpactInsights = [],
  sensitiveAccessPaths = [],
  ruleStats = []
} = {}) => [
  {
    key: 'relations',
    label: '关系覆盖',
    value: `${health.semanticized_relations || 0}/${health.api_relations || 0}`
  },
  {
    key: 'columns',
    label: '字段覆盖',
    value: `${health.semanticized_columns || 0}/${health.ontology_columns || 0}`
  },
  { key: 'roles', label: '角色洞察', value: roleAccessInsights.length },
  { key: 'tables', label: '影响表', value: tableImpactInsights.length },
  { key: 'sensitive', label: '敏感路径', value: sensitiveAccessPaths.length },
  { key: 'rules', label: '规则统计', value: ruleStats.length }
]

export const filterOntologyReasoningFacts = (facts, searchText) => {
  const list = Array.isArray(facts) ? facts : []
  const keyword = String(searchText || '').trim().toLowerCase()
  if (!keyword) return list
  return list.filter((item) => {
    const haystack = [
      item.subject_type,
      item.subject_id,
      item.subject_label,
      item.predicate,
      item.object_type,
      item.object_id,
      item.object_label,
      item.inference_rule,
      item.rule_name
    ].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
}

export const firstOntologyRow = (value) => (Array.isArray(value) ? value[0] : value)

export const getOntologyRelationTypeLabel = (value) => {
  if (value === 'ontology') return '本体关系'
  if (value === 'foreign_key') return '外键关系'
  return value || '-'
}

export const getOntologySemanticClassLabel = (value) => SEMANTIC_CLASS_LABELS[value] || value || '-'

export const getOntologySemanticsModeLabel = (value) => {
  if (value === 'ai_defined') return 'AI定义'
  if (value === 'creator_defined') return '创建者定义'
  if (value === 'none') return '无语义'
  return value || '-'
}

export const cleanOntologyDisplayText = (value) => {
  const text = String(value || '').trim()
  if (!text || text.includes('?')) return ''
  return text
}

export const formatOntologyColumn = (value) => (value ? `.${value}` : '')

export const sanitizeOntologySemanticName = (value, fallback) => {
  const name = String(value || '').trim()
  if (!name || name === fallback || name.includes('?')) return ''
  return name
}

export const buildOntologyTableLabelMap = (relations) => {
  const map = { ...ONTOLOGY_STATIC_TABLE_LABELS }
  ;(Array.isArray(relations) ? relations : []).forEach((item) => {
    if (item.subject_table) {
      const semantic = sanitizeOntologySemanticName(item.subject_semantic_name, item.subject_table)
      if (semantic) map[item.subject_table] = semantic
    }
    if (item.object_table) {
      const semantic = sanitizeOntologySemanticName(item.object_semantic_name, item.object_table)
      if (semantic) map[item.object_table] = semantic
    }
  })
  return map
}

export const parseOntologyTableKey = (tableKey) => {
  const value = String(tableKey || '').trim()
  if (!value) return null
  const chunks = value.split('.')
  if (chunks.length === 1) return { schema: 'public', table: chunks[0], tableKey: `public.${chunks[0]}` }
  const schema = chunks[0]
  const table = chunks.slice(1).join('.')
  return { schema, table, tableKey: `${schema}.${table}` }
}

export const extractOntologySemanticsMode = (tags) => {
  if (!Array.isArray(tags)) return ''
  const hit = tags.find((item) => String(item || '').startsWith('semantics:'))
  return hit ? String(hit).slice('semantics:'.length) : ''
}
