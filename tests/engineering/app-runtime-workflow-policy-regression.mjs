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
  buildBusinessRecordQueryPlan,
  buildCorePermissionEntries,
  buildGeneratedTransitionRule,
  buildPermissionDefinitionPayload,
  buildTransitionPermission,
  buildWorkflowStateOptions,
  buildWorkflowTaskOptions,
  chooseNextTaskByStateLevel,
  collectRequiredPermissionEntries,
  extractBusinessDocNo,
  formatApprovalMode,
  formatPolicyBool,
  formatTransitionStatePair,
  formatWorkflowBusinessBindingSummary,
  getWorkflowPolicyModeMeta,
  getWorkflowStateColor,
  getWorkflowStateLabel,
  getWorkflowStateLevel,
  getWorkflowStateTagType,
  getWorkflowTransitionRuleKey,
  isAutoAdvanceSatisfied,
  isInventoryDraftTable,
  isStateReached,
  isWorkflowStrictPolicyEnabled,
  mergeCurrentTaskMapping,
  normalizeApprovalMode,
  normalizePolicyBool,
  normalizeRequiredApprovals,
  normalizeStateValue,
  normalizeStatusTokenForPermission,
  parseSchemaTable,
  resolveBoundStateTarget,
  resolveConfiguredTaskBusinessBinding,
  resolveExpectedStateForRow,
  resolveInventoryDraftType,
  resolveTargetBusinessAppId,
  resolveTaskAutoRule,
  resolveWorkflowEffectivePolicy,
  resolveWorkflowPermissionDefMeta,
  resolveWorkflowRuntimeConfig
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

const taskOptions = buildWorkflowTaskOptions({
  taskNameMap: { Task_B: 'ignored here', ' Task_A ': 'trimmed key' },
  stateMappings: [{ bpmn_task_id: ' Task_C ' }, { bpmn_task_id: 'Task_A' }],
  taskAssignments: [{ task_id: 'Task_D' }, { task_id: '' }],
  transitionRules: [
    { from_task_id: 'Task_E', to_task_id: 'Task_F' },
    { from_task_id: 'Task_B', to_task_id: ' ' }
  ],
  formatTaskName: (id) => `名称-${id}`
})
assert.deepEqual(new Set(taskOptions.map((item) => item.value)), new Set([
  'Task_A', 'Task_B', 'Task_C', 'Task_D', 'Task_E', 'Task_F'
]))
assert.deepEqual(taskOptions.map((item) => item.label), taskOptions
  .map((item) => item.label)
  .toSorted((a, b) => a.localeCompare(b, 'zh-Hans-CN')))
assert.equal(taskOptions.find((item) => item.value === 'Task_C')?.label, '名称-Task_C')
assert.deepEqual(buildWorkflowTaskOptions(), [])

const stateOptions = buildWorkflowStateOptions({
  stateMappings: [
    { from_state: ' draft ', state_value: 'custom' },
    { from_state: '', state_value: 'active' }
  ],
  transitionRules: [
    { from_state: 'custom', to_state: ' review ' },
    { from_state: 'locked', to_state: '' }
  ]
})
assert.deepEqual(new Set(stateOptions.map((item) => item.value)), new Set([
  'created', 'active', 'locked', 'draft', 'custom', 'review'
]))
assert.equal(stateOptions.find((item) => item.value === 'draft')?.label, '创建')
assert.equal(stateOptions.find((item) => item.value === 'review')?.label, 'review')
assert.equal(stateOptions.filter((item) => item.value === 'active').length, 1)
assert.equal(buildWorkflowStateOptions().length, 3)

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

