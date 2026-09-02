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
  return publicRequest('/rpc/agent_ontology_context', 'post', {
    p_query: `${parsed.schema}.${parsed.table}`,
    p_limit: 200
  })
}

export const normalizeOntologyColumnSemanticsRows = (response) => {
  const directRows = normalizeOntologyRows(response)
  const scopedRows = directRows.length || !response?.columns || typeof response.columns !== 'object'
    ? directRows
    : Object.entries(response.columns).flatMap(([tableKey, columns]) => {
        const parsed = parseOntologyTableKey(tableKey)
        if (!parsed || !Array.isArray(columns)) return []
        return columns.map((item) => ({
          table_schema: parsed.schema,
          table_name: parsed.table,
          column_name: item.col,
          semantic_class: item.cls,
          semantic_name: item.name,
          data_type: item.type,
          ui_type: item.ui,
          is_sensitive: item.sensitive === true,
          source: 'agent_ontology_context',
          tags: [],
          is_active: true
        }))
      })

  return scopedRows.map((item) => ({
    ...item,
    table_key: `${item.table_schema}.${item.table_name}`,
    semantics_mode: extractOntologySemanticsMode(item.tags)
  }))
}

export const ONTOLOGY_REASONING_SUMMARY_REQUEST = publicRequest(
  '/rpc/agent_ontology_reasoning_summary',
  'post',
  {}
)

export const buildOntologyReasoningFactsRequest = (predicate) => publicRequest(
  '/rpc/agent_ontology_reasoning_facts',
  'post',
  { p_predicate: predicate || null, p_limit: 200 }
)

export const ONTOLOGY_INSIGHT_REQUESTS = [
  publicRequest('/rpc/agent_ontology_reasoning_health', 'post', {}),
  publicRequest('/rpc/agent_ontology_role_access_insights', 'post', { p_limit: 50 }),
  publicRequest('/rpc/agent_ontology_table_impact_insights', 'post', { p_limit: 50 }),
  publicRequest('/rpc/agent_ontology_reasoning_rule_stats', 'post', { p_limit: 50 }),
  publicRequest('/rpc/agent_ontology_sensitive_access_paths', 'post', { p_limit: 50 })
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
  '/rpc/agent_explain_role_ontology_access',
  'post',
  { p_role_code: roleCode, p_limit: 50 }
)

export const buildOntologyKgNodeSearchRequest = ({ query, nodeType } = {}) => publicRequest(
  '/rpc/agent_search_ontology_kg_nodes',
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
  '/rpc/agent_query_ontology_kg_neighbors',
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
  '/rpc/agent_find_ontology_kg_paths',
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
  '/rpc/agent_explain_ontology_path',
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
