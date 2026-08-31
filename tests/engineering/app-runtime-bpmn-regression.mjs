// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PASSTHROUGH_NODE_TYPE_SET,
  TASK_NODE_TYPE_SET,
  decodeHtmlEntitiesDeep,
  ensureBpmnDiagramXml,
  normalizeBpmnXml,
  parseBpmnGraph,
  parseBpmnTaskNameMap,
  resolveFirstUserTaskId
} from '../../eiscore-apps/src/domain/app-runtime-bpmn.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(normalizeBpmnXml(''), '')
assert.equal(normalizeBpmnXml('\uFEFFline1\\r\\nline2\\tvalue\\r'), 'line1\nline2\tvalue\r')
assert.equal(decodeHtmlEntitiesDeep('A &amp;quot;B&amp;quot; &#x4E2D;&#25991; &bad;'), 'A "B" 中文 &bad;')
assert.equal(decodeHtmlEntitiesDeep('&#0; &#x110000;'), '&#0; &#x110000;')

const processXml = [
  '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">',
  '  <bpmn:process id="Process:Main">',
  '    <bpmn:startEvent id="StartEvent_1" name="开始 &amp;quot;流程&amp;quot;" />',
  '    <bpmn:userTask id="Task_Submit" />',
  '    <bpmn:userTask id="Task:Review" name="审批 &#x4E2D;&#25991;" />',
  '    <bpmn:exclusiveGateway id="Gateway_1" name="判断" />',
  '    <bpmn:endEvent id="EndEvent_1" name="结束" />',
  '    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_Submit" />',
  '    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Submit" targetRef="Task:Review" />',
  '    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task:Review" targetRef="Gateway_1" />',
  '    <bpmn:sequenceFlow id="Flow_4" sourceRef="Gateway_1" targetRef="EndEvent_1" />',
  '  </bpmn:process>',
  '</bpmn:definitions>'
].join('\\n')

const taskNames = parseBpmnTaskNameMap(processXml)
assert.equal(taskNames.Task_Submit, '提交入职资料')
assert.equal(taskNames['Task:Review'], '审批 中文')
assert.equal(taskNames.StartEvent_1, '开始 "流程"')
assert.equal(taskNames.Gateway_1, '判断')
assert.equal(taskNames.EndEvent_1, '结束')
assert.equal(parseBpmnTaskNameMap('').Task_HRReview, 'HR初审')

assert.deepEqual(parseBpmnGraph(processXml), {
  nodeTypeMap: {
    'Process:Main': 'bpmn:process',
    StartEvent_1: 'bpmn:startEvent',
    Task_Submit: 'bpmn:userTask',
    'Task:Review': 'bpmn:userTask',
    Gateway_1: 'bpmn:exclusiveGateway',
    EndEvent_1: 'bpmn:endEvent',
    Flow_1: 'bpmn:sequenceFlow',
    Flow_2: 'bpmn:sequenceFlow',
    Flow_3: 'bpmn:sequenceFlow',
    Flow_4: 'bpmn:sequenceFlow'
  },
  outgoingMap: {
    StartEvent_1: ['Task_Submit'],
    Task_Submit: ['Task:Review'],
    'Task:Review': ['Gateway_1'],
    Gateway_1: ['EndEvent_1']
  }
})
assert.deepEqual(parseBpmnGraph(''), { nodeTypeMap: {}, outgoingMap: {} })

const diagramXml = ensureBpmnDiagramXml(processXml)
for (const namespace of ['xmlns:bpmndi=', 'xmlns:dc=', 'xmlns:di=']) {
  assert.match(diagramXml, new RegExp(namespace))
}
assert.match(diagramXml, /<bpmndi:BPMNDiagram id="BPMNDiagram_Process_Main">/)
assert.match(diagramXml, /<bpmndi:BPMNPlane id="BPMNPlane_Process_Main" bpmnElement="Process:Main">/)
assert.match(diagramXml, /<bpmndi:BPMNShape id="Shape_StartEvent_1" bpmnElement="StartEvent_1">\s*<dc:Bounds x="120" y="210" width="36" height="36" \/>/)
assert.match(diagramXml, /<bpmndi:BPMNShape id="Shape_Task_Submit" bpmnElement="Task_Submit">\s*<dc:Bounds x="310" y="188" width="140" height="80" \/>/)
assert.match(diagramXml, /<bpmndi:BPMNShape id="Shape_Task_Review" bpmnElement="Task:Review">/)
assert.match(diagramXml, /<bpmndi:BPMNEdge id="Edge_Flow_1" bpmnElement="Flow_1">\s*<di:waypoint x="156" y="228" \/>\s*<di:waypoint x="310" y="228" \/>/)
assert.equal((diagramXml.match(/<bpmndi:BPMNShape/g) || []).length, 5)
assert.equal((diagramXml.match(/<bpmndi:BPMNEdge/g) || []).length, 4)

const existingDiagram = '<bpmn:definitions><bpmndi:BPMNDiagram id="D" /></bpmn:definitions>'
assert.equal(ensureBpmnDiagramXml(`  ${existingDiagram}  `), existingDiagram)
assert.equal(ensureBpmnDiagramXml('not-bpmn'), 'not-bpmn')
const noNodes = ensureBpmnDiagramXml('<bpmn:definitions><bpmn:process id="P" /></bpmn:definitions>')
assert.match(noNodes, /xmlns:bpmndi=/)
assert.equal(noNodes.includes('<bpmndi:BPMNDiagram'), false)

assert.equal(resolveFirstUserTaskId(processXml), 'Task_Submit')
assert.equal(resolveFirstUserTaskId('<bpmn:startEvent id="OnlyStart" />'), 'OnlyStart')
assert.equal(resolveFirstUserTaskId('<bpmn:task id="Generic" />'), '')
assert.equal(TASK_NODE_TYPE_SET.has('bpmn:userTask'), true)
assert.equal(TASK_NODE_TYPE_SET.has('bpmn:exclusiveGateway'), false)
assert.equal(PASSTHROUGH_NODE_TYPE_SET.has('bpmn:exclusiveGateway'), true)
assert.equal(PASSTHROUGH_NODE_TYPE_SET.has('bpmn:endEvent'), false)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/app-runtime-bpmn.mjs'), 'utf8')
for (const forbidden of ['from \'vue\'', 'axios', 'window.', 'document.', 'localStorage']) {
  assert.equal(moduleSource.includes(forbidden), false, `BPMN policy gained runtime dependency: ${forbidden}`)
}

const runtimeSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/AppRuntime.vue'), 'utf8')
assert.match(runtimeSource, /from ['"]@\/domain\/app-runtime-bpmn\.mjs['"]/)
for (const removedDefinition of [
  'const normalizeBpmnXml =',
  'const parseBpmnTaskNameMap =',
  'const ensureBpmnDiagramXml =',
  'const parseBpmnGraph =',
  'const resolveFirstUserTaskId ='
]) {
  assert.equal(runtimeSource.includes(removedDefinition), false, `AppRuntime reintroduced ${removedDefinition}`)
}
assert.equal(runtimeSource.split(/\r?\n/).length, 4654)

console.log('PASS: AppRuntime BPMN policy preserves normalization, labels, graph, diagram repair and first-task fallback')
