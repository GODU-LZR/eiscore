-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Equipment module base tables, permissions, and demo data.
-- Apply with:
--   docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore < sql/equipment_demo_schema.sql

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

create table if not exists public.equipment_assets (
  id uuid primary key default gen_random_uuid(),
  asset_no text not null unique,
  asset_name text not null,
  asset_type text,
  location_name text,
  asset_level text not null default '一般',
  run_status text not null default '运行',
  owner_dept text,
  owner_name text,
  commission_date date,
  last_maint_date date,
  next_maint_date date,
  health_score numeric(14,2) not null default 100,
  remark text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_assets_level_check check (asset_level in ('关键', '重要', '一般')),
  constraint equipment_assets_status_check check (run_status in ('运行', '停机', '维修中', '待验收', '报废')),
  constraint equipment_assets_health_check check (health_score >= 0 and health_score <= 100)
);

create table if not exists public.equipment_checks (
  id uuid primary key default gen_random_uuid(),
  check_no text not null unique,
  asset_id uuid references public.equipment_assets(id) on delete set null,
  asset_no text,
  asset_name text not null,
  check_type text not null default '日常巡检',
  check_item_count numeric(14,2) not null default 0,
  abnormal_count numeric(14,2) not null default 0,
  check_result text not null default '待处理',
  checker text,
  check_date date not null default current_date,
  remark text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_checks_type_check check (check_type in ('班前点检', '日常巡检', '专项点检')),
  constraint equipment_checks_result_check check (check_result in ('待处理', '正常', '异常', '停机')),
  constraint equipment_checks_count_check check (check_item_count >= 0 and abnormal_count >= 0 and abnormal_count <= check_item_count)
);

create table if not exists public.equipment_issues (
  id uuid primary key default gen_random_uuid(),
  issue_no text not null unique,
  asset_id uuid references public.equipment_assets(id) on delete set null,
  asset_no text,
  asset_name text not null,
  source_type text,
  issue_desc text not null,
  issue_level text not null default '一般',
  owner_dept text,
  owner_name text,
  occurred_date date not null default current_date,
  deadline date,
  issue_status text not null default '待处理',
  repair_action text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_issues_level_check check (issue_level in ('一般', '严重', '紧急')),
  constraint equipment_issues_status_check check (issue_status in ('待处理', '处理中', '待验收', '已关闭'))
);

create table if not exists public.equipment_work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_no text not null unique,
  issue_id uuid references public.equipment_issues(id) on delete set null,
  issue_no text,
  asset_id uuid references public.equipment_assets(id) on delete set null,
  asset_no text,
  asset_name text not null,
  work_type text not null default '故障维修',
  task_desc text not null,
  maintainer text,
  plan_date date,
  finish_date date,
  downtime_hours numeric(14,2) not null default 0,
  work_status text not null default '待派工',
  acceptance_result text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_work_orders_type_check check (work_type in ('故障维修', '预防保养', '备件更换', '校准验收')),
  constraint equipment_work_orders_status_check check (work_status in ('待派工', '处理中', '待验收', '已完成')),
  constraint equipment_work_orders_downtime_check check (downtime_hours >= 0)
);

create table if not exists public.equipment_maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  plan_no text not null unique,
  plan_name text not null,
  asset_scope text,
  plan_type text not null default '月度保养',
  cycle_name text,
  start_date date,
  next_execute_date date,
  owner_name text,
  plan_status text not null default '计划中',
  completion_rate numeric(14,2) not null default 0,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_plans_type_check check (plan_type in ('月度保养', '季度保养', '年度大修', '专项巡检')),
  constraint equipment_plans_status_check check (plan_status in ('计划中', '执行中', '已完成', '已暂停')),
  constraint equipment_plans_completion_check check (completion_rate >= 0 and completion_rate <= 100)
);

create table if not exists public.equipment_standards (
  id uuid primary key default gen_random_uuid(),
  standard_no text not null unique,
  standard_name text not null,
  asset_type text,
  version text not null default 'V1',
  effective_date date,
  owner_name text,
  standard_status text not null default '草稿',
  key_items text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_standards_status_check check (standard_status in ('草稿', '生效', '修订中', '作废'))
);

