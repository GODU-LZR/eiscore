-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Patch: production work reports for AI document intake fixed-module imports.

set client_encoding = 'UTF8';

begin;

create schema if not exists scm;
create extension if not exists pgcrypto;

create or replace function scm.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists scm.production_work_reports (
  id uuid primary key default gen_random_uuid(),
  report_no text not null unique,
  report_date date not null default current_date,
  work_order_id uuid references scm.production_work_orders(id) on delete set null,
  work_order_no text,
  product_material_id integer references public.raw_materials(id),
  product_material_code text not null,
  product_material_name text not null,
  process_name text,
  workshop_name text,
  production_line text,
  shift_name text,
  team_name text,
  completed_qty numeric(18, 6) not null default 0,
  good_qty numeric(18, 6) not null default 0,
  defect_qty numeric(18, 6) not null default 0,
  scrap_qty numeric(18, 6) not null default 0,
  unit text not null default '',
  operator text,
  report_status text not null default 'active',
  remark text,
  properties jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_work_reports_qty_check check (
    completed_qty >= 0
    and good_qty >= 0
    and defect_qty >= 0
    and scrap_qty >= 0
    and good_qty <= completed_qty
    and defect_qty + scrap_qty <= completed_qty
  ),
  constraint production_work_reports_status_check check (report_status in ('active', 'voided'))
);

create index if not exists idx_production_work_reports_date
  on scm.production_work_reports(report_date desc);
create index if not exists idx_production_work_reports_work_order
  on scm.production_work_reports(work_order_no);
create index if not exists idx_production_work_reports_product
  on scm.production_work_reports(product_material_id);
create index if not exists idx_production_work_reports_process
  on scm.production_work_reports(process_name);

drop trigger if exists trg_production_work_reports_touch_updated_at on scm.production_work_reports;
create trigger trg_production_work_reports_touch_updated_at
before update on scm.production_work_reports
for each row execute function scm.touch_updated_at();

create or replace view scm.v_production_work_report_summary as
select
  coalesce(r.work_order_no, '') as work_order_no,
  r.product_material_id,
  r.product_material_code,
  r.product_material_name,
  count(*)::integer as report_count,
  min(r.report_date) as first_report_date,
  max(r.report_date) as latest_report_date,
  sum(r.completed_qty)::numeric(18, 6) as completed_qty,
  sum(r.good_qty)::numeric(18, 6) as good_qty,
  sum(r.defect_qty)::numeric(18, 6) as defect_qty,
  sum(r.scrap_qty)::numeric(18, 6) as scrap_qty
from scm.production_work_reports r
where r.report_status = 'active'
group by coalesce(r.work_order_no, ''), r.product_material_id, r.product_material_code, r.product_material_name;

alter table scm.production_work_reports enable row level security;

drop policy if exists production_work_reports_select on scm.production_work_reports;
drop policy if exists production_work_reports_insert on scm.production_work_reports;
drop policy if exists production_work_reports_update on scm.production_work_reports;
drop policy if exists production_work_reports_delete on scm.production_work_reports;
create policy production_work_reports_select on scm.production_work_reports for select to web_user, web_anon using (true);
create policy production_work_reports_insert on scm.production_work_reports for insert to web_user with check (true);
create policy production_work_reports_update on scm.production_work_reports for update to web_user using (true) with check (true);
create policy production_work_reports_delete on scm.production_work_reports for delete to web_user using (true);

grant select, insert, update, delete on scm.production_work_reports to web_user;
grant select on scm.production_work_reports to web_anon;
grant select on scm.v_production_work_report_summary to web_user;
grant select on scm.v_production_work_report_summary to web_anon;

do $$
begin
  if to_regclass('public.ontology_table_registry') is not null then
    insert into public.ontology_table_registry (
      schema_name, table_name, domain, entity_type, business_name, description, is_active, tags
    ) values
      ('scm', 'production_work_reports', 'production', 'work_report', '生产报工记录', '生产日报/报工自动入库后的正式业务记录，记录完工、不良、报废和工序进度', true, '["production","work_report","document_intake"]'::jsonb),
      ('scm', 'v_production_work_report_summary', 'production', 'work_report_summary', '生产报工汇总视图', '按工单和产品汇总生产报工数量，用于生产进度统计', true, '["production","summary","document_intake"]'::jsonb)
    on conflict (schema_name, table_name) do update
    set domain = excluded.domain,
        entity_type = excluded.entity_type,
        business_name = excluded.business_name,
        description = excluded.description,
        is_active = excluded.is_active,
        tags = excluded.tags;
  end if;
end;
$$;

comment on table scm.production_work_reports is '生产报工记录：承接 AI 智能收单识别出的生产日报/报工数据';
comment on view scm.v_production_work_report_summary is '生产报工汇总视图：按工单和产品汇总完工、不良、报废数量';

notify pgrst, 'reload schema';

commit;
