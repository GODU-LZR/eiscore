-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Optional local/demo seed for a small enterprise organization tree.
-- It keeps the existing department names so users and HR archive references
-- remain valid. Run explicitly; this is not part of the production migration
-- manifest.

begin;

-- Stable IDs make the grouping nodes safe to re-run without duplicate roots.
insert into public.departments (id, name, parent_id, sort, status)
values
  ('9b3a1db1-70b8-4a23-9fb1-000000000001', '公司总部', null, 10, 'active'),
  ('9b3a1db1-70b8-4a23-9fb1-000000000002', '行政人事中心', '9b3a1db1-70b8-4a23-9fb1-000000000001', 20, 'active'),
  ('9b3a1db1-70b8-4a23-9fb1-000000000003', '研发技术中心', '9b3a1db1-70b8-4a23-9fb1-000000000001', 30, 'active'),
  ('9b3a1db1-70b8-4a23-9fb1-000000000004', '生产运营中心', '9b3a1db1-70b8-4a23-9fb1-000000000001', 40, 'active'),
  ('9b3a1db1-70b8-4a23-9fb1-000000000005', '供应链中心', '9b3a1db1-70b8-4a23-9fb1-000000000001', 50, 'active'),
  ('9b3a1db1-70b8-4a23-9fb1-000000000006', '市场客户中心', '9b3a1db1-70b8-4a23-9fb1-000000000001', 60, 'active')
on conflict (id) do nothing;

-- Populate the leaf departments when the demo database is empty. Existing
-- departments with the same names are kept and handled by the update below.
with assignments(department_name, parent_name, sort) as (
  values
    ('行政部', '行政人事中心', 10),
    ('人力资源部', '行政人事中心', 20),
    ('研发部', '研发技术中心', 10),
    ('信息化/IT部', '研发技术中心', 20),
    ('生产部', '生产运营中心', 10),
    ('质量管理部', '生产运营中心', 20),
    ('设备维护部', '生产运营中心', 30),
    ('采购部', '供应链中心', 10),
    ('仓储物流部', '供应链中心', 20),
    ('销售部', '市场客户中心', 10),
    ('客服部', '市场客户中心', 20),
    ('财务部', '公司总部', 70)
), parent_map as (
  select name, id
  from public.departments
  where name in ('公司总部', '行政人事中心', '研发技术中心', '生产运营中心', '供应链中心', '市场客户中心')
)
insert into public.departments (name, parent_id, sort, status)
select assignments.department_name, parent_map.id, assignments.sort, 'active'
from assignments
join parent_map on parent_map.name = assignments.parent_name
where not exists (
  select 1
  from public.departments existing
  where existing.name = assignments.department_name
);

-- Only attach currently-root departments. This preserves an existing custom
-- hierarchy if the seed is run against a database that already has one.
with assignments(department_name, parent_name) as (
  values
    ('行政部', '行政人事中心'),
    ('人力资源部', '行政人事中心'),
    ('研发部', '研发技术中心'),
    ('信息化/IT部', '研发技术中心'),
    ('生产部', '生产运营中心'),
    ('质量管理部', '生产运营中心'),
    ('设备维护部', '生产运营中心'),
    ('采购部', '供应链中心'),
    ('仓储物流部', '供应链中心'),
    ('销售部', '市场客户中心'),
    ('客服部', '市场客户中心'),
    ('财务部', '公司总部')
), parent_map as (
  select name, id
  from public.departments
  where name in ('公司总部', '行政人事中心', '研发技术中心', '生产运营中心', '供应链中心', '市场客户中心')
)
update public.departments child
set parent_id = parent_map.id,
    updated_at = now()
from assignments
join parent_map on parent_map.name = assignments.parent_name
where child.name = assignments.department_name
  and child.parent_id is null;

commit;
