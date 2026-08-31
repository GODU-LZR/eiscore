// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  LEGACY_BINDING_LABEL_MAP,
  LEGACY_BINDING_STATE_TARGET_MAP,
  LEGACY_TABLE_BINDING_MAP,
  WORKFLOW_STATUS_ORDER,
  buildCorePermissionEntries,
  buildGeneratedTransitionRule,
  buildPermissionDefinitionPayload,
  buildTransitionPermission,
  collectRequiredPermissionEntries,
  formatApprovalMode,
  formatPolicyBool,
  formatTransitionStatePair,
  getWorkflowStateColor,
  getWorkflowStateLabel,
  getWorkflowStateLevel,
  getWorkflowStateTagType,
  getWorkflowTransitionRuleKey,
  isStateReached,
  normalizeApprovalMode,
  normalizePolicyBool,
  normalizeRequiredApprovals,
  normalizeStateValue,
  normalizeStatusTokenForPermission,
  parseSchemaTable,
  resolveWorkflowPermissionDefMeta
} from '../../eiscore-apps/src/domain/app-runtime-workflow-policy.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.deepEqual(WORKFLOW_STATUS_ORDER, ['created', 'active', 'locked'])
assert.equal(Object.isFrozen(WORKFLOW_STATUS_ORDER), true)
for (const [input, expected] of [
  ['', ''],
  [' draft ', 'created'],
  ['新建', 'created'],
  ['ENABLED', 'active'],
  ['启用', 'active'],
  ['Disabled', 'locked'],
  ['禁用', 'locked'],
  ['custom_state', 'custom_state']
]) {
  assert.equal(normalizeStateValue(input), expected)
}
assert.equal(getWorkflowStateLevel('created'), 0)
assert.equal(getWorkflowStateLevel('生效'), 1)
assert.equal(getWorkflowStateLevel('locked'), 2)
assert.equal(getWorkflowStateLevel('unknown'), -1)
assert.equal(getWorkflowStateLabel(''), '未配置')
assert.equal(getWorkflowStateLabel('draft'), '创建')
assert.equal(getWorkflowStateLabel('custom'), 'custom')
assert.equal(getWorkflowStateTagType('enabled'), 'success')
assert.equal(getWorkflowStateTagType('unknown'), 'info')
assert.equal(getWorkflowStateColor('禁用'), '#f56c6c')
assert.equal(getWorkflowStateColor('unknown'), '#909399')
assert.equal(isStateReached('locked', 'created'), true)
assert.equal(isStateReached('active', 'locked'), false)
assert.equal(isStateReached('enabled', 'active'), true)
assert.equal(isStateReached('custom', 'custom'), true)
assert.equal(isStateReached('custom', 'created'), false)
assert.equal(isStateReached('', 'created'), false)
assert.equal(formatTransitionStatePair('draft', 'enabled'), '创建 -> 生效')
assert.equal(formatTransitionStatePair('', ''), '未配置 -> 未配置')

assert.equal(normalizeApprovalMode(' QUOTA '), 'quota')
assert.equal(normalizeApprovalMode('ALL'), 'all')
assert.equal(normalizeApprovalMode('invalid'), 'any')
assert.equal(formatApprovalMode('quota'), '多人会签')
assert.equal(formatApprovalMode('all'), '全员会签')
assert.equal(formatApprovalMode(null), '单人通过')
assert.equal(normalizeRequiredApprovals('3.9'), 3)
assert.equal(normalizeRequiredApprovals(0), 1)
assert.equal(normalizeRequiredApprovals('bad'), 1)

for (const value of [true, 'true', '1', 'yes', 'ON']) assert.equal(normalizePolicyBool(value, false), true)
for (const value of [false, 'false', '0', 'no', 'OFF']) assert.equal(normalizePolicyBool(value, true), false)
assert.equal(normalizePolicyBool('', false), false)
assert.equal(normalizePolicyBool('unknown', true), true)
assert.equal(formatPolicyBool(1), '开启')
assert.equal(formatPolicyBool(0), '关闭')

assert.equal(normalizeStatusTokenForPermission(' Active:Review 状态 '), 'active_review_u72b6_u6001')
assert.equal(normalizeStatusTokenForPermission(''), '')
assert.equal(buildTransitionPermission('created', 'active', ' sales '), 'op:sales.status_transition.created_active')
assert.equal(buildTransitionPermission('created', 'created', 'sales'), '')
assert.equal(buildTransitionPermission('', 'active', 'sales'), '')
assert.equal(buildTransitionPermission('created', 'active', ''), '')

const rule = {
  from_task_id: ' Task_A ',
  to_task_id: 'Task_B',
  from_state: ' created ',
  to_state: 'active'
}
assert.equal(getWorkflowTransitionRuleKey(rule), 'Task_A\u001fTask_B\u001fcreated\u001factive')

