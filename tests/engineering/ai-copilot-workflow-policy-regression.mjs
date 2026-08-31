// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildAiWorkflowAclModule,
  buildAiWorkflowOps,
  getAiAppCenterProfileHeaders,
  getAiFirstRow,
  getAiPublicProfileHeaders,
  getAiWorkflowProfileHeaders,
  inferAiWorkflowBusinessAppId,
  normalizeAiWorkflowAssignmentRows,
  normalizeAiWorkflowAssociatedTable,
  normalizeAiWorkflowBindingValue,
  normalizeAiWorkflowBool,
  normalizeAiWorkflowList,
  normalizeAiWorkflowStateMappingRows,
  normalizeAiWorkflowTaskBindings,
  resolveAiWorkflowAssociatedTable,
  toAiWorkflowArray
} from '../../eiscore-base/src/domain/ai-copilot-workflow-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

for (const [input, expected] of [
  ['', ''],
  ['/api/sales_orders?select=*', 'public.sales_orders'],
  ['hr_archives', 'hr.archives'],
  ['scm/inventory_drafts', 'scm.inventory_drafts'],
  ['custom_table', 'public.custom_table'],
  ['Custom.Schema', 'Custom.Schema']
]) {
  assert.equal(normalizeAiWorkflowAssociatedTable(input), expected)
}
assert.equal(resolveAiWorkflowAssociatedTable({ associated_table: 'users' }, { apiUrl: '/ignored' }), 'public.users')
assert.equal(resolveAiWorkflowAssociatedTable({}, { workflowAssociatedTable: 'employee_changes' }), 'hr.employee_changes')
assert.equal(resolveAiWorkflowAssociatedTable({}, { importTarget: { apiUrl: '/api/purchase_demands' } }), 'public.purchase_demands')
assert.equal(resolveAiWorkflowAssociatedTable(), '')

assert.deepEqual(normalizeAiWorkflowList([' manager ', null, '']), ['manager'])
assert.deepEqual(normalizeAiWorkflowList('manager，finance; admin、owner'), ['manager', 'finance', 'admin', 'owner'])
assert.deepEqual(normalizeAiWorkflowList({}), [])
for (const value of ['true', '1', 'YES', '是', '需要']) assert.equal(normalizeAiWorkflowBool(value), true)
for (const value of ['false', '0', 'No', '否', '不需要']) assert.equal(normalizeAiWorkflowBool(value, true), false)
assert.equal(normalizeAiWorkflowBool('unknown', true), true)
assert.equal(normalizeAiWorkflowBool(false, true), false)

const sourceArray = [{ task_id: 'Task_A' }]
assert.equal(toAiWorkflowArray(sourceArray), sourceArray)
assert.deepEqual(toAiWorkflowArray({ Task_A: { roles: 'manager' }, Task_B: 'done' }), [
  { roles: 'manager', task_id: 'Task_A' },
  { task_id: 'Task_B', value: 'done' }
])
assert.deepEqual(toAiWorkflowArray(null), [])

assert.equal(normalizeAiWorkflowBindingValue('legacy:custom'), 'legacy:custom')
assert.equal(normalizeAiWorkflowBindingValue('table:sales_orders'), 'table:public.sales_orders')
assert.equal(normalizeAiWorkflowBindingValue('sales_orders'), 'legacy:sales_order')
assert.equal(normalizeAiWorkflowBindingValue('custom-binding'), 'custom-binding')
assert.equal(inferAiWorkflowBusinessAppId({ business_app_id: 'users' }), 'legacy:hr_user')
assert.equal(inferAiWorkflowBusinessAppId({}, 'purchase_demands'), 'legacy:purchase_demand')
assert.equal(inferAiWorkflowBusinessAppId({}, 'public.custom_table'), 'table:public.custom_table')
assert.equal(inferAiWorkflowBusinessAppId(), '')
assert.deepEqual(normalizeAiWorkflowTaskBindings({
  taskBusinessAppBindings: {
    Task_A: 'sales_orders',
    Task_B: 'table:custom_table',
    ' ': 'users',
    Task_C: 'legacy:global'
  }
}, 'legacy:global'), {
  Task_A: 'legacy:sales_order',
  Task_B: 'table:public.custom_table'
})
assert.deepEqual(normalizeAiWorkflowTaskBindings({ taskBusinessAppBindings: [] }), {})

