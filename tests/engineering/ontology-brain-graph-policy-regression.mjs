// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ONTOLOGY_BRAIN_DOMAINS,
  buildOntologyBrainKgGraph,
  buildOntologyBrainRelationGraph,
  filterOntologyBrainGraph,
  getOntologyBrainDomain,
  getOntologyBrainRelationKey
} from '../../eiscore-apps/src/domain/ontology-brain-graph-policy.js'

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

const relations = freeze([
  {
    id: 1, relation_type: 'ontology', subject_table: 'public.sales_orders', subject_column: 'customer_id',
    subject_semantic_name: '销售订单', object_table: 'public.sales_customers', object_column: 'id',
    object_semantic_name: '销售客户', predicate: 'ontology:dependsOn', evidence: { source: 'authorized' }
  },
  {
    id: 2, relation_type: 'foreign_key', subject_table: 'public.sales_orders', subject_column: 'customer_id',
    object_table: 'public.sales_customers', object_column: 'id', predicate: 'fk'
  },
  {
    id: 3, relation_type: 'ontology', subject_table: 'hr.archives', subject_semantic_name: '人事花名册',
    object_table: 'public.departments', object_semantic_name: '部门', predicate: 'ontology:belongsTo'
  },
  {
    id: 4, relation_type: 'ontology', subject_table: 'scm.inventory', subject_semantic_domain: 'mms',
    subject_semantic_name: '库存', object_table: 'public.materials', object_semantic_name: '物料', predicate: 'ontology:dependsOn'
  },
  { id: 5, subject_table: 'app_center.apps', object_table: 'public.roles', predicate: 'acl:requiresPermission' },
  { id: 6, subject_table: 'unknown.some_table', object_table: 'public.sales_customers', predicate: 'custom:a' },
  { id: 7, subject_table: '', object_table: 'hidden.bad', predicate: 'custom:missing' },
  { id: 8, subject_table: 'public.sales_orders', predicate: 'custom:missing' }
])
const labels = freeze({ 'public.sales_orders': 'sales orders', 'public.roles': '角色' })
const original = JSON.stringify({ relations, labels })
const graph = buildOntologyBrainRelationGraph({ relations, tableLabelMap: labels })
assert.deepEqual(graph.stats, { nodes: 9, edges: 6 })
assert.deepEqual(graph.domains.map(({ label }) => label), ['销售', '人事', '仓储', '应用中心', '公共基础'])
assert.equal(graph.nodes.find(({ id }) => id === 'table:public.sales_orders').label, '销售订单')
assert.equal(graph.nodes.find(({ id }) => id === 'table:public.roles').label, '角色')
assert.equal(graph.nodes.find(({ id }) => id === 'table:unknown.some_table').label, 'unknown.some_table')
assert.equal(graph.nodes.some(({ id }) => id === 'table:hidden.bad'), false)
assert.equal(graph.nodes.every(({ tableKey }) => relations.some((row) => row.subject_table === tableKey || row.object_table === tableKey)), true)
assert.equal(graph.edges.find(({ raw }) => raw.id === 1).raw, relations[0])
assert.equal(graph.nodes.find(({ id }) => id === 'table:public.sales_orders').tableKey, 'public.sales_orders')
assert.equal(JSON.stringify({ relations, labels }), original)

