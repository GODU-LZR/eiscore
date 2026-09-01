// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const PREDICATE_LABELS = {
  'acl:hasRole': '拥有角色',
  'acl:grantsPermission': '授予权限',
  'wf:instanceOf': '实例属于流程定义',
  'wf:hasCurrentTask': '实例当前任务',
  'wf:assignedRole': '任务分配给角色',
  'wf:assignedUser': '任务分配给用户',
  'wf:mapsToStatus': '流程节点映射业务状态',
  'eiscore:linkedApp': '流程关联应用',
  'ontology:semanticProjection': '权限语义投影',
  'ontology:dependsOn': '业务依赖关系',
  'ontology:transitivelyDependsOn': '传递依赖',
  'ontology:belongsTo': '字段属于表',
  'ontology:hasDomain': '所属业务域',
  'app:usesTable': '应用使用业务表',
  'acl:requiresPermission': '需要权限',
  'acl:canAccessApp': '可访问应用',
  'acl:canOperateAppAction': '可执行应用动作',
  'acl:canAccessTable': '可访问业务表',
  'acl:canOperateTable': '可操作业务表',
  'wf:canPerformTransition': '可执行流程迁移',
  'data:hasSensitiveColumn': '包含敏感字段',
  'risk:canAccessSensitiveColumn': '可达敏感字段',
  'rdf:type': '类型'
}

const KG_NODE_TYPE_LABELS = {
  role: '角色',
  app: '应用',
  app_action: '应用动作',
  table: '表',
  column: '字段',
  permission: '权限',
  permission_kind: '权限类型',
  semantic_class: '语义类',
  semantic_domain: '语义域'
}

export const ONTOLOGY_KG_GRAPH_CATEGORIES = [
  { name: '角色' },
  { name: '应用' },
  { name: '业务表' },
  { name: '字段' },
  { name: '权限' },
  { name: '其他' }
]

const KG_GRAPH_CATEGORY_BY_TYPE = {
  role: '角色',
  app: '应用',
  app_action: '应用',
  table: '业务表',
  column: '字段',
  permission: '权限'
}

export const ONTOLOGY_KG_GRAPH_NODE_COLORS = {
  role: '#5b6ee1',
  app: '#009688',
  app_action: '#26a69a',
  table: '#3f8cff',
  column: '#d66b9d',
  permission: '#f0a020',
  permission_kind: '#b98b00',
  semantic_class: '#8e6bd6',
  semantic_domain: '#607d8b'
}

export const getOntologyPredicateLabel = (value) => PREDICATE_LABELS[value] || value || '-'

export const getOntologyKgNodeTypeLabel = (value) => KG_NODE_TYPE_LABELS[value] || value || '-'

export const getOntologyKgNodeKey = (type, id) => `${type || 'unknown'}:${id || ''}`

export const getOntologyKgGraphCategory = (type) => KG_GRAPH_CATEGORY_BY_TYPE[type] || '其他'

export const getOntologyKgGraphNodeSize = (node) => {
  if (node?.node_type === 'role') return 44
  if (node?.node_type === 'app') return 38
  if (node?.node_type === 'table') return 36
  if (node?.node_type === 'column') return node?.is_sensitive ? 34 : 28
  return 30
}

export const addOntologyKgGraphNode = (map, type, id, label, extra = {}) => {
  if (!type || !id) return null
  const key = getOntologyKgNodeKey(type, id)
  const existing = map.get(key) || {}
  const next = {
    id: key,
    name: label || existing.name || id,
    rawType: type,
    rawId: id,
    category: getOntologyKgGraphCategory(type),
    symbolSize: Math.max(existing.symbolSize || 0, getOntologyKgGraphNodeSize({ node_type: type, ...extra })),
    itemStyle: {
      color: extra.is_sensitive ? '#d9475f' : (ONTOLOGY_KG_GRAPH_NODE_COLORS[type] || '#607d8b')
    },
    label: {
      show: true,
      formatter: (value) => {
        const name = String(value?.data?.name || '')
        return name.length > 18 ? `${name.slice(0, 17)}...` : name
      }
    },
    tooltip: {
      formatter: `${getOntologyKgNodeTypeLabel(type)}:${id}<br/>${label || id}`
    },
    ...existing,
    ...extra
  }
  map.set(key, next)
  return next
}

export const getOntologyKgEdgeKey = (edge) => {
  if (edge?.edge_id != null) return `edge:${edge.edge_id}`
  if (edge?.id != null) return `edge:${edge.id}`
  return `${edge.source}|${edge.predicate}|${edge.target}`
}

