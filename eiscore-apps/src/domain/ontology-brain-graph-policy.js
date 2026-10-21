// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  buildOntologyKgGraphPayload,
  getOntologyKgEdgeKey,
  getOntologyKgNodeKey,
  getOntologyPredicateLabel
} from './ontology-workbench-kg-policy.js'
import { buildOntologyTableLabelMap, cleanOntologyDisplayText } from './ontology-workbench-relation-policy.js'

export const ONTOLOGY_BRAIN_DOMAINS = Object.freeze([
  Object.freeze({ key: 'sales', label: '销售' }),
  Object.freeze({ key: 'hr', label: '人事' }),
  Object.freeze({ key: 'materials', label: '仓储' }),
  Object.freeze({ key: 'apps', label: '应用中心' }),
  Object.freeze({ key: 'shared', label: '公共基础' })
])

const DOMAIN_ALIASES = {
  sales: 'sales', hr: 'hr',
  materials: 'materials', material: 'materials', mms: 'materials', inventory: 'materials', warehouse: 'materials',
  apps: 'apps', app_center: 'apps', app_data: 'apps',
  shared: 'shared', common: 'shared', general: 'shared', acl: 'shared', workflow: 'shared', ontology: 'shared'
}

const validId = (value) => typeof value === 'string' && value.trim().length > 0
const compareId = (left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0
const preferredLabel = (values, fallback) => {
  const labels = values.map(cleanOntologyDisplayText).filter(Boolean)
  return labels.find((value) => /[\u3400-\u9fff]/u.test(value)) || labels[0] || fallback
}

export const getOntologyBrainDomain = ({ semanticDomain, nodeType, nodeId } = {}) => {
  const domain = String(semanticDomain || '').trim().toLowerCase()
  if (Object.hasOwn(DOMAIN_ALIASES, domain)) return DOMAIN_ALIASES[domain]
  const key = String(nodeId || '').toLowerCase()
  if (nodeType === 'semantic_domain' && Object.hasOwn(DOMAIN_ALIASES, key)) return DOMAIN_ALIASES[key]
  if (/(?:^|[.:])(?:v_)?sales(?:[_.:]|$)/.test(key)) return 'sales'
  if (/(?:^|[.:])hr(?:[_.:]|$)/.test(key) || /^public\.(?:employees|departments|positions)(?:[.:]|$)/.test(key)) return 'hr'
  if (/(?:^|[.:])(?:v_)?(?:mms|material|materials|inventory|warehouse|warehouses|bom)(?:[_.:]|$)/.test(key)) return 'materials'
  if (/^(?:app_center|app_data)[.:]/.test(key) || /^(?:module:|app:)?apps(?:[_.:]|$)/.test(key)) return 'apps'
  return 'shared'
}

export const filterOntologyBrainGraph = ({ nodes = [], edges = [] } = {}, domainFilter = '') => {
  const visibleNodes = nodes.filter((node) => !domainFilter || domainFilter === 'all' || node.domain === domainFilter).sort(compareId)
  const ids = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).sort(compareId)
  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    domains: ONTOLOGY_BRAIN_DOMAINS.map((domain) => ({ ...domain, count: visibleNodes.filter((node) => node.domain === domain.key).length })),
    stats: { nodes: visibleNodes.length, edges: visibleEdges.length }
  }
}

// The relation view uses row_number IDs; its semantic tuple survives ordering and refreshes.
export const getOntologyBrainRelationKey = (row = {}) => `relation:${JSON.stringify([
  row.relation_type, row.subject_table, row.subject_column, row.predicate,
  row.object_table, row.object_column, row.bridge_table
].map((value) => value ?? ''))}`

export const buildOntologyBrainRelationGraph = ({ relations = [], tableLabelMap = {}, domainFilter = '', selectedTable = '' } = {}) => {
  const rows = (Array.isArray(relations) ? relations : [])
    .filter((row) => row && validId(row.subject_table) && validId(row.object_table))
    .filter((row) => !selectedTable || row.subject_table === selectedTable || row.object_table === selectedTable)
    .map((row) => ({ id: getOntologyBrainRelationKey(row), row }))
    .sort(compareId)
  const labels = buildOntologyTableLabelMap(rows.map(({ row }) => row))
  const nodes = new Map()
  const edges = new Map()
  rows.forEach(({ id, row }) => {
    ;['subject', 'object'].forEach((side) => {
      const tableKey = row[`${side}_table`]
      const key = getOntologyKgNodeKey('table', tableKey)
      const existing = nodes.get(key)
      const label = preferredLabel([tableLabelMap[tableKey], row[`${side}_semantic_name`], existing?.label, labels[tableKey]], tableKey)
      const domain = getOntologyBrainDomain({ semanticDomain: row[`${side}_semantic_domain`], nodeType: 'table', nodeId: tableKey })
      nodes.set(key, {
        id: key, label, type: 'table', domain, tableKey, raw: existing?.raw || row
      })
    })
    if (!edges.has(id)) edges.set(id, {
      id,
      source: getOntologyKgNodeKey('table', row.subject_table),
      target: getOntologyKgNodeKey('table', row.object_table),
      label: getOntologyPredicateLabel(row.predicate),
      raw: row
    })
  })
  return filterOntologyBrainGraph({ nodes: [...nodes.values()], edges: [...edges.values()] }, domainFilter)
}