drop trigger if exists trg_equipment_assets_updated_at on public.equipment_assets;
create trigger trg_equipment_assets_updated_at before update on public.equipment_assets for each row execute function public.touch_updated_at();

drop trigger if exists trg_equipment_checks_updated_at on public.equipment_checks;
create trigger trg_equipment_checks_updated_at before update on public.equipment_checks for each row execute function public.touch_updated_at();

drop trigger if exists trg_equipment_issues_updated_at on public.equipment_issues;
create trigger trg_equipment_issues_updated_at before update on public.equipment_issues for each row execute function public.touch_updated_at();

drop trigger if exists trg_equipment_work_orders_updated_at on public.equipment_work_orders;
create trigger trg_equipment_work_orders_updated_at before update on public.equipment_work_orders for each row execute function public.touch_updated_at();

drop trigger if exists trg_equipment_plans_updated_at on public.equipment_maintenance_plans;
create trigger trg_equipment_plans_updated_at before update on public.equipment_maintenance_plans for each row execute function public.touch_updated_at();

drop trigger if exists trg_equipment_standards_updated_at on public.equipment_standards;
create trigger trg_equipment_standards_updated_at before update on public.equipment_standards for each row execute function public.touch_updated_at();

create index if not exists idx_equipment_assets_status on public.equipment_assets(run_status);
create index if not exists idx_equipment_assets_next_maint on public.equipment_assets(next_maint_date);
create index if not exists idx_equipment_checks_date on public.equipment_checks(check_date desc);
create index if not exists idx_equipment_checks_result on public.equipment_checks(check_result);
create index if not exists idx_equipment_issues_deadline on public.equipment_issues(deadline);
create index if not exists idx_equipment_issues_status on public.equipment_issues(issue_status);
create index if not exists idx_equipment_work_orders_plan on public.equipment_work_orders(plan_date);
create index if not exists idx_equipment_work_orders_status on public.equipment_work_orders(work_status);
create index if not exists idx_equipment_plans_next on public.equipment_maintenance_plans(next_execute_date);
create index if not exists idx_equipment_standards_status on public.equipment_standards(standard_status);

grant select on
  public.equipment_assets,
  public.equipment_checks,
  public.equipment_issues,
  public.equipment_work_orders,
  public.equipment_maintenance_plans,
  public.equipment_standards
to web_anon;

grant select, insert, update, delete on
  public.equipment_assets,
  public.equipment_checks,
  public.equipment_issues,
  public.equipment_work_orders,
  public.equipment_maintenance_plans,
  public.equipment_standards
to web_user;

grant select on public.roles to web_anon;

alter table public.equipment_assets enable row level security;
alter table public.equipment_checks enable row level security;
alter table public.equipment_issues enable row level security;
alter table public.equipment_work_orders enable row level security;
alter table public.equipment_maintenance_plans enable row level security;
alter table public.equipment_standards enable row level security;

drop policy if exists equipment_assets_select on public.equipment_assets;
drop policy if exists equipment_assets_insert on public.equipment_assets;
drop policy if exists equipment_assets_update on public.equipment_assets;
drop policy if exists equipment_assets_delete on public.equipment_assets;
create policy equipment_assets_select on public.equipment_assets for select to web_user, web_anon using (true);
create policy equipment_assets_insert on public.equipment_assets for insert to web_user with check (true);
create policy equipment_assets_update on public.equipment_assets for update to web_user using (true) with check (true);
create policy equipment_assets_delete on public.equipment_assets for delete to web_user using (true);

drop policy if exists equipment_checks_select on public.equipment_checks;
drop policy if exists equipment_checks_insert on public.equipment_checks;
drop policy if exists equipment_checks_update on public.equipment_checks;
drop policy if exists equipment_checks_delete on public.equipment_checks;
create policy equipment_checks_select on public.equipment_checks for select to web_user, web_anon using (true);
create policy equipment_checks_insert on public.equipment_checks for insert to web_user with check (true);
create policy equipment_checks_update on public.equipment_checks for update to web_user using (true) with check (true);
create policy equipment_checks_delete on public.equipment_checks for delete to web_user using (true);

