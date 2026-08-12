-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: HR document intake records for AI fixed-module imports.

set client_encoding = 'UTF8';

begin;

create schema if not exists hr;
create extension if not exists pgcrypto;

create or replace function hr.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists hr.document_intake_records (
  id uuid primary key default gen_random_uuid(),
  record_no text not null unique,
  record_date date not null default current_date,
  employee_no text,
  employee_name text not null default '',
  department text,
  position text,
  event_type text not null default '其他',
  hours numeric(14, 2) not null default 0,
  overtime_hours numeric(14, 2) not null default 0,
  leave_hours numeric(14, 2) not null default 0,
  absence_hours numeric(14, 2) not null default 0,
  record_status text not null default 'active',
  attendance_record_id text,
  attendance_sync_status text not null default 'not_applicable',
  attendance_sync_message text,
  handler text,
  remark text,
  properties jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_intake_records_employee_check check (
    employee_no is not null
    or btrim(employee_name) <> ''
  ),
  constraint document_intake_records_event_type_check check (
    event_type in ('考勤', '请假', '加班', '出差', '调休', '入职', '离职', '调岗', '绩效', '培训', '其他')
  ),
  constraint document_intake_records_hours_check check (
    hours >= 0
    and overtime_hours >= 0
    and leave_hours >= 0
    and absence_hours >= 0
  ),
  constraint document_intake_records_status_check check (
    record_status in ('active', 'confirmed', 'pending_review', 'voided')
  ),
  constraint document_intake_records_attendance_sync_status_check check (
    attendance_sync_status in ('not_applicable', 'synced', 'skipped', 'failed')
  )
);

alter table if exists hr.document_intake_records
  add column if not exists attendance_record_id text;
alter table if exists hr.document_intake_records
  add column if not exists attendance_sync_status text not null default 'not_applicable';
alter table if exists hr.document_intake_records
  add column if not exists attendance_sync_message text;

create index if not exists idx_document_intake_records_date
  on hr.document_intake_records(record_date desc);
create index if not exists idx_document_intake_records_employee_no
  on hr.document_intake_records(employee_no);
create index if not exists idx_document_intake_records_employee_name
  on hr.document_intake_records(employee_name);
create index if not exists idx_document_intake_records_department
  on hr.document_intake_records(department);
create index if not exists idx_document_intake_records_event_type
  on hr.document_intake_records(event_type);
create index if not exists idx_document_intake_records_attendance_sync
  on hr.document_intake_records(attendance_sync_status);

create table if not exists hr.attendance_month_recalculation_snapshots (
  id uuid primary key default gen_random_uuid(),
  employee_month_key text not null unique,
  employee_id text,
  employee_no text,
  employee_name text not null default '',
  dept_name text,
  month text not null,
  record_count integer not null default 0,
  leave_count integer not null default 0,
  absent_count integer not null default 0,
  late_count integer not null default 0,
  early_count integer not null default 0,
  overtime_minutes integer not null default 0,
  first_att_date date,
  last_att_date date,
  source_target_schema text,
  source_target_table text,
  source_target_record_id text,
  last_task_id uuid,
  last_correction_id uuid,
  last_business_link_id uuid,
  summary jsonb not null default '{}'::jsonb,
  confirmation_status text not null default 'pending_confirmation',
  confirmation_note text,
  confirmed_by text,
  confirmed_at timestamptz,
  rejected_by text,
  rejected_at timestamptz,
  rejection_reason text,
  payroll_precheck_status text not null default 'not_requested',
  payroll_precheck_requested_by text,
  payroll_precheck_requested_at timestamptz,
  payroll_precheck_note text,
  recalculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_month_recalculation_snapshots_month_check check (month ~ '^\d{4}-\d{2}$'),
  constraint attendance_month_recalculation_snapshots_counts_check check (
    record_count >= 0
    and leave_count >= 0
    and absent_count >= 0
    and late_count >= 0
    and early_count >= 0
    and overtime_minutes >= 0
  )
);

