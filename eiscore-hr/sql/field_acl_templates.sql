-- 字段级权限模板（示例：敏感字段默认控制）
-- 说明：以 hr_employee 为样例，后续模块可参照扩展
-- 执行方式（UTF-8）：cat field_acl_templates.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

with role_map as (
  select id, code from public.roles
),
seed(role_code, module, field_code, can_view, can_edit) as (
  values
    -- 部门主管：可见但不可编辑身份证/工资
    ('dept_manager', 'hr_employee', 'id_card', true, false),
    ('dept_manager', 'hr_employee', 'salary', true, false),
    -- 员工：不可见身份证/工资
    ('employee', 'hr_employee', 'id_card', false, false),
    ('employee', 'hr_employee', 'salary', false, false),
    -- 人事文员：可见身份证，不可改；工资可见可改按需收敛
    ('hr_clerk', 'hr_employee', 'id_card', true, false),
    ('hr_clerk', 'hr_employee', 'salary', true, true)
),
upsert as (
  insert into public.sys_field_acl (role_id, module, field_code, can_view, can_edit)
  select r.id, s.module, s.field_code, s.can_view, s.can_edit
  from seed s
  join role_map r on r.code = s.role_code
  on conflict (role_id, module, field_code)
  do update set
    can_view = excluded.can_view,
    can_edit = excluded.can_edit
  returning 1
)
select count(*) as upserted from upsert;
