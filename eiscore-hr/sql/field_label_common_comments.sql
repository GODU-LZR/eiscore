-- 通用字段中文注释（自动补全未设置的字段）
-- 执行方式（UTF-8）：cat field_label_common_comments.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

do $$
declare
  r record;
  label_map jsonb := '{
    "id":"编号",
    "name":"名称",
    "code":"编码",
    "status":"状态",
    "description":"说明",
    "sort":"排序",
    "created_at":"创建时间",
    "updated_at":"更新时间",
    "employee_no":"工号",
    "employee_id":"员工ID",
    "employee_name":"员工姓名",
    "dept_id":"部门ID",
    "dept_name":"部门",
    "department":"部门",
    "position":"岗位",
    "username":"用户名",
    "full_name":"姓名",
    "email":"邮箱",
    "role":"角色",
    "role_id":"角色",
    "position_id":"岗位ID",
    "avatar":"头像",
    "permissions":"权限集合",
    "password":"密码",
    "phone":"手机号",
    "entry_date":"入职日期",
    "remark":"备注"
  }'::jsonb;
  label text;
begin
  for r in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema in ('public','hr')
  loop
    label := label_map ->> r.column_name;
    if label is not null then
      perform 1
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = r.table_schema
        and c.relname = r.table_name
        and a.attname = r.column_name
        and col_description(c.oid, a.attnum) is null;
      if found then
        execute format('comment on column %I.%I.%I is %L', r.table_schema, r.table_name, r.column_name, label);
      end if;
    end if;
  end loop;
end $$;