drop policy if exists equipment_issues_select on public.equipment_issues;
drop policy if exists equipment_issues_insert on public.equipment_issues;
drop policy if exists equipment_issues_update on public.equipment_issues;
drop policy if exists equipment_issues_delete on public.equipment_issues;
create policy equipment_issues_select on public.equipment_issues for select to web_user, web_anon using (true);
create policy equipment_issues_insert on public.equipment_issues for insert to web_user with check (true);
create policy equipment_issues_update on public.equipment_issues for update to web_user using (true) with check (true);
create policy equipment_issues_delete on public.equipment_issues for delete to web_user using (true);

drop policy if exists equipment_work_orders_select on public.equipment_work_orders;
drop policy if exists equipment_work_orders_insert on public.equipment_work_orders;
drop policy if exists equipment_work_orders_update on public.equipment_work_orders;
drop policy if exists equipment_work_orders_delete on public.equipment_work_orders;
create policy equipment_work_orders_select on public.equipment_work_orders for select to web_user, web_anon using (true);
create policy equipment_work_orders_insert on public.equipment_work_orders for insert to web_user with check (true);
create policy equipment_work_orders_update on public.equipment_work_orders for update to web_user using (true) with check (true);
create policy equipment_work_orders_delete on public.equipment_work_orders for delete to web_user using (true);

drop policy if exists equipment_plans_select on public.equipment_maintenance_plans;
drop policy if exists equipment_plans_insert on public.equipment_maintenance_plans;
drop policy if exists equipment_plans_update on public.equipment_maintenance_plans;
drop policy if exists equipment_plans_delete on public.equipment_maintenance_plans;
create policy equipment_plans_select on public.equipment_maintenance_plans for select to web_user, web_anon using (true);
create policy equipment_plans_insert on public.equipment_maintenance_plans for insert to web_user with check (true);
create policy equipment_plans_update on public.equipment_maintenance_plans for update to web_user using (true) with check (true);
create policy equipment_plans_delete on public.equipment_maintenance_plans for delete to web_user using (true);

drop policy if exists equipment_standards_select on public.equipment_standards;
drop policy if exists equipment_standards_insert on public.equipment_standards;
drop policy if exists equipment_standards_update on public.equipment_standards;
drop policy if exists equipment_standards_delete on public.equipment_standards;
create policy equipment_standards_select on public.equipment_standards for select to web_user, web_anon using (true);
create policy equipment_standards_insert on public.equipment_standards for insert to web_user with check (true);
create policy equipment_standards_update on public.equipment_standards for update to web_user using (true) with check (true);
create policy equipment_standards_delete on public.equipment_standards for delete to web_user using (true);

