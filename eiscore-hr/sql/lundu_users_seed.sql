-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Local/acceptance seed for the Lundu workbook users.
-- This is intentionally not part of the production migration manifest.

begin;

create temp table _lundu_users (
  employee_no text primary key,
  username text not null unique,
  full_name text not null,
  dept_id uuid not null,
  role_code text not null
) on commit drop;

insert into _lundu_users (employee_no, username, full_name, dept_id, role_code)
values
  ('001', 'zlh', '曾利花', '9b3a1db1-70b8-4a23-9fb1-000000000001', 'super_admin'),
  ('002', 'hdr', '黄道仁', '9b3a1db1-70b8-4a23-9fb1-000000000001', 'dept_manager'),
  ('003', 'trg', '唐汝国', '9b3a1db1-70b8-4a23-9fb1-000000000001', 'dept_manager'),
  ('004', 'fh', '范华', '9b3a1db1-70b8-4a23-9fb1-000000000001', 'dept_manager'),
  ('005', 'zxy', '周小英', 'd7b359b1-84eb-4ead-9d1a-ef28ec1fbc48', 'dept_manager'),
  ('006', 'lsl', '雷松林', 'd7b359b1-84eb-4ead-9d1a-ef28ec1fbc48', 'employee'),
  ('007', 'jy', '金雅', '54674af8-c6fa-4053-8cd3-d9e34c26982b', 'dept_manager'),
  ('008', 'cah', '曹愛华', '6b112500-f153-431f-8bb1-b5ce39d3edd5', 'dept_manager'),
  ('009', 'lhw', '李华伟', 'd4d64030-6836-4972-9927-2d314e596e6f', 'dept_manager'),
  ('010', 'zyc', '周永成', 'd4d64030-6836-4972-9927-2d314e596e6f', 'dept_manager'),
  ('011', 'lzw', '李中伟', '3082db52-abeb-46e2-8840-9072b792c75a', 'dept_manager'),
  ('012', 'lyy', '李媛媛', 'cc38642d-0f1e-420a-9bde-68a68b512c2e', 'dept_manager'),
  ('013', 'jzb', '蒋照波', 'cc38642d-0f1e-420a-9bde-68a68b512c2e', 'employee'),
  ('014', 'lz', '李筝', '9b3a1db1-70b8-4a23-9fb1-000000000005', 'dept_manager'),
  ('015', 'tlq', '田洛綦', '9b3a1db1-70b8-4a23-9fb1-000000000005', 'employee');

do $$
begin
  if (select count(*) from _lundu_users) <> 15 then
    raise exception '伦度用户种子数量不正确';
  end if;
  if (select count(*) from _lundu_users u join hr.archives a on a.employee_no = u.employee_no) <> 15 then
    raise exception '伦度员工档案未完整导入';
  end if;
  if (select count(*) from _lundu_users u join public.roles r on r.code = u.role_code) <> 15 then
    raise exception '伦度用户角色未完整初始化';
  end if;
end;
$$;

-- Remove the five original demo accounts and the previous small-enterprise demo accounts.
delete from public.users
 where username in ('hr_admin', 'hr_clerk', 'dept_manager', 'employee', 'admin')
    or sop_role = 'small_enterprise_department_account'
    or sop_role = 'lundu_excel_import';

insert into public.users
  (username, password, role, full_name, permissions, dept_id, status, sop_role, tenant_id)
select u.username,
       '123456',
       u.role_code,
       u.full_name,
       case when u.role_code = 'super_admin'
            then array(select code from public.permissions order by code)
            else array['module:home', 'module:hr', 'app:hr_employee', 'app:hr_org',
                       'op:hr_employee.view', 'op:hr_org.view']
       end,
       u.dept_id,
       'active',
       'lundu_excel_import',
       'default'
  from _lundu_users u;

insert into public.user_roles (user_id, role_id)
select u.id, r.id
  from _lundu_users seed
  join public.users u on u.username = seed.username
  join public.roles r on r.code = seed.role_code
on conflict (user_id, role_id) do nothing;

insert into hr.user_employee_links (user_id, archive_id, linked_by)
select u.id, a.id, u.id
  from _lundu_users seed
  join public.users u on u.username = seed.username
  join hr.archives a on a.employee_no = seed.employee_no
on conflict (archive_id) do update
  set user_id = excluded.user_id,
      linked_at = now(),
      updated_at = now(),
      linked_by = excluded.linked_by;

commit;