alter table hr.attendance_month_recalculation_snapshots
  add column if not exists confirmation_status text not null default 'pending_confirmation',
  add column if not exists confirmation_note text,
  add column if not exists confirmed_by text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists rejected_by text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists payroll_precheck_status text not null default 'not_requested',
  add column if not exists payroll_precheck_requested_by text,
  add column if not exists payroll_precheck_requested_at timestamptz,
  add column if not exists payroll_precheck_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_month_recalc_confirmation_status_check'
      and conrelid = 'hr.attendance_month_recalculation_snapshots'::regclass
  ) then
    alter table hr.attendance_month_recalculation_snapshots
      add constraint attendance_month_recalc_confirmation_status_check
      check (confirmation_status in ('pending_confirmation', 'confirmed', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_month_recalc_payroll_precheck_status_check'
      and conrelid = 'hr.attendance_month_recalculation_snapshots'::regclass
  ) then
    alter table hr.attendance_month_recalculation_snapshots
      add constraint attendance_month_recalc_payroll_precheck_status_check
      check (payroll_precheck_status in ('not_requested', 'ready'));
  end if;
end;
$$;

create index if not exists idx_attendance_month_recalc_month
  on hr.attendance_month_recalculation_snapshots(month desc);
create index if not exists idx_attendance_month_recalc_employee_no
  on hr.attendance_month_recalculation_snapshots(employee_no);
create index if not exists idx_attendance_month_recalc_source
  on hr.attendance_month_recalculation_snapshots(source_target_schema, source_target_table, source_target_record_id);
create index if not exists idx_attendance_month_recalc_confirmation
  on hr.attendance_month_recalculation_snapshots(confirmation_status, month desc);
create index if not exists idx_attendance_month_recalc_payroll_precheck
  on hr.attendance_month_recalculation_snapshots(payroll_precheck_status, month desc);

drop trigger if exists trg_attendance_month_recalc_touch_updated_at on hr.attendance_month_recalculation_snapshots;
create trigger trg_attendance_month_recalc_touch_updated_at
before update on hr.attendance_month_recalculation_snapshots
for each row execute function hr.touch_updated_at();

drop trigger if exists trg_document_intake_records_touch_updated_at on hr.document_intake_records;
create trigger trg_document_intake_records_touch_updated_at
before update on hr.document_intake_records
for each row execute function hr.touch_updated_at();

create or replace view hr.v_document_intake_record_summary as
select
  date_trunc('month', record_date)::date as record_month,
  coalesce(department, '') as department,
  event_type,
  count(*)::integer as record_count,
  count(*) filter (where attendance_sync_status = 'synced')::integer as attendance_synced_count,
  count(*) filter (where attendance_sync_status = 'skipped')::integer as attendance_skipped_count,
  count(*) filter (where attendance_sync_status = 'failed')::integer as attendance_failed_count,
  sum(hours)::numeric(18, 2) as hours,
  sum(overtime_hours)::numeric(18, 2) as overtime_hours,
  sum(leave_hours)::numeric(18, 2) as leave_hours,
  sum(absence_hours)::numeric(18, 2) as absence_hours
from hr.document_intake_records
where record_status <> 'voided'
group by date_trunc('month', record_date)::date, coalesce(department, ''), event_type;

create or replace view hr.v_payroll_precheck_attendance_snapshots as
select
  s.id,
  s.id as snapshot_id,
  s.employee_month_key,
  s.employee_id,
  s.employee_no,
  s.employee_name,
  s.dept_name,
  s.month,
  s.record_count,
  s.leave_count,
  s.absent_count,
  s.late_count,
  s.early_count,
  s.overtime_minutes,
  s.first_att_date,
  s.last_att_date,
  s.source_target_schema,
  s.source_target_table,
  s.source_target_record_id,
  s.last_task_id,
  s.last_correction_id,
  s.last_business_link_id,
  s.summary,
  s.confirmation_status,
  s.confirmation_note,
  s.confirmed_by,
  s.confirmed_at,
  s.payroll_precheck_status,
  s.payroll_precheck_requested_by,
  s.payroll_precheck_requested_at,
  s.payroll_precheck_note,
  s.recalculated_at,
  s.created_at,
  s.updated_at,
  l.asset_id,
  a.original_filename,
  a.file_hash,
  a.upload_source,
  a.operator_source,
  a.uploaded_by_user_id,
  a.uploaded_by_username,
  a.uploaded_by_role,
  a.source_folder,
  a.metadata as asset_metadata,
  d.device_code,
  d.device_name,
  b.batch_no,
  b.status as batch_status,
  'ready'::text as precheck_status,
  true as read_only_reference,
  false as payroll_mutation_allowed,
  jsonb_build_object(
    'reference_table', 'hr.attendance_month_recalculation_snapshots',
    'snapshot_id', s.id,
    'employee_month_key', s.employee_month_key,
    'month', s.month,
    'employee_no', s.employee_no,
    'source_target_schema', s.source_target_schema,
    'source_target_table', s.source_target_table,
    'source_target_record_id', s.source_target_record_id,
    'no_payroll_mutation', true
  ) as payroll_reference
from hr.attendance_month_recalculation_snapshots s
left join public.document_business_links l on l.id = s.last_business_link_id
left join public.document_assets a on a.id = l.asset_id
left join public.collector_devices d on d.id = a.device_id
left join public.document_import_batches b on b.id = a.batch_id
where s.confirmation_status = 'confirmed'
  and s.payroll_precheck_status = 'ready';

create table if not exists hr.payroll_precheck_results (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null unique references hr.attendance_month_recalculation_snapshots(id) on delete cascade,
  employee_month_key text not null,
  employee_id text,
  employee_no text,
  employee_name text not null default '',
  dept_name text,
  month text not null,
  record_count integer not null default 0,
  leave_count integer not null default 0,
  absent_count integer not null default 0,
  late_count integer not null default 0,
  early_count integer not null default 0,
  overtime_minutes integer not null default 0,
  first_att_date date,
  last_att_date date,
  source_target_schema text,
  source_target_table text,
  source_target_record_id text,
  asset_id uuid,
  source_filename text,
  file_hash text,
  device_code text,
  device_name text,
  batch_no text,
  upload_source text,
  operator_source text,
  uploaded_by_user_id text,
  uploaded_by_username text,
  uploaded_by_role text,
  source_folder text,
  asset_metadata jsonb not null default '{}'::jsonb,
  batch_status text,
  trial_status text not null default 'draft',
  calculation_version text not null default 'attendance-precheck-v1',
  calculation_basis jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  generated_by text,
  generated_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  source_snapshot_reference jsonb not null default '{}'::jsonb,
  no_payroll_mutation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_precheck_results_month_check check (month ~ '^\d{4}-\d{2}$'),
  constraint payroll_precheck_results_counts_check check (
    record_count >= 0
    and leave_count >= 0
    and absent_count >= 0
    and late_count >= 0
    and early_count >= 0
    and overtime_minutes >= 0
  ),
  constraint payroll_precheck_results_status_check check (
    trial_status in ('draft', 'reviewed', 'approved', 'rejected')
  ),
  constraint payroll_precheck_results_no_payroll_mutation_check check (no_payroll_mutation = true)
);

alter table hr.payroll_precheck_results
  add column if not exists calculation_version text not null default 'attendance-precheck-v1',
  add column if not exists calculation_basis jsonb not null default '{}'::jsonb,
  add column if not exists result_payload jsonb not null default '{}'::jsonb,
  add column if not exists source_snapshot_reference jsonb not null default '{}'::jsonb,
  add column if not exists no_payroll_mutation boolean not null default true,
  add column if not exists upload_source text,
  add column if not exists operator_source text,
  add column if not exists uploaded_by_user_id text,
  add column if not exists uploaded_by_username text,
  add column if not exists uploaded_by_role text,
  add column if not exists source_folder text,
  add column if not exists asset_metadata jsonb not null default '{}'::jsonb,
  add column if not exists batch_status text;

create index if not exists idx_payroll_precheck_results_month
  on hr.payroll_precheck_results(month desc);
create index if not exists idx_payroll_precheck_results_employee_no
  on hr.payroll_precheck_results(employee_no);
create index if not exists idx_payroll_precheck_results_status
  on hr.payroll_precheck_results(trial_status, month desc);
create index if not exists idx_payroll_precheck_results_source_record
  on hr.payroll_precheck_results(source_target_schema, source_target_table, source_target_record_id);

drop trigger if exists trg_payroll_precheck_results_touch_updated_at on hr.payroll_precheck_results;
create trigger trg_payroll_precheck_results_touch_updated_at
before update on hr.payroll_precheck_results
for each row execute function hr.touch_updated_at();

create or replace view hr.v_payroll_ready_precheck_results as
select
  r.*,
  true as read_only_reference,
  false as payroll_mutation_allowed,
  jsonb_build_object(
    'reference_table', 'hr.payroll_precheck_results',
    'result_id', r.id,
    'snapshot_id', r.snapshot_id,
    'employee_month_key', r.employee_month_key,
    'month', r.month,
    'employee_no', r.employee_no,
    'source_target_schema', r.source_target_schema,
    'source_target_table', r.source_target_table,
    'source_target_record_id', r.source_target_record_id,
    'trial_status', r.trial_status,
    'calculation_version', r.calculation_version,
    'no_payroll_mutation', true
  ) as payroll_reference
from hr.payroll_precheck_results r
where r.trial_status = 'approved'
  and r.no_payroll_mutation = true;

alter table hr.document_intake_records enable row level security;
alter table hr.attendance_month_recalculation_snapshots enable row level security;
alter table hr.payroll_precheck_results enable row level security;

drop policy if exists document_intake_records_select on hr.document_intake_records;
drop policy if exists document_intake_records_insert on hr.document_intake_records;
drop policy if exists document_intake_records_update on hr.document_intake_records;
drop policy if exists document_intake_records_delete on hr.document_intake_records;
drop policy if exists attendance_month_recalc_select on hr.attendance_month_recalculation_snapshots;
drop policy if exists attendance_month_recalc_insert on hr.attendance_month_recalculation_snapshots;
drop policy if exists attendance_month_recalc_update on hr.attendance_month_recalculation_snapshots;
drop policy if exists attendance_month_recalc_delete on hr.attendance_month_recalculation_snapshots;
drop policy if exists payroll_precheck_results_select on hr.payroll_precheck_results;
drop policy if exists payroll_precheck_results_insert on hr.payroll_precheck_results;
drop policy if exists payroll_precheck_results_update on hr.payroll_precheck_results;
drop policy if exists payroll_precheck_results_delete on hr.payroll_precheck_results;
create policy document_intake_records_select on hr.document_intake_records for select to web_user, web_anon using (true);
create policy document_intake_records_insert on hr.document_intake_records for insert to web_user with check (true);
create policy document_intake_records_update on hr.document_intake_records for update to web_user using (true) with check (true);
create policy document_intake_records_delete on hr.document_intake_records for delete to web_user using (true);
create policy attendance_month_recalc_select on hr.attendance_month_recalculation_snapshots for select to web_user, web_anon using (true);
create policy attendance_month_recalc_insert on hr.attendance_month_recalculation_snapshots for insert to web_user with check (true);
create policy attendance_month_recalc_update on hr.attendance_month_recalculation_snapshots for update to web_user using (true) with check (true);
create policy attendance_month_recalc_delete on hr.attendance_month_recalculation_snapshots for delete to web_user using (true);
create policy payroll_precheck_results_select on hr.payroll_precheck_results for select to web_user, web_anon using (true);
create policy payroll_precheck_results_insert on hr.payroll_precheck_results for insert to web_user with check (no_payroll_mutation = true);
create policy payroll_precheck_results_update on hr.payroll_precheck_results for update to web_user using (true) with check (no_payroll_mutation = true);
create policy payroll_precheck_results_delete on hr.payroll_precheck_results for delete to web_user using (true);

grant select, insert, update, delete on hr.document_intake_records to web_user;
grant select on hr.document_intake_records to web_anon;
grant select, insert, update, delete on hr.attendance_month_recalculation_snapshots to web_user;
grant select on hr.attendance_month_recalculation_snapshots to web_anon;
grant select, insert, update, delete on hr.payroll_precheck_results to web_user;
grant select on hr.payroll_precheck_results to web_anon;
grant select on hr.v_document_intake_record_summary to web_user;
grant select on hr.v_document_intake_record_summary to web_anon;
grant select on hr.v_payroll_precheck_attendance_snapshots to web_user;
grant select on hr.v_payroll_precheck_attendance_snapshots to web_anon;
grant select on hr.v_payroll_ready_precheck_results to web_user;
grant select on hr.v_payroll_ready_precheck_results to web_anon;

do $$
begin
  if to_regclass('public.ontology_table_registry') is not null then
    insert into public.ontology_table_registry (
      schema_name, table_name, domain, entity_type, business_name, description, is_active, tags
    ) values
      ('hr', 'document_intake_records', 'hr', 'document_intake_record', '智能收单人事记录', 'AI 智能收单自动入库形成的人事事件记录，覆盖考勤、请假、加班、入职、离职、调岗、绩效和培训等资料', true, '["hr","document_intake","record"]'::jsonb),
      ('hr', 'v_document_intake_record_summary', 'hr', 'document_intake_record_summary', '智能收单人事记录汇总视图', '按月份、部门和人事事项汇总 AI 入库的人事记录，用于考勤、加班、请假和人员事件统计', true, '["hr","summary","document_intake"]'::jsonb),
      ('hr', 'attendance_month_recalculation_snapshots', 'hr', 'attendance_recalculation_snapshot', '考勤月度重算快照', '人工修正 AI 入库人事/考勤记录后，由重算 worker 生成的月度考勤快照，不直接修改薪资或月结结果', true, '["hr","attendance","recalculation","document_intake"]'::jsonb),
      ('hr', 'v_payroll_precheck_attendance_snapshots', 'hr', 'payroll_precheck_attendance_snapshot', '薪资前置考勤快照队列', '已确认并提交薪资前置审核的月度考勤快照只读队列，供薪资核算流程引用，不直接写入薪资结果', true, '["hr","payroll","attendance","precheck","document_intake"]'::jsonb),
      ('hr', 'payroll_precheck_results', 'hr', 'payroll_precheck_result', '薪资前置试算结果', '根据已确认考勤快照生成的薪资试算/复核结果表，仅作为薪资核算前置依据，不直接写入正式薪资或月结结果', true, '["hr","payroll","precheck","trial","document_intake"]'::jsonb),
      ('hr', 'v_payroll_ready_precheck_results', 'hr', 'payroll_ready_precheck_result', '薪资模块只读前置结果', '已复核通过的薪资前置试算结果只读视图，供正式薪资模块引用，不携带任何回写薪资指令', true, '["hr","payroll","precheck","approved","readonly"]'::jsonb)
    on conflict (schema_name, table_name) do update
    set domain = excluded.domain,
        entity_type = excluded.entity_type,
        business_name = excluded.business_name,
        description = excluded.description,
        is_active = excluded.is_active,
        tags = excluded.tags;
  end if;
end;
$$;

comment on table hr.document_intake_records is '智能收单人事记录：承接 AI 识别出的人事、考勤、请假、加班、入离职、调岗等正式业务记录';
comment on view hr.v_document_intake_record_summary is '智能收单人事记录汇总视图：按月份、部门和事项统计人事记录';
comment on view hr.v_payroll_precheck_attendance_snapshots is '薪资前置考勤快照队列：仅包含已确认且已提交薪资前置审核的月度考勤快照，只读引用，不直接写薪资结果';
comment on table hr.attendance_month_recalculation_snapshots is '考勤月度重算快照：人工修正 AI 人事/考勤记录后生成的员工月度考勤结果快照，不直接修改薪资或月结表';
comment on table hr.payroll_precheck_results is '薪资前置试算结果：从已确认考勤快照生成，只供薪资复核引用，不直接写正式薪资或月结结果';
comment on view hr.v_payroll_ready_precheck_results is '薪资模块只读前置结果：仅暴露已复核通过的薪资试算结果，供薪资模块读取，不写正式薪资结果';
comment on column hr.payroll_precheck_results.no_payroll_mutation is '强制为 true，表示该记录不能作为写入正式薪资结果的指令或依据';
comment on column hr.payroll_precheck_results.source_snapshot_reference is '生成试算时引用的考勤快照来源、文件和只读边界说明';
comment on column hr.attendance_month_recalculation_snapshots.confirmation_status is '考勤月度快照确认状态：pending_confirmation/confirmed/rejected；重算刷新后会回到 pending_confirmation';
comment on column hr.attendance_month_recalculation_snapshots.payroll_precheck_status is '薪资核算前置审核状态：not_requested/ready；只表示已提交前置审核，不直接写薪资或月结结果';
comment on column hr.document_intake_records.attendance_record_id is '同步到 hr.attendance_records 的目标记录 ID；非考勤类或未同步时为空';
comment on column hr.document_intake_records.attendance_sync_status is '人事记录向考勤明细同步的状态：not_applicable/synced/skipped/failed';
comment on column hr.document_intake_records.attendance_sync_message is '人事记录向考勤明细同步的摘要或跳过原因';

notify pgrst, 'reload schema';

commit;
