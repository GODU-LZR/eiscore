// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AI_SMART_BI_CLOSURE_WORKFLOW_NAME,
  buildAiSmartBiActionItemMap,
  extractAiSmartBiActions,
  getAiPreviousUserQuestion,
  getAiSmartBiDomainLabel,
  normalizeAiSmartBiAction,
  normalizeAiSmartBiActionDomain,
  normalizeAiSmartBiRiskLevel,
  resolveAiSmartBiActionDueAt,
  stripAiSmartBiReportBlocks
} from '../../eiscore-base/src/domain/ai-copilot-smart-bi-action-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
assert.equal(AI_SMART_BI_CLOSURE_WORKFLOW_NAME, '智能BI经营闭环流程')
assert.equal(normalizeAiSmartBiActionDomain('销售'), 'sales')
assert.equal(normalizeAiSmartBiActionDomain('IQC'), 'purchase')
assert.equal(normalizeAiSmartBiActionDomain('Custom'), 'custom')
assert.equal(normalizeAiSmartBiActionDomain(''), 'overview')
assert.equal(getAiSmartBiDomainLabel('overview'), '经营总览')
assert.equal(getAiSmartBiDomainLabel('quality'), '质量')
assert.equal(getAiSmartBiDomainLabel('custom'), 'custom')
assert.equal(getAiSmartBiDomainLabel(''), '经营')
for (const value of ['critical', 'serious', '严重', '高风险']) assert.equal(normalizeAiSmartBiRiskLevel(value), 'critical')
for (const value of ['warning', 'warn', '预警', '中']) assert.equal(normalizeAiSmartBiRiskLevel(value), 'warning')
for (const value of ['focus', '关注', '低风险']) assert.equal(normalizeAiSmartBiRiskLevel(value), 'focus')
assert.equal(normalizeAiSmartBiRiskLevel('unknown'), 'normal')

const rawAction = {
  module: '销售',
  priority: '高',
  suggestion: '',
  ownerRole: '  销售经理 ',
  responsible: ' 张三 ',
  days: '3.9',
  dueAt: '2026-09-10',
  riskReason: ' 应收过高 ',
  expectedResult: ' 降低应收 ',
  todo: ' 催收 ',
  table: 'sales_orders',
  recordId: 42
}
assert.deepEqual(normalizeAiSmartBiAction(rawAction, 1), {
  title: '销售行动建议2',
  domain: 'sales',
  domainLabel: '销售',
  riskLevel: 'critical',
  riskLabel: '严重',
  ownerRole: '销售经理',
  ownerName: '张三',
  dueDays: 3,
  dueAt: '2026-09-10',
  reason: '应收过高',
  target: '降低应收',
  nextStep: '催收',
  businessTable: 'sales_orders',
  businessKey: '42',
  raw: rawAction
})
assert.equal(normalizeAiSmartBiAction(null), null)
assert.equal(normalizeAiSmartBiAction({ name: '行动', due_days: 0 }).dueDays, null)

const actionText = [
  '报告',
  '```smart_bi_actions',
  '{actions:[{title:"行动1",domain:"质量",risk:"预警"},null,{name:"行动2",scope:"设备"},{name:"3"},{name:"4"},{name:"5"},{name:"6"}],}',
  '```'
].join('\n')
const sanitizeJson = (value) => value
  .replace(/,\s*([\]}])/g, '$1')
  .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
const extracted = extractAiSmartBiActions(actionText, { sanitizeJson })
assert.equal(extracted.error, null)
assert.equal(extracted.actions.length, 5)
assert.deepEqual(extracted.actions.slice(0, 2).map((item) => [item.title, item.domain, item.riskLevel]), [
  ['行动1', 'quality', 'warning'],
  ['行动2', 'equipment', 'normal']
])
assert.deepEqual(extractAiSmartBiActions('```bi-actions\n{"items":{}}\n```'), { actions: [], error: 'invalid' })
assert.deepEqual(extractAiSmartBiActions('```bi_actions\n{bad}\n```'), { actions: [], error: 'parse' })
assert.deepEqual(extractAiSmartBiActions('普通报告'), { actions: [], error: null })

assert.equal(stripAiSmartBiReportBlocks('开头\n```echarts\n{}\n```\n中间\n```workflow-meta\n{}\n```\n结尾'), '开头 中间 结尾')
const first = { source_message_time: 100, source_action_index: 0, id: 1 }
const second = { source_message_time: '100', source_action_index: '0', id: 2 }
assert.deepEqual(buildAiSmartBiActionItemMap([first, second, { source_message_time: '', source_action_index: 1 }]), {
  '100-0': second
})
assert.deepEqual(buildAiSmartBiActionItemMap(null), {})

assert.equal(resolveAiSmartBiActionDueAt({ dueAt: '2026-09-10T08:00:00+08:00' }), '2026-09-10T00:00:00.000Z')
assert.equal(resolveAiSmartBiActionDueAt({ dueAt: 'bad', dueDays: 3 }, { now: Date.UTC(2026, 8, 1) }), '2026-09-04T00:00:00.000Z')
assert.equal(resolveAiSmartBiActionDueAt({}, { now: 0 }), null)

const messages = [
  { role: 'user', time: 10, content: '早期问题' },
  { role: 'assistant', time: 20, content: '回答' },
  { role: 'user', time: 40, content: '未来问题' },
  { role: 'user', time: 30, content: ` 最新问题 ${'x'.repeat(600)} ` }
]
const question = getAiPreviousUserQuestion({ time: 35 }, messages)
assert.equal(question.startsWith('最新问题'), true)
assert.equal(question.length, 500)
assert.equal(getAiPreviousUserQuestion({ time: 5 }, messages), '')
assert.equal(getAiPreviousUserQuestion({}, [{ role: 'user', content: '无时间问题' }]), '无时间问题')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/ai-copilot-smart-bi-action-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now']) {
  assert.equal(moduleSource.includes(forbidden), false, `AI Copilot Smart BI action policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ai-copilot-smart-bi-action-policy['"]/)
for (const removedDefinition of [
  'const SMART_BI_RISK_LABELS =',
  'const normalizeSmartBiActionDomain =',
  'const getSmartBiDomainLabel =',
  'const normalizeSmartBiRiskLevel =',
  'const normalizeSmartBiAction =',
  "const SMART_BI_CLOSURE_WORKFLOW_NAME = '智能BI经营闭环流程'",
  'const stripSmartBiReportBlocks = (text =',
  'const smartBiActionItemMap = computed(() => {',
  'const resolveSmartBiActionDueAt = (action) => {',
  'const getPreviousUserQuestion = (msg) => {'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `AiCopilot reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'extractAiSmartBiActions(text, { sanitizeJson })',
  'buildAiSmartBiActionItemMap(smartBiActionItems.value)',
  'resolveAiSmartBiActionDueAt(action, { now: Date.now() })',
  'getAiPreviousUserQuestion(msg, currentSession.value?.messages || [])'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `AiCopilot lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 4092)

console.log('PASS: AiCopilot Smart BI action policy preserves domains, risks, extraction, runtime keys, due dates and source questions')
