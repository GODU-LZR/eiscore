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
  url: '/ontology_column_semantics?select=table_schema,table_name,column_name,semantic_class,semantic_name,data_type,ui_type,is_sensitive,source,tags,is_active&table_schema=eq.sales&table_name=eq.order%20lines&is_active=is.true&order=column_name.asc',
  method: 'get',
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

assert.equal(ONTOLOGY_REASONING_SUMMARY_REQUEST.method, 'get')
assert.match(ONTOLOGY_REASONING_SUMMARY_REQUEST.url, /^\/v_ontology_reasoning_summary\?select=/)
assert.equal(buildOntologyReasoningFactsRequest('').url.includes('&predicate='), false)
assert.equal(buildOntologyReasoningFactsRequest('acl:can access').url.includes('&predicate=eq.acl%3Acan%20access'), true)
assert.equal(ONTOLOGY_INSIGHT_REQUESTS.length, 5)
assert.deepEqual(normalizeOntologyInsightRows([[{ health_code: 'ok' }], null, [{ table_id: 'a' }]]), {
  health: { health_code: 'ok' },
  roles: [],
  tables: [{ table_id: 'a' }],
  rules: [],
  sensitive: []
})
assert.deepEqual(ONTOLOGY_REFRESH_REASONING_REQUEST.data, { p_max_depth: 4 })
assert.deepEqual(buildOntologyRoleAccessRequest('sales_manager').data, { p_role_code: 'sales_manager', p_limit: 50 })

assert.deepEqual(buildOntologyKgNodeSearchRequest({ query: ' manager ', nodeType: 'role' }).data, {
  p_query: 'manager',
  p_node_type: 'role',
  p_limit: 50
})
assert.deepEqual(buildOntologyKgNodeSearchRequest({}).data, { p_query: null, p_node_type: null, p_limit: 50 })
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
assert.deepEqual(buildOntologyPathExplanationRequest({
  subjectType: 'role', subjectId: 'manager', objectType: '', objectId: ' '
}).data, {
  p_subject_type: 'role',
  p_subject_id: 'manager',
  p_object_type: null,
  p_object_id: null,
  p_max_depth: 4
})
assert.equal(ONTOLOGY_RELATIONS_REQUEST.headers['Accept-Profile'], 'app_data')
assert.deepEqual(normalizeOntologyRows(null), [])
assert.deepEqual(normalizeOntologyFirstRow([{ id: 1 }, { id: 2 }]), { id: 1 })

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/ontology-workbench-query-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'from \'element-plus\'', 'axios', 'request(', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `ontology query policy gained runtime dependency: ${forbidden}`)
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
