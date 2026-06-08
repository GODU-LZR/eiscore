-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

create or replace function public.eis_grid_agent_query(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  operation text := coalesce(payload->>'operation', 'count');
  api_url text := coalesce(payload->>'api_url', '');
  profile text := coalesce(payload->>'accept_profile', 'public');
  search_query text := coalesce(payload->>'search_query', '');
  rel_schema text;
  rel_name text;
  rel regclass;
  columns jsonb := coalesce(payload->'columns', '[]'::jsonb);
  col jsonb;
  col_prop text;
  col_label text;
  col_source text;
  col_type text;
  group_by_prop text := payload->>'group_by';
  group_by_label text := payload->>'group_by';
  numeric_props text[] := array[]::text[];
  numeric_prop text;
  sample_limit int := greatest(1, least(50, coalesce((payload->>'sample_limit')::int, 12)));
  group_limit int := greatest(1, least(30, coalesce((payload->>'group_limit')::int, 12)));
  conditions text := '';
  condition_text text;
  condition_parts text[];
  part text;
  condition_prop text;
  condition_sql text;
  field_sql text;
  sample_select text := '';
  sample_order_sql text := '';
  sample_item text;
  sample_result jsonb := '[]'::jsonb;
  group_result jsonb := '[]'::jsonb;
  numeric_result jsonb := '{}'::jsonb;
  total_count bigint := 0;
  has_properties_column boolean := false;
  sql_text text;
  started_at timestamptz := clock_timestamp();
begin
  if operation not in ('count', 'sample', 'group_count', 'numeric_summary', 'overview') then
    raise exception 'operation % is not allowed', operation;
  end if;

  api_url := regexp_replace(api_url, '^/api', '');
  api_url := regexp_replace(api_url, '^/', '');
  api_url := split_part(api_url, '?', 1);

  rel_name := nullif(split_part(api_url, '/', 1), '');
  if rel_name is null then
    raise exception 'api_url is required';
  end if;

  if position('.' in rel_name) > 0 then
    rel_schema := split_part(rel_name, '.', 1);
    rel_name := split_part(rel_name, '.', 2);
  else
    rel_schema := profile;
  end if;

  if rel_schema not in ('public', 'hr', 'scm', 'app_center', 'workflow', 'app_data') then
    raise exception 'schema % is not allowed', rel_schema;
  end if;

  rel := to_regclass(format('%I.%I', rel_schema, rel_name));
  if rel is null then
    raise exception 'relation %.% not found', rel_schema, rel_name;
  end if;

  if jsonb_typeof(columns) is distinct from 'array' then
    columns := '[]'::jsonb;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = rel_schema
      and table_name = rel_name
      and column_name = 'properties'
  ) into has_properties_column;

  if search_query <> '' then
    condition_text := regexp_replace(search_query, '^[?&]*or=\(', '');
    condition_text := regexp_replace(condition_text, '\)$', '');
    if condition_text <> '' then
      condition_parts := string_to_array(condition_text, ',');
      foreach part in array condition_parts loop
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.-?[0-9]+(\.[0-9]+)?$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text = %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.eq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I::text ilike %L',
              condition_prop,
              '%' || regexp_replace(regexp_replace(part, '^[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
            );
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          conditions := conditions || case when conditions = '' then '' else ' or ' end || condition_sql;
        end if;
      end loop;
      if conditions <> '' then
        conditions := ' where (' || conditions || ')';
      end if;
    end if;
  end if;

  execute format('select count(*) from %s%s', rel, conditions) into total_count;

  if operation in ('sample', 'overview') then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = rel_schema
        and table_name = rel_name
        and column_name = 'created_at'
    ) then
      sample_order_sql := ' order by created_at desc';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = rel_schema
        and table_name = rel_name
        and column_name = 'id'
    ) then
      sample_order_sql := ' order by id desc';
    end if;

    for col in select * from jsonb_array_elements(columns) limit 20 loop
      col_prop := col->>'prop';
      col_label := coalesce(col->>'label', col_prop);
      col_source := coalesce(col->>'source', 'column');
      col_type := coalesce(col->>'type', 'text');

      if col_prop is null or col_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
        continue;
      end if;
      if col_type in ('file', 'geo') then
        continue;
      end if;

      if col_source = 'properties' and has_properties_column then
        sample_item := format('%L, t.properties->>%L', col_prop, col_prop);
      elsif col_source <> 'properties' then
        if not exists (
          select 1
          from information_schema.columns
          where table_schema = rel_schema
            and table_name = rel_name
            and column_name = col_prop
        ) then
          continue;
        end if;
        sample_item := format('%L, t.%I', col_prop, col_prop);
      end if;

      sample_select := sample_select || case when sample_select = '' then '' else ', ' end || sample_item;
    end loop;

    if sample_select = '' then
      sample_result := '[]'::jsonb;
    else
      sql_text := format(
        'select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(%s))), ''[]''::jsonb) from (select * from %s%s%s limit %s) t',
        sample_select,
        rel,
        conditions,
        sample_order_sql,
        sample_limit
      );
      execute sql_text into sample_result;
    end if;
  end if;

  if operation in ('group_count', 'overview') and group_by_prop is not null and group_by_prop <> '' then
    field_sql := null;
    col_source := null;
    group_by_label := group_by_prop;
    for col in select * from jsonb_array_elements(columns) loop
      if col->>'prop' = group_by_prop then
        col_source := coalesce(col->>'source', 'column');
        group_by_label := coalesce(col->>'label', group_by_prop);
        exit;
      end if;
    end loop;

    if col_source is not null and group_by_prop ~ '^[A-Za-z_][A-Za-z0-9_]*$' then
      if col_source = 'properties' and has_properties_column then
        field_sql := format('nullif(t.properties->>%L, '''')', group_by_prop);
      elsif col_source <> 'properties' then
        if exists (
          select 1
          from information_schema.columns
          where table_schema = rel_schema
            and table_name = rel_name
            and column_name = group_by_prop
        ) then
          field_sql := format('t.%I::text', group_by_prop);
        end if;
      end if;

      if field_sql is not null then
        sql_text := format(
          $sql$
          select coalesce(jsonb_agg(jsonb_build_object('value', group_value, 'count', row_count) order by row_count desc), '[]'::jsonb)
          from (
            select coalesce(%1$s, '(空)') as group_value, count(*)::bigint as row_count
            from %2$s t
            %3$s
            group by coalesce(%1$s, '(空)')
            order by row_count desc
            limit %4$s
          ) g
          $sql$,
          field_sql,
          rel,
          conditions,
          group_limit
        );
        execute sql_text into group_result;
      end if;
    end if;
  end if;

  if operation in ('numeric_summary', 'overview') then
    for col in select * from jsonb_array_elements(columns) loop
      field_sql := null;
      col_prop := col->>'prop';
      col_label := coalesce(col->>'label', col_prop);
      col_source := coalesce(col->>'source', 'column');
      col_type := coalesce(col->>'type', 'text');

      if col_prop is null or col_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
        continue;
      end if;

      if col_type not in ('number', 'currency', 'percent', 'formula') then
        continue;
      end if;

      if col_source = 'properties' and has_properties_column then
        field_sql := format('nullif(t.properties->>%L, '''')', col_prop);
      elsif col_source <> 'properties' then
        if not exists (
          select 1
          from information_schema.columns
          where table_schema = rel_schema
            and table_name = rel_name
            and column_name = col_prop
        ) then
          continue;
        end if;
        field_sql := format('t.%I', col_prop);
      end if;

      if field_sql is null then
        continue;
      end if;

      sql_text := format(
        $sql$
        select jsonb_build_object(
          'label', %1$L,
          'count', count(*)::bigint,
          'sum', coalesce(sum((%2$s)::numeric), 0),
          'avg', coalesce(avg((%2$s)::numeric), 0),
          'min', min((%2$s)::numeric),
          'max', max((%2$s)::numeric)
        )
        from %3$s t
        %4$s%5$s (%2$s)::text ~ '^-?[0-9]+(\.[0-9]+)?$'
        $sql$,
        col_label,
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end
      );
      execute sql_text into col;
      numeric_result := jsonb_set(numeric_result, array[col_prop], coalesce(col, '{}'::jsonb), true);
      numeric_props := array_append(numeric_props, col_prop);
      if array_length(numeric_props, 1) >= 12 then
        exit;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'scope', 'server',
    'tool', 'eis_grid_agent_query',
    'operation', operation,
    'schema', rel_schema,
    'table', rel_name,
    'searchApplied', conditions <> '',
    'totalCount', total_count,
    'sample', sample_result,
    'groupBy', case when group_by_prop is not null and group_by_prop <> '' then jsonb_build_object('prop', group_by_prop, 'label', group_by_label, 'rows', group_result) else null end,
    'numericSummary', numeric_result,
    'limits', jsonb_build_object('sample', sample_limit, 'group', group_limit),
    'durationMs', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
  );
end;
$$;

grant execute on function public.eis_grid_agent_query(jsonb) to web_user;
