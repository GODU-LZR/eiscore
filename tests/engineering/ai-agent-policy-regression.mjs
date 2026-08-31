// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const policy = require('../../realtime/ai-agent-policy')
const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(policy.normalizeAiText([' first ', { text: 'second' }, null]), 'first \nsecond')
assert.equal(policy.extractAiContentText([{ output_text: 'one' }, { content: 'two' }]), 'one\ntwo')
assert.equal(policy.normalizeMessageContent('x'.repeat(11000)).length, 10000)
assert.deepEqual(policy.normalizeMessageContent([
  { type: 'text', text: ' hello ' },
  { type: 'image_url', image_url: { url: ' https://img.example/a.png ' } },
  { type: 'audio', url: 'drop' }
]), [
  { type: 'text', text: 'hello' },
  { type: 'image_url', image_url: { url: 'https://img.example/a.png' } }
])

const messages = policy.sanitizeConversationMessages([
  { role: 'system', content: 'untrusted system' },
  { role: 'tool', content: 'untrusted tool' },
  ...Array.from({ length: 26 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'USER',
    content: `message-${index}`
  })),
  { role: 'user', content: [{ type: 'text', text: 'latest text' }, { type: 'image_url', url: 'data:image/png;base64,x' }] }
])
assert.equal(messages.length, 24)
assert.equal(messages[0].content, 'message-3')
assert.equal(messages.at(-1).role, 'user')
assert.equal(policy.extractLatestUserText(messages), 'latest text')

assert.equal(policy.detectIntent('请做入职审批表单', {}), 'workflow')
assert.equal(policy.detectIntent('创建数据录入表单', {}), 'form')
assert.equal(policy.detectIntent('分析销售趋势', {}), 'enterprise_report')
assert.equal(policy.detectIntent('查看库存批次', {}), 'materials_ops')
assert.equal(policy.detectIntent('你好', { aiScene: 'workflow-designer' }), 'workflow')
assert.equal(policy.detectIntent('你好', {}), 'general')

assert.deepEqual(policy.normalizeToolsWhitelist(' ECharts,echarts, MAP-Locate '), ['echarts', 'map-locate'])
assert.deepEqual(policy.resolveAgentRuntimeConfig({}, 'enterprise_analyst'), {
  id: 'enterprise_analyst',
  label: '企业经营分析智能体',
  model: 'glm-4.6v',
  temperature: 0.2,
  top_p: 0.8,
  max_tokens: 4096,
  thinking: { type: 'enabled' },
  tools_whitelist: ['echarts']
})
const customRuntime = policy.resolveAgentRuntimeConfig({
  model: 'global-model',
  thinking: { type: 'disabled' },
  agent_profiles: {
    worker_assistant: {
      model: 'worker-model',
      temperature: 1.2,
      topP: 0.5,
      maxTokens: 8192,
      allowed_tools: ['Translate', 'translate', 'custom']
    }
  }
}, 'worker_assistant')
assert.deepEqual(customRuntime, {
  id: 'worker_assistant',
  label: '企业工作助手智能体',
  model: 'worker-model',
  temperature: 1.2,
  top_p: 0.5,
  max_tokens: 8192,
  thinking: { type: 'disabled' },
  tools_whitelist: ['translate', 'custom']
})
assert.equal(policy.resolveAgentRuntimeConfig({ agents: { enterprise_analyst: { temperature: 9, top_p: -1, max_tokens: 0 } } }, 'enterprise_analyst').temperature, 0.2)

const regularCatalog = policy.buildAgentCatalog({ role: 'operator', permissions: [] }, {})
assert.deepEqual(regularCatalog.map((item) => [item.id, item.enabled]), [
  ['enterprise_analyst', true],
  ['worker_assistant', true],
  ['workflow_orchestrator', false]
])
assert.equal(policy.buildAgentCatalog({ role: 'operator', permissions: ['workflow:design'] }, {})[2].enabled, true)

