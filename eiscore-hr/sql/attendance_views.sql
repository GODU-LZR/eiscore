-- Attendance views and helper functions.

create or replace view hr.v_attendance_daily as
select
  r.*,
  array_to_string(r.punch_times, '  ') as punch_text,
  coalesce(array_length(r.punch_times, 1), 0) as punch_count,
  (select min(t) from unnest(r.punch_times) as t) as first_punch,
  (select max(t) from unnest(r.punch_times) as t) as last_punch
from hr.attendance_records r;

create or replace view hr.v_attendance_monthly as
with base as (
  select
    date_trunc('month', r.att_date)::date as att_month,
    r.dept_name,
    r.person_type,
    r.employee_id,
    r.employee_name,
    r.employee_no,
    r.temp_name,
    r.temp_phone,
    count(*) as total_days,
    sum(r.late_flag::int) as late_days,
    sum(r.early_flag::int) as early_days,
    sum(r.leave_flag::int) as leave_days,
    sum(r.absent_flag::int) as absent_days,
    sum(r.overtime_minutes) as overtime_minutes
  from hr.attendance_records r
  group by
    att_month,
    r.dept_name,
    r.person_type,
    r.employee_id,
    r.employee_name,
    r.employee_no,
    r.temp_name,
    r.temp_phone
)
select
  base.att_month,
  base.dept_name,
  base.person_type,
  base.employee_id,
  base.employee_name,
  base.employee_no,
  base.temp_name,
  base.temp_phone,
  coalesce(ovr.total_days, base.total_days) as total_days,
  coalesce(ovr.late_days, base.late_days) as late_days,
  coalesce(ovr.early_days, base.early_days) as early_days,
  coalesce(ovr.leave_days, base.leave_days) as leave_days,
  coalesce(ovr.absent_days, base.absent_days) as absent_days,
  coalesce(ovr.overtime_minutes, base.overtime_minutes) as overtime_minutes,
  ovr.remark as remark
from base
left join hr.attendance_month_overrides ovr
  on ovr.att_month = base.att_month
  and ovr.person_key = (
    case
      when base.person_type = 'employee' then 'emp:' || base.employee_id::text
      else 'temp:' || coalesce(base.temp_phone, base.temp_name, '')
    end
  );

create or replace function hr.init_attendance_records(p_date date, p_dept_name text default null)
returns integer
language plpgsql
as $$
declare
  inserted_count integer;
begin
  insert into hr.attendance_records (
    att_date,
    person_type,
    employee_id,
    employee_name,
    employee_no,
    dept_name
  )
  select
    p_date,
    'employee',
    e.id,
    e.name,
    e.employee_no,
    coalesce(e.department, '未分配')
  from hr.archives e
  where (p_dept_name is null or e.department = p_dept_name)
    and not exists (
      select 1
      from hr.attendance_records r
      where r.att_date = p_date
        and r.person_type = 'employee'
        and r.employee_id = e.id
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant select on hr.v_attendance_daily to web_user;
grant select on hr.v_attendance_monthly to web_user;
grant execute on function hr.init_attendance_records(date, text) to web_user;
