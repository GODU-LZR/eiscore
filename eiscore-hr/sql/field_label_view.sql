-- 字段中文名视图（统一中文来源）
-- 执行方式（UTF-8）：cat field_label_view.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace view public.v_field_labels as
with overrides as (
  select module, field_code, field_label, 0 as priority
  from public.field_label_overrides
),
static_cols as (
  select 'hr_employee'::text as module, a.attname as field_code,
         coalesce(col_description(c.oid, a.attnum), a.attname)::text as field_label,
         2 as priority
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'hr' and c.relname = 'archives'
    and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('properties','version','updated_at')

  union all
  select 'hr_change'::text as module, a.attname as field_code,
         coalesce(col_description(c.oid, a.attnum), a.attname)::text as field_label,
         2 as priority
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'hr' and c.relname = 'archives'
    and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('properties','version','updated_at')

  union all
  select 'hr_attendance'::text as module, a.attname as field_code,
         coalesce(col_description(c.oid, a.attnum), a.attname)::text as field_label,
         2 as priority
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'hr' and c.relname = 'attendance_records'
    and a.attnum > 0 and not a.attisdropped

  union all
  select 'hr_attendance'::text as module, a.attname as field_code,
         coalesce(col_description(c.oid, a.attnum), a.attname)::text as field_label,
         2 as priority
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'hr' and c.relname = 'attendance_month_overrides'
    and a.attnum > 0 and not a.attisdropped

  union all
  select 'mms_ledger'::text as module, a.attname as field_code,
         coalesce(col_description(c.oid, a.attnum), a.attname)::text as field_label,
         2 as priority
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'raw_materials'
    and a.attnum > 0 and not a.attisdropped

  union all
  select 'hr_user'::text as module, a.attname as field_code,
         coalesce(col_description(c.oid, a.attnum), a.attname)::text as field_label,
         2 as priority
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'users'
    and a.attnum > 0 and not a.attisdropped
),
dynamic_cols as (
  select 'hr_employee'::text as module,
         (elem->>'prop')::text as field_code,
         (elem->>'label')::text as field_label,
         1 as priority
  from public.system_configs sc,
       jsonb_array_elements(sc.value) elem
  where sc.key = 'hr_table_cols'

  union all
  select 'hr_change'::text as module,
         (elem->>'prop')::text as field_code,
         (elem->>'label')::text as field_label,
         1 as priority
  from public.system_configs sc,
       jsonb_array_elements(sc.value) elem
  where sc.key = 'hr_transfer_cols'

  union all
  select 'hr_attendance'::text as module,
         (elem->>'prop')::text as field_code,
         (elem->>'label')::text as field_label,
         1 as priority
  from public.system_configs sc,
       jsonb_array_elements(sc.value) elem
  where sc.key = 'hr_attendance_cols'

  union all
  select 'mms_ledger'::text as module,
         (elem->>'prop')::text as field_code,
         (elem->>'label')::text as field_label,
         1 as priority
  from public.system_configs sc,
       jsonb_array_elements(sc.value) elem
  where sc.key = 'materials_table_cols'
),
merged as (
  select * from overrides
  union all
  select * from dynamic_cols
  union all
  select * from static_cols
)
select distinct on (module, field_code)
  module,
  field_code,
  field_label
from merged
where field_code is not null and field_code <> ''
order by module, field_code, priority;

grant select on public.v_field_labels to web_user;
