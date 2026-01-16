-- Seed roles, permissions, and sample users.
-- Safe to run multiple times.

-- Roles
insert into public.roles (code, name, description)
values
  ('super_admin', 'Super Admin', 'All permissions'),
  ('hr_admin', 'HR Admin', 'HR full access'),
  ('hr_clerk', 'HR Clerk', 'HR edit access'),
  ('dept_manager', 'Dept Manager', 'Department manager'),
  ('employee', 'Employee', 'Regular employee')
on conflict (code) do nothing;

-- Permissions (HR modules)
insert into public.permissions (code, name, module, action)
values
  ('hr:employee.view', 'Employee View', 'hr', 'view'),
  ('hr:employee.create', 'Employee Create', 'hr', 'create'),
  ('hr:employee.edit', 'Employee Edit', 'hr', 'edit'),
  ('hr:employee.delete', 'Employee Delete', 'hr', 'delete'),
  ('hr:employee.export', 'Employee Export', 'hr', 'export'),
  ('hr:employee.config', 'Employee Config', 'hr', 'config'),

  ('hr:org.view', 'Org View', 'hr', 'view'),
  ('hr:org.create', 'Org Create', 'hr', 'create'),
  ('hr:org.edit', 'Org Edit', 'hr', 'edit'),
  ('hr:org.delete', 'Org Delete', 'hr', 'delete'),
  ('hr:org.export', 'Org Export', 'hr', 'export'),
  ('hr:org.config', 'Org Config', 'hr', 'config'),

  ('hr:change.view', 'Change View', 'hr', 'view'),
  ('hr:change.create', 'Change Create', 'hr', 'create'),
  ('hr:change.edit', 'Change Edit', 'hr', 'edit'),
  ('hr:change.delete', 'Change Delete', 'hr', 'delete'),
  ('hr:change.export', 'Change Export', 'hr', 'export'),

  ('hr:attendance.view', 'Attendance View', 'hr', 'view'),
  ('hr:attendance.create', 'Attendance Create', 'hr', 'create'),
  ('hr:attendance.edit', 'Attendance Edit', 'hr', 'edit'),
  ('hr:attendance.delete', 'Attendance Delete', 'hr', 'delete'),
  ('hr:attendance.export', 'Attendance Export', 'hr', 'export'),

  ('hr:payroll.view', 'Payroll View', 'hr', 'view'),
  ('hr:payroll.create', 'Payroll Create', 'hr', 'create'),
  ('hr:payroll.edit', 'Payroll Edit', 'hr', 'edit'),
  ('hr:payroll.delete', 'Payroll Delete', 'hr', 'delete'),
  ('hr:payroll.export', 'Payroll Export', 'hr', 'export'),

  ('hr:profile.view', 'Profile View', 'hr', 'view'),
  ('hr:profile.create', 'Profile Create', 'hr', 'create'),
  ('hr:profile.edit', 'Profile Edit', 'hr', 'edit'),
  ('hr:profile.delete', 'Profile Delete', 'hr', 'delete'),
  ('hr:profile.export', 'Profile Export', 'hr', 'export')
on conflict (code) do nothing;

-- Role-permission mapping
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on true
where r.code = 'super_admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code like 'hr:%'
where r.code = 'hr_admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code ~ '^hr:(employee|org|change|attendance|payroll|profile)\\.(view|create|edit)$'
where r.code = 'hr_clerk'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code ~ '^hr:(employee|attendance|change|payroll)\\.(view|export)$'
where r.code = 'dept_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code ~ '^hr:(employee|attendance|profile)\\.view$'
where r.code = 'employee'
on conflict do nothing;

-- Departments (Chinese)
with dept_data(name, sort) as (
  values
    ('行政部', 10),
    ('人力资源部', 20),
    ('研发部', 30),
    ('生产部', 40),
    ('质量管理部', 50),
    ('设备维护部', 60),
    ('仓储物流部', 70),
    ('采购部', 80),
    ('财务部', 90),
    ('销售部', 100),
    ('客服部', 110),
    ('信息化/IT部', 120)
)
insert into public.departments (name, sort, status)
select d.name, d.sort, 'active'
from dept_data d
where not exists (
  select 1 from public.departments existing where existing.name = d.name
);

