-- AI/自动化权限落库接口（供 PostgREST RPC 调用）
-- 约定：payload 为 JSON 数组，每项包含 code/name/module/action，可选 roles 绑定
-- 示例：
-- select public.upsert_permissions('[{"code":"app:hr_demo","name":"应用-示例","module":"应用","action":"进入","roles":["super_admin"]}]'::jsonb);

create or replace function public.upsert_permissions(payload jsonb)
returns integer
language plpgsql
security definer
as $$
declare
  _count integer := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    return 0;
  end if;

  with items as (
    select
      (value->>'code')::text as code,
      (value->>'name')::text as name,
      (value->>'module')::text as module,
      (value->>'action')::text as action,
      value->'roles' as roles
    from jsonb_array_elements(payload)
  ),
  upserted as (
    insert into public.permissions (code, name, module, action)
    select code, coalesce(name, code), module, action
    from items
    where code is not null and code <> ''
    on conflict (code) do update set
      name = excluded.name,
      module = excluded.module,
      action = excluded.action
    returning id, code
  ),
  role_bind as (
    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from items i
    join public.permissions p on p.code = i.code
    join public.roles r on i.roles is not null and r.code = any (select jsonb_array_elements_text(i.roles))
    on conflict do nothing
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;

create or replace function public.upsert_field_acl(payload jsonb)
returns integer
language plpgsql
security definer
as $$
declare
  _count integer := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    return 0;
  end if;

  with items as (
    select
      (value->>'role_code')::text as role_code,
      (value->>'module')::text as module,
      (value->>'field_code')::text as field_code,
      coalesce((value->>'can_view')::boolean, true) as can_view,
      coalesce((value->>'can_edit')::boolean, true) as can_edit
    from jsonb_array_elements(payload)
  ),
  upserted as (
    insert into public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
    select r.id, i.module, i.field_code, i.can_view, i.can_edit
    from items i
    join public.roles r on r.code = i.role_code
    on conflict (role_id, module, field_code)
    do update set
      can_view = excluded.can_view,
      can_edit = excluded.can_edit
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;

grant execute on function public.upsert_permissions(jsonb) to web_user;
grant execute on function public.upsert_field_acl(jsonb) to web_user;