export const buildOntologyBrainKgGraph = ({ selectedNode, neighbors = [], pathRows = [], domainFilter = '' } = {}) => {
  const neighborRows = (Array.isArray(neighbors) ? neighbors : []).filter(Boolean)
  const paths = (Array.isArray(pathRows) ? pathRows : []).filter(Boolean)
  const payload = buildOntologyKgGraphPayload({ selectedNode, neighbors: neighborRows, pathRows: paths })
  const nodeRows = new Map()
  const edgeRows = new Map()
  const rememberNode = (type, id, raw, semanticDomain, label) => {
    if (validId(type) && validId(id)) {
      const key = getOntologyKgNodeKey(type, id)
      const existing = nodeRows.get(key)
      nodeRows.set(key, {
        raw: existing?.raw || raw,
        semanticDomain: existing?.semanticDomain || semanticDomain,
        label: preferredLabel([existing?.label, label], '')
      })
    }
  }
  const rememberEdge = (sourceType, sourceId, targetType, targetId, predicate, edgeId, raw) => {
    if (![sourceType, sourceId, targetType, targetId].every(validId)) return
    edgeRows.set(getOntologyKgEdgeKey({
      edge_id: edgeId,
      source: getOntologyKgNodeKey(sourceType, sourceId),
      target: getOntologyKgNodeKey(targetType, targetId),
      predicate: predicate || ''
    }), raw)
  }
  const endpointValue = (row, type, id, field) => {
    if (row.from_type === type && (!row.from_id || row.from_id === id)) return row[`from_${field}`]
    if (row.to_type === type && (!row.to_id || row.to_id === id)) return row[`to_${field}`]
    return ''
  }
  rememberNode(selectedNode?.node_type, selectedNode?.node_id, selectedNode, selectedNode?.semantic_domain, selectedNode?.node_label)
  neighborRows.forEach((row) => {
    const sourceType = row.edge_subject_type || row.from_type
    const sourceId = row.edge_subject_id || row.from_id
    const targetType = row.edge_object_type || row.to_type
    const targetId = row.edge_object_id || row.to_id
    rememberNode(sourceType, sourceId, row, row.edge_subject_semantic_domain || endpointValue(row, sourceType, sourceId, 'semantic_domain'), endpointValue(row, sourceType, sourceId, 'label'))
    rememberNode(targetType, targetId, row, row.edge_object_semantic_domain || endpointValue(row, targetType, targetId, 'semantic_domain'), endpointValue(row, targetType, targetId, 'label'))
    rememberEdge(sourceType, sourceId, targetType, targetId, row.predicate, row.edge_id, row)
  })
  paths.forEach((row) => {
    rememberNode(row.target_type, row.target_id, row, row.target_semantic_domain, row.target_label)
    ;(Array.isArray(row.path_facts) ? row.path_facts : []).filter(Boolean).forEach((fact) => {
      rememberNode(fact.subject_type, fact.subject_id, fact, fact.subject_semantic_domain, fact.subject_label)
      rememberNode(fact.object_type, fact.object_id, fact, fact.object_semantic_domain, fact.object_label)
      rememberEdge(fact.subject_type, fact.subject_id, fact.object_type, fact.object_id, fact.predicate, fact.id, fact)
    })
  })
  const nodes = payload.nodes.filter((node) => nodeRows.has(node.id)).map((node) => {
    const source = nodeRows.get(node.id)
    return {
      id: node.id,
      label: preferredLabel([source.label, node.name], node.rawId),
      type: node.rawType,
      domain: getOntologyBrainDomain({ semanticDomain: source.semanticDomain, nodeType: node.rawType, nodeId: node.rawId }),
      ...(node.rawType === 'table' ? { tableKey: node.rawId } : {}),
      raw: source.raw
    }
  })
  const edges = payload.links.filter((link) => edgeRows.has(getOntologyKgEdgeKey(link))).map((link) => ({
    id: getOntologyKgEdgeKey(link), source: link.source, target: link.target,
    label: getOntologyPredicateLabel(link.predicate), raw: edgeRows.get(getOntologyKgEdgeKey(link))
  }))
  return filterOntologyBrainGraph({ nodes, edges }, domainFilter)
}