assert.deepEqual(resolveWorkflowEffectivePolicy({ fallbackModule: ' module:fallback ' }), {
  acl_module: 'module:fallback',
  permission_mode: 'compat',
  enforce_assignment: true,
  enforce_workflow_op_perm: true,
  enforce_status_transition_perm: true,
  legacy_fallback_enabled: true,
  source: 'default'
})
assert.deepEqual(resolveWorkflowEffectivePolicy({
  config: { aclModule: 'module:config', permission_mode: ' STRICT ' },
  policy: {
    acl_module: ' module:policy ',
    permission_mode: ' COMPAT ',
    enforce_assignment: 'false',
    enforce_workflow_op_perm: 'yes',
    enforce_status_transition_perm: 0,
    legacy_fallback_enabled: false
  },
  fallbackModule: 'module:fallback'
}), {
  acl_module: 'module:policy',
  permission_mode: 'compat',
  enforce_assignment: false,
  enforce_workflow_op_perm: true,
  enforce_status_transition_perm: false,
  legacy_fallback_enabled: false,
  source: 'policy'
})
assert.equal(resolveWorkflowEffectivePolicy({
  config: { aclModule: 'module:config', permission_mode: ' STRICT ' }
}).permission_mode, 'strict')
assert.equal(resolveWorkflowEffectivePolicy({ policy: 'invalid-but-present' }).source, 'policy')
assert.deepEqual(getWorkflowPolicyModeMeta({ permission_mode: 'strict' }), {
  label: 'strict',
  tagType: 'danger'
})
assert.deepEqual(getWorkflowPolicyModeMeta({ permission_mode: 'STRICT' }), {
  label: 'compat',
  tagType: 'success'
})
const strictPolicy = {
  permission_mode: 'strict',
  legacy_fallback_enabled: false,
  enforce_assignment: true,
  enforce_workflow_op_perm: true,
  enforce_status_transition_perm: true
}
assert.equal(isWorkflowStrictPolicyEnabled(strictPolicy), true)
for (const key of [
  'legacy_fallback_enabled',
  'enforce_assignment',
  'enforce_workflow_op_perm',
  'enforce_status_transition_perm'
]) {
  assert.equal(isWorkflowStrictPolicyEnabled({ ...strictPolicy, [key]: key === 'legacy_fallback_enabled' ? true : false }), false)
}
assert.equal(isWorkflowStrictPolicyEnabled({ ...strictPolicy, permission_mode: 'compat' }), false)

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

const autoRules = {
  Task_A: { enabled: false, trigger_state: ' enabled ' },
  Task_B: 'invalid'
}
assert.deepEqual(resolveTaskAutoRule(autoRules, ' Task_A '), { enabled: false, triggerState: 'active' })
assert.deepEqual(resolveTaskAutoRule(autoRules, 'Task_B'), { enabled: true, triggerState: '' })
assert.deepEqual(resolveTaskAutoRule(autoRules, ''), { enabled: true, triggerState: '' })
assert.equal(resolveExpectedStateForRow({
  row: { current_task_id: 'Task_A' },
  mapping: { state_value: 'locked' },
  autoAdvanceRules: autoRules
}), 'active')
assert.equal(resolveExpectedStateForRow({
  row: { current_task_id: 'Task_B' },
  mapping: { state_value: '禁用' },
  autoAdvanceRules: autoRules
}), 'locked')

assert.equal(extractBusinessDocNo({ business_doc_no: ' DOC-1 ', doc_no: 'DOC-2' }), 'DOC-1')
assert.equal(extractBusinessDocNo({ order_no: '', properties: { workflow_business_key: ' PROP-1 ' } }), 'PROP-1')
assert.equal(extractBusinessDocNo({ id: 42 }), '42')
assert.equal(extractBusinessDocNo(null), '')
assert.equal(isInventoryDraftTable('scm', 'inventory_drafts'), true)
assert.equal(isInventoryDraftTable('public', 'inventory_drafts'), false)

const olderBusinessRow = { updated_at: '2026-08-01T00:00:00.000Z' }
const newerInstance = { updated_at: '2026-08-02T00:00:00.000Z' }
assert.equal(isAutoAdvanceSatisfied({
  row: newerInstance,
  mapping: { state_value: 'active' },
  taskRule: { triggerState: '' },
  observedState: 'locked',
  businessRow: olderBusinessRow
}), false)
assert.equal(isAutoAdvanceSatisfied({
  row: newerInstance,
  mapping: { state_value: 'active' },
  taskRule: { triggerState: 'active' },
  observedState: 'locked',
  businessRow: olderBusinessRow
}), true)
assert.equal(isAutoAdvanceSatisfied({
  row: { created_at: 'invalid' },
  mapping: { state_value: 'active' },
  taskRule: {},
  observedState: 'active',
  businessRow: { created_at: 'invalid' }
}), true)
assert.equal(isAutoAdvanceSatisfied({ mapping: {}, taskRule: {}, observedState: 'active' }), false)
assert.equal(isAutoAdvanceSatisfied({ mapping: { state_value: 'locked' }, taskRule: {}, observedState: 'active' }), false)

