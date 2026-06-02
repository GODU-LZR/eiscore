-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Non-destructive sales permission patch.
-- Apply with:
--   docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore < sql/sales_permissions_patch.sql
--
-- This patch only upserts permission metadata and role bindings. It does not
-- truncate or modify sales business data.

insert into public.permissions (code, name, module, action)
values
  ('module:sales', '销售管理', 'sales', 'module'),
  ('app:sales_dashboard', '销售看板', 'sales', 'app'),
  ('app:sales_cockpit', '销售驾驶舱', 'sales', 'app'),
  ('app:sales_customer', '客户档案', 'sales', 'app'),
  ('app:sales_follow_up', '客户跟进', 'sales', 'app'),
  ('app:sales_opportunity', '销售商机', 'sales', 'app'),
  ('app:sales_order', '销售订单', 'sales', 'app'),
  ('app:sales_payment', '回款记录', 'sales', 'app'),
  ('op:sales_customer.create', '客户档案-新增', 'sales_customer', 'create'),
  ('op:sales_customer.edit', '客户档案-编辑', 'sales_customer', 'edit'),
  ('op:sales_customer.delete', '客户档案-删除', 'sales_customer', 'delete'),
  ('op:sales_customer.export', '客户档案-导出', 'sales_customer', 'export'),
  ('op:sales_customer.config', '客户档案-列配置', 'sales_customer', 'config'),
  ('op:sales_follow_up.create', '客户跟进-新增', 'sales_follow_up', 'create'),
  ('op:sales_follow_up.edit', '客户跟进-编辑', 'sales_follow_up', 'edit'),
  ('op:sales_follow_up.delete', '客户跟进-删除', 'sales_follow_up', 'delete'),
  ('op:sales_follow_up.export', '客户跟进-导出', 'sales_follow_up', 'export'),
  ('op:sales_follow_up.config', '客户跟进-列配置', 'sales_follow_up', 'config'),
  ('op:sales_opportunity.create', '销售商机-新增', 'sales_opportunity', 'create'),
  ('op:sales_opportunity.edit', '销售商机-编辑', 'sales_opportunity', 'edit'),
  ('op:sales_opportunity.delete', '销售商机-删除', 'sales_opportunity', 'delete'),
  ('op:sales_opportunity.export', '销售商机-导出', 'sales_opportunity', 'export'),
  ('op:sales_opportunity.config', '销售商机-列配置', 'sales_opportunity', 'config'),
  ('op:sales_order.create', '销售订单-新增', 'sales_order', 'create'),
  ('op:sales_order.edit', '销售订单-编辑', 'sales_order', 'edit'),
  ('op:sales_order.delete', '销售订单-删除', 'sales_order', 'delete'),
  ('op:sales_order.export', '销售订单-导出', 'sales_order', 'export'),
  ('op:sales_order.config', '销售订单-列配置', 'sales_order', 'config'),
  ('op:sales_payment.create', '回款记录-新增', 'sales_payment', 'create'),
  ('op:sales_payment.edit', '回款记录-编辑', 'sales_payment', 'edit'),
  ('op:sales_payment.delete', '回款记录-删除', 'sales_payment', 'delete'),
  ('op:sales_payment.export', '回款记录-导出', 'sales_payment', 'export'),
  ('op:sales_payment.config', '回款记录-列配置', 'sales_payment', 'config')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    action = excluded.action,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('super_admin', 'sales_manager')
  and (
    p.code = 'module:sales'
    or p.code in (
      'app:sales_dashboard',
      'app:sales_cockpit',
      'app:sales_customer',
      'app:sales_follow_up',
      'app:sales_opportunity',
      'app:sales_order',
      'app:sales_payment'
    )
    or p.code like 'op:sales\_%' escape '\'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('purchase_manager', 'dept_manager')
  and p.code in (
    'app:sales_order',
    'app:sales_customer',
    'op:sales_order.export',
    'op:sales_customer.export'
  )
on conflict do nothing;
