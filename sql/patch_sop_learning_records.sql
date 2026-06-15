-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- SOP 学习/完成记录
-- 执行方式（UTF-8）：cat sql/patch_sop_learning_records.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create table if not exists public.sop_learning_records (
  id bigserial primary key,
  username text not null,
  guide_id text not null,
  guide_title text,
  guide_category text,
  sop_role text,
  module_name text,
  route_path text,
  step_count integer not null default 0,
  status text not null default 'seen',
  seen_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sop_learning_records_username_guide_uq unique (username, guide_id),
  constraint sop_learning_records_status_chk check (status in ('seen', 'completed'))
);

create index if not exists idx_sop_learning_records_username
  on public.sop_learning_records (username);

create index if not exists idx_sop_learning_records_role_module
  on public.sop_learning_records (sop_role, module_name);

create index if not exists idx_sop_learning_records_completed_at
  on public.sop_learning_records (completed_at);

create or replace function public.touch_sop_learning_records()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_sop_learning_records_updated_at on public.sop_learning_records;
create trigger tg_sop_learning_records_updated_at
before update on public.sop_learning_records
for each row execute function public.touch_sop_learning_records();

grant select, insert, update, delete on public.sop_learning_records to web_user;
grant usage, select on sequence public.sop_learning_records_id_seq to web_user;

comment on table public.sop_learning_records is 'SOP学习与完成记录';
comment on column public.sop_learning_records.username is '用户名';
comment on column public.sop_learning_records.guide_id is 'SOP指引ID';
comment on column public.sop_learning_records.guide_title is 'SOP标题';
comment on column public.sop_learning_records.guide_category is 'SOP分类';
comment on column public.sop_learning_records.sop_role is 'SOP岗位';
comment on column public.sop_learning_records.module_name is '模块名称';
comment on column public.sop_learning_records.route_path is '页面路径';
comment on column public.sop_learning_records.step_count is '步骤数';
comment on column public.sop_learning_records.status is '学习状态';
comment on column public.sop_learning_records.seen_at is '已读时间';
comment on column public.sop_learning_records.completed_at is '完成时间';
