// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const normalizeBpmnXml = (raw) => {
  const text = String(raw || '')
  if (!text) return ''
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
}

const builtinTaskNameMap = Object.freeze({
  Task_Submit: '提交入职资料',
  Task_HRReview: 'HR初审',
  Task_ManagerReview: '部门确认',
  Task_AccountProvision: '开通账号与建档',
  StartEvent_1: '开始',
  EndEvent_1: '结束'
})

const decodeHtmlEntitiesOnce = (value) => {
  const text = String(value || '')
  if (!text) return ''
  const namedMap = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (full, token) => {
    if (!token) return full
    if (token[0] === '#') {
      const isHex = token[1] === 'x' || token[1] === 'X'
      const numText = isHex ? token.slice(2) : token.slice(1)
      const codePoint = parseInt(numText, isHex ? 16 : 10)
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return full
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return full
      }
    }
    return Object.prototype.hasOwnProperty.call(namedMap, token) ? namedMap[token] : full
  })
}

export const decodeHtmlEntitiesDeep = (value) => {
  let text = String(value || '')
  if (!text) return ''
  for (let i = 0; i < 4; i += 1) {
    const next = decodeHtmlEntitiesOnce(text)
    if (next === text) break
    text = next
  }
  return text
}

export const parseBpmnTaskNameMap = (xmlRaw) => {
  const xml = normalizeBpmnXml(xmlRaw)
  const map = { ...builtinTaskNameMap }
  if (!xml) return map

  const regex = /<bpmn:(?:startEvent|endEvent|userTask|task|serviceTask|manualTask|scriptTask|receiveTask|sendTask|callActivity|exclusiveGateway|parallelGateway|inclusiveGateway)\b[^>]*>/gi
  let match = regex.exec(xml)
  while (match) {
    const tag = String(match[0] || '')
    const idMatch = tag.match(/\bid="([^"]+)"/i)
    const nameMatch = tag.match(/\bname="([^"]+)"/i)
    const id = String(idMatch?.[1] || '').trim()
    const name = decodeHtmlEntitiesDeep(String(nameMatch?.[1] || '').trim())
    if (id && name) map[id] = name
    match = regex.exec(xml)
  }
  return map
}

export const TASK_NODE_TYPE_SET = new Set([
  'bpmn:userTask',
  'bpmn:task',
  'bpmn:serviceTask',
  'bpmn:manualTask',
  'bpmn:scriptTask',
  'bpmn:receiveTask',
  'bpmn:sendTask',
  'bpmn:callActivity'
])

export const PASSTHROUGH_NODE_TYPE_SET = new Set([
  'bpmn:startEvent',
  'bpmn:exclusiveGateway',
  'bpmn:parallelGateway',
  'bpmn:inclusiveGateway',
  'bpmn:intermediateThrowEvent',
  'bpmn:intermediateCatchEvent'
])

const DIAGRAM_NODE_TYPE_SET = new Set([
  'startEvent',
  'endEvent',
  'userTask',
  'task',
  'serviceTask',
  'manualTask',
  'scriptTask',
  'receiveTask',
  'sendTask',
  'callActivity',
  'exclusiveGateway',
  'parallelGateway',
  'inclusiveGateway',
  'intermediateThrowEvent',
  'intermediateCatchEvent'
])

const sanitizeBpmnDiId = (value, fallback = 'Element') => {
  const text = String(value || '').trim().replace(/[^A-Za-z0-9_.-]/g, '_')
  return text || fallback
}

const getTagAttribute = (tag, name) => {
  const pattern = new RegExp(`\\b${name}="([^"]*)"`, 'i')
  return String(tag || '').match(pattern)?.[1] || ''
}

const getDiagramNodeBounds = (nodeType, index) => {
  const compactTypes = new Set([
    'startEvent',
    'endEvent',
    'intermediateThrowEvent',
    'intermediateCatchEvent'
  ])
  const gatewayTypes = new Set(['exclusiveGateway', 'parallelGateway', 'inclusiveGateway'])
  const x = 120 + index * 190
  if (compactTypes.has(nodeType)) return { x, y: 210, width: 36, height: 36 }
  if (gatewayTypes.has(nodeType)) return { x, y: 203, width: 50, height: 50 }
  return { x, y: 188, width: 140, height: 80 }
}

