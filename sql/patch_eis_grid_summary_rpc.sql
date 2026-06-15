-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

create or replace function public.eis_grid_summary(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  api_url text := coalesce(payload->>'api_url', '');
  profile text := coalesce(payload->>'accept_profile', 'public');
  base_query text := coalesce(payload->>'base_query', '');
  search_query text := coalesce(payload->>'search_query', '');
  rel_schema text;
  rel_name text;
  rel regclass;
  col jsonb;
  col_prop text;
  col_label text;
  col_source text;
  col_rule text;
  col_type text;
  field_sql text;
  agg_sql text;
  value numeric;
  count_value bigint;
  conditions text := '';
  condition_text text;
  filter_text text;
  condition_parts text[];
  part text;
  condition_prop text;
  condition_op text;
  condition_sql text;
  numeric_condition text;
  raw_value text;
  quoted_values text;
  has_properties_column boolean := false;
  result jsonb := '{}'::jsonb;
begin
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

  select exists (
    select 1
    from information_schema.columns
    where table_schema = rel_schema
      and table_name = rel_name
      and column_name = 'properties'
  ) into has_properties_column;

  if base_query <> '' then
    filter_text := regexp_replace(base_query, '^[?&]*', '');
    if filter_text <> '' then
      condition_parts := string_to_array(filter_text, '&');
      foreach part in array condition_parts loop
        part := regexp_replace(part, '=', '.');
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[^,()]+$' then
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
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.neq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I <> %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.neq\.', '')
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.is\.(true|false|null)$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I is %s',
              condition_prop,
              regexp_replace(part, '^[^.]+\.is\.', '')
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
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.(lt|lte|gt|gte)\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          condition_op := split_part(part, '.', 2);
          raw_value := regexp_replace(part, '^[^.]+\.(lt|lte|gt|gte)\.', '');
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I %s %L',
              condition_prop,
              case condition_op when 'lt' then '<' when 'lte' then '<=' when 'gt' then '>' else '>=' end,
              raw_value
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.in\.\(.+\)$' then
          condition_prop := split_part(part, '.', 1);
          raw_value := regexp_replace(regexp_replace(part, '^[^.]+\.in\.\(', ''), '\)$', '');
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            select string_agg(format('%L', trim(item)), ',')
            into quoted_values
            from unnest(string_to_array(raw_value, ',')) as item
            where trim(item) <> '';
            if quoted_values is not null and quoted_values <> '' then
              condition_sql := format('%I::text in (%s)', condition_prop, quoted_values);
            end if;
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          conditions := conditions || case when conditions = '' then '' else ' and ' end || condition_sql;
        end if;
      end loop;
      if conditions <> '' then
        conditions := '(' || conditions || ')';
      end if;
    end if;
  end if;

  if search_query <> '' then
    condition_text := regexp_replace(search_query, '^[?&]*or=\(', '');
    condition_text := regexp_replace(condition_text, '\)$', '');
    if condition_text <> '' then
      filter_text := '';
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
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.[^,()]+$' then
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
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.neq\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I <> %L',
              condition_prop,
              regexp_replace(part, '^[^.]+\.neq\.', '')
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
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.(lt|lte|gt|gte)\.[^,()]+$' then
          condition_prop := split_part(part, '.', 1);
          condition_op := split_part(part, '.', 2);
          raw_value := regexp_replace(part, '^[^.]+\.(lt|lte|gt|gte)\.', '');
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            condition_sql := format(
              '%I %s %L',
              condition_prop,
              case condition_op when 'lt' then '<' when 'lte' then '<=' when 'gt' then '>' else '>=' end,
              raw_value
            );
          end if;
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.in\.\(.+\)$' then
          condition_prop := split_part(part, '.', 1);
          raw_value := regexp_replace(regexp_replace(part, '^[^.]+\.in\.\(', ''), '\)$', '');
          if exists (
            select 1
            from information_schema.columns
            where table_schema = rel_schema
              and table_name = rel_name
              and column_name = condition_prop
          ) then
            select string_agg(format('%L', trim(item)), ',')
            into quoted_values
            from unnest(string_to_array(raw_value, ',')) as item
            where trim(item) <> '';
            if quoted_values is not null and quoted_values <> '' then
              condition_sql := format('%I::text in (%s)', condition_prop, quoted_values);
            end if;
          end if;
        elsif has_properties_column and part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '(properties->>%L) ilike %L',
            regexp_replace(split_part(part, '.', 1), '^properties->>', ''),
            '%' || regexp_replace(regexp_replace(part, '^properties->>[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        end if;

        if condition_sql is not null then
          filter_text := filter_text || case when filter_text = '' then '' else ' or ' end || condition_sql;
        end if;
      end loop;
      if filter_text <> '' then
        conditions := conditions || case when conditions = '' then '' else ' and ' end || '(' || filter_text || ')';
      end if;
    end if;
  end if;

  if conditions <> '' then
    conditions := ' where ' || conditions;
  end if;

  for col in select * from jsonb_array_elements(coalesce(payload->'columns', '[]'::jsonb)) loop
    col_prop := col->>'prop';
    col_label := coalesce(col->>'label', col_prop);
    col_source := coalesce(col->>'source', 'column');
    col_rule := coalesce(col->>'rule', 'none');
    col_type := coalesce(col->>'type', 'text');

    if col_prop is null or col_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
      continue;
    end if;
    if col_rule not in ('sum', 'avg', 'count', 'max', 'min', 'count_all') then
      continue;
    end if;

    if col_rule = 'count_all' then
      agg_sql := format('select count(*) from %s%s', rel, conditions);
      execute agg_sql into count_value;
      result := jsonb_set(
        result,
        array[col_prop],
        jsonb_build_object('label', col_label, 'rule', col_rule, 'value', count_value),
        true
      );
      continue;
    end if;

    if col_source = 'properties' then
      field_sql := format('nullif(properties->>%L, '''')', col_prop);
    else
      if not exists (
        select 1
        from information_schema.columns
        where table_schema = rel_schema
          and table_name = rel_name
          and column_name = col_prop
      ) then
        continue;
      end if;
      field_sql := format('%I', col_prop);
    end if;

    if col_rule = 'count' then
      agg_sql := format('select count(%s) from %s%s', field_sql, rel, conditions);
      execute agg_sql into count_value;
      result := jsonb_set(
        result,
        array[col_prop],
        jsonb_build_object('label', col_label, 'rule', col_rule, 'value', count_value),
        true
      );
      continue;
    end if;

    numeric_condition := format('(%s)::text ~ ''^-?[0-9]+(\.[0-9]+)?$''', field_sql);
    if col_rule = 'sum' then
      agg_sql := format(
        'select sum((%s)::numeric) from %s%s%s',
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end || numeric_condition
      );
    elsif col_rule = 'avg' then
      agg_sql := format(
        'select avg((%s)::numeric) from %s%s%s',
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end || numeric_condition
      );
    elsif col_rule = 'max' then
      agg_sql := format(
        'select max((%s)::numeric) from %s%s%s',
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end || numeric_condition
      );
    elsif col_rule = 'min' then
      agg_sql := format(
        'select min((%s)::numeric) from %s%s%s',
        field_sql,
        rel,
        conditions,
        case when conditions = '' then ' where ' else ' and ' end || numeric_condition
      );
    end if;

    execute agg_sql into value;
    result := jsonb_set(
      result,
      array[col_prop],
      jsonb_build_object('label', col_label, 'rule', col_rule, 'value', coalesce(value, 0)),
      true
    );
  end loop;

  return jsonb_build_object(
    'scope', 'server',
    'schema', rel_schema,
    'table', rel_name,
    'results', result
  );
end;
$$;

grant execute on function public.eis_grid_summary(jsonb) to web_user;

create or replace function public.eis_grid_summary(
  p_table text,
  p_profile text default 'public'
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.eis_grid_summary(
    jsonb_build_object(
      'api_url', '/' || p_table,
      'accept_profile', coalesce(nullif(p_profile, ''), 'public'),
      'columns', jsonb_build_array(jsonb_build_object('prop', 'id', 'label', '记录数', 'rule', 'count'))
    )
  );
$$;

grant execute on function public.eis_grid_summary(text, text) to web_user;
