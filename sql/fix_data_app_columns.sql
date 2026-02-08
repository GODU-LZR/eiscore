-- Batch normalize data app column field names in app_center.apps config

create or replace function public.normalize_field_name(raw text)
returns text
language plpgsql
immutable
as $$
declare
  name text;
begin
  if raw is null then
    return null;
  end if;
  name := lower(trim(raw));
  if name = '' then
    return null;
  end if;
  name := regexp_replace(name, '[^a-z0-9_]+', '_', 'g');
  if name = '' then
    return null;
  end if;
  if name !~ '^[a-z]' then
    name := 'f_' || name;
  end if;
  return name;
end;
$$;

create or replace function public.safe_parse_jsonb(raw text)
returns jsonb
language plpgsql
immutable
as $$
begin
  if raw is null or trim(raw) = '' then
    return null;
  end if;
  return raw::jsonb;
exception when others then
  return null;
end;
$$;

with data_apps as (
  select
    id,
    config,
    case
      when jsonb_typeof(config->'columns') = 'array' then config->'columns'
      when jsonb_typeof(config->'columns') = 'string' then public.safe_parse_jsonb(config->>'columns')
      else null
    end as columns_raw,
    case
      when jsonb_typeof(config->'staticHidden') = 'array' then config->'staticHidden'
      when jsonb_typeof(config->'staticHidden') = 'string' then public.safe_parse_jsonb(config->>'staticHidden')
      else null
    end as hidden_raw
  from app_center.apps
  where app_type = 'data'
),
normalized as (
  select
    d.id,
    jsonb_agg(
      case
        when nf.norm_field is null then cols.col
        else
          cols.col
          || jsonb_build_object('field', nf.norm_field, 'prop', nf.norm_field)
          || case when nf.norm_dep is not null then jsonb_build_object('dependsOn', nf.norm_dep) else '{}'::jsonb end
      end
    ) as columns_norm
  from data_apps d
  join lateral (
    select
      case
        when jsonb_typeof(raw_col) = 'object' then raw_col
        when jsonb_typeof(raw_col) = 'string' then jsonb_build_object('label', trim(both '\"' from raw_col::text))
        else raw_col
      end as col
    from jsonb_array_elements(d.columns_raw) as raw_col
  ) as cols on d.columns_raw is not null
  cross join lateral (
    select
      public.normalize_field_name(coalesce(cols.col->>'field', cols.col->>'prop', cols.col->>'label', '')) as norm_field,
      public.normalize_field_name(cols.col->>'dependsOn') as norm_dep
  ) as nf
  group by d.id
),
hidden_norm as (
  select
    d.id,
    coalesce(
      jsonb_agg(to_jsonb(h.val)) filter (where h.val is not null),
      '[]'::jsonb
    ) as hidden_norm
  from data_apps d
  join normalized n on n.id = d.id
  left join lateral (
    select array_agg(distinct elem->>'prop') as props
    from jsonb_array_elements(n.columns_norm) elem
  ) as col_props on true
  left join lateral (
    select public.normalize_field_name(value) as val
    from jsonb_array_elements_text(coalesce(d.hidden_raw, '[]'::jsonb))
  ) as h on true
  where col_props.props is null or h.val = any(col_props.props)
  group by d.id
)
update app_center.apps a
set config = jsonb_set(
  jsonb_set(a.config, '{columns}', n.columns_norm, true),
  '{staticHidden}', coalesce(h.hidden_norm, '[]'::jsonb), true
)
from normalized n
left join hidden_norm h on h.id = n.id
where a.id = n.id;
