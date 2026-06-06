-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Quality module base tables, permissions, and demo data.
-- Apply with:
--   docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore < sql/quality_demo_schema.sql

create extension if not exists pgcrypto;

create table if not exists public.system_configs (
  key text primary key,
  value jsonb,
  description text
);

create table if not exists public.ontology_table_semantics (
  table_schema text not null,
  table_name text not null,
  semantic_domain text not null default 'general',
  semantic_class text not null default 'entity',
  semantic_name text not null,
  semantic_description text not null default '',
  is_business boolean not null default true,
  is_active boolean not null default true,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (table_schema, table_name)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.quality_inspections (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  inspection_type text not null default '来料检验',
  source_doc_no text,
  item_code text,
  item_name text not null,
  source_name text,
  batch_no text,
  sample_qty numeric(14,2) not null default 0,
  defect_qty numeric(14,2) not null default 0,
  result text not null default '待判定',
  inspector text,
  inspection_date date not null default current_date,
  remark text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_inspections_type_check check (inspection_type in ('来料检验', '过程巡检', '首件检验', '成品抽检')),
  constraint quality_inspections_result_check check (result in ('待判定', '合格', '让步接收', '不合格')),
  constraint quality_inspections_qty_check check (sample_qty >= 0 and defect_qty >= 0 and defect_qty <= sample_qty)
);

create table if not exists public.quality_ncrs (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  inspection_id uuid references public.quality_inspections(id) on delete set null,
  source_type text not null default '检验异常',
  source_doc_no text,
  issue_desc text not null,
  severity text not null default '一般',
  owner_dept text,
  owner_name text,
  deadline date,
  ncr_status text not null default '待整改',
  corrective_action text,
  verification_result text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_ncrs_severity_check check (severity in ('一般', '严重', '关键')),
  constraint quality_ncrs_status_check check (ncr_status in ('待整改', '整改中', '待验证', '已关闭'))
);

create table if not exists public.quality_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  action_no text not null unique,
  ncr_id uuid references public.quality_ncrs(id) on delete set null,
  ncr_doc_no text,
  action_type text not null default '纠正',
  task_desc text not null,
  owner_dept text,
  owner_name text,
  due_date date,
  action_status text not null default '待处理',
  verify_owner text,
  verify_date date,
  verify_result text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_actions_type_check check (action_type in ('纠正', '预防', '验证')),
  constraint quality_actions_status_check check (action_status in ('待处理', '处理中', '待验证', '已完成'))
);

create table if not exists public.quality_audits (
  id uuid primary key default gen_random_uuid(),
  audit_no text not null unique,
  audit_type text not null default '过程审核',
  audit_scope text not null,
  plan_date date,
  auditor text,
  finding_count numeric(14,2) not null default 0,
  audit_status text not null default '计划中',
  conclusion text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_audits_type_check check (audit_type in ('过程审核', '体系审核', '供应商审核', '客户审核')),
  constraint quality_audits_status_check check (audit_status in ('计划中', '执行中', '待整改', '已关闭')),
  constraint quality_audits_finding_count_check check (finding_count >= 0)
);

create table if not exists public.quality_standards (
  id uuid primary key default gen_random_uuid(),
  standard_no text not null unique,
  standard_name text not null,
  item_category text,
  version text not null default 'V1',
  effective_date date,
  owner_name text,
  standard_status text not null default '草稿',
  key_metrics text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_standards_status_check check (standard_status in ('草稿', '生效', '修订中', '作废'))
);

drop trigger if exists trg_quality_inspections_updated_at on public.quality_inspections;
create trigger trg_quality_inspections_updated_at
before update on public.quality_inspections
for each row execute function public.touch_updated_at();

drop trigger if exists trg_quality_ncrs_updated_at on public.quality_ncrs;
create trigger trg_quality_ncrs_updated_at
before update on public.quality_ncrs
for each row execute function public.touch_updated_at();

drop trigger if exists trg_quality_corrective_actions_updated_at on public.quality_corrective_actions;
create trigger trg_quality_corrective_actions_updated_at
before update on public.quality_corrective_actions
for each row execute function public.touch_updated_at();

