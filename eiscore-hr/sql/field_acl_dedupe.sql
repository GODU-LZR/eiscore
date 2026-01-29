-- 清理 sys_field_acl 重复记录，并补唯一约束
-- 执行方式（UTF-8）：cat field_acl_dedupe.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

begin;

-- 删除重复，只保留每组 role_id/module/field_code 最小 id 的一条
with ranked as (
  select ctid, row_number() over (partition by role_id, module, field_code order by id asc) as rn
  from public.sys_field_acl
)
delete from public.sys_field_acl
where ctid in (select ctid from ranked where rn > 1);

-- 添加唯一约束（如果已存在会报错，可手动忽略）
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'sys_field_acl_role_module_field_code_uq'
  ) then
    execute 'create unique index sys_field_acl_role_module_field_code_uq on public.sys_field_acl (role_id, module, field_code)';
  end if;
end$$;

commit;
