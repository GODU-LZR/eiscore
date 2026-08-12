// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Module = require('node:module')

process.env.DOCUMENT_RECALCULATION_POLL_INTERVAL_MS = 'bad-interval'
process.env.DOCUMENT_RECALCULATION_PG_POOL_MAX = 'bad-pool'
process.env.DOCUMENT_RECALCULATION_MAX_ATTEMPTS = '3'
process.env.DOCUMENT_RECALCULATION_RETRY_DELAY_SECONDS = '30'
process.env.PGPORT = 'bad-port'

const baseTask = {
  id: 'task-1',
  correction_id: 'correction-1',
  business_link_id: 'link-1',
  target_schema: 'app_data',
  target_table: 'purchase_receipts',
  target_record_id: 'PR-001',
  task_type: 'business_result_recalculation',
  status: 'pending',
  priority: 50,
  requested_by: 'warehouse-user',
  requested_at: '2026-06-19T01:05:01.000Z',
  attempt_count: 0,
  metadata: {},
  field_name: 'quantity',
  old_value: '10',
  new_value: '12',
  corrected_by: 'warehouse-user',
  asset_id: 'asset-1',
  target_module: 'purchase',
  target_document_type: '采购入库单',
  target_app_id: 'purchase-app'
}

const state = {
  poolOptions: null,
  claims: [],
  queries: [],
  inventoryTransactionRows: [],
  processingUpdates: [],
  taskStatusUpdates: [],
  correctionUpdates: [],
  businessLinkUpdates: [],
  objectExists: new Set(),
  hrDocumentRecords: [],
  hrAttendanceRecords: [],
  hrMonthlySummaryRows: [],
  hrSnapshotUpserts: []
}

function resetState() {
  state.claims = []
  state.queries = []
  state.inventoryTransactionRows = []
  state.processingUpdates = []
  state.taskStatusUpdates = []
  state.correctionUpdates = []
  state.businessLinkUpdates = []
  state.objectExists = new Set()
  state.hrDocumentRecords = []
  state.hrAttendanceRecords = []
  state.hrMonthlySummaryRows = []
  state.hrSnapshotUpserts = []
}

class FakeClient {
  async query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
    state.queries.push({ sql, params })
    if (['begin', 'commit', 'rollback'].includes(normalized)) return { rows: [] }
    if (
      normalized.includes('from public.ai_business_recalculation_tasks t') &&
      normalized.includes('for update of t skip locked')
    ) {
      const row = state.claims.shift()
      return { rows: row ? [row] : [] }
    }
    if (
      normalized.startsWith('update public.ai_business_recalculation_tasks') &&
      normalized.includes("status = 'processing'")
    ) {
      state.processingUpdates.push(params)
      return { rows: [] }
    }
    if (normalized.includes('from scm.inventory_transactions')) {
      const targetRecordId = String(params[0] ?? '')
      const rows = state.inventoryTransactionRows
        .filter((row) => [row.transaction_no, row.id, row.batch_id].map((item) => String(item ?? '')).includes(targetRecordId))
        .map((row) => ({
          ...row,
          matched_by: row.transaction_no === targetRecordId ? 'transaction_no' : (String(row.id ?? '') === targetRecordId ? 'id' : 'batch_id')
        }))
      return { rows: rows.slice(0, 1) }
    }
    if (normalized.includes('select to_regclass')) {
      return { rows: [{ object_name: state.objectExists.has(String(params[0] ?? '')) ? String(params[0] ?? '') : null }] }
    }
    if (normalized.includes('from hr.document_intake_records')) {
      const targetRecordId = String(params[0] ?? '')
      const rows = state.hrDocumentRecords.filter((row) =>
        String(row.record_no ?? '') === targetRecordId || String(row.id ?? '') === targetRecordId
      )
      return { rows: rows.slice(0, 1) }
    }
    if (normalized.includes('from hr.attendance_records') && normalized.includes('where id::text = $1')) {
      const targetRecordId = String(params[0] ?? '')
      const rows = state.hrAttendanceRecords.filter((row) => String(row.id ?? '') === targetRecordId)
      return { rows: rows.slice(0, 1) }
    }
    if (normalized.includes('from hr.attendance_records') && normalized.includes('jsonb_agg')) {
      return { rows: state.hrMonthlySummaryRows.slice(0, 1) }
    }
    if (normalized.includes('insert into hr.attendance_month_recalculation_snapshots')) {
      state.hrSnapshotUpserts.push(params)
      return { rows: [{ id: 'snapshot-1', employee_month_key: params[0] }] }
    }
    if (
      normalized.startsWith('update public.ai_business_recalculation_tasks') &&
      normalized.includes('status = $2')
    ) {
      state.taskStatusUpdates.push(params)
      return { rows: [] }
    }
    if (normalized.startsWith('update public.ai_business_corrections')) {
      state.correctionUpdates.push(params)
      return { rows: [] }
    }
    if (normalized.startsWith('update public.document_business_links')) {
      state.businessLinkUpdates.push(params)
      return { rows: [] }
    }
    throw new Error(`Unexpected recalculation worker query: ${normalized}`)
  }

  release() {}
}