insert into public.permissions (code, name, module, action)
values
  ('module:equipment', '设备管理', 'equipment', 'module'),
  ('app:equipment_dashboard', '设备总览', 'equipment', 'app'),
  ('app:equipment_asset', '设备台账', 'equipment', 'app'),
  ('app:equipment_check', '点检记录', 'equipment', 'app'),
  ('app:equipment_issue', '设备异常', 'equipment', 'app'),
  ('app:equipment_work_order', '维保工单', 'equipment', 'app'),
  ('app:equipment_plan', '巡检计划', 'equipment', 'app'),
  ('app:equipment_standard', '保养标准', 'equipment', 'app'),
  ('op:equipment_asset.create', '设备台账-新增', 'equipment_asset', 'create'),
  ('op:equipment_asset.edit', '设备台账-编辑', 'equipment_asset', 'edit'),
  ('op:equipment_asset.delete', '设备台账-删除', 'equipment_asset', 'delete'),
  ('op:equipment_asset.export', '设备台账-导出', 'equipment_asset', 'export'),
  ('op:equipment_asset.config', '设备台账-列配置', 'equipment_asset', 'config'),
  ('op:equipment_check.create', '点检记录-新增', 'equipment_check', 'create'),
  ('op:equipment_check.edit', '点检记录-编辑', 'equipment_check', 'edit'),
  ('op:equipment_check.delete', '点检记录-删除', 'equipment_check', 'delete'),
  ('op:equipment_check.export', '点检记录-导出', 'equipment_check', 'export'),
  ('op:equipment_check.config', '点检记录-列配置', 'equipment_check', 'config'),
  ('op:equipment_issue.create', '设备异常-新增', 'equipment_issue', 'create'),
  ('op:equipment_issue.edit', '设备异常-编辑', 'equipment_issue', 'edit'),
  ('op:equipment_issue.delete', '设备异常-删除', 'equipment_issue', 'delete'),
  ('op:equipment_issue.export', '设备异常-导出', 'equipment_issue', 'export'),
  ('op:equipment_issue.config', '设备异常-列配置', 'equipment_issue', 'config'),
  ('op:equipment_work_order.create', '维保工单-新增', 'equipment_work_order', 'create'),
  ('op:equipment_work_order.edit', '维保工单-编辑', 'equipment_work_order', 'edit'),
  ('op:equipment_work_order.delete', '维保工单-删除', 'equipment_work_order', 'delete'),
  ('op:equipment_work_order.export', '维保工单-导出', 'equipment_work_order', 'export'),
  ('op:equipment_work_order.config', '维保工单-列配置', 'equipment_work_order', 'config'),
  ('op:equipment_plan.create', '巡检计划-新增', 'equipment_plan', 'create'),
  ('op:equipment_plan.edit', '巡检计划-编辑', 'equipment_plan', 'edit'),
  ('op:equipment_plan.delete', '巡检计划-删除', 'equipment_plan', 'delete'),
  ('op:equipment_plan.export', '巡检计划-导出', 'equipment_plan', 'export'),
  ('op:equipment_plan.config', '巡检计划-列配置', 'equipment_plan', 'config'),
  ('op:equipment_standard.create', '保养标准-新增', 'equipment_standard', 'create'),
  ('op:equipment_standard.edit', '保养标准-编辑', 'equipment_standard', 'edit'),
  ('op:equipment_standard.delete', '保养标准-删除', 'equipment_standard', 'delete'),
  ('op:equipment_standard.export', '保养标准-导出', 'equipment_standard', 'export'),
  ('op:equipment_standard.config', '保养标准-列配置', 'equipment_standard', 'config')
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
    p.code = 'module:equipment'
    or p.code in (
      'app:equipment_dashboard',
      'app:equipment_asset',
      'app:equipment_check',
      'app:equipment_issue',
      'app:equipment_work_order',
      'app:equipment_plan',
      'app:equipment_standard'
    )
    or p.code like 'op:equipment\_%' escape '\'
  )
on conflict do nothing;

insert into public.system_configs (key, value)
values
  ('equipment_assets_cols', '[{"label":"设备厂家","prop":"manufacturer","type":"text"},{"label":"资产原值","prop":"asset_value","type":"number"},{"label":"设备位置","prop":"geo_location","type":"geo","geoAddress":true}]'::jsonb),
  ('equipment_checks_cols', '[{"label":"温度","prop":"temperature","type":"number"},{"label":"振动","prop":"vibration","type":"number"},{"label":"点检照片","prop":"check_photos","type":"file","fileMaxCount":6,"fileMaxSizeMb":20}]'::jsonb),
  ('equipment_issues_cols', '[{"label":"故障分类","prop":"fault_type","type":"select","options":[{"label":"机械","value":"机械"},{"label":"电气","value":"电气"},{"label":"控制","value":"控制"},{"label":"制冷","value":"制冷"},{"label":"其他","value":"其他"}]}]'::jsonb),
  ('equipment_work_orders_cols', '[{"label":"更换备件","prop":"spare_parts","type":"text"},{"label":"维修照片","prop":"repair_photos","type":"file","fileMaxCount":8,"fileMaxSizeMb":20}]'::jsonb),
  ('equipment_maintenance_plans_cols', '[{"label":"提醒方式","prop":"notify_method","type":"select","options":[{"label":"系统提醒","value":"系统提醒"},{"label":"短信","value":"短信"},{"label":"企业微信","value":"企业微信"}]}]'::jsonb),
  ('equipment_standards_cols', '[{"label":"标准附件","prop":"attachments","type":"file","fileMaxCount":5,"fileMaxSizeMb":20}]'::jsonb)