const stateMappings = [
  { bpmn_task_id: 'Task_A', state_value: 'created' },
  { bpmn_task_id: 'Task_B', state_value: 'active' },
  { bpmn_task_id: 'Task_C', state_value: 'active' }
]
assert.deepEqual(buildGeneratedTransitionRule({
  fromTaskId: ' Task_A ',
  toTaskId: 'Task_B',
  stateMappings,
  workflowAppId: 'workflow-1',
  appKey: 'sales'
}), {
  workflow_app_id: 'workflow-1',
  from_task_id: 'Task_A',
  to_task_id: 'Task_B',
  from_state: 'created',
  to_state: 'active',
  required_permission: 'op:sales.status_transition.created_active',
  is_active: true
})
assert.equal(buildGeneratedTransitionRule({ fromTaskId: 'Task_A', toTaskId: 'Task_A', stateMappings }), null)
assert.equal(buildGeneratedTransitionRule({ fromTaskId: 'Task_B', toTaskId: 'Task_C', stateMappings }), null)
assert.equal(buildGeneratedTransitionRule({ fromTaskId: 'Task_A', toTaskId: 'missing', stateMappings }), null)

assert.deepEqual(buildCorePermissionEntries('sales'), [
  { code: 'op:sales.workflow_start', source: '流程发起' },
  { code: 'op:sales.workflow_transition', source: '流程推进' },
  { code: 'op:sales.workflow_complete', source: '流程完结' }
])
assert.deepEqual(buildCorePermissionEntries(''), [])
assert.deepEqual(collectRequiredPermissionEntries({
  appKey: 'sales',
  activeRules: [
    { required_permission: 'op:sales.status_transition.created_active' },
    { required_permission: 'op:sales.workflow_start' },
    { required_permission: '' }
  ],
  missingRules: [
    { required_permission: 'op:sales.status_transition.created_active' },
    { required_permission: 'op:sales.status_transition.active_locked' }
  ]
}), [
  { code: 'op:sales.workflow_start', source: '流程发起' },
  { code: 'op:sales.workflow_transition', source: '流程推进' },
  { code: 'op:sales.workflow_complete', source: '流程完结' },
  { code: 'op:sales.status_transition.created_active', source: '迁移规则' },
  { code: 'op:sales.status_transition.active_locked', source: '建议规则' }
])

assert.deepEqual(resolveWorkflowPermissionDefMeta('op:sales.workflow_start'), { suffix: '流程发起', action: 'workflow_start' })
assert.deepEqual(resolveWorkflowPermissionDefMeta('op:sales.workflow_transition'), { suffix: '流程推进', action: 'workflow_transition' })
assert.deepEqual(resolveWorkflowPermissionDefMeta('op:sales.workflow_complete'), { suffix: '流程完结', action: 'workflow_complete' })
assert.deepEqual(resolveWorkflowPermissionDefMeta('op:sales.status_transition.a_b'), { suffix: '状态流转', action: 'status_transition' })
assert.deepEqual(resolveWorkflowPermissionDefMeta('custom', ' 自定义 '), { suffix: '自定义', action: 'workflow_permission' })
assert.deepEqual(buildPermissionDefinitionPayload(
  { code: 'op:sales.workflow_start', source: 'ignored' },
  { moduleName: 'sales', displayName: '销售流程' }
), {
  code: 'op:sales.workflow_start',
  name: '销售流程-流程发起',
  module: 'sales',
  action: 'workflow_start'
})

assert.deepEqual(parseSchemaTable(''), { schema: '', table: '' })
assert.deepEqual(parseSchemaTable('orders'), { schema: 'public', table: 'orders' })
assert.deepEqual(parseSchemaTable(' scm.inventory_drafts.extra '), { schema: 'scm', table: 'inventory_drafts' })

assert.equal(LEGACY_BINDING_LABEL_MAP['legacy:mms_inventory_stock_in'], '入库（MMS）')
assert.equal(LEGACY_TABLE_BINDING_MAP['scm.production_work_orders'], 'legacy:production_work_order')
assert.deepEqual(LEGACY_BINDING_STATE_TARGET_MAP['legacy:hr_employee'], {
  target_table: 'hr.archives',
  state_field: 'status'
})
assert.equal(Object.isFrozen(LEGACY_BINDING_LABEL_MAP), true)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/app-runtime-workflow-policy.mjs'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'axios', 'window.', 'document.', 'localStorage']) {
  assert.equal(moduleSource.includes(forbidden), false, `workflow policy gained runtime dependency: ${forbidden}`)
}

const runtimeSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/AppRuntime.vue'), 'utf8')
assert.match(runtimeSource, /from ['"]@\/domain\/app-runtime-workflow-policy\.mjs['"]/)
for (const removedDefinition of [
  'const normalizeApprovalMode =',
  'const normalizePolicyBool =',
  'const normalizeStateValue =',
  'const getWorkflowTransitionRuleKey =',
  'const parseSchemaTable ='
]) {
  assert.equal(runtimeSource.includes(removedDefinition), false, `AppRuntime reintroduced ${removedDefinition}`)
}
assert.ok(runtimeSource.split(/\r?\n/).length <= 4450)

console.log('PASS: AppRuntime workflow policy preserves states, approvals, permissions, generated rules and legacy bindings')
