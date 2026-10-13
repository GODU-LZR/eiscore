-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Explicit local/demo seed for the small-enterprise organization tree.
-- It creates one read-only HR role and one Chinese-named user per department.
-- The password is intentionally the requested demo password (123456); do not
-- use this seed for production credentials.

begin;

create temp table _small_enterprise_department_accounts (
  department_name text primary key,
  username text not null unique,
  full_name text not null,
  role_code text not null unique,
  role_name text not null
) on commit drop;

insert into _small_enterprise_department_accounts
  (department_name, username, full_name, role_code, role_name)
values
  ('公司总部', '张伟', '张伟', 'dept_company_hq_lead', '公司总部负责人'),
  ('行政人事中心', '李娜', '李娜', 'dept_admin_hr_center_lead', '行政人事中心负责人'),
  ('研发技术中心', '王强', '王强', 'dept_rd_tech_center_lead', '研发技术中心负责人'),
  ('生产运营中心', '刘洋', '刘洋', 'dept_production_ops_center_lead', '生产运营中心负责人'),
  ('供应链中心', '陈杰', '陈杰', 'dept_supply_chain_center_lead', '供应链中心负责人'),
  ('市场客户中心', '赵敏', '赵敏', 'dept_market_customer_center_lead', '市场客户中心负责人'),
  ('行政部', '周磊', '周磊', 'dept_admin_lead', '行政部负责人'),
  ('人力资源部', '孙丽', '孙丽', 'dept_hr_lead', '人力资源部负责人'),
  ('研发部', '黄涛', '黄涛', 'dept_rd_lead', '研发部负责人'),
  ('信息化/IT部', '吴斌', '吴斌', 'dept_it_lead', '信息化/IT部负责人'),
  ('生产部', '徐勇', '徐勇', 'dept_production_lead', '生产部负责人'),
  ('质量管理部', '何静', '何静', 'dept_quality_lead', '质量管理部负责人'),
  ('设备维护部', '高峰', '高峰', 'dept_equipment_lead', '设备维护部负责人'),
  ('采购部', '杨帆', '杨帆', 'dept_procurement_lead', '采购部负责人'),
  ('仓储物流部', '朱琳', '朱琳', 'dept_warehouse_logistics_lead', '仓储物流部负责人'),
  ('销售部', '马超', '马超', 'dept_sales_lead', '销售部负责人'),
  ('客服部', '郑爽', '郑爽', 'dept_customer_service_lead', '客服部负责人'),
  ('财务部', '郭婷', '郭婷', 'dept_finance_lead', '财务部负责人');

do $$
begin
  if (select count(*) from public.departments d
      join _small_enterprise_department_accounts m on m.department_name = d.name) <> 18 then
    raise exception '小型企业组织树未完整初始化，预期找到18个部门';
  end if;
  if (select count(*) from public.permissions p
      where p.code in (
        'module:home', 'module:hr', 'app:hr_employee', 'app:hr_org',
        'op:hr_employee.view', 'op:hr_org.view'
      )) <> 6 then
    raise exception 'HR查看权限目录未完整初始化';
  end if;
end;
$$;

-- Never silently take over an existing account or role with the same key.
-- The marker makes repeated execution safe for accounts created by this seed.
do $$
declare
  conflicting_users text;
  conflicting_roles text;
begin
  select string_agg(m.username, ', ' order by m.username)
    into conflicting_users
    from _small_enterprise_department_accounts m
    join public.users u on u.username = m.username
   where coalesce(u.sop_role, '') <> 'small_enterprise_department_account';
  if conflicting_users is not null then
    raise exception '已有同名非小型企业演示账号，未覆盖: %', conflicting_users;
  end if;

  select string_agg(m.role_code, ', ' order by m.role_code)
    into conflicting_roles
    from _small_enterprise_department_accounts m
    join public.roles r on r.code = m.role_code
   where coalesce(r.description, '') not in (
     'small_enterprise_department_account',
     '小型企业部门负责人（演示账号）'
   )
     and coalesce(r.description, '') not like '负责%（本地演示账号）';
  if conflicting_roles is not null then
    raise exception '已有同编码非小型企业部门角色，未覆盖: %', conflicting_roles;
  end if;
end;
$$;

insert into public.roles (code, name, description, sort, dept_id, status)
select m.role_code,
       m.role_name,
       '负责' || m.department_name || '的人事与组织管理查看（本地演示账号）',
       d.sort,
       d.id,
       'active'
  from _small_enterprise_department_accounts m
  join public.departments d on d.name = m.department_name
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort = excluded.sort,
  dept_id = excluded.dept_id,
  status = 'active',
  updated_at = clock_timestamp();

-- The new permission catalog is used by the current HR router. These grants
-- intentionally stop at view access; they do not grant user/ACL administration.
insert into public.role_permissions (role_id, permission_id, status)
select r.id, p.id, 'active'
  from _small_enterprise_department_accounts m
  join public.roles r on r.code = m.role_code
  cross join public.permissions p
 where p.code in (
   'module:home',
   'module:hr',
   'app:hr_employee',
   'app:hr_org',
   'op:hr_employee.view',
   'op:hr_org.view'
 )
on conflict (role_id, permission_id) do update set
  status = 'active',
  updated_at = clock_timestamp();

insert into public.role_data_scopes (role_id, module, scope_type, dept_id, status)
select r.id,
       'hr_employee',
       case when exists (
         select 1 from public.departments child where child.parent_id = d.id
       ) then 'dept_tree' else 'dept' end,
       d.id,
       'active'
  from _small_enterprise_department_accounts m
  join public.departments d on d.name = m.department_name
  join public.roles r on r.code = m.role_code
on conflict (role_id, module) do update set
  scope_type = excluded.scope_type,
  dept_id = excluded.dept_id,
  status = 'active',
  updated_at = clock_timestamp();

insert into public.users
  (username, password, role, full_name, permissions, dept_id, sop_role, status)
select m.username,
       '123456',
       m.role_code,
       m.full_name,
       array(
         select p.code
           from public.permissions p
          where p.code in (
            'module:home',
            'module:hr',
            'app:hr_employee',
            'app:hr_org',
            'op:hr_employee.view',
            'op:hr_org.view'
          )
          order by p.code
       ),
       d.id,
       'small_enterprise_department_account',
       'active'
  from _small_enterprise_department_accounts m
  join public.departments d on d.name = m.department_name
on conflict (username) do update set
  password = excluded.password,
  role = excluded.role,
  full_name = excluded.full_name,
  permissions = excluded.permissions,
  dept_id = excluded.dept_id,
  sop_role = excluded.sop_role,
  status = 'active',
  updated_at = clock_timestamp();

insert into public.user_roles (user_id, role_id)
select u.id, r.id
  from _small_enterprise_department_accounts m
  join public.users u on u.username = m.username
  join public.roles r on r.code = m.role_code
on conflict (user_id, role_id) do nothing;

commit;
