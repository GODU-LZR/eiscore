// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ONTOLOGY_KG_GRAPH_CATEGORIES,
  ONTOLOGY_KG_GRAPH_NODE_COLORS,
  addOntologyKgGraphNode,
  buildOntologyKgEvidenceRows,
  buildOntologyKgGraphPayload,
  buildOntologyKgSelectedMetrics,
  buildOntologyWorkbenchViews,
  formatOntologyKgEvidenceValue,
  formatOntologyKgTooltip,
  getOntologyActiveWorkbenchMeta,
  getOntologyKgEdgeKey,
  getOntologyKgGraphCategory,
  getOntologyKgGraphNodeSize,
  getOntologyKgNodeKey,
  getOntologyKgNodeTypeLabel,
  getOntologyPredicateLabel
} from '../../eiscore-apps/src/domain/ontology-workbench-kg-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
assert.equal(getOntologyPredicateLabel('acl:canAccessTable'), '可访问业务表')
assert.equal(getOntologyPredicateLabel('custom:edge'), 'custom:edge')
assert.equal(getOntologyKgNodeTypeLabel('app_action'), '应用动作')
assert.equal(getOntologyKgNodeTypeLabel('unknown'), 'unknown')
assert.equal(getOntologyKgNodeKey('role', 'manager'), 'role:manager')
assert.equal(getOntologyKgGraphCategory('app_action'), '应用')
assert.equal(getOntologyKgGraphCategory('semantic_domain'), '其他')
assert.deepEqual(ONTOLOGY_KG_GRAPH_CATEGORIES.map((item) => item.name), ['角色', '应用', '业务表', '字段', '权限', '其他'])
assert.equal(ONTOLOGY_KG_GRAPH_NODE_COLORS.column, '#d66b9d')
assert.equal(getOntologyKgGraphNodeSize({ node_type: 'role' }), 44)
assert.equal(getOntologyKgGraphNodeSize({ node_type: 'column', is_sensitive: true }), 34)

const nodeMap = new Map()
const first = addOntologyKgGraphNode(nodeMap, 'table', 'sales.orders', '销售订单')
const merged = addOntologyKgGraphNode(nodeMap, 'table', 'sales.orders', '', { symbolSize: 50, is_sensitive: true })
assert.equal(first.id, 'table:sales.orders')
assert.equal(merged.name, '销售订单')
assert.equal(merged.symbolSize, 50)
assert.equal(merged.itemStyle.color, '#3f8cff')
assert.equal(merged.label.formatter({ data: { name: '1234567890123456789' } }), '12345678901234567...')
assert.equal(getOntologyKgEdgeKey({ edge_id: 0 }), 'edge:0')
assert.equal(getOntologyKgEdgeKey({ source: 'a', predicate: 'p', target: 'b' }), 'a|p|b')

const payload = buildOntologyKgGraphPayload({
  selectedNode: { node_type: 'role', node_id: 'manager', node_label: '经理', total_degree: 5 },
  neighbors: [
    {
      edge_id: 10,
      edge_subject_type: 'role',
      edge_subject_id: 'manager',
      from_type: 'role',
      from_label: '经理',
      edge_object_type: 'app',
      edge_object_id: 'sales',
      to_type: 'app',
      to_label: '销售',
      predicate: 'acl:canAccessApp',
      is_inferred: false,
      evidence: { permission: 'sales:view' }
    },
    {
      edge_id: 10,
      from_type: 'role',
      from_id: 'manager',
      to_type: 'app',
      to_id: 'sales',
      predicate: 'acl:canAccessApp'
    },
    { from_type: '', from_id: '', to_type: 'table', to_id: 'sales.orders' }
  ],
  pathRows: [{
    target_type: 'table',
    target_id: 'sales.orders',
    target_label: '销售订单',
    path_facts: [{
      id: 11,
      subject_type: 'app',
      subject_id: 'sales',
      object_type: 'table',
      object_id: 'sales.orders',
      predicate: 'app:usesTable',
      inferred: true
    }]
  }]
})
assert.deepEqual(payload.stats, { nodes: 3, links: 2 })
assert.equal(payload.nodes.find((item) => item.id === 'role:manager').symbolSize, 50)
assert.equal(payload.links.find((item) => item.edge_id === 10).lineStyle.type, 'solid')
assert.equal(payload.links.find((item) => item.edge_id === 11).label.formatter, '应用使用业务表')

assert.deepEqual(buildOntologyKgSelectedMetrics({ total_degree: 4, outgoing_edges: 2 }).map((item) => item.value), [4, 2, 0, 0])
const views = buildOntologyWorkbenchViews({
  graphRelationsCount: 12,
  selectedTable: 'sales.orders',
  reasoningSummary: { facts_total: 8, last_run_status: 'completed' },
  graphStats: { nodes: 3, links: 2 },
  selectedEdge: { id: 1 },
  reasoningHealth: { health_code: 'stale', is_healthy: false }
})
assert.deepEqual(views.map((item) => [item.key, item.metric, item.attention]), [
  ['relations', '12 条', 'focus'],
  ['reasoning', '8 facts', 'normal'],
  ['kg', '3/2', 'focus'],
  ['insight', 'stale', 'critical']
])
assert.equal(getOntologyActiveWorkbenchMeta(views, 'kg').key, 'kg')
assert.equal(getOntologyActiveWorkbenchMeta(views, 'missing').key, 'relations')

assert.equal(formatOntologyKgEvidenceValue(null), '-')
assert.equal(formatOntologyKgEvidenceValue('a'.repeat(181)), `${'a'.repeat(177)}...`)
assert.deepEqual(buildOntologyKgEvidenceRows([1, { ok: true }]), [
  { key: 'item_1', value: '1' },
  { key: 'item_2', value: '{"ok":true}' }
])
assert.deepEqual(buildOntologyKgEvidenceRows({ permission: 'sales:view' }), [{ key: 'permission', value: 'sales:view' }])
assert.equal(formatOntologyKgTooltip({
  dataType: 'edge',
  data: { raw: { from: 'role:a', to: 'app:b', predicate: 'acl:canAccessApp', rule_name: 'rule-a' } }
}), 'role:a -> app:b<br/>可访问应用<br/>rule-a')
assert.equal(formatOntologyKgTooltip({ dataType: 'node', data: { rawType: 'role', rawId: 'a', name: '角色A' } }), '角色:a<br/>角色A')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/ontology-workbench-kg-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'from \'element-plus\'', 'axios', 'request(', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `ontology KG policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/OntologyWorkbench.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ontology-workbench-kg-policy['"]/)
for (const removedDefinition of [
  'const PREDICATE_LABELS =',
  'const KG_NODE_TYPE_LABELS =',
  'const KG_GRAPH_CATEGORIES =',
  'const KG_GRAPH_CATEGORY_BY_TYPE =',
  'const KG_GRAPH_NODE_COLORS =',
  'const formatKgEvidenceValue =',
  'const kgNodeKey =',
  'const kgGraphCategory =',
  'const kgGraphNodeSize =',
  'const addKgGraphNode =',
  'const kgEdgeKey ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `OntologyWorkbench reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'buildOntologyKgGraphPayload({',
  'buildOntologyWorkbenchViews({',
  'buildOntologyKgEvidenceRows(',
  'formatOntologyKgTooltip',
  'ONTOLOGY_KG_GRAPH_NODE_COLORS',
  'ONTOLOGY_KG_GRAPH_CATEGORIES'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `OntologyWorkbench lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2320)

console.log('PASS: OntologyWorkbench KG policy preserves labels, nodes, edges, graph payload, views, evidence and tooltips')
