// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as brainPolicy from '../../eiscore-apps/src/domain/ontology-brain-graph-policy.js'
import * as relationPolicy from '../../eiscore-apps/src/domain/ontology-workbench-relation-policy.js'
import * as kgPolicy from '../../eiscore-apps/src/domain/ontology-workbench-kg-policy.js'

const requireApps = createRequire(new URL('../../eiscore-apps/package.json', import.meta.url))
const { computed, ref, nextTick, watch } = requireApps('vue')
const { parse } = requireApps('@babel/parser')
const source = readFileSync(new URL('../../eiscore-apps/src/views/OntologyWorkbench.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
assert.ok(script)
const ast = parse(script, { sourceType: 'module' }).program
const statement = (name) => {
  const node = ast.body.find((item) => item.declarations?.some((entry) => entry.id.name === name))
  assert.ok(node, `missing actual Vue declaration: ${name}`)
  return script.slice(node.start, node.end)
}
const stateNames = [
  'graphDisplay', 'brainDomain', 'brainUnavailableReason', 'relations', 'searchText', 'relationType',
  'selectedTable', 'pickedRelationId', 'activeWorkbenchView', 'reasoningSummary', 'reasoningHealth',
  'kgSelectedNode', 'kgNeighbors', 'kgPathRows', 'kgSelectedEdge', 'kgPickedNodeId', 'kgPickedEdgeId',
  'kgPathTargetType', 'kgPathTargetId'
]
const valueNames = [
  'searchedRelations', 'filteredRelations', 'allTables', 'graphRelations', 'relationTypeCounts', 'pickedRelation',
  'tableRows', 'tableLabelMap', 'brainGraph', 'kgBrainGraph', 'kgGraphPayload', 'kgGraphStats',
  'workbenchViews', 'activeWorkbenchMeta', 'kgSelectedEdgeEvidenceRows'
]
const functionNames = [
  'toggleTableFocus', 'pickRelation', 'syncPickedRelation', 'syncSelectedTable', 'setActiveWorkbenchView'
]
const watcherSource = ast.body.filter((node) => node.expression?.callee?.name === 'watch'
  && ['filteredRelations', 'kgGraphPayload'].includes(node.expression.arguments[0]?.name))
  .map((node) => script.slice(node.start, node.end)).join('\n')
const dependencies = {
  computed, ref, watch, ...brainPolicy, ...relationPolicy, ...kgPolicy,
  renderKgGraph: () => {}
}
const names = [...stateNames, ...valueNames, ...functionNames]
const view = Function(...Object.keys(dependencies), `
  ${names.map(statement).join('\n')}
  ${statement('brainHandlers')}
  ${watcherSource}
  return { ${names.join(', ')}, ...brainHandlers }
`)(...Object.values(dependencies))

view.relationType.value = 'all'
view.relations.value = [
  { id: 1, subject_table: 'public.sales_orders', subject_semantic_name: '销售订单', object_table: 'public.sales_customers', object_semantic_name: '销售客户', predicate: 'ontology:dependsOn', relation_type: 'ontology' },
  { id: 2, subject_table: 'hr.archives', subject_semantic_name: '人事花名册', object_table: 'public.departments', object_semantic_name: '部门', predicate: 'ontology:belongsTo', relation_type: 'ontology' },
  { id: 3, subject_table: 'scm.inventory', subject_semantic_name: '库存', object_table: 'public.materials', object_semantic_name: '物料', predicate: 'ontology:dependsOn', relation_type: 'foreign_key' },
  { id: 4, subject_table: 'app_center.apps', object_table: 'public.roles', predicate: 'acl:requiresPermission', relation_type: 'ontology' },
  { id: 5, subject_table: 'public.sales_customers', object_table: 'public.users', predicate: 'acl:belongsTo', relation_type: 'ontology' }
]
await nextTick()
assert.deepEqual(view.workbenchViews.value.map(({ key }) => key), ['relations', 'reasoning', 'kg', 'insight'])
assert.equal(view.graphDisplay.value, '3d')
assert.equal(view.graphRelations.value.length, 5)
assert.deepEqual(view.brainGraph.value.edges.map(({ raw }) => raw.id).sort(), [1, 2, 3, 4, 5])

view.toggleTableFocus('public.sales_orders')
view.pickRelation(view.graphRelations.value[0])
const pickedRaw = view.pickedRelation.value
assert.equal(pickedRaw.id, 1)
for (const mode of ['2d', '3d', '2d']) {
  view.graphDisplay.value = mode
  assert.equal(view.selectedTable.value, 'public.sales_orders')
  assert.equal(view.pickedRelation.value, pickedRaw)
  assert.equal(view.brainGraph.value.edges[0].raw, view.graphRelations.value[0])
}
view.brainDomain.value = 'hr'
await nextTick()
assert.equal(view.selectedTable.value, '')
assert.equal(view.pickedRelation.value, null)
assert.deepEqual(view.graphRelations.value.map(({ id }) => id), [2])
assert.deepEqual(view.brainGraph.value.nodes.map(({ tableKey }) => tableKey), ['hr.archives', 'public.departments'])
view.searchText.value = 'not-present'
await nextTick()
assert.equal(view.graphRelations.value.length, 0)
assert.deepEqual(view.brainGraph.value.stats, { nodes: 0, edges: 0 })
view.searchText.value = ''
view.brainDomain.value = ''
await nextTick()

view.kgSelectedNode.value = { node_type: 'role', node_id: 'manager', node_label: '经理' }
view.kgNeighbors.value = [{
  edge_id: 11, edge_subject_type: 'role', edge_subject_id: 'manager', edge_object_type: 'table', edge_object_id: 'public.sales_orders',
  from_type: 'table', from_id: 'public.sales_orders', from_label: '销售订单', to_type: 'role', to_id: 'manager', to_label: '经理',
  predicate: 'acl:canAccessTable', is_inferred: false, direction: 'incoming', evidence: { permission: 'sales:view' }
}]
view.kgPathRows.value = [{
  target_type: 'column', target_id: 'public.sales_orders.amount', target_label: '金额', path_facts: [{
    id: 12, subject_type: 'table', subject_id: 'public.sales_orders', object_type: 'column', object_id: 'public.sales_orders.amount',
    predicate: 'data:hasSensitiveColumn', inferred: true, rule: 'real-access-rule', confidence: 0.8, evidence: { column: 'amount' }
  }]
}, { target_type: 'app', target_id: 'no-proof', target_label: '无证明应用', path_nodes: ['role:manager', 'app:no-proof'] }]
await nextTick()
const compareKgViews = () => {
  assert.deepEqual(view.kgBrainGraph.value.nodes.map(({ id }) => id).sort(), view.kgGraphPayload.value.nodes.map(({ id }) => id).sort())
  assert.deepEqual(view.kgBrainGraph.value.edges.map(({ id }) => id).sort(), view.kgGraphPayload.value.links.map(kgPolicy.getOntologyKgEdgeKey).sort())
}
compareKgViews()
assert.deepEqual(view.kgGraphStats.value, { nodes: 4, links: 2 })
const { pickKgBrainNodeId } = view
pickKgBrainNodeId('table:public.sales_orders')
assert.equal(view.kgPickedNodeId.value, 'table:public.sales_orders')
assert.equal(view.kgPathTargetId.value, 'public.sales_orders')
view.pickKgBrainNode('column:public.sales_orders.amount')
assert.equal(view.kgPathTargetType.value, 'column')
assert.equal(view.kgPathTargetId.value, 'public.sales_orders.amount')
view.pickKgBrainEdge(view.kgBrainGraph.value.edges.find(({ id }) => id === 'edge:12'))
assert.equal(view.kgSelectedEdge.value.is_inferred, true)
assert.equal(view.kgSelectedEdge.value.rule_name, 'real-access-rule')
assert.equal(view.kgSelectedEdge.value.confidence, 0.8)
assert.deepEqual(view.kgSelectedEdgeEvidenceRows.value, [{ key: 'column', value: 'amount' }])
assert.equal(view.kgSelectedEdge.value.from, '销售订单')
assert.equal(view.kgSelectedEdge.value.to, '金额')
assert.equal(view.kgBrainGraph.value.edges.some(({ target }) => target === 'app:no-proof'), false)
view.brainDomain.value = 'sales'
await nextTick()
compareKgViews()
assert.deepEqual(view.kgGraphStats.value, { nodes: 2, links: 1 })
view.brainDomain.value = 'hr'
await nextTick()
assert.equal(view.kgPickedNodeId.value, '')
assert.equal(view.kgSelectedEdge.value, null)
assert.equal(view.kgPickedEdgeId.value, '')
assert.deepEqual(view.kgGraphStats.value, { nodes: 0, links: 0 })
view.useTwoDimensionalGraph('WebGL unavailable')
assert.equal(view.graphDisplay.value, '2d')
assert.equal(view.brainUnavailableReason.value, 'WebGL unavailable')

let moduleLoads = 0
let chartInitializations = 0
let resolveModule
const display = ref('3d')
const activeView = ref('kg')
const runtime = {
  nextTick, graphDisplay: display, activeWorkbenchView: activeView,
  kgGraphRef: ref({ isConnected: true }), kgGraphPayload: view.kgGraphPayload,
  loadKgEcharts: () => { moduleLoads++; return new Promise((resolve) => { resolveModule = resolve }) }
}
const render = Function(...Object.keys(runtime), `let kgChart = null; ${statement('renderKgGraph')}; return renderKgGraph`)(...Object.values(runtime))
await render()
assert.equal(moduleLoads, 0, '3D mode must not load or initialize ECharts')
display.value = '2d'
activeView.value = 'insight'
await render()
assert.equal(moduleLoads, 0, 'hidden KG panel must not load or initialize ECharts')
activeView.value = 'kg'
const pending = render()
await nextTick()
display.value = '3d'
resolveModule({ init: () => { chartInitializations++; return {} } })
await pending
assert.equal(chartInitializations, 0, 'a late ECharts import must not initialize after switching to 3D')

const displayWatcher = ast.body.find((node) => node.expression?.callee?.name === 'watch'
  && node.expression.arguments[0]?.elements?.map((item) => item.name).join(',') === 'graphDisplay,activeWorkbenchView')
assert.ok(displayWatcher, 'missing actual display/view watcher')
const displayCallback = displayWatcher.expression.arguments[1]
for (const [mode, panel, keepChart] of [['2d', 'relations', false], ['3d', 'kg', false], ['2d', 'kg', true]]) {
  let disposals = 0
  const chart = { dispose: () => { disposals++ } }
  const reason = ref('WebGL unavailable')
  const transitionRuntime = {
    chart, brainUnavailableReason: reason, nextTick,
    updateGraphHostWidth: () => {}, resizeKgGraph: () => {}, renderKgGraph: () => {}
  }
  const transition = Function(...Object.keys(transitionRuntime), `
    let kgChart = chart
    return { run: (${script.slice(displayCallback.start, displayCallback.end)}), getChart: () => kgChart }
  `)(...Object.values(transitionRuntime))
  await transition.run([mode, panel])
  assert.equal(reason.value, mode === '3d' ? '' : 'WebGL unavailable', `${mode}/${panel} must retain fallback notice until a 3D retry`)
  assert.equal(transition.getChart(), keepChart ? chart : null, `${mode}/${panel} must preserve the KG renderer lifecycle`)
  assert.equal(disposals, keepChart ? 0 : 1)
}

assert.match(source, /v-if="graphDisplay === '3d' && activeWorkbenchView === 'relations'"/)
assert.match(source, /v-if="graphDisplay === '3d' && activeWorkbenchView === 'kg'"/)
assert.equal((source.match(/@unavailable="brainHandlers\.useTwoDimensionalGraph"/g) || []).length, 2)
assert.doesNotMatch(source, /@unavailable="useTwoDimensionalGraph"/)
assert.match(source, /<OntologyRelationGraph[\s\S]*?:relations="graphRelations"/)
const kgEdgeClick = source.match(/if \(params\.dataType === 'edge'\) \{([\s\S]*?)\n\s*\}/)?.[1] || ''
assert.match(kgEdgeClick, /kgBrainGraph\.value\.edges\.find\(/, '2D KG edge selection must map to the adapter edge preserving original evidence')
assert.match(kgEdgeClick, /if \(selected\) brainHandlers\.pickKgBrainEdge\(selected\)/, '2D KG edge selection must use the same detail handler as the brain view')
assert.match(source, /onBeforeUnmount\(\(\) => \{[\s\S]*?graphResizeObserver\.disconnect\(\)[\s\S]*?kgGraphResizeObserver\.disconnect\(\)[\s\S]*?kgChart\.dispose\(\)/)
assert.doesNotMatch(source, /(?:fetch\(|localStorage|sessionStorage|\/api\/graph\/snapshot|demoGraph)/)
const brainComponent = readFileSync(new URL('../../eiscore-apps/src/components/OntologyBrainGraph.vue', import.meta.url), 'utf8')
const brainScene = readFileSync(new URL('../../eiscore-apps/src/visualization/ontology-brain-scene.js', import.meta.url), 'utf8')
assert.match(brainComponent, /onDeactivated\(\(\) => \{ keptActive = false; syncActive\(\)/)
assert.match(brainComponent, /onBeforeUnmount\(\(\) => \{[\s\S]*?scene\?\.dispose\(\)/)
assert.match(brainComponent, /v-else-if="!graph\.nodes\?\.length"/)
assert.match(brainComponent, /title="显示\/隐藏空间网格"/)
assert.match(brainComponent, /const gridVisible = ref\(true\)/)
assert.match(brainComponent, /scene\.setGridVisible\(gridVisible\.value\)/)
assert.match(brainScene, /export const ONTOLOGY_SPACE_GRID/)
assert.match(brainScene, /export function createOntologySpaceGrid\(\)/)
assert.match(brainScene, /canvas\.dataset\.gridVisible = 'true'/)
assert.match(brainScene, /function setGridVisible\(value\)/)
assert.match(brainScene, /function recenterGrid\(\)/)
assert.match(brainScene, /Math\.round\(controls\.target\.x \/ step\) \* step/)
assert.match(brainScene, /Math\.round\(controls\.target\.y \/ step\) \* step/)
assert.match(brainScene, /Math\.round\(controls\.target\.z \/ step\) \* step/)
assert.match(brainScene, /controls\.addEventListener\('change', onControlsChange\)/)
assert.match(brainScene, /controls\.removeEventListener\('change', onControlsChange\)/)
assert.match(brainScene, /disposeGroup\(grid\)[\s\S]*disposeGroup\(axes\)/)
console.log('PASS: actual workbench Vue computed/functions preserve 2D/3D data, domain and selection state, real KG proof, empty states and hidden renderer guards')
