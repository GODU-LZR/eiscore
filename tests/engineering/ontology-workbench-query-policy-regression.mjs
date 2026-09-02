// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ONTOLOGY_INSIGHT_REQUESTS,
  ONTOLOGY_REASONING_SUMMARY_REQUEST,
  ONTOLOGY_REFRESH_REASONING_REQUEST,
  ONTOLOGY_RELATIONS_REQUEST,
  buildOntologyColumnSemanticsRequest,
  buildOntologyKgNeighborRequest,
  buildOntologyKgNodeSearchRequest,
  buildOntologyKgPathRequest,
  buildOntologyPathExplanationRequest,
  buildOntologyReasoningFactsRequest,
  buildOntologyRoleAccessRequest,
  normalizeOntologyColumnSemanticsRows,
  normalizeOntologyFirstRow,
  normalizeOntologyInsightRows,
  normalizeOntologyRows,
  pickOntologyKgNeighborTarget,
  pickOntologyKgSelectedNode
} from '../../eiscore-apps/src/domain/ontology-workbench-query-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const publicHeaders = { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
assert.equal(buildOntologyColumnSemanticsRequest(''), null)
assert.deepEqual(buildOntologyColumnSemanticsRequest('sales.order lines'), {
  url: '/rpc/agent_ontology_context',
  method: 'post',
  data: { p_query: 'sales.order lines', p_limit: 200 },
  headers: publicHeaders
})
assert.deepEqual(normalizeOntologyColumnSemanticsRows([{
  table_schema: 'sales',
  table_name: 'orders',
  tags: ['semantics:ai_defined']
}]), [{
  table_schema: 'sales',
  table_name: 'orders',
  tags: ['semantics:ai_defined'],
  table_key: 'sales.orders',
  semantics_mode: 'ai_defined'
}])
assert.deepEqual(normalizeOntologyColumnSemanticsRows({
  columns: {
    'sales.orders': [{ col: 'id', cls: 'identifier', name: '订单标识', type: 'uuid', ui: 'text', sensitive: false }]
  }
}), [{
  table_schema: 'sales',
  table_name: 'orders',
  column_name: 'id',
  semantic_class: 'identifier',
  semantic_name: '订单标识',
  data_type: 'uuid',
  ui_type: 'text',
  is_sensitive: false,
  source: 'agent_ontology_context',
  tags: [],
  is_active: true,
  table_key: 'sales.orders',
  semantics_mode: ''
}])

assert.equal(ONTOLOGY_REASONING_SUMMARY_REQUEST.method, 'post')
assert.equal(ONTOLOGY_REASONING_SUMMARY_REQUEST.url, '/rpc/agent_ontology_reasoning_summary')
assert.deepEqual(buildOntologyReasoningFactsRequest('').data, { p_predicate: null, p_limit: 200 })
assert.deepEqual(buildOntologyReasoningFactsRequest('acl:can access').data, { p_predicate: 'acl:can access', p_limit: 200 })
assert.equal(ONTOLOGY_INSIGHT_REQUESTS.length, 5)
assert.deepEqual(ONTOLOGY_INSIGHT_REQUESTS.map((item) => item.url), [
  '/rpc/agent_ontology_reasoning_health',
  '/rpc/agent_ontology_role_access_insights',
  '/rpc/agent_ontology_table_impact_insights',
  '/rpc/agent_ontology_reasoning_rule_stats',
  '/rpc/agent_ontology_sensitive_access_paths'
])
assert.deepEqual(normalizeOntologyInsightRows([[{ health_code: 'ok' }], null, [{ table_id: 'a' }]]), {
  health: { health_code: 'ok' },
  roles: [],
  tables: [{ table_id: 'a' }],
  rules: [],
  sensitive: []
})
assert.deepEqual(ONTOLOGY_REFRESH_REASONING_REQUEST.data, { p_max_depth: 4 })
assert.deepEqual(buildOntologyRoleAccessRequest('sales_manager').data, { p_role_code: 'sales_manager', p_limit: 50 })
assert.equal(buildOntologyRoleAccessRequest('sales_manager').url, '/rpc/agent_explain_role_ontology_access')

assert.deepEqual(buildOntologyKgNodeSearchRequest({ query: ' manager ', nodeType: 'role' }).data, {
  p_query: 'manager',
  p_node_type: 'role',
  p_limit: 50
})
assert.deepEqual(buildOntologyKgNodeSearchRequest({}).data, { p_query: null, p_node_type: null, p_limit: 50 })
assert.equal(buildOntologyKgNodeSearchRequest({}).url, '/rpc/agent_search_ontology_kg_nodes')
const nodes = [{ node_type: 'role', node_id: 'a' }, { node_type: 'role', node_id: 'b' }]
assert.equal(pickOntologyKgSelectedNode(nodes, { node_type: 'role', node_id: 'b' }), nodes[1])
assert.equal(pickOntologyKgSelectedNode(nodes, { node_type: 'role', node_id: 'missing' }), nodes[0])
assert.equal(pickOntologyKgSelectedNode([], null), null)

