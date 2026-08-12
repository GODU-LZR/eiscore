// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const os = require('os');
const { Pool } = require('pg');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

const recalculationWorkerEnabled = envText(process.env.DOCUMENT_RECALCULATION_WORKER_ENABLED, 'true').toLowerCase() !== 'false';
const pollIntervalMs = positiveInteger(process.env.DOCUMENT_RECALCULATION_POLL_INTERVAL_MS, 15000, { min: 2000, max: 10 * 60 * 1000 });
const maxAttempts = positiveInteger(process.env.DOCUMENT_RECALCULATION_MAX_ATTEMPTS, 5, { min: 1, max: 50 });
const retryDelaySeconds = positiveInteger(process.env.DOCUMENT_RECALCULATION_RETRY_DELAY_SECONDS, 120, { min: 5, max: 24 * 60 * 60 });

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: positiveInteger(process.env.PGPORT, 5432, { min: 1, max: 65535 }),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  max: positiveInteger(process.env.DOCUMENT_RECALCULATION_PG_POOL_MAX, 2, { min: 1, max: 20 })
});

function normalizeText(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function toPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeJson(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function buildAdapterKeys(task) {
  const taskType = normalizeText(task.task_type || task.taskType || 'business_result_recalculation', 120);
  const targetSchema = normalizeText(task.target_schema || task.targetSchema || '', 120);
  const targetTable = normalizeText(task.target_table || task.targetTable || '', 160);
  const qualifiedTarget = targetSchema && targetTable ? `${targetSchema}.${targetTable}` : '';
  return [
    taskType && qualifiedTarget ? `${taskType}:${qualifiedTarget}` : '',
    qualifiedTarget,
    taskType,
    '*'
  ].filter(Boolean);
}

function resolveAdapter(adapters, task) {
  const registry = toPlainObject(adapters);
  for (const key of buildAdapterKeys(task)) {
    if (typeof registry[key] === 'function') {
      return { key, handler: registry[key] };
    }
  }
  return { key: '', handler: null };
}

function normalizeAdapterOutcome(value, task, adapterKey = '') {
  const outcome = typeof value === 'string' ? { status: value } : toPlainObject(value);
  const status = normalizeText(outcome.status || 'completed', 80).toLowerCase();
  if (status === 'completed') {
    return {
      status: 'completed',
      message: normalizeText(outcome.message || outcome.summary || 'Recalculation completed', 2000),
      metadata: {
        recalculation_worker_status: 'completed',
        adapter_key: adapterKey,
        ...(toPlainObject(outcome.metadata))
      }
    };
  }

  if (status === 'manual_review_required') {
    return {
      status: 'manual_review_required',
      message: normalizeText(outcome.message || outcome.summary || 'Recalculation requires manual review', 2000),
      metadata: {
        recalculation_worker_status: 'manual_review_required',
        adapter_key: adapterKey,
        ...(toPlainObject(outcome.metadata))
      }
    };
  }

  throw new Error(`Unsupported recalculation adapter status: ${status || '(empty)'}`);
}

function buildMissingAdapterOutcome(task) {
  const target = [task.target_schema, task.target_table, task.target_record_id].map((item) => normalizeText(item, 200)).filter(Boolean).join('.');
  return {
    status: 'manual_review_required',
    message: `No recalculation adapter configured for ${target || 'target record'}`,
    metadata: {
      recalculation_worker_status: 'manual_review_required',
      adapter_missing: true,
      adapter_candidates: buildAdapterKeys(task)
    }
  };
}

function calculateRetryDelaySeconds(attemptCount) {
  return retryDelaySeconds * Math.min(6, Math.max(1, Number(attemptCount) || 1));
}

function buildInventoryTransactionSnapshot(row) {
  const source = toPlainObject(row);
  return {
    id: source.id ? String(source.id) : null,
    transaction_no: source.transaction_no || null,
    transaction_type: source.transaction_type || null,
    material_id: source.material_id ?? null,
    batch_id: source.batch_id ? String(source.batch_id) : null,
    batch_no: source.batch_no || null,
    warehouse_id: source.warehouse_id ? String(source.warehouse_id) : null,
    quantity: source.quantity ?? null,
    unit: source.unit || null,
    before_qty: source.before_qty ?? null,
    after_qty: source.after_qty ?? null,
    related_doc_type: source.related_doc_type || null,
    related_doc_no: source.related_doc_no || null,
    transaction_date: source.transaction_date || null,
    operator: source.operator || null,
    approval_status: source.approval_status || null,
    created_by: source.created_by || null,
    created_at: source.created_at || null
  };
}

async function recalculateScmInventoryTransaction(task, context = {}) {
  const targetRecordId = normalizeText(task.target_record_id || task.targetRecordId, 240);
  if (!targetRecordId) {
    return {
      status: 'manual_review_required',
      message: 'SCM inventory transaction target record id is empty',
      metadata: {
        adapter: 'scm.inventory_transactions.verify_v1',
        target_missing: true,
        target_record_id_missing: true,
        no_stock_mutation: true
      }
    };
  }

  const activePool = context.pool || pool;
  const client = await activePool.connect();
  try {
    const result = await client.query(
      `select
         id::text as id,
         transaction_no,
         transaction_type,
         material_id,
         batch_id::text as batch_id,
         batch_no,
         warehouse_id::text as warehouse_id,
         quantity::text as quantity,
         unit,
         before_qty::text as before_qty,
         after_qty::text as after_qty,
         related_doc_type,
         related_doc_no,
         transaction_date::text as transaction_date,
         operator,
         approval_status,
         created_by,
         created_at::text as created_at,
         case
           when transaction_no = $1 then 'transaction_no'
           when id::text = $1 then 'id'
           when batch_id::text = $1 then 'batch_id'
           else 'unknown'
         end as matched_by
       from scm.inventory_transactions
       where transaction_no = $1
          or id::text = $1
          or batch_id::text = $1
       order by
         case
           when transaction_no = $1 then 0
           when id::text = $1 then 1
           when batch_id::text = $1 then 2
           else 3
         end,
         transaction_date desc nulls last,
         created_at desc nulls last
       limit 1`,
      [targetRecordId]
    );
    const row = result.rows[0];
    if (!row) {
      return {
        status: 'manual_review_required',
        message: `SCM inventory transaction not found for ${targetRecordId}`,
        metadata: {
          adapter: 'scm.inventory_transactions.verify_v1',
          target_missing: true,
          target_record_id: targetRecordId,
          no_stock_mutation: true
        }
      };
    }

    const snapshot = buildInventoryTransactionSnapshot(row);
    return {
      status: 'completed',
      message: `SCM inventory transaction verified: ${snapshot.transaction_no || snapshot.id}`,
      metadata: {
        adapter: 'scm.inventory_transactions.verify_v1',
        domain: 'scm_inventory',
        domain_recalculation: 'verified_existing_inventory_transaction',
        no_stock_mutation: true,
        target_missing: false,
        matched_by: row.matched_by || 'unknown',
        inventory_transaction: snapshot
      }
    };
  } finally {
    client.release();
  }
}

function normalizeMonth(value) {
  const text = normalizeText(value, 80);
  const match = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (!match) return '';
  return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
}

function buildHrAttendanceMonthKey({ employeeId = '', employeeNo = '', employeeName = '', month = '' } = {}) {
  const identity = normalizeText(employeeId, 120)
    || normalizeText(employeeNo, 120)
    || normalizeText(employeeName, 160);
  const normalizedMonth = normalizeMonth(month);
  return identity && normalizedMonth ? `${identity}:${normalizedMonth}` : '';
}

function buildHrAttendanceMonthlySnapshot({ subject = {}, monthly = {}, task = {} } = {}) {
  const month = normalizeMonth(subject.month || monthly.month || subject.att_date || subject.record_date);
  const employeeId = normalizeText(subject.employee_id, 120);
  const employeeNo = normalizeText(subject.employee_no, 120);
  const employeeName = normalizeText(subject.employee_name, 160);
  const employeeMonthKey = buildHrAttendanceMonthKey({ employeeId, employeeNo, employeeName, month });
  const numeric = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    employee_month_key: employeeMonthKey,
    employee_id: employeeId || null,
    employee_no: employeeNo || null,
    employee_name: employeeName || '',
    dept_name: normalizeText(subject.dept_name || subject.department, 160) || null,
    month,
    record_count: numeric(monthly.record_count),
    leave_count: numeric(monthly.leave_count),
    absent_count: numeric(monthly.absent_count),
    late_count: numeric(monthly.late_count),
    early_count: numeric(monthly.early_count),
    overtime_minutes: numeric(monthly.overtime_minutes),
    first_att_date: monthly.first_att_date || null,
    last_att_date: monthly.last_att_date || null,
    source_target_schema: normalizeText(task.target_schema, 120) || null,
    source_target_table: normalizeText(task.target_table, 160) || null,
    source_target_record_id: normalizeText(task.target_record_id, 240) || null,
    last_task_id: task.id || null,
    last_correction_id: task.correction_id || null,
    last_business_link_id: task.business_link_id || null,
    summary: {
      ai_generated: true,
      source: 'document_recalculation_worker',
      corrected_field_name: task.field_name || '',
      corrected_by: task.corrected_by || task.requested_by || '',
      old_value: task.old_value ?? null,
      new_value: task.new_value ?? null,
      target_module: task.target_module || '',
      target_document_type: task.target_document_type || '',
      monthly_records: Array.isArray(monthly.records) ? monthly.records.slice(0, 80) : []
    }
  };
}

async function databaseObjectExists(client, regclassName) {
  const result = await client.query(
    `select to_regclass($1)::text as object_name`,
    [regclassName]
  );
  return Boolean(result.rows[0]?.object_name);
}

async function findHrDocumentIntakeRecord(client, targetRecordId) {
  const normalized = normalizeText(targetRecordId, 240);
  if (!normalized) return null;
  const hasTable = await databaseObjectExists(client, 'hr.document_intake_records');
  if (!hasTable) return null;
  const result = await client.query(
    `select
       id::text as id,
       record_no,
       record_date::text as record_date,
       employee_no,
       employee_name,
       department,
       position,
       event_type,
       attendance_record_id,
       attendance_sync_status
     from hr.document_intake_records
     where record_no = $1
        or id::text = $1
     order by created_at asc nulls last, id asc
     limit 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

async function findHrAttendanceRecord(client, targetRecordId) {
  const normalized = normalizeText(targetRecordId, 240);
  if (!normalized) return null;
  const hasTable = await databaseObjectExists(client, 'hr.attendance_records');
  if (!hasTable) return null;
  const result = await client.query(
    `select
       id::text as id,
       att_date::text as att_date,
       person_type,
       employee_id::text as employee_id,
       employee_name,
       employee_no,
       dept_name,
       leave_flag,
       absent_flag,
       late_flag,
       early_flag,
       overtime_minutes
     from hr.attendance_records
     where id::text = $1
     limit 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

async function resolveHrAttendanceSubject(client, task) {
  const targetRecordId = normalizeText(task.target_record_id || task.targetRecordId, 240);
  if (!targetRecordId) {
    return { subject: null, reason: 'HR attendance recalculation target record id is empty' };
  }

  if (normalizeText(task.target_schema, 120) === 'hr' && normalizeText(task.target_table, 160) === 'attendance_records') {
    const attendanceRecord = await findHrAttendanceRecord(client, targetRecordId);
    if (!attendanceRecord) return { subject: null, reason: `HR attendance record not found for ${targetRecordId}` };
    return {
      subject: {
        ...attendanceRecord,
        month: normalizeMonth(attendanceRecord.att_date),
        source_record_kind: 'attendance_record'
      },
      reason: ''
    };
  }

  const documentRecord = await findHrDocumentIntakeRecord(client, targetRecordId);
  if (!documentRecord) return { subject: null, reason: `HR document intake record not found for ${targetRecordId}` };

  if (documentRecord.attendance_record_id) {
    const attendanceRecord = await findHrAttendanceRecord(client, documentRecord.attendance_record_id);
    if (attendanceRecord) {
      return {
        subject: {
          ...attendanceRecord,
          month: normalizeMonth(attendanceRecord.att_date),
          source_record_kind: 'document_intake_attendance_record',
          hr_document_record: documentRecord
        },
        reason: ''
      };
    }
  }

  return {
    subject: {
      employee_id: '',
      employee_no: documentRecord.employee_no || '',
      employee_name: documentRecord.employee_name || '',
      dept_name: documentRecord.department || '',
      att_date: documentRecord.record_date || '',
      month: normalizeMonth(documentRecord.record_date),
      source_record_kind: 'document_intake_record',
      hr_document_record: documentRecord
    },
    reason: ''
  };
}

async function queryHrAttendanceMonthlySummary(client, subject) {
  const month = normalizeMonth(subject.month || subject.att_date);
  if (!month) return null;
  const employeeId = normalizeText(subject.employee_id, 120);
  const employeeNo = normalizeText(subject.employee_no, 120);
  const employeeName = normalizeText(subject.employee_name, 160);
  if (!employeeId && !employeeNo && !employeeName) return null;

  const result = await client.query(
    `select
       $3::text as month,
       count(*)::integer as record_count,
       count(*) filter (where coalesce(leave_flag, false))::integer as leave_count,
       count(*) filter (where coalesce(absent_flag, false))::integer as absent_count,
       count(*) filter (where coalesce(late_flag, false))::integer as late_count,
       count(*) filter (where coalesce(early_flag, false))::integer as early_count,
       coalesce(sum(coalesce(overtime_minutes, 0)), 0)::integer as overtime_minutes,
       min(att_date)::text as first_att_date,
       max(att_date)::text as last_att_date,
       jsonb_agg(
         jsonb_build_object(
           'id', id::text,
           'att_date', att_date::text,
           'employee_id', employee_id::text,
           'employee_no', employee_no,
           'employee_name', employee_name,
           'leave_flag', coalesce(leave_flag, false),
           'absent_flag', coalesce(absent_flag, false),
           'late_flag', coalesce(late_flag, false),
           'early_flag', coalesce(early_flag, false),
           'overtime_minutes', coalesce(overtime_minutes, 0)
         )
         order by att_date asc
       ) filter (where id is not null) as records
     from hr.attendance_records
     where person_type = 'employee'
       and att_date >= ($3 || '-01')::date
       and att_date < (($3 || '-01')::date + interval '1 month')
       and (
         ($1 <> '' and employee_id::text = $1)
         or ($2 <> '' and employee_no = $2)
         or ($4 <> '' and employee_name = $4)
       )`,
    [employeeId, employeeNo, month, employeeName]
  );
  return result.rows[0] || null;
}

async function upsertHrAttendanceMonthlySnapshot(client, snapshot) {
  const result = await client.query(
    `insert into hr.attendance_month_recalculation_snapshots (
       employee_month_key, employee_id, employee_no, employee_name, dept_name, month,
       record_count, leave_count, absent_count, late_count, early_count, overtime_minutes,
       first_att_date, last_att_date,
       source_target_schema, source_target_table, source_target_record_id,
       last_task_id, last_correction_id, last_business_link_id, summary
     ) values (
       $1,$2,$3,$4,$5,$6,
       $7,$8,$9,$10,$11,$12,
       $13::date,$14::date,
       $15,$16,$17,
       $18,$19,$20,$21::jsonb
     )
     on conflict (employee_month_key) do update set
       employee_id = excluded.employee_id,
       employee_no = excluded.employee_no,
       employee_name = excluded.employee_name,
       dept_name = excluded.dept_name,
       record_count = excluded.record_count,
       leave_count = excluded.leave_count,
       absent_count = excluded.absent_count,
       late_count = excluded.late_count,
       early_count = excluded.early_count,
       overtime_minutes = excluded.overtime_minutes,
       first_att_date = excluded.first_att_date,
       last_att_date = excluded.last_att_date,
       source_target_schema = excluded.source_target_schema,
       source_target_table = excluded.source_target_table,
       source_target_record_id = excluded.source_target_record_id,
       last_task_id = excluded.last_task_id,
       last_correction_id = excluded.last_correction_id,
       last_business_link_id = excluded.last_business_link_id,
       summary = excluded.summary,
       confirmation_status = 'pending_confirmation',
       confirmation_note = null,
       confirmed_by = null,
       confirmed_at = null,
       rejected_by = null,
       rejected_at = null,
       rejection_reason = null,
       payroll_precheck_status = 'not_requested',
       payroll_precheck_requested_by = null,
       payroll_precheck_requested_at = null,
       payroll_precheck_note = null,
       recalculated_at = now(),
       updated_at = now()
     returning id::text as id, employee_month_key`,
    [
      snapshot.employee_month_key,
      snapshot.employee_id,
      snapshot.employee_no,
      snapshot.employee_name,
      snapshot.dept_name,
      snapshot.month,
      snapshot.record_count,
      snapshot.leave_count,
      snapshot.absent_count,
      snapshot.late_count,
      snapshot.early_count,
      snapshot.overtime_minutes,
      snapshot.first_att_date,
      snapshot.last_att_date,
      snapshot.source_target_schema,
      snapshot.source_target_table,
      snapshot.source_target_record_id,
      snapshot.last_task_id,
      snapshot.last_correction_id,
      snapshot.last_business_link_id,
      JSON.stringify(snapshot.summary || {})
    ]
  );
  return result.rows[0] || null;
}

async function recalculateHrAttendanceMonth(task, context = {}) {
  const activePool = context.pool || pool;
  const client = await activePool.connect();
  try {
    const hasAttendanceTable = await databaseObjectExists(client, 'hr.attendance_records');
    if (!hasAttendanceTable) {
      return {
        status: 'manual_review_required',
        message: 'HR attendance records table is missing',
        metadata: {
          adapter: 'hr.attendance_month_snapshot.rebuild_v1',
          target_missing: true,
          missing_table: 'hr.attendance_records',
          no_payroll_mutation: true
        }
      };
    }
    const hasSnapshotTable = await databaseObjectExists(client, 'hr.attendance_month_recalculation_snapshots');
    if (!hasSnapshotTable) {
      return {
        status: 'manual_review_required',
        message: 'HR attendance monthly recalculation snapshot table is missing; apply sql/patch_document_intake_hr_records.sql',
        metadata: {
          adapter: 'hr.attendance_month_snapshot.rebuild_v1',
          target_missing: true,
          missing_table: 'hr.attendance_month_recalculation_snapshots',
          no_payroll_mutation: true
        }
      };
    }

    const resolution = await resolveHrAttendanceSubject(client, task);
    if (!resolution.subject) {
      return {
        status: 'manual_review_required',
        message: resolution.reason || 'HR attendance recalculation subject could not be resolved',
        metadata: {
          adapter: 'hr.attendance_month_snapshot.rebuild_v1',
          target_missing: true,
          no_payroll_mutation: true
        }
      };
    }

    const monthly = await queryHrAttendanceMonthlySummary(client, resolution.subject);
    const snapshot = buildHrAttendanceMonthlySnapshot({
      subject: resolution.subject,
      monthly: monthly || {},
      task
    });
    if (!snapshot.employee_month_key) {
      return {
        status: 'manual_review_required',
        message: 'HR attendance recalculation could not determine employee/month',
        metadata: {
          adapter: 'hr.attendance_month_snapshot.rebuild_v1',
          subject_resolution: resolution.subject,
          no_payroll_mutation: true
        }
      };
    }

    const persisted = await upsertHrAttendanceMonthlySnapshot(client, snapshot);
    return {
      status: 'completed',
      message: `HR attendance month snapshot rebuilt: ${snapshot.employee_month_key}`,
      metadata: {
        adapter: 'hr.attendance_month_snapshot.rebuild_v1',
        domain: 'hr_attendance',
        domain_recalculation: 'attendance_month_snapshot_rebuilt',
        no_payroll_mutation: true,
        target_missing: false,
        snapshot_id: persisted?.id || null,
        employee_month_key: snapshot.employee_month_key,
        attendance_month_snapshot: snapshot
      }
    };
  } finally {
    client.release();
  }
}

function buildDefaultAdapters() {
  return {
    'business_result_recalculation:scm.inventory_transactions': recalculateScmInventoryTransaction,
    'scm.inventory_transactions': recalculateScmInventoryTransaction,
    'business_result_recalculation:hr.document_intake_records': recalculateHrAttendanceMonth,
    'hr.document_intake_records': recalculateHrAttendanceMonth,
    'business_result_recalculation:hr.attendance_records': recalculateHrAttendanceMonth,
    'hr.attendance_records': recalculateHrAttendanceMonth
  };
}

class DocumentRecalculationWorker {
  constructor(options = {}) {
    this.log = options.log || console;
    this.adapters = {
      ...buildDefaultAdapters(),
      ...toPlainObject(options.adapters)
    };
    this.workerId = normalizeText(options.workerId || `${os.hostname()}-${process.pid}`, 160);
    this.timer = null;
    this.running = false;
    this.stopping = false;
  }

  start() {
    if (!recalculationWorkerEnabled) {
      this.log.info?.('[document-recalculation] worker disabled');
      return;
    }
    if (this.timer) return;
    this.stopping = false;
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        this.log.warn?.('[document-recalculation] run failed:', error?.message || error);
      });
    }, pollIntervalMs);
    this.timer.unref?.();
    this.runOnce().catch((error) => {
      this.log.warn?.('[document-recalculation] initial run failed:', error?.message || error);
    });
    this.log.info?.(`[document-recalculation] worker started, interval=${pollIntervalMs}ms`);
  }

  async shutdown() {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await pool.end().catch(() => {});
  }

  async runOnce() {
    if (this.running || this.stopping) return false;
    this.running = true;
    try {
      let processed = false;
      while (!this.stopping) {
        const task = await this.claimTask();
        if (!task) break;
        processed = true;
        await this.processTask(task);
      }
      return processed;
    } finally {
      this.running = false;
    }
  }

  async claimTask() {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(
        `select
           t.*,
           c.field_name,
           c.old_value,
           c.new_value,
           c.corrected_by,
           l.asset_id,
           l.target_module,
           l.target_document_type,
           l.target_app_id
         from public.ai_business_recalculation_tasks t
         left join public.ai_business_corrections c on c.id = t.correction_id
         left join public.document_business_links l on l.id = t.business_link_id
        where t.status = 'pending'
          and coalesce(t.next_attempt_at, t.requested_at) <= now()
          and t.attempt_count < $1
        order by t.priority desc, t.requested_at asc, t.id asc
        for update of t skip locked
        limit 1`,
        [maxAttempts]
      );
      const task = result.rows[0] || null;
      if (!task) {
        await client.query('commit');
        return null;
      }

      const nextAttemptCount = Number(task.attempt_count || 0) + 1;
      const startedAt = new Date().toISOString();
      await client.query(
        `update public.ai_business_recalculation_tasks
            set status = 'processing',
                attempt_count = attempt_count + 1,
                locked_at = now(),
                locked_by = $2,
                last_error = null,
                metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
          where id = $1`,
        [
          task.id,
          this.workerId,
          JSON.stringify({
            recalculation_started_at: startedAt,
            recalculation_worker_id: this.workerId,
            recalculation_attempt_count: nextAttemptCount
          })
        ]
      );
      await client.query('commit');
      return {
        ...task,
        status: 'processing',
        attempt_count: nextAttemptCount,
        locked_by: this.workerId,
        metadata: {
          ...safeJson(task.metadata, {}),
          recalculation_started_at: startedAt,
          recalculation_worker_id: this.workerId,
          recalculation_attempt_count: nextAttemptCount
        }
      };
    } catch (error) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async processTask(task) {
    const adapter = resolveAdapter(this.adapters, task);
    try {
      const rawOutcome = adapter.handler
        ? await adapter.handler(task, { pool, workerId: this.workerId, log: this.log })
        : buildMissingAdapterOutcome(task);
      const outcome = normalizeAdapterOutcome(rawOutcome, task, adapter.key);
      await this.applyOutcome(task, outcome);
      this.log.info?.(`[document-recalculation] ${outcome.status}: ${task.id}`);
      return outcome;
    } catch (error) {
      await this.markFailedOrRetry(task, error);
      this.log.warn?.(`[document-recalculation] failed ${task.id}:`, error?.message || error);
      return null;
    }
  }

  async applyOutcome(task, outcome) {
    const status = outcome.status === 'completed' ? 'completed' : 'manual_review_required';
    const finishedAt = new Date().toISOString();
    const metadataPatch = {
      ...(toPlainObject(outcome.metadata)),
      recalculation_finished_at: finishedAt,
      recalculation_worker_id: this.workerId,
      recalculation_attempt_count: Number(task.attempt_count || 0),
      recalculation_message: outcome.message || ''
    };

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `update public.ai_business_recalculation_tasks
            set status = $2,
                completed_at = case when $2 = 'completed' then now() else completed_at end,
                last_error = $3,
                next_attempt_at = null,
                locked_at = null,
                locked_by = null,
                metadata = coalesce(metadata, '{}'::jsonb) || $4::jsonb
          where id = $1`,
        [task.id, status, outcome.message || null, JSON.stringify(metadataPatch)]
      );
      if (task.correction_id) {
        await client.query(
          `update public.ai_business_corrections
              set recalculation_status = $2,
                  metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
            where id = $1`,
          [
            task.correction_id,
            status,
            JSON.stringify({
              last_recalculation_task_id: task.id,
              last_recalculation_status: status,
              last_recalculation_at: finishedAt,
              last_recalculation_message: outcome.message || ''
            })
          ]
        );
      }
      if (task.business_link_id) {
        await client.query(
          `update public.document_business_links
              set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
            where id = $1`,
          [
            task.business_link_id,
            JSON.stringify({
              last_recalculation_task_id: task.id,
              last_recalculation_status: status,
              last_recalculation_at: finishedAt,
              last_recalculation_message: outcome.message || ''
            })
          ]
        );
      }
      await client.query('commit');
    } catch (error) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async markFailedOrRetry(task, error) {
    const attemptCount = Number(task.attempt_count || 0);
    const exhausted = attemptCount >= maxAttempts;
    const status = exhausted ? 'failed' : 'pending';
    const message = normalizeText(error?.message || String(error || 'Recalculation failed'), 2000);
    const nextDelay = calculateRetryDelaySeconds(attemptCount);
    const failedAt = new Date().toISOString();
    const metadataPatch = {
      recalculation_worker_status: status,
      recalculation_worker_id: this.workerId,
      recalculation_attempt_count: attemptCount,
      recalculation_last_error: message,
      recalculation_last_failed_at: failedAt,
      recalculation_retry_delay_seconds: exhausted ? null : nextDelay
    };

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `update public.ai_business_recalculation_tasks
            set status = $2,
                last_error = $3,
                next_attempt_at = case when $2 = 'pending' then now() + ($4::text)::interval else null end,
                completed_at = case when $2 = 'failed' then now() else completed_at end,
                locked_at = null,
                locked_by = null,
                metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb
          where id = $1`,
        [task.id, status, message, `${nextDelay} seconds`, JSON.stringify(metadataPatch)]
      );
      if (task.correction_id) {
        await client.query(
          `update public.ai_business_corrections
              set recalculation_status = $2,
                  metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb
            where id = $1`,
          [
            task.correction_id,
            status,
            JSON.stringify({
              last_recalculation_task_id: task.id,
              last_recalculation_status: status,
              last_recalculation_error: message,
              last_recalculation_at: failedAt
            })
          ]
        );
      }
      if (task.business_link_id) {
        await client.query(
          `update public.document_business_links
              set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
            where id = $1`,
          [
            task.business_link_id,
            JSON.stringify({
              last_recalculation_task_id: task.id,
              last_recalculation_status: status,
              last_recalculation_error: message,
              last_recalculation_at: failedAt
            })
          ]
        );
      }
      await client.query('commit');
    } catch (markError) {
      try { await client.query('rollback'); } catch { /* ignore */ }
      throw markError;
    } finally {
      client.release();
    }
  }
}

function createDocumentRecalculationWorker(options = {}) {
  return new DocumentRecalculationWorker(options);
}

module.exports = {
  createDocumentRecalculationWorker,
  buildAdapterKeys,
  resolveAdapter,
  normalizeAdapterOutcome,
  buildMissingAdapterOutcome,
  calculateRetryDelaySeconds,
  recalculateScmInventoryTransaction,
  normalizeMonth,
  buildHrAttendanceMonthKey,
  buildHrAttendanceMonthlySnapshot,
  recalculateHrAttendanceMonth
};
