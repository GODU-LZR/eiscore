-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Sales module base tables and demo data.

create table if not exists public.sales_customers (
  id uuid primary key default gen_random_uuid(),
  customer_no text not null unique,
  name text not null,
  level text not null default '普通客户',
  contact_name text,
  contact_phone text,
  region text,
  owner_name text,
  customer_status text not null default '跟进中',
  credit_limit numeric(14,2) not null default 0,
  receivable_balance numeric(14,2) not null default 0,
  last_follow_up_at date,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id uuid references public.sales_customers(id) on delete set null,
  customer_name text not null,
  product_name text not null,
  quantity numeric(14,2) not null default 0,
  unit text not null default '箱',
  unit_price numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  order_date date not null default current_date,
  delivery_date date,
  order_status text not null default '草稿',
  owner_name text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_no text not null unique,
  opportunity_name text not null,
  customer_id uuid references public.sales_customers(id) on delete set null,
  customer_name text not null,
  expected_amount numeric(14,2) not null default 0,
  stage text not null default '初步接洽',
  probability numeric(5,2) not null default 20,
  expected_close_date date,
  owner_name text,
  next_action text,
  remark text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text not null unique,
  order_id uuid references public.sales_orders(id) on delete set null,
  order_no text,
  customer_id uuid references public.sales_customers(id) on delete set null,
  customer_name text not null,
  amount numeric(14,2) not null default 0,
  payment_date date not null default current_date,
  payment_method text not null default '银行转账',
  verify_status text not null default '待核销',
  handler_name text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_follow_ups (
  id uuid primary key default gen_random_uuid(),
  follow_no text not null unique,
  customer_id uuid references public.sales_customers(id) on delete set null,
  customer_name text not null,
  contact_name text,
  follow_date date not null default current_date,
  follow_type text not null default '电话沟通',
  follow_result text not null default '待跟进',
  next_follow_at date,
  owner_name text,
  follow_content text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sales_customers_updated_at on public.sales_customers;
create trigger trg_sales_customers_updated_at
before update on public.sales_customers
for each row execute function public.touch_updated_at();

drop trigger if exists trg_sales_orders_updated_at on public.sales_orders;
create trigger trg_sales_orders_updated_at
before update on public.sales_orders
for each row execute function public.touch_updated_at();

drop trigger if exists trg_sales_opportunities_updated_at on public.sales_opportunities;
create trigger trg_sales_opportunities_updated_at
before update on public.sales_opportunities
for each row execute function public.touch_updated_at();

drop trigger if exists trg_sales_payments_updated_at on public.sales_payments;
create trigger trg_sales_payments_updated_at
before update on public.sales_payments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_sales_follow_ups_updated_at on public.sales_follow_ups;
create trigger trg_sales_follow_ups_updated_at
before update on public.sales_follow_ups
for each row execute function public.touch_updated_at();

grant select on public.sales_customers, public.sales_orders, public.sales_opportunities, public.sales_payments, public.sales_follow_ups to web_anon;
grant select, insert, update, delete on public.sales_customers, public.sales_orders, public.sales_opportunities, public.sales_payments, public.sales_follow_ups to web_user;

alter table public.sales_customers enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_opportunities enable row level security;
alter table public.sales_payments enable row level security;
alter table public.sales_follow_ups enable row level security;

drop policy if exists sales_customers_select on public.sales_customers;
drop policy if exists sales_customers_insert on public.sales_customers;
drop policy if exists sales_customers_update on public.sales_customers;
drop policy if exists sales_customers_delete on public.sales_customers;
create policy sales_customers_select on public.sales_customers for select to web_user, web_anon using (true);
create policy sales_customers_insert on public.sales_customers for insert to web_user with check (true);
create policy sales_customers_update on public.sales_customers for update to web_user using (true) with check (true);
create policy sales_customers_delete on public.sales_customers for delete to web_user using (true);

drop policy if exists sales_orders_select on public.sales_orders;
drop policy if exists sales_orders_insert on public.sales_orders;
drop policy if exists sales_orders_update on public.sales_orders;
drop policy if exists sales_orders_delete on public.sales_orders;
create policy sales_orders_select on public.sales_orders for select to web_user, web_anon using (true);
create policy sales_orders_insert on public.sales_orders for insert to web_user with check (true);
create policy sales_orders_update on public.sales_orders for update to web_user using (true) with check (true);
create policy sales_orders_delete on public.sales_orders for delete to web_user using (true);

drop policy if exists sales_opportunities_select on public.sales_opportunities;
drop policy if exists sales_opportunities_insert on public.sales_opportunities;
drop policy if exists sales_opportunities_update on public.sales_opportunities;
drop policy if exists sales_opportunities_delete on public.sales_opportunities;
create policy sales_opportunities_select on public.sales_opportunities for select to web_user, web_anon using (true);
create policy sales_opportunities_insert on public.sales_opportunities for insert to web_user with check (true);
create policy sales_opportunities_update on public.sales_opportunities for update to web_user using (true) with check (true);
create policy sales_opportunities_delete on public.sales_opportunities for delete to web_user using (true);

drop policy if exists sales_payments_select on public.sales_payments;
drop policy if exists sales_payments_insert on public.sales_payments;
drop policy if exists sales_payments_update on public.sales_payments;
drop policy if exists sales_payments_delete on public.sales_payments;
create policy sales_payments_select on public.sales_payments for select to web_user, web_anon using (true);
create policy sales_payments_insert on public.sales_payments for insert to web_user with check (true);
create policy sales_payments_update on public.sales_payments for update to web_user using (true) with check (true);
create policy sales_payments_delete on public.sales_payments for delete to web_user using (true);

drop policy if exists sales_follow_ups_select on public.sales_follow_ups;
drop policy if exists sales_follow_ups_insert on public.sales_follow_ups;
drop policy if exists sales_follow_ups_update on public.sales_follow_ups;
drop policy if exists sales_follow_ups_delete on public.sales_follow_ups;
create policy sales_follow_ups_select on public.sales_follow_ups for select to web_user, web_anon using (true);
create policy sales_follow_ups_insert on public.sales_follow_ups for insert to web_user with check (true);
create policy sales_follow_ups_update on public.sales_follow_ups for update to web_user using (true) with check (true);
create policy sales_follow_ups_delete on public.sales_follow_ups for delete to web_user using (true);

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
    or p.code in ('app:sales_dashboard', 'app:sales_cockpit', 'app:sales_customer', 'app:sales_follow_up', 'app:sales_opportunity', 'app:sales_order', 'app:sales_payment')
    or p.code like 'op:sales\_%' escape '\'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('purchase_manager', 'dept_manager')
  and p.code in ('app:sales_order', 'app:sales_customer', 'op:sales_order.export', 'op:sales_customer.export')
on conflict do nothing;

insert into public.system_configs (key, value)
values
  ('sales_customers_cols', '[]'::jsonb),
  ('sales_follow_ups_cols', '[{"label":"下次动作","prop":"next_action","type":"text"},{"label":"紧急程度","prop":"priority","type":"select","options":[{"label":"高","value":"高"},{"label":"中","value":"中"},{"label":"低","value":"低"}]}]'::jsonb),
  ('sales_opportunities_cols', '[{"label":"商机来源","prop":"source","type":"select","options":[{"label":"客户跟进","value":"客户跟进"},{"label":"老客复购","value":"老客复购"},{"label":"展会线索","value":"展会线索"},{"label":"转介绍","value":"转介绍"}]},{"label":"竞争情况","prop":"competition","type":"text"}]'::jsonb),
  ('sales_orders_cols', '[{"label":"订单毛利","prop":"gross_profit","type":"formula","expression":"{订单金额}*0.18"},{"label":"交付风险","prop":"delivery_risk","type":"select","options":[{"label":"正常","value":"正常"},{"label":"临期","value":"临期"},{"label":"延期","value":"延期"}]}]'::jsonb),
  ('sales_payments_cols', '[{"label":"备注","prop":"payment_note","type":"text"}]'::jsonb)
on conflict (key) do nothing;

truncate table public.sales_payments, public.sales_follow_ups, public.sales_opportunities, public.sales_orders, public.sales_customers restart identity cascade;

insert into public.sales_customers
  (customer_no, name, level, contact_name, contact_phone, region, owner_name, customer_status, credit_limit, receivable_balance, last_follow_up_at, status, properties)
values
  ('CUST-001', '南派食品华东经销中心', '战略客户', '周明', '13800010001', '华东一区', '吴销售', '已成交', 800000, 186500, current_date - 2, 'active', '{"行业":"食品经销","渠道":"区域总代"}'),
  ('CUST-002', '杭州优鲜连锁超市', '重点客户', '赵琳', '13800010002', '华东二区', '吴销售', '已成交', 520000, 93200, current_date - 4, 'active', '{"行业":"连锁商超","渠道":"KA"}'),
  ('CUST-003', '南京云仓团餐配送', '重点客户', '陈启', '13800010003', '华东一区', 'sales_manager', '跟进中', 360000, 0, current_date - 1, 'active', '{"行业":"团餐配送","渠道":"B端"}'),
  ('CUST-004', '苏州锦味食品贸易', '普通客户', '孙悦', '13800010004', '华东二区', '吴销售', '已成交', 260000, 45200, current_date - 8, 'active', '{"行业":"食品贸易","渠道":"批发"}'),
  ('CUST-005', '上海鲜厨供应链', '战略客户', '刘凯', '13800010005', '华东一区', 'sales_manager', '已成交', 900000, 241800, current_date - 3, 'active', '{"行业":"供应链平台","渠道":"集采"}'),
  ('CUST-006', '宁波湾区便利采购', '普通客户', '许晴', '13800010006', '华东三区', '吴销售', '跟进中', 180000, 0, current_date - 6, 'active', '{"行业":"便利零售","渠道":"区域零售"}'),
  ('CUST-007', '合肥餐饮联合采购', '潜在客户', '马腾', '13800010007', '华中一区', 'sales_manager', '跟进中', 120000, 0, current_date - 5, 'active', '{"行业":"餐饮采购","渠道":"联合采购"}'),
  ('CUST-008', '无锡城市生鲜仓', '重点客户', '钱宁', '13800010008', '华东二区', '吴销售', '暂停合作', 300000, 32800, current_date - 18, 'active', '{"行业":"生鲜仓配","渠道":"城市仓"}');

insert into public.sales_follow_ups
  (follow_no, customer_id, customer_name, contact_name, follow_date, follow_type, follow_result, next_follow_at, owner_name, follow_content, status, properties)
select *
from (
  select 'FU-202605-001', c.id, c.name, c.contact_name, current_date - 2, '电话沟通', '已成交', current_date + 5, '吴销售', '确认端午补货节奏，客户要求保留华东仓安全库存。', 'active', '{"下次动作":"确认月度补货订单","紧急程度":"中"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-001'
  union all select 'FU-202605-002', c.id, c.name, c.contact_name, current_date - 4, '微信沟通', '报价中', current_date + 2, '吴销售', '客户反馈 KA 促销包装价格偏高，需要给出阶梯价方案。', 'active', '{"下次动作":"补充阶梯报价","紧急程度":"高"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-002'
  union all select 'FU-202605-003', c.id, c.name, c.contact_name, current_date - 1, '视频会议', '样品确认', current_date + 3, 'sales_manager', '团餐客户完成样品试吃，关注复合调味料稳定供货。', 'active', '{"下次动作":"安排小批量试单","紧急程度":"高"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-003'
  union all select 'FU-202605-004', c.id, c.name, c.contact_name, current_date - 8, '上门拜访', '有意向', current_date + 7, '吴销售', '客户计划增加火锅底料品类，希望确认季度返利政策。', 'active', '{"下次动作":"提交返利政策","紧急程度":"中"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-004'
  union all select 'FU-202605-005', c.id, c.name, c.contact_name, current_date - 3, '电话沟通', '已成交', current_date + 1, 'sales_manager', '集采平台确认家庭装套装排产，需每日同步交付进度。', 'active', '{"下次动作":"同步排产进度","紧急程度":"高"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-005'
  union all select 'FU-202605-006', c.id, c.name, c.contact_name, current_date - 6, '微信沟通', '待跟进', current_date + 4, '吴销售', '便利采购客户完成首批试销，需要回访动销情况。', 'active', '{"下次动作":"回访试销动销","紧急程度":"中"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-006'
  union all select 'FU-202605-007', c.id, c.name, c.contact_name, current_date - 5, '展会接洽', '有意向', current_date + 6, 'sales_manager', '餐饮联合采购关注牛肉酱餐饮装规格，需准备报价版本。', 'active', '{"下次动作":"发送餐饮装报价","紧急程度":"中"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-007'
  union all select 'FU-202605-008', c.id, c.name, c.contact_name, current_date - 18, '电话沟通', '暂缓', current_date - 2, '吴销售', '客户因仓储调整暂缓复购，需要重新确认合作计划。', 'active', '{"下次动作":"重新确认复购计划","紧急程度":"高"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-008'
) as v;

insert into public.sales_opportunities
  (opportunity_no, opportunity_name, customer_id, customer_name, expected_amount, stage, probability, expected_close_date, owner_name, next_action, remark, status, properties)
select *
from (
  select 'OPP-202605-001', '华东经销中心端午补货', c.id, c.name, 185000.00, '商务谈判', 75, current_date + 7, '吴销售', '确认安全库存与配送批次', '老客户补货需求明确，重点关注交付节奏。', 'active', '{"商机来源":"老客复购","竞争情况":"无明显竞争"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-001'
  union all select 'OPP-202605-002', '杭州优鲜 KA 促销装', c.id, c.name, 126000.00, '方案报价', 55, current_date + 14, '吴销售', '补充阶梯报价', '客户关注促销包装价格，需要给出不同采购量报价。', 'active', '{"商机来源":"客户跟进","竞争情况":"同类品牌比价"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-002'
  union all select 'OPP-202605-003', '南京团餐调味料试单', c.id, c.name, 82000.00, '需求确认', 45, current_date + 21, 'sales_manager', '安排小批量试单', '样品反馈较好，下一步验证供货稳定性。', 'active', '{"商机来源":"客户跟进","竞争情况":"关注交付稳定性"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-003'
  union all select 'OPP-202605-004', '苏州贸易季度返利订单', c.id, c.name, 68000.00, '商务谈判', 65, current_date + 10, '吴销售', '提交季度返利政策', '客户希望增加火锅底料品类，返利政策是关键。', 'active', '{"商机来源":"老客复购","竞争情况":"区域批发价格敏感"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-004'
  union all select 'OPP-202605-005', '上海鲜厨家庭装集采', c.id, c.name, 240000.00, '赢单', 100, current_date - 2, 'sales_manager', '同步排产进度', '已确认集采排产，后续重点跟交付。', 'active', '{"商机来源":"老客复购","竞争情况":"已锁定"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-005'
  union all select 'OPP-202605-006', '宁波便利试销复购', c.id, c.name, 52000.00, '初步接洽', 30, current_date + 28, '吴销售', '回访试销动销', '首批试销已铺货，需要根据动销决定复购规模。', 'active', '{"商机来源":"客户跟进","竞争情况":"待确认"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-006'
  union all select 'OPP-202605-007', '合肥餐饮装报价', c.id, c.name, 76000.00, '方案报价', 50, current_date + 18, 'sales_manager', '发送餐饮装报价', '展会线索，客户关注餐饮装规格和价格。', 'active', '{"商机来源":"展会线索","竞争情况":"多家供应商比价"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-007'
  union all select 'OPP-202605-008', '无锡城市仓复购重启', c.id, c.name, 39000.00, '搁置', 15, current_date + 35, '吴销售', '重新确认复购计划', '客户仓储调整导致复购延后。', 'active', '{"商机来源":"老客复购","竞争情况":"客户内部计划未定"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-008'
) as v;

insert into public.sales_orders
  (order_no, customer_id, customer_name, product_name, quantity, unit, unit_price, total_amount, order_date, delivery_date, order_status, owner_name, status, properties)
select *
from (
  select 'SO-202605-001', c.id, c.name, '经典香辣酱礼盒', 320, '箱', 168.00, 53760.00, current_date - 25, current_date - 18, '已完成', '吴销售', 'active', '{"渠道":"经销","合同类型":"月度补货"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-001'
  union all select 'SO-202605-002', c.id, c.name, '鲜香牛肉酱', 600, '箱', 96.00, 57600.00, current_date - 22, current_date - 12, '已发货', '吴销售', 'active', '{"渠道":"KA","促销批次":"端午前置"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-002'
  union all select 'SO-202605-003', c.id, c.name, '复合调味料组合包', 480, '箱', 128.00, 61440.00, current_date - 18, current_date - 5, '生产中', 'sales_manager', 'active', '{"渠道":"团餐","交付要求":"分批送达"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-003'
  union all select 'SO-202605-004', c.id, c.name, '川味火锅底料', 260, '箱', 132.00, 34320.00, current_date - 15, current_date - 7, '已确认', '吴销售', 'active', '{"渠道":"批发","价格政策":"季度价"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-004'
  union all select 'SO-202605-005', c.id, c.name, '家庭装调味套装', 900, '箱', 118.00, 106200.00, current_date - 12, current_date + 3, '生产中', 'sales_manager', 'active', '{"渠道":"集采","交付风险":"临期"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-005'
  union all select 'SO-202605-006', c.id, c.name, '经典香辣酱礼盒', 180, '箱', 170.00, 30600.00, current_date - 8, current_date + 2, '已确认', '吴销售', 'active', '{"渠道":"零售","试销":"true"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-006'
  union all select 'SO-202605-007', c.id, c.name, '鲜香牛肉酱', 420, '箱', 98.00, 41160.00, current_date - 6, current_date + 5, '草稿', 'sales_manager', 'draft', '{"渠道":"餐饮","报价版本":"V2"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-007'
  union all select 'SO-202605-008', c.id, c.name, '轻食拌饭酱', 300, '箱', 105.00, 31500.00, current_date - 3, current_date + 9, '已确认', '吴销售', 'active', '{"渠道":"城市仓","复购":"true"}'::jsonb from public.sales_customers c where c.customer_no = 'CUST-008'
) as v;

insert into public.sales_payments
  (payment_no, order_id, order_no, customer_id, customer_name, amount, payment_date, payment_method, verify_status, handler_name, status, properties)
select *
from (
  select 'PAY-202605-001', o.id, o.order_no, o.customer_id, o.customer_name, 53760.00, current_date - 16, '银行转账', '已核销', '吴销售', 'active', '{"到账银行":"招商银行"}'::jsonb from public.sales_orders o where o.order_no = 'SO-202605-001'
  union all select 'PAY-202605-002', o.id, o.order_no, o.customer_id, o.customer_name, 30000.00, current_date - 10, '银行转账', '部分核销', '吴销售', 'active', '{"剩余应收":"27600"}'::jsonb from public.sales_orders o where o.order_no = 'SO-202605-002'
  union all select 'PAY-202605-003', o.id, o.order_no, o.customer_id, o.customer_name, 20000.00, current_date - 4, '承兑汇票', '部分核销', 'sales_manager', 'active', '{"票据到期":"2026-08-20"}'::jsonb from public.sales_orders o where o.order_no = 'SO-202605-005'
  union all select 'PAY-202605-004', o.id, o.order_no, o.customer_id, o.customer_name, 12000.00, current_date - 2, '银行转账', '待核销', '吴销售', 'active', '{"备注":"客户预付款"}'::jsonb from public.sales_orders o where o.order_no = 'SO-202605-006'
  union all select 'PAY-202605-005', o.id, o.order_no, o.customer_id, o.customer_name, 34320.00, current_date - 6, '银行转账', '已核销', '吴销售', 'active', '{"到账银行":"工商银行"}'::jsonb from public.sales_orders o where o.order_no = 'SO-202605-004'
) as v;

update public.sales_customers c
set last_follow_up_at = f.last_follow_up_at
from (
  select customer_id, max(follow_date) as last_follow_up_at
  from public.sales_follow_ups
  where status <> 'deleted'
  group by customer_id
) f
where c.id = f.customer_id;

update public.sales_customers c
set receivable_balance = greatest(coalesce(o.order_amount, 0) - coalesce(p.payment_amount, 0), 0)
from (
  select customer_id, sum(total_amount) as order_amount
  from public.sales_orders
  where order_status <> '已取消' and status <> 'deleted'
  group by customer_id
) o
full join (
  select customer_id, sum(amount) as payment_amount
  from public.sales_payments
  where status <> 'deleted'
  group by customer_id
) p on p.customer_id = o.customer_id
where c.id = coalesce(o.customer_id, p.customer_id);