const operatorRoute = policy.resolveAgentRoute({
  user: { role: 'operator', permissions: [] },
  body: {},
  messages: [{ role: 'user', content: '普通问题' }]
})
assert.deepEqual(operatorRoute, {
  requestedMode: 'worker',
  intent: 'general',
  agentId: 'worker_assistant',
  context: {},
  latestUserText: '普通问题'
})
assert.equal(policy.resolveAgentRoute({
  user: { role: 'admin' },
  body: {},
  messages: [{ role: 'user', content: '设计采购审批流程' }]
}).agentId, 'workflow_orchestrator')
assert.equal(policy.resolveAgentRoute({
  user: { role: 'operator', permissions: [] },
  body: { mode: 'workflow' },
  messages: [{ role: 'user', content: '继续' }]
}).agentId, 'enterprise_analyst')
const smartBiRoute = policy.resolveAgentRoute({
  user: { role: 'worker' },
  body: { mode: 'worker', context: { smartBi: { reportMode: 'manual_question' } } },
  messages: [{ role: 'user', content: '库存风险' }]
})
assert.equal(smartBiRoute.agentId, 'enterprise_analyst')
assert.equal(smartBiRoute.context.smartBi.reportMode, 'manual_question')

const compact = policy.compactAiContextForPrompt({
  app: 'sales',
  secret: 'drop',
  columns: Array.from({ length: 90 }, (_, index) => ({ label: `L${index}`, prop: `p${index}`, extra: 'drop' })),
  dataSample: Array.from({ length: 20 }, (_, index) => ({ id: index })),
  fileColumns: Array.from({ length: 30 }, (_, index) => ({ label: `F${index}`, prop: `f${index}` })),
  importRequiredFields: ['name']
})
assert.equal(compact.app, 'sales')
assert.equal('secret' in compact, false)
assert.equal(compact.columns.length, 80)
assert.deepEqual(compact.columns[0], { label: 'L0', prop: 'p0', type: 'text', expression: '' })
assert.equal(compact.dataSample.length, 12)
assert.equal(compact.fileColumns.length, 20)

assert.deepEqual(policy.resolveSmartBiQuestionRoute('看看销售订单和回款'), {
  key: 'sales',
  label: '销售',
  matchedKeywords: ['销售', '订单', '回款'],
  confidence: 'high'
})
assert.equal(policy.resolveSmartBiQuestionRoute('总体情况').key, 'overview')
assert.equal(policy.getSmartBiMetricDefinitions('quality').length, 3)
assert.equal(policy.getSmartBiMetricDefinitions('overview').length, 18)
const smartBiBlock = policy.buildSmartBiPromptBlock({
  reportMode: 'workbench_card',
  selectedCard: { label: '库存卡', metricValue: '100', riskLevel: 'warning' },
  snapshotExcerpt: 'snapshot-data'
}, '库存风险')
assert.match(smartBiBlock, /当前问题路由：库存/)
assert.match(smartBiBlock, /当前智能 BI 指标卡/)
assert.match(smartBiBlock, /snapshot-data/)
assert.match(smartBiBlock, /关键指标、指标图表、风险提醒、行动建议/)

const gridBlock = policy.buildGridAgentRuleBlock({
  gridAgent: {
    dataAccess: { loadedCount: 25, hasMore: true },
    capabilities: { serverAgentQuery: true, serverSummary: false, serverFormulaRecalculate: true },
    serverTools: [{ name: 'count' }]
  },
  gridAgentServerResult: { scope: 'server', totalCount: 100 }
})
assert.match(gridBlock, /当前已加载 25 行/)
assert.match(gridBlock, /serverAgentQuery=可用/)
assert.match(gridBlock, /工具：count/)
assert.match(gridBlock, /scope=server/)
assert.equal(policy.buildGridAgentRuleBlock({}), '')