drop trigger if exists trg_quality_audits_updated_at on public.quality_audits;
create trigger trg_quality_audits_updated_at
before update on public.quality_audits
for each row execute function public.touch_updated_at();

drop trigger if exists trg_quality_standards_updated_at on public.quality_standards;
create trigger trg_quality_standards_updated_at
before update on public.quality_standards
for each row execute function public.touch_updated_at();

create index if not exists idx_quality_inspections_date on public.quality_inspections(inspection_date desc);
create index if not exists idx_quality_inspections_result on public.quality_inspections(result);
create index if not exists idx_quality_ncrs_deadline on public.quality_ncrs(deadline);
create index if not exists idx_quality_ncrs_status on public.quality_ncrs(ncr_status);
create index if not exists idx_quality_actions_due_date on public.quality_corrective_actions(due_date);
create index if not exists idx_quality_actions_status on public.quality_corrective_actions(action_status);
create index if not exists idx_quality_audits_plan_date on public.quality_audits(plan_date);
create index if not exists idx_quality_standards_status on public.quality_standards(standard_status);

grant select on
  public.quality_inspections,
  public.quality_ncrs,
  public.quality_corrective_actions,
  public.quality_audits,
  public.quality_standards
to web_anon;

grant select, insert, update, delete on
  public.quality_inspections,
  public.quality_ncrs,
  public.quality_corrective_actions,
  public.quality_audits,
  public.quality_standards
to web_user;

alter table public.quality_inspections enable row level security;
alter table public.quality_ncrs enable row level security;
alter table public.quality_corrective_actions enable row level security;
alter table public.quality_audits enable row level security;
alter table public.quality_standards enable row level security;

drop policy if exists quality_inspections_select on public.quality_inspections;
drop policy if exists quality_inspections_insert on public.quality_inspections;
drop policy if exists quality_inspections_update on public.quality_inspections;
drop policy if exists quality_inspections_delete on public.quality_inspections;
create policy quality_inspections_select on public.quality_inspections for select to web_user, web_anon using (true);
create policy quality_inspections_insert on public.quality_inspections for insert to web_user with check (true);
create policy quality_inspections_update on public.quality_inspections for update to web_user using (true) with check (true);
create policy quality_inspections_delete on public.quality_inspections for delete to web_user using (true);

drop policy if exists quality_ncrs_select on public.quality_ncrs;
drop policy if exists quality_ncrs_insert on public.quality_ncrs;
drop policy if exists quality_ncrs_update on public.quality_ncrs;
drop policy if exists quality_ncrs_delete on public.quality_ncrs;
create policy quality_ncrs_select on public.quality_ncrs for select to web_user, web_anon using (true);
create policy quality_ncrs_insert on public.quality_ncrs for insert to web_user with check (true);
create policy quality_ncrs_update on public.quality_ncrs for update to web_user using (true) with check (true);
create policy quality_ncrs_delete on public.quality_ncrs for delete to web_user using (true);

drop policy if exists quality_actions_select on public.quality_corrective_actions;
drop policy if exists quality_actions_insert on public.quality_corrective_actions;
drop policy if exists quality_actions_update on public.quality_corrective_actions;
drop policy if exists quality_actions_delete on public.quality_corrective_actions;
create policy quality_actions_select on public.quality_corrective_actions for select to web_user, web_anon using (true);
create policy quality_actions_insert on public.quality_corrective_actions for insert to web_user with check (true);
create policy quality_actions_update on public.quality_corrective_actions for update to web_user using (true) with check (true);
create policy quality_actions_delete on public.quality_corrective_actions for delete to web_user using (true);

drop policy if exists quality_audits_select on public.quality_audits;
drop policy if exists quality_audits_insert on public.quality_audits;
drop policy if exists quality_audits_update on public.quality_audits;
drop policy if exists quality_audits_delete on public.quality_audits;
create policy quality_audits_select on public.quality_audits for select to web_user, web_anon using (true);
create policy quality_audits_insert on public.quality_audits for insert to web_user with check (true);
create policy quality_audits_update on public.quality_audits for update to web_user using (true) with check (true);
create policy quality_audits_delete on public.quality_audits for delete to web_user using (true);

