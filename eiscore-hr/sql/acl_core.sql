-- ACL core schema for EISCore (roles / permissions / data scopes / field ACL)
-- Safe to run multiple times (idempotent via IF NOT EXISTS / ON CONFLICT)

-- 1) Roles
create table if not exists public.roles (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text default '',
  sort          int  default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2) Permissions (module-level & action)
create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique, -- e.g. hr:employee.edit
  name        text not null,
  module      text not null,        -- e.g. hr, mms
  action      text not null,        -- view/create/edit/delete/export/config...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3) Role-Permission mapping
create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- 4) Data scopes
-- scope_type: self / dept / dept_tree / all
create table if not exists public.role_data_scopes (
  id          uuid primary key default gen_random_uuid(),
  role_id     uuid not null references public.roles(id) on delete cascade,
  module      text not null,                 -- e.g. hr_employee
  scope_type  text not null,                 -- self | dept | dept_tree | all
  dept_id     uuid references public.departments(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint role_data_scopes_scope_chk check (scope_type in ('self','dept','dept_tree','all')),
  constraint role_data_scopes_unique unique (role_id, module)
);

-- 5) Field ACL (per role per module per field)
create table if not exists public.sys_field_acl (
  id          uuid primary key default gen_random_uuid(),
  role_id     uuid not null references public.roles(id) on delete cascade,
  module      text not null,      -- e.g. hr_employee
  field_code  text not null,      -- e.g. name / department / salary
  can_view    boolean not null default true,
  can_edit    boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sys_field_acl_unique unique (role_id, module, field_code)
);

-- 6) helper view: permissions by role (denormalized)
create or replace view public.v_role_permissions as
select r.id as role_id,
       r.code as role_code,
       array_agg(p.code order by p.code) as permissions
from public.roles r
left join public.role_permissions rp on rp.role_id = r.id
left join public.permissions p on p.id = rp.permission_id
group by r.id, r.code;

-- 7) trigger to keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tg_roles_updated_at') then
    create trigger tg_roles_updated_at before update on public.roles
      for each row execute procedure public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_permissions_updated_at') then
    create trigger tg_permissions_updated_at before update on public.permissions
      for each row execute procedure public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_role_data_scopes_updated_at') then
    create trigger tg_role_data_scopes_updated_at before update on public.role_data_scopes
      for each row execute procedure public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_sys_field_acl_updated_at') then
    create trigger tg_sys_field_acl_updated_at before update on public.sys_field_acl
      for each row execute procedure public.touch_updated_at();
  end if;
end $$;

-- 8) 基础种子：HR 权限点（可按需增补）
insert into public.permissions (code, name, module, action)
values
  ('hr:employee.view',   '花名册查看',   'hr_employee', 'view'),
  ('hr:employee.create', '花名册新增',   'hr_employee', 'create'),
  ('hr:employee.edit',   '花名册编辑',   'hr_employee', 'edit'),
  ('hr:employee.delete', '花名册删除',   'hr_employee', 'delete'),
  ('hr:employee.export', '花名册导出',   'hr_employee', 'export'),
  ('hr:attendance.view',   '考勤查看',   'hr_attendance', 'view'),
  ('hr:attendance.edit',   '考勤编辑',   'hr_attendance', 'edit'),
  ('hr:attendance.config', '考勤配置',   'hr_attendance', 'config'),
  ('hr:org.view',        '组织架构查看', 'hr_org', 'view'),
  ('hr:org.edit',        '组织架构编辑', 'hr_org', 'edit'),
  ('hr:acl.config',      '权限配置',     'hr_acl', 'config')
on conflict (code) do nothing;

-- 9) 默认角色与权限
insert into public.roles (code, name, description, sort) values
  ('super_admin', '超级管理员', '全量权限', 10),
  ('hr_admin',    '人事管理员', '人事全功能', 20),
  ('hr_viewer',   '人事只读',   '仅查看', 30)
on conflict (code) do nothing;

-- 超管绑定全部权限
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'super_admin'
on conflict do nothing;

-- 人事管理员：hr_* 全部
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.module like 'hr_%'
where r.code = 'hr_admin'
on conflict do nothing;

-- 人事只读：hr_* 的 view/export
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.module like 'hr_%'
where r.code = 'hr_viewer' and p.action in ('view','export')
on conflict do nothing;

-- 数据范围默认：super_admin 全公司；hr_admin 含子部门；hr_viewer 本部门
insert into public.role_data_scopes (role_id, module, scope_type)
select r.id, 'hr_employee', 'all' from public.roles r where r.code = 'super_admin'
on conflict (role_id, module) do nothing;
insert into public.role_data_scopes (role_id, module, scope_type)
select r.id, 'hr_employee', 'dept_tree' from public.roles r where r.code = 'hr_admin'
on conflict (role_id, module) do nothing;
insert into public.role_data_scopes (role_id, module, scope_type)
select r.id, 'hr_employee', 'dept' from public.roles r where r.code = 'hr_viewer'
on conflict (role_id, module) do nothing;

-- 字段权限默认：hr_viewer 不可编辑薪资等敏感字段示例
insert into public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
select r.id, 'hr_employee', f.field_code, true, false
from public.roles r
cross join (values ('salary'), ('id_card')) as f(field_code)
where r.code = 'hr_viewer'
on conflict (role_id, module, field_code) do update
set can_view = excluded.can_view, can_edit = excluded.can_edit;

