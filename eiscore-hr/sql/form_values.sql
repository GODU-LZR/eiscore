-- 扩展字段表：存储表单模板的额外字段值（public schema）
create table if not exists public.form_values (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  row_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_values_unique unique (template_id, row_id)
);

create index if not exists idx_form_values_row_id on public.form_values (row_id);

grant usage on schema public to web_user;
grant select, insert, update, delete on public.form_values to web_user;
