-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

create or replace function public.eis_grid_formula_eval_token(
  token jsonb,
  row_data jsonb,
  stack numeric[]
)
returns numeric[]
language plpgsql
immutable
as $$
declare
  token_type text := token->>'type';
  token_value text := token->>'value';
  token_prop text := token->>'prop';
  token_source text := coalesce(token->>'source', 'column');
  raw_value text;
  left_value numeric;
  right_value numeric;
  next_value numeric;
begin
  if token_type = 'number' then
    stack := array_append(stack, (token->>'value')::numeric);
    return stack;
  end if;

  if token_type = 'ref' then
    if token_prop is null or token_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
      stack := array_append(stack, 0);
      return stack;
    end if;

    if token_source = 'properties' then
      raw_value := row_data->'properties'->>token_prop;
    else
      raw_value := row_data->>token_prop;
    end if;

    if raw_value is null or raw_value = '' or raw_value !~ '^-?[0-9]+(\.[0-9]+)?$' then
      stack := array_append(stack, 0);
    else
      stack := array_append(stack, raw_value::numeric);
    end if;
    return stack;
  end if;

  if token_type = 'operator' then
    if token_value = 'u-' then
      if array_length(stack, 1) is null or array_length(stack, 1) < 1 then
        raise exception 'invalid formula stack for unary operator';
      end if;
      stack[array_length(stack, 1)] := -stack[array_length(stack, 1)];
      return stack;
    end if;

    if array_length(stack, 1) is null or array_length(stack, 1) < 2 then
      raise exception 'invalid formula stack for binary operator';
    end if;

    right_value := stack[array_length(stack, 1)];
    stack := stack[1:array_length(stack, 1) - 1];
    left_value := stack[array_length(stack, 1)];
    stack := stack[1:array_length(stack, 1) - 1];

    if token_value = '+' then
      next_value := left_value + right_value;
    elsif token_value = '-' then
      next_value := left_value - right_value;
    elsif token_value = '*' then
      next_value := left_value * right_value;
    elsif token_value = '/' then
      if right_value = 0 then
        stack := array_append(stack, null);
        return stack;
      end if;
      next_value := left_value / right_value;
    else
      raise exception 'unsupported operator %', token_value;
    end if;

    stack := array_append(stack, next_value);
    return stack;
  end if;

  raise exception 'unsupported token type %', token_type;
end;
$$;

create or replace function public.eis_grid_formula_eval(tokens jsonb, row_data jsonb, precision_value int default 2)
returns numeric
language plpgsql
immutable
as $$
declare
  token jsonb;
  stack numeric[] := array[]::numeric[];
  result numeric;
begin
  for token in select * from jsonb_array_elements(coalesce(tokens, '[]'::jsonb)) loop
    stack := public.eis_grid_formula_eval_token(token, row_data, stack);
  end loop;

  if array_length(stack, 1) is distinct from 1 then
    raise exception 'invalid formula result stack';
  end if;

  result := stack[1];
  if result is null then
    return null;
  end if;

  return round(result, greatest(0, least(6, precision_value)));
end;
$$;