export const ensureBpmnDiagramXml = (raw) => {
  let xml = normalizeBpmnXml(raw).trim()
  if (!xml || /<bpmndi:BPMNDiagram\b/i.test(xml)) return xml

  const definitionTag = xml.match(/<bpmn:definitions\b[^>]*>/i)?.[0] || ''
  const processId = getTagAttribute(xml.match(/<bpmn:process\b[^>]*>/i)?.[0] || '', 'id') || 'Process_1'
  if (!definitionTag || !processId || !/<\/bpmn:definitions>\s*$/i.test(xml)) return xml

  const namespaces = [
    ['xmlns:bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI'],
    ['xmlns:dc', 'http://www.omg.org/spec/DD/20100524/DC'],
    ['xmlns:di', 'http://www.omg.org/spec/DD/20100524/DI']
  ]
  let nextDefinitionTag = definitionTag
  namespaces.forEach(([name, value]) => {
    const hasNamespace = new RegExp(`\\b${name}=`, 'i').test(nextDefinitionTag)
    if (!hasNamespace) {
      nextDefinitionTag = nextDefinitionTag.replace(/>$/, ` ${name}="${value}">`)
    }
  })
  xml = xml.replace(definitionTag, nextDefinitionTag)

  const nodes = []
  const nodeRegex = /<bpmn:([a-zA-Z0-9]+)\b[^>]*\bid="([^"]+)"/g
  let nodeMatch = nodeRegex.exec(xml)
  while (nodeMatch) {
    const type = String(nodeMatch[1] || '').trim()
    const id = String(nodeMatch[2] || '').trim()
    if (id && DIAGRAM_NODE_TYPE_SET.has(type)) {
      nodes.push({ id, type })
    }
    nodeMatch = nodeRegex.exec(xml)
  }
  if (!nodes.length) return xml

  const flows = []
  const flowRegex = /<bpmn:sequenceFlow\b[^>]*>/g
  let flowMatch = flowRegex.exec(xml)
  while (flowMatch) {
    const tag = flowMatch[0] || ''
    const id = getTagAttribute(tag, 'id')
    const sourceRef = getTagAttribute(tag, 'sourceRef')
    const targetRef = getTagAttribute(tag, 'targetRef')
    if (id && sourceRef && targetRef) flows.push({ id, sourceRef, targetRef })
    flowMatch = flowRegex.exec(xml)
  }

  const incomingSet = new Set(flows.map((item) => item.targetRef))
  const outgoingMap = {}
  flows.forEach((item) => {
    if (!outgoingMap[item.sourceRef]) outgoingMap[item.sourceRef] = []
    outgoingMap[item.sourceRef].push(item.targetRef)
  })

  const nodeMap = Object.fromEntries(nodes.map((item) => [item.id, item]))
  const orderedIds = []
  const visited = new Set()
  const startIds = nodes
    .filter((item) => item.type === 'startEvent' || !incomingSet.has(item.id))
    .map((item) => item.id)
  const queue = startIds.length ? [...startIds] : [nodes[0].id]
  while (queue.length) {
    const id = queue.shift()
    if (!id || visited.has(id) || !nodeMap[id]) continue
    visited.add(id)
    orderedIds.push(id)
    ;(outgoingMap[id] || []).forEach((targetId) => queue.push(targetId))
  }
  nodes.forEach((item) => {
    if (!visited.has(item.id)) orderedIds.push(item.id)
  })

  const boundsMap = {}
  const shapeXml = orderedIds.map((id, index) => {
    const node = nodeMap[id]
    const bounds = getDiagramNodeBounds(node?.type, index)
    boundsMap[id] = bounds
    const shapeId = sanitizeBpmnDiId(`Shape_${id}`)
    return [
      `      <bpmndi:BPMNShape id="${shapeId}" bpmnElement="${id}">`,
      `        <dc:Bounds x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" />`,
      '      </bpmndi:BPMNShape>'
    ].join('\n')
  }).join('\n')

  const edgeXml = flows.map((flow) => {
    const source = boundsMap[flow.sourceRef]
    const target = boundsMap[flow.targetRef]
    if (!source || !target) return ''
    const sourceX = source.x + source.width
    const sourceY = source.y + source.height / 2
    const targetX = target.x
    const targetY = target.y + target.height / 2
    const edgeId = sanitizeBpmnDiId(`Edge_${flow.id}`)
    return [
      `      <bpmndi:BPMNEdge id="${edgeId}" bpmnElement="${flow.id}">`,
      `        <di:waypoint x="${sourceX}" y="${sourceY}" />`,
      `        <di:waypoint x="${targetX}" y="${targetY}" />`,
      '      </bpmndi:BPMNEdge>'
    ].join('\n')
  }).filter(Boolean).join('\n')

  const diagramXml = [
    `  <bpmndi:BPMNDiagram id="${sanitizeBpmnDiId(`BPMNDiagram_${processId}`)}">`,
    `    <bpmndi:BPMNPlane id="${sanitizeBpmnDiId(`BPMNPlane_${processId}`)}" bpmnElement="${processId}">`,
    shapeXml,
    edgeXml,
    '    </bpmndi:BPMNPlane>',
    '  </bpmndi:BPMNDiagram>'
  ].filter(Boolean).join('\n')

  return xml.replace(/<\/bpmn:definitions>\s*$/i, `${diagramXml}\n</bpmn:definitions>`)
}