const selectedNode = { node_type: 'role', node_id: 'manager' }
assert.deepEqual(buildOntologyKgNeighborRequest(selectedNode, {
  direction: 'outgoing', depth: 0, predicate: ''
}).data, {
  p_node_type: 'role',
  p_node_id: 'manager',
  p_direction: 'outgoing',
  p_max_depth: 1,
  p_limit: 80,
  p_predicate: null
})
assert.equal(buildOntologyKgNeighborRequest(selectedNode).url, '/rpc/agent_query_ontology_kg_neighbors')
assert.deepEqual(pickOntologyKgNeighborTarget([
  { to_type: 'semantic_domain', to_id: 'x' },
  { to_type: 'table', to_id: 'sales.orders' }
]), { to_type: 'table', to_id: 'sales.orders' })
assert.equal(pickOntologyKgNeighborTarget([{ to_type: 'other' }]), null)
assert.deepEqual(buildOntologyKgPathRequest(selectedNode, {
  targetType: 'table', targetId: 'sales.orders', depth: '', direction: 'both'
}).data, {
  p_source_type: 'role',
  p_source_id: 'manager',
  p_target_type: 'table',
  p_target_id: 'sales.orders',
  p_max_depth: 2,
  p_direction: 'both',
  p_limit: 20
})
assert.equal(buildOntologyKgPathRequest(selectedNode).url, '/rpc/agent_find_ontology_kg_paths')
assert.deepEqual(buildOntologyPathExplanationRequest({
  subjectType: 'role', subjectId: 'manager', objectType: '', objectId: ' '
}).data, {
  p_subject_type: 'role',
  p_subject_id: 'manager',
  p_object_type: null,
  p_object_id: null,
  p_max_depth: 4
})
assert.equal(buildOntologyPathExplanationRequest({}).url, '/rpc/agent_explain_ontology_path')
assert.equal(ONTOLOGY_RELATIONS_REQUEST.headers['Accept-Profile'], 'app_data')
assert.deepEqual(normalizeOntologyRows(null), [])
assert.deepEqual(normalizeOntologyFirstRow([{ id: 1 }, { id: 2 }]), { id: 1 })

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/ontology-workbench-query-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'from \'element-plus\'', 'axios', 'request(', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `ontology query policy gained runtime dependency: ${forbidden}`)
}
for (const forbiddenEndpoint of [
  "'/v_ontology_reasoning_",
  "'/v_ontology_role_access_insights",
  "'/v_ontology_sensitive_access_paths",
  "'/rpc/search_ontology_kg_nodes'",
  "'/rpc/query_ontology_kg_neighbors'",
  "'/rpc/find_ontology_kg_paths'",
  "'/rpc/explain_ontology_path'",
  "'/rpc/explain_role_ontology_access'",
  "'/ontology_column_semantics?"
]) {
  assert.equal(moduleSource.includes(forbiddenEndpoint), false, `ontology query policy reintroduced unscoped endpoint: ${forbiddenEndpoint}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/OntologyWorkbench.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ontology-workbench-query-policy['"]/)
for (const removedLiteral of [
  "url: '/v_ontology_reasoning_summary?",
  "url: '/rpc/search_ontology_kg_nodes'",
  "url: '/rpc/query_ontology_kg_neighbors'",
  "url: '/rpc/find_ontology_kg_paths'",
  "url: '/rpc/explain_ontology_path'",
  "url: '/ontology_table_relations?"
]) {
  assert.equal(pageSource.includes(removedLiteral), false, `OntologyWorkbench reintroduced ${removedLiteral}`)
}
for (const requiredUse of [
  'buildOntologyColumnSemanticsRequest(',
  'buildOntologyReasoningFactsRequest(',
  'ONTOLOGY_INSIGHT_REQUESTS.map(',
  'buildOntologyKgNodeSearchRequest({',
  'buildOntologyKgNeighborRequest(',
  'buildOntologyKgPathRequest(',
  'buildOntologyPathExplanationRequest({',
  'ONTOLOGY_RELATIONS_REQUEST'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `OntologyWorkbench lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2184)

console.log('PASS: OntologyWorkbench query policy preserves profiles, URLs, RPC payloads, response normalization and selection fallbacks')