class FakePool {
  constructor(options) {
    state.poolOptions = options
  }

  async connect() {
    return new FakeClient()
  }

  async end() {}
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') return { Pool: FakePool }
  return originalLoad.call(this, request, parent, isMain)
}

const modulePath = '../../realtime/document-recalculation.js'
delete require.cache[require.resolve(modulePath)]
const {
  createDocumentRecalculationWorker,
  buildAdapterKeys,
  buildMissingAdapterOutcome,
  normalizeAdapterOutcome,
  calculateRetryDelaySeconds,
  normalizeMonth,
  buildHrAttendanceMonthKey,
  buildHrAttendanceMonthlySnapshot
} = require(modulePath)
Module._load = originalLoad

assert.equal(state.poolOptions.port, 5432, 'invalid PGPORT env should fall back to 5432')
assert.equal(state.poolOptions.max, 2, 'invalid recalculation pool max env should fall back to 2')
assert.deepEqual(
  buildAdapterKeys(baseTask).slice(0, 3),
  [
    'business_result_recalculation:app_data.purchase_receipts',
    'app_data.purchase_receipts',
    'business_result_recalculation'
  ],
  'adapter keys should prefer task type plus fully-qualified target'
)
assert.equal(buildMissingAdapterOutcome(baseTask).status, 'manual_review_required')
assert.equal(normalizeAdapterOutcome({ status: 'completed', message: 'ok' }, baseTask).status, 'completed')
assert.equal(calculateRetryDelaySeconds(2), 60, 'retry delay should scale with attempt count')
assert.equal(normalizeMonth('2026-6-17'), '2026-06')
assert.equal(buildHrAttendanceMonthKey({ employeeId: '1001', month: '2026-06-17' }), '1001:2026-06')
assert.equal(buildHrAttendanceMonthKey({ employeeNo: 'NP2024001', month: '2026-06' }), 'NP2024001:2026-06')

const pureHrSnapshot = buildHrAttendanceMonthlySnapshot({
  subject: {
    employee_id: '1001',
    employee_no: 'NP2024001',
    employee_name: '张生产',
    dept_name: '生产一部',
    month: '2026-06'
  },
  monthly: {
    record_count: 2,
    leave_count: 1,
    absent_count: 0,
    late_count: 1,
    early_count: 0,
    overtime_minutes: 150,
    first_att_date: '2026-06-01',
    last_att_date: '2026-06-17',
    records: [{ id: 'att-1' }]
  },
  task: {
    ...baseTask,
    target_schema: 'hr',
    target_table: 'document_intake_records',
    target_record_id: 'HR-20260617-002'
  }
})
assert.equal(pureHrSnapshot.employee_month_key, '1001:2026-06')
assert.equal(pureHrSnapshot.overtime_minutes, 150)
assert.equal(pureHrSnapshot.summary.monthly_records.length, 1)

resetState()
state.claims.push({ ...baseTask })
const manualReviewWorker = createDocumentRecalculationWorker({ workerId: 'test-worker', log: silentLog() })
assert.equal(await manualReviewWorker.runOnce(), true, 'worker should process one pending task without adapters')
assert.equal(state.processingUpdates.length, 1, 'worker should claim the task as processing')
assert.equal(state.processingUpdates[0][1], 'test-worker')
assert.equal(state.taskStatusUpdates.at(-1)[1], 'manual_review_required')
assert.match(state.taskStatusUpdates.at(-1)[2], /No recalculation adapter configured/)
assert.equal(state.correctionUpdates.at(-1)[1], 'manual_review_required')
assert.equal(JSON.parse(state.businessLinkUpdates.at(-1)[1]).last_recalculation_status, 'manual_review_required')

resetState()
state.claims.push({ ...baseTask })
const completedWorker = createDocumentRecalculationWorker({
  workerId: 'test-worker',
  log: silentLog(),
  adapters: {
    'business_result_recalculation:app_data.purchase_receipts': async (task) => ({
      status: 'completed',
      message: `rebuilt ${task.target_record_id}`,
      metadata: { adapter_result: 'ok' }
    })
  }
})
assert.equal(await completedWorker.runOnce(), true, 'worker should process a task through an adapter')
assert.equal(state.taskStatusUpdates.at(-1)[1], 'completed')
assert.equal(state.taskStatusUpdates.at(-1)[2], 'rebuilt PR-001')
assert.equal(JSON.parse(state.taskStatusUpdates.at(-1)[3]).adapter_result, 'ok')
assert.equal(state.correctionUpdates.at(-1)[1], 'completed')