drop policy if exists quality_standards_select on public.quality_standards;
drop policy if exists quality_standards_insert on public.quality_standards;
drop policy if exists quality_standards_update on public.quality_standards;
drop policy if exists quality_standards_delete on public.quality_standards;
create policy quality_standards_select on public.quality_standards for select to web_user, web_anon using (true);
create policy quality_standards_insert on public.quality_standards for insert to web_user with check (true);
create policy quality_standards_update on public.quality_standards for update to web_user using (true) with check (true);
create policy quality_standards_delete on public.quality_standards for delete to web_user using (true);

insert into public.permissions (code, name, module, action)
values
  ('module:quality', '质量模块', 'quality', 'module'),
  ('app:quality_dashboard', '质量总览', 'quality', 'app'),
  ('app:quality_inspection', '检验台账', 'quality', 'app'),
  ('app:quality_ncr', '质量异常', 'quality', 'app'),
  ('app:quality_action', '整改任务', 'quality', 'app'),
  ('app:quality_audit', '质量审核', 'quality', 'app'),
  ('app:quality_standard', '检验标准', 'quality', 'app'),
  ('op:quality_inspection.create', '检验台账-新增', 'quality_inspection', 'create'),
  ('op:quality_inspection.edit', '检验台账-编辑', 'quality_inspection', 'edit'),
  ('op:quality_inspection.delete', '检验台账-删除', 'quality_inspection', 'delete'),
  ('op:quality_inspection.export', '检验台账-导出', 'quality_inspection', 'export'),
  ('op:quality_inspection.config', '检验台账-列配置', 'quality_inspection', 'config'),
  ('op:quality_ncr.create', '质量异常-新增', 'quality_ncr', 'create'),
  ('op:quality_ncr.edit', '质量异常-编辑', 'quality_ncr', 'edit'),
  ('op:quality_ncr.delete', '质量异常-删除', 'quality_ncr', 'delete'),
  ('op:quality_ncr.export', '质量异常-导出', 'quality_ncr', 'export'),
  ('op:quality_ncr.config', '质量异常-列配置', 'quality_ncr', 'config'),
  ('op:quality_action.create', '整改任务-新增', 'quality_action', 'create'),
  ('op:quality_action.edit', '整改任务-编辑', 'quality_action', 'edit'),
  ('op:quality_action.delete', '整改任务-删除', 'quality_action', 'delete'),
  ('op:quality_action.export', '整改任务-导出', 'quality_action', 'export'),
  ('op:quality_action.config', '整改任务-列配置', 'quality_action', 'config'),
  ('op:quality_audit.create', '质量审核-新增', 'quality_audit', 'create'),
  ('op:quality_audit.edit', '质量审核-编辑', 'quality_audit', 'edit'),
  ('op:quality_audit.delete', '质量审核-删除', 'quality_audit', 'delete'),
  ('op:quality_audit.export', '质量审核-导出', 'quality_audit', 'export'),
  ('op:quality_audit.config', '质量审核-列配置', 'quality_audit', 'config'),
  ('op:quality_standard.create', '检验标准-新增', 'quality_standard', 'create'),
  ('op:quality_standard.edit', '检验标准-编辑', 'quality_standard', 'edit'),
  ('op:quality_standard.delete', '检验标准-删除', 'quality_standard', 'delete'),
  ('op:quality_standard.export', '检验标准-导出', 'quality_standard', 'export'),
  ('op:quality_standard.config', '检验标准-列配置', 'quality_standard', 'config')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    action = excluded.action,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('super_admin', 'dept_manager')
  and (
    p.code = 'module:quality'
    or p.code in (
      'app:quality_dashboard',
      'app:quality_inspection',
      'app:quality_ncr',
      'app:quality_action',
      'app:quality_audit',
      'app:quality_standard'
    )
    or p.code like 'op:quality\_%' escape '\'
  )
