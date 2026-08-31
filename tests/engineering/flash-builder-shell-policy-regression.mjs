// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildFlashDefaultConversation,
  buildFlashRegistryCheck,
  buildFlashShellHistory,
  createFlashShellMessage,
  extractFlashRegistryCountClaim,
  extractFlashToolCallsFromText,
  formatFlashConversationMeta,
  formatFlashFileSize,
  isFlashRecoverableShellError,
  mergeFlashShellToolCalls,
  normalizeFlashSavedMessage,
  normalizeFlashShellAttachment,
  normalizeFlashShellToolCall,
  parseFlashThoughtAndAnswer,
  sanitizeFlashConversationTitle,
  stripFlashPromptEchoLines
} from '../../eiscore-apps/src/domain/flash-builder-shell-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const tool = normalizeFlashShellToolCall('```json\n{"tool_id":"flash.read","ok":false,"error":{"message":"denied","reason_code":"ACL","http_status":403}}\n```', { id: 't1' })
assert.deepEqual(tool, { id: 't1', toolId: 'flash.read', ok: false, code: 'ACL', httpStatus: 403, message: 'denied' })
assert.equal(normalizeFlashShellToolCall('', { id: 'x' }), null)
assert.equal(normalizeFlashShellToolCall('plain', { id: 'x' }).message, 'plain')

const normalizeToolCall = (value) => normalizeFlashShellToolCall(value, { id: 'tool' })
assert.deepEqual(createFlashShellMessage('assistant', ' hi ', {
  thought: ' think ', toolCalls: [{ toolId: 'x', message: 'ok' }], registryCheck: { claimed: '3', actual: 3, matched: 1 }
}, { id: 'm1', normalizeToolCall }), {
  id: 'm1', role: 'assistant', content: 'hi', thought: 'think',
  toolCalls: [{ id: 'tool', toolId: 'x', ok: null, code: '', httpStatus: null, message: 'ok' }],
  registryCheck: { claimed: 3, actual: 3, matched: true }
})
assert.equal(sanitizeFlashConversationTitle('  第一行\n第二行  '), '第一行 第二行')
assert.equal(sanitizeFlashConversationTitle('x'.repeat(29)), `${'x'.repeat(28)}...`)
assert.equal(sanitizeFlashConversationTitle('', 'fallback'), 'fallback')
assert.equal(normalizeFlashSavedMessage({ role: 'system' }), null)
assert.equal(normalizeFlashSavedMessage({ role: 'USER', content: ' a ' }, { id: 'm2' }).content, 'a')

assert.equal(stripFlashPromptEchoLines('硬性约束：x\n\n业务结果\n\n\n完成'), '业务结果\n\n完成')
assert.equal(extractFlashRegistryCountClaim('共 4 个工具，后来 total 43 tools'), 43)
assert.equal(extractFlashRegistryCountClaim('none'), 0)
const extracted = extractFlashToolCallsFromText('前文<toolcall>{"toolId":"read","message":"ok"}</toolcall>后文', { normalizeToolCall })
assert.equal(extracted.text, '前文后文')
assert.equal(extracted.toolCalls[0].toolId, 'read')

const parsed = parseFlashThoughtAndAnswer('<think>我需要检查</think>\n当前用户请求：测试\n最终回答：已完成，共 43 个工具\n<toolcall>{"id":"read"}</toolcall>', { normalizeToolCall })
assert.equal(parsed.answer, '已完成，共 43 个工具')
assert.equal(parsed.thought.includes('我需要检查'), true)
assert.equal(parsed.registryClaimedCount, 43)
assert.equal(parsed.toolCalls.length, 1)
assert.deepEqual(parseFlashThoughtAndAnswer(''), { answer: '', thought: '', toolCalls: [], registryClaimedCount: 0 })

assert.equal(formatFlashFileSize(100), '100 B')
assert.equal(formatFlashFileSize(1536), '1.5 KB')
assert.equal(formatFlashFileSize(2 * 1024 * 1024), '2.0 MB')
assert.deepEqual(normalizeFlashShellAttachment({ path: 'dir\\a.txt', size: -1, textPreview: 'x'.repeat(9000) }, { id: 'a1', uploadedAt: 'now' }), {
  id: 'a1', name: 'a.txt', mimeType: 'application/octet-stream', size: 0, relativePath: 'dir/a.txt',
  textPreview: 'x'.repeat(8000), uploadedAt: 'now'
})
assert.equal(normalizeFlashShellAttachment({}, { id: 'x' }), null)
assert.deepEqual(buildFlashDefaultConversation('', { generatedId: 'c1', nowIso: 'now', titleTime: '2026/9/1 10:00:00' }), {
  id: 'c1', title: '会话 2026/9/1 10:00:00', createdAt: 'now', updatedAt: 'now', messages: [], attachments: []
})

const existing = [{ id: 'old', toolId: 'read', code: '', httpStatus: null, message: 'ok' }]
assert.equal(mergeFlashShellToolCalls(existing, [{ toolId: 'read', message: 'ok' }, { toolId: 'write', message: 'done' }], { normalizeToolCall }).length, 2)
assert.equal(existing.length, 1)
assert.deepEqual(buildFlashRegistryCheck('3', 3), { claimed: 3, actual: 3, matched: true })
assert.equal(buildFlashRegistryCheck(0, 3), null)
for (const value of ['', 'timeout', 'ECONNREFUSED', '503 unavailable']) assert.equal(isFlashRecoverableShellError(value), true)
assert.equal(isFlashRecoverableShellError('permission denied'), false)
assert.deepEqual(buildFlashShellHistory([
  { role: 'system', content: 'x' }, { role: 'user', content: '' }, { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }
], 1), [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }])
assert.equal(formatFlashConversationMeta({ messages: [1, 2], attachments: [1] }), '2 条消息 · 1 个附件')
assert.equal(formatFlashConversationMeta({ messages: [1] }), '1 条消息')
assert.equal(formatFlashConversationMeta(null), '')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/flash-builder-shell-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `FlashBuilder shell policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/FlashBuilder.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/flash-builder-shell-policy['"]/)
for (const removedDefinition of [
  'const SHELL_PROMPT_ECHO_LINE_PATTERNS =',
  'const sanitizeConversationTitle =',
  'const stripPromptEchoLines =',
  'const extractRegistryCountClaim =',
  'const extractToolCallsFromText =',
  'const formatFileSize =',
  'const isRecoverableShellError ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `FlashBuilder reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'normalizeFlashShellToolCall(',
  'createFlashShellMessage(',
  'normalizeFlashSavedMessage(',
  'parseFlashThoughtAndAnswer(',
  'normalizeFlashShellAttachment(',
  'buildFlashDefaultConversation(',
  'mergeFlashShellToolCalls(',
  'buildFlashRegistryCheck(',
  'buildFlashShellHistory(',
  'formatFlashConversationMeta('
]) {
  assert.equal(pageSource.includes(requiredUse), true, `FlashBuilder lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3947)

console.log('PASS: FlashBuilder shell policy preserves messages, tools, thoughts, attachments, conversations, history and retry rules')
