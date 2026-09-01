// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildOntologyInsightMetricCards,
  buildOntologyReasoningMetricCards,
  buildOntologyTableLabelMap,
  cleanOntologyDisplayText,
  collectOntologyRelationTables,
  countOntologyRelationTypes,
  extractOntologySemanticsMode,
  filterOntologyReasoningFacts,
  filterOntologyRelations,
  filterOntologyRelationsByTable,
  firstOntologyRow,
  flattenOntologyColumnSemantics,
  formatOntologyColumn,
  getOntologyColumnTables,
  getOntologyReasoningHealthTagType,
  getOntologyRelationTypeLabel,
  getOntologySemanticClassLabel,
  getOntologySemanticsModeLabel,
  parseOntologyTableKey,
  sanitizeOntologySemanticName
} from '../../eiscore-apps/src/domain/ontology-workbench-relation-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const relations = [
  {
    id: 1,
    relation_type: 'ontology',
    subject_table: 'sales.orders',
    subject_column: 'customer_id',
    subject_semantic_name: '销售订单',
    predicate: 'ontology:dependsOn',
    object_table: 'public.users',
    object_column: 'id',
    object_semantic_name: '用户'
  },
  {
    id: 2,
    relation_type: 'foreign_key',
    subject_table: 'public.users',
    subject_semantic_name: 'public.users',
    predicate: 'fk',
    object_table: 'public.roles',
    object_semantic_name: '???'
  }
]

assert.deepEqual(filterOntologyRelations(relations, { relationType: 'ontology' }).map((item) => item.id), [1])
assert.deepEqual(filterOntologyRelations(relations, { relationType: 'all', searchText: 'ROLE' }).map((item) => item.id), [2])
assert.deepEqual(collectOntologyRelationTables(relations), ['public.roles', 'public.users', 'sales.orders'])
assert.deepEqual(filterOntologyRelationsByTable(relations, 'public.users').map((item) => item.id), [1, 2])
assert.equal(filterOntologyRelationsByTable(relations, ''), relations)
assert.deepEqual(countOntologyRelationTypes(relations), { ontology: 1, foreignKey: 1 })
assert.deepEqual(getOntologyColumnTables('', relations[0]), ['sales.orders', 'public.users'])
assert.deepEqual(getOntologyColumnTables('public.users', relations[0]), ['public.users'])
assert.deepEqual(flattenOntologyColumnSemantics(['public.users'], {
  'public.users': [{ column_name: 'id', table_key: 'old' }]
}), [{ column_name: 'id', table_key: 'public.users' }])

assert.deepEqual(buildOntologyReasoningMetricCards({ facts_total: 4, inferred_facts: 2 }).slice(0, 2), [
  { key: 'facts', label: '事实总数', value: 4 },
  { key: 'inferred', label: '推理事实', value: 2 }
])
assert.equal(getOntologyReasoningHealthTagType({ is_healthy: true, health_code: 'bad' }), 'success')
assert.equal(getOntologyReasoningHealthTagType({ health_code: 'stale' }), 'danger')
assert.equal(getOntologyReasoningHealthTagType({}), 'info')
assert.deepEqual(buildOntologyInsightMetricCards({
  health: { semanticized_relations: 2, api_relations: 3 },
  roleAccessInsights: [1],
  tableImpactInsights: [1, 2],
  sensitiveAccessPaths: [],
  ruleStats: [1, 2, 3]
}).map((item) => item.value), ['2/3', '0/0', 1, 2, 0, 3])

const facts = [{ subject_id: 'role:a', predicate: 'acl:canAccessTable', object_label: '订单' }]
assert.equal(filterOntologyReasoningFacts(facts, ''), facts)
assert.deepEqual(filterOntologyReasoningFacts(facts, '订单'), facts)
assert.deepEqual(filterOntologyReasoningFacts(facts, 'missing'), [])
assert.equal(firstOntologyRow([{ id: 1 }, { id: 2 }]).id, 1)
assert.equal(firstOntologyRow({ id: 3 }).id, 3)
assert.equal(getOntologyRelationTypeLabel('ontology'), '本体关系')
assert.equal(getOntologyRelationTypeLabel('foreign_key'), '外键关系')
assert.equal(getOntologySemanticClassLabel('identifier'), '标识')
assert.equal(getOntologySemanticsModeLabel('creator_defined'), '创建者定义')
assert.equal(cleanOntologyDisplayText(' ??? '), '')
assert.equal(cleanOntologyDisplayText(' 销售订单 '), '销售订单')
assert.equal(formatOntologyColumn('id'), '.id')
assert.equal(formatOntologyColumn(''), '')
assert.equal(sanitizeOntologySemanticName('sales.orders', 'sales.orders'), '')
assert.equal(sanitizeOntologySemanticName('销售订单', 'sales.orders'), '销售订单')

const labels = buildOntologyTableLabelMap(relations)
assert.equal(labels['public.users'], '用户')
assert.equal(labels['public.roles'], '角色')
assert.equal(labels['sales.orders'], '销售订单')
assert.deepEqual(parseOntologyTableKey('users'), { schema: 'public', table: 'users', tableKey: 'public.users' })
assert.deepEqual(parseOntologyTableKey('app_center.runtime.records'), {
  schema: 'app_center',
  table: 'runtime.records',
  tableKey: 'app_center.runtime.records'
})
assert.equal(parseOntologyTableKey(''), null)
assert.equal(extractOntologySemanticsMode(['x', 'semantics:ai_defined']), 'ai_defined')
assert.equal(extractOntologySemanticsMode('semantics:ai_defined'), '')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/ontology-workbench-relation-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'from \'element-plus\'', 'axios', 'request(', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `ontology relation policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/OntologyWorkbench.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ontology-workbench-relation-policy['"]/)
for (const removedDefinition of [
  'const STATIC_TABLE_LABELS =',
  'const SEMANTIC_CLASS_LABELS =',
  'const normalizedSearch =',
  'const firstRow =',
  'const relationTypeLabel =',
  'const semanticClassLabel =',
  'const semanticsModeLabel =',
  'const cleanDisplayText =',
  'const formatColumn =',
  'const sanitizeSemanticName =',
  'const parseTableKey =',
  'const extractSemanticsMode ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `OntologyWorkbench reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'filterOntologyRelations(',
  'collectOntologyRelationTables(',
  'filterOntologyRelationsByTable(',
  'buildOntologyTableLabelMap('
]) {
  assert.equal(pageSource.includes(requiredUse), true, `OntologyWorkbench lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2608)

console.log('PASS: OntologyWorkbench relation policy preserves filtering, tables, metrics, labels and semantic parsing')
