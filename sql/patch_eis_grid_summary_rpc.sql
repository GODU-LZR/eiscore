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
  condition_parts text[];
  part text;
  condition_sql text;
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

  if search_query <> '' then
    condition_text := regexp_replace(search_query, '^[?&]*or=\(', '');
    condition_text := regexp_replace(condition_text, '\)$', '');
    if condition_text <> '' then
      condition_parts := string_to_array(condition_text, ',');
      foreach part in array condition_parts loop
        condition_sql := null;
        if part ~ '^[A-Za-z_][A-Za-z0-9_]*\.eq\.-?[0-9]+(\.[0-9]+)?$' then
          condition_sql := format(
            '%I = %L',
            split_part(part, '.', 1),
            regexp_replace(part, '^[^.]+\.eq\.', '')
          );
        elsif part ~ '^[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
          condition_sql := format(
            '%I::text ilike %L',
            split_part(part, '.', 1),
            '%' || regexp_replace(regexp_replace(part, '^[^.]+\.ilike\.\*', ''), '\*$', '') || '%'
          );
        elsif part ~ '^properties->>[A-Za-z_][A-Za-z0-9_]*\.ilike\.\*.*\*$' then
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

  for col in select * from jsonb_array_elements(coalesce(payload->'columns', '[]'::jsonb)) loop
    col_prop := col->>'prop';
    col_label := coalesce(col->>'label', col_prop);
    col_source := coalesce(col->>'source', 'column');
    col_rule := coalesce(col->>'rule', 'none');
    col_type := coalesce(col->>'type', 'text');

    if col_prop is null or col_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
      continue;
    end if;
    if col_rule not in ('sum', 'avg', 'count', 'max', 'min') then
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

    if col_rule = 'sum' then
      agg_sql := format('select sum((%s)::numeric) from %s%s and (%s)::text ~ ''^-?[0-9]+(\.[0-9]+)?$''', field_sql, rel, conditions, field_sql);
    elsif col_rule = 'avg' then
      agg_sql := format('select avg((%s)::numeric) from %s%s and (%s)::text ~ ''^-?[0-9]+(\.[0-9]+)?$''', field_sql, rel, conditions, field_sql);
    elsif col_rule = 'max' then
      agg_sql := format('select max((%s)::numeric) from %s%s and (%s)::text ~ ''^-?[0-9]+(\.[0-9]+)?$''', field_sql, rel, conditions, field_sql);
    elsif col_rule = 'min' then
      agg_sql := format('select min((%s)::numeric) from %s%s and (%s)::text ~ ''^-?[0-9]+(\.[0-9]+)?$''', field_sql, rel, conditions, field_sql);
    end if;

    if conditions = '' then
      agg_sql := replace(agg_sql, format(' from %s and ', rel), format(' from %s where ', rel));
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