const sharedContext = {
  app: 'inventory',
  injectBusinessData: true,
  businessSnapshot: { snapshotTime: '2026-08-31', inventory: { total: 100 } },
  semanticContext: {
    fetchedAt: '2026-08-31',
    tables: [{ schema: 'scm', table: 'inventory', name: '库存', desc: '实时库存' }],
    columns: { 'scm.inventory': [{ col: 'qty', name: '数量', cls: 'measure' }] },
    relations: [{ from: 'scm.inventory', fromName: '库存', predicate: 'belongs_to', to: 'public.materials', toName: '物料' }],
    permissions: [{ code: 'inventory.read', kind: 'module', entity: 'inventory', action: 'read' }]
  },
  smartBi: { reportMode: 'manual_question' }
}
const enterprisePrompt = policy.buildAgentSystemPrompt({
  agentId: 'enterprise_analyst',
  context: sharedContext,
  user: { role: 'manager' },
  intent: 'enterprise_report',
  latestUserText: '库存风险'
})
assert.match(enterprisePrompt, /^你是企业经营分析智能体/)
assert.match(enterprisePrompt, /企业实时数据快照（2026-08-31）/)
assert.match(enterprisePrompt, /系统本体语义模型/)
assert.match(enterprisePrompt, /smart-bi-actions/)
assert.equal(enterprisePrompt.includes('"injectBusinessData"'), false)

const workflowPrompt = policy.buildAgentSystemPrompt({
  agentId: 'workflow_orchestrator',
  context: sharedContext,
  user: { role: 'admin' },
  intent: 'workflow',
  latestUserText: '审批'
})
assert.match(workflowPrompt, /^你是流程编排智能体/)
assert.match(workflowPrompt, /```bpmn-xml/)
assert.equal(workflowPrompt.includes('企业实时数据快照'), false)

const workerPrompt = policy.buildAgentSystemPrompt({
  agentId: 'worker_assistant',
  context: { importTarget: { apiUrl: '/rows' }, columns: [{ label: '姓名', prop: 'name' }] },
  user: { role: 'worker' },
  intent: 'form',
  latestUserText: '导入'
})
assert.match(workerPrompt, /^你是企业一线工作助手/)
assert.match(workerPrompt, /```data-import/)
assert.match(workerPrompt, /字段名优先使用.*columns.*prop/)

const composed = policy.composeAgentMessages({
  route: operatorRoute,
  user: { role: 'operator' },
  messages: [{ role: 'user', content: '普通问题' }]
})
assert.equal(composed[0].role, 'system')
assert.match(composed[0].content, /企业一线工作助手/)
assert.deepEqual(composed.slice(1), [{ role: 'user', content: '普通问题' }])

assert.equal(policy.extractCompletionText({ choices: [{ message: { content: [{ type: 'text', text: ' done ' }] } }] }), 'done')
assert.equal(policy.extractCompletionText({ output_text: ' output ' }), 'output')
assert.equal(policy.extractStreamDeltaText({ choices: [{ delta: { content: ' chunk ' } }] }), 'chunk')
assert.equal(policy.cleanModelText('```markdown\nresult\n```'), 'result')

const indexSource = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
const policySource = readFileSync(resolve(repoRoot, 'realtime/ai-agent-policy.js'), 'utf8')
assert.match(indexSource, /require\('\.\/ai-agent-policy'\)/)
for (const forbidden of [
  'const AGENT_RUNTIME_DEFAULTS =',
  'const buildAgentSystemPrompt =',
  'const resolveAgentRoute =',
  'const SMART_BI_DOMAINS ='
]) {
  assert.equal(indexSource.includes(forbidden), false, `composition root reintroduced ${forbidden}`)
}
assert.match(policySource, /const AGENT_RUNTIME_DEFAULTS =/)
assert.ok(indexSource.split(/\r?\n/).length <= 1611, 'realtime/index.js must not grow past the current composition baseline')

console.log('AI Agent policy regression passed')
