// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildEnterpriseTargetHref,
  buildWorkflowOpenNavigationPlan,
  buildWorkflowRecordNavigationPlan,
  buildWorkflowRecordTabKey,
  buildWorkflowRouteQuery,
  resolveBindingDisplayName,
  resolveLegacyBusinessRoute,
  toHostRoutePath
} from '../../eiscore-apps/src/domain/app-runtime-navigation-policy.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const row = {
  id: ' 42 ',
  business_key: ' 123 ',
  current_task_id: ' Task_A ',
  definition_id: ' Definition_Row '
}

assert.deepEqual(resolveLegacyBusinessRoute('legacy:hr_employee', '123'), {
  path: '/hr/employee/detail/123',
  query: { appKey: 'a' }
})
assert.deepEqual(resolveLegacyBusinessRoute('legacy:hr_employee', 'EMP-1'), { path: '/hr/employee' })
assert.deepEqual(resolveLegacyBusinessRoute('legacy:hr_change', '9'), {
  path: '/hr/employee/detail/9',
  query: { appKey: 'b' }
})
assert.deepEqual(resolveLegacyBusinessRoute('legacy:mms_ledger', '8'), {
  path: '/materials/material/detail/8',
  query: { appKey: 'a' }
})
for (const [binding, path] of [
  ['legacy:hr_attendance', '/hr/app/c'],
  ['legacy:hr_user', '/hr/users'],
  ['legacy:mms_inventory_ledger', '/materials/inventory-ledger'],
  ['legacy:mms_inventory_stock_in', '/materials/inventory-stock-in'],
  ['legacy:mms_inventory_stock_out', '/materials/inventory-stock-out'],
  ['legacy:mms_inventory_current', '/materials/inventory-current'],
  ['legacy:mms_bom', '/materials/bom'],
  ['legacy:sales_order', '/sales/app/orders'],
  ['legacy:purchase_demand', '/purchase/app/demands'],
  ['legacy:production_work_order', '/production/app/work_orders']
]) {
  assert.deepEqual(resolveLegacyBusinessRoute(binding, 'KEY'), { path })
}
assert.equal(resolveLegacyBusinessRoute('legacy:unknown', '1'), null)

for (const path of [
  '/app/a',
  '/workflow-designer/a',
  '/flash-builder/a',
  '/data-app/a',
  '/config-center/a',
  '/ontology-relations/a'
]) {
  assert.equal(toHostRoutePath(path), `/apps${path}`)
}
assert.equal(toHostRoutePath(' /hr/users '), '/hr/users')
assert.equal(toHostRoutePath(''), '')
assert.equal(buildEnterpriseTargetHref({
  path: ' /app/a ',
  query: { text: 'a b', zero: 0, flag: false, empty: ' ', nil: null }
}), '/app/a?text=a+b&zero=0&flag=false')
assert.equal(buildEnterpriseTargetHref({ path: '/app/a' }, { hostPath: true }), '/apps/app/a')
assert.equal(buildEnterpriseTargetHref({ query: { a: 1 } }), '')

assert.deepEqual(buildWorkflowRouteQuery({
  row,
  definitionId: 'Definition_Fallback',
  workflowAppId: ' App_1 '
}), {
  wf_instance: '42',
  wf_key: '123',
  wf_task: 'Task_A',
  wf_definition: 'Definition_Row',
  wf_app: 'App_1',
  wf_from: 'workflow_runtime'
})
assert.deepEqual(buildWorkflowRouteQuery({ definitionId: ' D ', workflowAppId: '' }), {
  wf_definition: 'D',
  wf_from: 'workflow_runtime'
})

assert.equal(resolveBindingDisplayName('', []), '业务处理')
assert.equal(resolveBindingDisplayName('legacy:sales_order', []), '销售订单')
assert.equal(resolveBindingDisplayName('app-1', [{ id: ' app-1 ', name: ' 销售审批 ' }]), '销售审批')
assert.equal(resolveBindingDisplayName('missing', []), '业务处理')