assert.deepEqual(getAiWorkflowProfileHeaders(), {
  'Content-Type': 'application/json', Accept: 'application/json',
  'Accept-Profile': 'workflow', 'Content-Profile': 'workflow'
})
assert.equal(getAiPublicProfileHeaders('return=representation').Prefer, 'return=representation')
assert.equal(getAiAppCenterProfileHeaders()['Accept-Profile'], 'app_center')
assert.deepEqual(getAiFirstRow([{ id: 1 }, { id: 2 }]), { id: 1 })
assert.equal(getAiFirstRow([]), null)
assert.deepEqual(getAiFirstRow({ id: 1 }), { id: 1 })
assert.equal(getAiFirstRow(null), null)
assert.equal(buildAiWorkflowAclModule('a-b-c'), 'app_abc')
assert.equal(buildAiWorkflowAclModule(''), '')
assert.deepEqual(buildAiWorkflowOps('app_abc'), {
  create: 'op:app_abc.create', edit: 'op:app_abc.edit', delete: 'op:app_abc.delete',
  export: 'op:app_abc.export', config: 'op:app_abc.config',
  workflowStart: 'op:app_abc.workflow_start', workflowTransition: 'op:app_abc.workflow_transition',
  workflowComplete: 'op:app_abc.workflow_complete'
})
assert.deepEqual(buildAiWorkflowOps(''), {})

assert.deepEqual(normalizeAiWorkflowAssignmentRows({ assignments: {
  Task_A: { candidateRoles: 'manager，finance', candidateUsers: ['u1', ''], approvalMode: 'QUOTA', requiredApprovals: '2.9', requireComment: '是' },
  Task_B: { roles: 'owner', approval_mode: 'invalid', required_approvals: 0 },
  ' ': { roles: 'ignored' }
} }, 'definition-1'), [
  {
    definition_id: 'definition-1', task_id: 'Task_A', candidate_roles: ['manager', 'finance'], candidate_users: ['u1'],
    approval_mode: 'quota', required_approvals: 2, require_comment: true
  },
  {
    definition_id: 'definition-1', task_id: 'Task_B', candidate_roles: ['owner'], candidate_users: [],
    approval_mode: 'any', required_approvals: 1, require_comment: false
  }
])
assert.deepEqual(normalizeAiWorkflowAssignmentRows(), [])

assert.deepEqual(normalizeAiWorkflowStateMappingRows({ stateMappings: {
  Task_A: { stateValue: 'approved', stateField: 'audit_status' },
  Task_B: { status: 'done', targetTable: 'users' },
  Task_C: { stateValue: '' }
} }, 'workflow-app-1', 'sales_orders'), [
  {
    workflow_app_id: 'workflow-app-1', bpmn_task_id: 'Task_A', target_table: 'public.sales_orders',
    state_field: 'audit_status', state_value: 'approved'
  },
  {
    workflow_app_id: 'workflow-app-1', bpmn_task_id: 'Task_B', target_table: 'public.users',
    state_field: 'status', state_value: 'done'
  }
])
assert.deepEqual(normalizeAiWorkflowStateMappingRows({ stateMappings: { Task_A: { stateValue: 'done' } } }, 'app', ''), [])

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/ai-copilot-workflow-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request({', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `AI Copilot workflow policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ai-copilot-workflow-policy['"]/)
for (const removedDefinition of [
  'const WORKFLOW_TABLE_ALIASES =',
  'const WORKFLOW_TABLE_BINDINGS =',
  'const normalizeWorkflowAssociatedTable =',
  'const normalizeWorkflowList =',
  'const normalizeWorkflowBool =',
  'const toWorkflowArray =',
  'const normalizeWorkflowBindingValue =',
  'const inferWorkflowBusinessAppId =',
  'const normalizeWorkflowTaskBindings =',
  'const getWorkflowProfileHeaders =',
  'const getPublicProfileHeaders =',
  'const getAppCenterProfileHeaders =',
  'const buildWorkflowAclModule =',
  'const buildWorkflowOps =',
  'const normalizeWorkflowAssignmentRows =',
  'const normalizeWorkflowStateMappingRows ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `AiCopilot reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'resolveAiWorkflowAssociatedTable(',
  'normalizeWorkflowAssignmentRows(meta, definitionId)',
  'normalizeWorkflowStateMappingRows(meta, workflowAppId, associatedTable)'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `AiCopilot lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 4199)

console.log('PASS: AiCopilot workflow policy preserves tables, bindings, profiles, ACL, assignments and state mappings')
