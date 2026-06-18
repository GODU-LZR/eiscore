// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { authHeaders, createRuntimeV2AccessHarness, nodeIds, normalizeRows } from './runtime-v2-access-client.mjs'

function assertNoSerializedReference(value, forbidden, message) {
  assert.ok(!JSON.stringify(value).includes(forbidden), message)
}

const { client, adminToken, employeeToken, request } = createRuntimeV2AccessHarness()

const adminContext = await request(
  '/rpc/agent_ontology_context',
  adminToken,
  { p_query: 'users', p_limit: 40 }
)
assert.equal(adminContext.status, 200, 'admin should call agent_ontology_context')
assert.equal(adminContext.data?.accessPolicy?.superUser, true, 'admin context should be super-user scoped')
assert.ok(
  Array.isArray(adminContext.data?.tables) && adminContext.data.tables.some((row) => `${row.table_schema}.${row.table_name}` === 'public.users'),
  'admin context should include public.users when queried'
)

const employeeContext = await request(
  '/rpc/agent_ontology_context',
  employeeToken,
  { p_query: 'users', p_limit: 40 }
)
assert.equal(employeeContext.status, 200, 'employee should call agent_ontology_context')
assert.equal(employeeContext.data?.accessPolicy?.superUser, false, 'employee context should not be super-user scoped')
assert.ok(
  Array.isArray(employeeContext.data?.accessPolicy?.roles) && employeeContext.data.accessPolicy.roles.includes('employee'),
  'employee context should resolve employee role'
)
assert.ok(
  !normalizeRows(employeeContext.data?.tables).some((row) => `${row.table_schema}.${row.table_name}` === 'public.users'),
  'employee context must not include public.users'
)

const adminUserSearch = await request(
  '/rpc/agent_search_ontology_kg_nodes',
  adminToken,
  { p_query: 'public.users', p_node_type: 'table', p_limit: 20 }
)
assert.equal(adminUserSearch.status, 200, 'admin should call agent_search_ontology_kg_nodes')
assert.ok(nodeIds(adminUserSearch.data).has('public.users'), 'admin should see public.users KG node')

const employeeUserSearch = await request(
  '/rpc/agent_search_ontology_kg_nodes',
  employeeToken,
  { p_query: 'public.users', p_node_type: 'table', p_limit: 20 }
)
assert.equal(employeeUserSearch.status, 200, 'employee should call agent_search_ontology_kg_nodes')
assert.ok(!nodeIds(employeeUserSearch.data).has('public.users'), 'employee must not see public.users KG node')

const employeeHrSearch = await request(
  '/rpc/agent_search_ontology_kg_nodes',
  employeeToken,
  { p_query: 'hr.archives', p_node_type: 'table', p_limit: 20 }
)
assert.equal(employeeHrSearch.status, 200, 'employee role-scoped KG search should remain callable')
assert.ok(nodeIds(employeeHrSearch.data).has('hr.archives'), 'employee should still see an allowed HR table node')

const employeeHrNeighbors = await request(
  '/rpc/agent_query_ontology_kg_neighbors',
  employeeToken,
  {
    p_node_type: 'table',
    p_node_id: 'hr.archives',
    p_direction: 'both',
    p_max_depth: 1,
    p_limit: 50
  }
)
assert.equal(employeeHrNeighbors.status, 200, 'employee should call agent_query_ontology_kg_neighbors for allowed nodes')
assert.ok(normalizeRows(employeeHrNeighbors.data).length > 0, 'employee should get neighbors for allowed hr.archives')
assertNoSerializedReference(employeeHrNeighbors.data, 'public.users', 'allowed neighbor traversal must not leak public.users')