resetState()
state.inventoryTransactionRows.push({
  id: '0f1735f7-dde8-4c6d-932e-416db0f27c17',
  transaction_no: 'IN-20260619001',
  transaction_type: '入库',
  material_id: 1001,
  batch_id: '11c26b5b-b9e3-4e48-bd10-7418761d3054',
  batch_no: 'B20260619',
  warehouse_id: '97fd5d47-a209-4519-a766-dcf7ebe138f6',
  quantity: '12.5000',
  unit: 'kg',
  before_qty: null,
  after_qty: '42.5000',
  related_doc_type: '采购入库单',
  related_doc_no: 'PO-20260619',
  transaction_date: '2026-06-19T08:30:00.000Z',
  operator: 'warehouse-user',
  approval_status: '已完成',
  created_by: 'warehouse-user',
  created_at: '2026-06-19T08:30:01.000Z'
})
state.claims.push({
  ...baseTask,
  id: 'task-scm-1',
  target_schema: 'scm',
  target_table: 'inventory_transactions',
  target_record_id: 'IN-20260619001'
})
const scmWorker = createDocumentRecalculationWorker({ workerId: 'test-worker', log: silentLog() })
assert.equal(await scmWorker.runOnce(), true, 'worker should verify an SCM inventory transaction through the default adapter')
assert.equal(state.taskStatusUpdates.at(-1)[1], 'completed')
assert.match(state.taskStatusUpdates.at(-1)[2], /SCM inventory transaction verified/)
{
  const metadata = JSON.parse(state.taskStatusUpdates.at(-1)[3])
  assert.equal(metadata.adapter, 'scm.inventory_transactions.verify_v1')
  assert.equal(metadata.no_stock_mutation, true)
  assert.equal(metadata.matched_by, 'transaction_no')
  assert.equal(metadata.inventory_transaction.transaction_no, 'IN-20260619001')
  assert.equal(metadata.inventory_transaction.after_qty, '42.5000')
}

resetState()
state.claims.push({
  ...baseTask,
  id: 'task-scm-missing',
  target_schema: 'scm',
  target_table: 'inventory_transactions',
  target_record_id: 'IN-MISSING'
})
const missingScmWorker = createDocumentRecalculationWorker({ workerId: 'test-worker', log: silentLog() })
assert.equal(await missingScmWorker.runOnce(), true, 'worker should require manual review when SCM transaction is missing')
assert.equal(state.taskStatusUpdates.at(-1)[1], 'manual_review_required')
assert.match(state.taskStatusUpdates.at(-1)[2], /SCM inventory transaction not found/)
{
  const metadata = JSON.parse(state.taskStatusUpdates.at(-1)[3])
  assert.equal(metadata.adapter, 'scm.inventory_transactions.verify_v1')
  assert.equal(metadata.target_missing, true)
  assert.equal(metadata.no_stock_mutation, true)
}

