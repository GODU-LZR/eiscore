// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildKnowledgeOntologyTree,
  buildKnowledgeFileMetadataPatch,
  filterKnowledgeOntologyTree,
  getKnowledgeOntologyLinks,
  normalizeKnowledgeOntologyContext,
  toggleKnowledgeOntologyLink
} from '../../eiscore-apps/src/domain/knowledge-ontology-policy.js'

const component = readFileSync(resolve(import.meta.dirname, '../../eiscore-apps/src/components/KnowledgeOntologyPanel.vue'), 'utf8')
assert.match(component, /selectedFile: \{ type: Object, default: null \}/)
assert.match(component, /defineEmits\(\['select-node', 'file-updated'\]\)/)
assert.match(component, /updateKnowledgeFile\(props\.selectedFile\.id, patch\)/)
assert.match(component, /buildKnowledgeFileMetadataPatch\(props\.selectedFile, links\)/)
assert.match(component, /getKnowledgeOntologyLinks\(props\.selectedFile\)/)

const context = normalizeKnowledgeOntologyContext({
  data: {
    nodes: [
      { id: 'table:sales.orders', label: '销售订单', type: 'table', parentId: null },
      { id: 'column:sales.orders.total', label: '订单金额', type: 'column', parentId: 'table:sales.orders' },
      { id: 'app:sales', label: '销售应用', type: 'app', parentId: null },
      { id: '', label: 'bad node', type: 'table' }
    ],
    edges: [
      { id: 'contains:1', source: 'table:sales.orders', target: 'column:sales.orders.total', label: '包含', type: 'contains' },
      { id: 'bad', source: '', target: 'column:sales.orders.total' }
    ],
    files: [{ id: 'f1', name: '订单资料.md', size: 8 }]
  },
  meta: { namespace: 'knowledge', profile: 'knowledge', readOnly: true }
})

assert.equal(context.nodes.length, 3)
assert.equal(context.edges.length, 1)
assert.equal(context.files[0].name, '订单资料.md')
assert.deepEqual(context.meta, { namespace: 'knowledge', profile: 'knowledge', readOnly: true })

const tree = buildKnowledgeOntologyTree(context)
assert.deepEqual(tree.map((node) => node.id), ['app:sales', 'table:sales.orders'])
assert.equal(tree.find((node) => node.id === 'table:sales.orders').children[0].id, 'column:sales.orders.total')
assert.equal(filterKnowledgeOntologyTree(tree, '金额')[0].children[0].label, '订单金额')
assert.equal(filterKnowledgeOntologyTree(tree, 'not-found').length, 0)

const sourceFile = { id: 'f1', file_name: '订单资料.md', metadata: { folder: '销售', source: 'upload' } }
assert.deepEqual(getKnowledgeOntologyLinks(sourceFile), [])
const linked = toggleKnowledgeOntologyLink([], { id: 'table:sales.orders', label: '销售订单', type: 'table' })
assert.deepEqual(linked, [{ id: 'table:sales.orders', label: '销售订单', type: 'table' }])
assert.deepEqual(buildKnowledgeFileMetadataPatch(sourceFile, linked), {
  metadata: {
    folder: '销售',
    source: 'upload',
    knowledgeOntologyLinks: linked
  }
})
assert.deepEqual(toggleKnowledgeOntologyLink(linked, { id: 'table:sales.orders', label: '销售订单', type: 'table' }), [])

const cycle = buildKnowledgeOntologyTree({ nodes: [
  { id: 'a', label: 'A', type: 'table', parentId: 'b' },
  { id: 'b', label: 'B', type: 'table', parentId: 'a' }
] })
assert.deepEqual(cycle, [], 'cyclic parent references must not recurse or invent roots')

console.log('knowledge ontology client policy regression: ok')
