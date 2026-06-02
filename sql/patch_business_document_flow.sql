-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Unified business document flow links and audit logs.
-- Optional patch: the UI can infer purchase links without this table, but this
-- makes cross-module flow, reverse audit, and traceability durable.

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

create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(),
  source_doc_type text not null,
  source_doc_id uuid,
  source_doc_no text,
  target_doc_type text not null,
  target_doc_id uuid,
  target_doc_no text,
  relation_type text not null,
  quantity numeric(14,2),
  amount numeric(14,2),
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reversed_by text,
  reversed_at timestamptz,
  reverse_reason text
);

create table if not exists public.document_flow_audits (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  source_doc_type text,
  source_doc_id uuid,
  source_doc_no text,
  target_doc_type text,
  target_doc_id uuid,
  target_doc_no text,
  reason text,
  actor_username text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_links_source on public.document_links(source_doc_type, source_doc_id);
create index if not exists idx_document_links_source_no on public.document_links(source_doc_type, source_doc_no);
create index if not exists idx_document_links_target on public.document_links(target_doc_type, target_doc_id);
create index if not exists idx_document_links_target_no on public.document_links(target_doc_type, target_doc_no);
create index if not exists idx_document_links_relation on public.document_links(relation_type, status);
with duplicate_links as (
  select
    id,
    row_number() over (
      partition by
        source_doc_type,
        coalesce(source_doc_id::text, source_doc_no, ''),
        target_doc_type,
        coalesce(target_doc_id::text, target_doc_no, ''),
        relation_type
      order by created_at asc, id asc
    ) as rn
  from public.document_links
  where status = 'active'
)
update public.document_links l
set status = 'duplicated',
    updated_at = now()
from duplicate_links d
where l.id = d.id
  and d.rn > 1;
create unique index if not exists uq_document_links_active_doc_pair
on public.document_links(
  source_doc_type,
  coalesce(source_doc_id::text, source_doc_no, ''),
  target_doc_type,
  coalesce(target_doc_id::text, target_doc_no, ''),
  relation_type
)
where status = 'active';
create index if not exists idx_document_flow_audits_source on public.document_flow_audits(source_doc_type, source_doc_id);
create index if not exists idx_document_flow_audits_target on public.document_flow_audits(target_doc_type, target_doc_id);

drop trigger if exists trg_document_links_updated_at on public.document_links;
create trigger trg_document_links_updated_at
before update on public.document_links
for each row execute function public.touch_updated_at();

grant select on public.document_links, public.document_flow_audits to web_anon;
grant select, insert, update, delete on public.document_links to web_user;
grant select, insert on public.document_flow_audits to web_user;

alter table public.document_links enable row level security;
alter table public.document_flow_audits enable row level security;

drop policy if exists document_links_select on public.document_links;
drop policy if exists document_links_insert on public.document_links;
drop policy if exists document_links_update on public.document_links;
drop policy if exists document_links_delete on public.document_links;
create policy document_links_select on public.document_links for select to web_user, web_anon using (true);
create policy document_links_insert on public.document_links for insert to web_user with check (true);
create policy document_links_update on public.document_links for update to web_user using (true) with check (true);
create policy document_links_delete on public.document_links for delete to web_user using (true);

drop policy if exists document_flow_audits_select on public.document_flow_audits;
drop policy if exists document_flow_audits_insert on public.document_flow_audits;
create policy document_flow_audits_select on public.document_flow_audits for select to web_user, web_anon using (true);
create policy document_flow_audits_insert on public.document_flow_audits for insert to web_user with check (true);

insert into public.permissions (code, name, module, action)
values
  ('op:business_flow.view', '业务流程图-查看', 'business_flow', 'view'),
  ('op:business_flow.reverse', '业务流程图-反审核/反向修改', 'business_flow', 'reverse')
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
  and p.code in ('op:business_flow.view', 'op:business_flow.reverse')
on conflict do nothing;