resetState()
state.objectExists = new Set([
  'hr.attendance_records',
  'hr.document_intake_records',
  'hr.attendance_month_recalculation_snapshots'
])
state.hrDocumentRecords.push({
  id: 'hr-record-1',
  record_no: 'HR-20260617-002',
  record_date: '2026-06-17',
  employee_no: 'NP2024001',
  employee_name: '张生产',
  department: '生产一部',
  position: '操作员',
  event_type: '加班',
  attendance_record_id: 'attendance-1',
  attendance_sync_status: 'synced'
})
state.hrAttendanceRecords.push({
  id: 'attendance-1',
  att_date: '2026-06-17',
  person_type: 'employee',
  employee_id: '1001',
  employee_name: '张生产',
  employee_no: 'NP2024001',
  dept_name: '生产一部',
  leave_flag: false,
  absent_flag: false,
  late_flag: false,
  early_flag: false,
  overtime_minutes: 150
})
state.hrMonthlySummaryRows.push({
  month: '2026-06',
  record_count: 17,
  leave_count: 1,
  absent_count: 0,
  late_count: 2,
  early_count: 1,
  overtime_minutes: 210,
  first_att_date: '2026-06-01',
  last_att_date: '2026-06-17',
  records: [{ id: 'attendance-1', att_date: '2026-06-17', overtime_minutes: 150 }]
})
state.claims.push({
  ...baseTask,
  id: 'task-hr-1',
  target_schema: 'hr',
  target_table: 'document_intake_records',
  target_record_id: 'HR-20260617-002',
  target_module: 'hr',
  target_document_type: '人事记录',
  field_name: 'overtime_hours',
  old_value: '2',
  new_value: '2.5'
})
const hrWorker = createDocumentRecalculationWorker({ workerId: 'test-worker', log: silentLog() })
assert.equal(await hrWorker.runOnce(), true, 'worker should rebuild an HR attendance monthly snapshot through the default adapter')
assert.equal(state.taskStatusUpdates.at(-1)[1], 'completed')
assert.match(state.taskStatusUpdates.at(-1)[2], /HR attendance month snapshot rebuilt/)
assert.equal(state.hrSnapshotUpserts.length, 1, 'HR adapter should upsert one attendance monthly snapshot')
assert.equal(state.hrSnapshotUpserts[0][0], '1001:2026-06')
assert.equal(state.hrSnapshotUpserts[0][5], '2026-06')
assert.equal(state.hrSnapshotUpserts[0][11], 210)
assert.ok(
  state.queries.some((item) => {
    const sql = String(item.sql).replace(/\s+/g, ' ').toLowerCase()
    return sql.includes('insert into hr.attendance_month_recalculation_snapshots') &&
      sql.includes("confirmation_status = 'pending_confirmation'") &&
      sql.includes("payroll_precheck_status = 'not_requested'")
  }),
  'HR snapshot rebuild should reset confirmation and payroll precheck state when a snapshot is recalculated'
)
{
  const metadata = JSON.parse(state.taskStatusUpdates.at(-1)[3])
  assert.equal(metadata.adapter, 'hr.attendance_month_snapshot.rebuild_v1')
  assert.equal(metadata.no_payroll_mutation, true)
  assert.equal(metadata.employee_month_key, '1001:2026-06')
  assert.equal(metadata.attendance_month_snapshot.record_count, 17)
}

resetState()
state.objectExists = new Set(['hr.attendance_records'])
state.claims.push({
  ...baseTask,
  id: 'task-hr-missing-snapshot',
  target_schema: 'hr',
  target_table: 'document_intake_records',
  target_record_id: 'HR-20260617-002'
})
const missingHrSnapshotWorker = createDocumentRecalculationWorker({ workerId: 'test-worker', log: silentLog() })
assert.equal(await missingHrSnapshotWorker.runOnce(), true, 'worker should require manual review when HR snapshot table is missing')
assert.equal(state.taskStatusUpdates.at(-1)[1], 'manual_review_required')
assert.match(state.taskStatusUpdates.at(-1)[2], /snapshot table is missing/)
{
  const metadata = JSON.parse(state.taskStatusUpdates.at(-1)[3])
  assert.equal(metadata.adapter, 'hr.attendance_month_snapshot.rebuild_v1')
  assert.equal(metadata.missing_table, 'hr.attendance_month_recalculation_snapshots')
  assert.equal(metadata.no_payroll_mutation, true)
}

resetState()
state.claims.push({ ...baseTask, attempt_count: 1 })
const retryWorker = createDocumentRecalculationWorker({
  workerId: 'test-worker',
  log: silentLog(),
  adapters: {
    'app_data.purchase_receipts': async () => {
      throw new Error('temporary database outage')
    }
  }
})
assert.equal(await retryWorker.runOnce(), true, 'worker should process a failing task')
assert.equal(state.taskStatusUpdates.at(-1)[1], 'pending')
assert.equal(state.taskStatusUpdates.at(-1)[2], 'temporary database outage')
assert.equal(state.taskStatusUpdates.at(-1)[3], '60 seconds')
assert.equal(state.correctionUpdates.at(-1)[1], 'pending')
assert.equal(JSON.parse(state.businessLinkUpdates.at(-1)[1]).last_recalculation_status, 'pending')

resetState()
state.claims.push({ ...baseTask, attempt_count: 2 })
const exhaustedWorker = createDocumentRecalculationWorker({
  workerId: 'test-worker',
  log: silentLog(),
  adapters: {
    '*': async () => {
      throw new Error('permanent formula failure')
    }
  }
})
assert.equal(await exhaustedWorker.runOnce(), true, 'worker should process an exhausted failing task')
assert.equal(state.taskStatusUpdates.at(-1)[1], 'failed')
assert.equal(state.taskStatusUpdates.at(-1)[2], 'permanent formula failure')
assert.equal(state.correctionUpdates.at(-1)[1], 'failed')
assert.equal(JSON.parse(state.businessLinkUpdates.at(-1)[1]).last_recalculation_status, 'failed')

console.log('PASS: document recalculation regression')

function silentLog() {
  return {
    info() {},
    warn(...args) {
      if (process.env.DEBUG_RECALCULATION_TEST) console.warn(...args)
    }
  }
}