const reordered = buildOntologyBrainRelationGraph({
  relations: [...relations].reverse().map((row, index) => ({ ...row, id: 100 + index })), tableLabelMap: labels
})
assert.deepEqual(reordered.nodes.map(({ id }) => id), graph.nodes.map(({ id }) => id))
assert.deepEqual(reordered.edges.map(({ id }) => id), graph.edges.map(({ id }) => id))
assert.notEqual(getOntologyBrainRelationKey(relations[0]), getOntologyBrainRelationKey(relations[1]))
assert.notEqual(getOntologyBrainRelationKey(relations[0]), getOntologyBrainRelationKey({ ...relations[0], predicate: 'other' }))
assert.notEqual(getOntologyBrainRelationKey(relations[0]), getOntologyBrainRelationKey({ ...relations[0], subject_column: 'other' }))
const focused = buildOntologyBrainRelationGraph({ relations, selectedTable: 'public.sales_orders' })
assert.deepEqual(focused.stats, { nodes: 2, edges: 2 })
assert.equal(focused.nodes.every(({ tableKey }) => ['public.sales_orders', 'public.sales_customers'].includes(tableKey)), true)
assert.equal(buildOntologyBrainRelationGraph({ relations, selectedTable: 'not.returned' }).nodes.length, 0)
const sales = buildOntologyBrainRelationGraph({ relations, domainFilter: 'sales' })
assert.deepEqual(sales.stats, { nodes: 2, edges: 2 })
assert.equal(sales.nodes.every(({ domain }) => domain === 'sales'), true)
assert.equal(sales.edges.every(({ id }) => graph.edges.some((edge) => edge.id === id)), true)
assert.equal(filterOntologyBrainGraph(graph, 'unknown').nodes.length, 0)
assert.deepEqual(filterOntologyBrainGraph({ nodes: graph.nodes, edges: [{ id: 'invalid', source: graph.nodes[0].id, target: 'not.returned' }] }).stats, { nodes: 9, edges: 0 })
assert.deepEqual(buildOntologyBrainRelationGraph().stats, { nodes: 0, edges: 0 })
assert.deepEqual(buildOntologyBrainRelationGraph({ relations: null }).stats, { nodes: 0, edges: 0 })
assert.equal(buildOntologyBrainRelationGraph({ relations: [{ subject_table: 'one', object_table: 'two', subject_semantic_name: '???' }] }).nodes[0].label, 'one')
assert.equal(buildOntologyBrainRelationGraph({ relations: [relations[0], relations[0]] }).edges.length, 1)
assert.deepEqual(ONTOLOGY_BRAIN_DOMAINS.map(({ key }) => key), ['sales', 'hr', 'materials', 'apps', 'shared'])
for (const [nodeId, semanticDomain, expected] of [
  ['public.sales_customers', '', 'sales'], ['sales.orders', '', 'sales'], ['scm.v_sales_bom_mrp', '', 'sales'],
  ['hr.archives', '', 'hr'], ['public.departments', '', 'hr'], ['module:hr', '', 'hr'],
  ['scm.inventory_batches', '', 'materials'], ['scm.v_bom_lines', '', 'materials'], ['any.id', 'mms', 'materials'],
  ['app_center.apps', '', 'apps'], ['app_data.data_app_123', '', 'apps'],
  ['unknown.id', 'unknown', 'shared'], ['scm.production_work_orders', 'production', 'shared'],
  ['public.users', 'acl', 'shared'], ['app:sales_dashboard', '', 'sales'], ['notsales.unknown', '', 'shared'],
  ['unknown.id', '__proto__', 'shared'], ['unknown.id', 'constructor', 'shared']
]) assert.equal(getOntologyBrainDomain({ nodeId, semanticDomain }), expected, nodeId)
assert.equal(getOntologyBrainDomain({ nodeType: 'semantic_domain', nodeId: 'sales' }), 'sales')
assert.equal(getOntologyBrainDomain({ nodeType: 'semantic_domain', nodeId: '__proto__' }), 'shared')