export const buildOntologyKgGraphPayload = ({ selectedNode, neighbors = [], pathRows = [] } = {}) => {
  const nodes = new Map()
  const links = new Map()

  if (selectedNode?.node_type && selectedNode?.node_id) {
    addOntologyKgGraphNode(nodes, selectedNode.node_type, selectedNode.node_id, selectedNode.node_label, {
      is_sensitive: selectedNode.is_sensitive,
      symbolSize: 50,
      total_degree: selectedNode.total_degree || selectedNode.degree_total || 0
    })
  }

  const addLink = ({
    sourceType,
    sourceId,
    sourceLabel,
    targetType,
    targetId,
    targetLabel,
    predicate,
    edgeId,
    inferenceRule,
    ruleName,
    isInferred,
    confidence,
    evidence
  }) => {
    if (!sourceType || !sourceId || !targetType || !targetId) return
    const sourceNode = addOntologyKgGraphNode(nodes, sourceType, sourceId, sourceLabel)
    const targetNode = addOntologyKgGraphNode(nodes, targetType, targetId, targetLabel)
    if (!sourceNode || !targetNode) return
    const edge = {
      edge_id: edgeId,
      source: sourceNode.id,
      target: targetNode.id,
      predicate: predicate || '',
      label: {
        show: false,
        formatter: getOntologyPredicateLabel(predicate)
      },
      lineStyle: {
        width: isInferred === false ? 1.2 : 1.8,
        opacity: 0.72,
        type: isInferred === false ? 'dashed' : 'solid',
        color: isInferred === false ? '#9aa6b2' : '#5b8def'
      },
      raw: {
        from: sourceNode.id,
        to: targetNode.id,
        predicate,
        edge_id: edgeId,
        inference_rule: inferenceRule,
        rule_name: ruleName,
        is_inferred: isInferred,
        confidence,
        evidence
      }
    }
    links.set(getOntologyKgEdgeKey(edge), edge)
  }

  ;(Array.isArray(neighbors) ? neighbors : []).forEach((row) => {
    addLink({
      sourceType: row.edge_subject_type || row.from_type,
      sourceId: row.edge_subject_id || row.from_id,
      sourceLabel: row.edge_subject_type === row.from_type ? row.from_label : '',
      targetType: row.edge_object_type || row.to_type,
      targetId: row.edge_object_id || row.to_id,
      targetLabel: row.edge_object_type === row.to_type ? row.to_label : '',
      predicate: row.predicate,
      edgeId: row.edge_id,
      inferenceRule: row.inference_rule,
      ruleName: row.rule_name,
      isInferred: row.is_inferred,
      confidence: row.confidence,
      evidence: row.evidence
    })
  })

  ;(Array.isArray(pathRows) ? pathRows : []).forEach((row) => {
    addOntologyKgGraphNode(nodes, row.target_type, row.target_id, row.target_label)
    const facts = Array.isArray(row.path_facts) ? row.path_facts : []
    facts.forEach((fact) => {
      addLink({
        sourceType: fact.subject_type,
        sourceId: fact.subject_id,
        targetType: fact.object_type,
        targetId: fact.object_id,
        predicate: fact.predicate,
        edgeId: fact.id,
        inferenceRule: fact.rule,
        ruleName: fact.rule,
        isInferred: fact.inferred,
        confidence: fact.confidence,
        evidence: fact.evidence
      })
    })
  })

  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values()),
    stats: { nodes: nodes.size, links: links.size }
  }
}

export const buildOntologyKgSelectedMetrics = (node = {}) => [
  { key: 'degree', label: '总度数', value: node.total_degree || node.degree_total || 0 },
  { key: 'out', label: '出边', value: node.outgoing_edges || 0 },
  { key: 'in', label: '入边', value: node.incoming_edges || 0 },
  { key: 'predicates', label: '谓词', value: node.predicate_count || 0 }
]

export const buildOntologyWorkbenchViews = ({
  graphRelationsCount = 0,
  selectedTable = '',
  reasoningSummary = {},
  graphStats = {},
  selectedEdge = null,
  reasoningHealth = {}
} = {}) => {
  const insightAttention = reasoningHealth.is_healthy === false
    ? 'critical'
    : reasoningHealth.health_code && reasoningHealth.health_code !== 'healthy'
      ? 'warning'
      : 'normal'
  return [
    {
      key: 'relations',
      title: '关系图谱',
      desc: '表关系 / 列语义 / 明细',
      metric: `${graphRelationsCount} 条`,
      attention: selectedTable ? 'focus' : 'normal'
    },
    {
      key: 'reasoning',
      title: '推理引擎',
      desc: '事实 / 规则 / 路径解释',
      metric: `${reasoningSummary.facts_total || 0} facts`,
      attention: reasoningSummary.last_run_status === 'completed' ? 'normal' : 'warning'
    },
    {
      key: 'kg',
      title: 'KG 查询',
      desc: '节点 / 邻域 / 子图证据',
      metric: `${graphStats.nodes || 0}/${graphStats.links || 0}`,
      attention: selectedEdge ? 'focus' : 'normal'
    },
    {
      key: 'insight',
      title: '洞察审计',
      desc: '风险 / 影响 / 敏感路径',
      metric: reasoningHealth.health_code || 'unknown',
      attention: insightAttention
    }
  ]
}

export const getOntologyActiveWorkbenchMeta = (views, activeKey) => {
  const list = Array.isArray(views) ? views : []
  return list.find((item) => item.key === activeKey) || list[0]
}

export const formatOntologyKgEvidenceValue = (value) => {
  if (value == null) return '-'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (!text) return '-'
  return text.length > 180 ? `${text.slice(0, 177)}...` : text
}

export const buildOntologyKgEvidenceRows = (evidence) => {
  if (!evidence || typeof evidence !== 'object') return []
  if (Array.isArray(evidence)) {
    return evidence.slice(0, 8).map((item, index) => ({
      key: `item_${index + 1}`,
      value: formatOntologyKgEvidenceValue(item)
    }))
  }
  return Object.entries(evidence).slice(0, 8).map(([key, value]) => ({
    key,
    value: formatOntologyKgEvidenceValue(value)
  }))
}

export const formatOntologyKgTooltip = (params = {}) => {
  if (params.dataType === 'edge') {
    const raw = params.data?.raw || {}
    return [
      `${raw.from || ''} -> ${raw.to || ''}`,
      getOntologyPredicateLabel(raw.predicate),
      raw.rule_name || raw.inference_rule || ''
    ].filter(Boolean).join('<br/>')
  }
  const data = params.data || {}
  return [
    `${getOntologyKgNodeTypeLabel(data.rawType)}:${data.rawId}`,
    data.name
  ].filter(Boolean).join('<br/>')
}
