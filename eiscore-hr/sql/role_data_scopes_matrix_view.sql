-- 角色数据范围矩阵（展示所有应用）
-- 执行方式（UTF-8）：cat role_data_scopes_matrix_view.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace view public.v_role_data_scopes_matrix as
with modules as (
  select unnest(array[
    'hr_employee',
    'hr_org',
    'hr_attendance',
    'hr_change',
    'hr_acl',
    'hr_user',
    'mms_ledger'
  ]::text[]) as module
),
matrix as (
  select r.id as role_id, m.module
  from public.roles r
  cross join modules m
)
select
  (matrix.role_id::text || ':' || matrix.module) as id,
  matrix.role_id,
  matrix.module,
  coalesce(rds.scope_type, 'self') as scope_type,
  rds.dept_id
from matrix
left join public.role_data_scopes rds
  on rds.role_id = matrix.role_id and rds.module = matrix.module;

grant select, insert, update, delete on public.v_role_data_scopes_matrix to web_user;

create or replace function public.tg_v_role_data_scopes_matrix_update()
returns trigger language plpgsql as $$
begin
  insert into public.role_data_scopes (role_id, module, scope_type, dept_id)
  values (new.role_id, new.module, coalesce(new.scope_type, 'self'), new.dept_id)
  on conflict (role_id, module) do update
    set scope_type = excluded.scope_type,
        dept_id = excluded.dept_id,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_v_role_data_scopes_matrix_update on public.v_role_data_scopes_matrix;
create trigger tg_v_role_data_scopes_matrix_update
instead of update on public.v_role_data_scopes_matrix
for each row execute function public.tg_v_role_data_scopes_matrix_update();