on conflict (key) do nothing;

insert into public.equipment_assets
  (asset_no, asset_name, asset_type, location_name, asset_level, run_status, owner_dept, owner_name, commission_date, last_maint_date, next_maint_date, health_score, remark, status, properties)
values
  ('EQ-FILL-002', '二号灌装机', '灌装设备', '灌装二线', '关键', '运行', '生产部', '王浩', current_date - 751, current_date - 8, current_date + 7, 92, '扭矩参数需持续关注', 'active', '{"manufacturer":"广州海工自动化","asset_value":360000}'),
  ('EQ-COLD-001', '一号冷库压缩机', '制冷设备', '冷库一区', '关键', '维修中', '设备部', '陈雨', current_date - 1007, current_date - 14, current_date + 3, 68, '油压波动，安排复检', 'active', '{"manufacturer":"深圳冷源机电","asset_value":510000}'),
  ('EQ-PACK-004', '四号封箱机', '包装设备', '包装一线', '重要', '停机', '生产部', '刘铭', current_date - 473, current_date - 6, current_date + 10, 74, '待更换传送带', 'active', '{"manufacturer":"佛山迅捷包装","asset_value":120000}')
on conflict (asset_no) do nothing;

insert into public.equipment_checks
  (check_no, asset_id, asset_no, asset_name, check_type, check_item_count, abnormal_count, check_result, checker, check_date, remark, status, properties)
select 'EC-20260605-001', a.id, a.asset_no, a.asset_name, '班前点检', 18, 1, '异常', '刘铭', current_date, '旋盖扭矩偏低', 'active', '{"temperature":32,"vibration":2.1}'::jsonb
from public.equipment_assets a where a.asset_no = 'EQ-FILL-002'
on conflict (check_no) do nothing;

insert into public.equipment_checks
  (check_no, asset_id, asset_no, asset_name, check_type, check_item_count, abnormal_count, check_result, checker, check_date, remark, status, properties)
select 'EC-20260604-012', a.id, a.asset_no, a.asset_name, '日常巡检', 12, 0, '正常', '陈雨', current_date - 1, '', 'active', '{"temperature":-18,"vibration":1.3}'::jsonb
from public.equipment_assets a where a.asset_no = 'EQ-COLD-001'
on conflict (check_no) do nothing;

insert into public.equipment_checks
  (check_no, asset_id, asset_no, asset_name, check_type, check_item_count, abnormal_count, check_result, checker, check_date, remark, status, properties)
select 'EC-20260604-008', a.id, a.asset_no, a.asset_name, '专项点检', 10, 2, '停机', '王浩', current_date - 1, '传送带打滑', 'active', '{"temperature":30,"vibration":3.4}'::jsonb
from public.equipment_assets a where a.asset_no = 'EQ-PACK-004'
on conflict (check_no) do nothing;

insert into public.equipment_issues
  (issue_no, asset_id, asset_no, asset_name, source_type, issue_desc, issue_level, owner_dept, owner_name, occurred_date, deadline, issue_status, repair_action, status, properties)
select 'EI-20260605-003', a.id, a.asset_no, a.asset_name, '班前点检', '旋盖扭矩持续偏低', '严重', '设备部', '王浩', current_date, current_date + 1, '处理中', '复核伺服参数并更换夹头垫片', 'active', '{"fault_type":"机械"}'::jsonb
from public.equipment_assets a where a.asset_no = 'EQ-FILL-002'
on conflict (issue_no) do nothing;

insert into public.equipment_issues
  (issue_no, asset_id, asset_no, asset_name, source_type, issue_desc, issue_level, owner_dept, owner_name, occurred_date, deadline, issue_status, repair_action, status, properties)
select 'EI-20260604-001', a.id, a.asset_no, a.asset_name, '专项点检', '传送带打滑导致停机', '紧急', '设备部', '刘铭', current_date - 1, current_date, '待处理', '更换传送带并复测', 'active', '{"fault_type":"机械"}'::jsonb
from public.equipment_assets a where a.asset_no = 'EQ-PACK-004'
on conflict (issue_no) do nothing;