on conflict do nothing;

insert into public.system_configs (key, value)
values
  ('quality_inspections_cols', '[{"label":"检验标准","prop":"standard","type":"text"},{"label":"处置建议","prop":"disposition","type":"select","options":[{"label":"放行","value":"放行"},{"label":"返工","value":"返工"},{"label":"退货","value":"退货"},{"label":"报废","value":"报废"}]},{"label":"不良率","prop":"defect_rate","type":"formula","expression":"{不良数}/{抽检数}*100"}]'::jsonb),
  ('quality_ncrs_cols', '[{"label":"根因分类","prop":"root_cause_type","type":"select","options":[{"label":"人员","value":"人员"},{"label":"设备","value":"设备"},{"label":"物料","value":"物料"},{"label":"方法","value":"方法"},{"label":"环境","value":"环境"}]}]'::jsonb),
  ('quality_corrective_actions_cols', '[{"label":"完成证据","prop":"evidence","type":"file","fileMaxCount":5,"fileMaxSizeMb":20}]'::jsonb),
  ('quality_audits_cols', '[{"label":"审核地点","prop":"audit_location","type":"text"}]'::jsonb),
  ('quality_standards_cols', '[{"label":"附件","prop":"attachments","type":"file","fileMaxCount":5,"fileMaxSizeMb":20}]'::jsonb)
on conflict (key) do nothing;

insert into public.quality_standards
  (standard_no, standard_name, item_category, version, effective_date, owner_name, standard_status, key_metrics, status, properties)
values
  ('STD-PKG-001', '食品级纸盒来料检验标准', '包装材料', 'V2', current_date - 16, '张晓', '生效', '外观、尺寸、耐压、异味', 'active', '{"demo":true}'),
  ('STD-FG-001', '常温酸奶成品放行标准', '成品', 'V3', current_date - 25, '陈雨', '生效', '外观、净含量、密封性、微生物', 'active', '{"demo":true}'),
  ('STD-PRO-001', '灌装线过程巡检标准', '生产过程', 'V1', current_date - 10, '刘铭', '生效', '扭矩、液位、喷码、温度', 'active', '{"demo":true}')
on conflict (standard_no) do nothing;

insert into public.quality_inspections
  (doc_no, inspection_type, source_doc_no, item_code, item_name, source_name, batch_no, sample_qty, defect_qty, result, inspector, inspection_date, remark, status, properties)
values
  ('QI-20260605-001', '来料检验', 'PA-20260605-001', 'PK-BOX-500', '食品级纸盒 500ml', '江门绿田包装材料', 'B20260605-A01', 80, 1, '待判定', '张晓', current_date, '外观轻微压痕', 'active', '{"standard":"GB/T 6543","disposition":"放行"}'),
  ('QI-20260604-012', '成品抽检', 'WO-20260604-008', 'FG-YOG-012', '常温酸奶 12瓶装', '包装二线', 'FG20260604-08', 120, 2, '合格', '陈雨', current_date - 1, '', 'active', '{"standard":"成品放行标准","disposition":"放行"}'),
  ('QI-20260604-009', '过程巡检', 'WO-20260604-003', 'LINE-L2', '灌装线 L2', '灌装车间', 'CAP20260604-02', 45, 5, '不合格', '刘铭', current_date - 1, '瓶盖扭矩偏低', 'active', '{"standard":"灌装线过程巡检标准","disposition":"返工"}'),
  ('QI-20260603-006', '首件检验', 'WO-20260603-002', 'FG-SHRIMP-001', '香辣虾仁预制菜', '预制菜二线', 'FG20260603-02', 20, 0, '合格', '陈雨', current_date - 2, '首件确认通过', 'active', '{"standard":"首件检验规范","disposition":"放行"}')
on conflict (doc_no) do nothing;

insert into public.quality_ncrs
  (doc_no, inspection_id, source_type, source_doc_no, issue_desc, severity, owner_dept, owner_name, deadline, ncr_status, corrective_action, verification_result, status, properties)
