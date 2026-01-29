-- Cascade revoke: module/app permission removal should revoke related app/op and field ACL
-- 执行方式（UTF-8）：cat role_permission_cascade.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace function public.cascade_revoke_permissions()
returns trigger language plpgsql as $$
declare
  pcode text;
  scope text;
  key text;
begin
  select code into pcode from public.permissions where id = old.permission_id;
  if pcode is null then
    return old;
  end if;

  scope := split_part(pcode, ':', 1);
  key := split_part(pcode, ':', 2);

  if scope = 'module' then
    -- revoke related app/op permissions under this module
    delete from public.role_permissions rp
    using public.permissions p
    where rp.role_id = old.role_id
      and rp.permission_id = p.id
      and (p.code like 'app:' || key || '_%' or p.code like 'op:' || key || '_%');

    -- set field ACL to false for module apps
    update public.sys_field_acl
      set can_view = false, can_edit = false
    where role_id = old.role_id
      and module like key || '_%';

  elsif scope = 'app' then
    -- revoke related op permissions under this app
    delete from public.role_permissions rp
    using public.permissions p
    where rp.role_id = old.role_id
      and rp.permission_id = p.id
      and p.code like 'op:' || key || '.%';

    -- set field ACL to false for this app
    update public.sys_field_acl
      set can_view = false, can_edit = false
    where role_id = old.role_id
      and module = key;
  end if;

  return old;
end;
$$;

drop trigger if exists tg_role_permissions_cascade_delete on public.role_permissions;
create trigger tg_role_permissions_cascade_delete
after delete on public.role_permissions
for each row execute function public.cascade_revoke_permissions();

create or replace function public.cascade_grant_permissions()
returns trigger language plpgsql as $$
declare
  pcode text;
  scope text;
  key text;
begin
  select code into pcode from public.permissions where id = new.permission_id;
  if pcode is null then
    return new;
  end if;

  scope := split_part(pcode, ':', 1);
  key := split_part(pcode, ':', 2);

  if scope = 'module' then
    -- grant related app/op permissions under this module
    insert into public.role_permissions (role_id, permission_id)
    select new.role_id, p.id
    from public.permissions p
    where p.code like 'app:' || key || '_%'
       or p.code like 'op:' || key || '_%'
    on conflict do nothing;

    -- set field ACL to true for module apps
    update public.sys_field_acl
      set can_view = true, can_edit = true
    where role_id = new.role_id
      and module like key || '_%';

  elsif scope = 'app' then
    -- grant related op permissions under this app
    insert into public.role_permissions (role_id, permission_id)
    select new.role_id, p.id
    from public.permissions p
    where p.code like 'op:' || key || '.%'
    on conflict do nothing;

    -- set field ACL to true for this app
    update public.sys_field_acl
      set can_view = true, can_edit = true
    where role_id = new.role_id
      and module = key;
  end if;

  return new;
end;
$$;

drop trigger if exists tg_role_permissions_cascade_insert on public.role_permissions;
create trigger tg_role_permissions_cascade_insert
after insert on public.role_permissions
for each row execute function public.cascade_grant_permissions();
