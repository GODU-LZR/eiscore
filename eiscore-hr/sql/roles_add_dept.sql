-- 角色绑定部门
-- 执行方式（UTF-8）：cat roles_add_dept.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

alter table public.roles
  add column if not exists dept_id uuid;

alter table public.roles
  drop constraint if exists roles_dept_id_fkey;

alter table public.roles
  add constraint roles_dept_id_fkey
  foreign key (dept_id) references public.departments(id) on delete set null;