select
  'NCR-20260604-003',
  i.id,
  '过程巡检',
  i.doc_no,
  '瓶盖扭矩偏低',
  '严重',
  '生产部',
  '王浩',
  current_date,
  '待整改',
  '复核旋盖机参数并追加抽检',
  '',
  'active',
  '{"root_cause_type":"设备"}'::jsonb
from public.quality_inspections i
where i.doc_no = 'QI-20260604-009'
on conflict (doc_no) do nothing;

insert into public.quality_ncrs
  (doc_no, source_type, source_doc_no, issue_desc, severity, owner_dept, owner_name, deadline, ncr_status, corrective_action, verification_result, status, properties)
values
  ('NCR-20260602-001', '客户反馈', 'CS-20260602-002', '外箱标签批次码模糊', '一般', '仓储物流部', '赵宁', current_date + 2, '整改中', '复核标签打印头并追加出货复检', '', 'active', '{"root_cause_type":"设备"}')
on conflict (doc_no) do nothing;

insert into public.quality_corrective_actions
  (action_no, ncr_id, ncr_doc_no, action_type, task_desc, owner_dept, owner_name, due_date, action_status, verify_owner, verify_date, verify_result, status, properties)
select
  'QA-20260604-003-01',
  n.id,
  n.doc_no,
  '纠正',
  '调整旋盖机扭矩参数并记录复测结果',
  '生产部',
  '王浩',
  current_date,
  '处理中',
  '张晓',
  null,
  '',
  'active',
  '{"demo":true}'::jsonb
from public.quality_ncrs n
where n.doc_no = 'NCR-20260604-003'
on conflict (action_no) do nothing;

insert into public.quality_corrective_actions
  (action_no, ncr_doc_no, action_type, task_desc, owner_dept, owner_name, due_date, action_status, verify_owner, verify_date, verify_result, status, properties)
values
  ('QA-20260602-001-01', 'NCR-20260602-001', '预防', '清洁并校准标签打印头，建立每日点检记录', '仓储物流部', '赵宁', current_date + 2, '待验证', '陈雨', null, '', 'active', '{"demo":true}')
on conflict (action_no) do nothing;

insert into public.quality_audits
  (audit_no, audit_type, audit_scope, plan_date, auditor, finding_count, audit_status, conclusion, status, properties)
values
  ('AUD-20260603-001', '过程审核', '灌装二线首件确认', current_date + 1, '陈雨', 2, '待整改', '设备点检记录不完整', 'active', '{"audit_location":"灌装车间"}'),
  ('AUD-20260605-001', '供应商审核', '江门绿田包装材料年度审核', current_date + 7, '张晓', 0, '计划中', '', 'active', '{"audit_location":"江门"}')
on conflict (audit_no) do nothing;

insert into public.ontology_table_semantics (
  table_schema,
  table_name,
  semantic_domain,
  semantic_class,
  semantic_name,
  semantic_description,
  is_business,
  tags
)
values
  ('public', 'quality_inspections', 'quality', 'inspection', '检验台账', '来料、过程、首件和成品检验记录', true, '["quality","inspection"]'::jsonb),
  ('public', 'quality_ncrs', 'quality', 'ncr', '质量异常', '不合格、异常和责任整改闭环', true, '["quality","ncr"]'::jsonb),
  ('public', 'quality_corrective_actions', 'quality', 'corrective_action', '整改任务', '纠正预防措施和验证结果', true, '["quality","corrective_action"]'::jsonb),
  ('public', 'quality_audits', 'quality', 'audit', '质量审核', '体系、过程、供应商和客户审核', true, '["quality","audit"]'::jsonb),
  ('public', 'quality_standards', 'quality', 'standard', '检验标准', '检验标准、版本和关键指标', true, '["quality","standard"]'::jsonb)
on conflict (table_schema, table_name) do update
set semantic_domain = excluded.semantic_domain,
    semantic_class = excluded.semantic_class,
    semantic_name = excluded.semantic_name,
    semantic_description = excluded.semantic_description,
    is_business = true,
    tags = excluded.tags,
    is_active = true,
    updated_at = now();
