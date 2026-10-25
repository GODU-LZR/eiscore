// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const text = (value) => String(value == null ? '' : value).trim()

export const normalizeKnowledgeOntologyContext = (payload) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []
  const files = Array.isArray(data.files) ? data.files : []
  return {
    nodes: nodes
      .filter((node) => text(node?.id) && text(node?.label))
      .map((node) => ({
        id: text(node.id),
        label: text(node.label),
        type: text(node.type) || 'unknown',
        parentId: text(node.parentId),
        metadata: node?.metadata && typeof node.metadata === 'object' ? node.metadata : {}
      })),
    edges: edges
      .filter((edge) => text(edge?.id) && text(edge?.source) && text(edge?.target))
      .map((edge) => ({
        id: text(edge.id),
        source: text(edge.source),
        target: text(edge.target),
        label: text(edge.label),
        type: text(edge.type) || 'ontology'
      })),
    files: files
      .filter((file) => text(file?.id) && text(file?.name))
      .map((file) => ({
        id: text(file.id),
        name: text(file.name),
        type: text(file.type),
        updatedAt: text(file.updatedAt),
        size: Number.isFinite(Number(file.size)) ? Number(file.size) : null
      })),
    meta: {
      namespace: text(payload?.meta?.namespace),
      profile: text(payload?.meta?.profile),
      readOnly: payload?.meta?.readOnly === true
    }
  }
}

export const buildKnowledgeOntologyTree = (context) => {
  const nodes = Array.isArray(context?.nodes) ? context.nodes : []
  const children = new Map()
  nodes.forEach((node) => {
    const parent = text(node.parentId)
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(node)
  })
  const makeTree = (parentId, ancestors = new Set()) => (children.get(parentId) || [])
    .slice()
    .sort((a, b) => `${a.type}:${a.label}`.localeCompare(`${b.type}:${b.label}`))
    .flatMap((node) => {
      if (ancestors.has(node.id)) return []
      const nextAncestors = new Set(ancestors)
      nextAncestors.add(node.id)
      return [{ ...node, children: makeTree(node.id, nextAncestors) }]
    })
  return makeTree('')
}

export const filterKnowledgeOntologyTree = (tree, query = '') => {
  const needle = text(query).toLowerCase()
  if (!needle) return tree
  const visit = (nodes) => nodes.flatMap((node) => {
    const children = visit(node.children || [])
    const matches = `${node.label} ${node.type}`.toLowerCase().includes(needle)
    return matches || children.length ? [{ ...node, children }] : []
  })
  return visit(Array.isArray(tree) ? tree : [])
}

export const getKnowledgeOntologyLinks = (file) => {
  const links = file?.metadata?.knowledgeOntologyLinks
  if (!Array.isArray(links)) return []
  return links
    .filter((item) => text(item?.id) && text(item?.label))
    .map((item) => ({
      id: text(item.id),
      label: text(item.label),
      type: text(item.type) || 'node'
    }))
}

export const toggleKnowledgeOntologyLink = (links, node) => {
  const current = getKnowledgeOntologyLinks({ metadata: { knowledgeOntologyLinks: links } })
  if (!node?.id || !node?.label) return current
  const nodeId = text(node.id)
  const next = current.some((item) => item.id === nodeId)
    ? current.filter((item) => item.id !== nodeId)
    : [...current, { id: nodeId, label: text(node.label), type: text(node.type) || 'node' }]
  return next.slice(0, 100)
}

export const buildKnowledgeFileMetadataPatch = (file, links) => ({
  metadata: {
    ...(file?.metadata && typeof file.metadata === 'object' ? file.metadata : {}),
    knowledgeOntologyLinks: getKnowledgeOntologyLinks({ metadata: { knowledgeOntologyLinks: links } })
  }
})