const employeeForbiddenNeighbors = await request(
  '/rpc/agent_query_ontology_kg_neighbors',
  employeeToken,
  {
    p_node_type: 'table',
    p_node_id: 'public.users',
    p_direction: 'both',
    p_max_depth: 1,
    p_limit: 50
  }
)
assert.equal(employeeForbiddenNeighbors.status, 200, 'forbidden safe neighbor traversal should return an empty scoped result')
assert.equal(normalizeRows(employeeForbiddenNeighbors.data).length, 0, 'employee must not traverse from public.users')

const employeeHrPaths = await request(
  '/rpc/agent_find_ontology_kg_paths',
  employeeToken,
  {
    p_source_type: 'role',
    p_source_id: 'employee',
    p_target_type: 'table',
    p_target_id: 'hr.archives',
    p_max_depth: 4,
    p_direction: 'outgoing',
    p_limit: 20
  }
)
assert.equal(employeeHrPaths.status, 200, 'employee should call agent_find_ontology_kg_paths for allowed paths')
assert.ok(normalizeRows(employeeHrPaths.data).length > 0, 'employee should get an allowed path to hr.archives')
assertNoSerializedReference(employeeHrPaths.data, 'public.users', 'allowed path results must not leak public.users')

const employeeForbiddenPaths = await request(
  '/rpc/agent_find_ontology_kg_paths',
  employeeToken,
  {
    p_source_type: 'role',
    p_source_id: 'employee',
    p_target_type: 'table',
    p_target_id: 'public.users',
    p_max_depth: 4,
    p_direction: 'outgoing',
    p_limit: 20
  }
)
assert.equal(employeeForbiddenPaths.status, 200, 'forbidden safe path search should return an empty scoped result')
assert.equal(normalizeRows(employeeForbiddenPaths.data).length, 0, 'employee must not get paths to public.users')

const employeeReasoningFacts = await request(
  '/rpc/agent_ontology_reasoning_facts',
  employeeToken,
  { p_predicate: 'acl:canAccessTable', p_limit: 100 }
)
assert.equal(employeeReasoningFacts.status, 200, 'employee should call scoped reasoning facts RPC')
assert.ok(normalizeRows(employeeReasoningFacts.data).length > 0, 'employee should get scoped reasoning facts')
assertNoSerializedReference(employeeReasoningFacts.data, 'public.users', 'scoped reasoning facts must not leak public.users')

const rawTable = await client.requestJson('/ontology_table_semantics?limit=1', {
  method: 'GET',
  headers: authHeaders(employeeToken)
})
assert.equal(rawTable.status, 403, 'raw ontology_table_semantics must be forbidden to web_user')

const rawKgView = await client.requestJson('/v_ontology_kg_nodes?limit=1', {
  method: 'GET',
  headers: authHeaders(employeeToken)
})
assert.equal(rawKgView.status, 403, 'raw v_ontology_kg_nodes view must be forbidden to web_user')

const oldSearch = await request(
  '/rpc/search_ontology_kg_nodes',
  employeeToken,
  { p_query: 'public.users', p_node_type: 'table', p_limit: 20 }
)
assert.equal(oldSearch.status, 403, 'old full-graph search_ontology_kg_nodes RPC must be forbidden to web_user')

const oldNeighbors = await request(
  '/rpc/query_ontology_kg_neighbors',
  employeeToken,
  {
    p_node_type: 'table',
    p_node_id: 'public.users',
    p_direction: 'both',
    p_max_depth: 1,
    p_limit: 20
  }
)
assert.equal(oldNeighbors.status, 403, 'old full-graph query_ontology_kg_neighbors RPC must be forbidden to web_user')

const oldPaths = await request(
  '/rpc/find_ontology_kg_paths',
  employeeToken,
  {
    p_source_type: 'role',
    p_source_id: 'employee',
    p_target_type: 'table',
    p_target_id: 'public.users',
    p_max_depth: 4,
    p_direction: 'outgoing',
    p_limit: 20
  }
)
assert.equal(oldPaths.status, 403, 'old full-graph find_ontology_kg_paths RPC must be forbidden to web_user')

console.log('PASS: Runtime V2 agent ontology access smoke')
