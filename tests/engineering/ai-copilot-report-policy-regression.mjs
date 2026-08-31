// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AI_SMART_BI_REPORT_SECTIONS,
  buildAiReportPrintDocument,
  cleanAiReportFillerSentence,
  isAiReportFillerLine,
  matchAiSmartBiReportSection,
  normalizeAiReportInlineText,
  normalizeAiSmartBiHeading,
  shouldAiShowReportDownload
} from '../../eiscore-base/src/domain/ai-copilot-report-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
assert.deepEqual(AI_SMART_BI_REPORT_SECTIONS.map((section) => [section.key, section.label]), [
  ['summary', '摘要'],
  ['metrics', '关键指标'],
  ['charts', '指标图表'],
  ['risks', '风险提醒'],
  ['actions', '行动建议']
])
for (const [value, expected] of [
  ['## 第一、【经营摘要】：', '经营摘要'],
  ['2. 风险预警', '风险预警'],
  ['第3部分 行动建议', '部分行动建议'],
  ['', '']
]) {
  assert.equal(normalizeAiSmartBiHeading(value), expected)
}
assert.equal(matchAiSmartBiReportSection('一、核心摘要说明')?.key, 'summary')
assert.equal(matchAiSmartBiReportSection('### 数据图表')?.key, 'charts')
assert.equal(matchAiSmartBiReportSection('下一步安排')?.key, 'actions')
assert.equal(matchAiSmartBiReportSection('普通段落'), null)

const assistantMessage = { role: 'assistant', content: ' 报告 ' }
assert.equal(shouldAiShowReportDownload(assistantMessage, { enterprise: true, streaming: false }), true)
assert.equal(shouldAiShowReportDownload(assistantMessage, { enterprise: false }), false)
assert.equal(shouldAiShowReportDownload(assistantMessage, { enterprise: true, streaming: true }), false)
assert.equal(shouldAiShowReportDownload({ role: 'user', content: '报告' }, { enterprise: true }), false)
assert.equal(shouldAiShowReportDownload({ role: 'assistant', content: '  ' }, { enterprise: true }), false)

assert.equal(normalizeAiReportInlineText('  好的\n  报告  '), '好的 报告')
for (const text of ['好的，下面是经营分析报告', '以下为智能 BI 洞察', '收到。经营报告如下']) {
  assert.equal(isAiReportFillerLine(text), true)
}
assert.equal(isAiReportFillerLine('风险提醒：库存不足'), false)
assert.equal(isAiReportFillerLine(''), false)
assert.equal(cleanAiReportFillerSentence('收到，以下是经营报告 后续正文'), '后续正文')
assert.equal(cleanAiReportFillerSentence('风险提醒：库存不足'), null)

const documentHtml = buildAiReportPrintDocument('<p>经营摘要</p>')
assert.equal(documentHtml.startsWith('<!DOCTYPE html>'), true)
assert.equal(documentHtml.includes('<title>智能 BI 报告</title>'), true)
assert.equal(documentHtml.includes('<div class="report-content"><p>经营摘要</p></div>'), true)
assert.equal(documentHtml.includes('.markdown-body table'), true)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/ai-copilot-report-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `AI Copilot report policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ai-copilot-report-policy['"]/)
for (const removedDefinition of [
  'const SMART_BI_REPORT_SECTIONS =',
  'const normalizeSmartBiHeading =',
  'const matchSmartBiReportSection =',
  'const REPORT_FILLER_LINE_RE =',
  'const REPORT_FILLER_SENTENCE_RE =',
  'const normalizeInlineText =',
  'const isReportFillerLine ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `AiCopilot reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'shouldAiShowReportDownload(msg, {',
  'cleanAiReportFillerSentence(text)',
  'printWindow.document.write(buildAiReportPrintDocument(html))'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `AiCopilot lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3720)

console.log('PASS: AiCopilot report policy preserves sections, download visibility, filler cleanup and print markup')