const businessApps = [
  { id: 'app-object', config: { table: 'custom.orders' } },
  { id: 99, config: JSON.stringify({ table: 'custom.lines' }) },
  { id: 'bad', config: '{bad' }
]
assert.deepEqual(resolveBoundStateTarget({ binding: 'legacy:hr_employee', businessApps }), {
  target_table: 'hr.archives',
  state_field: 'status'
})
assert.deepEqual(resolveBoundStateTarget({ binding: 'table:custom.orders', businessApps }), {
  target_table: 'custom.orders',
  state_field: 'status'
})
assert.deepEqual(resolveBoundStateTarget({ binding: '99', businessApps }), {
  target_table: 'custom.lines',
  state_field: 'status'
})
assert.deepEqual(resolveBoundStateTarget({ binding: 'missing', businessApps }), {
  target_table: '',
  state_field: ''
})

assert.deepEqual(mergeCurrentTaskMapping({
  taskId: 'Task_A',
  stateMappings: [{ bpmn_task_id: 'Task_A', target_table: '', state_field: '', state_value: 'active' }],
  binding: 'legacy:hr_employee',
  businessApps
}), {
  bpmn_task_id: 'Task_A',
  target_table: 'hr.archives',
  state_field: 'status',
  state_value: 'active'
})
assert.deepEqual(mergeCurrentTaskMapping({
  taskId: 'Task_New',
  stateMappings: [],
  binding: 'table:custom.orders',
  businessApps
}), {
  bpmn_task_id: 'Task_New',
  target_table: 'custom.orders',
  state_field: 'status',
  state_value: ''
})
assert.equal(mergeCurrentTaskMapping({ taskId: '', stateMappings, binding: '' }), null)
assert.equal(mergeCurrentTaskMapping({ taskId: 'Task_New', stateMappings, binding: '' }), null)

assert.equal(resolveTargetBusinessAppId({ taskId: 'A', binding: 'legacy:hr_employee', businessApps }), 'legacy:hr_employee')
assert.equal(resolveTargetBusinessAppId({ taskId: 'A', binding: 'table:scm.production_work_orders', businessApps }), 'legacy:production_work_order')
assert.equal(resolveTargetBusinessAppId({ taskId: 'A', binding: 'table:custom.orders', businessApps }), 'app-object')
assert.equal(resolveTargetBusinessAppId({ taskId: 'A', binding: '99', businessApps }), '99')
assert.equal(resolveTargetBusinessAppId({
  taskId: 'Task_A',
  binding: '',
  stateMappings: [{ bpmn_task_id: 'Task_A', target_table: 'custom.lines', state_field: 'status' }],
  businessApps
}), '99')

assert.equal(chooseNextTaskByStateLevel({
  currentTaskId: 'Task_A',
  targetLevel: 2,
  options: ['Task_B', 'Task_C'],
  stateMappings: [
    { bpmn_task_id: 'Task_B', state_value: 'active' },
    { bpmn_task_id: 'Task_C', state_value: 'locked' }
  ]
}), 'Task_C')
assert.equal(chooseNextTaskByStateLevel({ currentTaskId: 'Task_A', targetLevel: 2, options: ['Task_B'], stateMappings: [] }), 'Task_B')
assert.equal(chooseNextTaskByStateLevel({ currentTaskId: '', targetLevel: 2, options: ['Task_B'] }), '')
assert.equal(chooseNextTaskByStateLevel({ currentTaskId: 'Task_A', targetLevel: -1, options: ['Task_B'] }), '')

assert.equal(resolveInventoryDraftType('legacy:mms_inventory_stock_in'), 'in')
assert.equal(resolveInventoryDraftType('legacy:mms_inventory_stock_out'), 'out')
assert.equal(resolveInventoryDraftType('other'), '')
assert.deepEqual(buildBusinessRecordQueryPlan({
  businessKey: 'KEY /1',
  instanceId: '42',
  inventoryDrafts: false
}), [
  'id=eq.KEY%20%2F1',
  'business_key=eq.KEY%20%2F1',
  'properties-%3E%3Eworkflow_business_key=eq.KEY%20%2F1',
  'properties-%3E%3Eworkflow_instance_id=eq.42',
  'workflow_instance_id=eq.42'
])
assert.deepEqual(buildBusinessRecordQueryPlan({
  businessKey: 'KEY-1',
  instanceId: '42',
  inventoryDrafts: true
}), [
  'properties-%3E%3Eworkflow_business_key=eq.KEY-1',
  'properties-%3E%3Eworkflow_instance_id=eq.42'
])
assert.deepEqual(buildBusinessRecordQueryPlan({}), [])

