// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { createAiOutputGuard } = require('../../realtime/ai-output-guard')
const repoRoot = resolve(import.meta.dirname, '../..')
const enterpriseRoute = {
  agentId: 'enterprise_analyst',
  intent: 'analysis',
  latestUserText: '分析本月经营表现'
}

const normalizeText = (value) => String(value ?? '').trim()
const extractCompletionText = (data) => {
  const first = data?.choices?.[0] || {}
  return first?.message?.content ?? first?.delta?.content ?? data?.text ?? data?.content ?? ''
}
const cleanModelText = (value) => normalizeText(value)
const completion = (content) => ({
  id: 'completion-1',
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }]
})
const readCompletion = (data) => data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.delta?.content ?? ''
const readChart = (text) => {
  const match = String(text).match(/```echarts\n([\s\S]*?)```/i)
  assert.ok(match, 'guarded answer must contain an ECharts fence')
  return JSON.parse(match[1])
}
const createGuard = (callAiUpstreamWithRetry = async () => {
  throw new Error('unexpected AI repair call')
}) => createAiOutputGuard({
  normalizeText,
  callAiUpstreamWithRetry,
  cleanModelText,
  extractCompletionText
})

const guard = createGuard()
assert.equal(Object.isFrozen(guard), true)
assert.deepEqual(Object.keys(guard).sort(), [
  'applyEnterpriseOutputGuard',
  'shouldApplyEnterpriseOutputGuard'
])
assert.equal(guard.shouldApplyEnterpriseOutputGuard(enterpriseRoute), true)
assert.equal(guard.shouldApplyEnterpriseOutputGuard({ ...enterpriseRoute, intent: 'workflow' }), false)
assert.equal(guard.shouldApplyEnterpriseOutputGuard({ ...enterpriseRoute, agentId: 'general' }), false)

const passThroughData = completion('普通回答')
const passThrough = await guard.applyEnterpriseOutputGuard({
  data: passThroughData,
  route: { agentId: 'general', intent: 'analysis' }
})
assert.equal(passThrough.guardApplied, false)
assert.equal(passThrough.guardedData, passThroughData, 'non-enterprise routes must preserve object identity')

const workflowRoutePassThrough = await guard.applyEnterpriseOutputGuard({
  data: passThroughData,
  route: { ...enterpriseRoute, intent: 'workflow' }
})
assert.equal(workflowRoutePassThrough.guardApplied, false)
assert.equal(workflowRoutePassThrough.guardedData, passThroughData)

const untouchedEnterpriseData = completion('经营利润同比增长 8%。')
const untouchedEnterprise = await guard.applyEnterpriseOutputGuard({
  data: untouchedEnterpriseData,
  route: enterpriseRoute
})
assert.equal(untouchedEnterprise.guardApplied, false)
assert.equal(untouchedEnterprise.guardedData, untouchedEnterpriseData)

const messagePayload = completion('好的，以下是经营分析报告\n正文结论')
const cleanedMessage = await guard.applyEnterpriseOutputGuard({ data: messagePayload, route: enterpriseRoute })
assert.equal(cleanedMessage.guardApplied, true)
assert.equal(readCompletion(cleanedMessage.guardedData), '正文结论')
assert.equal(readCompletion(messagePayload), '好的，以下是经营分析报告\n正文结论', 'input completion must not be mutated')

const deltaPayload = { choices: [{ index: 0, delta: { content: '当然，下面给出分析报告\n指标改善' } }] }
const cleanedDelta = await guard.applyEnterpriseOutputGuard({ data: deltaPayload, route: enterpriseRoute })
assert.equal(cleanedDelta.guardedData.choices[0].delta.content, '指标改善')
assert.equal(deltaPayload.choices[0].delta.content, '当然，下面给出分析报告\n指标改善')

const textPayload = { request_id: 'raw-1', text: '收到，以下是经营报告\n执行建议' }
const cleanedText = await guard.applyEnterpriseOutputGuard({ data: textPayload, route: enterpriseRoute })
assert.equal(cleanedText.guardedData.request_id, 'raw-1')
assert.deepEqual(cleanedText.guardedData.choices, [
  { index: 0, message: { role: 'assistant', content: '执行建议' }, finish_reason: 'stop' }
])

const validOption = {
  series: [{ type: 'pie', data: [{ name: 'A', value: 1 }] }],
  tooltip: { trigger: 'item' }
}
const validChartText = `\`\`\`echarts\n${JSON.stringify(validOption, null, 2)}\n\`\`\``
const validChartData = completion(validChartText)
const validChart = await guard.applyEnterpriseOutputGuard({ data: validChartData, route: enterpriseRoute })
assert.equal(validChart.guardApplied, false)
assert.equal(validChart.guardedData, validChartData, 'already normalized ECharts must remain byte-for-byte unchanged')