-- Positions (Chinese)
with dept_map as (
  select id, name from public.departments
),
pos_data(dept_name, position_name, sort) as (
  values
    ('行政部', '行政专员', 10),
    ('行政部', '行政主管', 20),
    ('人力资源部', '招聘专员', 10),
    ('人力资源部', 'HR主管', 20),
    ('研发部', '前端工程师', 10),
    ('研发部', '后端工程师', 20),
    ('生产部', '生产工', 10),
    ('生产部', '生产主管', 20),
    ('质量管理部', '质检员', 10),
    ('质量管理部', '质检主管', 20),
    ('设备维护部', '设备工程师', 10),
    ('设备维护部', '维修工', 20),
    ('仓储物流部', '仓管员', 10),
    ('仓储物流部', '物流专员', 20),
    ('采购部', '采购员', 10),
    ('采购部', '采购主管', 20),
    ('财务部', '会计', 10),
    ('财务部', '出纳', 20),
    ('销售部', '销售专员', 10),
    ('销售部', '销售主管', 20),
    ('客服部', '客服专员', 10),
    ('客服部', '客服主管', 20),
    ('信息化/IT部', '运维工程师', 10),
    ('信息化/IT部', 'IT主管', 20)
)
insert into public.positions (name, dept_id, level, status)
select p.position_name, d.id, null, 'active'
from pos_data p
join dept_map d on d.name = p.dept_name
where not exists (
  select 1
  from public.positions existing
  where existing.name = p.position_name and existing.dept_id = d.id
);

-- Sample users (public.users)
insert into public.users (username, password, role, full_name, permissions, status)
select
  'hr_admin',
  '123456',
  'hr_admin',
  'HR Admin',
  (select array_agg(code) from public.permissions where code like 'hr:%'),
  'active'
where not exists (select 1 from public.users where username = 'hr_admin');

insert into public.users (username, password, role, full_name, permissions, status)
select
  'hr_clerk',
  '123456',
  'hr_clerk',
  'HR Clerk',
  (select array_agg(code) from public.permissions where code ~ '^hr:(employee|org|change|attendance|payroll|profile)\\.(view|create|edit)$'),
  'active'
where not exists (select 1 from public.users where username = 'hr_clerk');

insert into public.users (username, password, role, full_name, permissions, status)
select
  'dept_manager',
  '123456',
  'dept_manager',
  'Dept Manager',
  (select array_agg(code) from public.permissions where code ~ '^hr:(employee|attendance|change|payroll)\\.(view|export)$'),
  'active'
where not exists (select 1 from public.users where username = 'dept_manager');

insert into public.users (username, password, role, full_name, permissions, status)
select
  'employee',
  '123456',
  'employee',
  'Employee',
  (select array_agg(code) from public.permissions where code ~ '^hr:(employee|attendance|profile)\\.view$'),
  'active'
where not exists (select 1 from public.users where username = 'employee');

-- Ensure admin has full permissions if exists
update public.users
set role = 'super_admin',
    permissions = (select array_agg(code) from public.permissions)
where username = 'admin';

-- Attach departments and positions for sample users
with dept_map as (
  select id, name from public.departments
),
pos_map as (
  select id, name, dept_id from public.positions
),
assignments(username, dept_name, position_name) as (
  values
    ('admin', '行政部', '行政主管'),
    ('hr_admin', '人力资源部', 'HR主管'),
    ('hr_clerk', '人力资源部', '招聘专员'),
    ('dept_manager', '生产部', '生产主管'),
    ('employee', '生产部', '生产工')
)
update public.users u
set dept_id = d.id,
    position_id = p.id
from assignments a
join dept_map d on d.name = a.dept_name
join pos_map p on p.name = a.position_name and p.dept_id = d.id
where u.username = a.username;

-- User-role mapping
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.roles r on r.code = u.role
where u.username in ('admin', 'hr_admin', 'hr_clerk', 'dept_manager', 'employee')
on conflict do nothing;
