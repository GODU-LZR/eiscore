// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildProductionIssueForm,
  buildProductionIssuePushRow,
  buildProductionIssueSavePayload,
  buildProductionRowActions,
  buildProductionWorkOrderForm,
  buildProductionWorkOrderSavePayload,
  calculateProductionIssueShortage,
  formatProductionDateInput,
  inferProductionIssueStatus
} from '../../eiscore-production/src/domain/production-grid-operation-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

const workOrderActions = buildProductionRowActions({
  row: { id: 1 },
  appKey: 'work_orders',
  canEditRows: true,
  canPushWorkOrder: true
})
assert.deepEqual(workOrderActions.map(({ key, type }) => ({ key, type })), [
  { key: 'edit-work-order', type: 'primary' },
  { key: 'push-work-order', type: 'success' }
])
assert.equal(workOrderActions[0].sopAction, 'production-row-edit-work-order')
assert.equal(workOrderActions[0].sopSteps.length, 4)
assert.equal(workOrderActions[1].sopRisk, '未生产、未检验或数量错误的工单不能直接下推。')

const workOrderActionsAgain = buildProductionRowActions({
  row: { id: 1 }, appKey: 'work_orders', canEditRows: true, canPushWorkOrder: true
})
assert.notEqual(workOrderActionsAgain[0], workOrderActions[0])
assert.notEqual(workOrderActionsAgain[0].sopSteps, workOrderActions[0].sopSteps)
assert.deepEqual(buildProductionRowActions({
  row: { id: 1 }, appKey: 'work_orders', canEditRows: false, canPushWorkOrder: true
}).map(({ key }) => key), ['push-work-order'])
assert.deepEqual(buildProductionRowActions({
  row: { id: 2 }, appKey: 'work_order_items', canEditRows: true, canPushIssue: true
}).map(({ key, type }) => ({ key, type })), [
  { key: 'edit-issue', type: 'primary' },
  { key: 'push-issue', type: 'warning' }
])
assert.deepEqual(buildProductionRowActions({ row: { id: 1 }, appKey: 'plans' }), [])
assert.deepEqual(buildProductionRowActions({ appKey: 'work_orders', canEditRows: true }), [])

assert.equal(formatProductionDateInput('2026-09-01T12:00:00.000Z'), '2026-09-01')
assert.equal(formatProductionDateInput(null), '')
assert.deepEqual(buildProductionWorkOrderForm({
  work_order_status: '进行中',
  priority: '紧急',
  planned_qty: '12.5',
  unit: '件',
  planned_start_date: '2026-09-01T00:00:00.000Z',
  planned_finish_date: '2026-09-03',
  remark: '按期完成'
}), {
  work_order_status: '进行中',
  priority: '紧急',
  planned_qty: 12.5,
  unit: '件',
  planned_start_date: '2026-09-01',
  planned_finish_date: '2026-09-03',
  remark: '按期完成'
})
assert.deepEqual(buildProductionWorkOrderForm(), {
  work_order_status: '待排产',
  priority: '普通',
  planned_qty: 0,
  unit: '',
  planned_start_date: '',
  planned_finish_date: '',
  remark: ''
})

assert.deepEqual(buildProductionIssueForm({
  issued_qty: '3', shortage_qty: '2', issue_status: '部分领料', remark: '先领一批'
}), { issued_qty: 3, shortage_qty: 2, issue_status: '部分领料', remark: '先领一批' })
assert.deepEqual(buildProductionIssueForm(), {
  issued_qty: 0, shortage_qty: 0, issue_status: '未领料', remark: ''
})

assert.equal(calculateProductionIssueShortage(10, 3), 7)
assert.equal(calculateProductionIssueShortage(10, 12), 0)
assert.equal(Number.isNaN(calculateProductionIssueShortage('bad', 2)), true)
assert.equal(inferProductionIssueStatus(10, 10), '已齐套')
assert.equal(inferProductionIssueStatus(3, 10), '部分领料')
assert.equal(inferProductionIssueStatus(0, 10), '未领料')
assert.equal(inferProductionIssueStatus(3, 0), '部分领料')

assert.deepEqual(buildProductionWorkOrderSavePayload({
  work_order_status: '',
  priority: '',
  planned_qty: '7.5',
  unit: '',
  planned_start_date: '',
  planned_finish_date: '2026-09-10',
  remark: ''
}), {
  work_order_status: '待排产',
  priority: '普通',
  planned_qty: 7.5,
  unit: '盒',
  planned_start_date: null,
  planned_finish_date: '2026-09-10',
  remark: null
})

const issuePayload = buildProductionIssueSavePayload({
  form: { issued_qty: '4', shortage_qty: 99, issue_status: '', remark: '' },
  requiredQty: 10,
  shortageQty: 6
})
assert.deepEqual(issuePayload, {
  issued_qty: 4,
  shortage_qty: 6,
  issue_status: '部分领料',
  remark: null
})
assert.deepEqual(buildProductionIssueSavePayload({
  form: { issued_qty: 10, issue_status: '手工确认', remark: '已核对' },
  requiredQty: 10,
  shortageQty: 0
}), { issued_qty: 10, shortage_qty: 0, issue_status: '手工确认', remark: '已核对' })

assert.deepEqual(buildProductionIssuePushRow({
  id: 8,
  issue_status: '未领料',
  properties: { keep: true, issued_qty: 1 }
}, issuePayload), {
  id: 8,
  issued_qty: 4,
  shortage_qty: 6,
  issue_status: '部分领料',
  remark: null,
  properties: { keep: true, issued_qty: 4, issue_status: '部分领料' }
})

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-production/src/domain/production-grid-operation-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request', 'axios', 'window.', 'document.', 'localStorage', 'Date.now', 'Math.random']) {
  assert.equal(moduleSource.includes(forbidden), false, `production grid operation policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-production/src/components/ProductionAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/production-grid-operation-policy['"]/)
for (const removedDefinition of [
  'const formatDateValue =',
  'const inferIssueStatus =',
  'const resolveRowActions = (row) => {',
  'work_order_status: workOrderDrawer.form.work_order_status',
  'issued_qty: Number(issueDrawer.form.issued_qty'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `ProductionAppGrid reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildProductionRowActions({',
  'buildProductionWorkOrderForm(target)',
  'buildProductionIssueForm(target)',
  'buildProductionWorkOrderSavePayload(workOrderDrawer.form)',
  'buildProductionIssueSavePayload({',
  'buildProductionIssuePushRow(row, payload)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `ProductionAppGrid lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2163)

console.log('PASS: ProductionAppGrid operation policy preserves row actions, drawer forms and save payloads')
