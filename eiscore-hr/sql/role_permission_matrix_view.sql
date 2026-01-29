-- Role-permission matrix view (all permissions x roles) with granted flag
-- 执行方式（UTF-8）：cat role_permission_matrix_view.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace view public.v_role_permissions_matrix as
select
  (r.id::text || ':' || p.id::text) as id,
  r.id as role_id,
  p.id as permission_id,
  p.code,
  p.name,
  p.module,
  p.action,
  (rp.permission_id is not null) as granted
from public.roles r
cross join public.permissions p
left join public.role_permissions rp
  on rp.role_id = r.id and rp.permission_id = p.id;

grant select, update on public.v_role_permissions_matrix to web_user;

create or replace function public.tg_v_role_permissions_matrix_update()
returns trigger language plpgsql as $$
begin
  if new.granted is distinct from old.granted then
    if new.granted then
      insert into public.role_permissions (role_id, permission_id)
      values (old.role_id, old.permission_id)
      on conflict do nothing;
    else
      delete from public.role_permissions
      where role_id = old.role_id and permission_id = old.permission_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_v_role_permissions_matrix_update on public.v_role_permissions_matrix;
create trigger tg_v_role_permissions_matrix_update
instead of update on public.v_role_permissions_matrix
for each row execute function public.tg_v_role_permissions_matrix_update();
