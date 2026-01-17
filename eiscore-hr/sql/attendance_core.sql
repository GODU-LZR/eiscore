-- Attendance core tables (hr schema).
-- Stores daily attendance with multi-punch times and per-day shift snapshot.

create schema if not exists hr;

create table if not exists hr.attendance_shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_time time not null,
  end_time time not null,
  cross_day boolean not null default false,
  late_grace_min integer not null default 0,
  early_grace_min integer not null default 0,
  ot_break_min integer not null default 0,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hr.attendance_records (
  id uuid primary key default gen_random_uuid(),
  att_date date not null,
  person_type text not null default 'employee',
  employee_id bigint,
  employee_name text,
  employee_no text,
  temp_name text,
  temp_phone text,
  dept_id bigint,
  dept_name text not null,
  shift_id uuid references hr.attendance_shifts(id),
  shift_name text,
  shift_start_time time,
  shift_end_time time,
  shift_cross_day boolean,
  late_grace_min integer,
  early_grace_min integer,
  ot_break_min integer,
  punch_times text[] not null default '{}'::text[],
  late_flag boolean not null default false,
  early_flag boolean not null default false,
  leave_flag boolean not null default false,
  absent_flag boolean not null default false,
  overtime_minutes integer not null default 0,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_person_type_check check (person_type in ('employee', 'temp')),
  constraint attendance_person_required check (
    (person_type = 'employee' and employee_id is not null)
    or (person_type = 'temp' and temp_name is not null)
  )
);

create table if not exists hr.attendance_month_overrides (
  id uuid primary key default gen_random_uuid(),
  att_month date not null,
  person_type text not null default 'employee',
  employee_id bigint,
  employee_name text,
  employee_no text,
  temp_name text,
  temp_phone text,
  dept_name text not null,
  person_key text generated always as (
    case
      when person_type = 'employee' then 'emp:' || employee_id::text
      else 'temp:' || coalesce(temp_phone, temp_name, '')
    end
  ) stored,
  total_days integer not null default 0,
  late_days integer not null default 0,
  early_days integer not null default 0,
  leave_days integer not null default 0,
  absent_days integer not null default 0,
  overtime_minutes integer not null default 0,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_month_person_type_check check (person_type in ('employee', 'temp')),
  constraint attendance_month_person_required check (
    (person_type = 'employee' and employee_id is not null)
    or (person_type = 'temp' and temp_name is not null)
  )
);

create index if not exists idx_attendance_records_date on hr.attendance_records (att_date);
create index if not exists idx_attendance_records_dept on hr.attendance_records (dept_name, att_date);
create index if not exists idx_attendance_records_employee on hr.attendance_records (employee_id);

create unique index if not exists uniq_attendance_employee_day
  on hr.attendance_records (att_date, employee_id)
  where person_type = 'employee' and employee_id is not null;

create unique index if not exists uniq_attendance_temp_day_phone
  on hr.attendance_records (att_date, temp_phone)
  where person_type = 'temp' and temp_phone is not null;

create index if not exists idx_attendance_month_overrides_month on hr.attendance_month_overrides (att_month);
create index if not exists idx_attendance_month_overrides_dept on hr.attendance_month_overrides (dept_name, att_month);
create unique index if not exists uniq_attendance_month_person
  on hr.attendance_month_overrides (att_month, person_key);

alter table if exists hr.attendance_month_overrides
  add column if not exists remark text;

grant usage on schema hr to web_user;
grant select, insert, update, delete on hr.attendance_records to web_user;
grant select, insert, update, delete on hr.attendance_shifts to web_user;
grant select, insert, update, delete on hr.attendance_month_overrides to web_user;