const localRepairCalls = []
const localRepairGuard = createGuard(async (...args) => {
  localRepairCalls.push(args)
  throw new Error('local repair should avoid AI')
})
const jsonLikeChart = `\`\`\`echarts
{
  series: {type: 'bar', data: [1, 2,], label: {formatter: function(value) { return value; }}},
}
\`\`\``
const locallyRepaired = await localRepairGuard.applyEnterpriseOutputGuard({
  data: completion(jsonLikeChart),
  route: enterpriseRoute
})
assert.equal(locallyRepaired.guardApplied, true)
assert.equal(localRepairCalls.length, 0)
const localOption = readChart(readCompletion(locallyRepaired.guardedData))
assert.equal(Array.isArray(localOption.series), true)
assert.equal(localOption.series[0].type, 'bar')
assert.deepEqual(localOption.series[0].data, [1, 2])
assert.equal(localOption.series[0].label.formatter, null)
assert.deepEqual(localOption.xAxis, { type: 'category', data: [] })
assert.deepEqual(localOption.yAxis, { type: 'value' })
assert.deepEqual(localOption.tooltip, { trigger: 'axis' })

const repairCalls = []
const repairedGuard = createGuard(async (payload, options, retry) => {
  repairCalls.push({ payload, options, retry })
  const content = repairCalls.length < 6
    ? '{}'
    : '{"series":[{"type":"line","data":[3,4]}]}'
  return { ok: true, stream: false, data: completion(content) }
})
const cfg = { model: 'enterprise-model' }
const agentRuntime = { id: 'enterprise-runtime' }
const repaired = await repairedGuard.applyEnterpriseOutputGuard({
  data: completion('```echarts\nnot valid json\n```'),
  route: enterpriseRoute,
  cfg,
  agentRuntime
})
assert.equal(repairCalls.length, 6, 'invalid repair responses must be retried through all six guard rounds')
assert.deepEqual(repairCalls[0].options, { cfg, agentRuntime, forceStream: false })
assert.deepEqual(repairCalls[0].retry, { maxRetries: 3, baseDelayMs: 260 })
assert.match(repairCalls[0].payload.messages[0].content, /ECharts JSON 修复器/)
assert.match(repairCalls[0].payload.messages[1].content, /分析本月经营表现/)
assert.deepEqual(readChart(readCompletion(repaired.guardedData)).series, [
  { type: 'line', data: [3, 4] }
])

let fallbackCalls = 0
const fallbackGuard = createGuard(async () => {
  fallbackCalls += 1
  return { ok: false, status: 503, payload: { message: 'unavailable' } }
})
const fallback = await fallbackGuard.applyEnterpriseOutputGuard({
  data: completion('```echarts\nstill invalid\n```'),
  route: enterpriseRoute,
  cfg,
  agentRuntime
})
assert.equal(fallbackCalls, 6)
const fallbackOption = readChart(readCompletion(fallback.guardedData))
assert.equal(fallbackOption.animation, false)
assert.equal(fallbackOption.series[0].type, 'line')
assert.deepEqual(fallbackOption.series[0].data, [0])

const rewriteCalls = []
const rewriteGuard = createGuard(async (payload, options, retry) => {
  rewriteCalls.push({ payload, options, retry })
  return { ok: true, stream: false, data: completion('好的，以下是经营分析报告\n# 盈利分析\n毛利率提升。') }
})
const workflowLeak = completion('```mermaid\ngraph TD\nA-->B\n```\nworkflow-meta: approval')
const rewritten = await rewriteGuard.applyEnterpriseOutputGuard({
  data: workflowLeak,
  route: enterpriseRoute,
  cfg,
  agentRuntime
})
assert.equal(rewriteCalls.length, 1)
assert.deepEqual(rewriteCalls[0].options, { cfg, agentRuntime, forceStream: false })
assert.deepEqual(rewriteCalls[0].retry, { maxRetries: 1, baseDelayMs: 240 })
assert.match(rewriteCalls[0].payload.messages[0].content, /输出守卫/)
assert.match(rewriteCalls[0].payload.messages[1].content, /workflow-meta/)
assert.equal(readCompletion(rewritten.guardedData), '# 盈利分析\n毛利率提升。')
assert.doesNotMatch(readCompletion(rewritten.guardedData), /mermaid|workflow-meta/i)

const compositionRoot = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
assert.match(compositionRoot, /require\('\.\/ai-output-guard'\)/)
assert.match(compositionRoot, /createAiOutputGuard\(/)
assert.doesNotMatch(
  compositionRoot,
  /const (containsWorkflowLeak|replaceCompletionText|stripEnterprisePreambleText|sanitizeJsonLikeText|parseJsonSafe|stripFunctionValueBlocks|normalizeEchartsOption|validateEchartsOption|buildFallbackEchartsOption|extractEchartsBlocks|extractEchartsJsonPayload|repairEchartsBlockWithAi|normalizeEnterpriseEchartsBlocks|rewriteEnterpriseResponse|applyEnterpriseOutputGuard)/
)
assert.ok(compositionRoot.split(/\r?\n/).length <= 5276, 'Realtime composition root must not regain enterprise output guard implementation')

console.log('PASS: AI output guard preserves route gating, completion shapes, workflow rewrite, preamble cleanup, ECharts normalization, AI repair and safe fallback')
