-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Keep filtered totals and implicit formula dependencies consistent across grids.
-- Keep existing grants; execute aggregates with the caller's table and row policies.

ALTER VIEW public.v_roles_manage SET (security_invoker = true);
ALTER VIEW public.v_role_permissions_matrix SET (security_invoker = true);
ALTER VIEW public.v_role_data_scopes_matrix SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.eis_grid_summary(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  api_url text := coalesce(payload->>'api_url', '');
  profile text := coalesce(payload->>'accept_profile', 'public');
  rel_schema text;
  rel_name text;
  rel regclass;
  rel_kind "char";
  rel_is_partition boolean;
  rel_options text[];
  col jsonb;
  col_prop text;
  col_label text;
  col_source text;
  col_rule text;
  col_field text;
  col_transform text;
  field_sql text;
  agg_sql text;
  value numeric;
  count_value bigint;
  numeric_count bigint;
  conditions text := '';
  query_text text;
  query_part text;
  group_text text;
  group_sql text;
  group_join text;
  condition_parts text[];
  matches text[];
  part text;
  condition_prop text;
  condition_op text;
  condition_sql text;
  condition_field text;
  numeric_condition text;
  numeric_value text;
  raw_value text;
  quoted_values text;
  has_properties_column boolean := false;
  array_column boolean;
  depth integer;
  start_at integer;
  pos integer;
  ch text;
  result jsonb := '{}'::jsonb;
begin
  api_url := regexp_replace(api_url, '^/api', '');
  api_url := regexp_replace(api_url, '^/', '');
  api_url := split_part(api_url, '?', 1);
  rel_name := nullif(split_part(api_url, '/', 1), '');
  if rel_name is null then raise exception 'api_url is required'; end if;
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
  if rel is null then raise exception 'relation %.% not found', rel_schema, rel_name; end if;
  select c.relkind, c.relispartition, c.reloptions
    into rel_kind, rel_is_partition, rel_options
  from pg_class c
  where c.oid = rel;
  if rel_kind not in ('r', 'p', 'v') or rel_is_partition then
    raise exception 'relation %.% is not a supported summary source', rel_schema, rel_name;
  end if;
  if not has_table_privilege(current_user, rel, 'SELECT') then
    raise exception 'summary source %.% is not readable by the caller', rel_schema, rel_name;
  end if;
  if rel_kind = 'v' and not coalesce(rel_options @> ARRAY['security_invoker=true'], false) then
    raise exception 'summary source view %.% must use security_invoker=true', rel_schema, rel_name;
  end if;
  select exists(select 1 from pg_attribute where attrelid=rel and attname='properties' and attnum>0 and not attisdropped)
    into has_properties_column;

  -- Both query sources use the same field and operator checks; groups are ANDed.
  foreach query_text in array array[coalesce(payload->>'base_query',''), coalesce(payload->>'search_query','')] loop
    query_text := regexp_replace(query_text, '^[?&]+', '');
    if query_text = '' then continue; end if;
    foreach query_part in array string_to_array(query_text, '&') loop
      if query_part = '' then continue; end if;
      group_join := ' and ';
      group_text := query_part;
      if query_part ~ '^or=\(.*\)$' then
        group_join := ' or ';
        group_text := substr(query_part, 5, length(query_part)-5);
      elsif query_part ~ '^(or|and)=' then
        raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER';
      end if;
      condition_parts := array[]::text[];
      if group_join = ' or ' then
        depth := 0;
        start_at := 1;
        for pos in 1..length(group_text) loop
          ch := substr(group_text,pos,1);
          if ch = '(' then depth := depth+1;
          elsif ch = ')' then depth := depth-1;
          elsif ch = ',' and depth = 0 then
            condition_parts := array_append(condition_parts,substr(group_text,start_at,pos-start_at));
            start_at := pos+1;
          end if;
          if depth < 0 or depth > 1 then
            raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER';
          end if;
        end loop;
        if depth <> 0 then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER'; end if;
        condition_parts := array_append(condition_parts,substr(group_text,start_at));
      else
        condition_parts := array[group_text];
      end if;
      group_sql := '';
      foreach part in array condition_parts loop
        part := regexp_replace(part, '^([A-Za-z_][A-Za-z0-9_]*|properties->>[A-Za-z_][A-Za-z0-9_]*)=', '\1.');
        matches := regexp_match(part, '^([A-Za-z_][A-Za-z0-9_]*|properties->>[A-Za-z_][A-Za-z0-9_]*)\.(eq|neq|is|like|ilike|lt|lte|gt|gte|in)\.(.+)$');
        if matches is null then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER'; end if;
        condition_prop := matches[1];
        condition_op := matches[2];
        raw_value := matches[3];
        if condition_prop like 'properties->>%' then
          if not has_properties_column then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER'; end if;
          condition_field := format('(properties->>%L)',substr(condition_prop,14));
        else
          if not exists(select 1 from pg_attribute where attrelid=rel and attname=condition_prop and attnum>0 and not attisdropped) then
            raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER';
          end if;
          condition_field := format('%I',condition_prop);
        end if;
        if condition_op = 'in' then
          if raw_value !~ '^\([^()]+\)$' then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER'; end if;
          select string_agg(format('%L',trim(item)),',') into quoted_values
            from unnest(string_to_array(substr(raw_value,2,length(raw_value)-2),',')) item where trim(item)<>'';
          if quoted_values is null then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER'; end if;
          condition_sql := format('%s::text in (%s)',condition_field,quoted_values);
        else
          if raw_value ~ '[,()]' then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER'; end if;
          if condition_op = 'is' then
            if raw_value not in ('true','false','null') then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER'; end if;
            if raw_value in ('true','false') and condition_prop like 'properties->>%' then
              condition_sql := format('%s = %L',condition_field,raw_value);
            else
              condition_sql := format('%s is %s',condition_field,raw_value);
            end if;
          elsif condition_op in ('like','ilike') then
            condition_sql := format('%s::text %s %L',condition_field,condition_op,replace(raw_value,'*','%'));
          else
            condition_sql := format('%s %s %L',condition_field,
              case condition_op when 'eq' then '=' when 'neq' then '<>' when 'lt' then '<' when 'lte' then '<=' when 'gt' then '>' when 'gte' then '>=' end,
              raw_value);
          end if;
        end if;
        group_sql := group_sql || case when group_sql='' then '' else group_join end || condition_sql;
      end loop;
      if group_sql = '' then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FILTER'; end if;
      conditions := conditions || case when conditions='' then '' else ' and ' end || '(' || group_sql || ')';
    end loop;
  end loop;
  if conditions<>'' then conditions := ' where ' || conditions; end if;

  for col in select * from jsonb_array_elements(coalesce(payload->'columns','[]'::jsonb)) loop
    col_prop := col->>'prop';
    col_label := coalesce(col->>'label',col_prop);
    col_source := coalesce(col->>'source','column');
    col_rule := coalesce(col->>'rule','none');
    col_field := coalesce(col->>'field',col_prop);
    col_transform := coalesce(col->>'transform','');
    if col_prop is null or col_prop !~ '^[A-Za-z_][A-Za-z0-9_]*$' then continue; end if;
    if col_rule not in ('sum','avg','count','max','min','count_all','auto') then continue; end if;
    if col_rule='count_all' then
      execute format('select count(*) from %s%s',rel,conditions) into count_value;
      result := jsonb_set(result,array[col_prop],jsonb_build_object('label',col_label,'rule',col_rule,'value',count_value),true);
      continue;
    end if;
    if col_source not in ('column','properties') or col_field !~ '^[A-Za-z_][A-Za-z0-9_]*$' then
      raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FIELD';
    end if;
    if col_transform<>'' then
      if col_transform<>'array_length' or col_source<>'column' then
        raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_TRANSFORM';
      end if;
      select t.typcategory='A' into array_column from pg_attribute a join pg_type t on t.oid=a.atttypid
        where a.attrelid=rel and a.attname=col_field and a.attnum>0 and not a.attisdropped;
      if array_column is distinct from true then
        raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_TRANSFORM';
      end if;
      field_sql := format('coalesce(array_length(%I,1),0)',col_field);
    elsif col_field<>col_prop then
      raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_TRANSFORM';
    elsif col_source='properties' then
      if not has_properties_column then raise exception using errcode='22023', message='EISCORE_UNSUPPORTED_SUMMARY_FIELD'; end if;
      field_sql := format('nullif(properties->>%L,'''')',col_prop);
    else
      if not exists(select 1 from pg_attribute where attrelid=rel and attname=col_prop and attnum>0 and not attisdropped) then continue; end if;
      field_sql := format('%I',col_prop);
    end if;
    if col_rule='auto' then
      numeric_value := format('btrim((%s)::text)',field_sql);
      numeric_condition := format('(%s='''' or %s ~ ''^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$'')',numeric_value,numeric_value);
      execute format('select count(nullif((%s)::text,'''')),count(*) filter(where nullif((%s)::text,'''') is not null and %s) from %s%s',field_sql,field_sql,numeric_condition,rel,conditions)
        into count_value,numeric_count;
      if count_value=numeric_count then
        execute format('select coalesce(sum(case when %s then coalesce(nullif(%s,''''),''0'')::numeric end),0) from %s%s',numeric_condition,numeric_value,rel,conditions) into value;
      else value := count_value;
      end if;
    elsif col_rule='count' then
      execute format('select count(%s) from %s%s',field_sql,rel,conditions) into count_value;
      value := count_value;
    else
      numeric_condition := format('(%s)::text ~ ''^-?[0-9]+(\.[0-9]+)?$''',field_sql);
      agg_sql := format('select %s((%s)::numeric) from %s%s%s',col_rule,field_sql,rel,conditions,
        case when conditions='' then ' where ' else ' and ' end || numeric_condition);
      execute agg_sql into value;
    end if;
    result := jsonb_set(result,array[col_prop],jsonb_build_object('label',col_label,'rule',col_rule,'value',coalesce(value,0)),true);
  end loop;
  return jsonb_build_object('scope','server','schema',rel_schema,'table',rel_name,'results',result);
end;
$function$;
