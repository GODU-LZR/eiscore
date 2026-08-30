// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
const adapter = readFileSync(resolve(repoRoot, 'eiscore-base/src/platform/http-client.js'), 'utf8')
const start = source.indexOf('const getWorkflowProfileHeaders =')
const end = source.indexOf('const goWorkflowApprovalCenter =', start)
assert.notEqual(start, -1)
assert.notEqual(end, -1)
const section = source.slice(start, end)

assert.doesNotMatch(section, /\bfetch\s*\(/)
assert.match(section, /const requestWorkflowJson = async/)
assert.match(section, /getHostHttpClient\(\)\.requestJson\(target, options\)/)
assert.match(section, /error\?\.status/)
assert.match(section, /error\?\.displayMessage/)
assert.match(section, /throw new Error\([^)]*label[^)]*失败/)
assert.doesNotMatch(section, /headers\.Authorization|getWorkflowProfileHeaders\s*=\s*\(token|getPublicProfileHeaders\s*=\s*\(token|getAppCenterProfileHeaders\s*=\s*\(token/)

for (const target of [
  '/apps',
  '/definitions',
  '/task_assignments',
  '/workflow_state_mappings?on_conflict=workflow_app_id,bpmn_task_id',
  '/smart_bi_action_items',
  '/rpc/start_workflow_instance'
]) {
  assert.ok(section.includes(target), 'AI workflow must retain target ' + target)
}
for (const label of [
  '创建流程应用',
  '写入流程定义',
  '回写流程应用配置',
  '写入任务分派',
  '写入状态映射',
  '读取智能BI闭环流程',
  '写入智能BI行动单',
  '回写智能BI行动单流程状态',
  '发起智能BI闭环流程'
]) {
  assert.ok(section.includes(label), 'AI workflow must retain error label ' + label)
}
assert.match(section, /method:\s*['"]POST['"]/)
assert.match(section, /method:\s*['"]PATCH['"]/)
assert.match(section, /body:\s*appPayload/)
assert.match(section, /body:\s*payload/)
assert.match(section, /body:\s*rows/)
assert.match(section, /body:\s*\{\s*p_definition_id:/)
assert.doesNotMatch(section, /JSON\.stringify\(/)
assert.doesNotMatch(section, /const parseResponseJson|const assertWorkflowSaveResponse/)

const fetchCalls = source.match(/\bfetch\s*\(/g) || []
assert.equal(fetchCalls.length, 0)
assert.match(source, /from\s*['"]@shared\/eis-business-snapshot['"]/)
assert.match(source, /smartBiSnapshot\.value\s*=\s*await loadBusinessSnapshot\(\)/)
assert.match(adapter, /resolveErrorMessage:\s*\(data\)\s*=>\s*data\?\.message/)

console.log('PASS: AI Copilot workflow writes use platform HTTP')
