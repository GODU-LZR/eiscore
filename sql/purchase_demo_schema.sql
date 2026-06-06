-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Purchase module base tables and demo data.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.purchase_suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_no text not null unique,
  name text not null,
  level text not null default '普通',
  contact_name text,
  contact_phone text,
  category text,
  payment_terms text,
  lead_time_days numeric(10,2) not null default 0,
  buyer_name text,
  supplier_status text not null default '合作中',
  last_review_at date,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_demands (
  id uuid primary key default gen_random_uuid(),
  demand_no text not null unique,
  material_no text,
  material_name text not null,
  quantity numeric(14,2) not null default 0,
  unit text not null default 'kg',
  required_date date,
  source_dept text,
  requester_name text,
  preferred_supplier text,
  demand_status text not null default '草稿',
  remark text,
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  demand_id uuid references public.purchase_demands(id) on delete set null,
  source_demand_no text,
  supplier_id uuid references public.purchase_suppliers(id) on delete set null,
  supplier_name text not null,
  material_name text not null,
  quantity numeric(14,2) not null default 0,
  unit text not null default 'kg',
  unit_price numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  order_date date not null default current_date,
  expected_arrival_date date,
  buyer_name text,
  order_status text not null default '草稿',
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchase_orders
  add column if not exists demand_id uuid references public.purchase_demands(id) on delete set null,
  add column if not exists source_demand_no text;

create table if not exists public.purchase_arrivals (
  id uuid primary key default gen_random_uuid(),
  arrival_no text not null unique,
  order_id uuid references public.purchase_orders(id) on delete set null,
  order_no text,
  supplier_id uuid references public.purchase_suppliers(id) on delete set null,
  supplier_name text not null,
  material_name text not null,
  arrival_quantity numeric(14,2) not null default 0,
  accepted_quantity numeric(14,2) not null default 0,
  unit text not null default 'kg',
  arrival_date date not null default current_date,
  iqc_status text not null default '待检',
  inbound_no text,
  arrival_status text not null default '待到货',
  status text not null default 'active',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.purchase_set_order_total_amount()
returns trigger
language plpgsql
as $$
begin
  new.total_amount := round(coalesce(new.quantity, 0) * coalesce(new.unit_price, 0), 2);
  return new;
end;
$$;

create or replace function public.purchase_refresh_order_arrival_status(target_order_id uuid)
returns void
language plpgsql
as $$
declare
  ordered_qty numeric(14,2);
  arrived_qty numeric(14,2);
  current_order_status text;
  current_status text;
  next_order_status text;
begin
  if target_order_id is null then
    return;
  end if;

  select quantity, order_status, status
    into ordered_qty, current_order_status, current_status
  from public.purchase_orders
  where id = target_order_id;

  if not found or current_order_status = '已取消' then
    return;
  end if;

  select coalesce(sum(arrival_quantity), 0)::numeric(14,2)
    into arrived_qty
  from public.purchase_arrivals
  where order_id = target_order_id
    and coalesce(status, 'active') <> 'deleted';

  if arrived_qty <= 0 then
    if current_order_status in ('草稿') then
      next_order_status := current_order_status;
    elsif current_order_status in ('部分到货', '已完成') then
      next_order_status := '已下单';
    else
      next_order_status := current_order_status;
    end if;
  elsif ordered_qty > 0 and arrived_qty >= ordered_qty then
    next_order_status := '已完成';
  else
    next_order_status := '部分到货';
  end if;

  update public.purchase_orders
  set order_status = next_order_status,
      status = case
        when current_status in ('disabled', 'locked') then current_status
        when arrived_qty > 0 then 'active'
        else current_status
      end,
      updated_at = now()
  where id = target_order_id
    and (
      order_status is distinct from next_order_status
      or status is distinct from case
        when current_status in ('disabled', 'locked') then current_status
        when arrived_qty > 0 then 'active'
        else current_status
      end
    );
end;
$$;

create or replace function public.purchase_refresh_order_arrival_status_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.purchase_refresh_order_arrival_status(new.order_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform public.purchase_refresh_order_arrival_status(old.order_id);
  end if;

  return null;
end;
$$;

create or replace function public.purchase_refresh_order_arrival_status_from_order_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.purchase_refresh_order_arrival_status(new.id);
  return null;
end;
$$;

create or replace function public.purchase_fill_arrival_order_fields()
returns trigger
language plpgsql
as $$
declare
  order_row public.purchase_orders%rowtype;
begin
  if new.order_id is null and nullif(new.order_no, '') is not null then
    select *
      into order_row
    from public.purchase_orders
    where order_no = new.order_no
    limit 1;
  elsif new.order_id is not null then
    select *
      into order_row
    from public.purchase_orders
    where id = new.order_id
    limit 1;
  end if;

  if found then
    new.order_id := order_row.id;
    new.order_no := order_row.order_no;
    new.supplier_id := coalesce(new.supplier_id, order_row.supplier_id);
    new.supplier_name := coalesce(nullif(new.supplier_name, ''), order_row.supplier_name);
    new.material_name := coalesce(nullif(new.material_name, ''), order_row.material_name);
    new.unit := coalesce(nullif(new.unit, ''), order_row.unit);
  end if;

  return new;
end;
$$;

create or replace function public.purchase_normalize_arrival_quality_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.accepted_quantity, 0) > coalesce(new.arrival_quantity, 0) then
    new.accepted_quantity := coalesce(new.arrival_quantity, 0);
  end if;

  if new.arrival_status = '已入库' then
    if new.iqc_status is distinct from '让步接收' then
      new.iqc_status := '合格';
    end if;
    if coalesce(new.accepted_quantity, 0) <= 0 then
      new.accepted_quantity := coalesce(new.arrival_quantity, 0);
    end if;
    if nullif(new.inbound_no, '') is null then
      new.inbound_no := 'IN' || to_char(now(), 'YYYYMMDDHH24MISSMS');
    end if;
  elsif new.iqc_status in ('不合格') then
    new.arrival_status := '异常';
    new.accepted_quantity := 0;
  elsif new.iqc_status in ('合格', '让步接收') and coalesce(new.accepted_quantity, 0) > 0 then
    new.arrival_status := case
      when nullif(new.inbound_no, '') is not null then '已入库'
      else '待检验'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purchase_suppliers_updated_at on public.purchase_suppliers;
create trigger trg_purchase_suppliers_updated_at
before update on public.purchase_suppliers
for each row execute function public.touch_updated_at();

drop trigger if exists trg_purchase_demands_updated_at on public.purchase_demands;
create trigger trg_purchase_demands_updated_at
before update on public.purchase_demands
for each row execute function public.touch_updated_at();

drop trigger if exists trg_purchase_orders_updated_at on public.purchase_orders;
create trigger trg_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.touch_updated_at();

drop trigger if exists trg_purchase_orders_total_amount on public.purchase_orders;
create trigger trg_purchase_orders_total_amount
before insert or update of quantity, unit_price on public.purchase_orders
for each row execute function public.purchase_set_order_total_amount();

drop trigger if exists trg_purchase_arrivals_updated_at on public.purchase_arrivals;
create trigger trg_purchase_arrivals_updated_at
before update on public.purchase_arrivals
for each row execute function public.touch_updated_at();

drop trigger if exists trg_purchase_arrivals_fill_order_fields on public.purchase_arrivals;
create trigger trg_purchase_arrivals_fill_order_fields
before insert or update of order_id, order_no on public.purchase_arrivals
for each row execute function public.purchase_fill_arrival_order_fields();

drop trigger if exists trg_purchase_arrivals_normalize_quality_fields on public.purchase_arrivals;
create trigger trg_purchase_arrivals_normalize_quality_fields
before insert or update of arrival_quantity, accepted_quantity, iqc_status, inbound_no, arrival_status on public.purchase_arrivals
for each row execute function public.purchase_normalize_arrival_quality_fields();

drop trigger if exists trg_purchase_arrivals_refresh_order_status on public.purchase_arrivals;
create trigger trg_purchase_arrivals_refresh_order_status
after insert or update or delete on public.purchase_arrivals
for each row execute function public.purchase_refresh_order_arrival_status_trigger();

drop trigger if exists trg_purchase_orders_refresh_arrival_status on public.purchase_orders;
create trigger trg_purchase_orders_refresh_arrival_status
after update of quantity on public.purchase_orders
for each row
when (old.quantity is distinct from new.quantity)
execute function public.purchase_refresh_order_arrival_status_from_order_trigger();

create index if not exists idx_purchase_orders_demand_id on public.purchase_orders(demand_id);
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'uq_purchase_orders_demand_id_not_null'
  ) then
    if exists (
      select 1
      from public.purchase_orders
      where demand_id is not null
      group by demand_id
      having count(*) > 1
    ) then
      raise notice 'skip unique index uq_purchase_orders_demand_id_not_null because duplicate demand_id rows exist';
    else
      create unique index uq_purchase_orders_demand_id_not_null
      on public.purchase_orders(demand_id)
      where demand_id is not null;
    end if;
  end if;
end;
$$;
create index if not exists idx_purchase_orders_supplier_id on public.purchase_orders(supplier_id);
create index if not exists idx_purchase_arrivals_order_id on public.purchase_arrivals(order_id);
create index if not exists idx_purchase_arrivals_supplier_id on public.purchase_arrivals(supplier_id);

create or replace view public.v_purchase_order_progress as
select
  o.*,
  coalesce(sum(a.arrival_quantity), 0)::numeric(14,2) as arrived_quantity,
  greatest(o.quantity - coalesce(sum(a.arrival_quantity), 0), 0)::numeric(14,2) as pending_quantity,
  case
    when coalesce(sum(a.arrival_quantity), 0) <= 0 then '未到货'
    when coalesce(sum(a.arrival_quantity), 0) < o.quantity then '部分到货'
    else '已到齐'
  end as arrival_progress
from public.purchase_orders o
left join public.purchase_arrivals a on a.order_id = o.id
  and coalesce(a.status, 'active') <> 'deleted'
group by o.id;

grant select on public.purchase_suppliers, public.purchase_demands, public.purchase_orders, public.purchase_arrivals to web_anon;
grant select, insert, update, delete on public.purchase_suppliers, public.purchase_demands, public.purchase_orders, public.purchase_arrivals to web_user;
grant select on public.v_purchase_order_progress to web_anon, web_user;

alter table public.purchase_suppliers enable row level security;
alter table public.purchase_demands enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_arrivals enable row level security;

drop policy if exists purchase_suppliers_select on public.purchase_suppliers;
drop policy if exists purchase_suppliers_insert on public.purchase_suppliers;
drop policy if exists purchase_suppliers_update on public.purchase_suppliers;
drop policy if exists purchase_suppliers_delete on public.purchase_suppliers;
create policy purchase_suppliers_select on public.purchase_suppliers for select to web_user, web_anon using (true);
create policy purchase_suppliers_insert on public.purchase_suppliers for insert to web_user with check (true);
create policy purchase_suppliers_update on public.purchase_suppliers for update to web_user using (true) with check (true);
create policy purchase_suppliers_delete on public.purchase_suppliers for delete to web_user using (true);

drop policy if exists purchase_demands_select on public.purchase_demands;
drop policy if exists purchase_demands_insert on public.purchase_demands;
drop policy if exists purchase_demands_update on public.purchase_demands;
drop policy if exists purchase_demands_delete on public.purchase_demands;
create policy purchase_demands_select on public.purchase_demands for select to web_user, web_anon using (true);
create policy purchase_demands_insert on public.purchase_demands for insert to web_user with check (true);
create policy purchase_demands_update on public.purchase_demands for update to web_user using (true) with check (true);
create policy purchase_demands_delete on public.purchase_demands for delete to web_user using (true);

drop policy if exists purchase_orders_select on public.purchase_orders;
drop policy if exists purchase_orders_insert on public.purchase_orders;
drop policy if exists purchase_orders_update on public.purchase_orders;
drop policy if exists purchase_orders_delete on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders for select to web_user, web_anon using (true);
create policy purchase_orders_insert on public.purchase_orders for insert to web_user with check (true);
create policy purchase_orders_update on public.purchase_orders for update to web_user using (true) with check (true);
create policy purchase_orders_delete on public.purchase_orders for delete to web_user using (true);

drop policy if exists purchase_arrivals_select on public.purchase_arrivals;
drop policy if exists purchase_arrivals_insert on public.purchase_arrivals;
drop policy if exists purchase_arrivals_update on public.purchase_arrivals;
drop policy if exists purchase_arrivals_delete on public.purchase_arrivals;
create policy purchase_arrivals_select on public.purchase_arrivals for select to web_user, web_anon using (true);
create policy purchase_arrivals_insert on public.purchase_arrivals for insert to web_user with check (true);
create policy purchase_arrivals_update on public.purchase_arrivals for update to web_user using (true) with check (true);
create policy purchase_arrivals_delete on public.purchase_arrivals for delete to web_user using (true);

insert into public.permissions (code, name, module, action)
values
  ('app:purchase_supplier', '供应商档案', 'purchase', 'app'),
  ('app:purchase_demand', '采购需求', 'purchase', 'app'),
  ('app:purchase_order', '采购订单', 'purchase', 'app'),
  ('app:purchase_arrival', '到货跟踪', 'purchase', 'app'),
  ('app:purchase_dashboard', '采购驾驶舱', 'purchase', 'app'),
  ('op:purchase_supplier.create', '供应商档案-新增', 'purchase_supplier', 'create'),
  ('op:purchase_supplier.edit', '供应商档案-编辑', 'purchase_supplier', 'edit'),
  ('op:purchase_supplier.delete', '供应商档案-删除', 'purchase_supplier', 'delete'),
  ('op:purchase_supplier.export', '供应商档案-导出', 'purchase_supplier', 'export'),
  ('op:purchase_supplier.config', '供应商档案-列配置', 'purchase_supplier', 'config'),
  ('op:purchase_supplier.review', '供应商档案-完成评审', 'purchase_supplier', 'review'),
  ('op:purchase_supplier.pause', '供应商档案-暂停合作', 'purchase_supplier', 'pause'),
  ('op:purchase_supplier.resume', '供应商档案-恢复合作', 'purchase_supplier', 'resume'),
  ('op:purchase_demand.create', '采购需求-新增', 'purchase_demand', 'create'),
  ('op:purchase_demand.edit', '采购需求-编辑', 'purchase_demand', 'edit'),
  ('op:purchase_demand.delete', '采购需求-删除', 'purchase_demand', 'delete'),
  ('op:purchase_demand.export', '采购需求-导出', 'purchase_demand', 'export'),
  ('op:purchase_demand.config', '采购需求-列配置', 'purchase_demand', 'config'),
  ('op:purchase_demand.submit', '采购需求-提交采购', 'purchase_demand', 'submit'),
  ('op:purchase_demand.close', '采购需求-关闭需求', 'purchase_demand', 'close'),
  ('op:purchase_demand.reopen', '采购需求-重新打开', 'purchase_demand', 'reopen'),
  ('op:purchase_demand.create_order', '采购需求-生成采购订单', 'purchase_demand', 'create_order'),
  ('op:purchase_order.create', '采购订单-新增', 'purchase_order', 'create'),
  ('op:purchase_order.edit', '采购订单-编辑', 'purchase_order', 'edit'),
  ('op:purchase_order.delete', '采购订单-删除', 'purchase_order', 'delete'),
  ('op:purchase_order.export', '采购订单-导出', 'purchase_order', 'export'),
  ('op:purchase_order.config', '采购订单-列配置', 'purchase_order', 'config'),
  ('op:purchase_order.confirm', '采购订单-确认下单', 'purchase_order', 'confirm'),
  ('op:purchase_order.cancel', '采购订单-取消订单', 'purchase_order', 'cancel'),
  ('op:purchase_order.register_arrival', '采购订单-登记到货', 'purchase_order', 'register_arrival'),
  ('op:purchase_arrival.create', '到货跟踪-新增', 'purchase_arrival', 'create'),
  ('op:purchase_arrival.edit', '到货跟踪-编辑', 'purchase_arrival', 'edit'),
  ('op:purchase_arrival.delete', '到货跟踪-删除', 'purchase_arrival', 'delete'),
  ('op:purchase_arrival.export', '到货跟踪-导出', 'purchase_arrival', 'export'),
  ('op:purchase_arrival.config', '到货跟踪-列配置', 'purchase_arrival', 'config'),
  ('op:purchase_arrival.confirm_inbound', '到货跟踪-确认入库', 'purchase_arrival', 'confirm_inbound'),
  ('op:purchase_arrival.mark_exception', '到货跟踪-标记异常', 'purchase_arrival', 'mark_exception')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    action = excluded.action,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('super_admin', 'purchase_manager')
  and (
    p.code = 'module:purchase'
    or p.code in ('app:purchase_supplier', 'app:purchase_demand', 'app:purchase_order', 'app:purchase_arrival', 'app:purchase_dashboard')
    or p.code like 'op:purchase\_%' escape '\'
  )
on conflict do nothing;

insert into public.system_configs (key, value)
values
  ('purchase_suppliers_cols', '[]'::jsonb),
  ('purchase_demands_cols', '[]'::jsonb),
  ('purchase_orders_cols', '[{"label":"交期风险","prop":"delivery_risk","type":"select","options":[{"label":"正常","value":"正常"},{"label":"临期","value":"临期"},{"label":"延期","value":"延期"}]},{"label":"订单含税金额","prop":"tax_included_amount","type":"formula","expression":"{订单金额}*1.13"}]'::jsonb),
  ('purchase_arrivals_cols', '[{"label":"异常说明","prop":"exception_note","type":"text"}]'::jsonb)
on conflict (key) do nothing;

insert into public.purchase_suppliers
  (supplier_no, name, level, contact_name, contact_phone, category, payment_terms, lead_time_days, buyer_name, supplier_status, last_review_at, status, properties)
values
  ('SUP-001', '广东味源香料有限公司', '核心', '梁敏', '13900020001', '香辛料', '月结30天', 5, '张三', '合作中', current_date - 40, 'active', '{"资质":"SC认证","区域":"华南"}'),
  ('SUP-002', '佛山优谷淀粉厂', '战略', '陈辉', '13900020002', '淀粉糖浆', '月结45天', 7, '张三', '合作中', current_date - 25, 'active', '{"资质":"ISO22000","区域":"华南"}'),
  ('SUP-003', '江门绿田包装材料', '普通', '赵晴', '13900020003', '包装材料', '货到30天', 10, '采购主管', '合作中', current_date - 18, 'active', '{"品类":"纸箱/标签"}'),
  ('SUP-004', '惠州冷链物流配套', '备选', '刘杰', '13900020004', '冷链辅材', '预付30%', 12, '采购主管', '待评审', current_date - 8, 'active', '{"评审阶段":"初审"}'),
  ('SUP-005', '广州鲜味蛋白科技', '核心', '孙宁', '13900020005', '植物蛋白', '月结30天', 6, '张三', '合作中', current_date - 12, 'active', '{"资质":"HACCP"}')
on conflict (supplier_no) do nothing;

insert into public.purchase_demands
  (demand_no, material_no, material_name, quantity, unit, required_date, source_dept, requester_name, preferred_supplier, demand_status, remark, status, properties)
values
  ('PR-202605-001', 'RM-001', '辣椒粉', 800, 'kg', current_date + 3, '生产部', '李计划', '广东味源香料有限公司', '待采购', '端午订单备料', 'active', '{"来源":"MRP"}'),
  ('PR-202605-002', 'RM-002', '玉米淀粉', 1200, 'kg', current_date + 5, '生产部', '李计划', '佛山优谷淀粉厂', '已下单', '常规补货', 'active', '{"来源":"安全库存"}'),
  ('PR-202605-003', 'PK-001', '礼盒外箱', 5000, '个', current_date + 7, '仓储部', '王仓管', '江门绿田包装材料', '待采购', '新包装版本', 'active', '{"版本":"V3"}'),
  ('PR-202605-004', 'RM-003', '植物蛋白粉', 650, 'kg', current_date + 6, '研发部', '赵研发', '广州鲜味蛋白科技', '草稿', '新品试产', 'draft', '{"项目":"轻食系列"}')
on conflict (demand_no) do nothing;

insert into public.purchase_orders
  (order_no, demand_id, source_demand_no, supplier_id, supplier_name, material_name, quantity, unit, unit_price, total_amount, order_date, expected_arrival_date, buyer_name, order_status, status, properties)
select *
from (
  select 'PO-202605-001', d.id, d.demand_no, s.id, s.name, '辣椒粉', 800, 'kg', 18.50, 14800.00, current_date - 5, current_date + 1, '张三', '已下单', 'active', '{"合同":"框架协议A"}'::jsonb from public.purchase_suppliers s left join public.purchase_demands d on d.demand_no = 'PR-202605-001' where s.supplier_no = 'SUP-001'
  union all select 'PO-202605-002', d.id, d.demand_no, s.id, s.name, '玉米淀粉', 1200, 'kg', 4.20, 5040.00, current_date - 4, current_date + 2, '张三', '部分到货', 'active', '{"来源需求":"PR-202605-002"}'::jsonb from public.purchase_suppliers s left join public.purchase_demands d on d.demand_no = 'PR-202605-002' where s.supplier_no = 'SUP-002'
  union all select 'PO-202605-003', d.id, d.demand_no, s.id, s.name, '礼盒外箱', 5000, '个', 1.35, 6750.00, current_date - 3, current_date + 6, '采购主管', '已下单', 'active', '{"包装版本":"V3"}'::jsonb from public.purchase_suppliers s left join public.purchase_demands d on d.demand_no = 'PR-202605-003' where s.supplier_no = 'SUP-003'
  union all select 'PO-202605-004', d.id, d.demand_no, s.id, s.name, '植物蛋白粉', 650, 'kg', 28.00, 18200.00, current_date - 1, current_date + 4, '张三', '草稿', 'draft', '{"试产":"true"}'::jsonb from public.purchase_suppliers s left join public.purchase_demands d on d.demand_no = 'PR-202605-004' where s.supplier_no = 'SUP-005'
) as v
on conflict (order_no) do nothing;

insert into public.purchase_arrivals
  (arrival_no, order_id, order_no, supplier_id, supplier_name, material_name, arrival_quantity, accepted_quantity, unit, arrival_date, iqc_status, inbound_no, arrival_status, status, properties)
select *
from (
  select 'PA-202605-001', o.id, o.order_no, o.supplier_id, o.supplier_name, o.material_name, 800, 800, 'kg', current_date - 1, '合格', 'IN-202605-001', '已入库', 'active', '{"批次":"B20260501"}'::jsonb from public.purchase_orders o where o.order_no = 'PO-202605-001'
  union all select 'PA-202605-002', o.id, o.order_no, o.supplier_id, o.supplier_name, o.material_name, 600, 0, 'kg', current_date, '待检', '', '待检验', 'active', '{"预计剩余到货":"600"}'::jsonb from public.purchase_orders o where o.order_no = 'PO-202605-002'
  union all select 'PA-202605-003', o.id, o.order_no, o.supplier_id, o.supplier_name, o.material_name, 5000, 4800, '个', current_date, '让步接收', 'IN-202605-002', '已入库', 'active', '{"破损":"200"}'::jsonb from public.purchase_orders o where o.order_no = 'PO-202605-003'
) as v
on conflict (arrival_no) do nothing;