const selectedNode = freeze({ node_type: 'role', node_id: 'manager', node_label: '经理', is_sensitive: true, total_degree: 2 })
const neighbors = freeze([
  {
    edge_id: 10, from_type: 'table', from_id: 'public.sales_orders', from_label: '销售订单',
    to_type: 'role', to_id: 'manager', to_label: '经理', edge_subject_type: 'role', edge_subject_id: 'manager',
    edge_object_type: 'table', edge_object_id: 'public.sales_orders', from_semantic_domain: 'sales', to_semantic_domain: 'acl', predicate: 'acl:canAccessTable',
    direction: 'incoming', is_inferred: false, evidence: { permission: 'sales:view', sensitive: true }
  },
  {
    edge_id: 11, from_type: 'table', from_id: 'public.sales_orders', from_label: '销售订单',
    to_type: 'column', to_id: 'public.sales_orders.amount', to_label: '金额',
    predicate: 'data:hasSensitiveColumn', is_inferred: true, evidence: { column: 'amount' }
  },
  { from_type: 'role', from_id: 'manager', to_type: 'app', to_id: 'custom-app', predicate: 'custom:a' },
  { from_type: 'role', from_id: 'manager', to_type: 'app', to_id: 'custom-app', predicate: 'custom:b' },
  { from_type: 'role', from_id: 'manager', to_type: 'table', to_id: '', predicate: 'invalid' }
])
const pathRows = freeze([
  {
    target_type: 'table', target_id: 'hr.archives', target_label: '人事花名册', path_facts: [{
      id: 12, subject_type: 'role', subject_id: 'manager', object_type: 'table', object_id: 'hr.archives',
      predicate: 'acl:canAccessTable', inferred: true, rule: 'real_rule', evidence: { permission: 'hr:view' }
    }]
  },
  { target_type: 'app', target_id: 'app-with-no-proof', target_label: '无路径应用', path_nodes: ['role:manager', 'app:app-with-no-proof'] }
])
const kgOriginal = JSON.stringify({ selectedNode, neighbors, pathRows })
const kg = buildOntologyBrainKgGraph({ selectedNode, neighbors, pathRows })
assert.deepEqual(kg.stats, { nodes: 6, edges: 5 })
assert.deepEqual(kg.nodes.map(({ type }) => type).sort(), ['app', 'app', 'column', 'role', 'table', 'table'])
assert.equal(kg.nodes.find(({ id }) => id === 'role:manager').raw, selectedNode)
assert.equal(kg.nodes.find(({ id }) => id === 'role:manager').raw.is_sensitive, true)
assert.equal(kg.nodes.find(({ id }) => id === 'role:manager').domain, 'shared')
const directed = kg.edges.find(({ id }) => id === 'edge:10')
assert.equal(directed.source, 'role:manager')
assert.equal(directed.target, 'table:public.sales_orders')
assert.equal(directed.raw, neighbors[0])
assert.equal(directed.raw.direction, 'incoming')
assert.equal(directed.raw.is_inferred, false)
assert.deepEqual(directed.raw.evidence, { permission: 'sales:view', sensitive: true })
assert.equal(kg.edges.find(({ id }) => id === 'edge:12').raw, pathRows[0].path_facts[0])
assert.equal(kg.edges.some(({ target }) => target === 'app:app-with-no-proof'), false)
assert.equal(kg.nodes.find(({ id }) => id === 'table:hr.archives').label, '人事花名册')
assert.equal(kg.nodes.find(({ id }) => id === 'column:public.sales_orders.amount').label, '金额')
assert.equal(JSON.stringify({ selectedNode, neighbors, pathRows }), kgOriginal)
const reversedKg = buildOntologyBrainKgGraph({ selectedNode, neighbors: [...neighbors].reverse(), pathRows: [...pathRows].reverse() })
assert.deepEqual(reversedKg.nodes.map(({ id }) => id), kg.nodes.map(({ id }) => id))
assert.deepEqual(reversedKg.edges.map(({ id }) => id), kg.edges.map(({ id }) => id))
const kgSales = buildOntologyBrainKgGraph({ selectedNode, neighbors, pathRows, domainFilter: 'sales' })
assert.deepEqual(kgSales.stats, { nodes: 2, edges: 1 })
assert.equal(kgSales.edges[0].id, 'edge:11')
assert.deepEqual(buildOntologyBrainKgGraph().stats, { nodes: 0, edges: 0 })
assert.deepEqual(buildOntologyBrainKgGraph({ neighbors: null, pathRows: null }).stats, { nodes: 0, edges: 0 })
assert.equal(buildOntologyBrainKgGraph({ neighbors: [null], pathRows: [null] }).edges.length, 0)

const source = readFileSync(new URL('../../eiscore-apps/src/domain/ontology-brain-graph-policy.js', import.meta.url), 'utf8')
for (const forbidden of ['from \'vue\'', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'Math.random', 'Date.now', 'huizong', 'eiscore.top']) {
  assert.equal(source.includes(forbidden), false, `pure adapter gained forbidden dependency: ${forbidden}`)
}
console.log('PASS: brain graph adapter preserves authorized relations, stable IDs, real KG direction/evidence, domains and input immutability')