const openLegacy = buildWorkflowOpenNavigationPlan({
  row,
  targetBinding: 'legacy:hr_employee',
  workflowAppId: 'workflow-app'
})
assert.equal(openLegacy.allowCrossMicro, true)
assert.equal(openLegacy.target.path, '/hr/employee/detail/123')
assert.equal(openLegacy.target.query.appKey, 'a')
assert.equal(openLegacy.target.query.wf_instance, '42')
assert.deepEqual(buildWorkflowOpenNavigationPlan({
  row,
  targetBinding: 'business-app',
  workflowAppId: 'workflow-app'
}), {
  target: {
    path: '/app/business-app',
    query: {
      wf_instance: '42',
      wf_key: '123',
      wf_task: 'Task_A',
      wf_definition: 'Definition_Row',
      wf_app: 'workflow-app',
      wf_from: 'workflow_runtime'
    }
  },
  allowCrossMicro: false
})
assert.equal(buildWorkflowOpenNavigationPlan({ row, targetBinding: 'legacy:unknown' }), null)
assert.equal(buildWorkflowOpenNavigationPlan({ row }), null)

const stockIn = buildWorkflowRecordNavigationPlan({
  row,
  targetBinding: 'legacy:mms_inventory_stock_in',
  recordId: ' draft/1 ',
  workflowAppId: 'workflow-app'
})
assert.equal(stockIn.target.path, '/materials/inventory-draft/detail/draft%2F1')
assert.equal(stockIn.target.query.draftType, 'in')
assert.equal(stockIn.allowCrossMicro, true)
const stockOut = buildWorkflowRecordNavigationPlan({
  row,
  targetBinding: 'legacy:mms_inventory_stock_out',
  recordId: 'draft-2',
  boundDraftType: ' custom '
})
assert.equal(stockOut.target.query.draftType, 'custom')
const legacyRecord = buildWorkflowRecordNavigationPlan({
  row: { ...row, business_key: 'EMP-X' },
  targetBinding: 'legacy:hr_employee',
  recordId: 'record-1'
})
assert.equal(legacyRecord.target.path, '/hr/employee')
assert.equal(legacyRecord.allowCrossMicro, true)
const appRecord = buildWorkflowRecordNavigationPlan({
  row,
  targetBinding: 'business-app',
  recordId: ' record-1 '
})
assert.equal(appRecord.target.path, '/app/business-app')
assert.equal(appRecord.target.query.wf_row_id, 'record-1')
assert.equal(appRecord.allowCrossMicro, false)
const unknownLegacyRecord = buildWorkflowRecordNavigationPlan({
  row,
  targetBinding: 'legacy:unknown',
  recordId: 'record-2'
})
assert.equal(unknownLegacyRecord.target.path, '/app/legacy:unknown')
assert.equal(unknownLegacyRecord.allowCrossMicro, false)
assert.equal(buildWorkflowRecordNavigationPlan({ row, recordId: 'record-1' }), null)
assert.equal(buildWorkflowRecordNavigationPlan({ row, targetBinding: 'business-app' }), null)
assert.equal(buildWorkflowRecordTabKey({ row, recordId: ' R1 ', workflowAppId: ' App ' }), 'App: 42 :R1:record')
assert.equal(buildWorkflowRecordTabKey({ row: { id: 7 }, recordId: 8 }), 'workflow:7:8:record')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/domain/app-runtime-navigation-policy.mjs'), 'utf8')
for (const forbidden of ['from \'vue\'', 'vue-router', 'element-plus', 'axios', 'window.', 'document.', 'localStorage']) {
  assert.equal(moduleSource.includes(forbidden), false, `navigation policy gained runtime dependency: ${forbidden}`)
}

const runtimeSource = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/AppRuntime.vue'), 'utf8')
assert.match(runtimeSource, /from ['"]@\/domain\/app-runtime-navigation-policy\.mjs['"]/)
for (const removedDefinition of [
  'function resolveLegacyBusinessRoute(',
  'function buildEnterpriseTargetHref(',
  'function toHostRoutePath(',
  'function buildWorkflowRouteQuery('
]) {
  assert.equal(runtimeSource.includes(removedDefinition), false, `AppRuntime reintroduced ${removedDefinition}`)
}
assert.ok(runtimeSource.split(/\r?\n/).length <= 4172)

console.log('PASS: AppRuntime navigation policy preserves legacy routes, hosted paths, workflow queries and record targets')
