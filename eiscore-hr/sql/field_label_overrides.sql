-- 字段中文覆盖表（用于历史字段或非表字段）
-- 执行方式（UTF-8）：cat field_label_overrides.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create table if not exists public.field_label_overrides (
  module text not null,
  field_code text not null,
  field_label text not null,
  updated_at timestamptz not null default now(),
  primary key (module, field_code)
);

create or replace function public.touch_field_label_overrides()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_field_label_overrides_updated_at on public.field_label_overrides;
create trigger tg_field_label_overrides_updated_at
before update on public.field_label_overrides
for each row execute function public.touch_field_label_overrides();

grant select, insert, update, delete on public.field_label_overrides to web_user;

-- 基础映射：补历史英文 code
insert into public.field_label_overrides (module, field_code, field_label)
values
  ('hr_employee', 'salary', '工资'),
  ('hr_employee', 'performance', '绩效'),
  ('hr_employee', 'total_salary', '总工资'),
  ('hr_employee', 'id_card', '身份证'),
  ('hr_employee', 'native_place', '籍贯'),
  ('hr_employee', 'gender', '性别'),
  ('hr_employee', 'phone', '手机号'),
  ('hr_employee', 'position', '岗位'),
  ('hr_employee', 'department', '部门'),
  ('hr_employee', 'employee_no', '工号'),
  ('hr_employee', 'name', '姓名'),
  ('hr_employee', 'status', '状态'),
  ('hr_change', 'from_dept', '原部门'),
  ('hr_change', 'to_dept', '新部门'),
  ('hr_change', 'from_position', '原岗位'),
  ('hr_change', 'to_position', '新岗位'),
  ('hr_change', 'effective_date', '生效日期'),
  ('hr_change', 'transfer_type', '调岗类型'),
  ('hr_change', 'transfer_reason', '调岗原因'),
  ('hr_change', 'approver', '审批人'),
  ('hr_attendance', 'att_status', '考勤状态'),
  ('hr_attendance', 'check_in', '签到时间'),
  ('hr_attendance', 'check_out', '签退时间'),
  ('hr_attendance', 'att_note', '备注'),
  ('hr_attendance', 'ot_hours', '加班时长'),
  ('hr_user', 'role_id', '角色')
on conflict (module, field_code) do update set field_label = excluded.field_label;
