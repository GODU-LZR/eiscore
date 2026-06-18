// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { authHeaders, createRuntimeV2AccessHarness, nodeIds, normalizeRows, postgrestBaseUrl } from './runtime-v2-access-client.mjs'

function sortedCounts(rows, field) {
  const counts = new Map()
  for (const row of normalizeRows(rows)) {
    const key = String(row?.[field] || 'unknown')
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function tableIds(context) {
  return normalizeRows(context?.tables)
    .map((row) => `${row.table_schema}.${row.table_name}`)
    .filter(Boolean)
    .sort()
}

function sample(values, limit = 12) {
  return [...values].slice(0, limit)
}

function includesSerialized(value, needle) {
  return JSON.stringify(value).includes(needle)
}

const { client, adminToken, employeeToken, request } = createRuntimeV2AccessHarness()

const adminContext = await request('/rpc/agent_ontology_context', adminToken, { p_query: 'users', p_limit: 40 })
const employeeContext = await request('/rpc/agent_ontology_context', employeeToken, { p_query: '', p_limit: 80 })
const employeeUsersContext = await request('/rpc/agent_ontology_context', employeeToken, { p_query: 'users', p_limit: 40 })
const adminUserSearch = await request('/rpc/agent_search_ontology_kg_nodes', adminToken, { p_query: 'public.users', p_node_type: 'table', p_limit: 20 })
const employeeUserSearch = await request('/rpc/agent_search_ontology_kg_nodes', employeeToken, { p_query: 'public.users', p_node_type: 'table', p_limit: 20 })
const employeeHrSearch = await request('/rpc/agent_search_ontology_kg_nodes', employeeToken, { p_query: 'hr.archives', p_node_type: 'table', p_limit: 20 })
const employeeHrNeighbors = await request('/rpc/agent_query_ontology_kg_neighbors', employeeToken, {
  p_node_type: 'table',
  p_node_id: 'hr.archives',
  p_direction: 'both',
  p_max_depth: 1,
  p_limit: 50
})
const employeeForbiddenNeighbors = await request('/rpc/agent_query_ontology_kg_neighbors', employeeToken, {
  p_node_type: 'table',
  p_node_id: 'public.users',
  p_direction: 'both',
  p_max_depth: 1,
  p_limit: 50
})
const employeeHrPaths = await request('/rpc/agent_find_ontology_kg_paths', employeeToken, {
  p_source_type: 'role',
  p_source_id: 'employee',
  p_target_type: 'table',
  p_target_id: 'hr.archives',
  p_max_depth: 4,
  p_direction: 'outgoing',
  p_limit: 20
})
const employeeForbiddenPaths = await request('/rpc/agent_find_ontology_kg_paths', employeeToken, {
  p_source_type: 'role',
  p_source_id: 'employee',
  p_target_type: 'table',
  p_target_id: 'public.users',
  p_max_depth: 4,
  p_direction: 'outgoing',
  p_limit: 20
})
const employeeFacts = await request('/rpc/agent_ontology_reasoning_facts', employeeToken, {
  p_predicate: 'acl:canAccessTable',
  p_limit: 100
})
const employeeHealth = await request('/rpc/agent_ontology_reasoning_health', employeeToken, {})

const rawTable = await client.requestJson('/ontology_table_semantics?limit=1', {
  method: 'GET',
  headers: authHeaders(employeeToken)
})
const rawKgView = await client.requestJson('/v_ontology_kg_nodes?limit=1', {
  method: 'GET',
  headers: authHeaders(employeeToken)
})
const oldSearch = await request('/rpc/search_ontology_kg_nodes', employeeToken, {
  p_query: 'public.users',
  p_node_type: 'table',
  p_limit: 20
})
const oldNeighbors = await request('/rpc/query_ontology_kg_neighbors', employeeToken, {
  p_node_type: 'table',
  p_node_id: 'public.users',
  p_direction: 'both',
  p_max_depth: 1,
  p_limit: 20
})
const oldPaths = await request('/rpc/find_ontology_kg_paths', employeeToken, {
  p_source_type: 'role',
  p_source_id: 'employee',
  p_target_type: 'table',
  p_target_id: 'public.users',
  p_max_depth: 4,
  p_direction: 'outgoing',
  p_limit: 20
})

for (const [name, response] of Object.entries({
  adminContext,
  employeeContext,
  employeeUsersContext,
  adminUserSearch,
  employeeUserSearch,
  employeeHrSearch,
  employeeHrNeighbors,
  employeeForbiddenNeighbors,
  employeeHrPaths,
  employeeForbiddenPaths,
  employeeFacts,
  employeeHealth
})) {
  assert.equal(response.status, 200, `${name} should be callable`)
}

for (const [name, response] of Object.entries({ rawTable, rawKgView, oldSearch, oldNeighbors, oldPaths })) {
  assert.equal(response.status, 403, `${name} should be forbidden`)
}

const adminTables = tableIds(adminContext.data)
const employeeTables = tableIds(employeeContext.data)
const employeeUsersTables = tableIds(employeeUsersContext.data)
const employeeKgNodeTypes = sortedCounts(employeeContext.data?.kgNodes || [], 'node_type')
const employeeFactRows = normalizeRows(employeeFacts.data)
const employeeHealthRows = normalizeRows(employeeHealth.data)

const summary = {
  generatedAt: new Date().toISOString(),
  postgrestBaseUrl,
  admin: {
    superUser: Boolean(adminContext.data?.accessPolicy?.superUser),
    queriedUsersTableVisible: adminTables.includes('public.users'),
    queriedTableSample: sample(adminTables)
  },
  employee: {
    superUser: Boolean(employeeContext.data?.accessPolicy?.superUser),
    roles: employeeContext.data?.accessPolicy?.roles || [],
    tableCount: employeeTables.length,
    tableSample: sample(employeeTables),
    usersQueryTableCount: employeeUsersTables.length,
    publicUsersVisibleInContext: employeeUsersTables.includes('public.users'),
    publicUsersVisibleInSearch: nodeIds(employeeUserSearch.data).has('public.users'),
    hrArchivesVisibleInSearch: nodeIds(employeeHrSearch.data).has('hr.archives'),
    kgNodeTypes: employeeKgNodeTypes,
    relationCount: normalizeRows(employeeContext.data?.relations).length,
    appCount: normalizeRows(employeeContext.data?.apps).length,
    permissionCount: normalizeRows(employeeContext.data?.permissions).length,
    allowedNeighborCount: normalizeRows(employeeHrNeighbors.data).length,
    forbiddenNeighborCount: normalizeRows(employeeForbiddenNeighbors.data).length,
    allowedPathCount: normalizeRows(employeeHrPaths.data).length,
    forbiddenPathCount: normalizeRows(employeeForbiddenPaths.data).length,
    scopedFactCount: employeeFactRows.length,
    scopedFactTargetTypes: sortedCounts(employeeFactRows, 'object_type'),
    scopedHealth: employeeHealthRows[0] || null,
    leaksPublicUsers: includesSerialized(employeeContext.data, 'public.users') ||
      includesSerialized(employeeUserSearch.data, 'public.users') ||
      includesSerialized(employeeHrNeighbors.data, 'public.users') ||
      includesSerialized(employeeHrPaths.data, 'public.users') ||
      includesSerialized(employeeFacts.data, 'public.users')
  },
  blocked: {
    rawOntologyTableSemantics: rawTable.status,
    rawKgNodesView: rawKgView.status,
    oldSearchRpc: oldSearch.status,
    oldNeighborsRpc: oldNeighbors.status,
    oldPathsRpc: oldPaths.status
  }
}

assert.equal(summary.admin.queriedUsersTableVisible, true, 'audit expects admin to see public.users')
assert.equal(summary.employee.publicUsersVisibleInContext, false, 'audit expects employee context to hide public.users')
assert.equal(summary.employee.publicUsersVisibleInSearch, false, 'audit expects employee search to hide public.users')
assert.equal(summary.employee.hrArchivesVisibleInSearch, true, 'audit expects employee to see hr.archives')
assert.equal(summary.employee.forbiddenNeighborCount, 0, 'audit expects employee forbidden neighbor traversal to be empty')
assert.equal(summary.employee.forbiddenPathCount, 0, 'audit expects employee forbidden path search to be empty')
assert.equal(summary.employee.leaksPublicUsers, false, 'audit expects scoped employee surfaces not to leak public.users')

console.log(JSON.stringify(summary, null, 2))
console.log('PASS: Runtime V2 access audit snapshot')
