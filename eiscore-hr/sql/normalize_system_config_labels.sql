-- 规范化动态列中文名：空/纯数字 -> 自定义字段N
-- 执行方式（UTF-8）：cat normalize_system_config_labels.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

do $$
declare
  _key text;
begin
  foreach _key in array array['hr_table_cols','hr_transfer_cols','hr_attendance_cols','materials_table_cols'] loop
    update public.system_configs sc
    set value = sub.new_value
    from (
      select jsonb_agg(
        case
          when (elem ? 'label') and coalesce(nullif(trim(elem->>'label'),''),'') ~ '^[0-9]+$'
            then elem || jsonb_build_object('label', '自定义字段' || idx)
          when not (elem ? 'label') or coalesce(nullif(trim(elem->>'label'),''),'') = ''
            then elem || jsonb_build_object('label', '自定义字段' || idx)
          else elem
        end
        order by idx
      ) as new_value
      from (
        select elem, row_number() over () as idx
        from public.system_configs sc2, jsonb_array_elements(sc2.value) elem
        where sc2.key = _key and jsonb_typeof(sc2.value) = 'array'
      ) t
    ) sub
    where sc.key = _key and jsonb_typeof(sc.value) = 'array';
  end loop;
end $$;