export const parseBpmnGraph = (xmlRaw) => {
  const xml = normalizeBpmnXml(xmlRaw)
  const nodeTypeMap = {}
  const outgoingMap = {}
  if (!xml) return { nodeTypeMap, outgoingMap }

  const nodeRegex = /<bpmn:([a-zA-Z0-9]+)\b[^>]*\bid="([^"]+)"/g
  let nodeMatch = nodeRegex.exec(xml)
  while (nodeMatch) {
    const type = String(nodeMatch[1] || '').trim()
    const id = String(nodeMatch[2] || '').trim()
    if (type && id) {
      nodeTypeMap[id] = `bpmn:${type}`
    }
    nodeMatch = nodeRegex.exec(xml)
  }

  const flowTagRegex = /<bpmn:sequenceFlow\b[^>]*>/g
  let flowTagMatch = flowTagRegex.exec(xml)
  while (flowTagMatch) {
    const tag = String(flowTagMatch[0] || '')
    const sourceRef = String(tag.match(/\bsourceRef="([^"]+)"/i)?.[1] || '').trim()
    const targetRef = String(tag.match(/\btargetRef="([^"]+)"/i)?.[1] || '').trim()
    if (sourceRef && targetRef) {
      if (!Array.isArray(outgoingMap[sourceRef])) outgoingMap[sourceRef] = []
      outgoingMap[sourceRef].push(targetRef)
    }
    flowTagMatch = flowTagRegex.exec(xml)
  }

  return { nodeTypeMap, outgoingMap }
}

export const resolveNextBpmnTaskCandidates = ({ taskId, graph, maxSteps = 300 } = {}) => {
  const current = String(taskId || '').trim()
  if (!current) return []
  const nodeTypeMap = graph?.nodeTypeMap || {}
  const outgoingMap = graph?.outgoingMap || {}
  const firstTargets = Array.isArray(outgoingMap[current]) ? outgoingMap[current] : []
  if (!firstTargets.length) return []

  const queue = [...firstTargets]
  const visited = new Set([current])
  const candidates = []
  let steps = 0
  const limit = Number.isFinite(maxSteps) ? Math.max(0, Math.floor(maxSteps)) : 300
  while (queue.length && steps < limit) {
    steps += 1
    const nodeId = String(queue.shift() || '').trim()
    if (!nodeId || visited.has(nodeId)) continue
    visited.add(nodeId)

    const nodeType = String(nodeTypeMap[nodeId] || '').trim()
    if (TASK_NODE_TYPE_SET.has(nodeType)) {
      candidates.push(nodeId)
      continue
    }
    if (nodeType === 'bpmn:endEvent') continue
    if (!nodeType || PASSTHROUGH_NODE_TYPE_SET.has(nodeType)) {
      const nextTargets = Array.isArray(outgoingMap[nodeId]) ? outgoingMap[nodeId] : []
      nextTargets.forEach((nextId) => queue.push(nextId))
    }
  }
  return Array.from(new Set(candidates))
}

export const resolveFirstUserTaskId = (xml = '') => {
  const text = normalizeBpmnXml(xml)
  if (!text) return ''
  const userTask = text.match(/<bpmn:userTask\b[^>]*\bid="([^"]+)"/i)
  if (userTask?.[1]) return userTask[1]
  const startEvent = text.match(/<bpmn:startEvent\b[^>]*\bid="([^"]+)"/i)
  return startEvent?.[1] || ''
}