create or replace function public.eis_grid_formula_recalculate(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  write_url text := coalesce(nullif(payload->>'write_url', ''), payload->>'api_url', '');
  profile text := coalesce(nullif(payload->>'content_profile', ''), nullif(payload->>'accept_profile', ''), 'public');
  search_query text := coalesce(payload->>'search_query', '');
  cursor_id text := payload->>'cursor_id';
  target_prop text := payload->'target'->>'prop';
  target_label text := coalesce(payload->'target'->>'label', target_prop);
  tokens jsonb := coalesce(payload->'tokens', '[]'::jsonb);
  batch_size int := greatest(100, least(10000, coalesce((payload->>'batch_size')::int, 2000)));
  precision_value int := greatest(0, least(6, coalesce((payload->>'precision')::int, 2)));
  rel_schema text;
  rel_name text;
  rel regclass;
  conditions text := '';
  batch_conditions text := '';
  condition_text text;
  condition_parts text[];
  part text;
  condition_sql text;
  token jsonb;
  field_prop text;
  field_source text;
  id_type text;
  updated_count int := 0;
  scanned_count int := 0;
  started_at timestamptz := clock_timestamp();
  sql_text text;
begin
  write_url := regexp_replace(write_url, '^/api', '');
  write_url := regexp_replace(write_url, '^/', '');
  write_url := split_part(write_url, '?', 1);

  rel_name := nullif(split_part(write_url, '/', 1), '');
  if rel_name is null then
    raise exception 'write_url or api_url is required';
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

  if target_prop is null or target_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
    raise exception 'target prop is invalid';
  end if;

  if jsonb_typeof(tokens) is distinct from 'array' or jsonb_array_length(tokens) = 0 then
    raise exception 'tokens are required';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = rel_schema
      and table_name = rel_name
      and column_name = 'id'
  ) then
    raise exception 'relation %.% must have id column', rel_schema, rel_name;
  end if;

  select format('%I.%I', udt_schema, udt_name)
  into id_type
  from information_schema.columns
  where table_schema = rel_schema
    and table_name = rel_name
    and column_name = 'id';

  if id_type is null then
    raise exception 'relation %.% id column type not found', rel_schema, rel_name;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = rel_schema
      and table_name = rel_name
      and column_name = 'properties'
  ) then
    raise exception 'relation %.% must have properties jsonb column', rel_schema, rel_name;
  end if;

  for token in select * from jsonb_array_elements(tokens) loop
    if token->>'type' = 'operator' then
      if token->>'value' not in ('+', '-', '*', '/', 'u-') then
        raise exception 'unsupported operator %', token->>'value';
      end if;
    elsif token->>'type' = 'number' then
      if token->>'value' is null or token->>'value' !~ '^-?[0-9]+(\.[0-9]+)?$' then
        raise exception 'invalid number token';
      end if;
    elsif token->>'type' = 'ref' then
      field_prop := token->>'prop';
      field_source := coalesce(token->>'source', 'column');
      if field_prop is null or field_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
        raise exception 'invalid ref token';
      end if;
      if field_source not in ('column', 'properties') then
        raise exception 'invalid ref source %', field_source;
      end if;
      if field_source = 'column' and not exists (
        select 1
        from information_schema.columns
        where table_schema = rel_schema
          and table_name = rel_name
          and column_name = field_prop
      ) then
        raise exception 'column %.%.% not found', rel_schema, rel_name, field_prop;
      end if;
    else
      raise exception 'unsupported token type %', token->>'type';
    end if;
  end loop;

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

  batch_conditions := conditions;
  if cursor_id is not null and cursor_id <> '' then
    batch_conditions := batch_conditions
      || case when batch_conditions = '' then ' where ' else ' and ' end
      || format('id > %L::%s', cursor_id, id_type);
  end if;

  sql_text := format(
    $sql$
    with candidates as (
      select id, to_jsonb(t.*) as row_data
      from %1$s t
      %2$s
      order by id
      limit %3$s
      for update skip locked
    ),
    calculated as (
      select
        id,
        row_data,
        public.eis_grid_formula_eval(%4$L::jsonb, row_data, %5$s) as formula_value,
        case
          when (row_data->'properties'->>%6$L) ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (row_data->'properties'->>%6$L)::numeric
          else null
        end as current_value
      from candidates
    ),
    changed as (
      select id, formula_value
      from calculated
      where formula_value is not null
        and current_value is distinct from formula_value
    ),
    updated as (
      update %1$s target
      set properties = jsonb_set(
        coalesce(target.properties, '{}'::jsonb),
        array[%6$L],
        to_jsonb(changed.formula_value),
        true
      )
      from changed
      where target.id = changed.id
      returning target.id
    )
    select
      (select count(*) from candidates)::int as scanned_count,
      (select count(*) from updated)::int as updated_count,
      (select id::text from candidates order by id desc limit 1) as next_cursor
    $sql$,
    rel,
    batch_conditions,
    batch_size,
    tokens::text,
    precision_value,
    target_prop
  );

  execute sql_text into scanned_count, updated_count, cursor_id;

  return jsonb_build_object(
    'scope', 'server',
    'schema', rel_schema,
    'table', rel_name,
    'target', jsonb_build_object('prop', target_prop, 'label', target_label),
    'scanned', coalesce(scanned_count, 0),
    'updated', coalesce(updated_count, 0),
    'matched', null,
    'next_cursor', cursor_id,
    'has_more', coalesce(scanned_count, 0) >= batch_size,
    'batch_size', batch_size,
    'duration_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
  );
end;
$$;

grant execute on function public.eis_grid_formula_eval_token(jsonb, jsonb, numeric[]) to web_user;
grant execute on function public.eis_grid_formula_eval(jsonb, jsonb, int) to web_user;
grant execute on function public.eis_grid_formula_recalculate(jsonb) to web_user;
