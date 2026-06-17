-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- EISCore 智能收单与自动入库 Agent - MVP schema.

set client_encoding = 'UTF8';

begin;

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

create table if not exists public.collector_devices (
  id uuid primary key default gen_random_uuid(),
  device_code text not null,
  device_name text not null,
  enterprise_id text not null,
  department_id text,
  default_user_id text,
  default_username text,
  default_role text,
  server_base_url text,
  device_token_hash text,
  binding_code_hash text,
  client_version text,
  webview_version text,
  status text not null default 'pending' check (status in ('pending', 'active', 'offline', 'disabled')),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enterprise_id, device_code)
);

create table if not exists public.collector_watch_folders (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.collector_devices(id) on delete cascade,
  folder_path text not null,
  folder_name text,
  default_user_id text,
  default_role text,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null default ('DIB-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text, 1, 8)),
  device_id uuid references public.collector_devices(id) on delete set null,
  uploaded_by_user_id text,
  source text,
  file_count integer not null default 0,
  success_count integer not null default 0,
  partial_count integer not null default 0,
  failed_count integer not null default 0,
  duplicate_count integer not null default 0,
  status text not null default 'created' check (status in ('created', 'uploading', 'uploaded', 'parsing', 'classifying', 'importing', 'completed', 'partial', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_no)
);

create table if not exists public.document_assets (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.document_import_batches(id) on delete set null,
  device_id uuid references public.collector_devices(id) on delete set null,
  uploaded_by_user_id text,
  uploaded_by_username text,
  operator_source text,
  original_filename text not null,
  storage_path text not null,
  mime_type text,
  file_ext text,
  file_size bigint not null default 0,
  file_hash text not null,
  source_folder text,
  upload_source text,
  status text not null default 'uploaded' check (status in ('uploaded', 'duplicate', 'queued', 'parsing', 'parsed', 'classified', 'importing', 'imported', 'partial_imported', 'unrecognized', 'failed', 'archived')),
  duplicate_of_asset_id uuid references public.document_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.collector_devices(id) on delete cascade,
  file_hash text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint not null,
  chunk_size integer not null,
  total_chunks integer not null,
  uploaded_chunks integer not null default 0,
  upload_source text,
  status text not null default 'initialized' check (status in ('initialized', 'uploading', 'assembled', 'completed', 'duplicate', 'failed', 'cancelled')),
  storage_path text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (device_id, file_hash)
);

create table if not exists public.document_upload_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.document_upload_sessions(id) on delete cascade,
  chunk_index integer not null,
  chunk_size integer not null,
  chunk_hash text,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (session_id, chunk_index)
);

create table if not exists public.document_parse_jobs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.document_assets(id) on delete cascade,
  batch_id uuid references public.document_import_batches(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'success', 'partial', 'failed', 'cancelled')),
  parser_type text,
  retry_count integer not null default 0,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_parse_results (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.document_assets(id) on delete cascade,
  parse_job_id uuid references public.document_parse_jobs(id) on delete set null,
  text_content text,
  tables jsonb not null default '[]'::jsonb,
  layout jsonb not null default '{}'::jsonb,
  ocr_result jsonb not null default '{}'::jsonb,
  image_descriptions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.document_classification_results (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.document_assets(id) on delete cascade,
  batch_id uuid references public.document_import_batches(id) on delete set null,
  target_module text,
  target_document_type text,
  target_kind text check (target_kind is null or target_kind in ('fixed_module_table', 'data_app')),
  confidence numeric(6,4),
  reason text,
  candidates jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.document_entry_plans (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.document_assets(id) on delete cascade,
  batch_id uuid references public.document_import_batches(id) on delete set null,
  target_module text,
  target_document_type text,
  target_kind text check (target_kind is null or target_kind in ('fixed_module_table', 'data_app')),
  app_id uuid,
  app_name text,
  target_schema text,
  target_table text,
  mode text,
  document_count integer,
  line_count integer,
  confidence numeric(6,4),
  reason text,
  columns_snapshot jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check (status in ('planned', 'importing', 'imported', 'partial', 'failed', 'skipped_duplicate', 'archived_only')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_business_links (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.document_assets(id) on delete cascade,
  batch_id uuid references public.document_import_batches(id) on delete set null,
  entry_plan_id uuid references public.document_entry_plans(id) on delete set null,
  target_schema text,
  target_table text,
  target_record_id text,
  target_module text,
  target_document_type text,
  target_app_id uuid,
  ai_confidence numeric(6,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.document_unmapped_fields (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.document_assets(id) on delete cascade,
  batch_id uuid references public.document_import_batches(id) on delete set null,
  entry_plan_id uuid references public.document_entry_plans(id) on delete set null,
  target_schema text,
  target_table text,
  target_record_id text,
  name text not null,
  value text,
  confidence numeric(6,4),
  source text,
  write_location text not null default 'remarks' check (write_location in ('column', 'properties', 'remarks', 'ignore')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_business_corrections (
  id uuid primary key default gen_random_uuid(),
  business_link_id uuid references public.document_business_links(id) on delete set null,
  target_schema text,
  target_table text,
  target_record_id text,
  field_name text,
  old_value text,
  new_value text,
  correction_type text,
  affects_business_result boolean not null default false,
  recalculation_status text,
  corrected_by text,
  corrected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.client_log_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null,
  device_id uuid references public.collector_devices(id) on delete set null,
  device_name text,
  user_id text,
  username text,
  app_version text,
  webview_version text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (client_session_id)
);

create table if not exists public.client_log_events (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  event_type text not null,
  message text,
  stack text,
  device_id uuid references public.collector_devices(id) on delete set null,
  device_name text,
  user_id text,
  username text,
  role text,
  app_module text,
  route text,
  url text,
  request_url text,
  status_code integer,
  client_session_id text,
  trace_id text,
  ai_import_batch_id uuid,
  source_file_hash text,
  app_version text,
  webview_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_collector_devices_status_seen on public.collector_devices(status, last_seen_at desc);
create index if not exists idx_collector_devices_token_hash on public.collector_devices(device_token_hash) where device_token_hash is not null;
create index if not exists idx_watch_folders_device on public.collector_watch_folders(device_id, enabled);
create index if not exists idx_document_batches_device_created on public.document_import_batches(device_id, created_at desc);
create index if not exists idx_document_assets_hash on public.document_assets(file_hash);
create index if not exists idx_document_assets_batch on public.document_assets(batch_id);
create index if not exists idx_document_assets_device_created on public.document_assets(device_id, created_at desc);
create index if not exists idx_document_assets_status_created on public.document_assets(status, created_at desc);
create index if not exists idx_upload_sessions_device_status on public.document_upload_sessions(device_id, status, updated_at desc);
create index if not exists idx_upload_chunks_session_index on public.document_upload_chunks(session_id, chunk_index);
create index if not exists idx_parse_jobs_status_created on public.document_parse_jobs(status, created_at);
create index if not exists idx_business_links_asset on public.document_business_links(asset_id);
create index if not exists idx_business_links_target on public.document_business_links(target_schema, target_table, target_record_id);
create index if not exists idx_unmapped_fields_target on public.document_unmapped_fields(target_schema, target_table, target_record_id);
create index if not exists idx_client_log_events_device_created on public.client_log_events(device_id, created_at desc);
create index if not exists idx_client_log_events_type_created on public.client_log_events(event_type, created_at desc);
create index if not exists idx_client_log_events_trace on public.client_log_events(trace_id) where trace_id is not null and trace_id <> '';

drop trigger if exists trg_collector_devices_updated_at on public.collector_devices;
create trigger trg_collector_devices_updated_at
before update on public.collector_devices
for each row execute function public.touch_updated_at();

drop trigger if exists trg_collector_watch_folders_updated_at on public.collector_watch_folders;
create trigger trg_collector_watch_folders_updated_at
before update on public.collector_watch_folders
for each row execute function public.touch_updated_at();

drop trigger if exists trg_document_import_batches_updated_at on public.document_import_batches;
create trigger trg_document_import_batches_updated_at
before update on public.document_import_batches
for each row execute function public.touch_updated_at();

drop trigger if exists trg_document_assets_updated_at on public.document_assets;
create trigger trg_document_assets_updated_at
before update on public.document_assets
for each row execute function public.touch_updated_at();

drop trigger if exists trg_document_upload_sessions_updated_at on public.document_upload_sessions;
create trigger trg_document_upload_sessions_updated_at
before update on public.document_upload_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists trg_document_parse_jobs_updated_at on public.document_parse_jobs;
create trigger trg_document_parse_jobs_updated_at
before update on public.document_parse_jobs
for each row execute function public.touch_updated_at();

drop trigger if exists trg_document_entry_plans_updated_at on public.document_entry_plans;
create trigger trg_document_entry_plans_updated_at
before update on public.document_entry_plans
for each row execute function public.touch_updated_at();

with document_intake_tables(table_schema, table_name, semantic_domain, semantic_class, semantic_name, semantic_description, tags) as (
  values
    ('public', 'collector_devices', 'document_intake', 'collector_device_table', '采集设备', 'Windows 采集端设备、绑定令牌和心跳状态', '["document_intake","collector","device"]'::jsonb),
    ('public', 'collector_watch_folders', 'document_intake', 'collector_watch_folder_table', '采集监听目录', '采集端本地监听目录配置', '["document_intake","collector","watch_folder"]'::jsonb),
    ('public', 'document_import_batches', 'document_intake', 'document_import_batch_table', '文档导入批次', '文件上传、解析和自动入库的批次主表', '["document_intake","batch"]'::jsonb),
    ('public', 'document_assets', 'document_intake', 'document_asset_table', '文档资产', '采集端上传后的原始文件资产和存储元数据', '["document_intake","asset","file"]'::jsonb),
    ('public', 'document_upload_sessions', 'document_intake', 'document_upload_session_table', '分片上传会话', '采集端大文件分片上传和断点续传会话', '["document_intake","upload","chunk"]'::jsonb),
    ('public', 'document_upload_chunks', 'document_intake', 'document_upload_chunk_table', '分片上传片段', '大文件上传分片落盘与续传状态', '["document_intake","upload","chunk"]'::jsonb),
    ('public', 'document_parse_jobs', 'document_intake', 'document_parse_job_table', '文档解析任务', '文档解析 worker 的任务状态和重试记录', '["document_intake","parse","job"]'::jsonb),
    ('public', 'document_parse_results', 'document_intake', 'document_parse_result_table', '文档解析结果', '文本、表格、版面和 OCR 解析结果', '["document_intake","parse","result"]'::jsonb),
    ('public', 'document_classification_results', 'document_intake', 'document_classification_table', '文档分类结果', 'AI 对文件目标模块和单据类型的分类结果', '["document_intake","classification","ai"]'::jsonb),
    ('public', 'document_entry_plans', 'document_intake', 'document_entry_plan_table', '自动入库计划', 'AI 生成的目标表、字段映射和入库计划', '["document_intake","entry_plan","ai"]'::jsonb),
    ('public', 'document_business_links', 'document_intake', 'document_business_link_table', '文档业务关联', '文档资产与落库业务记录之间的关联', '["document_intake","business_link"]'::jsonb),
    ('public', 'document_unmapped_fields', 'document_intake', 'document_unmapped_field_table', '未映射字段', 'AI 识别但未能映射到结构化字段的数据', '["document_intake","unmapped_field"]'::jsonb),
    ('public', 'ai_business_corrections', 'document_intake', 'ai_business_correction_table', 'AI 业务修正', '人工修正 AI 入库结果后的审计记录', '["document_intake","correction","audit"]'::jsonb),
    ('public', 'client_log_sessions', 'document_intake', 'client_log_session_table', '客户端日志会话', '采集端本地运行会话和版本信息', '["document_intake","client_log","session"]'::jsonb),
    ('public', 'client_log_events', 'document_intake', 'client_log_event_table', '客户端日志事件', '采集端运行、上传、WebView 和错误日志事件', '["document_intake","client_log","event"]'::jsonb)
)
insert into public.ontology_table_semantics (
  table_schema,
  table_name,
  semantic_domain,
  semantic_class,
  semantic_name,
  semantic_description,
  is_business,
  is_active,
  tags,
  updated_at
)
select
  table_schema,
  table_name,
  semantic_domain,
  semantic_class,
  semantic_name,
  semantic_description,
  true,
  true,
  tags,
  now()
from document_intake_tables
on conflict (table_schema, table_name) do update
set semantic_domain = excluded.semantic_domain,
    semantic_class = excluded.semantic_class,
    semantic_name = excluded.semantic_name,
    semantic_description = excluded.semantic_description,
    is_business = excluded.is_business,
    is_active = true,
    tags = excluded.tags,
    updated_at = now();

with document_intake_tables(table_schema, table_name) as (
  values
    ('public', 'collector_devices'),
    ('public', 'collector_watch_folders'),
    ('public', 'document_import_batches'),
    ('public', 'document_assets'),
    ('public', 'document_upload_sessions'),
    ('public', 'document_upload_chunks'),
    ('public', 'document_parse_jobs'),
    ('public', 'document_parse_results'),
    ('public', 'document_classification_results'),
    ('public', 'document_entry_plans'),
    ('public', 'document_business_links'),
    ('public', 'document_unmapped_fields'),
    ('public', 'ai_business_corrections'),
    ('public', 'client_log_sessions'),
    ('public', 'client_log_events')
),
column_source as (
  select
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    case
      when c.column_name = 'id' then 'identifier'
      when c.column_name like '%_id' or c.column_name like '%_code' or c.column_name in ('batch_no', 'file_hash', 'trace_id', 'client_session_id') then 'reference_attribute'
      when c.column_name like '%status%' or c.column_name in ('level', 'event_type', 'target_kind', 'target_module', 'target_document_type', 'parser_type', 'mode', 'write_location', 'correction_type', 'recalculation_status', 'upload_source', 'operator_source', 'source') then 'enum_attribute'
      when c.column_name like '%_at' then 'time_attribute'
      when c.column_name in ('metadata', 'tables', 'layout', 'ocr_result', 'image_descriptions', 'candidates', 'columns_snapshot', 'documents') then 'json_attribute'
      when c.column_name like '%count%' or c.column_name like '%size%' or c.column_name like '%retry%' or c.column_name like '%confidence%' or c.column_name like '%rate%' then 'derived_metric'
      when c.column_name like '%token%' or c.column_name like '%hash%' or c.column_name in ('stack', 'text_content', 'value', 'old_value', 'new_value') then 'sensitive_attribute'
      when c.data_type = 'boolean' then 'boolean_attribute'
      else 'business_attribute'
    end as semantic_class,
    case c.column_name
      when 'id' then '主键标识'
      when 'device_id' then '采集设备标识'
      when 'device_code' then '设备编码'
      when 'device_name' then '设备名称'
      when 'batch_id' then '导入批次标识'
      when 'batch_no' then '导入批次号'
      when 'asset_id' then '文档资产标识'
      when 'original_filename' then '原始文件名'
      when 'storage_path' then '存储路径'
      when 'file_hash' then '文件哈希'
      when 'file_size' then '文件大小'
      when 'mime_type' then 'MIME 类型'
      when 'status' then '状态'
      when 'created_at' then '创建时间'
      when 'updated_at' then '更新时间'
      when 'metadata' then '扩展元数据'
      when 'text_content' then '文本内容'
      when 'target_schema' then '目标 schema'
      when 'target_table' then '目标表'
      when 'target_record_id' then '目标记录标识'
      when 'trace_id' then '链路追踪标识'
      else c.column_name
    end as semantic_name,
    case
      when c.udt_name in ('json', 'jsonb') then 'json'
      when c.data_type in ('timestamp without time zone', 'timestamp with time zone') then 'datetime'
      when c.data_type = 'date' then 'date'
      when c.data_type in ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision', 'decimal') then 'number'
      when c.data_type = 'boolean' then 'boolean'
      when c.udt_name = 'uuid' then 'uuid'
      when c.data_type like 'ARRAY%' or c.udt_name like '\_%' then 'array'
      else 'text'
    end as ui_type,
    (c.column_name like '%token%' or c.column_name in ('device_token_hash', 'binding_code_hash', 'storage_path', 'stack', 'text_content')) as is_sensitive
  from information_schema.columns c
  join document_intake_tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
)
insert into public.ontology_column_semantics (
  table_schema,
  table_name,
  column_name,
  semantic_class,
  semantic_name,
  semantic_description,
  data_type,
  ui_type,
  is_sensitive,
  source,
  tags,
  is_active,
  updated_at
)
select
  table_schema,
  table_name,
  column_name,
  semantic_class,
  semantic_name,
  format('%s.%s 智能收单字段“%s”', table_schema, table_name, semantic_name),
  data_type,
  ui_type,
  is_sensitive,
  'ai_document_intake_mvp',
  jsonb_build_array('document_intake', table_name, semantic_class),
  true,
  now()
from column_source
on conflict (table_schema, table_name, column_name) do update
set semantic_class = excluded.semantic_class,
    semantic_name = excluded.semantic_name,
    semantic_description = excluded.semantic_description,
    data_type = excluded.data_type,
    ui_type = excluded.ui_type,
    is_sensitive = excluded.is_sensitive,
    source = excluded.source,
    tags = excluded.tags,
    is_active = true,
    updated_at = now();

grant select, insert, update, delete on
  public.collector_devices,
  public.collector_watch_folders,
  public.document_import_batches,
  public.document_assets,
  public.document_upload_sessions,
  public.document_upload_chunks,
  public.document_parse_jobs,
  public.document_parse_results,
  public.document_classification_results,
  public.document_entry_plans,
  public.document_business_links,
  public.document_unmapped_fields,
  public.ai_business_corrections,
  public.client_log_sessions,
  public.client_log_events
to web_user;

alter table public.collector_devices enable row level security;
alter table public.collector_watch_folders enable row level security;
alter table public.document_import_batches enable row level security;
alter table public.document_assets enable row level security;
alter table public.document_upload_sessions enable row level security;
alter table public.document_upload_chunks enable row level security;
alter table public.document_parse_jobs enable row level security;
alter table public.document_parse_results enable row level security;
alter table public.document_classification_results enable row level security;
alter table public.document_entry_plans enable row level security;
alter table public.document_business_links enable row level security;
alter table public.document_unmapped_fields enable row level security;
alter table public.ai_business_corrections enable row level security;
alter table public.client_log_sessions enable row level security;
alter table public.client_log_events enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'collector_devices',
    'collector_watch_folders',
    'document_import_batches',
    'document_assets',
    'document_upload_sessions',
    'document_upload_chunks',
    'document_parse_jobs',
    'document_parse_results',
    'document_classification_results',
    'document_entry_plans',
    'document_business_links',
    'document_unmapped_fields',
    'ai_business_corrections',
    'client_log_sessions',
    'client_log_events'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format('create policy %I on public.%I for select to web_user using (true)', table_name || '_select', table_name);
    execute format('create policy %I on public.%I for insert to web_user with check (true)', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for update to web_user using (true) with check (true)', table_name || '_update', table_name);
    execute format('create policy %I on public.%I for delete to web_user using (true)', table_name || '_delete', table_name);
  end loop;
end $$;

insert into public.permissions (code, name, module, action)
values
  ('op:document_intake.view', '智能收单中心-查看', 'document_intake', 'view'),
  ('op:document_intake.manage', '智能收单中心-管理', 'document_intake', 'manage'),
  ('op:collector_device.manage', '采集设备-管理', 'document_intake', 'manage_device')
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    action = excluded.action,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('super_admin')
  and p.code in ('op:document_intake.view', 'op:document_intake.manage', 'op:collector_device.manage')
on conflict do nothing;

select pg_notify('pgrst', 'reload schema');

commit;

select
  to_regclass('public.collector_devices') is not null as collector_devices_ready,
  to_regclass('public.document_assets') is not null as document_assets_ready,
  to_regclass('public.document_upload_sessions') is not null as document_upload_sessions_ready,
  to_regclass('public.document_upload_chunks') is not null as document_upload_chunks_ready,
  to_regclass('public.client_log_events') is not null as client_log_events_ready,
  has_table_privilege('web_user', 'public.document_assets', 'INSERT') as web_user_can_insert_assets,
  has_table_privilege('web_user', 'public.document_upload_sessions', 'INSERT') as web_user_can_insert_upload_sessions,
  has_table_privilege('web_user', 'public.document_upload_chunks', 'INSERT') as web_user_can_insert_upload_chunks,
  has_table_privilege('web_user', 'public.client_log_events', 'INSERT') as web_user_can_insert_logs,
  has_table_privilege('web_anon', 'public.document_assets', 'SELECT') as web_anon_can_select_assets,
  has_table_privilege('web_anon', 'public.document_upload_sessions', 'SELECT') as web_anon_can_select_upload_sessions,
  has_table_privilege('web_anon', 'public.document_upload_chunks', 'SELECT') as web_anon_can_select_upload_chunks,
  has_table_privilege('web_anon', 'public.client_log_events', 'SELECT') as web_anon_can_select_logs;
