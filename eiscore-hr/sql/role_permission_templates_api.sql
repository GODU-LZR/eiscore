-- 角色权限模板 RPC
-- 执行方式（UTF-8）：cat role_permission_templates_api.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace function public.apply_role_permission_templates()
returns integer
language plpgsql
security definer
as $$
declare
  _count integer := 0;
begin
  with
  s1 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p on true
    where r.code = 'super_admin'
    on conflict do nothing
    returning 1
  ),
  s2 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code like 'app:hr_%'
      or p.code like 'op:hr_%'
    where r.code = 'hr_admin'
    on conflict do nothing
    returning 1
  ),
  s3 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code like 'app:hr_%'
      or p.code ~ '^op:hr_.*\\.(create|edit)$'
    where r.code = 'hr_clerk'
    on conflict do nothing
    returning 1
  ),
  s4 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code in ('app:hr_employee', 'app:hr_org', 'app:hr_attendance', 'app:hr_change')
      or p.code ~ '^op:hr_.*\\.(view|create|edit)$'
    where r.code = 'dept_manager'
    on conflict do nothing
    returning 1
  ),
  s5 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code = 'module:hr'
      or p.code in ('app:hr_employee', 'app:hr_attendance')
      or p.code ~ '^op:hr_.*\\.view$'
    where r.code = 'employee'
    on conflict do nothing
    returning 1
  ),
  s6 as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code in ('module:home', 'module:hr')
      or p.code in ('app:hr_employee', 'app:hr_attendance')
      or p.code ~ '^op:hr_.*\\.view$'
    where r.code = 'hr_viewer'
    on conflict do nothing
    returning 1
  )
  select
    coalesce((select count(*) from s1), 0) +
    coalesce((select count(*) from s2), 0) +
    coalesce((select count(*) from s3), 0) +
    coalesce((select count(*) from s4), 0) +
    coalesce((select count(*) from s5), 0) +
    coalesce((select count(*) from s6), 0)
  into _count;

  return _count;
end;
$$;

grant execute on function public.apply_role_permission_templates() to web_user;
