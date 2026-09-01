// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  extractOntologySemanticsMode,
  firstOntologyRow,
  parseOntologyTableKey
} from './ontology-workbench-relation-policy.js'

const PUBLIC_HEADERS = {
  'Accept-Profile': 'public',
  'Content-Profile': 'public'
}

const APP_DATA_HEADERS = {
  'Accept-Profile': 'app_data',
  'Content-Profile': 'app_data'
}

const publicRequest = (url, method = 'get', data) => ({
  url,
  method,
  ...(data === undefined ? {} : { data }),
  headers: PUBLIC_HEADERS
})

export const normalizeOntologyRows = (rows) => (Array.isArray(rows) ? rows : [])

export const normalizeOntologyFirstRow = (rows) => firstOntologyRow(rows) || {}

export const buildOntologyColumnSemanticsRequest = (tableKey) => {
  const parsed = parseOntologyTableKey(tableKey)
  if (!parsed) return null
  const schema = encodeURIComponent(parsed.schema)
  const table = encodeURIComponent(parsed.table)
  return publicRequest(`/ontology_column_semantics?select=table_schema,table_name,column_name,semantic_class,semantic_name,data_type,ui_type,is_sensitive,source,tags,is_active&table_schema=eq.${schema}&table_name=eq.${table}&is_active=is.true&order=column_name.asc`)
}

export const normalizeOntologyColumnSemanticsRows = (rows) => normalizeOntologyRows(rows).map((item) => ({
  ...item,
  table_key: `${item.table_schema}.${item.table_name}`,
  semantics_mode: extractOntologySemanticsMode(item.tags)
}))

export const ONTOLOGY_REASONING_SUMMARY_REQUEST = publicRequest(
  '/v_ontology_reasoning_summary?select=last_run_status,facts_total,seed_facts,inferred_facts,active_rules,role_app_access_facts,role_table_access_facts,workflow_transition_facts,sensitive_exposure_facts,transitive_dependency_facts,last_finished_at&limit=1'
)

export const buildOntologyReasoningFactsRequest = (predicate) => {
  const filter = predicate ? `&predicate=eq.${encodeURIComponent(predicate)}` : ''
  return publicRequest(`/v_ontology_reasoning_facts?select=id,subject_type,subject_id,subject_label,predicate,object_type,object_id,object_label,inference_rule,rule_name,inference_depth,is_inferred,evidence${filter}&order=is_inferred.desc,inference_depth.asc,id.asc&limit=200`)
}

export const ONTOLOGY_INSIGHT_REQUESTS = [
  publicRequest('/v_ontology_reasoning_health?select=id,is_healthy,health_code,facts_total,inferred_facts,api_relations,semanticized_relations,ontology_columns,semanticized_columns,missing_relation_semantics,missing_column_semantics,last_run_status,last_finished_at&limit=1'),
  publicRequest('/v_ontology_role_access_insights?select=role_code,role_name,accessible_apps,accessible_tables,operable_tables,sensitive_columns,sensitive_tables,inferred_permission_paths&order=sensitive_columns.desc,accessible_apps.desc,role_code.asc&limit=50'),
  publicRequest('/v_ontology_table_impact_insights?select=table_id,table_label,sensitive_columns,roles_can_access,roles_can_operate,direct_dependent_tables,transitive_dependent_tables,depends_on_tables,has_reasoning_impact&has_reasoning_impact=eq.true&order=transitive_dependent_tables.desc,roles_can_access.desc,table_id.asc&limit=50'),
  publicRequest('/v_ontology_reasoning_rule_stats?select=rule_code,rule_name,declared_predicate,facts_total,seed_facts,inferred_facts,predicate_count,is_active,min_depth,max_depth&order=inferred_facts.desc,facts_total.desc,rule_code.asc&limit=50'),
  publicRequest('/v_ontology_sensitive_access_paths?select=role_code,role_name,table_id,table_label,column_id,column_name,column_label,access_rule,access_predicate,inference_rule,rule_name&order=role_code.asc,table_id.asc,column_name.asc&limit=50')
]

export const normalizeOntologyInsightRows = (responses = []) => ({
  health: normalizeOntologyFirstRow(responses[0]),
  roles: normalizeOntologyRows(responses[1]),
  tables: normalizeOntologyRows(responses[2]),
  rules: normalizeOntologyRows(responses[3]),
  sensitive: normalizeOntologyRows(responses[4])
})

export const ONTOLOGY_REFRESH_REASONING_REQUEST = publicRequest(
  '/rpc/refresh_ontology_inferences',
  'post',
  { p_max_depth: 4 }
)

export const buildOntologyRoleAccessRequest = (roleCode) => publicRequest(
  '/rpc/explain_role_ontology_access',
  'post',
  { p_role_code: roleCode, p_limit: 50 }
)

export const buildOntologyKgNodeSearchRequest = ({ query, nodeType } = {}) => publicRequest(
  '/rpc/search_ontology_kg_nodes',
  'post',
  {
    p_query: String(query || '').trim() || null,
    p_node_type: nodeType || null,
    p_limit: 50
  }
)

export const pickOntologyKgSelectedNode = (rows, currentNode) => {
  const list = normalizeOntologyRows(rows)
  const currentKey = currentNode ? `${currentNode.node_type}:${currentNode.node_id}` : ''
  return list.find((row) => `${row.node_type}:${row.node_id}` === currentKey) || list[0] || null
}

export const buildOntologyKgNeighborRequest = (node, { direction, depth, predicate } = {}) => publicRequest(
  '/rpc/query_ontology_kg_neighbors',
  'post',
  {
    p_node_type: node?.node_type,
    p_node_id: node?.node_id,
    p_direction: direction,
    p_max_depth: Number(depth || 1),
    p_limit: 80,
    p_predicate: predicate || null
  }
)

const KG_PATH_TARGET_TYPES = new Set(['app', 'table', 'column', 'permission', 'role'])

export const pickOntologyKgNeighborTarget = (rows) => normalizeOntologyRows(rows)
  .find((row) => KG_PATH_TARGET_TYPES.has(row.to_type)) || null

export const buildOntologyKgPathRequest = (node, {
  targetType,
  targetId,
  depth,
  direction
} = {}) => publicRequest(
  '/rpc/find_ontology_kg_paths',
  'post',
  {
    p_source_type: node?.node_type,
    p_source_id: node?.node_id,
    p_target_type: targetType,
    p_target_id: targetId,
    p_max_depth: Number(depth || 2),
    p_direction: direction,
    p_limit: 20
  }
)

export const buildOntologyPathExplanationRequest = ({
  subjectType,
  subjectId,
  objectType,
  objectId
} = {}) => publicRequest(
  '/rpc/explain_ontology_path',
  'post',
  {
    p_subject_type: subjectType,
    p_subject_id: subjectId,
    p_object_type: objectType || null,
    p_object_id: String(objectId || '').trim() || null,
    p_max_depth: 4
  }
)

export const ONTOLOGY_RELATIONS_REQUEST = {
  url: '/ontology_table_relations?select=id,relation_type,subject_table,subject_column,predicate,object_table,object_column,bridge_table,details,subject_semantic_name,object_semantic_name&order=relation_type.asc,id.asc',
  method: 'get',
  headers: APP_DATA_HEADERS
}
