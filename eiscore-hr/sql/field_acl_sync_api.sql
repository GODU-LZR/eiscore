-- 字段权限同步 RPC：为模块下指定字段创建默认权限（可见/可编辑=true）
-- 执行方式（UTF-8）：cat field_acl_sync_api.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace function public.ensure_field_acl(module_name text, field_codes text[])
returns integer
language plpgsql
security definer
as $$
declare
  _count integer := 0;
begin
  if module_name is null or module_name = '' then
    return 0;
  end if;
  if field_codes is null or array_length(field_codes, 1) is null then
    return 0;
  end if;

  with targets as (
    select r.id as role_id, module_name as module, fc as field_code
    from public.roles r
    cross join unnest(field_codes) as fc
  ),
  upserted as (
    insert into public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
    select t.role_id, t.module, t.field_code, true, true
    from targets t
    on conflict (role_id, module, field_code) do nothing
    returning 1
  )
  select count(*) into _count from upserted;

  return _count;
end;
$$;

grant execute on function public.ensure_field_acl(text, text[]) to web_user;