assert.deepEqual(resolveWorkflowRuntimeConfig(null), {
  businessAppId: '',
  taskBindings: {},
  tableBinding: '',
  legacyBinding: '',
  autoAdvanceEnabled: false,
  autoAdvanceRules: {}
})
const runtimeRules = { Task_A: { enabled: false, trigger_state: 'active' } }
assert.deepEqual(resolveWorkflowRuntimeConfig({
  workflowBusinessAppId: ' table:custom.orders ',
  workflowTaskBusinessAppBindings: {
    ' Task_A ': ' app-a ',
    '': 'ignored',
    Task_B: '   '
  },
  workflowAutoAdvanceEnabled: true,
  workflowAutoAdvanceRules: runtimeRules
}), {
  businessAppId: 'table:custom.orders',
  taskBindings: { Task_A: 'app-a' },
  tableBinding: 'custom.orders',
  legacyBinding: '',
  autoAdvanceEnabled: true,
  autoAdvanceRules: runtimeRules
})
assert.equal(resolveWorkflowRuntimeConfig({ workflowBusinessAppId: ' legacy:hr_employee ' }).legacyBinding, 'legacy:hr_employee')
assert.equal(resolveWorkflowRuntimeConfig({ workflowAutoAdvanceEnabled: 'true' }).autoAdvanceEnabled, false)
assert.deepEqual(resolveWorkflowRuntimeConfig({ workflowTaskBusinessAppBindings: [], workflowAutoAdvanceRules: 'bad' }).taskBindings, {})

assert.equal(formatWorkflowBusinessBindingSummary({
  businessAppId: 'legacy:hr_employee',
  taskBindings: { A: 'app-a', B: 'app-b' }
}), '按任务绑定（2 个节点）')
assert.equal(formatWorkflowBusinessBindingSummary({ businessAppId: 'legacy:hr_employee' }), '人事花名册（HR）')
assert.equal(formatWorkflowBusinessBindingSummary({ businessAppId: 'legacy:unknown' }), '业务应用：legacy:unknown')
assert.equal(formatWorkflowBusinessBindingSummary({ businessAppId: ' table:custom.orders ' }), '旧按表绑定：custom.orders')
assert.equal(formatWorkflowBusinessBindingSummary({}), '')
assert.equal(formatWorkflowBusinessBindingSummary({ businessAppId: 'missing' }), '已绑定业务应用')
assert.equal(formatWorkflowBusinessBindingSummary({
  businessAppId: '99',
  businessApps: [{ id: 99, name: '订单', config: '{"table":"custom.orders"}' }]
}), '业务应用：订单（custom.orders）')
assert.equal(formatWorkflowBusinessBindingSummary({
  businessAppId: 'app-a',
  businessApps: [{ id: 'app-a', name: '审批', config: '{bad' }]
}), '业务应用：审批')

assert.equal(resolveConfiguredTaskBusinessBinding({
  taskId: ' Task_A ',
  taskBindings: { Task_A: ' app-a ' },
  globalBinding: 'global-app'
}), 'app-a')
assert.equal(resolveConfiguredTaskBusinessBinding({
  taskId: 'Task_Out',
  taskName: '成品出库',
  globalBinding: 'legacy:mms_inventory_stock_in'
}), 'legacy:mms_inventory_stock_out')
assert.equal(resolveConfiguredTaskBusinessBinding({
  taskId: 'stock_in_review',
  taskName: 'Review',
  globalBinding: 'legacy:mms_inventory_stock_out'
}), 'legacy:mms_inventory_stock_in')
assert.equal(resolveConfiguredTaskBusinessBinding({
  taskId: 'Task_A',
  taskName: 'General review',
  globalBinding: ' legacy:mms_inventory_stock_in '
}), 'legacy:mms_inventory_stock_in')
assert.equal(resolveConfiguredTaskBusinessBinding({ globalBinding: ' app-a ' }), 'app-a')

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
  'const parseSchemaTable =',
  'const extractBusinessDocNo =',
  'const isAutoAdvanceSatisfied =',
  'const resolveBoundStateTarget =',
  'const workflowBusinessAppId = computed(() => {',
  'const workflowTaskBusinessAppBindings = computed(() => {',
  'const ids = new Set()',
  'const values = new Set(WORKFLOW_STATUS_ORDER)',
  "permission_mode: String(policy.permission_mode || cfg.permission_mode || 'compat')",
  "workflowPolicyEffective.value.permission_mode === 'strict' ? 'danger' : 'success'"
]) {
  assert.equal(runtimeSource.includes(removedDefinition), false, `AppRuntime reintroduced ${removedDefinition}`)
}
assert.ok(runtimeSource.split(/\r?\n/).length <= 4033)

console.log('PASS: AppRuntime workflow policy preserves states, approvals, permissions, generated rules and legacy bindings')
