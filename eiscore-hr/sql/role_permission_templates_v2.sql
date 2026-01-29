-- 角色权限模板（基于新权限码 module/app/op）
-- 可重复执行：使用 ON CONFLICT DO NOTHING
-- 执行方式（UTF-8）：cat role_permission_templates_v2.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

-- 1) 超级管理员：全部权限
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on true
where r.code = 'super_admin'
on conflict do nothing;

-- 2) 人事管理员：HR 全量权限（module:hr + app:hr_* + op:hr_*）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.code = 'module:hr'
  or p.code like 'app:hr_%'
  or p.code like 'op:hr_%'
where r.code = 'hr_admin'
on conflict do nothing;

-- 3) 人事文员：HR 主要增删改（不含删除/导出/配置/高级按钮）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.code = 'module:hr'
  or p.code like 'app:hr_%'
  or p.code ~ '^op:hr_.*\\.(create|edit)$'
where r.code = 'hr_clerk'
on conflict do nothing;

-- 4) 部门主管：HR 以查看 + 部分操作为主（导出/配置/删除默认不含）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.code = 'module:hr'
  or p.code in ('app:hr_employee', 'app:hr_org', 'app:hr_attendance', 'app:hr_change')
  or p.code ~ '^op:hr_.*\\.(view|create|edit)$'
where r.code = 'dept_manager'
on conflict do nothing;

-- 5) 员工：只读（入口 + view）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.code = 'module:hr'
  or p.code in ('app:hr_employee', 'app:hr_attendance')
  or p.code ~ '^op:hr_.*\\.view$'
where r.code = 'employee'
on conflict do nothing;