insert into public.equipment_work_orders
  (work_order_no, issue_id, issue_no, asset_id, asset_no, asset_name, work_type, task_desc, maintainer, plan_date, finish_date, downtime_hours, work_status, acceptance_result, status, properties)
select 'EW-20260605-003-01', i.id, i.issue_no, a.id, a.asset_no, a.asset_name, '故障维修', '调整旋盖机扭矩参数并更换夹头垫片', '王浩', current_date, null, 1.5, '处理中', '', 'active', '{"spare_parts":"夹头垫片 x2"}'::jsonb
from public.equipment_issues i
join public.equipment_assets a on a.asset_no = i.asset_no
where i.issue_no = 'EI-20260605-003'
on conflict (work_order_no) do nothing;

insert into public.equipment_work_orders
  (work_order_no, issue_id, issue_no, asset_id, asset_no, asset_name, work_type, task_desc, maintainer, plan_date, finish_date, downtime_hours, work_status, acceptance_result, status, properties)
select 'EW-20260604-001-01', i.id, i.issue_no, a.id, a.asset_no, a.asset_name, '备件更换', '更换封箱机传送带并复测张力', '刘铭', current_date, null, 2.0, '待派工', '', 'active', '{"spare_parts":"传送带 x1"}'::jsonb
from public.equipment_issues i
join public.equipment_assets a on a.asset_no = i.asset_no
where i.issue_no = 'EI-20260604-001'
on conflict (work_order_no) do nothing;

insert into public.equipment_maintenance_plans
  (plan_no, plan_name, asset_scope, plan_type, cycle_name, start_date, next_execute_date, owner_name, plan_status, completion_rate, status, properties)
values
  ('EP-202606-001', '灌装线月度保养', '灌装一线、二线', '月度保养', '月度', current_date - 4, current_date + 5, '陈雨', '执行中', 62, 'active', '{"notify_method":"系统提醒"}'),
  ('EP-202606-002', '冷库制冷系统专项巡检', '冷库一区、二区', '专项巡检', '周度', current_date - 2, current_date + 1, '王浩', '计划中', 20, 'active', '{"notify_method":"企业微信"}')
on conflict (plan_no) do nothing;

insert into public.equipment_standards
  (standard_no, standard_name, asset_type, version, effective_date, owner_name, standard_status, key_items, status, properties)
values
  ('ES-FILL-001', '灌装机日常点检标准', '灌装设备', 'V2', current_date - 16, '陈雨', '生效', '扭矩、气压、泄漏、润滑、异响', 'active', '{"demo":true}'),
  ('ES-COLD-001', '冷库压缩机保养标准', '制冷设备', 'V1', current_date - 20, '王浩', '生效', '油压、电流、冷媒、温度、震动', 'active', '{"demo":true}')
on conflict (standard_no) do nothing;

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
  ('public', 'equipment_assets', 'equipment', 'asset', '设备台账', '设备档案、状态、责任人和保养周期', true, '["equipment","asset"]'::jsonb),
  ('public', 'equipment_checks', 'equipment', 'check', '点检记录', '班前点检、日常巡检和专项点检结果', true, '["equipment","check"]'::jsonb),
  ('public', 'equipment_issues', 'equipment', 'issue', '设备异常', '设备故障、异常来源、责任归属和处理状态', true, '["equipment","issue"]'::jsonb),
  ('public', 'equipment_work_orders', 'equipment', 'work_order', '维保工单', '维修派工、停机时长、备件更换和验收', true, '["equipment","work_order"]'::jsonb),
  ('public', 'equipment_maintenance_plans', 'equipment', 'maintenance_plan', '巡检计划', '设备巡检、保养和大修计划', true, '["equipment","plan"]'::jsonb),
  ('public', 'equipment_standards', 'equipment', 'standard', '保养标准', '设备点检标准、保养规范和关键项目', true, '["equipment","standard"]'::jsonb)
on conflict (table_schema, table_name) do update
set semantic_domain = excluded.semantic_domain,
    semantic_class = excluded.semantic_class,
    semantic_name = excluded.semantic_name,
    semantic_description = excluded.semantic_description,
    is_business = true,
    tags = excluded.tags,
    is_active = true,
    updated_at = now();
