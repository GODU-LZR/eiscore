-- 自动同步字段权限（监听 system_configs）
-- 作用：任意应用新增列后自动补齐字段权限（默认可见/可编辑）
-- 执行方式（UTF-8）：cat field_acl_auto_sync.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

create or replace function public.sync_field_acl_from_config()
returns trigger
language plpgsql
security definer
as $$
declare
  module_name text;
  dynamic_codes text[];
  static_codes text[];
  field_codes text[];
begin
  if TG_OP not in ('INSERT', 'UPDATE') then
    return NEW;
  end if;

  if NEW.key is null or NEW.key = '' then
    return NEW;
  end if;

  module_name := case NEW.key
    when 'hr_table_cols' then 'hr_employee'
    when 'hr_transfer_cols' then 'hr_change'
    when 'hr_attendance_cols' then 'hr_attendance'
    when 'materials_table_cols' then 'mms_ledger'
    else null
  end;

  if module_name is null then
    return NEW;
  end if;

  if jsonb_typeof(NEW.value) = 'array' then
    select array_agg(distinct (elem->>'prop'))
      into dynamic_codes
    from jsonb_array_elements(NEW.value) as elem
    where (elem ? 'prop') and (elem->>'prop') <> '';
  end if;

  if module_name in ('hr_employee', 'hr_change') then
    select array_agg(c.column_name order by c.ordinal_position)
      into static_codes
    from information_schema.columns c
    where c.table_schema = 'hr'
      and c.table_name = 'archives'
      and c.column_name not in ('properties','version','updated_at');
  elsif module_name = 'hr_attendance' then
    select array_agg(col order by ord) into static_codes
    from (
      select distinct on (c.column_name)
        c.column_name as col,
        min(c.ordinal_position) over (partition by c.column_name) as ord
      from information_schema.columns c
      where c.table_schema = 'hr'
        and c.table_name in ('attendance_records','attendance_month_overrides')
    ) t
    where t.col is not null;
  elsif module_name = 'mms_ledger' then
    select array_agg(c.column_name order by c.ordinal_position)
      into static_codes
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'raw_materials';
  else
    static_codes := ARRAY[]::text[];
  end if;

  field_codes := array_cat(coalesce(static_codes, ARRAY[]::text[]), coalesce(dynamic_codes, ARRAY[]::text[]));
  if array_length(field_codes, 1) is null then
    return NEW;
  end if;

  perform public.ensure_field_acl(module_name, field_codes);
  return NEW;
end;
$$;

drop trigger if exists tg_sync_field_acl_configs on public.system_configs;
create trigger tg_sync_field_acl_configs
after insert or update on public.system_configs
for each row execute function public.sync_field_acl_from_config();

-- 补齐一次已有配置
update public.system_configs
set value = value
where key in ('hr_table_cols', 'hr_transfer_cols', 'hr_attendance_cols', 'materials_table_cols');
