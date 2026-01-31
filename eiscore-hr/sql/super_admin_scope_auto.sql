-- 超级管理员默认全公司数据范围
-- 执行方式（UTF-8）：cat super_admin_scope_auto.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace function public.ensure_super_admin_scopes()
returns trigger
language plpgsql
security definer
as $$
declare
  rid uuid;
begin
  if new.code <> 'super_admin' then
    return new;
  end if;

  rid := new.id;
  if rid is null then
    return new;
  end if;

  insert into public.role_data_scopes (role_id, module, scope_type, dept_id)
  select rid, m, 'all', null
  from (values
    ('hr_employee'),
    ('hr_org'),
    ('hr_attendance'),
    ('hr_change'),
    ('hr_user'),
    ('mms_ledger')
  ) as mods(m)
  on conflict (role_id, module) do update
    set scope_type = 'all',
        dept_id = null;

  return new;
end;
$$;

drop trigger if exists tg_super_admin_scopes on public.roles;
create trigger tg_super_admin_scopes
after insert or update on public.roles
for each row execute function public.ensure_super_admin_scopes();

-- 补齐一次已有超级管理员
update public.roles
set code = code
where code = 'super_admin';
